/**
 * Cache Manager Utility
 */
class CacheManager {
    constructor() {
        this.init();
    }

    init() {
        // Listen for hard refresh (Ctrl+Shift+R)
        this.detectHardRefresh();
        
        // Listen for service worker messages
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data && event.data.type === 'CACHE_CLEARED') {
                    console.log('Cache cleared by service worker');
                }
            });
        }
    }

    detectHardRefresh() {
        // Check if this was a hard refresh
        const navigation = performance.getEntriesByType('navigation')[0];
        if (navigation && navigation.type === 'reload') {
            // Check if it was a hard refresh (Ctrl+Shift+R)
            const isHardRefresh = navigation.transferSize === 0 || 
                                 window.location.search.includes('hard-refresh');
            
            if (isHardRefresh) {
                console.log('Hard refresh detected - clearing cache');
                this.clearServiceWorkerCache();
            }
        }
    }

    async clearServiceWorkerCache() {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            // Send message to service worker to clear cache
            navigator.serviceWorker.controller.postMessage({
                type: 'CLEAR_CACHE'
            });
        }
        
        // Also clear local storage cache
        if (window.offlineManager) {
            window.offlineManager.clearCache();
        }
    }

    async forceRefresh() {
        // Clear all caches and reload
        await this.clearServiceWorkerCache();
        
        // Wait a bit for cache clearing
        setTimeout(() => {
            window.location.reload(true);
        }, 100);
    }
}

// Create global instance
window.cacheManager = new CacheManager();

export default CacheManager;