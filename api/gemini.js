const MODEL = 'gemini-3.5-flash';
const API_ROOT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}`;

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

    const upstream = await callGemini(promptText, generationConfig, apiKey, true, controller.signal);

    if (!upstream.ok || !upstream.body) {
      const errBody = await upstream.text().catch(() => '');
      console.error(`Gemini stream error ${upstream.status}:`, errBody);
      return res
        .status(upstream.ok ? 502 : upstream.status)
        .json({ error: 'Gemini API request failed', details: errBody });
    }

    let headersSent = false;
    const beginStream = () => {
      if (headersSent) return;
      headersSent = true;
      res.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
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
      return res.status(502).json({ error: 'Gemini API returned no text' });
    }

    return res.end();
  } catch (err) {
    if (err?.name === 'AbortError') {
      if (!res.headersSent) return res.end();
      return res.end();
    }

    console.error('Gemini proxy error:', err);

    if (res.headersSent) return res.end();
    return res.status(500).json({ error: 'Internal server error calling Gemini API' });
  } finally {
    res.off?.('close', onClientGone);
  }
}
