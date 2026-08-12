// Academic Search Engine Service (Semantic Scholar, OpenAlex & Crossref Integration)

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
  }
];

export async function searchAcademicSources(query, page = 1, perPage = 10, sortBy = 'relevance') {
  if (!query || !query.trim()) {
    return { results: [], totalCount: 0, page: 1, perPage, totalPages: 0 };
  }
  const clean = query.trim();

  const isDoi = /^10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+$/.test(clean);
  
  const authorMatch = clean.match(/^author:(?:"([^"]+)"|([^\s]+))/i);
  const explicitAuthor = authorMatch ? (authorMatch[1] || authorMatch[2]) : null;

  const titleMatch = clean.match(/^title:(?:"([^"]+)"|([^\s]+))/i);
  const explicitTitle = titleMatch ? (titleMatch[1] || titleMatch[2]) : null;

  let searchPhrase = clean;
  if (explicitAuthor) searchPhrase = explicitAuthor;
  if (explicitTitle) searchPhrase = explicitTitle;

  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'of', 'in', 'for', 'on', 'with', 'by', 'at', 'to', 'is', 'it', 'from', 'as', 'paper', 'papers', 'research', 'study']);
  const queryTokens = searchPhrase
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w));

  const calculateRelevance = (item) => {
    const titleText = (item.title || '').toLowerCase();
    const abstractText = (item.abstractText || '').toLowerCase();
    const authorsText = (item.authors || '').toLowerCase();
    const fullQuery = searchPhrase.toLowerCase().trim();

    let score = 0;

    if (titleText.includes(fullQuery)) {
      score += 50;
    }

    queryTokens.forEach(token => {
      if (titleText.includes(token)) score += 10;
      if (authorsText.includes(token)) score += 5;
      if (abstractText.includes(token)) score += 2;
    });

    const citations = Number(item.citationCount || 0);
    const citationBoost = Math.log10(citations + 1) * 2.5;
    score += citationBoost;

    return score;
  };

  // 1. PRIMARY ENGINE: Semantic Scholar API (with independent error handling)
  try {
    const ssOffset = (page - 1) * perPage;
    const ssFields = 'title,authors,year,abstract,citationCount,isOpenAccess,openAccessPdf,externalIds,venue,publicationVenue';
    const ssUrl = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(searchPhrase)}&offset=${ssOffset}&limit=${perPage}&fields=${ssFields}`;

    const ssRes = await fetch(ssUrl);
    if (ssRes.ok) {
      const ssData = await ssRes.json();
      if (ssData && Array.isArray(ssData.data) && ssData.data.length > 0) {
        let parsed = ssData.data.map(item => parseSemanticScholarItem(item, clean));

        // Filter out items with zero query token match
        if (queryTokens.length > 0) {
          const relevant = parsed.filter(item => calculateRelevance(item) > 0);
          if (relevant.length > 0) parsed = relevant;
        }

        if (sortBy === 'citations') {
          parsed.sort((a, b) => (b.citationCount || 0) - (a.citationCount || 0));
        } else if (sortBy === 'newest') {
          parsed.sort((a, b) => (b.publicationYear || 0) - (a.publicationYear || 0));
        } else if (sortBy === 'relevance') {
          parsed.sort((a, b) => calculateRelevance(b) - calculateRelevance(a));
        }

        if (sortBy === 'openaccess') {
          parsed = parsed.filter(p => p.openAccess);
        }

        if (parsed.length > 0) {
          return {
            results: parsed,
            totalCount: ssData.total || parsed.length,
            page,
            perPage,
            totalPages: Math.ceil((ssData.total || parsed.length) / perPage)
          };
        }
      }
    }
  } catch (err) {
    console.warn("Semantic Scholar API call skipped/throttled:", err);
  }

  // 2. SECONDARY ENGINE: OpenAlex API (250M CORS-friendly catalog)
  try {
    let openAlexSort = 'cited_by_count:desc';
    if (sortBy === 'newest') openAlexSort = 'publication_year:desc';
    if (sortBy === 'relevance') openAlexSort = 'relevance_score:desc';

    let openAlexFilters = [];
    if (sortBy === 'openaccess') {
      openAlexFilters.push('is_oa:true');
    }

    const filterStr = openAlexFilters.length > 0 ? `&filter=${openAlexFilters.join(',')}` : '';
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

    const alexRes = await fetch(openAlexUrl);
    if (alexRes.ok) {
      const alexData = await alexRes.json();
      const items = alexData.results || [];
      if (items.length > 0) {
        let parsed = items.map(item => parseOpenAlexItem(item, clean));

        if (queryTokens.length > 0 && !isDoi) {
          const relevant = parsed.filter(item => calculateRelevance(item) > 0);
          if (relevant.length > 0) parsed = relevant;
        }

        if (sortBy === 'relevance') {
          parsed.sort((a, b) => calculateRelevance(b) - calculateRelevance(a));
        }

        return {
          results: parsed,
          totalCount: alexData.meta?.count || parsed.length,
          page,
          perPage,
          totalPages: Math.ceil((alexData.meta?.count || parsed.length) / perPage)
        };
      }
    }
  } catch (err) {
    console.warn("OpenAlex API fallback error:", err);
  }

  // 3. TERTIARY ENGINE: Crossref API
  try {
    let crossrefSort = '&sort=is-referenced-by-count&order=desc';
    if (sortBy === 'newest') crossrefSort = '&sort=published&order=desc';
    if (sortBy === 'relevance') crossrefSort = '&sort=score&order=desc';

    const offset = (page - 1) * perPage;
    const crossrefUrl = `https://api.crossref.org/works?query=${encodeURIComponent(searchPhrase)}&rows=${perPage}&offset=${offset}${crossrefSort}`;
    const crRes = await fetch(crossrefUrl);
    if (crRes.ok) {
      const crData = await crRes.json();
      const crItems = crData.message?.items || [];
      if (crItems.length > 0) {
        let parsed = crItems.map(item => parseCrossrefItem(item, clean));

        if (queryTokens.length > 0) {
          const relevant = parsed.filter(item => calculateRelevance(item) > 0);
          if (relevant.length > 0) parsed = relevant;
        }

        return {
          results: parsed,
          totalCount: crData.message?.['total-results'] || parsed.length,
          page,
          perPage,
          totalPages: Math.ceil((crData.message?.['total-results'] || parsed.length) / perPage)
        };
      }
    }
  } catch (err) {
    console.warn("Crossref API fallback error:", err);
  }

  // 4. FALLBACK: Local Catalog
  const sampleFiltered = SAMPLE_PAPERS.filter(p => {
    if (queryTokens.length === 0) return true;
    const title = p.title.toLowerCase();
    const authors = p.authors.toLowerCase();
    const abstract = p.abstractText.toLowerCase();

    return queryTokens.some(token => 
      title.includes(token) || authors.includes(token) || abstract.includes(token)
    );
  });

  return {
    results: sampleFiltered.slice((page - 1) * perPage, page * perPage),
    totalCount: sampleFiltered.length,
    page,
    perPage,
    totalPages: Math.ceil(sampleFiltered.length / perPage)
  };
}

export function isDirectPdfUrl(urlStr) {
  if (!urlStr) return false;
  try {
    const { pathname } = new URL(urlStr);
    return pathname.toLowerCase().endsWith('.pdf');
  } catch (e) {
    return false;
  }
}

function parseSemanticScholarItem(item, queryClean) {
  const authors = (item.authors || [])
    .slice(0, 5)
    .map(a => a.name)
    .filter(Boolean)
    .join(', ') || 'Scholarly Authors';

  const doi = item.externalIds?.DOI || item.externalIds?.ArXiv || '';
  const pdfUrl = item.openAccessPdf?.url || (item.externalIds?.ArXiv ? `https://arxiv.org/pdf/${item.externalIds.ArXiv}.pdf` : '');
  const venue = item.venue || item.publicationVenue?.name || 'Academic Venue';
  const year = item.year || 2024;

  return {
    title: item.title || 'Untitled Academic Paper',
    authors,
    publicationYear: year,
    journalOrVenue: venue,
    abstractText: item.abstract || `Research paper authored by ${authors} in ${venue} (${year}).`,
    doi: doi || queryClean,
    sourceUrl: doi ? `https://doi.org/${doi}` : `https://www.semanticscholar.org/paper/${item.paperId}`,
    downloadUrl: pdfUrl,
    pdfDomain: extractDomain(pdfUrl || item.externalIds?.ArXiv),
    resourceType: 'Research Paper',
    openAccess: !!item.isOpenAccess || !!pdfUrl,
    citationCount: item.citationCount || 0,
    suggestedCategory: suggestCategory(item.title || '')
  };
}

function parseOpenAlexItem(item, queryClean) {
  const authors = (item.authorships || [])
    .slice(0, 5)
    .map(a => a.author?.display_name)
    .filter(Boolean)
    .join(', ') || 'Scholarly Authors';

  const primaryLoc = item.primary_location || {};
  const journal = primaryLoc.source?.display_name || 'Academic Venue';
  const doi = (item.doi || '').replace('https://doi.org/', '');
  const pdfUrl = item.open_access?.oa_url || item.best_oa_location?.pdf_url || '';

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
    pdfDomain: extractDomain(pdfUrl),
    resourceType: 'Research Paper',
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
    abstractText: item.abstract 
      ? item.abstract.replace(/<[^>]*>?/gm, '') 
      : `Academic paper authored by ${authors} in ${year}.`,
    doi,
    sourceUrl: item.URL || `https://doi.org/${doi}`,
    downloadUrl: pdfUrl,
    pdfDomain: extractDomain(pdfUrl || item.URL),
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
  return map.filter(Boolean).join(' ');
}

function suggestCategory(title) {
  const t = title.toLowerCase();
  if (t.includes('ai') || t.includes('learning') || t.includes('transformer')) return 'Artificial Intelligence';
  if (t.includes('security') || t.includes('crypto')) return 'Cybersecurity';
  if (t.includes('data') || t.includes('graph')) return 'Data Science';
  return 'Computer Science';
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