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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: 'calc(100vh - 120px)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.8rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sparkles style={{ color: 'var(--primary)' }} /> Gemini AI Research Chat Assistant
          </h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Chat with AI or tag a paper with 📎 to ask questions about it.</p>
        </div>

        <button
          onClick={() => { stopStreaming(); setMessages([messages[0]]); setTaggedPaper(null); }}
          className="btn-secondary"
          style={{ padding: '6px 12px', fontSize: '0.8rem' }}
          title="Clear Conversation"
        >
          <RefreshCw size={14} /> Clear Chat
        </button>
      </div>

      {/* Chat Messages Container */}
      <div className="glass-card" style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '8px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {messages.map(msg => {
            // An AI bubble exists from before the first token arrives. Rendering
            // it while empty would flash a blank box under the typing
            // indicator, so it stays hidden until it has something to show.
            if (msg.sender === 'ai' && !msg.text) return null;

            const isStreaming = msg.id === streamingId;

            return (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                gap: '12px',
                alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: msg.sender === 'user' ? '75%' : '85%'
              }}
            >
              {msg.sender === 'ai' && (
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Bot size={20} />
                </div>
              )}

              <div style={{
                padding: '14px 18px',
                borderRadius: '16px',
                backgroundColor: msg.sender === 'user' ? 'var(--primary)' : 'var(--bg-main)',
                color: msg.sender === 'user' ? '#ffffff' : 'var(--text-main)',
                border: msg.sender === 'user' ? 'none' : '1px solid var(--border-color)',
                lineHeight: 1.6,
                fontSize: '0.9rem',
                minWidth: 0,
                // Only the user's own text is plain, so only it needs newlines
                // preserved. AI output is rendered Markdown — pre-wrap there
                // would re-introduce the blank lines of the Markdown source and
                // double-space every paragraph.
                whiteSpace: msg.sender === 'user' ? 'pre-wrap' : 'normal'
              }}>
                {msg.sender === 'ai'
                  ? <MarkdownMessage compact>{msg.text}</MarkdownMessage>
                  : <div>{msg.text}</div>}
                <div style={{ fontSize: '0.7rem', opacity: 0.7, marginTop: '6px', textAlign: 'right', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {isStreaming
                    ? <span className="md-streaming">Generating…</span>
                    : <span>{msg.timestamp}</span>}

                  {/* Hidden mid-stream: copying or saving a half-written answer
                      is almost never what someone means to do. */}
                  {msg.sender === 'ai' && !isStreaming && (
                    <div style={{ display: 'flex', gap: '6px', marginLeft: '12px' }}>
                      <button
                        onClick={() => handleCopy(msg.id, msg.text)}
                        style={{ color: 'var(--primary)', padding: '2px' }}
                        title="Copy Response"
                      >
                        {copiedId === msg.id ? <Check size={14} /> : <Copy size={14} />}
                      </button>

                      <button
                        onClick={() => handleSaveToNotes(msg.id, msg.text)}
                        style={{ color: 'var(--primary)', padding: '2px' }}
                        title="Save to Research Notes"
                      >
                        {savedId === msg.id ? <Check size={14} /> : <BookmarkPlus size={14} />}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {msg.sender === 'user' && (
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--bg-main)', color: 'var(--primary)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <User size={20} />
                </div>
              )}
            </div>
            );
          })}

          {extractingPaperText && (
            <div style={{ display: 'flex', gap: '12px', alignSelf: 'flex-start' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileText size={20} />
              </div>
              <div style={{ padding: '12px 18px', borderRadius: '16px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 600 }}>
                Reading PDF content from your paper...
              </div>
            </div>
          )}

          {awaitingFirstToken && (
            <div style={{ display: 'flex', gap: '12px', alignSelf: 'flex-start' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Loader2 size={20} className="animate-spin" />
              </div>
              <div style={{ padding: '12px 18px', borderRadius: '16px', backgroundColor: 'var(--bg-main)', border: '1px solid var(--border-color)', fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 600 }}>
                Gemini AI is reasoning & composing answer...
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Tagged Paper Indicator */}
        {taggedPaper && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            borderRadius: '10px',
            backgroundColor: 'var(--primary-light)',
            border: '1px solid var(--primary)',
            marginTop: '10px',
            fontSize: '0.82rem'
          }}>
            <FileText size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, color: 'var(--primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                📎 {taggedPaper.title}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Questions will be answered based on this paper's content
              </div>
            </div>
            <button type="button" onClick={() => setTaggedPaper(null)} style={{ color: 'var(--primary)', padding: '2px', flexShrink: 0 }} title="Remove paper tag" aria-label={`Remove tagged paper "${taggedPaper?.title || ''}"`}>
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Quick Prompts */}
        {!taggedPaper && (
          <div style={{ display: 'flex', gap: '8px', padding: '10px 0', overflowX: 'auto', borderTop: '1px solid var(--border-color)', marginTop: '12px' }}>
            {quickPrompts.map((qp, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(qp)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '16px',
                  backgroundColor: 'var(--bg-main)',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer'
                }}
              >
                💡 {qp}
              </button>
            ))}
          </div>
        )}

        {/* Paper Picker Dropdown */}
        {showPaperPicker && (
          <div style={{
            marginTop: '8px',
            padding: '12px',
            borderRadius: '12px',
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            maxHeight: '240px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>📎 Tag a paper from your library</span>
              <button type="button" onClick={() => setShowPaperPicker(false)} aria-label="Close paper picker" style={{ color: 'var(--text-muted)', padding: '2px' }}>
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            <label htmlFor="aichat-paper-search" className="sr-only">Search your papers to tag one</label>
            <input
              id="aichat-paper-search"
              type="search"
              value={paperSearchQuery}
              onChange={(e) => setPaperSearchQuery(e.target.value)}
              placeholder="Search your papers..."
              autoFocus
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-main)',
                fontSize: '0.82rem'
              }}
            />
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {filteredPapers.length === 0 ? (
                <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  {resources.length === 0 ? 'No papers in your library yet.' : 'No papers match your search.'}
                </div>
              ) : (
                filteredPapers.slice(0, 15).map(paper => (
                  <button
                    key={paper.id}
                    onClick={() => handleSelectPaper(paper)}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      backgroundColor: taggedPaper?.id === paper.id ? 'var(--primary-light)' : 'var(--bg-main)',
                      border: taggedPaper?.id === paper.id ? '1px solid var(--primary)' : '1px solid transparent',
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                      transition: 'all 0.1s ease'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--primary-light)'; }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = taggedPaper?.id === paper.id ? 'var(--primary-light)' : 'var(--bg-main)';
                    }}
                  >
                    <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {paper.title}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {paper.authors} • {paper.publicationYear}
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
          style={{ display: 'flex', gap: '10px', paddingTop: '10px', alignItems: 'center' }}
        >
          {/* Paper Tag Button */}
          <button
            type="button"
            onClick={() => setShowPaperPicker(!showPaperPicker)}
            title={taggedPaper ? `Tagged: ${taggedPaper.title}` : "Tag a paper to ask about it"}
            aria-label={taggedPaper ? `Change tagged paper (currently "${taggedPaper.title}")` : 'Tag a paper to ask about it'}
            aria-expanded={showPaperPicker}
            style={{
              padding: '10px',
              borderRadius: '10px',
              border: '1px solid var(--border-color)',
              backgroundColor: taggedPaper ? 'var(--primary-light)' : 'var(--bg-main)',
              color: taggedPaper ? 'var(--primary)' : 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'all 0.15s ease'
            }}
          >
            <FileText size={18} aria-hidden="true" />
          </button>

          <label htmlFor="aichat-message" className="sr-only">
            Your message to the AI research assistant
          </label>
          <input
            id="aichat-message"
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder={taggedPaper
              ? `Ask about "${taggedPaper.title.slice(0, 40)}${taggedPaper.title.length > 40 ? '...' : ''}"...`
              : "Ask Gemini AI any research question or tag a 📎 paper..."}
            style={{
              flex: 1,
              padding: '12px 16px',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-main)',
              fontSize: '0.9rem',
              outline: 'none'
            }}
          />
          {loading ? (
            <button
              type="button"
              onClick={stopStreaming}
              className="btn-secondary"
              style={{ padding: '0 20px' }}
              title="Stop generating"
            >
              <Square size={16} />
              <span>Stop</span>
            </button>
          ) : (
            <button type="submit" className="btn-primary" disabled={!inputMessage.trim()} style={{ padding: '0 20px' }}>
              <Send size={18} />
              <span>Send</span>
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
