// public/sw.js
// Service Worker para Sentra Visión — PWA Offline-First
// Cache estratégico para funcionar sin internet

const CACHE_NAME = 'sentra-vision-v3';
const RUNTIME_CACHE = 'sentra-vision-runtime';

// Recursos a cachear al instalar
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png'
];

// Recursos que no deben cachearse (CDN, externos)
const EXTERNAL_URLS = [
  'cdn.jsdelivr.net',
  'fonts.googleapis.com',
  'fonts.gstatic.com'
];

// ============================================================
// INSTALACIÓN — Precache de assets críticos
// ============================================================

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Cacheando assets críticos');
        return cache.addAll(PRECACHE_URLS)
          .catch((err) => {
            console.warn('[SW] Error al cachear algunos archivos:', err);
          });
      })
      .then(() => self.skipWaiting())
  );
});

// ============================================================
// ACTIVACIÓN — Limpiar caches antiguos
// ============================================================

self.addEventListener('activate', (event) => {
  const currentCaches = [CACHE_NAME, RUNTIME_CACHE];
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return cacheNames.filter(
          (cacheName) => !currentCaches.includes(cacheName)
        );
      })
      .then((cachesToDelete) => {
        return Promise.all(
          cachesToDelete.map((cacheToDelete) => {
            console.log('[SW] Eliminando cache antiguo:', cacheToDelete);
            return caches.delete(cacheToDelete);
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// ============================================================
// FETCH — Estrategia de cache (Offline-First)
// ============================================================

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Si la URL es externa, pasar directamente (sin cache)
  if (EXTERNAL_URLS.some(external => url.hostname.includes(external))) {
    event.respondWith(fetch(request));
    return;
  }

  // Si es una solicitud de navegación (HTML), usar cache-first
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match(request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return fetch(request)
            .then((networkResponse) => {
              // Cachear la respuesta para futuras navegaciones
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME)
                .then((cache) => {
                  cache.put(request, responseClone);
                });
              return networkResponse;
            })
            .catch(() => {
              // Si falla, devolver el index.html cacheado
              return caches.match('/index.html');
            });
        })
    );
    return;
  }

  // Para otros recursos (JS, CSS, imágenes) usar network-first con fallback a cache
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        // Si la respuesta es válida, cachearla para futuras
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(RUNTIME_CACHE)
            .then((cache) => {
              cache.put(request, responseClone);
            });
        }
        return networkResponse;
      })
      .catch(() => {
        // Si falla la red, buscar en cache
        return caches.match(request)
          .then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Si no está en cache, devolver respuesta offline
            return new Response('Recurso no disponible offline', {
              status: 503,
              statusText: 'Service Unavailable'
            });
          });
      })
  );
});

// ============================================================
// MENSAJES — Sincronización y notificaciones
// ============================================================

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME);
    caches.delete(RUNTIME_CACHE);
    event.ports[0].postMessage({ success: true });
  }
});

// ============================================================
// SYNC — Sincronización en segundo plano (cuando vuelva internet)
// ============================================================

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-evolis') {
    event.waitUntil(syncEvolisEvents());
  }
});

async function syncEvolisEvents() {
  try {
    // Aquí se sincronizarían los eventos de EVOLIS pendientes
    // con el servidor cuando vuelva la conexión
    console.log('[SW] Sincronizando eventos EVOLIS...');
    // const client = await clients.openWindow('/');
    // client.postMessage({ type: 'SYNC_EVOLIS' });
  } catch (error) {
    console.error('[SW] Error al sincronizar EVOLIS:', error);
  }
}

// ============================================================
// PUSH — Notificaciones push
// ============================================================

self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const options = {
      body: data.body || 'Sentra Visión alerta',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200],
      data: data.data || {},
      actions: [
        { action: 'open', title: 'Abrir' },
        { action: 'dismiss', title: 'Cerrar' }
      ]
    };

    event.waitUntil(
      self.registration.showNotification(
        data.title || 'Sentra Visión',
        options
      )
    );
  } catch (error) {
    console.error('[SW] Error al mostrar notificación:', error);
  }
});

// ============================================================
// NOTIFICATION CLICK — Manejo de clics en notificaciones
// ============================================================

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Si ya hay una ventana abierta, enfocarla
        for (const client of windowClients) {
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        // Si no, abrir una nueva
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
  );
});

// ============================================================
// LOG DE INICIO
// ============================================================

console.log('[SW] Sentra Vision Service Worker v3.1.2-PROT');
console.log('[SW] Offline-first — Cuando todo lo demás se apaga, Sentra Core sigue ahí.');
