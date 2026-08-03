// ResearchVault AI Service Engine
// Gemini AI + Friendly Academic Fallback Engine

const BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
// NOTE: gemini-2.0-flash was retired by Google in 2026 — every call using it
// fails silently and falls through to the scripted fallback engine below,
// which is why the app looked "canned" instead of answering freely.
// gemini-2.5-flash is GA and current as of Aug 2026. Google's docs also list
// gemini-3.6-flash / gemini-3.5-flash-lite as the newest GA models if you
// want to upgrade further later — same request shape, just swap the model
// name in this URL.

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
  // 1. Try secure backend serverless API route (/api/gemini)
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
    }
  } catch (backendErr) {
    // Backend endpoint not active in local standalone mode; fallback to direct client call or fallback engine
  }

  // 2. Direct client fallback if VITE_GEMINI_API_KEY is configured
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

      const response = await fetch(
        `${BASE_URL}?key=${apiKey}`,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
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

  // 3. Fallback to ResearchVault Academic Engine
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

You are helping a researcher synthesize multiple academic papers into a cohesive literature review.

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