// Service Worker for Cache Busting
let currentVersion = '1.0.1'; // Default version

// Fetch version from server on install
self.addEventListener('install', (event) => {
    console.log('Service Worker: Installing...');
    event.waitUntil(
        fetch('/api/health')
            .then(() => {
                console.log('Service Worker: Installed');
                self.skipWaiting();
            })
            .catch(() => {
                console.log('Service Worker: Installed (offline)');
                self.skipWaiting();
            })
    );
});

self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activating...');
    event.waitUntil(self.clients.claim());
});

// Listen for messages from main thread
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'VERSION_UPDATE') {
        currentVersion = event.data.version;
        console.log('Service Worker: Version updated to', currentVersion);
    }
});

// Intercept fetch requests
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    
    // Only process requests to our domain
    if (url.origin !== location.origin) {
        return;
    }
    
    // Skip upload requests (they have FormData bodies that can't be cloned)
    if (url.pathname.startsWith('/api/upload')) {
        return;
    }
    
    // Apply cache busting to all other requests
    if (!url.searchParams.has('v')) {
        const requestInit = {
            method: event.request.method,
            headers: event.request.headers,
            body: event.request.body,
            credentials: event.request.credentials,
            cache: 'no-cache'
        };
        
        // Don't include mode if it's 'navigate' as it's not allowed in Request constructor
        if (event.request.mode !== 'navigate') {
            requestInit.mode = event.request.mode;
        }
        
        event.respondWith(
            fetch(new Request(event.request.url + (url.search ? '&' : '?') + 'v=' + currentVersion, requestInit))
        );
    }
});