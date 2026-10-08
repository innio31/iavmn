// src/controllers/sitemapController.js
// Generates an XML sitemap of public pages.

import { listTiers } from '../models/tierModel.js';
import { listMembers } from '../models/councilModel.js';
import { listPosts } from '../models/postModel.js';
import { listPages } from '../models/pageModel.js';
import { getAllSettings } from '../models/settingsModel.js';

const escapeXml = (str) => {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

export const renderSitemap = async (req, res) => {
  const settings = await getAllSettings();
  const appUrl = (settings.app_url || process.env.APP_URL || '').replace(/\/$/, '') || 'http://localhost:3000';

  const [tiers, members, posts, pages] = await Promise.all([
    listTiers(true),
    listMembers(true),
    listPosts({ publishedOnly: true }),
    listPages(true),
  ]);

  // Static routes
  const urls = [
    { loc: '/',          changefreq: 'weekly',  priority: '1.0' },
    { loc: '/about',     changefreq: 'monthly', priority: '0.7' },
    { loc: '/council-members', changefreq: 'monthly', priority: '0.8' },
    { loc: '/membership', changefreq: 'monthly', priority: '0.9' },
    { loc: '/news',      changefreq: 'weekly',  priority: '0.8' },
    { loc: '/faq',       changefreq: 'monthly', priority: '0.6' },
    { loc: '/contact',   changefreq: 'yearly',  priority: '0.5' },
  ];

  // Membership tiers
  tiers.forEach((t) => {
    urls.push({ loc: '/membership/' + t.slug, changefreq: 'monthly', priority: '0.8' });
  });

  // Council members
  members.forEach((m) => {
    urls.push({ loc: '/council-members/' + m.slug, changefreq: 'yearly', priority: '0.6' });
  });

  // Posts (with lastmod)
  posts.forEach((p) => {
    urls.push({
      loc: '/news/' + p.slug,
      changefreq: 'monthly',
      priority: '0.7',
      lastmod: p.updated_at ? new Date(p.updated_at).toISOString() : null,
    });
  });

  // Pages (excluding ones already covered by static routes)
  const staticSlugs = new Set(['about', 'contact', 'membership', 'faq', 'council-members']);
  pages.forEach((p) => {
    if (staticSlugs.has(p.slug)) return;
    urls.push({
      loc: '/' + p.slug,
      changefreq: 'monthly',
      priority: '0.6',
      lastmod: p.updated_at ? new Date(p.updated_at).toISOString() : null,
    });
  });

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.render('sitemap', {
    layout: false, // render raw
    urls,
    appUrl,
    escapeXml,
  });
};