// Familienplaner — minimaler Service Worker.
//
// Er hält die statischen Dateien vor und beantwortet Push-Nachrichten. Was er
// bewusst NICHT mehr tut: fertige Seiten zwischenspeichern.
//
// Das tat er, damit die installierte PWA auch ohne Netz startet — und hat
// dafür einen weißen Bildschirm erzeugt. Der Weg dorthin: Eine Navigation
// während eines Ausrollens scheitert, der Worker liefert die gespeicherte
// Seite von vorhin, und die trägt die Kennung des alten Builds. Der neue
// Server kennt sie nicht, die Nachladeanfragen laufen ins Leere, und übrig
// bleibt „Application error: a client-side exception has occurred".
//
// Das war ein schlechter Tausch. Ohne Server kann diese App ohnehin nichts
// zeigen — alle Seiten werden bei jeder Anfrage gerechnet. Ein Start ohne Netz
// führte also bestenfalls in eine leere Hülle. Jetzt sagt sie stattdessen,
// dass keine Verbindung da ist.
//
// Die statischen Dateien bleiben im Cache: Ihre Namen tragen einen Abdruck des
// Inhalts, eine alte Datei kann deshalb nie für eine neue gehalten werden.

const CACHE = "fp-shell-v2";
const SHELL = ["/manifest.webmanifest", "/icons/icon-192.png"];

const OHNE_NETZ = `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Keine Verbindung</title>
<style>body{margin:0;display:grid;place-items:center;min-height:100dvh;
background:#f2ede4;color:#1b2431;font:16px/1.5 -apple-system,system-ui,sans-serif;
padding:2rem;text-align:center}p{max-width:22rem}</style></head><body>
<p><strong>Keine Verbindung.</strong><br>Der Plan liegt auf dem Server —
sobald du wieder online bist, ist er da.</p></body></html>`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Network-first für Navigationen (frische Daten), Cache-Fallback wenn offline.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  if (request.mode === "navigate") {
    /*
     * Immer frisch vom Server, und im Zweifel gar nichts.
     *
     * Eine gespeicherte Seite von vorhin trägt die Kennung eines Builds, den
     * es nicht mehr gibt — daraus wird kein „die App startet auch offline",
     * sondern ein weißer Bildschirm mit einer Ausnahme in der Konsole.
     */
    event.respondWith(
      fetch(request).catch(
        () =>
          new Response(OHNE_NETZ, {
            status: 503,
            headers: { "Content-Type": "text/html; charset=utf-8" },
          }),
      ),
    );
    return;
  }

  // Statische Assets: cache-first.
  if (request.url.includes("/_next/static") || request.url.includes("/icons/")) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(request, copy));
        return res;
      })),
    );
  }
});

// --- Web Push ---
self.addEventListener("push", (event) => {
  let data = { title: "Plan", body: "", url: "/", tag: undefined };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    if (event.data) data.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
