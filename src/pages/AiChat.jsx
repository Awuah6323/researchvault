import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, Loader2, Copy, Check, BookmarkPlus, RefreshCw, Bot, User, FileText, X, ChevronDown, Square } from 'lucide-react';
import { chatWithGemini, askPaperQuestion } from '../services/geminiService';
import { extractTextFromPdfFile } from '../utils/pdfExtractor';
import { storage } from '../services/storage';
import MarkdownMessage from '../components/MarkdownMessage';

// Sentinel for placeholder detection
const PLACEHOLDER_TEXT = 'Imported paper document in ResearchVault digital library.';

async function extractTextFromDataUrl(dataUrl, fileName) {
  try {
    const parts = dataUrl.split(';base64,');
    const contentType = parts[0].replace('data:', '') || 'application/pdf';
    const raw = atob(parts[1]);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    const blob = new Blob([bytes], { type: contentType });
    const file = new File([blob], fileName || 'document.pdf', { type: contentType });
    return await extractTextFromPdfFile(file);
  } catch {
    return '';
  }
}

export default function AiChat({ onSaveNote, resources = [] }) {
  const session = storage.getSession() || storage.getProfile();
  const userName = session?.name || 'Scholar';

  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'ai',
      text: `Hello ${userName}! 👋 I am your ResearchVault AI Assistant. You can ask me any research question, or tag a paper from your library using the 📎 button below to ask questions about a specific paper.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [savedId, setSavedId] = useState(null);
  const chatEndRef = useRef(null);

  // The id of the message currently being streamed into, or null. Used to show
  // the live caret and to decide whether the "composing" indicator still
  // applies — once the first chunk lands, the answer itself is the indicator.
  const [streamingId, setStreamingId] = useState(null);
  // Lets the Stop button, Clear Chat, and unmount all cancel an in-flight
  // request. Without this, leaving the page mid-answer leaves the stream
  // running and setState firing into an unmounted component.
  const abortRef = useRef(null);

  // Paper tagging state
  const [taggedPaper, setTaggedPaper] = useState(null);
  const [showPaperPicker, setShowPaperPicker] = useState(false);
  const [paperSearchQuery, setPaperSearchQuery] = useState('');
  const [extractingPaperText, setExtractingPaperText] = useState(false);
  // Cache resolved text per paper ID
  const resolvedTextsRef = useRef({});

  const quickPrompts = [
    "Explain Transformer Attention Mechanisms simply",
    "How to write a structured Literature Review section?",
    "Suggest top 5 research topics in Artificial Intelligence",
    "What are common flaws in empirical computer science papers?"
  ];

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  /**
   * Resolve the best available text for a paper.
   */
  const getResolvedPaperContent = async (paper) => {
    if (resolvedTextsRef.current[paper.id]) return resolvedTextsRef.current[paper.id];

    const stored = paper.abstractText || '';
    const isPlaceholder =
      !stored.trim() ||
      stored.trim() === PLACEHOLDER_TEXT ||
      stored.trim().toLowerCase() === 'imported paper document in researchvault digital library.';

    if (isPlaceholder && paper.pdfFileData) {
      setExtractingPaperText(true);
      const extracted = await extractTextFromDataUrl(
        paper.pdfFileData,
        paper.pdfFileName || `${paper.title}.pdf`
      );
      setExtractingPaperText(false);
      const content = extracted && extracted.trim().length > 40 ? extracted.trim() : stored;
      resolvedTextsRef.current[paper.id] = content;
      return content;
    }

    resolvedTextsRef.current[paper.id] = stored;
    return stored;
  };

  /** Cancel any in-flight answer. Safe to call when nothing is running. */
  const stopStreaming = () => {
    abortRef.current?.abort();
    abortRef.current = null;
  };

  // Leaving the page mid-answer must not leave the request running.
  useEffect(() => stopStreaming, []);

  const handleSendMessage = async (textToSend) => {
    const text = textToSend || inputMessage.trim();
    if (!text || loading) return;

    const currentTaggedPaper = taggedPaper;

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: currentTaggedPaper
        ? `📎 [${currentTaggedPaper.title}]\n${text}`
        : text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    // Captured before the append below, so the model is not sent the question it
    // is being asked to answer as part of its own conversation history.
    const historyForPrompt = messages;

    // The AI's bubble is created empty and filled in as tokens arrive, instead
    // of being appended once at the end. This is what makes the answer appear
    // progressively rather than all at once after a long silence.
    const aiId = Date.now() + 1;
    const aiMsg = {
      id: aiId,
      sender: 'ai',
      text: '',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg, aiMsg]);
    if (!textToSend) setInputMessage('');
    setLoading(true);
    setStreamingId(aiId);

    const controller = new AbortController();
    abortRef.current = controller;

    const onChunk = (chunk) => {
      setMessages(prev =>
        prev.map(m => (m.id === aiId ? { ...m, text: m.text + chunk } : m))
      );
    };

    try {
      if (currentTaggedPaper) {
        // Use paper-aware Q&A with the paper's actual content
        const paperContent = await getResolvedPaperContent(currentTaggedPaper);
        await askPaperQuestion(
          currentTaggedPaper.title,
          paperContent,
          text,
          historyForPrompt,
          userName,
          { onChunk, signal: controller.signal }
        );
      } else {
        // General chat
        await chatWithGemini(text, historyForPrompt, userName, {
          onChunk,
          signal: controller.signal
        });
      }
    } catch (err) {
      // Every chunk received was already written into the bubble, so on both
      // paths below the partial answer is preserved and only an empty bubble
      // gets replaced.
      const note =
        err?.name === 'AbortError'
          ? '_Stopped._'
          : err?.message || 'Gemini API error. Please ensure your API key is configured.';

      setMessages(prev =>
        prev.map(m => (m.id === aiId && !m.text.trim() ? { ...m, text: note } : m))
      );
    } finally {
      abortRef.current = null;
      setStreamingId(null);
      setLoading(false);
    }
  };

  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSaveToNotes = (id, text) => {
    storage.addNote(101, `AI Chat Response:\n${text}`, 1);
    setSavedId(id);
    setTimeout(() => setSavedId(null), 2000);
  };

  const handleSelectPaper = (paper) => {
    setTaggedPaper(paper);
    setShowPaperPicker(false);
    setPaperSearchQuery('');
  };

  const filteredPapers = resources.filter(r => {
    if (!paperSearchQuery.trim()) return true;
    const q = paperSearchQuery.toLowerCase();
    return r.title.toLowerCase().includes(q) || r.authors?.toLowerCase().includes(q);
  });

  // The "composing" indicator only belongs in the gap before the first token.
  // Once text is arriving, the answer itself shows that something is happening,
  // and leaving the indicator up alongside it reads as a second pending reply.
  const streamingText = messages.find(m => m.id === streamingId)?.text || '';
  const awaitingFirstToken = loading && !extractingPaperText && !streamingText.trim();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', height: 'calc(100vh - 130px)' }}>
      {/* Header.
          The title carried a sparkle icon and read "Gemini AI Research Chat
          Assistant" at 1.8rem/800 — a product banner for what is a working
          panel. It uses the same page header as every other route now. */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Research Chat</h1>
          <p className="page-subtitle">Ask a research question, or attach a paper to ask about that paper specifically.</p>
        </div>

        <button
          onClick={() => { stopStreaming(); setMessages([messages[0]]); setTaggedPaper(null); }}
          className="btn-secondary"
          title="Clear conversation"
        >
          <RefreshCw size={15} aria-hidden="true" /> Clear chat
        </button>
      </div>

      {/* Chat Messages Container */}
      <div className="glass-card" style={{ flex: 1, minHeight: 0, padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: 'var(--space-2)', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          {messages.map(msg => {
            // An AI bubble exists from before the first token arrives. Rendering
            // it while empty would flash a blank box under the typing
            // indicator, so it stays hidden until it has something to show.
            if (msg.sender === 'ai' && !msg.text) return null;

            const isStreaming = msg.id === streamingId;
            const isUser = msg.sender === 'user';

            return (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                gap: 'var(--space-3)',
                alignSelf: isUser ? 'flex-end' : 'flex-start',
                maxWidth: isUser ? '80%' : '100%',
                width: isUser ? 'auto' : '100%'
              }}
            >
              {/* Assistant replies are the content of this page, so they read
                  as text on the page rather than as a bubble. The 36px filled
                  avatar circle became a thin rule: it still marks "this side is
                  the assistant" without a decorative disc on every turn. */}
              {!isUser && (
                <div aria-hidden="true" style={{ width: '2px', borderRadius: '1px', backgroundColor: 'var(--border-color)', flexShrink: 0 }} />
              )}

              <div style={{
                padding: isUser ? '11px 15px' : '0',
                borderRadius: isUser ? 'var(--radius-lg)' : '0',
                backgroundColor: isUser ? 'var(--primary)' : 'transparent',
                color: isUser ? '#ffffff' : 'var(--text-main)',
                lineHeight: 'var(--leading-normal)',
                fontSize: 'var(--text-base)',
                minWidth: 0,
                flex: isUser ? '0 1 auto' : 1,
                // Only the user's own text is plain, so only it needs newlines
                // preserved. AI output is rendered Markdown — pre-wrap there
                // would re-introduce the blank lines of the Markdown source and
                // double-space every paragraph.
                whiteSpace: isUser ? 'pre-wrap' : 'normal'
              }}>
                {isUser
                  ? <div>{msg.text}</div>
                  : <MarkdownMessage compact>{msg.text}</MarkdownMessage>}
                <div style={{ fontSize: 'var(--text-xs)', color: isUser ? 'rgba(255,255,255,0.75)' : 'var(--text-muted)', marginTop: 'var(--space-2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-4)' }}>
                  {isStreaming
                    ? <span className="md-streaming">Generating…</span>
                    : <span>{msg.timestamp}</span>}

                  {/* Hidden mid-stream: copying or saving a half-written answer
                      is almost never what someone means to do. */}
                  {!isUser && !isStreaming && (
                    <div style={{ display: 'flex', gap: '2px' }}>
                      <button
                        onClick={() => handleCopy(msg.id, msg.text)}
                        className="icon-button"
                        title="Copy response"
                        aria-label="Copy this response"
                        style={{ padding: '4px' }}
                      >
                        {copiedId === msg.id ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
                      </button>

                      <button
                        onClick={() => handleSaveToNotes(msg.id, msg.text)}
                        className="icon-button"
                        title="Save to research notes"
                        aria-label="Save this response to research notes"
                        style={{ padding: '4px' }}
                      >
                        {savedId === msg.id ? <Check size={13} aria-hidden="true" /> : <BookmarkPlus size={13} aria-hidden="true" />}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            );
          })}

          {extractingPaperText && (
            <div role="status" style={{ display: 'flex', gap: 'var(--space-3)', alignSelf: 'flex-start', alignItems: 'center', fontSize: 'var(--text-md)', color: 'var(--text-muted)' }}>
              <FileText size={16} aria-hidden="true" />
              <span>Reading the PDF…</span>
            </div>
          )}

          {awaitingFirstToken && (
            <div role="status" style={{ display: 'flex', gap: 'var(--space-3)', alignSelf: 'flex-start', alignItems: 'center', fontSize: 'var(--text-md)', color: 'var(--text-muted)' }}>
              <Loader2 size={16} aria-hidden="true" className="animate-spin" />
              <span>Thinking…</span>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Tagged Paper Indicator */}
        {taggedPaper && (
          <div className="notice" style={{ marginTop: 'var(--space-3)' }}>
            <FileText size={15} aria-hidden="true" style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {taggedPaper.title}
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                Answers will be based on this paper
              </div>
            </div>
            <button type="button" onClick={() => setTaggedPaper(null)} className="icon-button" title="Remove attached paper" aria-label={`Remove attached paper "${taggedPaper?.title || ''}"`} style={{ flexShrink: 0 }}>
              <X size={15} aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Quick Prompts. The 💡 prefix on each was decoration on a control
            whose text already says what it does. */}
        {!taggedPaper && messages.length <= 1 && (
          <div style={{ display: 'flex', gap: 'var(--space-2)', paddingTop: 'var(--space-4)', marginTop: 'var(--space-3)', overflowX: 'auto', borderTop: '1px solid var(--border-color)' }}>
            {quickPrompts.map((qp, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(qp)}
                className="btn-secondary"
                style={{
                  fontSize: 'var(--text-xs)',
                  padding: '6px 11px',
                  minHeight: '30px',
                  color: 'var(--text-muted)',
                  flexShrink: 0
                }}
              >
                {qp}
              </button>
            ))}
          </div>
        )}

        {/* Paper Picker Dropdown */}
        {showPaperPicker && (
          <div style={{
            marginTop: 'var(--space-2)',
            padding: 'var(--space-3)',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--bg-main)',
            border: '1px solid var(--border-color)',
            maxHeight: '260px',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="overline">Attach a paper</span>
              <button type="button" onClick={() => setShowPaperPicker(false)} className="icon-button" aria-label="Close paper picker" style={{ padding: '4px' }}>
                <X size={15} aria-hidden="true" />
              </button>
            </div>
            <label htmlFor="aichat-paper-search" className="sr-only">Search your papers to attach one</label>
            <input
              id="aichat-paper-search"
              type="search"
              value={paperSearchQuery}
              onChange={(e) => setPaperSearchQuery(e.target.value)}
              placeholder="Search your papers…"
              autoFocus
              style={{ fontSize: 'var(--text-md)', backgroundColor: 'var(--bg-card)' }}
            />
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
              {filteredPapers.length === 0 ? (
                <div style={{ padding: 'var(--space-4)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-md)' }}>
                  {resources.length === 0 ? 'No papers in your library yet.' : 'No papers match your search.'}
                </div>
              ) : (
                filteredPapers.slice(0, 15).map(paper => (
                  /* Hover used to be applied with two inline mouse handlers
                     that fought the selected state; it is one CSS class now. */
                  <button
                    key={paper.id}
                    onClick={() => handleSelectPaper(paper)}
                    className="card-interactive"
                    style={{
                      padding: '8px 10px',
                      borderRadius: 'var(--radius-sm)',
                      backgroundColor: taggedPaper?.id === paper.id ? 'var(--primary-light)' : 'transparent',
                      border: 'none',
                      textAlign: 'left',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px'
                    }}
                  >
                    <span style={{ fontWeight: 600, fontSize: 'var(--text-md)', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {paper.title}
                    </span>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                      {paper.authors} · {paper.publicationYear}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* Chat Input Form */}
        <form
          onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
          style={{ display: 'flex', gap: 'var(--space-2)', paddingTop: 'var(--space-4)', marginTop: 'var(--space-3)', borderTop: '1px solid var(--border-color)', alignItems: 'center' }}
        >
          {/* Paper Tag Button */}
          <button
            type="button"
            onClick={() => setShowPaperPicker(!showPaperPicker)}
            className="icon-button"
            title={taggedPaper ? `Attached: ${taggedPaper.title}` : 'Attach a paper to ask about it'}
            aria-label={taggedPaper ? `Change attached paper (currently "${taggedPaper.title}")` : 'Attach a paper to ask about it'}
            aria-expanded={showPaperPicker}
            style={{
              padding: '10px',
              border: '1px solid var(--border-color)',
              backgroundColor: taggedPaper ? 'var(--primary-light)' : 'transparent',
              color: taggedPaper ? 'var(--primary)' : 'var(--text-muted)',
              flexShrink: 0
            }}
          >
            <FileText size={17} aria-hidden="true" />
          </button>

          <label htmlFor="aichat-message" className="sr-only">
            Your message to the research assistant
          </label>
          <input
            id="aichat-message"
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder={taggedPaper
              ? `Ask about “${taggedPaper.title.slice(0, 36)}${taggedPaper.title.length > 36 ? '…' : ''}”`
              : 'Ask a research question…'}
            style={{
              flex: 1,
              minWidth: 0,
              padding: '11px 14px',
              outline: 'none'
            }}
          />
          {loading ? (
            <button
              type="button"
              onClick={stopStreaming}
              className="btn-secondary"
              style={{ padding: '0 18px', flexShrink: 0 }}
              title="Stop generating"
            >
              <Square size={15} aria-hidden="true" />
              <span>Stop</span>
            </button>
          ) : (
            <button type="submit" className="btn-primary" disabled={!inputMessage.trim()} style={{ padding: '0 18px', flexShrink: 0 }}>
              <Send size={16} aria-hidden="true" />
              <span>Send</span>
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
