// Service worker: lets the app open with no internet connection.
// When online it always loads the newest version; when offline it uses
// the copy saved on the phone. Change VERSION after big updates.
const VERSION = 'life-tracker-v51';
const FILES = [
  './',
  'index.html',
  'css/styles.css',
  'js/app.js',
  'js/store.js',
  'js/dates.js',
  'js/ui.js',
  'js/forms.js',
  'js/home.js',
  'js/projects.js',
  'js/goals.js',
  'js/lists.js',
  'js/more.js',
  'js/scene.js',
  'js/ku.js',
  'js/vendor/Sortable.min.js',
  'manifest.webmanifest',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  // Always ask the server for the newest file (not the phone's web cache).
  const req = event.request.mode === 'navigate' ? event.request : new Request(event.request, { cache: 'no-cache' });
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && new URL(event.request.url).origin === location.origin) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(event.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(event.request, { ignoreSearch: true })
        .then((hit) => hit || caches.match('index.html')))
  );
});
