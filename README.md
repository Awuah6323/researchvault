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

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.
