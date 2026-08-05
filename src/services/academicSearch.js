// Academic Search Engine Service (OpenAlex & Crossref API Integration)

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

export async function searchAcademicSources(query, page = 1, perPage = 10, sortBy = 'citations') {
  if (!query || !query.trim()) {
    return { results: [], totalCount: 0, page: 1, perPage, totalPages: 0 };
  }
  const clean = query.trim();

  // Check DOI pattern
  const isDoi = /^10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+$/.test(clean);
  
  // Detect explicit author search syntax (e.g. author:"Yoshua Bengio" or author:Bengio)
  const authorMatch = clean.match(/^author:(?:"([^"]+)"|([^\s]+))/i);
  const explicitAuthor = authorMatch ? (authorMatch[1] || authorMatch[2]) : null;

  // Detect explicit title search syntax (e.g. title:"Deep Learning")
  const titleMatch = clean.match(/^title:(?:"([^"]+)"|([^\s]+))/i);
  const explicitTitle = titleMatch ? (titleMatch[1] || titleMatch[2]) : null;

  let searchPhrase = clean;
  if (explicitAuthor) searchPhrase = explicitAuthor;
  if (explicitTitle) searchPhrase = explicitTitle;

  // Build OpenAlex sort and filter parameters
  let openAlexSort = 'cited_by_count:desc';
  if (sortBy === 'newest') openAlexSort = 'publication_year:desc';
  if (sortBy === 'relevance') openAlexSort = 'relevance_score:desc';

  let openAlexFilters = [];
  if (sortBy === 'openaccess') {
    openAlexFilters.push('is_oa:true');
  }

  // Detect custom year in query if provided (e.g., "2022 computer")
  const yearMatch = clean.match(/\b(19\d{2}|20[0-2]\d)\b/);
  if (yearMatch) {
    const customYear = parseInt(yearMatch[1], 10);
    openAlexFilters.push(`publication_year:${customYear}`);
  }

  const filterStr = openAlexFilters.length > 0 ? `&filter=${openAlexFilters.join(',')}` : '';

  try {
    let openAlexUrl = '';

    if (isDoi) {
      openAlexUrl = `https://api.openalex.org/works/https://doi.org/${clean}`;
    } else if (explicitAuthor) {
      const authFilter = `raw_author_name.search:"${encodeURIComponent(explicitAuthor)}"`;
      const combinedFilter = openAlexFilters.length > 0 ? `${authFilter},${openAlexFilters.join(',')}` : authFilter;
      openAlexUrl = `https://api.openalex.org/works?filter=${combinedFilter}&page=${page}&per_page=${perPage}&sort=${openAlexSort}`;
    } else {
      openAlexUrl = `https://api.openalex.org/works?search=${encodeURIComponent(searchPhrase)}&page=${page}&per_page=${perPage}&sort=${openAlexSort}${filterStr}`;
    }

    // 1. OpenAlex Query
    const res = await fetch(openAlexUrl);
    if (res.ok) {
      const data = await res.json();
      const items = isDoi ? (data ? [data] : []) : (data.results || []);
      const totalCount = isDoi ? (data ? 1 : 0) : (data.meta?.count || items.length);

      if (items.length > 0) {
        const parsedResults = items.map(item => parseOpenAlexItem(item, clean));
        
        let finalResults = parsedResults;
        if (sortBy === 'openaccess') {
          finalResults = parsedResults.filter(p => p.openAccess);
        }

        return {
          results: finalResults,
          totalCount,
          page,
          perPage,
          totalPages: Math.ceil(totalCount / perPage)
        };
      }
    }

    // 2. Crossref Query (Fallback/Secondary API)
    let crossrefSort = '&sort=is-referenced-by-count&order=desc';
    if (sortBy === 'newest') crossrefSort = '&sort=published&order=desc';
    if (sortBy === 'relevance') crossrefSort = '&sort=score&order=desc';

    const offset = (page - 1) * perPage;
    let crossrefUrl = '';
    if (explicitAuthor) {
      crossrefUrl = `https://api.crossref.org/works?query.author=${encodeURIComponent(explicitAuthor)}&rows=${perPage}&offset=${offset}${crossrefSort}`;
    } else if (explicitTitle) {
      crossrefUrl = `https://api.crossref.org/works?query.title=${encodeURIComponent(explicitTitle)}&rows=${perPage}&offset=${offset}${crossrefSort}`;
    } else {
      crossrefUrl = `https://api.crossref.org/works?query=${encodeURIComponent(searchPhrase)}&rows=${perPage}&offset=${offset}${crossrefSort}`;
    }

    const crRes = await fetch(crossrefUrl);
    if (crRes.ok) {
      const crData = await crRes.json();
      const crItems = crData.message?.items || [];
      const totalCount = crData.message?.['total-results'] || crItems.length;

      if (crItems.length > 0) {
        const parsed = crItems.map(item => parseCrossrefItem(item, clean));
        let finalResults = parsed;
        if (sortBy === 'openaccess') {
          finalResults = parsed.filter(p => p.openAccess);
        }

        return {
          results: finalResults,
          totalCount,
          page,
          perPage,
          totalPages: Math.ceil(totalCount / perPage)
        };
      }
    }
  } catch (err) {
    console.warn("Academic API live query error, using local fallback dataset.", err);
  }

  // 3. Fallback: Local Curated Catalog
  const lower = searchPhrase.toLowerCase();
  const sampleFiltered = SAMPLE_PAPERS.filter(p => 
    p.title.toLowerCase().includes(lower) || 
    p.authors.toLowerCase().includes(lower) || 
    p.suggestedCategory.toLowerCase().includes(lower) || 
    p.abstractText.toLowerCase().includes(lower) ||
    lower.length <= 2
  );

  let sortedSample = [...sampleFiltered];
  if (sortBy === 'citations') {
    sortedSample.sort((a, b) => (b.citationCount || 0) - (a.citationCount || 0));
  } else if (sortBy === 'newest') {
    sortedSample.sort((a, b) => (b.publicationYear || 0) - (a.publicationYear || 0));
  } else if (sortBy === 'openaccess') {
    sortedSample = sortedSample.filter(p => p.openAccess);
  }

  const offset = (page - 1) * perPage;
  const pageResults = sortedSample.slice(offset, offset + perPage);
  const totalCount = sortedSample.length;

  return {
    results: pageResults,
    totalCount,
    page,
    perPage,
    totalPages: Math.ceil(totalCount / perPage)
  };
}

// A URL is only worth trying to preview inline if it looks like it
// resolves directly to a PDF file (as opposed to a publisher landing
// page such as https://doi.org/... or https://journal.example/article/123,
// which almost always sends X-Frame-Options/CSP headers that block framing).
export function isDirectPdfUrl(urlStr) {
  if (!urlStr) return false;
  try {
    const { pathname } = new URL(urlStr);
    return pathname.toLowerCase().endsWith('.pdf');
  } catch (e) {
    return false;
  }
}

function extractDomain(urlStr) {
  if (!urlStr) return '';
  try {
    const parsed = new URL(urlStr);
    return parsed.hostname.replace('www.', '');
  } catch (e) {
    return 'openaccess.org';
  }
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
  const pdfDomain = extractDomain(pdfUrl || primaryLoc.landing_page_url);

  const concepts = (item.concepts || [])
    .slice(0, 8)
    .map(c => c.display_name)
    .filter(Boolean);

  const topics = (item.topics || [])
    .slice(0, 4)
    .map(t => t.display_name)
    .filter(Boolean);
  
  return {
    title: item.title || 'Untitled Academic Paper',
    authors,
    publicationYear: item.publication_year || 2024,
    journalOrVenue: journal,
    abstractText: item.abstract_inverted_index 
      ? reconstructAbstract(item.abstract_inverted_index) 
      : `Research publication by ${authors} published in ${journal} (${item.publication_year || 2024}).`,
    doi: doi || queryClean,
    sourceUrl: primaryLoc.landing_page_url || (doi ? `https://doi.org/${doi}` : 'https://openalex.org'),
    downloadUrl: pdfUrl,
    pdfDomain: pdfDomain || 'scholar.org',
    resourceType: item.type === 'book' ? 'Book' : (item.type === 'dissertation' ? 'Thesis' : 'Research Paper'),
    openAccess: item.open_access?.is_oa || false,
    citationCount: item.cited_by_count || 0,
    suggestedCategory: suggestCategory(item.title || ''),
    concepts,
    topics
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
  const pdfDomain = extractDomain(pdfUrl || item.URL);

  const subjectConcepts = (item.subject || []).slice(0, 6);

  return {
    title,
    authors,
    publicationYear: year,
    journalOrVenue: journal,
    abstractText: item.abstract 
      ? item.abstract.replace(/<[^>]*>?/gm, '') 
      : `Academic paper authored by ${authors} in ${journal} (${year}).`,
    doi,
    sourceUrl: item.URL || `https://doi.org/${doi}`,
    downloadUrl: pdfUrl,
    pdfDomain: pdfDomain || 'crossref.org',
    resourceType: 'Research Paper',
    openAccess: !!pdfUrl,
    citationCount: item['is-referenced-by-count'] || 0,
    suggestedCategory: suggestCategory(title),
    concepts: subjectConcepts,
    topics: []
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
  return text || "Abstract text provided in paper publication.";
}

function suggestCategory(title) {
  const t = title.toLowerCase();
  if (t.includes('ai') || t.includes('neural') || t.includes('learning') || t.includes('gpt') || t.includes('transformer')) return 'Artificial Intelligence';
  if (t.includes('security') || t.includes('crypto') || t.includes('privacy')) return 'Cybersecurity';
  if (t.includes('data') || t.includes('stat') || t.includes('graph')) return 'Data Science';
  if (t.includes('cloud') || t.includes('distributed') || t.includes('network')) return 'Cloud Computing';
  if (t.includes('human') || t.includes('interface') || t.includes('interaction') || t.includes('hci')) return 'Human-Computer Interaction';
  return 'Computer Science';
}