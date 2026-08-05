import React, { useState } from 'react';
import { X, Link2, FileText, Search, Loader2, UploadCloud, Check } from 'lucide-react';
import { searchAcademicSources } from '../services/academicSearch';
import { extractTextFromPdfFile } from '../utils/pdfExtractor';

export default function AddResourceModal({ onClose, onAdd, categories, onNavigateSearch }) {
  const [activeTab, setActiveTab] = useState('upload'); // upload, doi, manual
  const [doiUrl, setDoiUrl] = useState('');
  const [fetchingDoi, setFetchingDoi] = useState(false);
  const [doiError, setDoiError] = useState('');

  // Manual & Upload Form State
  const [title, setTitle] = useState('');
  const [authors, setAuthors] = useState('');
  const [publicationYear, setPublicationYear] = useState(new Date().getFullYear());
  const [category, setCategory] = useState(categories[0]?.name || 'Computer Science');
  const [resourceType, setResourceType] = useState('Research Paper');
  const [abstractText, setAbstractText] = useState('');
  const [pdfFileName, setPdfFileName] = useState('');
  const [pdfFileData, setPdfFileData] = useState('');
  const [readingFile, setReadingFile] = useState(false);
  const [extractionStatus, setExtractionStatus] = useState('');

  const handlePdfChange = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setPdfFileName(file.name);
      setReadingFile(true);
      setExtractionStatus('Extracting text content from PDF...');

      if (!title) {
        const cleanName = file.name.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ');
        setTitle(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
      }

      // Extract real text from the PDF file for Gemini AI
      try {
        const extractedText = await extractTextFromPdfFile(file);
        if (extractedText && extractedText.trim()) {
          setAbstractText(extractedText.trim());
          setExtractionStatus('Extracted text content from PDF successfully!');
        } else {
          setExtractionStatus('PDF attached.');
        }
      } catch (err) {
        console.warn("PDF extraction warning:", err);
        setExtractionStatus('PDF attached.');
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        setPdfFileData(event.target.result);
        setReadingFile(false);
      };
      reader.onerror = () => {
        setReadingFile(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDoiSubmit = async (e) => {
    e.preventDefault();
    if (!doiUrl.trim() || fetchingDoi) return;
    setFetchingDoi(true);
    setDoiError('');

    try {
      const response = await searchAcademicSources(doiUrl.trim());
      const results = Array.isArray(response) ? response : (response?.results || []);
      if (results && results.length > 0) {
        const item = results[0];
        onAdd({
          title: item.title,
          authors: item.authors,
          abstractText: item.abstractText,
          publicationYear: item.publicationYear,
          journal: item.journalOrVenue,
          doi: item.doi,
          sourceUrl: item.sourceUrl,
          downloadUrl: item.downloadUrl,
          resourceType: item.resourceType,
          category: item.suggestedCategory || category,
          openAccess: item.openAccess,
          citationCount: item.citationCount,
          downloadStatus: 'COMPLETED'
        });
        onClose();
      } else {
        setDoiError('Could not fetch paper metadata for this DOI/URL. You can enter details manually.');
      }
    } catch (err) {
      setDoiError('Error querying academic repository.');
    } finally {
      setFetchingDoi(false);
    }
  };

  const handleSubmitManual = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    onAdd({
      title: title.trim(),
      authors: authors.trim() || 'User Imported Author',
      publicationYear: parseInt(publicationYear) || 2024,
      category,
      resourceType,
      abstractText: abstractText.trim() || 'Imported paper document in ResearchVault digital library.',
      pdfFileName,
      pdfFileData,
      openAccess: true,
      downloadStatus: 'COMPLETED'
    });
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 50,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div className="glass-card animate-fade-in" style={{ width: '100%', maxWidth: '580px', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Add to Research Vault</h3>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}><X size={20} /></button>
        </div>

        {/* Tab Selection */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', overflowX: 'auto' }}>
          <button
            onClick={() => setActiveTab('upload')}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 600,
              backgroundColor: activeTab === 'upload' ? 'var(--primary)' : 'var(--bg-main)',
              color: activeTab === 'upload' ? '#fff' : 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap'
            }}
          >
            <UploadCloud size={16} /> Upload PDF from Device
          </button>

          <button
            onClick={() => setActiveTab('doi')}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 600,
              backgroundColor: activeTab === 'doi' ? 'var(--primary)' : 'var(--bg-main)',
              color: activeTab === 'doi' ? '#fff' : 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap'
            }}
          >
            <Link2 size={16} /> Link or DOI
          </button>

          <button
            onClick={() => setActiveTab('manual')}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 600,
              backgroundColor: activeTab === 'manual' ? 'var(--primary)' : 'var(--bg-main)',
              color: activeTab === 'manual' ? '#fff' : 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap'
            }}
          >
            <FileText size={16} /> Manual Entry
          </button>
        </div>

        {/* Mode 0: Upload PDF directly from device */}
        {activeTab === 'upload' && (
          <form onSubmit={handleSubmitManual} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <label style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px 16px',
              borderRadius: '12px',
              border: pdfFileName ? '2px solid #10b981' : '2px dashed var(--primary)',
              backgroundColor: pdfFileName ? 'rgba(16, 185, 129, 0.05)' : 'var(--bg-main)',
              cursor: 'pointer',
              textAlign: 'center',
              transition: 'all 0.2s ease'
            }}>
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={handlePdfChange}
                style={{ display: 'none' }}
              />
              <UploadCloud size={36} style={{ color: pdfFileName ? '#10b981' : 'var(--primary)', marginBottom: '8px' }} />
              <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '4px' }}>
                {pdfFileName ? `Selected: ${pdfFileName}` : 'Tap or Click to Select PDF file'}
              </div>
              <div style={{ fontSize: '0.75rem', color: extractionStatus.includes('successfully') ? '#10b981' : 'var(--text-muted)' }}>
                {extractionStatus || (pdfFileName ? 'File attached! Text extracted for AI analysis below.' : 'Supports PDF documents from your Phone, Tablet, Laptop, or Cloud Storage.')}
              </div>
            </label>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Paper Title *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title extracted from PDF or enter title"
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)' }}
                >
                  {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Authors (Optional)</label>
                <input
                  type="text"
                  value={authors}
                  onChange={(e) => setAuthors(e.target.value)}
                  placeholder="Author names"
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)' }}
                />
              </div>
            </div>

            <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '6px' }}>
              <UploadCloud size={18} />
              <span>Upload PDF to Vault</span>
            </button>
          </form>
        )}

        {/* Mode 1: DOI / URL Link */}
        {activeTab === 'doi' && (
          <form onSubmit={handleDoiSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
              Paste a paper DOI identifier (e.g. <code>10.1038/nature14539</code>) or direct URL (arXiv, IEEE, Nature, OpenAlex) to automatically fetch paper details.
            </p>

            <input
              type="text"
              value={doiUrl}
              onChange={(e) => setDoiUrl(e.target.value)}
              placeholder="https://doi.org/10... or 10.48550/arXiv.1706.03762"
              style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)' }}
            />

            {doiError && <div style={{ color: '#dc2626', fontSize: '0.85rem' }}>{doiError}</div>}

            <button type="submit" className="btn-primary" disabled={fetchingDoi || !doiUrl.trim()}>
              {fetchingDoi ? <Loader2 size={18} className="animate-spin" /> : <Link2 size={18} />}
              <span>{fetchingDoi ? 'Fetching Metadata...' : 'Fetch & Save Paper'}</span>
            </button>
          </form>
        )}

        {/* Mode 2: Manual Metadata */}
        {activeTab === 'manual' && (
          <form onSubmit={handleSubmitManual} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Paper Title *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="E.g., Attention Is All You Need"
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Authors</label>
                <input
                  type="text"
                  value={authors}
                  onChange={(e) => setAuthors(e.target.value)}
                  placeholder="Author names"
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Year</label>
                <input
                  type="number"
                  value={publicationYear}
                  onChange={(e) => setPublicationYear(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)' }}
                >
                  {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Document Type</label>
                <select
                  value={resourceType}
                  onChange={(e) => setResourceType(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)' }}
                >
                  <option value="Research Paper">Research Paper</option>
                  <option value="Journal Article">Journal Article</option>
                  <option value="Conference Paper">Conference Paper</option>
                  <option value="Book">Book</option>
                  <option value="Thesis">Thesis</option>
                </select>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Attach PDF File (Optional)</label>
              <input
                type="file"
                accept=".pdf"
                onChange={handlePdfChange}
                style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', fontSize: '0.85rem' }}
              />
              {pdfFileName && (
                <div style={{ fontSize: '0.75rem', color: 'var(--primary)', marginTop: '4px', fontWeight: 600 }}>
                  Selected PDF: {pdfFileName}
                </div>
              )}
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Abstract / Summary</label>
              <textarea
                rows={3}
                value={abstractText}
                onChange={(e) => setAbstractText(e.target.value)}
                placeholder="Paste paper abstract or key findings..."
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)' }}
              />
            </div>

            <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '8px' }}>
              Save Paper to Library
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

