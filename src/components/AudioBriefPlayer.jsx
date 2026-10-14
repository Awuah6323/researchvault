import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX, Sparkles, X, Download, FileText, Loader2, FastForward } from 'lucide-react';
import { generateAudioScript } from '../services/geminiService';
import Modal from './Modal';

export default function AudioBriefPlayer({ item, isOpen, onClose }) {
  const [loading, setLoading] = useState(false);
  const [script, setScript] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [speechRate, setSpeechRate] = useState(1);
  const [voiceMode, setVoiceMode] = useState('dialogue'); // 'dialogue' or 'solo'
  const [voices, setVoices] = useState([]);
  
  const utteranceRef = useRef(null);
  const scriptLinesRef = useRef([]);
  const isPlayingRef = useRef(false);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);

  // Load available speech voices
  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    const loadVoices = () => {
      const v = window.speechSynthesis.getVoices() || [];
      setVoices(v);
    };

    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  // Generate audio script on mount if item is provided
  useEffect(() => {
    if (!isOpen || !item) return;

    let active = true;
    (async () => {
      setLoading(true);
      try {
        const generated = await generateAudioScript(item);
        if (active) {
          setScript(generated);
          const lines = parseScriptLines(generated);
          scriptLinesRef.current = lines;
          setCurrentLineIndex(0);
        }
      } catch (err) {
        console.warn("Error generating audio script:", err);
        if (active) {
          const fallback = `Alex: Welcome to today's Research Brief. Let's explore the core insights from ${item.title || 'this research'}.\nDr. Taylor: This paper presents key methodologies and findings that address important questions in the field.`;
          setScript(fallback);
          scriptLinesRef.current = parseScriptLines(fallback);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
      stopAudio();
    };
  }, [isOpen, item]);

  const parseScriptLines = (text) => {
    if (!text) return [];
    return text.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        const match = line.match(/^(Alex|Dr\.\s*Taylor|Host|Scholar|Speaker\s*\d+):\s*(.*)$/i);
        if (match) {
          return { speaker: match[1], text: match[2] };
        }
        return { speaker: 'Narrator', text: line };
      });
  };

  const stopAudio = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsPlaying(false);
  };

  const playLine = (index) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    const lines = scriptLinesRef.current;
    if (index >= lines.length) {
      setIsPlaying(false);
      setCurrentLineIndex(0);
      return;
    }

    window.speechSynthesis.cancel();
    const line = lines[index];
    setCurrentLineIndex(index);

    const utterance = new SpeechSynthesisUtterance(line.text);
    utteranceRef.current = utterance;
    utterance.rate = speechRate;

    // Pick voices: Host gets standard voice, Scholar gets deeper / alternative voice
    const englishVoices = voices.filter(v => v.lang.startsWith('en'));
    if (englishVoices.length > 0) {
      if (line.speaker.toLowerCase().includes('taylor') || line.speaker.toLowerCase().includes('scholar')) {
        utterance.voice = englishVoices[1] || englishVoices[0];
        utterance.pitch = 0.95;
      } else {
        utterance.voice = englishVoices[0];
        utterance.pitch = 1.05;
      }
    }

    utterance.onend = () => {
      if (isPlayingRef.current) {
        playLine(index + 1);
      }
    };

    utterance.onerror = (e) => {
      console.warn("Speech error:", e);
      if (isPlayingRef.current) {
        playLine(index + 1);
      }
    };

    window.speechSynthesis.speak(utterance);
    setIsPlaying(true);
  };

  const togglePlay = () => {
    if (isPlaying) {
      stopAudio();
    } else {
      setIsPlaying(true);
      playLine(currentLineIndex);
    }
  };

  const skipForward = () => {
    const nextIdx = Math.min(scriptLinesRef.current.length - 1, currentLineIndex + 1);
    playLine(nextIdx);
  };

  const skipBackward = () => {
    const prevIdx = Math.max(0, currentLineIndex - 1);
    playLine(prevIdx);
  };

  const downloadScript = () => {
    const title = (item && item.title) ? item.title.slice(0, 30) : 'Research_Audio_Brief';
    const blob = new Blob([script], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}_Audio_Script.md`;
    a.click();
  };

  if (!isOpen) return null;

  const currentLine = scriptLinesRef.current[currentLineIndex];
  const progressPercent = scriptLinesRef.current.length > 0
    ? Math.round(((currentLineIndex + 1) / scriptLinesRef.current.length) * 100)
    : 0;

  return (
    <Modal onClose={() => { stopAudio(); onClose(); }} labelledBy="audio-player-title" panelStyle={{ maxWidth: '640px', width: '100%', padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ padding: '6px', borderRadius: '8px', backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}>
            <Volume2 size={20} />
          </div>
          <div>
            <h2 id="audio-player-title" style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>
              NotebookLM Audio Overview
            </h2>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              AI Dual-Voice Research Podcast &amp; Audio Synthesizer
            </div>
          </div>
        </div>
        <button
          onClick={() => { stopAudio(); onClose(); }}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          aria-label="Close audio player"
        >
          <X size={20} />
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 12px', color: 'var(--primary)' }} />
          <div style={{ fontWeight: 600 }}>Synthesizing audio dialogue script...</div>
          <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>Structuring host and scholar discussion with Gemini AI</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Animated Waveform & Active Speaker Card */}
          <div style={{
            padding: '20px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, rgba(194, 94, 0, 0.08), rgba(184, 134, 11, 0.04))',
            border: '1px solid var(--border-color)',
            textAlign: 'center'
          }}>
            {/* Audio Wave Visualizer Bars */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', height: '36px', marginBottom: '14px' }}>
              {[12, 24, 32, 18, 28, 36, 20, 30, 16, 26, 34, 14].map((h, i) => (
                <div
                  key={i}
                  style={{
                    width: '4px',
                    height: isPlaying ? `${Math.max(6, (h * ((i % 3) + 1)) % 34)}px` : '6px',
                    borderRadius: '2px',
                    backgroundColor: isPlaying ? 'var(--primary)' : 'var(--border-color)',
                    transition: 'height 0.2s ease'
                  }}
                />
              ))}
            </div>

            {/* Currently spoken sentence */}
            <div style={{ minHeight: '64px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              {currentLine ? (
                <div>
                  <span className="badge" style={{
                    marginBottom: '8px',
                    display: 'inline-block',
                    backgroundColor: currentLine.speaker.toLowerCase().includes('alex') ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                    color: currentLine.speaker.toLowerCase().includes('alex') ? '#2563eb' : '#059669',
                    fontWeight: 700
                  }}>
                    {currentLine.speaker}
                  </span>
                  <p style={{
                    fontSize: '0.95rem',
                    fontFamily: 'var(--font-serif)',
                    lineHeight: 1.45,
                    color: 'var(--text-main)',
                    margin: 0
                  }}>
                    "{currentLine.text}"
                  </p>
                </div>
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Ready to play audio briefing</div>
              )}
            </div>

            {/* Progress Bar */}
            <div style={{ marginTop: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                <span>Line {currentLineIndex + 1} of {scriptLinesRef.current.length}</span>
                <span>{progressPercent}%</span>
              </div>
              <div style={{ height: '4px', borderRadius: '2px', backgroundColor: 'var(--border-color)', overflow: 'hidden' }}>
                <div style={{ width: `${progressPercent}%`, height: '100%', backgroundColor: 'var(--primary)', transition: 'width 0.3s ease' }} />
              </div>
            </div>
          </div>

          {/* Player Controls */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
            <button
              onClick={skipBackward}
              disabled={currentLineIndex === 0}
              className="btn-secondary"
              style={{ padding: '8px', borderRadius: '50%' }}
              title="Previous sentence"
            >
              <RotateCcw size={16} />
            </button>

            <button
              onClick={togglePlay}
              className="btn-primary"
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0
              }}
              title={isPlaying ? "Pause audio" : "Play audio brief"}
            >
              {isPlaying ? <Pause size={24} /> : <Play size={24} style={{ marginLeft: '3px' }} />}
            </button>

            <button
              onClick={skipForward}
              disabled={currentLineIndex >= scriptLinesRef.current.length - 1}
              className="btn-secondary"
              style={{ padding: '8px', borderRadius: '50%' }}
              title="Next sentence"
            >
              <RotateCw size={16} />
            </button>
          </div>

          {/* Settings & Script Download */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Speed:</span>
              {[0.75, 1, 1.25, 1.5].map(rate => (
                <button
                  key={rate}
                  onClick={() => setSpeechRate(rate)}
                  style={{
                    padding: '3px 7px',
                    borderRadius: '6px',
                    fontSize: '0.72rem',
                    fontWeight: speechRate === rate ? 700 : 500,
                    backgroundColor: speechRate === rate ? 'var(--primary)' : 'var(--bg-main)',
                    color: speechRate === rate ? '#fff' : 'var(--text-muted)',
                    border: '1px solid var(--border-color)',
                    cursor: 'pointer'
                  }}
                >
                  {rate}x
                </button>
              ))}
            </div>

            <button
              onClick={downloadScript}
              className="btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.78rem' }}
              title="Download full audio script as Markdown"
            >
              <Download size={14} />
              <span>Download Script</span>
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
