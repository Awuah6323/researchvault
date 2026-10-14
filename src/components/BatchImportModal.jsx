import React, { useState } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, X, Plus, Layers, BookOpen, Database } from 'lucide-react';
import { parseBibtex, parseRis } from '../services/citationGenerator';
import { extractTextFromPdfFile } from '../utils/pdfExtractor';
import { validatePdfFile } from '../utils/fileValidation';
import { storePdfData } from '../services/pdfStorage';
import Modal from './Modal';
import { useToast } from './FeedbackProvider';

export default function BatchImportModal({ isOpen, onClose, onImportCompleted }) {
  const [activeTab, setActiveTab] = useState('bibtex');
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [parsedPreview, setParsedPreview] = useState([]);
  const [doiListText, setDoiListText] = useState('');
  const [pdfUploadStatus, setPdfUploadStatus] = useState([]);
  const toast = useToast();

  if (!isOpen) return null;

  const handleBibtexParse = () => {
    if (!inputText.trim()) return;
    const parsed = parseBibtex(inputText);
    if (parsed.length === 0) {
      toast({ message: "No valid BibTeX entries found. Check formatting (@article{...})", tone: 'error' });
      return;
    }
    setParsedPreview(parsed);
  };

  const handleRisParse = () => {
    if (!inputText.trim()) return;
    const parsed = parseRis(inputText);
    if (parsed.length === 0) {
      toast({ message: "No valid RIS entries found. Check formatting (TY - ... ER -)", tone: 'error' });
      return;
    }
    setParsedPreview(parsed);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      setInputText(content);
      if (activeTab === 'bibtex') {
        setParsedPreview(parseBibtex(content));
      } else if (activeTab === 'ris') {
        setParsedPreview(parseRis(content));
      }
    };
    reader.readAsText(file);
  };

  const handlePdfBatchUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setLoading(true);
    const newItems = [];
    const statusLogs = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      statusLogs.push(`Validating ${file.name}...`);
      setPdfUploadStatus([...statusLogs]);

      const check = await validatePdfFile(file);
      if (!check.ok) {
        statusLogs.push(`Skipped ${file.name}: ${check.error}`);
        setPdfUploadStatus([...statusLogs]);
        continue;
      }

      statusLogs.push(`Extracting text from ${check.name}...`);
      setPdfUploadStatus([...statusLogs]);

      try {
        const extractedText = await extractTextFromPdfFile(file);
        const lines = extractedText.split('\n').filter(l => l.trim().length > 3);
        const inferredTitle = lines[0] ? lines[0].slice(0, 150) : check.name.replace(/\.pdf$/i, '');
        const inferredAuthors = lines[1] ? lines[1].slice(0, 100) : 'Extracted Authors';

        const id = Date.now() + i;
        const arrayBuf = await file.arrayBuffer();
        await storePdfData(id, new Uint8Array(arrayBuf));

        newItems.push({
          id,
          title: inferredTitle,
          authors: inferredAuthors,
          publicationYear: new Date().getFullYear(),
          journal: 'Imported PDF Document',
          pdfFileName: check.name,
          abstractText: extractedText.slice(0, 1500) || 'Extracted document text.',
          fullText: extractedText,
          hasPdf: true,
          category: 'General Research',
          addedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          downloadStatus: 'COMPLETED',
          readingProgressPercent: 0
        });
      } catch (err) {
        console.warn(`Error extracting ${check.name}:`, err);
        statusLogs.push(`Failed to extract ${check.name}`);
      }
    }

    setLoading(false);
    if (newItems.length > 0) {
      setParsedPreview(newItems);
      toast({ message: `Successfully processed ${newItems.length} PDF documents!`, tone: 'success' });
    }
  };

  const handleBulkDoiFetch = async () => {
    if (!doiListText.trim()) return;
    const dois = doiListText
      .split(/[\n,;]+/)
      .map(d => d.trim().replace(/^https?:\/\/doi\.org\//, ''))
      .filter(d => /^10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+$/.test(d));

    if (dois.length === 0) {
      toast({ message: "No valid DOIs found. Provide format 10.xxxx/...", tone: 'error' });
      return;
    }

    setLoading(true);
    const results = [];

    for (let i = 0; i < dois.length; i++) {
      const doi = dois[i];
      try {
        const res = await fetch(`https://api.openalex.org/works/https://doi.org/${doi}`);
        if (res.ok) {
          const item = await res.json();
          const authors = (item.authorships || []).slice(0, 5).map(a => a.author?.display_name).filter(Boolean).join(', ') || 'Scholarly Authors';
          const title = item.title || `Paper for DOI ${doi}`;
          const year = item.publication_year || 2024;
          const journal = item.primary_location?.source?.display_name || 'Academic Journal';
          const pdfUrl = item.open_access?.oa_url || item.best_oa_location?.pdf_url || '';

          results.push({
            id: Date.now() + i,
            title,
            authors,
            publicationYear: year,
            journal,
            doi,
            sourceUrl: `https://doi.org/${doi}`,
            downloadUrl: pdfUrl,
            abstractText: `Publication: ${title} (${authors}, ${year})`,
            category: 'General Research',
            addedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            downloadStatus: 'COMPLETED',
            readingProgressPercent: 0,
            openAccess: item.open_access?.is_oa || false
          });
        }
      } catch (err) {
        console.warn("Error fetching DOI:", doi, err);
      }
    }

    setLoading(false);
    if (results.length > 0) {
      setParsedPreview(results);
      toast({ message: `Resolved ${results.length} DOIs via OpenAlex!`, tone: 'success' });
    } else {
      toast({ message: "Could not resolve provided DOIs. Verify internet access.", tone: 'error' });
    }
  };

  const handleSaveAll = () => {
    if (parsedPreview.length === 0) return;
    onImportCompleted(parsedPreview);
    toast({ message: `Successfully imported ${parsedPreview.length} papers to your vault!`, tone: 'success' });
    onClose();
  };

  return (
    <Modal onClose={onClose} labelledBy="batch-import-title" panelStyle={{ maxWidth: '780px', width: '100%', padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <h2 id="batch-import-title" style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
            Batch Import &amp; Migration
          </h2>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            Import libraries from Zotero, Mendeley, BibTeX, RIS, or batch PDF files
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
          <X size={20} />
        </button>
      </div>

      {/* Format Selector Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {[
          { id: 'bibtex', label: 'BibTeX (.bib)' },
          { id: 'ris', label: 'RIS Export (.ris)' },
          { id: 'pdf', label: 'Batch PDF Drop' },
          { id: 'doi', label: 'Bulk DOI Ingestion' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setParsedPreview([]); }}
            className={`btn-secondary ${activeTab === tab.id ? 'active' : ''}`}
            style={{
              padding: '6px 14px',
              fontSize: '0.85rem',
              backgroundColor: activeTab === tab.id ? 'var(--primary)' : 'transparent',
              color: activeTab === tab.id ? '#fff' : 'var(--text-muted)',
              borderColor: activeTab === tab.id ? 'var(--primary)' : 'var(--border-color)'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1 & 2: BibTeX and RIS */}
      {(activeTab === 'bibtex' || activeTab === 'ris') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)' }}>
              Paste raw {activeTab === 'bibtex' ? 'BibTeX' : 'RIS'} entries or upload a file:
            </label>
            <label className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.78rem', cursor: 'pointer' }}>
              <Upload size={13} />
              <span>Choose File</span>
              <input type="file" accept={activeTab === 'bibtex' ? '.bib,.txt' : '.ris,.txt'} onChange={handleFileUpload} style={{ display: 'none' }} />
            </label>
          </div>

          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={activeTab === 'bibtex' ? '@article{vaswani2017,\n  title={Attention Is All You Need},\n  author={Vaswani, Ashish and others},\n  year={2017}\n}' : 'TY  - JOUR\nTI  - Attention Is All You Need\nAU  - Vaswani, Ashish\nPY  - 2017\nER  - '}
            style={{
              width: '100%',
              minHeight: '140px',
              padding: '12px',
              borderRadius: '8px',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8rem',
              backgroundColor: 'var(--bg-main)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-main)'
            }}
          />

          <button
            onClick={activeTab === 'bibtex' ? handleBibtexParse : handleRisParse}
            className="btn-primary"
            style={{ alignSelf: 'flex-start', padding: '8px 16px', fontSize: '0.85rem' }}
          >
            Parse &amp; Preview Records
          </button>
        </div>
      )}

      {/* Tab 3: PDF Batch Drop */}
      {activeTab === 'pdf' && (
        <div style={{
          border: '2px dashed var(--border-color)',
          borderRadius: '12px',
          padding: '30px 20px',
          textAlign: 'center',
          backgroundColor: 'var(--bg-main)'
        }}>
          <Upload size={32} style={{ margin: '0 auto 8px', color: 'var(--primary)' }} />
          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 4px' }}>Drop PDF research papers here</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
            Supports multiple PDF files simultaneously. Text and title metadata will be extracted automatically.
          </p>
          <label className="btn-primary" style={{ display: 'inline-flex', padding: '8px 18px', cursor: 'pointer' }}>
            <span>Select PDF Files</span>
            <input type="file" multiple accept=".pdf" onChange={handlePdfBatchUpload} style={{ display: 'none' }} />
          </label>
          {loading && (
            <div style={{ marginTop: '16px', fontSize: '0.8rem', color: 'var(--primary)' }}>
              <Loader2 size={16} className="animate-spin" style={{ display: 'inline', marginRight: '6px' }} />
              Processing and extracting PDF documents...
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Bulk DOI Ingestion */}
      {activeTab === 'doi' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)' }}>
            Enter DOIs (one per line or comma-separated):
          </label>
          <textarea
            value={doiListText}
            onChange={(e) => setDoiListText(e.target.value)}
            placeholder={"10.1145/3318464.3389700\n10.1038/s41586-020-2649-2\n10.1109/CVPR.2016.90"}
            style={{
              width: '100%',
              minHeight: '120px',
              padding: '12px',
              borderRadius: '8px',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.85rem',
              backgroundColor: 'var(--bg-main)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-main)'
            }}
          />
          <button
            onClick={handleBulkDoiFetch}
            disabled={loading}
            className="btn-primary"
            style={{ alignSelf: 'flex-start', padding: '8px 16px', fontSize: '0.85rem' }}
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : null}
            <span>Resolve DOIs via OpenAlex</span>
          </button>
        </div>
      )}

      {/* Parsed Preview Table */}
      {parsedPreview.length > 0 && (
        <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>
              Preview Ready for Ingestion ({parsedPreview.length} papers):
            </span>
            <button
              onClick={handleSaveAll}
              className="btn-primary"
              style={{ padding: '6px 14px', fontSize: '0.82rem' }}
            >
              <CheckCircle size={14} />
              <span>Import All into Library</span>
            </button>
          </div>

          <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
            {parsedPreview.map((p, idx) => (
              <div
                key={idx}
                style={{
                  padding: '8px 12px',
                  borderBottom: idx < parsedPreview.length - 1 ? '1px solid var(--border-color)' : 'none',
                  backgroundColor: idx % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-main)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.82rem'
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{p.title}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>{p.authors} ({p.publicationYear})</div>
                </div>
                <span className="badge" style={{ fontSize: '0.7rem' }}>{p.resourceType || 'Paper'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
