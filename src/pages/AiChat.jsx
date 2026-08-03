import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, Loader2, Copy, Check, BookmarkPlus, RefreshCw, Bot, User } from 'lucide-react';
import { chatWithGemini } from '../services/geminiService';
import { storage } from '../services/storage';

export default function AiChat({ onSaveNote }) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'ai',
      text: "Hello! I am your ResearchVault AI Assistant powered by Gemini 2.0 Flash. How can I assist with your literature review, paper methodology, or research questions today?",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [savedId, setSavedId] = useState(null);
  const chatEndRef = useRef(null);

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

  const handleSendMessage = async (textToSend) => {
    const text = textToSend || inputMessage.trim();
    if (!text || loading) return;

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInputMessage('');
    setLoading(true);

    try {
      const responseText = await chatWithGemini(text, messages);
      const aiMsg = {
        id: Date.now() + 1,
        sender: 'ai',
        text: responseText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      const errorMsg = {
        id: Date.now() + 1,
        sender: 'ai',
        text: err.message || "Gemini API error. Please ensure VITE_GEMINI_API_KEY is configured in your Vercel project environment variables.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: 'calc(100vh - 120px)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.8rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sparkles style={{ color: 'var(--primary)' }} /> Gemini AI Research Chat Assistant
          </h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Conversational AI assistant for scholarly writing, methodology design, and concepts.</p>
        </div>

        <button 
          onClick={() => setMessages([messages[0]])} 
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
          {messages.map(msg => (
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
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', shrink: 0 }}>
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
                whiteSpace: 'pre-wrap'
              }}>
                <div>{msg.text}</div>
                <div style={{ fontSize: '0.7rem', opacity: 0.7, marginTop: '6px', textAlign: 'right', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{msg.timestamp}</span>

                  {msg.sender === 'ai' && (
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
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--bg-main)', color: 'var(--primary)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', shrink: 0 }}>
                  <User size={20} />
                </div>
              )}
            </div>
          ))}

          {loading && (
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

        {/* Quick Prompts */}
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

        {/* Chat Input Form */}
        <form 
          onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
          style={{ display: 'flex', gap: '10px', paddingTop: '10px' }}
        >
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Ask Gemini AI any research, thesis, literature, or concepts question..."
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
          <button type="submit" className="btn-primary" disabled={loading || !inputMessage.trim()} style={{ padding: '0 20px' }}>
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            <span>Send</span>
          </button>
        </form>
      </div>
    </div>
  );
}
