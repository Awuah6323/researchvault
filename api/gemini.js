// api/gemini.js
// Vercel serverless function — runs server-side only.
// The API key here is read from process.env.GEMINI_API_KEY (no VITE_ prefix),
// so it never gets bundled into the client JavaScript.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { promptText } = req.body || {};

  if (!promptText) {
    return res.status(400).json({ error: 'Missing promptText in request body' });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY is not configured on the server' });
  }

  try {
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
        }),
      }
    );

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
  } catch (err) {
    console.error('Gemini proxy error:', err);
    return res.status(500).json({ error: 'Internal server error calling Gemini API' });
  }
}
