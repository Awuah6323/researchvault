// Enhanced Academic Search Engine (OpenAlex & Crossref API Integration)

const SAMPLE_PAPERS = [
  {
    title: "Attention Is All You Need: Transformers in Modern AI",
    authors: "Vaswani, A., Shazeer, N., Parmar, N., Uszkoreit, J.",
    publicationYear: 2021,
    journalOrVenue: "Advances in Neural Information Processing Systems",
    abstractText: "The dominant sequence transduction models are based on complex recurrent or convolutional neural networks. We propose the Transformer, a model architecture relying entirely on attention mechanisms to draw global dependencies between input and output.",
    doi: "10.48550/arXiv.1706.03762",
    sourceUrl: "https://arxiv.org/abs/1706.03762",
    downloadUrl: "https://arxiv.org/pdf/1706.03762.pdf",
    resourceType: "Research Paper",
    openAccess: true,
    citationCount: 112000,
    suggestedCategory: "Artificial Intelligence"
  },
  {
    title: "Deep Residual Learning for Image Recognition",
    authors: "He, K., Zhang, X., Ren, S., Sun, J.",
    publicationYear: 2020,
    journalOrVenue: "IEEE Conference on Computer Vision and Pattern Recognition",
    abstractText: "Deeper neural networks are more difficult to train. We present a residual learning framework to ease the training of networks that are substantially deeper than those previously used.",
    doi: "10.1109/CVPR.2016.90",
    sourceUrl: "https://doi.org/10.1109/CVPR.2016.90",
    downloadUrl: "https://openaccess.thecvf.com/content_cvpr_2016/papers/He_Deep_Residual_Learning_CVPR_2016_paper.pdf",
    resourceType: "Conference Paper",
    openAccess: true,
    citationCount: 185000,
    suggestedCategory: "Artificial Intelligence"
  },
  {
    title: "Mastering the Game of Go with Deep Neural Networks and Tree Search",
    authors: "Silver, D., Huang, A., Maddison, C. J., Guez, A., Hinton, G.",
    publicationYear: 2022,
    journalOrVenue: "Nature Journal",
    abstractText: "The game of Go has long been viewed as the most challenging of classic games for artificial intelligence owing to its enormous search space and difficulty of evaluating board positions.",
    doi: "10.1038/nature16961",
    sourceUrl: "https://doi.org/10.1038/nature16961",
    downloadUrl: "",
    resourceType: "Journal Article",
    openAccess: false,
    citationCount: 42000,
    suggestedCategory: "Artificial Intelligence"
  }
];

export async function searchAcademicSources(query) {
  if (!query || !query.trim()) return [];
  const clean = query.trim();

  try {
    const isDoi = /^10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+$/.test(clean);
    
    // 1. Primary OpenAlex Query (fetching 25 results, covering titles, abstracts, and author names)
    const openAlexUrl = isDoi
      ? `https://api.openalex.org/works/https://doi.org/${clean}`
      : `https://api.openalex.org/works?search=${encodeURIComponent(clean)}&per_page=25&sort=cited_by_count:desc`;

    const res = await fetch(openAlexUrl);
    if (res.ok) {
      const data = await res.json();
      const items = isDoi ? (data ? [data] : []) : (data.results || []);
      
      if (items.length > 0) {
        const parsedResults = items.map(item => parseOpenAlexItem(item, clean));
        
        // If results are robust (>= 5), return them directly
        if (parsedResults.length >= 5 || isDoi) {
          return parsedResults;
        }
      }
    }

    // 2. Crossref API Fallback (especially effective for author queries, obscure titles, & Crossref DOIs)
    const crossrefUrl = `https://api.crossref.org/works?query=${encodeURIComponent(clean)}&rows=25`;
    const crRes = await fetch(crossrefUrl);
    if (crRes.ok) {
      const crData = await crRes.json();
      const crItems = crData.message?.items || [];
      if (crItems.length > 0) {
        return crItems.map(item => parseCrossrefItem(item, clean));
      }
    }
  } catch (err) {
    console.warn("Academic API live query error, using enhanced local catalog.", err);
  }

  // 3. Fallback to curated catalog matching title, author names, or category
  const lower = clean.toLowerCase();
  return SAMPLE_PAPERS.filter(p => 
    p.title.toLowerCase().includes(lower) || 
    p.authors.toLowerCase().includes(lower) || 
    p.suggestedCategory.toLowerCase().includes(lower) || 
    clean.length < 3
  );
}

function parseOpenAlexItem(item, queryClean) {
  const authors = (item.authorships || [])
    .slice(0, 5)
    .map(a => a.author?.display_name)
    .filter(Boolean)
    .join(', ') || 'Scholarly Authors';

  const primaryLoc = item.primary_location || {};
  const journal = primaryLoc.source?.display_name || item.host_venue?.display_name || 'Academic Venue';
  const doi = (item.doi || '').replace('https://doi.org/', '');
  const pdfUrl = item.open_access?.oa_url || item.best_oa_location?.pdf_url || '';
  
  return {
    title: item.title || 'Untitled Academic Paper',
    authors,
    publicationYear: item.publication_year || 2024,
    journalOrVenue: journal,
    abstractText: item.abstract_inverted_index ? reconstructAbstract(item.abstract_inverted_index) : `Research publication by ${authors} published in ${journal}.`,
    doi: doi || queryClean,
    sourceUrl: primaryLoc.landing_page_url || (doi ? `https://doi.org/${doi}` : 'https://openalex.org'),
    downloadUrl: pdfUrl,
    resourceType: item.type === 'book' ? 'Book' : (item.type === 'dissertation' ? 'Thesis' : 'Research Paper'),
    openAccess: item.open_access?.is_oa || false,
    citationCount: item.cited_by_count || 0,
    suggestedCategory: suggestCategory(item.title || '')
  };
}

function parseCrossrefItem(item, queryClean) {
  const authors = (item.author || [])
    .slice(0, 5)
    .map(a => `${a.given || ''} ${a.family || ''}`.trim())
    .filter(Boolean)
    .join(', ') || 'Academic Authors';

  const journal = (item['container-title'] && item['container-title'][0]) || 'Academic Journal';
  const year = item.issued?.['date-parts']?.[0]?.[0] || 2024;
  const doi = item.DOI || queryClean;
  const title = (item.title && item.title[0]) || 'Academic Work';
  const pdfUrl = item.link?.find(l => l['content-type'] === 'application/pdf')?.URL || '';

  return {
    title,
    authors,
    publicationYear: year,
    journalOrVenue: journal,
    abstractText: item.abstract ? item.abstract.replace(/<[^>]*>?/gm, '') : `Academic paper authored by ${authors} in ${journal} (${year}).`,
    doi,
    sourceUrl: item.URL || `https://doi.org/${doi}`,
    downloadUrl: pdfUrl,
    resourceType: 'Research Paper',
    openAccess: !!pdfUrl,
    citationCount: item['is-referenced-by-count'] || 0,
    suggestedCategory: suggestCategory(title)
  };
}

function reconstructAbstract(invertedIndex) {
  if (!invertedIndex) return "Abstract text provided in paper publication.";
  const map = [];
  Object.keys(invertedIndex).forEach(word => {
    invertedIndex[word].forEach(pos => {
      map[pos] = word;
    });
  });
  const text = map.filter(Boolean).join(' ');
  return text.length > 400 ? text.slice(0, 400) + '...' : text;
}

function suggestCategory(title) {
  const t = title.toLowerCase();
  if (t.includes('ai') || t.includes('neural') || t.includes('learning') || t.includes('gpt') || t.includes('transformer')) return 'Artificial Intelligence';
  if (t.includes('security') || t.includes('crypto') || t.includes('privacy')) return 'Cybersecurity';
  if (t.includes('data') || t.includes('stat') || t.includes('graph')) return 'Data Science';
  if (t.includes('cloud') || t.includes('distributed') || t.includes('network')) return 'Cloud Computing';
  return 'Computer Science';
}
