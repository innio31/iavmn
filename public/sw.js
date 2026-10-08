// public/sw.js
// IAVMN service worker.
// Conservative caching strategy:
//   - Static assets (CSS/JS/images/icons): cache-first, refreshed in background
//   - Public GET pages: network-first with cache fallback
//   - POST requests: never cached
//   - Admin / member / API routes: never cached, always hit network

const CACHE_VERSION = 'iavmn-v1';
const STATIC_CACHE = CACHE_VERSION + '-static';
const RUNTIME_CACHE = CACHE_VERSION + '-runtime';

// ─── Files to pre-cache on install ───────────────────────
// Keep this list small — only truly static, always-available assets.
const PRECACHE_URLS = [
  '/css/theme.css',
  '/css/responsive-helpers.css',
  '/js/search-overlay.js',
  '/site.webmanifest',
  '/uploads/branding/favicon.ico',
  '/uploads/branding/favicon-32x32.png',
  '/uploads/branding/favicon-16x16.png',
  '/uploads/branding/apple-touch-icon.png',
  '/uploads/branding/android-chrome-192x192.png',
  '/uploads/branding/android-chrome-512x512.png',
];

// ─── URLs we never cache (dynamic, private, or transactional) ───
const NEVER_CACHE_PATTERNS = [
  /^\/admin(\/|$)/,
  /^\/member(\/|$)/,
  /^\/login(\/|$)/,
  /^\/logout(\/|$)/,
  /^\/setup(\/|$)/,
  /^\/forgot-password(\/|$)/,
  /^\/reset-password(\/|$)/,
  /^\/webhooks(\/|$)/,
  /^\/healthz(\/|$)/,
  /^\/subscribe(\/|$)/,
  /^\/contact(\/|$)/,
  /^\/membership\/apply(\/|$)/,
  /^\/search(\/|$)/,
];

// ─── Install ─────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(STATIC_CACHE);
        // Use individual adds so one 404 doesn't abort the whole install
        await Promise.all(
          PRECACHE_URLS.map((url) =>
            cache.add(url).catch((err) => {
              // Non-fatal — the asset just won't be precached
              console.warn('[sw] precache failed:', url, err.message);
            })
          )
        );
      } catch (err) {
        console.warn('[sw] install cache failed:', err.message);
      }
      // Activate immediately (don't wait for old tabs to close)
      await self.skipWaiting();
    })()
  );
});

// ─── Activate ────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Delete old cache versions
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => !k.startsWith(CACHE_VERSION))
          .map((k) => caches.delete(k))
      );
      // Take control of open clients
      await self.clients.claim();
    })()
  );
});

// ─── Fetch ───────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle GET requests
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  const path = url.pathname;

  // Never cache private/dynamic/admin paths
  if (NEVER_CACHE_PATTERNS.some((re) => re.test(path))) {
    return; // let the browser handle it — always hits network
  }

  // Static assets: cache-first
  if (isStaticAsset(path)) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // Everything else (public HTML pages): network-first with cache fallback
  event.respondWith(networkFirst(req));
});

// ─── Helpers ─────────────────────────────────────────────

function isStaticAsset(path) {
  return (
    path.startsWith('/css/') ||
    path.startsWith('/js/') ||
    path.startsWith('/uploads/branding/') ||
    /\.(css|js|png|jpg|jpeg|webp|gif|svg|ico|woff2?|ttf|eot)$/i.test(path)
  );
}

async function cacheFirst(req) {
  try {
    const cache = await caches.open(STATIC_CACHE);
    const cached = await cache.match(req);
    if (cached) {
      // Refresh in the background (stale-while-revalidate)
      event_safe_revalidate(req, cache);
      return cached;
    }
    const res = await fetch(req);
    if (res && res.ok) {
      cache.put(req, res.clone());
    }
    return res;
  } catch (err) {
    // Fall back to a cached copy if the network is down
    const cache = await caches.open(STATIC_CACHE);
    const cached = await cache.match(req);
    if (cached) return cached;
    throw err;
  }
}

async function networkFirst(req) {
  try {
    const res = await fetch(req);
    // Cache only successful HTML responses for public pages
    if (res && res.ok && isHtmlResponse(res)) {
      try {
        const cache = await caches.open(RUNTIME_CACHE);
        cache.put(req, res.clone());
      } catch (e) {
        // ignore cache write failures
      }
    }
    return res;
  } catch (err) {
    // Network failed — try cache for HTML
    const cache = await caches.open(RUNTIME_CACHE);
    const cached = await cache.match(req);
    if (cached) return cached;

    // Final fallback: a minimal offline message
    return new Response(
      '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Offline</title></head>' +
      '<body style="font-family:sans-serif;text-align:center;padding:60px 20px;">' +
      '<h1 style="color:#25573f">You are offline</h1>' +
      '<p>Please check your internet connection and try again.</p>' +
      '</body></html>',
      {
        status: 503,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }
    );
  }
}

function isHtmlResponse(res) {
  const ct = res.headers.get('content-type') || '';
  return ct.includes('text/html');
}

// ─── Background revalidation (used by cacheFirst) ────────
// Note: this helper is only called inside respondWith handlers, so
// we pass the request/cache directly.
async function event_safe_revalidate(req, cache) {
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.ok) {
      cache.put(req, fresh.clone());
    }
  } catch (err) {
    // Ignore — stale cache is fine
  }
}