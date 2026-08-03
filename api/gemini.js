// Vercel Serverless Function: Secure Gemini 2.0 Flash API Endpoint
// Keeps API keys hidden on the server side

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { promptText } = req.body || {};
    if (!promptText) {
      return res.status(400).json({ error: 'promptText is required' });
    }

    // Secure server-side environment variable
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

    if (!apiKey || apiKey.includes('YOUR_GEMINI_API_KEY')) {
      return res.status(500).json({ error: 'Server GEMINI_API_KEY environment variable is not configured.' });
    }

    const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
    const payload = {
      contents: [
        {
          parts: [{ text: promptText }]
        }
      ]
    };

    const response = await fetch(`${BASE_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: `Gemini API returned status ${response.status}`, details: errText });
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];
    const generatedText = candidate?.content?.parts?.[0]?.text;

    if (!generatedText) {
      return res.status(500).json({ error: 'No text candidate returned from Gemini.' });
    }

    return res.status(200).json({ text: generatedText });
  } catch (error) {
    console.error('Serverless Gemini Error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
}
