const APP_NAME = "jabin-crm";

const STATIC_CACHE_NAME = `${APP_NAME}-static-v3`;
const DYNAMIC_CACHE_NAME = `${APP_NAME}-dynamic-v3`;

const STATIC_ASSETS = ["/", "/manifest.json"];

/* ---------------- INSTALL ---------------- */

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

/* ---------------- ACTIVATE ---------------- */

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== STATIC_CACHE_NAME && key !== DYNAMIC_CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

/* ---------------- FETCH ---------------- */

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never intercept cross-origin (QR APIs, CDNs, etc.) — CSP + opaque responses break otherwise
  if (url.origin !== self.location.origin) return;

  // Next.js internals / RSC / HMR: network only, no cache
  if (
    url.pathname.startsWith("/_next/") ||
    url.searchParams.has("_rsc") ||
    url.pathname.startsWith("/__nextjs")
  ) {
    event.respondWith(fetch(request));
    return;
  }

  /* -------- API REQUESTS (Network First) -------- */
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && response.status === 200) {
            const clone = response.clone();
            caches.open(DYNAMIC_CACHE_NAME).then((cache) => {
              cache.put(request, clone).catch(() => {});
            });
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          return new Response(JSON.stringify({ error: "Offline - data unavailable" }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          });
        })
    );
    return;
  }

  /* -------- PAGE NAVIGATION (Network First) -------- */
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(DYNAMIC_CACHE_NAME).then((cache) => {
              cache.put(request, clone).catch(() => {});
            });
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          return (
            (await caches.match("/")) ||
            new Response("Offline", { status: 503, statusText: "Offline" })
          );
        })
    );
    return;
  }

  /* -------- SAME-ORIGIN ASSETS (Cache First, safe fallback) -------- */
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(DYNAMIC_CACHE_NAME).then((cache) => {
              cache.put(request, clone).catch(() => {});
            });
          }
          return response;
        })
        .catch(
          () =>
            new Response("", {
              status: 504,
              statusText: "Gateway Timeout",
            })
        );
    })
  );
});

/* ---------------- PUSH NOTIFICATIONS ---------------- */

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "Jabin CRM";
  const options = {
    body: data.body || "You have a new notification",
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-72x72.png",
    vibrate: [200, 100, 200],
    data: { url: data.url || "/dashboard" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url || "/dashboard"));
});
