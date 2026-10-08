// src/middleware/loadMenuPages.js
// Loads pages marked "show in menu" once per request, exposes them as res.locals.menuPages.
// Uses a short in-memory cache so it doesn't hit the DB on every request.

import { listPagesInMenu } from '../models/pageModel.js';

const CACHE_TTL_MS = 60 * 1000; // 1 minute
let cache = { data: null, loadedAt: 0 };

/**
 * Invalidate the menu cache — call this after an admin saves/publishes/unpublishes a page
 * so menu changes appear immediately.
 */
export const clearMenuPagesCache = () => {
  cache = { data: null, loadedAt: 0 };
};

const loadMenuPages = async (req, res, next) => {
  try {
    const now = Date.now();
    if (!cache.data || now - cache.loadedAt > CACHE_TTL_MS) {
      cache.data = await listPagesInMenu();
      cache.loadedAt = now;
    }
    res.locals.menuPages = cache.data;
    next();
  } catch (err) {
    console.error('[loadMenuPages] failed:', err.message);
    res.locals.menuPages = [];
    next();
  }
};

export default loadMenuPages;