import React, { useState, useEffect } from 'react';
import { Table, Sparkles, Download, Copy, Check, CheckSquare, Square, RefreshCw, FileText, Code2, Edit3, Save, Layers, BookOpen, AlertCircle } from 'lucide-react';
import { generateComparativeLiteratureMatrix } from '../services/geminiService';
import { generateLatexMatrixTable, getCitationKey } from '../services/citationGenerator';
import { storage } from '../services/storage';
import { useToast } from '../components/FeedbackProvider';

export default function LiteratureMatrix({ resources = [] }) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [matrixData, setMatrixData] = useState([]);
  const [activeView, setActiveView] = useState('table'); // 'table' or 'latex'
  const [caption, setCaption] = useState('Comparative Literature Matrix of Selected Studies');
  const [copiedLatex, setCopiedLatex] = useState(false);
  const [copiedCsv, setCopiedCsv] = useState(false);
  const toast = useToast();

  const columns = [
    { key: 'paper', label: 'Paper & Year' },
    { key: 'objective', label: 'Core Objective / Problem' },
    { key: 'methodology', label: 'Methodology & Design' },
    { key: 'dataset', label: 'Dataset & Sample Size' },
    { key: 'findings', label: 'Key Findings & Metrics' },
    { key: 'limitations', label: 'Stated Limitations' }
  ];

  // Auto-select first 3 papers on initial load if none selected
  useEffect(() => {
    if (resources.length > 0 && selectedIds.length === 0) {
      setSelectedIds(resources.slice(0, Math.min(3, resources.length)).map(r => r.id));
    }
  }, [resources]);

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const selectAll = () => {
    if (selectedIds.length === resources.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(resources.slice(0, 8).map(r => r.id));
    }
  };

  const handleGenerateMatrix = async () => {
    if (selectedIds.length === 0) {
      toast({ message: "Select at least 1 paper to generate matrix", tone: 'error' });
      return;
    }
    const selectedPapers = resources.filter(r => selectedIds.includes(r.id));
    setLoading(true);

    try {
      const generated = await generateComparativeLiteratureMatrix(selectedPapers);
      setMatrixData(generated);
      storage.saveMatrix({
        title: caption,
        paperIds: selectedIds,
        rows: generated
      });
      toast({ message: `Successfully synthesized matrix for ${selectedPapers.length} papers!`, tone: 'success' });
    } catch (err) {
      console.warn("Matrix generation error:", err);
      toast({ message: "Error generating matrix. Using extracted paper metadata.", tone: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleCellEdit = (rowIndex, colKey, val) => {
    const updated = [...matrixData];
    updated[rowIndex] = { ...updated[rowIndex], [colKey]: val };
    setMatrixData(updated);
  };

  const latexCode = generateLatexMatrixTable({
    columns,
    rows: matrixData,
    caption,
    label: 'tab:comparative_lit_matrix'
  });

  const handleCopyLatex = () => {
    navigator.clipboard.writeText(latexCode);
    setCopiedLatex(true);
    toast({ message: "LaTeX table code copied to clipboard!", tone: 'success' });
    setTimeout(() => setCopiedLatex(false), 2000);
  };

  const handleDownloadLatex = () => {
    const blob = new Blob([latexCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Literature_Matrix_${Date.now()}.tex`;
    a.click();
    toast({ message: "Downloaded .tex file for Overleaf / LaTeX!", tone: 'success' });
  };

  const handleExportCsv = () => {
    if (matrixData.length === 0) return;
    const header = columns.map(c => `"${c.label}"`).join(',');
    const rows = matrixData.map(r => columns.map(c => `"${String(r[c.key] || '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const csvContent = `${header}\n${rows}`;
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Literature_Matrix_${Date.now()}.csv`;
    a.click();
    toast({ message: "Exported CSV file!", tone: 'success' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ padding: '6px', borderRadius: '8px', backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}>
              <Table size={20} />
            </div>
            <h1 style={{ fontSize: '1.7rem', fontWeight: 800, margin: 0 }}>
              Comparative Literature Matrix
            </h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '4px' }}>
            Synthesize papers side-by-side across dimensions with 1-click LaTeX table generation &amp; Overleaf export.
          </p>
        </div>

        {matrixData.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={handleCopyLatex}
              className="btn-primary"
              style={{ padding: '8px 14px', fontSize: '0.82rem' }}
              title="Copy formatted LaTeX table environment"
            >
              {copiedLatex ? <Check size={14} /> : <Copy size={14} />}
              <span>{copiedLatex ? 'Copied LaTeX' : 'Copy LaTeX Table'}</span>
            </button>

            <button
              onClick={handleDownloadLatex}
              className="btn-secondary"
              style={{ padding: '8px 14px', fontSize: '0.82rem', borderColor: 'var(--primary)', color: 'var(--primary)' }}
              title="Download LaTeX .tex table file"
            >
              <Download size={14} />
              <span>Download .tex</span>
            </button>

            <button
              onClick={handleExportCsv}
              className="btn-secondary"
              style={{ padding: '8px 14px', fontSize: '0.82rem' }}
              title="Export table as CSV"
            >
              <Download size={14} />
              <span>CSV</span>
            </button>
          </div>
        )}
      </div>

      {/* Paper Selection Card */}
      <div className="glass-card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Select Papers to Compare:</span>
            <span className="badge" style={{ fontSize: '0.75rem' }}>{selectedIds.length} of {resources.length} selected</span>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={selectAll}
              className="btn-secondary"
              style={{ padding: '4px 10px', fontSize: '0.78rem' }}
            >
              {selectedIds.length === resources.length ? 'Deselect All' : 'Select All'}
            </button>
            <button
              onClick={handleGenerateMatrix}
              disabled={selectedIds.length === 0 || loading}
              className="btn-primary"
              style={{ padding: '6px 16px', fontSize: '0.82rem' }}
            >
              {loading ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
              <span>{loading ? 'Synthesizing...' : 'Generate AI Matrix'}</span>
            </button>
          </div>
        </div>

        {resources.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Your library is empty. Add papers from Academic Search or Batch Import to compare them.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '8px', maxHeight: '160px', overflowY: 'auto' }}>
            {resources.map(r => {
              const isSelected = selectedIds.includes(r.id);
              return (
                <div
                  key={r.id}
                  onClick={() => toggleSelect(r.id)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--border-color)'}`,
                    backgroundColor: isSelected ? 'var(--primary-light)' : 'var(--bg-main)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {isSelected ? <CheckSquare size={16} color="var(--primary)" /> : <Square size={16} color="var(--text-muted)" />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.title}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      {(r.authors || 'Author').split(',')[0]} ({r.publicationYear})
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Main View Area: Table vs LaTeX Source */}
      {matrixData.length > 0 && (
        <div className="glass-card" style={{ padding: '20px' }}>
          {/* View Mode Toggle */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setActiveView('table')}
                className={`btn-secondary ${activeView === 'table' ? 'active' : ''}`}
                style={{
                  padding: '6px 14px',
                  fontSize: '0.82rem',
                  backgroundColor: activeView === 'table' ? 'var(--primary)' : 'transparent',
                  color: activeView === 'table' ? '#fff' : 'var(--text-muted)'
                }}
              >
                <Table size={14} />
                <span>Interactive Table</span>
              </button>

              <button
                onClick={() => setActiveView('latex')}
                className={`btn-secondary ${activeView === 'latex' ? 'active' : ''}`}
                style={{
                  padding: '6px 14px',
                  fontSize: '0.82rem',
                  backgroundColor: activeView === 'latex' ? 'var(--primary)' : 'transparent',
                  color: activeView === 'latex' ? '#fff' : 'var(--text-muted)'
                }}
              >
                <Code2 size={14} />
                <span>LaTeX Code (\begin&#123;table*&#125;)</span>
              </button>
            </div>

            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Tip: Click any table cell below to edit or refine manually
            </div>
          </div>

          {/* Interactive Table View */}
          {activeView === 'table' && (
            <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-main)', borderBottom: '2px solid var(--border-color)' }}>
                    {columns.map(col => (
                      <th
                        key={col.key}
                        style={{
                          padding: '12px 14px',
                          textAlign: 'left',
                          fontWeight: 700,
                          color: 'var(--text-main)',
                          minWidth: col.key === 'paper' ? '180px' : '220px'
                        }}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrixData.map((row, rIdx) => (
                    <tr
                      key={rIdx}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        backgroundColor: rIdx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-main)'
                      }}
                    >
                      {columns.map(col => (
                        <td
                          key={col.key}
                          style={{
                            padding: '12px 14px',
                            verticalAlign: 'top',
                            lineHeight: 1.45,
                            color: 'var(--text-main)'
                          }}
                        >
                          <textarea
                            value={row[col.key] || ''}
                            onChange={(e) => handleCellEdit(rIdx, col.key, e.target.value)}
                            rows={3}
                            style={{
                              width: '100%',
                              background: 'transparent',
                              border: 'none',
                              resize: 'vertical',
                              fontFamily: 'inherit',
                              fontSize: 'inherit',
                              color: 'inherit',
                              padding: '2px',
                              outline: 'none',
                              borderRadius: '4px',
                              lineHeight: 1.4
                            }}
                            onFocus={(e) => { e.target.style.backgroundColor = 'var(--bg-card-hover)'; }}
                            onBlur={(e) => { e.target.style.backgroundColor = 'transparent'; }}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* LaTeX Source View */}
          {activeView === 'latex' && (
            <div style={{ position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  TeX / Overleaf Compatible Output:
                </span>
                <button
                  onClick={handleCopyLatex}
                  className="btn-secondary"
                  style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                >
                  {copiedLatex ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copiedLatex ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <pre style={{
                margin: 0,
                padding: '16px',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-main)',
                border: '1px solid var(--border-color)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.8rem',
                color: 'var(--text-main)',
                overflowX: 'auto',
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap'
              }}>
                {latexCode}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
