// api/gemini.js
// ResearchVault Gemini proxy (Vercel serverless function).
//
// The whole reason this endpoint exists is that GEMINI_API_KEY must never reach
// the browser. Everything else here follows from that: because the key is
// spendable and this is the only door to it, the endpoint has to care who is
// knocking, how often, and how large the request is.

import { beginRequest, fail, readJsonBody, clientIp } from './_lib/http.js';
import { enforce, LIMITS } from './_lib/rateLimit.js';
import { getUserFromRequest, isAuthConfigured } from './_lib/auth.js';
import { validate, str, bool, stripControlChars, isValidationError } from './_lib/validate.js';

const MODEL = 'gemini-3.5-flash';
const API_ROOT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}`;

// The largest prompt the app itself builds is the multi-paper synthesis, whose
// content budget is 24,000 characters plus its instructions. 48 KB leaves room
// for that with margin, and refuses anything that is not this app.
const MAX_PROMPT_CHARS = 48000;
const MAX_BODY_BYTES = 128 * 1024;
const UPSTREAM_TIMEOUT_MS = 55000; // under the 60s function limit in vercel.json

const MODES = {
  chat: {
    temperature: 0.7,
    topP: 0.95,
    maxOutputTokens: 2048,
    thinkingConfig: { thinkingLevel: 'minimal' }
  },
  review: {
    temperature: 0.4,
    topP: 0.9,
    maxOutputTokens: 8192,
    thinkingConfig: { thinkingLevel: 'low' }
  },
  summary: {
    temperature: 0.5,
    topP: 0.9,
    maxOutputTokens: 4096,
    thinkingConfig: { thinkingLevel: 'low' }
  }
};

const SCHEMA = {
  promptText: str({ required: true, min: 1, max: MAX_PROMPT_CHARS }),
  mode: str({ required: false, allow: Object.keys(MODES) }),
  stream: bool({ fallback: false })
};

function extractText(rawEvent) {
  let out = '';

  for (const line of rawEvent.split(/\r?\n/)) {
    const trimmed = line.trimStart();
    if (!trimmed.startsWith('data:')) continue;

    const payload = trimmed.slice(5).trim();
    if (!payload || payload === '[DONE]') continue;

    try {
      const parts = JSON.parse(payload)?.candidates?.[0]?.content?.parts;
      if (Array.isArray(parts)) {
        for (const part of parts) {
          if (typeof part?.text === 'string') out += part.text;
        }
      }
    } catch {
      // Keepalive or fragment line
    }
  }

  return out;
}

function callGemini(promptText, generationConfig, apiKey, sse, signal) {
  const url = sse
    ? `${API_ROOT}:streamGenerateContent?alt=sse`
    : `${API_ROOT}:generateContent`;

  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: promptText }] }],
      generationConfig
    }),
    signal
  });
}

export default async function handler(req, res) {
  if (!beginRequest(req, res, { methods: ['POST'] })) return;

  // ---------------------------------------------------------------- WHO
  //
  // Without this the endpoint is an open, unmetered LLM relay billed to the
  // project owner: anyone who reads the JavaScript bundle knows the path and
  // the body shape. The client already holds a Supabase access token for every
  // signed-in user, so sending it costs the app nothing.
  //
  // The guard is conditional on Supabase being configured because the app is
  // designed to run without it (see .env.example: no credentials means local
  // only). A deployment in that state cannot verify anyone, and demanding a
  // token there would simply break the AI features. Anonymous callers still
  // face the IP-keyed rate limit below.
  const user = await getUserFromRequest(req);

  if (isAuthConfigured() && !user) {
    return fail(res, 401, 'Sign in to use the AI features.');
  }

  const identity = user ? `u:${user.id}` : `ip:${clientIp(req)}`;

  // Two windows: a burst limit for a runaway client, and a daily ceiling so a
  // single account cannot quietly spend the month's quota one minute at a time.
  if (!(await enforce(req, res, 'ai', {
    ...LIMITS.AI_PER_MINUTE,
    identity,
    message: 'You are sending AI requests too quickly. Please wait a moment.'
  }))) return;

  if (!(await enforce(req, res, 'ai:day', {
    ...LIMITS.AI_PER_DAY,
    identity,
    message: 'Daily AI request limit reached. Please try again tomorrow.'
  }))) return;

  // ---------------------------------------------------------------- WHAT

  let input;
  try {
    input = validate(await readJsonBody(req, MAX_BODY_BYTES), SCHEMA);
  } catch (err) {
    if (err?.code === 'BODY_TOO_LARGE') {
      return fail(res, 413, 'That request is too large to process.');
    }
    if (isValidationError(err)) {
      // Validation messages are written by us and name only the field, so they
      // are safe to return and genuinely useful to a developer.
      return fail(res, 400, err.message);
    }
    return fail(res, 400, 'Invalid request.', err);
  }

  // Control and bidi characters are stripped after length validation: they
  // carry no meaning for the model and are a way to smuggle text past a human
  // reading the prompt.
  const promptText = stripControlChars(input.promptText);
  if (!promptText.trim()) {
    return fail(res, 400, 'promptText is required');
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // The client is told the feature is unavailable; the operator is told why.
    // Reversing those two is how a misconfiguration becomes a disclosure.
    return fail(res, 503, 'The AI service is not available right now.', 'GEMINI_API_KEY is not set');
  }

  const generationConfig = MODES[input.mode] || MODES.chat;

  const controller = new AbortController();
  const onClientGone = () => {
    if (!res.writableEnded) controller.abort();
  };
  res.on('close', onClientGone);

  // An upstream that never answers would otherwise hold the function open until
  // the platform kills it, with the client waiting the whole time.
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    if (!input.stream) {
      const response = await callGemini(promptText, generationConfig, apiKey, false, controller.signal);

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        // Upstream status and body stay in the log. A provider error body can
        // quote the request, name internal endpoints, and describe the account.
        return fail(res, 502, 'The AI service could not complete that request.', `Gemini ${response.status}: ${detail}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        return fail(res, 502, 'The AI service returned an empty response.', JSON.stringify(data).slice(0, 500));
      }

      return res.status(200).json({ text });
    }

    const upstream = await callGemini(promptText, generationConfig, apiKey, true, controller.signal);

    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text().catch(() => '');
      return fail(res, 502, 'The AI service could not complete that request.', `Gemini stream ${upstream.status}: ${detail}`);
    }

    let headersSent = false;
    const beginStream = () => {
      if (headersSent) return;
      headersSent = true;
      res.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store, no-transform',
        'X-Content-Type-Options': 'nosniff',
        'X-Accel-Buffering': 'no',
        Connection: 'keep-alive'
      });
      if (typeof res.flushHeaders === 'function') res.flushHeaders();
    };

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    const emit = (rawEvent) => {
      const text = extractText(rawEvent);
      if (!text) return;
      beginStream();
      res.write(text);
    };

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      for (;;) {
        const sep = /\r?\n\r?\n/.exec(buffer);
        if (!sep) break;
        const rawEvent = buffer.slice(0, sep.index);
        buffer = buffer.slice(sep.index + sep[0].length);
        emit(rawEvent);
      }
    }

    buffer += decoder.decode();
    if (buffer.trim()) emit(buffer);

    if (!headersSent) {
      return fail(res, 502, 'The AI service returned an empty response.');
    }

    return res.end();
  } catch (err) {
    if (err?.name === 'AbortError') {
      // Either the client left or the upstream timed out. Both end the same way.
      return res.end();
    }

    return fail(res, 500, 'Unable to complete the request. Please try again.', err);
  } finally {
    clearTimeout(timeout);
    res.off?.('close', onClientGone);
  }
}
