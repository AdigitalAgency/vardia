/**
 * Vardia service worker.
 * Δύο δουλειές: (α) ο εργαζόμενος να βλέπει το ωράριό του χωρίς σήμα, (β) push.
 * Δεν κάνει offline editing — οι αλλαγές του owner θέλουν δίκτυο (PM §1.2-U4).
 */

const CACHE = "vardia-v1";
const APP_SHELL = ["/app", "/login"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Τα δεδομένα (Supabase) δεν περνούν από εδώ· μόνο σελίδες/assets.
  if (url.pathname.startsWith("/api/")) return;

  // Network-first: πάντα φρέσκα όταν υπάρχει σήμα, cache όταν δεν υπάρχει.
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && request.mode === "navigate") {
          const copy = response.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match("/app")))
  );
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = data.title || "Vardia";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "Το πρόγραμμά σου ενημερώθηκε.",
      icon: "/icon.svg",
      badge: "/icon.svg",
      tag: data.tag || "vardia-schedule",
      renotify: true,
      data: { url: data.url || "/app" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/app";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(target) && "focus" in client) return client.focus();
      }
      return self.clients.openWindow(target);
    })
  );
});
