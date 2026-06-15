/* =====================================================
   sw.js — Service Worker do Shorti (PWA)
   Estratégia: network-first para o app shell, com cache
   como fallback offline. Não intercepta chamadas de fora
   da própria origem (Supabase, CDNs) para não interferir
   na sincronização de dados.
   ===================================================== */
const CACHE = 'shorti-v1';
const SHELL = [
  './erp.html',
  './login.html',
  './core.js',
  './erp.css',
  './styles.css',
  './manifest.json',
  './favicon.svg',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
