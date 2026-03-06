const APP_NAME = "jabin-crm";

const STATIC_CACHE_NAME = `${APP_NAME}-static-v1`;
const DYNAMIC_CACHE_NAME = `${APP_NAME}-dynamic-v1`;

const STATIC_ASSETS = [
  "/",
  "/dashboard",
  "/dashboard/leads",
  "/dashboard/emails",
  "/dashboard/calendar",
  "/dashboard/sequences",
  "/dashboard/tasks",
  "/dashboard/deals",
  "/manifest.json"
];

/* ---------------- INSTALL ---------------- */

self.addEventListener("install", (event) => {
  console.log("[Jabin CRM SW] Installing...");

  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      console.log("[Jabin CRM SW] Caching static assets");
      return cache.addAll(STATIC_ASSETS);
    })
  );

  self.skipWaiting();
});

/* ---------------- ACTIVATE ---------------- */

self.addEventListener("activate", (event) => {
  console.log("[Jabin CRM SW] Activating...");

  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (
            key !== STATIC_CACHE_NAME &&
            key !== DYNAMIC_CACHE_NAME
          ) {
            console.log("[Jabin CRM SW] Removing old cache:", key);
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

  /* -------- API REQUESTS (Network First) -------- */

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();

          caches.open(DYNAMIC_CACHE_NAME).then((cache) => {
            cache.put(request, clone);
          });

          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;

          return new Response(
            JSON.stringify({ error: "Offline - data unavailable" }),
            {
              status: 503,
              headers: { "Content-Type": "application/json" }
            }
          );
        })
    );

    return;
  }

  /* -------- PAGE NAVIGATION (Network First) -------- */

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();

          caches.open(DYNAMIC_CACHE_NAME).then((cache) => {
            cache.put(request, clone);
          });

          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;

          return caches.match("/");
        })
    );

    return;
  }

  /* -------- STATIC ASSETS (Cache First) -------- */

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        const clone = response.clone();

        caches.open(DYNAMIC_CACHE_NAME).then((cache) => {
          cache.put(request, clone);
        });

        return response;
      });
    })
  );
});

/* ---------------- BACKGROUND SYNC ---------------- */

self.addEventListener("sync", (event) => {
  if (event.tag === "sync-leads") {
    event.waitUntil(syncLeads());
  }
});

async function syncLeads() {
  try {
    console.log("[Jabin CRM SW] Syncing leads...");
    // implement IndexedDB syncing logic here
  } catch (error) {
    console.error("[Jabin CRM SW] Sync failed:", error);
  }
}

/* ---------------- PUSH NOTIFICATIONS ---------------- */

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};

  const title = data.title || "Jabin CRM";

  const options = {
    body: data.body || "You have a new notification",
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-72x72.png",
    vibrate: [200, 100, 200],
    data: {
      url: data.url || "/dashboard"
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

/* ---------------- NOTIFICATION CLICK ---------------- */

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    clients.openWindow(event.notification.data.url || "/dashboard")
  );
});