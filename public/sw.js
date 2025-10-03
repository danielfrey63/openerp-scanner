// OpenERP Scanner Service Worker
// Implements comprehensive caching strategies for offline functionality

const CACHE_VERSION = 'v1.0.0';
const STATIC_CACHE = `openerp-scanner-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `openerp-scanner-dynamic-${CACHE_VERSION}`;
const API_CACHE = `openerp-scanner-api-${CACHE_VERSION}`;

// Cache TTL in milliseconds
const CACHE_TTL = {
  STATIC: 365 * 24 * 60 * 60 * 1000, // 1 year
  DYNAMIC: 24 * 60 * 60 * 1000,      // 1 day
  API: 5 * 60 * 1000,                // 5 minutes
  ORDER_DATA: 30 * 60 * 1000         // 30 minutes
};

// Static assets to precache
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/src/main.tsx',
  '/src/App.css',
  '/manifest.json'
];

// API endpoints patterns
const API_PATTERNS = [
  /\/web\/session\/authenticate/,
  /\/web\/dataset\/call_kw/,
  /\/web\/dataset\/search_read/
];

// Order data patterns
const ORDER_PATTERNS = [
  /\/orders/,
  /\/order\/\d+/
];

// Install event - precache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Precaching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Static assets precached successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Failed to precache static assets:', error);
      })
  );
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        const deletePromises = cacheNames
          .filter((cacheName) => {
            return cacheName.startsWith('openerp-scanner-') && 
                   !cacheName.includes(CACHE_VERSION);
          })
          .map((cacheName) => {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          });
        
        return Promise.all(deletePromises);
      })
      .then(() => {
        console.log('[SW] Old caches cleaned up');
        return self.clients.claim();
      })
      .catch((error) => {
        console.error('[SW] Failed to cleanup old caches:', error);
      })
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests and chrome-extension requests
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') {
    return;
  }
  
  // Determine caching strategy based on request type
  if (isStaticAsset(request)) {
    event.respondWith(cacheFirstStrategy(request, STATIC_CACHE));
  } else if (isApiRequest(request)) {
    event.respondWith(networkFirstStrategy(request, API_CACHE));
  } else if (isOrderData(request)) {
    event.respondWith(staleWhileRevalidateStrategy(request, DYNAMIC_CACHE));
  } else {
    event.respondWith(networkFirstStrategy(request, DYNAMIC_CACHE));
  }
});

// Cache-First Strategy (for static assets)
async function cacheFirstStrategy(request, cacheName) {
  try {
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse && !isExpired(cachedResponse, CACHE_TTL.STATIC)) {
      console.log('[SW] Cache hit (static):', request.url);
      return cachedResponse;
    }
    
    console.log('[SW] Cache miss (static), fetching:', request.url);
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const responseClone = networkResponse.clone();
      await cache.put(request, responseClone);
      console.log('[SW] Static asset cached:', request.url);
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[SW] Cache-first strategy failed:', error);
    
    // Fallback to cache even if expired
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      console.log('[SW] Serving expired cache as fallback:', request.url);
      return cachedResponse;
    }
    
    // Return offline fallback for HTML requests
    if (request.destination === 'document') {
      return createOfflineFallback();
    }
    
    throw error;
  }
}

// Network-First Strategy (for API calls)
async function networkFirstStrategy(request, cacheName) {
  try {
    console.log('[SW] Network-first attempt:', request.url);
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      const responseClone = networkResponse.clone();
      await cache.put(request, responseClone);
      console.log('[SW] API response cached:', request.url);
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);
    
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse && !isExpired(cachedResponse, CACHE_TTL.API)) {
      console.log('[SW] Serving cached API response:', request.url);
      return cachedResponse;
    }
    
    console.error('[SW] Network-first strategy failed completely:', error);
    throw error;
  }
}

// Stale-While-Revalidate Strategy (for order data)
async function staleWhileRevalidateStrategy(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  // Always try to fetch fresh data in background
  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        const responseClone = networkResponse.clone();
        cache.put(request, responseClone);
        console.log('[SW] Order data updated in background:', request.url);
      }
      return networkResponse;
    })
    .catch((error) => {
      console.log('[SW] Background fetch failed:', request.url, error);
    });

  // Return cached version immediately if available and not expired
  if (cachedResponse && !isExpired(cachedResponse, CACHE_TTL.ORDER_DATA)) {
    console.log('[SW] Serving cached order data:', request.url);
    return cachedResponse;
  }

  // If no cache or expired, wait for network
  try {
    console.log('[SW] Waiting for fresh order data:', request.url);
    return await fetchPromise;
  } catch (error) {
    // If network fails and we have cached data, serve it even if expired
    if (cachedResponse) {
      console.log('[SW] Serving expired order data as fallback:', request.url);
      return cachedResponse;
    }
    throw error;
  }
}

// Helper functions for request classification
function isStaticAsset(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;

  return pathname.endsWith('.js') ||
         pathname.endsWith('.css') ||
         pathname.endsWith('.svg') ||
         pathname.endsWith('.png') ||
         pathname.endsWith('.jpg') ||
         pathname.endsWith('.jpeg') ||
         pathname.endsWith('.gif') ||
         pathname.endsWith('.ico') ||
         pathname.endsWith('.woff') ||
         pathname.endsWith('.woff2') ||
         pathname.endsWith('.ttf') ||
         pathname === '/' ||
         pathname === '/index.html' ||
         pathname === '/manifest.json';
}

function isApiRequest(request) {
  const url = new URL(request.url);
  return API_PATTERNS.some(pattern => pattern.test(url.pathname));
}

function isOrderData(request) {
  const url = new URL(request.url);
  return ORDER_PATTERNS.some(pattern => pattern.test(url.pathname));
}

// Check if cached response is expired
function isExpired(response, ttl) {
  const cachedDate = response.headers.get('sw-cached-date');
  if (!cachedDate) return true;

  const cacheTime = new Date(cachedDate).getTime();
  const now = Date.now();
  return (now - cacheTime) > ttl;
}

// Create offline fallback page
function createOfflineFallback() {
  const offlineHTML = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>OpenERP Scanner - Offline</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          margin: 0;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          text-align: center;
          padding: 20px;
        }
        .offline-container {
          max-width: 400px;
          background: rgba(255, 255, 255, 0.1);
          padding: 40px;
          border-radius: 20px;
          backdrop-filter: blur(10px);
        }
        .offline-icon {
          font-size: 64px;
          margin-bottom: 20px;
        }
        h1 { margin: 0 0 20px 0; }
        p { margin: 0 0 30px 0; opacity: 0.9; }
        .retry-btn {
          background: rgba(255, 255, 255, 0.2);
          border: 2px solid rgba(255, 255, 255, 0.3);
          color: white;
          padding: 12px 24px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 16px;
          transition: all 0.3s ease;
        }
        .retry-btn:hover {
          background: rgba(255, 255, 255, 0.3);
          transform: translateY(-2px);
        }
      </style>
    </head>
    <body>
      <div class="offline-container">
        <div class="offline-icon">📱</div>
        <h1>App ist offline</h1>
        <p>Sie sind momentan nicht mit dem Internet verbunden. Die App funktioniert weiterhin mit gespeicherten Daten.</p>
        <button class="retry-btn" onclick="window.location.reload()">
          Erneut versuchen
        </button>
      </div>
    </body>
    </html>
  `;

  return new Response(offlineHTML, {
    headers: {
      'Content-Type': 'text/html',
      'sw-cached-date': new Date().toISOString()
    }
  });
}

// Background Sync for pending operations
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);

  if (event.tag === 'order-sync') {
    event.waitUntil(syncPendingOrders());
  } else if (event.tag === 'product-updates-sync') {
    event.waitUntil(syncPendingProductUpdates());
  }
});

// Sync pending order operations
async function syncPendingOrders() {
  try {
    console.log('[SW] Syncing pending orders...');

    // Get pending operations from localStorage
    const pendingOps = getPendingOperations();

    for (const op of pendingOps) {
      try {
        await syncOperation(op);
        removePendingOperation(op.id);
        console.log('[SW] Synced operation:', op.id);
      } catch (error) {
        console.error('[SW] Failed to sync operation:', op.id, error);
      }
    }

    // Notify clients about sync completion
    notifyClients({ type: 'SYNC_COMPLETE', success: true });
  } catch (error) {
    console.error('[SW] Background sync failed:', error);
    notifyClients({ type: 'SYNC_COMPLETE', success: false, error: error.message });
  }
}

// Sync pending product updates
async function syncPendingProductUpdates() {
  try {
    console.log('[SW] Syncing pending product updates...');

    // This would integrate with the existing orderRepo pending updates
    // For now, we'll notify the main thread to handle the sync
    notifyClients({ type: 'SYNC_PRODUCT_UPDATES' });
  } catch (error) {
    console.error('[SW] Product updates sync failed:', error);
  }
}

// Helper functions for background sync
function getPendingOperations() {
  // This would read from localStorage or IndexedDB
  // For now, return empty array as the main app handles this
  return [];
}

function removePendingOperation(id) {
  // Remove operation from storage after successful sync
  console.log('[SW] Removing synced operation:', id);
}

async function syncOperation(operation) {
  // Perform the actual sync operation
  // This would make API calls to OpenERP
  console.log('[SW] Syncing operation:', operation);
}

// Notify all clients about events
function notifyClients(message) {
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage(message);
    });
  });
}

// Message handling from main thread
self.addEventListener('message', (event) => {
  const { type, data } = event.data;

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'CACHE_ORDER_DATA':
      cacheOrderData(data);
      break;

    case 'CLEAR_CACHE':
      clearAllCaches();
      break;

    case 'GET_CACHE_STATUS':
      getCacheStatus().then((status) => {
        event.ports[0].postMessage(status);
      });
      break;

    default:
      console.log('[SW] Unknown message type:', type);
  }
});

// Cache order data manually
async function cacheOrderData(orderData) {
  try {
    const cache = await caches.open(DYNAMIC_CACHE);
    const response = new Response(JSON.stringify(orderData), {
      headers: {
        'Content-Type': 'application/json',
        'sw-cached-date': new Date().toISOString()
      }
    });

    await cache.put(`/api/orders/${orderData.id}`, response);
    console.log('[SW] Order data cached manually:', orderData.id);
  } catch (error) {
    console.error('[SW] Failed to cache order data:', error);
  }
}

// Clear all caches
async function clearAllCaches() {
  try {
    const cacheNames = await caches.keys();
    const deletePromises = cacheNames
      .filter(name => name.startsWith('openerp-scanner-'))
      .map(name => caches.delete(name));

    await Promise.all(deletePromises);
    console.log('[SW] All caches cleared');
    notifyClients({ type: 'CACHE_CLEARED' });
  } catch (error) {
    console.error('[SW] Failed to clear caches:', error);
  }
}

// Get cache status information
async function getCacheStatus() {
  try {
    const cacheNames = await caches.keys();
    const status = {
      caches: cacheNames.filter(name => name.startsWith('openerp-scanner-')),
      version: CACHE_VERSION,
      timestamp: new Date().toISOString()
    };

    // Get cache sizes
    for (const cacheName of status.caches) {
      const cache = await caches.open(cacheName);
      const keys = await cache.keys();
      status[cacheName] = { entries: keys.length };
    }

    return status;
  } catch (error) {
    console.error('[SW] Failed to get cache status:', error);
    return { error: error.message };
  }
}
