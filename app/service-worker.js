// ============================================================
//  COBRIKA — Service Worker
//  service-worker.js — Modo offline y cache
// ============================================================

const CACHE_NAME    = 'cobrika-v1';
const CACHE_STATIC  = 'cobrika-static-v1';

// Archivos a cachear para modo offline
const ARCHIVOS_OFFLINE = [
  '/cobrika/',
  '/cobrika/index.html',
  '/cobrika/app/index.html',
  '/cobrika/app/login.html',
  '/cobrika/app/voucher/index.html',
  '/cobrika/assets/css/main.css',
  '/cobrika/assets/css/app.css',
  '/cobrika/shared/supabase-client.js',
  '/cobrika/shared/auth.js',
  '/cobrika/shared/helpers.js',
  '/cobrika/manifest.json',
];

// ── Instalar: cachear archivos estáticos ──────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_STATIC).then(cache => {
      console.log('[SW] Cacheando archivos offline');
      return cache.addAll(ARCHIVOS_OFFLINE.map(url => new Request(url, { cache: 'reload' }))).catch(err => {
        console.warn('[SW] Algunos archivos no se pudieron cachear:', err);
      });
    })
  );
  self.skipWaiting();
});

// ── Activar: limpiar caches viejos ────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME && k !== CACHE_STATIC)
            .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: estrategia Network First con fallback a cache ──
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // No interceptar peticiones a Supabase ni CDN externas
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('jsdelivr.net') ||
    url.hostname.includes('cdnjs.cloudflare.com') ||
    url.hostname.includes('fonts.googleapis.com') ||
    request.method !== 'GET'
  ) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then(response => {
        // Si la respuesta es válida, cachearla
        if (response && response.status === 200 && response.type === 'basic') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, responseClone));
        }
        return response;
      })
      .catch(() => {
        // Sin internet: servir desde cache
        return caches.match(request).then(cached => {
          if (cached) return cached;
          // Fallback a la página principal offline
          if (request.headers.get('accept')?.includes('text/html')) {
            return caches.match('/cobrika/app/index.html');
          }
        });
      })
  );
});

// ── Background Sync: enviar vouchers pendientes ───────────
self.addEventListener('sync', event => {
  if (event.tag === 'sync-vouchers') {
    event.waitUntil(sincronizarVouchers());
  }
});

async function sincronizarVouchers() {
  // Los vouchers guardados offline se enviarán cuando haya conexión
  console.log('[SW] Sincronizando vouchers pendientes...');
}

// ── Push notifications ────────────────────────────────────
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'Cobrika', {
      body:  data.body  || 'Tienes una notificación',
      icon:  '/cobrika/assets/icons/icon-192.png',
      badge: '/cobrika/assets/icons/icon-192.png',
      data:  data.url ? { url: data.url } : {},
      actions: data.actions || [],
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.notification.data?.url) {
    event.waitUntil(clients.openWindow(event.notification.data.url));
  }
});
