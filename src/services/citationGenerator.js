// Academic Citation Formatter & LaTeX Generator Engine

export const STYLES = [
  { id: 'APA', name: 'APA 7th' },
  { id: 'MLA', name: 'MLA 9th' },
  { id: 'IEEE', name: 'IEEE' },
  { id: 'CHICAGO', name: 'Chicago Manual' },
  { id: 'HARVARD', name: 'Harvard' },
  { id: 'BIBTEX', name: 'BibTeX' },
  { id: 'LATEX_CITE', name: 'LaTeX \\cite{}' },
  { id: 'RIS', name: 'RIS Export' }
];

export function escapeLatex(text = '') {
  if (!text) return '';
  return String(text)
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/([&%$#_{}])/g, '\\$1')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}');
}

export function getCitationKey(resource) {
  if (!resource) return 'paper';
  if (resource.citationKey) return resource.citationKey;

  const firstAuthor = (resource.authors || 'Author')
    .split(',')[0]
    .trim()
    .replace(/[^a-zA-Z]/g, '')
    .toLowerCase() || 'author';

  const year = resource.publicationYear || new Date().getFullYear();
  
  // Pick first significant title word
  const titleWords = (resource.title || '')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => !['the', 'a', 'an', 'in', 'on', 'for', 'of', 'and', 'with', 'to'].includes(w.toLowerCase()));
  const titleSlug = (titleWords[0] || 'work').toLowerCase();

  return `${firstAuthor}${year}${titleSlug}`;
}

export function generateCitation(resource, style = 'APA') {
  if (!resource) return '';
  const firstAuthor = (resource.authors || 'Author').split(',')[0]?.trim() || 'Author';
  const year = resource.publicationYear || 2024;
  const title = resource.title || 'Untitled Document';
  const journal = resource.journal || resource.journalOrVenue || 'Academic Repository';
  const doi = resource.doi ? `https://doi.org/${resource.doi}` : (resource.sourceUrl || '');
  const citeKey = getCitationKey(resource);

  switch (style) {
    case 'APA':
      return `${firstAuthor} et al. (${year}). ${title}. ${journal}. ${doi}`;
    case 'MLA':
      return `${firstAuthor}, et al. "${title}." ${journal}, ${year}. Web. ${doi}`;
    case 'IEEE':
      return `[1] ${resource.authors}, "${title}," ${journal}, ${year}, doi: ${resource.doi || 'N/A'}.`;
    case 'CHICAGO':
      return `${resource.authors}. "${title}." ${journal} (${year}). ${doi}.`;
    case 'HARVARD':
      return `${firstAuthor} et al. ${year}, '${title}', ${journal}. Available from: <${doi}>.`;
    case 'LATEX_CITE':
      return `\\cite{${citeKey}}`;
    case 'BIBTEX':
      return `@article{${citeKey},
  title = {${title}},
  author = {${resource.authors || firstAuthor}},
  journal = {${journal}},
  year = {${year}},
  doi = {${resource.doi || ''}}
}`;
    case 'RIS':
      return `TY  - JOUR
TI  - ${title}
AU  - ${resource.authors || firstAuthor}
JO  - ${journal}
PY  - ${year}
DO  - ${resource.doi || ''}
UR  - ${doi}
ER  - `;
    default:
      return `${firstAuthor} et al. (${year}). ${title}.`;
  }
}

export function generateBatchCitations(resources, style = 'BIBTEX') {
  if (!resources || resources.length === 0) return '';
  return resources.map(r => generateCitation(r, style)).join('\n\n');
}

/**
 * Generate a complete, ready-to-compile LaTeX table for the Comparative Literature Matrix
 */
export function generateLatexMatrixTable({ columns, rows, caption = 'Comparative Literature Matrix', label = 'tab:literature_matrix' }) {
  if (!columns || !rows || rows.length === 0) return '';

  const colAlignments = columns.map((_, idx) => idx === 0 ? 'p{2.8cm}' : 'p{3.2cm}').join(' ');
  const headerCols = columns.map(c => `\\textbf{${escapeLatex(c.label || c)}}`).join(' & ');

  let tableRows = '';
  rows.forEach((row, rIdx) => {
    const cells = columns.map(col => {
      const val = row[col.key || col] || '';
      return escapeLatex(String(val)).replace(/\n/g, ' ');
    });
    tableRows += `  ${cells.join(' & ')} \\\\`;
    if (rIdx < rows.length - 1) {
      tableRows += '\n  \\midrule\n';
    } else {
      tableRows += '\n';
    }
  });

  return `\\begin{table*}[t]
\\centering
\\small
\\caption{${escapeLatex(caption)}}
\\label{${label}}
\\begin{tabular}{${colAlignments}}
  \\toprule
  ${headerCols} \\\\
  \\midrule
${tableRows}  \\bottomrule
\\end{tabular}
\\end{table*}`;
}

/**
 * Generates a full LaTeX document (.tex) for Overleaf / TeXLive
 */
export function generateLatexSynthesisDocument({ title, reviewText, papers = [] }) {
  const safeTitle = escapeLatex(title || 'Literature Synthesis Review');
  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  let bibEntries = '';
  if (papers.length > 0) {
    bibEntries = papers.map(p => generateCitation(p, 'BIBTEX')).join('\n\n');
  }

  // Convert markdown headings into LaTeX sections
  let latexBody = String(reviewText || '')
    .replace(/^# (.*$)/gim, '\\section*{$1}')
    .replace(/^## (.*$)/gim, '\\subsection*{$1}')
    .replace(/^### (.*$)/gim, '\\subsubsection*{$1}')
    .replace(/\*\*(.*?)\*\*/g, '\\textbf{$1}')
    .replace(/\*(.*?)\*/g, '\\textit{$1}')
    .replace(/`([^`]+)`/g, '\\texttt{$1}');

  return `% ==============================================================================
% Generated by ResearchVault — Academic Literature & Synthesis Platform
% ==============================================================================
\\documentclass[11pt,a4paper]{article}
\\usepackage[margin=1in]{geometry}
\\usepackage{amsmath,amssymb,amsfonts}
\\usepackage{booktabs}
\\usepackage{tabularx}
\\usepackage{hyperref}
\\usepackage{cite}
\\usepackage{microtype}
\\usepackage{setspace}
\\onehalfspacing

\\hypersetup{
    colorlinks=true,
    linkcolor=blue,
    filecolor=magenta,      
    urlcolor=cyan,
    citecolor=blue,
}

\\title{\\textbf{${safeTitle}}}
\\author{ResearchVault Scholarly Engine}
\\date{${dateStr}}

\\begin{document}

\\maketitle

\\begin{abstract}
This synthesis report was generated using the ResearchVault academic literature synthesis framework, reviewing selected foundational and state-of-the-art works.
\\end{abstract}

${latexBody}

\\newpage
\\section*{Bibliography}
\\begin{verbatim}
${bibEntries}
\\end{verbatim}

\\end{document}`;
}

/**
 * Parse raw BibTeX (.bib) text into structured resource records
 */
export function parseBibtex(text = '') {
  if (!text || typeof text !== 'string') return [];
  const entries = [];
  
  // Match @type{key, ...}
  const entryRegex = /@(\w+)\s*\{\s*([^,]+),([\s\S]*?)(?=\n@|\n*$)/g;
  let match;

  while ((match = entryRegex.exec(text)) !== null) {
    const type = match[1].toLowerCase();
    if (type === 'comment' || type === 'string' || type === 'preamble') continue;

    const citeKey = match[2].trim();
    const body = match[3];

    const fields = {};
    // Regex for field = {value} or field = "value" or field = 123
    const fieldRegex = /([a-zA-Z_-]+)\s*=\s*(?:\{([\s\S]*?)\}|"([\s\S]*?)"|(\d+))/g;
    let fieldMatch;

    while ((fieldMatch = fieldRegex.exec(body)) !== null) {
      const fieldName = fieldMatch[1].toLowerCase();
      const val = (fieldMatch[2] ?? fieldMatch[3] ?? fieldMatch[4] ?? '').trim();
      // clean TeX braces inside values
      fields[fieldName] = val.replace(/[{}]/g, '').replace(/\s+/g, ' ');
    }

    const title = fields.title || 'Untitled BibTeX Entry';
    const authors = fields.author ? fields.author.replace(/\s+and\s+/gi, ', ') : 'Unknown Authors';
    const year = parseInt(fields.year || fields.date || '', 10) || new Date().getFullYear();
    const journal = fields.journal || fields.booktitle || fields.publisher || fields.school || 'Academic Venue';
    const doi = fields.doi ? fields.doi.replace(/^https?:\/\/doi\.org\//, '') : '';
    const abstractText = fields.abstract || fields.summary || `Imported citation record from BibTeX (${citeKey}).`;
    const sourceUrl = fields.url || (doi ? `https://doi.org/${doi}` : '');

    entries.push({
      id: Date.now() + Math.floor(Math.random() * 100000),
      title,
      authors,
      publicationYear: year,
      journal,
      doi,
      citationKey: citeKey,
      abstractText,
      sourceUrl,
      downloadUrl: fields.eprint ? `https://arxiv.org/pdf/${fields.eprint}.pdf` : '',
      resourceType: type === 'book' ? 'Book' : (type === 'phdthesis' ? 'Thesis' : 'Research Paper'),
      category: 'General Research',
      addedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      downloadStatus: 'COMPLETED',
      readingProgressPercent: 0,
      openAccess: !!doi || !!sourceUrl
    });
  }

  return entries;
}

/**
 * Parse raw RIS (.ris) text into structured resource records
 */
export function parseRis(text = '') {
  if (!text || typeof text !== 'string') return [];
  const entries = [];
  const rawRecords = text.split(/ER\s{1,2}-\s*/gi);

  rawRecords.forEach((record) => {
    if (!record.trim()) return;

    const lines = record.split(/\r?\n/);
    const fields = { AU: [] };
    let currentTag = '';

    lines.forEach((line) => {
      const match = line.match(/^([A-Z0-9]{2})\s{1,2}-\s*(.*)$/);
      if (match) {
        currentTag = match[1];
        const val = match[2].trim();
        if (currentTag === 'AU' || currentTag === 'A1') {
          fields.AU.push(val);
        } else if (!fields[currentTag]) {
          fields[currentTag] = val;
        } else {
          fields[currentTag] += ' ' + val;
        }
      } else if (currentTag && line.trim()) {
        if (currentTag === 'AB' || currentTag === 'N2') {
          fields[currentTag] = (fields[currentTag] || '') + ' ' + line.trim();
        }
      }
    });

    const title = fields.TI || fields.T1 || fields.CT || 'Untitled RIS Record';
    const authors = fields.AU && fields.AU.length > 0 ? fields.AU.join(', ') : 'Scholarly Authors';
    let year = 2024;
    const rawYear = fields.PY || fields.Y1 || '';
    const yearMatch = rawYear.match(/\d{4}/);
    if (yearMatch) year = parseInt(yearMatch[0], 10);

    const journal = fields.JO || fields.JF || fields.JA || fields.T2 || 'Academic Journal';
    const doi = fields.DO ? fields.DO.replace(/^https?:\/\/doi\.org\//, '') : '';
    const abstractText = fields.AB || fields.N2 || `Imported citation record from RIS.`;
    const sourceUrl = fields.UR || (doi ? `https://doi.org/${doi}` : '');

    entries.push({
      id: Date.now() + Math.floor(Math.random() * 100000),
      title,
      authors,
      publicationYear: year,
      journal,
      doi,
      abstractText,
      sourceUrl,
      downloadUrl: '',
      resourceType: 'Research Paper',
      category: 'General Research',
      addedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      downloadStatus: 'COMPLETED',
      readingProgressPercent: 0,
      openAccess: !!doi
    });
  });

  return entries;
}
