# 📚 ResearchVault — Smart Academic Library & Literature Synthesis Engine

> An AI-powered academic research management platform to discover, organize, annotate, read, cite, and synthesize scholarly literature with Gemini 2.0 Flash AI.

---

## ✨ Features

- 🔍 **Global Academic Search**: Query over 250M+ open-access papers, DOIs, and scholarly venues via OpenAlex API integration.
- 🤖 **Gemini 2.0 Flash AI Assistant**: Generate executive summaries, methodology breakdowns, key takeaways, and ask paper-specific Q&A questions.
- 📑 **AI Literature Review Synthesizer**: Select multiple papers from your library and generate structured, multi-paper literature reviews automatically.
- 📖 **Distraction-Free Document Reader**: Embedded PDF viewer, font size controls, reader themes (Light, Sepia, Dark), reading progress tracking, and margin note taking.
- 📝 **Centralized Research Notes Hub**: Search, filter, and review all notes, highlights, and AI summaries across your entire collection.
- 🎯 **Instant Citation Generator**: Format references in APA 7th, MLA 9th, IEEE, Chicago, Harvard, BibTeX (`.bib`), and RIS export formats.
- 📤 **Data Export & Backup Restore**: Export your library as JSON or multi-paper `.bib` files, and restore library backups anytime.
- 🎨 **Scholarly Design System**: Curated academic color palettes, glassmorphism, responsive desktop sidebar, and dark mode support.

---

## 🛠️ Tech Stack

- **Frontend**: React 18, Vite 5, Lucide React
- **AI Integration**: Gemini 2.0 Flash API via Google Generative Language Engine
- **Academic API**: OpenAlex API & Crossref DOI resolution
- **Mobile Engine**: Android WebView Bridge (Capacitor/Cordova ready)
- **Deployment**: Vercel ready (`vercel.json` configured)

---

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- A Gemini API key from [Google AI Studio](https://aistudio.google.com/)

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/researchvault.git
   cd researchvault
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   Create a `.env` file in the project root:
   ```env
   VITE_GEMINI_API_KEY=your_gemini_api_key_here
   ```

4. **Run development server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your browser.

5. **Build for production**:
   ```bash
   npm run build
   ```

---

## 🩺 Scheduled Health Checks

ResearchVault performs three lightweight backend health checks each day.

### Schedule
- `02:00 UTC`
- `10:00 UTC`
- `18:00 UTC`

Cron format: `0 2,10,18 * * *`

The health check verifies that the backend can communicate with Supabase. The check performs a lightweight, non-mutating query on the database (`head` count) and does not modify user data or create artificial application activity.

### Architecture & Scheduler Configuration
- **Vercel Cron Jobs**: Configured directly in [vercel.json](file:///c:/Users/Quavo/Desktop/Mobile%20apps/researchvault/vercel.json) pointing to `/api/health`. Runs automatically when deployed to Vercel.
- **GitHub Actions (Optional / Redundant)**: Configured in [.github/workflows/health-check.yml](file:///c:/Users/Quavo/Desktop/Mobile%20apps/researchvault/.github/workflows/health-check.yml) to trigger on the same schedule for multi-cloud redundancy or external deployments.
- **Endpoint**: [api/health.js](file:///c:/Users/Quavo/Desktop/Mobile%20apps/researchvault/api/health.js) (`GET /api/health`).

### Environment Variables
- `VITE_SUPABASE_URL` / `SUPABASE_URL`: Supabase project URL.
- `VITE_SUPABASE_ANON_KEY` / `SUPABASE_ANON_KEY`: Supabase API key (RLS-protected).

### Manual Testing
Run the health check suite from your terminal:
```bash
npm run test:health
```

Or make an HTTP request to the local/deployed backend:
```bash
curl http://localhost:3000/api/health
```

Expected Response:
```json
{
  "status": "ok",
  "database": "connected",
  "timestamp": "2026-08-29T10:00:00.000Z",
  "duration_ms": 142
}
```

### Logging & Failure Handling
Health check executions are logged with a standardized format:
```text
Health Check
--------------------------------
Timestamp: 2026-08-29 10:00 UTC
Status: SUCCESS
Database: Connected
Duration: 142 ms
```

- Each scheduled check runs **independently**. If an execution fails at `02:00 UTC`, the next checks at `10:00 UTC` and `18:00 UTC` will still execute normally.
- Failures return HTTP `503 Service Unavailable` with sanitized error messages.
- Sensitive secrets (passwords, auth tokens, database credentials, API keys) are never exposed.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

