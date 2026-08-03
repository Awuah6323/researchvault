// Gemini 2.0 Flash AI Service Engine for ResearchVault

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

/**
 * Sanitizes input text to reduce risk of prompt injection and control character issues.
 */
function sanitizeInput(text, maxLen = 4000) {
  if (!text) return "";
  let clean = String(text)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "") // strip control characters
    .trim();
  return clean.length > maxLen ? clean.slice(0, maxLen) + "..." : clean;
}

async function callGeminiApi(promptText) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey || apiKey.includes("YOUR_GEMINI_API_KEY")) {
    throw new Error("Gemini API key missing or unconfigured. Please set VITE_GEMINI_API_KEY in your .env file.");
  }

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
    console.error(`Gemini API HTTP status ${response.status}`);
    throw new Error(`Gemini API service error (${response.status}). Please try again later.`);
  }

  const data = await response.json();
  const candidate = data.candidates?.[0];
  const generatedText = candidate?.content?.parts?.[0]?.text;

  if (!generatedText) {
    throw new Error("No output text received from Gemini AI model.");
  }

  return generatedText;
}

export async function generatePaperSummary(title, authors, abstractOrText, summaryType = "Executive Summary") {
  const safeTitle = sanitizeInput(title, 300);
  const safeAuthors = sanitizeInput(authors, 300);
  const safeAbstract = sanitizeInput(abstractOrText, 3000);
  const safeType = sanitizeInput(summaryType, 100);

  const prompt = `
You are ResearchVault AI, an elite academic research assistant.
Please analyze the following academic paper/book:
Title: ${safeTitle}
Authors: ${safeAuthors}
Abstract/Content: ${safeAbstract}

Task: Provide a structured ${safeType} in clean Markdown with headers and bullet points:
1. Executive Summary (3-4 concise sentences)
2. Core Methodology & Key Theoretical Contributions
3. Top 4 Actionable Findings & Implications
4. Practical Limitations & Future Scope
`;
  return callGeminiApi(prompt);
}

export async function askPaperQuestion(title, content, question) {
  const safeTitle = sanitizeInput(title, 300);
  const safeContent = sanitizeInput(content, 3000);
  const safeQuestion = sanitizeInput(question, 1000);

  const prompt = `
You are ResearchVault AI Assistant answering questions about an academic paper:
Title: ${safeTitle}
Context: ${safeContent}

User Question: ${safeQuestion}

Provide a precise, scholarly yet highly readable answer based on the context.
`;
  return callGeminiApi(prompt);
}

export async function synthesizeLiteratureReview(papers) {
  const formatted = papers.map((p, idx) => 
    `Paper ${idx + 1}: ${sanitizeInput(p.title, 300)}\nAuthors: ${sanitizeInput(p.authors, 300)}\nAbstract: ${sanitizeInput(p.abstractText, 2000)}`
  ).join("\n\n");

  const prompt = `
You are ResearchVault Literature Review Synthesis Engine.
Synthesize the following research papers into a cohesive Literature Review draft:

${formatted}

Structure your review with clear Markdown section titles:
- # Literature Synthesis & Common Themes
- ## Comparative Analysis of Methodologies
- ## Identified Gaps in Current Literature
- ## Suggested Future Research Directions
`;
  return callGeminiApi(prompt);
}

