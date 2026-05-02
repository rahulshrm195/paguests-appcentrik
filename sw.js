// ============================================================
// sw.js — Service Worker
// PA Guest Tracker
// ============================================================

const CACHE_NAME = "pa-guest-tracker-v1";

// Files to cache for offline use
const PRECACHE_ASSETS = [
  "/",
  "/index.html",
  "/app.js",
  "/firebase.js",
  "/i18n.js",
  "/styles/app.css",
  "/manifest.json",
  "/pages/register-guest.js",
  "/pages/dashboard.js",
  "/pages/guests.js",
  "/pages/guest-detail.js",
  "/pages/meetings.js",
  "/pages/attendance.js",
  "/pages/chapters.js",
  "/pages/users.js",
];

// ── Install ───────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  self.skipWaiting();
});

// ── Activate ──────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch ─────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip Firebase / external requests — always go to network
  if (
    url.hostname.includes("firebaseapp.com") ||
    url.hostname.includes("googleapis.com") ||
    url.hostname.includes("gstatic.com") ||
    url.hostname.includes("firestore.googleapis.com")
  ) {
    return;
  }

  // For app assets: cache-first, fall back to network
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((response) => {
          // Cache successful GET responses for app assets
          if (
            request.method === "GET" &&
            response.status === 200 &&
            url.origin === self.location.origin
          ) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          // Offline fallback: return index.html for navigation requests
          if (request.mode === "navigate") {
            return caches.match("/index.html");
          }
        });
    })
  );
});
