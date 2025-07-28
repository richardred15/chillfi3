/**
 * Offline Mode Manager
 */
class OfflineManager {
    constructor() {
        this.isOnline = navigator.onLine;
        this.cache = new Map();
        this.offlineQueue = [];
        this.cachedSongs = new Map();
        this.init();
    }

    init() {
        // Load cached data first
        this.loadCachedData();
        
        // Register service worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then(reg => console.log('Service Worker registered'))
                .catch(err => console.log('Service Worker registration failed'));
        }

        // Listen for online/offline events
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());

        // Initialize offline indicator
        this.createOfflineIndicator();
        this.updateOfflineIndicator();
    }

    handleOnline() {
        this.isOnline = true;
        console.log('Back online');
        this.updateOfflineIndicator();
        this.syncOfflineQueue();
    }

    handleOffline() {
        this.isOnline = false;
        console.log('Gone offline');
        this.updateOfflineIndicator();
    }

    createOfflineIndicator() {
        const indicator = document.createElement('div');
        indicator.id = 'offline-indicator';
        indicator.innerHTML = `
            <div class="offline-bar" style="
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                background: var(--warning-color, #ff9800);
                color: var(--warning-text, white);
                text-align: center;
                padding: 4px 8px;
                font-size: 12px;
                z-index: 9999;
                transform: translateY(-100%);
                transition: transform 0.3s ease;
                border-bottom: 1px solid var(--border-color, rgba(255,255,255,0.2));
                backdrop-filter: blur(10px);
                opacity: 0.9;
            ">
                🔌 Offline - Showing cached content only
            </div>
        `;
        document.body.appendChild(indicator);
    }

    updateOfflineIndicator() {
        const indicator = document.getElementById('offline-indicator');
        if (indicator) {
            const bar = indicator.firstElementChild;
            if (this.isOnline) {
                bar.style.transform = 'translateY(-100%)';
                // Adjust body padding
                document.body.style.paddingTop = '0';
            } else {
                bar.style.transform = 'translateY(0)';
                // Adjust body padding to prevent content overlap
                document.body.style.paddingTop = '25px';
            }
        }
    }



    // Cache song data for offline use
    cacheSong(song) {
        this.cachedSongs.set(song.id, {
            ...song,
            cachedAt: Date.now()
        });
        this.saveToLocalStorage('cachedSongs', Array.from(this.cachedSongs.entries()));
    }

    // Get cached song
    getCachedSong(songId) {
        return this.cachedSongs.get(songId);
    }

    // Cache API response
    cacheResponse(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
        this.saveToLocalStorage('apiCache', Array.from(this.cache.entries()));
    }

    // Get cached response
    getCachedResponse(key, maxAge = 300000) { // 5 minutes default
        const cached = this.cache.get(key);
        if (cached && (Date.now() - cached.timestamp) < maxAge) {
            return cached.data;
        }
        return null;
    }

    // Queue action for when online
    queueAction(action) {
        this.offlineQueue.push({
            ...action,
            timestamp: Date.now(),
            id: Date.now() + Math.random() // Unique ID for deduplication
        });
        this.saveToLocalStorage('offlineQueue', this.offlineQueue);
    }

    // Sync queued actions when back online
    async syncOfflineQueue() {
        if (!this.isOnline || this.offlineQueue.length === 0) return;

        console.log(`Syncing ${this.offlineQueue.length} offline actions`);
        
        for (const action of this.offlineQueue) {
            try {
                await this.executeAction(action);
            } catch (error) {
                console.error('Failed to sync action:', action, error);
            }
        }

        this.offlineQueue = [];
        this.saveToLocalStorage('offlineQueue', []);
    }

    async executeAction(action) {
        switch (action.type) {
            case 'recordListen':
                await window.api.recordListen(action.songId);
                break;
            case 'createPlaylist':
                const result = await window.api.createPlaylist(action.name, action.isPublic);
                // Update local playlist with server ID
                if (result.success && action.localId) {
                    this.updateLocalPlaylistId(action.localId, result.data.playlistId);
                }
                break;
            case 'addToPlaylist':
                await window.api.addToPlaylist(action.playlistId, action.songId);
                break;
            case 'removeFromPlaylist':
                await window.api.removeSongFromPlaylist(action.playlistId, action.songId);
                break;
            case 'updatePlaylist':
                await window.api.updatePlaylist(action.playlistId, action.updates);
                break;
        }
    }

    // Local storage helpers
    saveToLocalStorage(key, data) {
        try {
            localStorage.setItem(`chillfi_${key}`, JSON.stringify(data));
        } catch (error) {
            console.error('Failed to save to localStorage:', error);
        }
    }

    loadFromLocalStorage(key) {
        try {
            const data = localStorage.getItem(`chillfi_${key}`);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Failed to load from localStorage:', error);
            return null;
        }
    }

    // Initialize cached data from localStorage
    loadCachedData() {
        const cachedSongs = this.loadFromLocalStorage('cachedSongs');
        if (cachedSongs) {
            this.cachedSongs = new Map(cachedSongs);
        }

        const apiCache = this.loadFromLocalStorage('apiCache');
        if (apiCache) {
            this.cache = new Map(apiCache);
        }

        const offlineQueue = this.loadFromLocalStorage('offlineQueue');
        if (offlineQueue) {
            this.offlineQueue = offlineQueue;
        }
        
        // Load cached data on initialization
        // (removed duplicate call)
    }

    // Check if we can play a song offline
    canPlayOffline(songId) {
        return this.cachedSongs.has(songId);
    }

    // Get offline library
    getOfflineLibrary() {
        return Array.from(this.cachedSongs.values());
    }

    // Offline playlist management
    createOfflinePlaylist(name, isPublic = false) {
        const localId = 'offline_' + Date.now();
        const playlist = {
            id: localId,
            name: name,
            isPublic: isPublic,
            songs: [],
            createdAt: Date.now(),
            offline: true
        };
        
        const playlists = this.getOfflinePlaylists();
        playlists.push(playlist);
        this.saveToLocalStorage('offlinePlaylists', playlists);
        
        // Queue for sync
        this.queueAction({
            type: 'createPlaylist',
            name: name,
            isPublic: isPublic,
            localId: localId
        });
        
        return playlist;
    }

    addToOfflinePlaylist(playlistId, songId) {
        const playlists = this.getOfflinePlaylists();
        const playlist = playlists.find(p => p.id === playlistId);
        
        if (playlist && !playlist.songs.includes(songId)) {
            playlist.songs.push(songId);
            this.saveToLocalStorage('offlinePlaylists', playlists);
            
            // Queue for sync
            this.queueAction({
                type: 'addToPlaylist',
                playlistId: playlistId,
                songId: songId
            });
        }
    }

    removeFromOfflinePlaylist(playlistId, songId) {
        const playlists = this.getOfflinePlaylists();
        const playlist = playlists.find(p => p.id === playlistId);
        
        if (playlist) {
            playlist.songs = playlist.songs.filter(id => id !== songId);
            this.saveToLocalStorage('offlinePlaylists', playlists);
            
            // Queue for sync
            this.queueAction({
                type: 'removeFromPlaylist',
                playlistId: playlistId,
                songId: songId
            });
        }
    }

    getOfflinePlaylists() {
        return this.loadFromLocalStorage('offlinePlaylists') || [];
    }

    updateLocalPlaylistId(localId, serverId) {
        const playlists = this.getOfflinePlaylists();
        const playlist = playlists.find(p => p.id === localId);
        if (playlist) {
            playlist.id = serverId;
            playlist.offline = false;
            this.saveToLocalStorage('offlinePlaylists', playlists);
        }
    }

    // Cache management UI helpers
    getCacheSize() {
        let size = 0;
        try {
            for (let key in localStorage) {
                if (key.startsWith('chillfi_')) {
                    size += localStorage[key].length;
                }
            }
        } catch (error) {
            console.error('Error calculating cache size:', error);
        }
        return size;
    }

    clearCache() {
        try {
            const keys = Object.keys(localStorage).filter(key => key.startsWith('chillfi_'));
            keys.forEach(key => localStorage.removeItem(key));
            this.cache.clear();
            this.cachedSongs.clear();
            this.offlineQueue = [];
            
            // Clear service worker caches
            if ('caches' in window) {
                caches.keys().then(names => {
                    names.forEach(name => caches.delete(name));
                });
            }
        } catch (error) {
            console.error('Error clearing cache:', error);
        }
    }
}

// Create global offline manager
window.offlineManager = new OfflineManager();

export default OfflineManager;