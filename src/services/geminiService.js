// ResearchVault AI Service Engine
// Gemini AI + Friendly Academic Fallback Engine

const BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent";
// NOTE: gemini-2.0-flash was retired by Google, and gemini-2.5-flash is now
// closed to new users too ("no longer available to new users" 404) — Google
// has been deprecating Gemini models fast in 2026. gemini-3.6-flash is the
// current GA flash model as of Aug 2026. If this one also 404s down the
// line, check https://ai.google.dev/gemini-api/docs/models for whatever the
// newest GA flash model is and swap the name here — same request shape.

/**
 * Sanitizes input text to reduce control characters,
 * excessive input length, and basic prompt injection risks.
 */
function sanitizeInput(text, maxLen = 4000) {
  if (!text) return "";

  let clean = String(text)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim();

  return clean.length > maxLen
    ? clean.slice(0, maxLen) + "..."
    : clean;
}

/**
 * Detect whether the user is directly calling the AI.
 */
function isCallingAI(message) {
  const text = String(message || "")
    .toLowerCase()
    .trim();

  return (
    text === "ai" ||
    text.startsWith("ai ") ||
    text.startsWith("ai,") ||
    text.startsWith("ai.") ||
    text.startsWith("hey ai") ||
    text.startsWith("hi ai") ||
    text.startsWith("hello ai") ||
    text.startsWith("researchvault ai")
  );
}

/**
 * Detect simple greetings.
 */
function isGreeting(message) {
  const query = String(message || "")
    .toLowerCase()
    .trim();

  const greetingPatterns = [
    /^hi[\s!.,]*$/i,
    /^hello[\s!.,]*$/i,
    /^hey[\s!.,]*$/i,
    /^greetings[\s!.,]*$/i,
    /^good\s*(morning|afternoon|evening)[\s!.,]*$/i,
    /^hi\s+there[\s!.,]*$/i,
    /^what'?s\s+up[\s!.,]*$/i,
    /^how\s+are\s+you[\s!.,]*$/i,
  ];

  return (
    greetingPatterns.some((pattern) =>
      pattern.test(query)
    ) ||
    query.startsWith("hi ") ||
    query.startsWith("hello ") ||
    query.startsWith("hey ")
  );
}

/**
 * Calls Gemini API.
 *
 * If Gemini is unavailable or the API key is missing,
 * the application automatically uses the friendly
 * ResearchVault Academic Fallback Engine.
 */
async function callGeminiApi(
  promptText,
  userName = "Scholar",
  rawUserMessage = ""
) {
  // Try the secure backend serverless route first (api/gemini.js).
  // The API key lives server-side there and never reaches the client bundle.
  try {
    const apiResponse = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ promptText })
    });

    if (apiResponse.ok) {
      const data = await apiResponse.json();
      if (data && data.text) {
        return data.text;
      }
    } else {
      const errBody = await apiResponse.text().catch(() => "");
      console.warn(`/api/gemini responded with ${apiResponse.status}: ${errBody}`);
    }
  } catch (backendErr) {
    console.warn("Backend /api/gemini call failed, trying direct client call.", backendErr);
  }

  // Direct client call as a secondary fallback (only fires if you set
  // VITE_GEMINI_API_KEY locally too — in production this should be unset
  // now that the key lives server-side, so this block will just be skipped).
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const hasValidApiKey =
    apiKey &&
    !apiKey.includes("YOUR_GEMINI_API_KEY") &&
    apiKey.length > 20;

  if (hasValidApiKey) {
    try {
      const payload = {
        contents: [
          {
            parts: [
              {
                text: promptText,
              },
            ],
          },
        ],
      };

      // Google's current docs authenticate via the x-goog-api-key header
      // rather than a ?key= query param. This matters especially for the
      // newer "AQ." auth-style keys AI Studio now issues by default.
      const response = await fetch(
        BASE_URL,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },

          body: JSON.stringify(payload),
        }
      );

      if (response.ok) {
        const data = await response.json();

        const candidate =
          data.candidates?.[0];

        const generatedText =
          candidate?.content?.parts?.[0]?.text;

        if (generatedText) {
          return generatedText;
        }
      } else {
        // Surface the real reason in dev tools instead of failing silently
        const errBody = await response.text().catch(() => "");
        console.warn(
          `Gemini API responded with ${response.status}: ${errBody}`
        );
      }
    } catch (err) {
      console.warn(
        "Direct Gemini API call failed. Using ResearchVault Academic Fallback Engine.",
        err
      );
    }
  }

  // Fallback to ResearchVault Academic Engine (only reached if the direct call failed)
  return generateScholarlyFallbackResponse(
    promptText,
    userName,
    rawUserMessage
  );
}

/**
 * Friendly ResearchVault AI fallback engine.
 *
 * This runs only when Gemini is unavailable (no key, network error,
 * or non-OK response) — it is a scripted safety net, not a real chatbot.
 */
function generateScholarlyFallbackResponse(
  prompt,
  userName = "Scholar",
  rawUserMessage = ""
) {
  const query = String(rawUserMessage || prompt || "")
    .toLowerCase()
    .trim();

  // -----------------------------------------
  // GREETINGS
  // -----------------------------------------

  if (isGreeting(query)) {
    const greetings = [
      `Hey ${userName}! 😊 It's great to hear from you. How can I help you with your research today?`,

      `Hello ${userName}! 👋 I hope you're doing well. What are we working on today?`,

      `Hey there! 😊 I'm ready when you are. Whether it's a research paper, literature review, or just a question that's been bothering you, let's figure it out together.`,

      `Good to see you, ${userName}! 🌟 What would you like to explore today?`,
    ];

    return greetings[
      Math.floor(
        Math.random() * greetings.length
      )
    ];
  }

  // -----------------------------------------
  // USER CALLS THE AI
  // -----------------------------------------

  if (isCallingAI(query)) {
    const responses = [
      `Hey ${userName}! 😊 I'm right here. What can I help you with?`,

      `Yes, ${userName}! 👋 I'm listening. What's on your mind?`,

      `Hey! 😊 I'm ready. Tell me what you need help with and we'll work through it together.`,

      `I'm here, ${userName}! 🌟 What are we working on today?`,
    ];

    return responses[
      Math.floor(
        Math.random() * responses.length
      )
    ];
  }

  // -----------------------------------------
  // TRANSFORMER / ATTENTION
  // -----------------------------------------

  if (
    query.includes("transformer") ||
    query.includes("attention")
  ) {
    return `Hey ${userName}! 😊 Absolutely, let's break this down in a simple way.

### 🤖 Transformer Architecture & Attention Mechanisms

The **Transformer** architecture is a type of neural network designed to understand relationships between different parts of an input sequence.

The key idea is **attention**.

### 1. Self-Attention

The model looks at different words or tokens and determines how strongly they relate to one another.

### 2. Query, Key, and Value

The **Query (Q)**, **Key (K)**, and **Value (V)** vectors help the model determine which information is relevant and important.

### 3. Multi-Head Attention

Instead of looking at relationships in only one way, the model uses multiple attention heads to capture different types of relationships.

### 4. Positional Information

Since Transformers do not process information sequentially like traditional RNNs, positional information helps the model understand the order of tokens.

### 5. Main Advantage

Transformers can process many parts of a sequence in parallel, making them highly effective for modern AI applications.

If you'd like, I can also explain **self-attention using a simple real-world example**. That usually makes the concept much easier to understand.`;
  }

  // -----------------------------------------
  // LITERATURE REVIEW / METHODOLOGY
  // -----------------------------------------

  if (
    query.includes("literature review") ||
    query.includes("methodology")
  ) {
    return `Hey ${userName}! 😊 That's an important part of academic research. Let's make it easier to approach.

### 📚 A Simple Literature Review Framework

When conducting a literature review, you can work through these stages:

### 1. Define Your Research Scope

Start by identifying the main topic, research problem, and boundaries of your review.

### 2. Identify Research Themes

Group studies according to common themes, theories, methods, or findings.

### 3. Compare the Studies

Don't just summarize each paper separately. Look at how researchers agree, disagree, or approach the problem differently.

### 4. Identify the Research Gap

Ask yourself:

- What has already been studied?
- What is still unclear?
- What problems have not been solved?
- What limitations exist in previous research?

### 5. Connect the Gap to Your Research

Explain how your own study can contribute to addressing the identified gap.

A good literature review should tell a **story about what researchers know, what they don't know, and why your research matters**.

If you tell me your research topic, I can help you build the literature review structure around it.`;
  }

  // -----------------------------------------
  // RESEARCH TOPIC
  // -----------------------------------------

  if (
    query.includes("research topic") ||
    query.includes("research title")
  ) {
    return `Hey ${userName}! 😊 I'd be happy to help you with that.

Choosing a good research topic usually starts with three things:

- 💡 A problem you genuinely find interesting
- 🔬 A problem that can be investigated scientifically
- 📚 Enough existing literature to support your study

We can also look at the **research gap**, the **relevance of the problem**, and whether the topic is practical within your available time and resources.

Tell me the area you're interested in, and I'll help you develop some strong research topics.`;
  }

  // -----------------------------------------
  // RESEARCH GAP
  // -----------------------------------------

  if (
    query.includes("research gap") ||
    query.includes("gap in research")
  ) {
    return `That's a great question, ${userName}! 😊 Finding a research gap is one of the most important parts of developing a strong research project.

A **research gap** is an area where existing studies have not fully answered a question, solved a problem, or explored a particular situation.

You can look for gaps by examining:

- What previous researchers have not studied
- Contradictions between existing findings
- Limitations mentioned in previous studies
- Areas that have been studied in other countries but not your local context
- New technologies that have not yet been applied to an existing problem

If you give me your research topic, I can help you identify possible research gaps and turn them into research questions.`;
  }

  // -----------------------------------------
  // GENERAL FALLBACK
  // -----------------------------------------

  return `Hey ${userName}! 😊 I'm having trouble reaching the AI service right now, so I can't give you a full answer to that one — but here's what I can normally help with once it's back:

- 📚 Understanding research papers
- 🔬 Developing research topics
- 📝 Writing literature reviews
- 🧪 Research methodology
- 📊 Understanding data and analysis
- 💡 Finding research gaps
- 📖 Summarizing academic papers
- 🎓 Academic writing and citations

Try asking again in a moment, or check that the API key/backend is set up correctly.`;
}

/**
 * Generate an academic paper summary.
 */
export async function generatePaperSummary(
  title,
  authors,
  abstractOrText,
  summaryType = "Executive Summary"
) {
  const safeTitle = sanitizeInput(
    title,
    300
  );

  const safeAuthors = sanitizeInput(
    authors,
    300
  );

  const safeAbstract = sanitizeInput(
    abstractOrText,
    3000
  );

  const safeType = sanitizeInput(
    summaryType,
    100
  );

  const prompt = `
You are ResearchVault AI, a friendly and highly knowledgeable academic research assistant.

You are helping a researcher named "${safeAuthors || "Scholar"}".

Be clear, supportive, and conversational while maintaining academic accuracy.

Please analyze the following academic paper or book:

Title:
${safeTitle}

Authors:
${safeAuthors}

Abstract or Content:
${safeAbstract}

Task:

Provide a structured ${safeType} in clean Markdown.

Structure your response with:

# Executive Summary

Provide 3-4 concise sentences explaining the main idea.

# Core Methodology & Key Theoretical Contributions

Explain the main methodology, theories, frameworks, or concepts.

# Top 4 Actionable Findings & Implications

List four important findings and explain why they matter.

# Practical Limitations & Future Scope

Discuss important limitations and possible directions for future research.

Use an approachable academic tone.
`;

  return callGeminiApi(
    prompt,
    safeAuthors || "Scholar"
  );
}

/**
 * Ask a question about a specific academic paper.
 */
export async function askPaperQuestion(
  title,
  content,
  question
) {
  const safeTitle = sanitizeInput(
    title,
    300
  );

  const safeContent = sanitizeInput(
    content,
    3000
  );

  const safeQuestion = sanitizeInput(
    question,
    1000
  );

  const prompt = `
You are ResearchVault AI, a friendly academic research assistant.

You are helping a researcher understand a specific academic paper.

Paper Title:
${safeTitle}

Paper Context:
${safeContent}

Researcher's Question:
${safeQuestion}

Answer the researcher's question clearly and accurately based primarily on the provided context.

Start naturally and conversationally when appropriate.

Do not invent information that is not supported by the provided paper context.

If the context does not contain enough information to answer the question confidently, clearly say so and explain what additional information would be useful.

Use Markdown only when it improves readability.
`;

  return callGeminiApi(
    prompt,
    "Scholar"
  );
}

/**
 * Main conversational ResearchVault AI chat.
 *
 * This is a general-purpose chatbox: it is prompted to answer ANY
 * question the user asks (not just research topics), conversationally.
 */
export async function chatWithGemini(
  userMessage,
  chatHistory = [],
  userName = "Scholar"
) {
  const safeMsg = sanitizeInput(
    userMessage,
    2000
  );

  const safeUserName = sanitizeInput(
    userName,
    100
  );

  const historyText = chatHistory
    .slice(-8)
    .map(
      (h) =>
        `${
          h.sender === "user"
            ? "User"
            : "ResearchVault AI"
        }: ${sanitizeInput(h.text, 1000)}`
    )
    .join("\n");

  const directAICall =
    isCallingAI(safeMsg);

  const greeting =
    isGreeting(safeMsg);

  const prompt = `
You are ResearchVault AI, a friendly, intelligent, supportive, and conversational AI assistant. Think of yourself as a general-purpose chatbox first, with a specialty in academic research.

You are chatting directly with a user named "${safeUserName}".

Your personality:

- Be warm, friendly, natural, and human-like.
- Talk to the user as a helpful, knowledgeable companion.
- Do not sound like a formal textbook unless the user specifically asks for a formal academic response.
- Be encouraging and supportive when the user is confused, stressed, or struggling.
- Use the user's name naturally when appropriate.
- Do NOT use the user's name in every response.
- Do NOT start every response with the same greeting.
- Avoid sounding robotic, repetitive, or overly formal.
- Respond naturally based on the context of the conversation.
- If the user says "AI", "Hey AI", "Hi AI", or calls you "ResearchVault AI", recognize that they are talking directly to you.
- If the user shares good news, celebrate with them.
- If the user is frustrated, acknowledge their frustration and reassure them.

IMPORTANT — SCOPE OF QUESTIONS:

- You are NOT limited to academic or research questions. Answer ANY question the user asks — general knowledge, coding, everyday advice, casual conversation, math, current events framed generally, anything — as accurately and helpfully as you can.
- If the user asks a simple question, give a simple and friendly answer.
- If the user asks a complex or academic question, explain it clearly while maintaining a conversational tone.
- If the user asks for help with research, guide them step by step.
- If you are genuinely unsure or the question needs information you don't have, say so honestly instead of guessing.
- Ask a natural follow-up question when it would help continue the conversation.
- Use emojis occasionally when they fit naturally, but do not overuse them.

CONVERSATION STYLE:

Do NOT force this exact opening every time:

"Hello ${safeUserName}! 👋"

Instead, vary your responses naturally.

Possible openings include:

- "Hey ${safeUserName}! 😊"
- "Of course! I'd be happy to help."
- "Absolutely, let's work through this together."
- "Good question!"
- "That's a really interesting direction."
- "No worries, we can figure this out together."
- "Good morning! ☀️"
- "Hey! What's on your mind?"
- "I like where you're going with this."

These are examples only. Choose an opening that naturally fits the user's message.

IMPORTANT:

If this is the beginning of the conversation, a friendly greeting is appropriate.

If the conversation is already ongoing, do not add an unnecessary greeting to every response.

If the user directly calls you "AI", respond as if they are calling your attention.

If the user is simply greeting you, respond warmly and naturally.

Always prioritize answering the user's actual question, whatever the topic.

User Name:
${safeUserName}

Was the user directly calling the AI?
${directAICall ? "Yes" : "No"}

Was the user greeting the AI?
${greeting ? "Yes" : "No"}

Conversation History:
${
  historyText ||
  "No previous conversation. This is the beginning of the conversation."
}

Current User Message:
${safeMsg}

Now respond naturally to the user.

Remember:

- Be friendly.
- Be encouraging.
- Be conversational.
- Use "${safeUserName}" naturally when appropriate.
- Do not force a greeting if the conversation is already ongoing.
- Do not repeat the same opening style every time.
- Answer the user's message directly and accurately, on any topic.
- Use clean Markdown when it improves readability.
`;

  return callGeminiApi(
    prompt,
    safeUserName,
    safeMsg
  );
}

/**
 * Synthesize multiple academic papers
 * into a literature review.
 */
export async function synthesizeLiteratureReview(
  papers
) {
  const formatted = papers
    .map(
      (p, idx) =>
        `Paper ${idx + 1}: ${sanitizeInput(
          p.title,
          300
        )}
Authors: ${sanitizeInput(
          p.authors,
          300
        )}
Abstract: ${sanitizeInput(
          p.abstractText,
          2000
        )}`
    )
    .join("\n\n");

  const prompt = `
You are ResearchVault AI Literature Review Synthesis Engine.

You are helping a researcher synthesize multiple academic papers into a cohesive, professional-grade literature review — the kind that would meet the standards expected in a thesis, dissertation, or journal submission.

Be academically rigorous but explain ideas clearly and naturally.

Analyze the following research papers:

${formatted}

Create a cohesive Literature Review draft.

Structure your response with clear Markdown section titles:

# Literature Synthesis & Common Themes

Identify the major themes and common ideas across the papers.

## Comparative Analysis of Methodologies

Compare how the studies approached their research problems.

## Identified Gaps in Current Literature

Identify gaps, limitations, contradictions, or areas that require further investigation.

## Suggested Future Research Directions

Suggest logical future research directions based on the literature provided.

Important:

- Do not simply summarize each paper one by one.
- Synthesize ideas across multiple studies.
- Highlight agreements and disagreements.
- Identify meaningful relationships between studies.
- Do not invent findings that are not supported by the provided paper information.
`;

  return callGeminiApi(
    prompt,
    "Scholar"

  );
}

/**
 * Generate a formal, professional Peer Review Report for a SINGLE paper —
 * structured like a real academic peer review (as used for conference/
 * journal submissions or thesis committee review), not a loose synthesis.
 *
 * This is distinct from synthesizeLiteratureReview, which handles MULTIPLE
 * papers and produces a comparative literature review instead.
 */
export async function generatePeerReview(
  title,
  authors,
  publicationInfo,
  abstractOrText
) {
  const safeTitle = sanitizeInput(title, 300);
  const safeAuthors = sanitizeInput(authors, 300);
  const safePubInfo = sanitizeInput(publicationInfo, 300);
  const safeContent = sanitizeInput(abstractOrText, 6000);

  const prompt = `
You are ResearchVault AI acting as an expert academic peer reviewer, writing a formal Peer Review Report to a professional publishing/academic standard — the kind submitted to a journal editor or a thesis committee.

Paper under review:

Title: ${safeTitle}
Authors: ${safeAuthors}
Publication Info: ${safePubInfo || "Not provided"}

Content / Abstract provided for review:
${safeContent}

Write a complete Peer Review Report using EXACTLY this Markdown structure and section order:

# Peer Review Report

"${safeTitle}"
${safeAuthors}
${safePubInfo}

## Overview

A concise (4-6 sentence) paragraph summarizing what the paper does, its core contributions, its methodology at a high level, and whether it is well suited to its apparent venue/audience.

## 1. Summary of Contribution

A paragraph describing the paper's structure and walking through what each major section accomplishes, similar to how a reviewer would narrate the paper's arc for an editor who has not yet read it.

## 2. Strengths

A numbered list (at least 3-5 items) of genuine strengths. Each item should have a short bolded label followed by 2-4 sentences of substantiation referencing specifics from the provided content (methodology, findings, structure, contribution, etc). Do not invent specifics not supported by the provided content.

## 3. Weaknesses and Points for Clarification

A numbered list (at least 3-5 items) of substantive weaknesses, ambiguities, or open questions a rigorous reviewer would raise. Each item should have a short bolded label followed by 2-4 sentences of explanation. Be constructive and specific, not generic. Do not invent flaws not reasonably inferable from the provided content — if the provided content is too limited (e.g., only an abstract) to assess something (methodology detail, statistical validity, etc.), say so explicitly as a limitation of the review itself rather than asserting a flaw.

## 4. Significance and Contribution to the Field

A paragraph assessing the paper's overall significance, its novelty relative to existing work (as far as can be judged), and its likely influence or usefulness to the field/practitioners.

## 5. Recommendation

A short, direct recommendation paragraph (e.g., in the spirit of Accept / Minor Revisions / Major Revisions / Reject as applicable, or for coursework/thesis context, an assessment of the paper's suitability as an exemplar or its readiness for the next stage), with a one-line justification.

## References

If the provided content includes citations or referenced works, list them in a clean numbered reference list. If no reference information was provided, write: "No reference list was available in the provided content."

Important:
- Maintain a formal, professional, evidence-based reviewer tone throughout — confident but fair, never dismissive.
- Every claim about the paper's content must be grounded in the provided title/authors/content — do not fabricate results, statistics, or details that are not present in what was given.
- If the provided content is limited (e.g. only an abstract rather than full text), explicitly note in the Overview that the review is based on the abstract/available content only, and calibrate the depth of the Weaknesses section accordingly rather than asserting specific methodological flaws you cannot actually verify.
`;

  return callGeminiApi(
    prompt,
    safeAuthors || "Scholar"
  );
}