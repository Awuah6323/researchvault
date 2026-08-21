import React, { useState } from 'react';
import { X, Link2, FileText, Search, Loader2, UploadCloud, Check } from 'lucide-react';
import { searchAcademicSources, suggestCategory } from '../services/academicSearch';
import { extractTextFromPdfFile } from '../utils/pdfExtractor';
import Modal from './Modal';

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

      const cleanName = file.name.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ');
      const autoTitle = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
      if (!title) {
        setTitle(autoTitle);
      }

      // Extract real text from the PDF file for Gemini AI
      try {
        const extractedText = await extractTextFromPdfFile(file);
        if (extractedText && extractedText.trim()) {
          setAbstractText(extractedText.trim());
          setExtractionStatus('Extracted text content from PDF successfully!');
          const autoCat = suggestCategory(title || autoTitle, extractedText);
          setCategory(autoCat);
        } else {
          setExtractionStatus('PDF attached.');
          const autoCat = suggestCategory(title || autoTitle, '');
          setCategory(autoCat);
        }
      } catch (err) {
        console.warn("PDF extraction warning:", err);
        setExtractionStatus('PDF attached.');
        const autoCat = suggestCategory(title || autoTitle, '');
        setCategory(autoCat);
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
        const autoCat = suggestCategory(item.title || '', item.abstractText || '');
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
          category: item.suggestedCategory || autoCat || category,
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

    const rawExtracted = abstractText.trim();
    const shortAbstract = rawExtracted.length > 400 
      ? rawExtracted.slice(0, 400) + '...' 
      : (rawExtracted || 'Imported paper document in ResearchVault digital library.');

    const finalCategory = (category && category !== 'Computer Science') ? category : suggestCategory(title.trim(), rawExtracted);

    onAdd({
      title: title.trim(),
      authors: authors.trim() || 'User Imported Author',
      publicationYear: parseInt(publicationYear) || 2024,
      category: finalCategory,
      resourceType,
      abstractText: shortAbstract,
      fullText: rawExtracted || shortAbstract,
      pdfFileName,
      pdfFileData,
      openAccess: true,
      downloadStatus: 'COMPLETED'
    });
    onClose();
  };

  return (
    <Modal
      onClose={onClose}
      labelledBy="add-resource-title"
      zIndex={50}
      panelStyle={{ width: '100%', maxWidth: '580px', padding: '24px' }}
    >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 id="add-resource-title" style={{ fontSize: '1.2rem', fontWeight: 700 }}>Add to Research Vault</h2>
          <button type="button" onClick={onClose} aria-label="Close add paper dialog" style={{ color: 'var(--text-muted)' }}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Tab Selection */}
        <div role="group" aria-label="How to add a paper" style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', overflowX: 'auto' }}>
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            aria-pressed={activeTab === 'upload'}
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
            <UploadCloud size={16} aria-hidden="true" /> Upload PDF from Device
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('doi')}
            aria-pressed={activeTab === 'doi'}
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
            <Link2 size={16} aria-hidden="true" /> Link or DOI
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            aria-pressed={activeTab === 'manual'}
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
            <FileText size={16} aria-hidden="true" /> Manual Entry
          </button>
        </div>

        {/* Mode 0: Upload PDF directly from device */}
        {activeTab === 'upload' && (
          <form onSubmit={handleSubmitManual} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <label htmlFor="upload-pdf-file" style={{
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
              {/* .sr-only rather than display:none — a hidden input is removed
                  from the tab order entirely, making upload keyboard-only
                  users unable to reach the file picker at all. */}
              <input
                id="upload-pdf-file"
                type="file"
                accept=".pdf,application/pdf"
                onChange={handlePdfChange}
                className="sr-only"
              />
              <UploadCloud size={36} aria-hidden="true" style={{ color: pdfFileName ? '#10b981' : 'var(--primary)', marginBottom: '8px' }} />
              <span style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '4px' }}>
                {pdfFileName ? `Selected: ${pdfFileName}` : 'Tap or Click to Select PDF file'}
              </span>
              <span role="status" style={{ fontSize: '0.75rem', color: extractionStatus.includes('successfully') ? '#10b981' : 'var(--text-muted)' }}>
                {extractionStatus || (pdfFileName ? 'File attached! Text extracted for AI analysis below.' : 'Supports PDF documents from your Phone, Tablet, Laptop, or Cloud Storage.')}
              </span>
            </label>

            <div>
              <label htmlFor="upload-title" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Paper Title *</label>
              <input
                id="upload-title"
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
                <label htmlFor="upload-category" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Category</label>
                <select
                  id="upload-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)' }}
                >
                  {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label htmlFor="upload-authors" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Authors (Optional)</label>
                <input
                  id="upload-authors"
                  type="text"
                  value={authors}
                  onChange={(e) => setAuthors(e.target.value)}
                  placeholder="Author names"
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)' }}
                />
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={readingFile} style={{ width: '100%', marginTop: '6px', opacity: readingFile ? 0.6 : 1 }}>
              {readingFile
                ? <Loader2 size={18} aria-hidden="true" className="animate-spin" />
                : <UploadCloud size={18} aria-hidden="true" />}
              <span>{readingFile ? 'Extracting PDF text...' : 'Upload PDF to Vault'}</span>
            </button>
          </form>
        )}

        {/* Mode 1: DOI / URL Link */}
        {activeTab === 'doi' && (
          <form onSubmit={handleDoiSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
              Paste a paper DOI identifier (e.g. <code>10.1038/nature14539</code>) or direct URL (arXiv, IEEE, Nature, OpenAlex) to automatically fetch paper details.
            </p>

            <label htmlFor="doi-input" className="sr-only">DOI identifier or paper URL</label>
            <input
              id="doi-input"
              type="text"
              value={doiUrl}
              onChange={(e) => setDoiUrl(e.target.value)}
              placeholder="https://doi.org/10... or 10.48550/arXiv.1706.03762"
              aria-invalid={doiError ? 'true' : undefined}
              aria-describedby={doiError ? 'doi-error' : undefined}
              style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)' }}
            />

            {doiError && <div id="doi-error" role="alert" style={{ color: '#dc2626', fontSize: '0.85rem' }}>{doiError}</div>}

            <button type="submit" className="btn-primary" disabled={fetchingDoi || !doiUrl.trim()}>
              {fetchingDoi
                ? <Loader2 size={18} aria-hidden="true" className="animate-spin" />
                : <Link2 size={18} aria-hidden="true" />}
              <span>{fetchingDoi ? 'Fetching Metadata...' : 'Fetch & Save Paper'}</span>
            </button>
          </form>
        )}

        {/* Mode 2: Manual Metadata */}
        {activeTab === 'manual' && (
          <form onSubmit={handleSubmitManual} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label htmlFor="manual-title" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Paper Title *</label>
              <input
                id="manual-title"
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
                <label htmlFor="manual-authors" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Authors</label>
                <input
                  id="manual-authors"
                  type="text"
                  value={authors}
                  onChange={(e) => setAuthors(e.target.value)}
                  placeholder="Author names"
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)' }}
                />
              </div>

              <div>
                <label htmlFor="manual-year" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Year</label>
                <input
                  id="manual-year"
                  type="number"
                  value={publicationYear}
                  onChange={(e) => setPublicationYear(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label htmlFor="manual-category" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Category</label>
                <select
                  id="manual-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)' }}
                >
                  {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label htmlFor="manual-doctype" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Document Type</label>
                <select
                  id="manual-doctype"
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
              <label htmlFor="manual-pdf" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Attach PDF File (Optional)</label>
              <input
                id="manual-pdf"
                type="file"
                accept=".pdf"
                onChange={handlePdfChange}
                style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', fontSize: '0.85rem' }}
              />
              {pdfFileName && (
                <div role="status" style={{ fontSize: '0.75rem', color: 'var(--primary)', marginTop: '4px', fontWeight: 600 }}>
                  Selected PDF: {pdfFileName}
                </div>
              )}
            </div>

            <div>
              <label htmlFor="manual-abstract" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Abstract / Summary</label>
              <textarea
                id="manual-abstract"
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
    </Modal>
  );
}

