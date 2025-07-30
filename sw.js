/* // Service Worker for ChillFi3 - Cache Busting + Offline Support
let currentVersion = '1.0.1';
let CACHE_NAME = `chillfi3-v${currentVersion}`;
let API_CACHE_NAME = `chillfi3-api-v${currentVersion}`;
let AUDIO_CACHE_NAME = `chillfi3-audio-v${currentVersion}`;

const STATIC_ASSETS = [
    '/',
    '/index.php',
    '/client/css/style.css',
    '/client/js/app.js',
    '/client/js/api.js',
    '/client/js/offline.js',
    '/client/icons/play.svg',
    '/client/icons/pause.svg',
    '/client/icons/next.svg',
    '/client/icons/previous.svg',
    '/favicon.ico'
];

// Install - cache static assets
self.addEventListener('install', (event) => {
    console.log('Service Worker: Installing...');
    event.waitUntil(
        Promise.all([
            caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)),
            fetch('/api/health').catch(() => {})
        ]).then(() => {
            console.log('Service Worker: Installed');
            self.skipWaiting();
        })
    );
});

// Activate - clean old caches
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activating...');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME && 
                        cacheName !== API_CACHE_NAME && 
                        cacheName !== AUDIO_CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Listen for version updates and cache control
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'VERSION_UPDATE') {
        const oldVersion = currentVersion;
        currentVersion = event.data.version;
        
        // Update cache names with new version
        CACHE_NAME = `chillfi3-v${currentVersion}`;
        API_CACHE_NAME = `chillfi3-api-v${currentVersion}`;
        AUDIO_CACHE_NAME = `chillfi3-audio-v${currentVersion}`;
        
        console.log('Service Worker: Version updated from', oldVersion, 'to', currentVersion);
        
        // Clear old caches when version changes
        if (oldVersion !== currentVersion) {
            caches.keys().then(cacheNames => {
                const oldCaches = cacheNames.filter(name => 
                    name.includes('chillfi3') && !name.includes(currentVersion)
                );
                return Promise.all(oldCaches.map(name => caches.delete(name)));
            }).then(() => {
                console.log('Service Worker: Old caches cleared for version update');
            });
        }
    } else if (event.data && event.data.type === 'CLEAR_CACHE') {
        // Clear all caches when requested
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => caches.delete(cacheName))
            );
        }).then(() => {
            console.log('Service Worker: All caches cleared');
            // Notify client that cache is cleared
            self.clients.matchAll().then(clients => {
                clients.forEach(client => {
                    client.postMessage({ type: 'CACHE_CLEARED' });
                });
            });
        });
    }
});

// Fetch handler with offline support
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    
    if (url.origin !== location.origin) return;
    
    // Handle different request types
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(handleApiRequest(event.request));
    } else if (url.pathname.includes('.mp3') || url.pathname.includes('.m4a')) {
        event.respondWith(handleAudioRequest(event.request));
    } else {
        event.respondWith(handleStaticRequest(event.request, url));
    }
});

// Handle static requests with cache busting
async function handleStaticRequest(request, url) {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    
    // Check if this is a hard refresh (cache: 'reload' or pragma: no-cache)
    const isHardRefresh = request.cache === 'reload' || 
                         request.headers.get('pragma') === 'no-cache' ||
                         request.headers.get('cache-control') === 'no-cache';
    
    try {
        // Apply cache busting if no version param
        let fetchUrl = request.url;
        if (!url.searchParams.has('v')) {
            fetchUrl += (url.search ? '&' : '?') + 'v=' + currentVersion;
        }
        
        // Always fetch from network on hard refresh, otherwise try cache first
        if (isHardRefresh || !cached) {
            const response = await fetch(fetchUrl, { cache: 'no-cache' });
            if (response.status === 200) {
                // Update cache with fresh content
                cache.put(request, response.clone());
            }
            return response;
        } else {
            // Try network first, fallback to cache
            try {
                const response = await fetch(fetchUrl, { cache: 'no-cache' });
                if (response.status === 200) {
                    cache.put(request, response.clone());
                }
                return response;
            } catch (networkError) {
                return cached;
            }
        }
    } catch (error) {
        return cached || new Response('Offline', { status: 503 });
    }
}

// Handle API requests with caching
async function handleApiRequest(request) {
    // Skip upload requests
    if (request.url.includes('/upload')) {
        return fetch(request);
    }
    
    const cache = await caches.open(API_CACHE_NAME);
    
    try {
        const response = await fetch(request);
        if (response.status === 200 && request.method === 'GET') {
            cache.put(request, response.clone());
        }
        return response;
    } catch (error) {
        const cached = await cache.match(request);
        if (cached) {
            return cached;
        }
        return new Response(JSON.stringify({ error: 'Offline' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// Handle audio requests with selective caching
async function handleAudioRequest(request) {
    const cache = await caches.open(AUDIO_CACHE_NAME);
    const cached = await cache.match(request);
    
    if (cached) return cached;
    
    try {
        const response = await fetch(request);
        if (response.status === 200) {
            const contentLength = response.headers.get('content-length');
            if (contentLength && parseInt(contentLength) < 50 * 1024 * 1024) {
                cache.put(request, response.clone());
            }
        }
        return response;
    } catch (error) {
        return new Response('Audio unavailable offline', { status: 503 });
    }
} */
