import React, { useState, useEffect } from 'react';
import { Layers, Sparkles, Download, Plus, Check, RotateCw, Trash2, ArrowRight, ArrowLeft, Brain, BookOpen, CheckCircle, RefreshCw, X } from 'lucide-react';
import { storage } from '../services/storage';
import { generateFlashcards } from '../services/geminiService';
import { useToast } from '../components/FeedbackProvider';
import Modal from '../components/Modal';

export default function FlashcardsManager({ resources = [] }) {
  const [flashcards, setFlashcards] = useState(() => storage.getFlashcards());
  const [activeDeck, setActiveDeck] = useState('All');
  const [selectedPaperId, setSelectedPaperId] = useState('');
  const [generating, setGenerating] = useState(false);
  const [isStudyMode, setIsStudyMode] = useState(false);
  const [studyIndex, setStudyIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newQuestion, setNewQuestion] = useState('');
  const [newAnswer, setNewAnswer] = useState('');
  const [newDeck, setNewDeck] = useState('General');
  const toast = useToast();

  useEffect(() => {
    setFlashcards(storage.getFlashcards());
  }, []);

  const decks = ['All', ...Array.from(new Set(flashcards.map(c => c.deck || 'General')))];

  const filteredCards = flashcards.filter(c => {
    if (activeDeck !== 'All' && c.deck !== activeDeck) return false;
    return true;
  });

  const handleGenerateFromPaper = async () => {
    if (!selectedPaperId) {
      toast({ message: "Select a paper from the dropdown first", tone: 'error' });
      return;
    }
    const paper = resources.find(r => String(r.id) === String(selectedPaperId));
    if (!paper) return;

    setGenerating(true);
    try {
      const content = `${paper.title}\n${paper.abstractText || paper.fullText || ''}`;
      const generated = await generateFlashcards(content);
      const formatted = generated.map(g => ({
        ...g,
        paperTitle: paper.title,
        resourceId: paper.id,
        deck: paper.category || 'Literature Review'
      }));
      const updated = storage.addFlashcards(formatted);
      setFlashcards(updated);
      toast({ message: `Generated ${formatted.length} flashcards from "${paper.title.slice(0, 30)}..."!`, tone: 'success' });
    } catch (err) {
      console.warn("Flashcard generation error:", err);
      toast({ message: "Failed to generate flashcards. Try again.", tone: 'error' });
    } finally {
      setGenerating(false);
    }
  };

  const handleCreateCustomCard = () => {
    if (!newQuestion.trim() || !newAnswer.trim()) {
      toast({ message: "Please enter both question and answer", tone: 'error' });
      return;
    }
    const updated = storage.addFlashcards([{
      question: newQuestion.trim(),
      answer: newAnswer.trim(),
      deck: newDeck.trim() || 'General',
      paperTitle: 'Custom Study Card'
    }]);
    setFlashcards(updated);
    setNewQuestion('');
    setNewAnswer('');
    setShowAddModal(false);
    toast({ message: "Added flashcard!", tone: 'success' });
  };

  const handleRateCard = (rating) => {
    const card = filteredCards[studyIndex];
    if (!card) return;

    const updated = storage.updateFlashcardReview(card.id, rating);
    setFlashcards(updated);
    setIsFlipped(false);

    if (studyIndex < filteredCards.length - 1) {
      setStudyIndex(idx => idx + 1);
    } else {
      setIsStudyMode(false);
      setStudyIndex(0);
      toast({ message: "Great work! You finished this study session.", tone: 'success' });
    }
  };

  const handleDeleteCard = (id) => {
    const updated = storage.deleteFlashcard(id);
    setFlashcards(updated);
    toast({ message: "Card deleted", tone: 'default' });
  };

  // Export to Anki TSV format (Tab-separated values: Front \t Back \t Tags)
  const handleExportAnki = () => {
    if (filteredCards.length === 0) {
      toast({ message: "No cards in this deck to export", tone: 'error' });
      return;
    }
    const tsvRows = filteredCards.map(c => {
      const q = c.question.replace(/\t/g, ' ').replace(/\n/g, '<br>');
      const a = c.answer.replace(/\t/g, ' ').replace(/\n/g, '<br>');
      const tag = (c.deck || 'researchvault').replace(/\s+/g, '_');
      return `${q}\t${a}\t${tag}`;
    });

    const fileContent = `#separator:tab\n#html:true\n#tags column:3\n${tsvRows.join('\n')}`;
    const blob = new Blob([fileContent], { type: 'text/tab-separated-values;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ResearchVault_${activeDeck.replace(/\s+/g, '_')}_Deck.txt`;
    a.click();
    toast({ message: "Exported Anki deck file (.txt / TSV)!", tone: 'success' });
  };

  const currentStudyCard = filteredCards[studyIndex];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ padding: '6px', borderRadius: '8px', backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}>
              <Brain size={20} />
            </div>
            <h1 style={{ fontSize: '1.7rem', fontWeight: 800, margin: 0 }}>
              Spaced Repetition &amp; Flashcards
            </h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
            Master paper findings, formulas, and literature arguments with Anki export &amp; Leitner spaced review.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {filteredCards.length > 0 && !isStudyMode && (
            <button
              onClick={() => { setIsStudyMode(true); setStudyIndex(0); setIsFlipped(false); }}
              className="btn-primary"
              style={{ padding: '8px 16px', fontSize: '0.82rem' }}
            >
              <RotateCw size={14} />
              <span>Start Study Session ({filteredCards.length})</span>
            </button>
          )}

          <button
            onClick={() => setShowAddModal(true)}
            className="btn-secondary"
            style={{ padding: '8px 14px', fontSize: '0.82rem' }}
          >
            <Plus size={14} />
            <span>Create Card</span>
          </button>

          <button
            onClick={handleExportAnki}
            className="btn-secondary"
            style={{ padding: '8px 14px', fontSize: '0.82rem', borderColor: 'var(--primary)', color: 'var(--primary)' }}
            title="Download Anki-compatible TSV deck file"
          >
            <Download size={14} />
            <span>Export to Anki (.txt)</span>
          </button>
        </div>
      </div>

      {/* AI Card Generator Tool */}
      <div className="glass-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '260px' }}>
          <Sparkles size={18} color="var(--primary)" />
          <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Auto-Generate Cards from Paper:</span>
          <select
            value={selectedPaperId}
            onChange={(e) => setSelectedPaperId(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-main)',
              fontSize: '0.82rem',
              fontWeight: 600,
              flex: 1,
              maxWidth: '380px'
            }}
          >
            <option value="">Choose a paper from library...</option>
            {resources.map(r => (
              <option key={r.id} value={r.id}>{r.title.slice(0, 55)}...</option>
            ))}
          </select>
        </div>

        <button
          onClick={handleGenerateFromPaper}
          disabled={!selectedPaperId || generating}
          className="btn-primary"
          style={{ padding: '6px 16px', fontSize: '0.82rem' }}
        >
          {generating ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
          <span>{generating ? 'Extracting Q&A...' : 'Generate with Gemini AI'}</span>
        </button>
      </div>

      {/* Interactive Study Mode Card */}
      {isStudyMode && currentStudyCard ? (
        <div className="glass-card" style={{ padding: '30px', textAlign: 'center', maxWidth: '640px', margin: '0 auto', width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <span className="badge" style={{ fontSize: '0.75rem' }}>{currentStudyCard.deck || 'General'}</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Card {studyIndex + 1} of {filteredCards.length}</span>
            <button
              onClick={() => setIsStudyMode(false)}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <X size={18} />
            </button>
          </div>

          {/* 3D Flip Flashcard Box */}
          <div
            onClick={() => setIsFlipped(f => !f)}
            style={{
              minHeight: '220px',
              padding: '30px 24px',
              borderRadius: '16px',
              backgroundColor: isFlipped ? 'var(--primary-light)' : 'var(--bg-main)',
              border: `2px solid ${isFlipped ? 'var(--primary)' : 'var(--border-color)'}`,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              cursor: 'pointer',
              marginBottom: '24px',
              transition: 'all 0.25s ease',
              boxShadow: 'var(--card-shadow)'
            }}
          >
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', marginBottom: '8px' }}>
              {isFlipped ? 'Answer (Click to Flip)' : 'Question (Click to Flip)'}
            </div>
            <div style={{
              fontSize: '1.15rem',
              fontWeight: 700,
              fontFamily: 'var(--font-serif)',
              lineHeight: 1.4,
              color: 'var(--text-main)'
            }}>
              {isFlipped ? currentStudyCard.answer : currentStudyCard.question}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '12px' }}>
              Source: {currentStudyCard.paperTitle || 'Literature'}
            </div>
          </div>

          {/* Rating Buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
            <button
              onClick={() => handleRateCard('again')}
              className="btn-secondary"
              style={{ padding: '8px 4px', fontSize: '0.78rem', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
            >
              Again (&lt;1d)
            </button>
            <button
              onClick={() => handleRateCard('hard')}
              className="btn-secondary"
              style={{ padding: '8px 4px', fontSize: '0.78rem', color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.3)' }}
            >
              Hard (1d)
            </button>
            <button
              onClick={() => handleRateCard('good')}
              className="btn-secondary"
              style={{ padding: '8px 4px', fontSize: '0.78rem', color: '#3b82f6', borderColor: 'rgba(59, 130, 246, 0.3)' }}
            >
              Good (3d)
            </button>
            <button
              onClick={() => handleRateCard('easy')}
              className="btn-primary"
              style={{ padding: '8px 4px', fontSize: '0.78rem', backgroundColor: '#10b981', borderColor: '#10b981' }}
            >
              Easy (7d)
            </button>
          </div>
        </div>
      ) : (
        /* Card Deck View */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Deck Tabs */}
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
            {decks.map(deck => (
              <button
                key={deck}
                onClick={() => setActiveDeck(deck)}
                className={`btn-secondary ${activeDeck === deck ? 'active' : ''}`}
                style={{
                  padding: '6px 14px',
                  fontSize: '0.8rem',
                  backgroundColor: activeDeck === deck ? 'var(--primary)' : 'transparent',
                  color: activeDeck === deck ? '#fff' : 'var(--text-muted)',
                  borderColor: activeDeck === deck ? 'var(--primary)' : 'var(--border-color)',
                  whiteSpace: 'nowrap'
                }}
              >
                {deck} ({deck === 'All' ? flashcards.length : flashcards.filter(c => c.deck === deck).length})
              </button>
            ))}
          </div>

          {/* Grid of Cards */}
          {filteredCards.length === 0 ? (
            <div className="glass-card" style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Layers size={32} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
              <div style={{ fontWeight: 700 }}>No flashcards in this deck</div>
              <div style={{ fontSize: '0.82rem', marginTop: '4px' }}>
                Auto-generate cards using Gemini AI above or create custom study cards.
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' }}>
              {filteredCards.map(card => (
                <div
                  key={card.id}
                  className="glass-card"
                  style={{
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '160px'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span className="badge" style={{ fontSize: '0.68rem' }}>{card.deck || 'General'}</span>
                      <button
                        onClick={() => handleDeleteCard(card.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
                        title="Delete card"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    <div style={{ fontSize: '0.88rem', fontWeight: 700, fontFamily: 'var(--font-serif)', color: 'var(--text-main)', marginBottom: '8px', lineHeight: 1.35 }}>
                      Q: {card.question}
                    </div>

                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                      A: {card.answer}
                    </div>
                  </div>

                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '10px', paddingTop: '6px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Box {card.box || 1} • {card.intervalDays || 1}d interval</span>
                    <span>{card.paperTitle ? card.paperTitle.slice(0, 24) + '...' : ''}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Card Modal */}
      {showAddModal && (
        <Modal onClose={() => setShowAddModal(false)} labelledBy="create-card-title" panelStyle={{ maxWidth: '480px', width: '100%', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 id="create-card-title" style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>Create Study Flashcard</h2>
            <button onClick={() => setShowAddModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <X size={18} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Deck / Subject:</label>
              <input
                type="text"
                value={newDeck}
                onChange={(e) => setNewDeck(e.target.value)}
                placeholder="e.g. Deep Learning, Thesis Defense"
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Front (Question / Concept):</label>
              <textarea
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                rows={2}
                placeholder="What is the vanishing gradient problem and how does ReLU mitigate it?"
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', fontFamily: 'inherit' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: '4px' }}>Back (Answer / Explanation):</label>
              <textarea
                value={newAnswer}
                onChange={(e) => setNewAnswer(e.target.value)}
                rows={3}
                placeholder="In deep networks with sigmoid/tanh, gradients multiply and decay exponentially. ReLU has constant derivative 1 for positive inputs."
                style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', fontFamily: 'inherit' }}
              />
            </div>

            <button
              onClick={handleCreateCustomCard}
              className="btn-primary"
              style={{ marginTop: '8px', justifyContent: 'center' }}
            >
              Save Flashcard
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
