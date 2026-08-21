// api/gemini.js
// Vercel serverless function — runs server-side only.
// The API key here is read from process.env.GEMINI_API_KEY (no VITE_ prefix),
// so it never gets bundled into the client JavaScript.
//
// Two response shapes:
//
//   { promptText }                 -> JSON  { text }        (one blocking call)
//   { promptText, stream: true }   -> text/plain, chunked   (progressive)
//
// The streaming path exists because the blocking one is why the app felt slow:
// nothing at all appeared on screen until the model had finished generating,
// which for a full literature review is tens of seconds of empty spinner. The
// generation is not meaningfully faster now — but the first words land in about
// a second instead of at the end, which is the part a person actually feels.
//
// The streamed body is RAW TEXT, not re-framed SSE. Gemini's SSE envelope is
// unwrapped here and only the token text is forwarded, so the browser side is a
// plain TextDecoder loop with no second parser to get subtly wrong.

const MODEL = 'gemini-3.5-flash';
const API_ROOT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}`;

// Generation settings are chosen HERE, by name, rather than accepted from the
// request body. This endpoint is unauthenticated, so anything it takes from the
// caller is something a stranger can set — `maxOutputTokens` in particular is a
// direct lever on the project's bill. The client picks a mode; the server picks
// the numbers.
//
// `thinkingLevel` is the single biggest factor in how fast the app FEELS.
// gemini-3.5-flash defaults to "medium", which spends ~500 reasoning tokens
// before emitting a single visible character: measured time-to-first-token for
// a one-sentence question was a median of 13s at the default, 7.6s at "low",
// and 1.3s at "minimal". Streaming cannot help with that delay — there is
// simply nothing to stream yet — so the level is tuned per mode. Thinking
// tokens are also billed, so the lower levels are cheaper as well as faster.
const MODES = {
  // Conversational: a ceiling that keeps chat replies chat-sized rather than
  // letting them sprawl into essays, and minimal reasoning because the delay is
  // what the user notices. Spot-checked against the default on conceptual
  // questions ("explain a p-value") with no loss of answer quality.
  chat: {
    temperature: 0.7,
    topP: 0.95,
    maxOutputTokens: 2048,
    thinkingConfig: { thinkingLevel: 'minimal' }
  },
  // Structured multi-section reviews: low temperature for consistent adherence
  // to the required section order, and a high ceiling because a 12-section
  // synthesis genuinely needs the room. Without an explicit value the model
  // default was silently truncating long reviews mid-section.
  //
  // Reasoning is kept here rather than minimised — comparing two papers aspect
  // by aspect is the one place in this app where it earns its latency — but
  // held at "low" so that thinking does not eat into the 60s function ceiling
  // that the generation itself needs.
  review: {
    temperature: 0.4,
    topP: 0.9,
    maxOutputTokens: 8192,
    thinkingConfig: { thinkingLevel: 'low' }
  },
  // Paper summaries.
  summary: {
    temperature: 0.5,
    topP: 0.9,
    maxOutputTokens: 4096,
    thinkingConfig: { thinkingLevel: 'low' }
  }
};

/**
 * Pull the token text out of one SSE event.
 *
 * A single event can legitimately carry several parts, and non-`data:` lines
 * (comments, keepalives) appear in a normal stream — both are handled by just
 * concatenating whatever text is found and ignoring everything else.
 */
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
      // Not valid JSON — a keepalive or a fragment. Skipping is correct; the
      // buffering in the caller guarantees complete events, so this is not a
      // truncation risk.
    }
  }

  return out;
}

/** Ask Gemini for a completion. `sse` selects the streaming endpoint. */
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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { promptText, stream, mode } = req.body || {};

  if (!promptText) {
    return res.status(400).json({ error: 'Missing promptText in request body' });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server' });
  }

  const generationConfig = MODES[mode] || MODES.chat;

  // If the reader closes the tab mid-answer there is no point paying for the
  // rest of the generation.
  //
  // The disconnect signal has to come from `res`, NOT from `req`. On Node 16+
  // an IncomingMessage emits 'close' as soon as the request body has been fully
  // read — and the runtime parses req.body before this handler is called, so
  // that has already happened by now. Listening on req therefore aborts every
  // single request the instant it arrives, which returns an empty 200 in about
  // 7ms and looks exactly like the model producing nothing.
  //
  // `res` closes in two situations: we finished writing, or the client went
  // away. writableEnded is what tells those apart.
  const controller = new AbortController();
  const onClientGone = () => {
    if (!res.writableEnded) controller.abort();
  };
  res.on('close', onClientGone);

  try {
    if (!stream) {
      const response = await callGemini(promptText, generationConfig, apiKey, false, controller.signal);

      if (!response.ok) {
        const errBody = await response.text().catch(() => '');
        console.error(`Gemini API error ${response.status}:`, errBody);
        return res.status(response.status).json({ error: 'Gemini API request failed', details: errBody });
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        return res.status(502).json({ error: 'Gemini API returned no text' });
      }

      return res.status(200).json({ text });
    }

    // ---- Streaming path -------------------------------------------------
    const upstream = await callGemini(promptText, generationConfig, apiKey, true, controller.signal);

    if (!upstream.ok || !upstream.body) {
      const errBody = await upstream.text().catch(() => '');
      console.error(`Gemini stream error ${upstream.status}:`, errBody);
      return res
        .status(upstream.ok ? 502 : upstream.status)
        .json({ error: 'Gemini API request failed', details: errBody });
    }

    // Headers are deliberately withheld until the first token arrives. Once
    // they go out the status code is fixed, so sending them early would mean a
    // stream that produces nothing still had to report 200 OK. Waiting keeps
    // the "no text at all" case a real 502 that the client can fall back on.
    let headersSent = false;
    const beginStream = () => {
      if (headersSent) return;
      headersSent = true;
      res.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        // no-transform stops intermediaries from buffering to recompress, and
        // X-Accel-Buffering: no is what actually defeats proxy buffering.
        // Without it the whole body can be held back and released at the end,
        // which looks identical to not streaming at all.
        'Cache-Control': 'no-cache, no-transform',
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

      // Events are separated by a blank line. Only complete events are parsed,
      // so a JSON object split across two TCP chunks is never seen half-formed.
      for (;;) {
        const sep = /\r?\n\r?\n/.exec(buffer);
        if (!sep) break;
        const rawEvent = buffer.slice(0, sep.index);
        buffer = buffer.slice(sep.index + sep[0].length);
        emit(rawEvent);
      }
    }

    // A final event may arrive without its trailing blank line.
    buffer += decoder.decode();
    if (buffer.trim()) emit(buffer);

    if (!headersSent) {
      return res.status(502).json({ error: 'Gemini API returned no text' });
    }

    return res.end();
  } catch (err) {
    // An abort here is the client having navigated away, not a failure.
    if (err?.name === 'AbortError') {
      if (!res.headersSent) return res.end();
      return res.end();
    }

    console.error('Gemini proxy error:', err);

    // Mid-stream the status line is already committed, so the only honest
    // signal left is to close the connection. The client keeps whatever text it
    // received and reports the answer as incomplete.
    if (res.headersSent) return res.end();
    return res.status(500).json({ error: 'Internal server error calling Gemini API' });
  } finally {
    res.off?.('close', onClientGone);
  }
}
