// Academic Citation Formatter Engine

export const STYLES = [
  { id: 'APA', name: 'APA 7th' },
  { id: 'MLA', name: 'MLA 9th' },
  { id: 'IEEE', name: 'IEEE' },
  { id: 'CHICAGO', name: 'Chicago Manual' },
  { id: 'HARVARD', name: 'Harvard' },
  { id: 'BIBTEX', name: 'BibTeX' },
  { id: 'RIS', name: 'RIS Export' }
];

export function generateCitation(resource, style = 'APA') {
  const firstAuthor = resource.authors.split(',')[0]?.trim() || 'Author';
  const year = resource.publicationYear || 2024;
  const title = resource.title || 'Untitled Document';
  const journal = resource.journal || 'Academic Repository';
  const doi = resource.doi ? `https://doi.org/${resource.doi}` : (resource.sourceUrl || '');

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
    case 'BIBTEX':
      return `@article{${firstAuthor.slice(0, 5).toLowerCase()}${year},
  title={${title}},
  author={${resource.authors}},
  journal={${journal}},
  year={${year}},
  doi={${resource.doi || ''}}
}`;
    case 'RIS':
      return `TY  - JOUR
TI  - ${title}
AU  - ${resource.authors}
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

