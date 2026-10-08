// src/middleware/loadSettings.js
// Loads all site settings once per request and exposes them as res.locals.settings.
// A tiny in-memory cache avoids hitting the DB on every request.

import { getAllSettings } from '../models/settingsModel.js';

const CACHE_TTL_MS = 60 * 1000; // 1 minute
let cache = { data: null, loadedAt: 0 };

/**
 * Invalidate the cache — call this after an admin saves settings
 * so changes appear immediately.
 */
export const clearSettingsCache = () => {
  cache = { data: null, loadedAt: 0 };
};

const loadSettings = async (req, res, next) => {
  try {
    const now = Date.now();
    if (!cache.data || now - cache.loadedAt > CACHE_TTL_MS) {
      cache.data = await getAllSettings();
      cache.loadedAt = now;
    }
    res.locals.settings = cache.data;
    next();
  } catch (err) {
    // Don't kill the request if settings fail — just log and continue with empty object
    console.error('[loadSettings] failed:', err.message);
    res.locals.settings = {};
    next();
  }
};

export default loadSettings;