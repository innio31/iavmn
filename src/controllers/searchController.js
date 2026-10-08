// src/controllers/searchController.js
// Public search across posts, pages, FAQs, council members, and tiers.

import { searchAll, sanitizeSearchTerm } from '../models/searchModel.js';

// ─── Helpers ────────────────────────────────────────────

/**
 * Build a short plain-text preview from a longer body.
 * Strips HTML tags and trims to a length.
 */
const makePreview = (text, maxLength = 180) => {
  if (!text) return '';
  const plain = String(text)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  if (plain.length <= maxLength) return plain;
  return plain.slice(0, maxLength).replace(/\s+\S*$/, '') + '…';
};

/**
 * Find the first occurrence of the term in the body and return a snippet
 * around it. Falls back to a preview from the start.
 */
const makeSnippet = (body, term, maxLength = 220) => {
  if (!body) return '';
  const plain = String(body)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

  if (!term) return makePreview(plain, maxLength);

  const idx = plain.toLowerCase().indexOf(term.toLowerCase());
  if (idx === -1) return makePreview(plain, maxLength);

  const start = Math.max(0, idx - 80);
  const end = Math.min(plain.length, idx + term.length + 120);
  let snippet = plain.slice(start, end);

  if (start > 0) snippet = '…' + snippet;
  if (end < plain.length) snippet = snippet + '…';

  return snippet;
};

/**
 * Escape a string for HTML output.
 * Used by the view to safely render previews.
 */
const escapeHtml = (s) => String(s || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

// ─── GET /search ────────────────────────────────────────

export const showSearchPage = async (req, res) => {
  const rawQuery = typeof req.query.q === 'string' ? req.query.q : '';
  const term = sanitizeSearchTerm(rawQuery);

  let results = {
    term: '',
    posts: [],
    pages: [],
    faqs: [],
    council: [],
    tiers: [],
    totalCount: 0,
  };

  if (term) {
    const searchResults = await searchAll(term);

    // Enrich each result with a snippet/preview
    const enrichPost = (p) => ({
      ...p,
      snippet: makeSnippet(p.body || '', term),
      url: `/news/${p.slug}`,
    });

    const enrichPage = (p) => ({
      ...p,
      snippet: makeSnippet(p.content || '', term),
      url: `/${p.slug}`,
    });

    const enrichFaq = (f) => ({
      ...f,
      snippet: makeSnippet(f.answer || '', term),
      url: `/faq#faq-${f.id}`,
    });

    const enrichCouncil = (c) => ({
      ...c,
      snippet: makeSnippet(c.bio_short || '', term) || makePreview(c.job_title || '', 120),
      url: `/council-members/${c.slug}`,
    });

    const enrichTier = (t) => ({
      ...t,
      snippet: makeSnippet(t.short_description || '', term),
      url: `/membership/${t.slug}`,
    });

    results = {
      term,
      posts: searchResults.posts.map(enrichPost),
      pages: searchResults.pages.map(enrichPage),
      faqs: searchResults.faqs.map(enrichFaq),
      council: searchResults.council.map(enrichCouncil),
      tiers: searchResults.tiers.map(enrichTier),
      totalCount: searchResults.totalCount,
    };
  }

  res.render('search', {
    title: term ? `Search results for "${rawQuery}"` : 'Search',
    rawQuery,
    results,
    escapeHtml,
  });
};

// ─── GET /search/suggest (JSON) ─────────────────────────
// Lightweight endpoint for as-you-type suggestions.
// Returns a small set of the top matching items.

export const suggestSearch = async (req, res) => {
  const rawQuery = typeof req.query.q === 'string' ? req.query.q : '';
  const term = sanitizeSearchTerm(rawQuery);

  if (!term || term.length < 2) {
    return res.json({ query: rawQuery, results: [] });
  }

  try {
    const r = await searchAll(term);
    const results = [];

    // Posts (up to 4)
    r.posts.slice(0, 4).forEach((p) => {
      results.push({
        type: 'post',
        label: p.title,
        sub: p.excerpt ? p.excerpt.slice(0, 100) : '',
        url: `/news/${p.slug}`,
      });
    });

    // Pages (up to 3)
    r.pages.slice(0, 3).forEach((p) => {
      results.push({
        type: 'page',
        label: p.title,
        sub: p.meta_description ? p.meta_description.slice(0, 100) : '',
        url: `/${p.slug}`,
      });
    });

    // Council members (up to 3)
    r.council.slice(0, 3).forEach((c) => {
      results.push({
        type: 'council',
        label: c.full_name,
        sub: c.job_title || '',
        url: `/council-members/${c.slug}`,
      });
    });

    // FAQs (up to 3)
    r.faqs.slice(0, 3).forEach((f) => {
      results.push({
        type: 'faq',
        label: f.question,
        sub: '',
        url: `/faq#faq-${f.id}`,
      });
    });

    // Tiers (up to 3)
    r.tiers.slice(0, 3).forEach((t) => {
      results.push({
        type: 'tier',
        label: t.name,
        sub: t.short_description || '',
        url: `/membership/${t.slug}`,
      });
    });

    // Cap total suggestions at 10
    const capped = results.slice(0, 10);

    return res.json({
      query: rawQuery,
      count: r.totalCount,
      results: capped,
    });
  } catch (err) {
    console.error('[search suggest] failed:', err.message);
    return res.status(500).json({ error: 'Search failed' });
  }
};