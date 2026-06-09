// Recipe App — Service Worker
// Strategy: Manual SW with Cache Storage API — zero external dependencies
// Caching strategy follows routes (see brainstromer spec 2026-06-10)

const CACHE_VERSION = 'v1';
const STATIC_CACHE = `recipe-static-${CACHE_VERSION}`;
const API_CACHE = `recipe-api-${CACHE_VERSION}`;
const IMAGE_CACHE = `recipe-images-${CACHE_VERSION}`;
const PAGE_CACHE = `recipe-pages-${CACHE_VERSION}`;

// Assets to precache at install time
const PRECACHE_ASSETS = [
  '/manifest.json',
  // Next.js static JS/CSS is cached on-demand via CacheFirst in fetch handler
];

// ─── Install ────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  // Activate immediately — don't wait for old SW to close
  self.skipWaiting();
});

// ─── Activate ───────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== STATIC_CACHE && name !== API_CACHE && name !== IMAGE_CACHE && name !== PAGE_CACHE)
          .map((name) => caches.delete(name))
      );
    })
  );
  // Take control of all clients immediately
  self.clients.claim();
});

// ─── Fetch ──────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // Special: skip auth API calls (sensitive)
  if (url.pathname.startsWith('/api/auth/')) return;
  if (url.pathname.startsWith('/api/admin/')) return;

  // Next.js static assets — CacheFirst (immutable, content-hashed)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, STATIC_CACHE, 365 * 24 * 60 * 60 * 1000));
    return;
  }

  // Font files — CacheFirst
  if (url.pathname.match(/\.(woff2?|ttf|otf|eot)$/)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE, 365 * 24 * 60 * 60 * 1000));
    return;
  }

  // PWA manifest — NetworkFirst (rarely changes)
  if (url.pathname === '/manifest.json' || url.pathname === '/sw.js') {
    event.respondWith(networkFirst(request, STATIC_CACHE, 0));
    return;
  }

  // Recipe photos / uploads — StaleWhileRevalidate (large, stale is fine)
  if (url.pathname.startsWith('/uploads/') || url.pathname.startsWith('/api/uploads/')) {
    event.respondWith(staleWhileRevalidate(request, IMAGE_CACHE, 30 * 24 * 60 * 60 * 1000));
    return;
  }

  // Recipe API — NetworkFirst, 7d stale
  if (url.pathname.startsWith('/api/recipes/') && request.method === 'GET') {
    event.respondWith(networkFirst(request, API_CACHE, 7 * 24 * 60 * 60 * 1000));
    return;
  }

  // Meal plan API — NetworkFirst, 1d stale
  if (url.pathname.startsWith('/api/meal-plans/') && request.method === 'GET') {
    event.respondWith(networkFirst(request, API_CACHE, 24 * 60 * 60 * 1000));
    return;
  }

  // Navigation pages — NetworkFirst, 1h stale
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, PAGE_CACHE, 60 * 60 * 1000));
    return;
  }

  // Everything else — NetworkFirst (fast fallback to cache)
  event.respondWith(networkFirst(request, PAGE_CACHE, 60 * 60 * 1000));
});

// ─── Cache Strategies ───────────────────────────────────────────────────────

async function cacheFirst(request, cacheName, maxAge) {
  const cached = await caches.open(cacheName).then((cache) => cache.match(request));
  if (cached) {
    if (maxAge > 0) {
      const cachedTime = new Date(cached.headers.get('date') || 0).getTime();
      if (Date.now() - cachedTime > maxAge) {
        // Stale — fetch fresh in background
        fetchAndCache(request, cacheName);
      }
    }
    return cached;
  }
  return fetchAndCache(request, cacheName);
}

async function networkFirst(request, cacheName, maxAge) {
  try {
    const response = await fetchAndCache(request, cacheName);
    return response;
  } catch (err) {
    const cached = await caches.open(cacheName).then((cache) => cache.match(request));
    if (cached) return cached;

    // If request is a navigation, serve the cached dashboard or login as fallback
    if (request.mode === 'navigate') {
      const fallback = await caches.open(PAGE_CACHE).then((cache) => cache.match('/dashboard'));
      if (fallback) return fallback;
    }

    throw err;
  }
}

async function staleWhileRevalidate(request, cacheName, maxAge) {
  const cached = await caches.open(cacheName).then((cache) => cache.match(request));
  // Revalidate in background (don't wait)
  const fetchPromise = fetchAndCache(request, cacheName);
  if (cached) {
    // Return stale immediately if it's not too old
    const cachedTime = new Date(cached.headers.get('date') || 0).getTime();
    if (maxAge <= 0 || Date.now() - cachedTime <= maxAge) {
      return cached;
    }
  }
  // No cache or too stale — wait for network
  return fetchPromise;
}

async function fetchAndCache(request, cacheName) {
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(cacheName);
    // Avoid caching opaque responses or non-GET
    if (request.method === 'GET') {
      cache.put(request, response.clone());
    }
  }
  return response;
}

// ─── Message Handling ───────────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
