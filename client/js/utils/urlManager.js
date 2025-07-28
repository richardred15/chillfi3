/**
 * URL Manager - Handles URL state management
 */
class URLManager {
    // Set URL to specific state, clearing other parameters
    static setURL(params) {
        const url = new URL(window.location);
        
        // Clear all existing search params first
        const keys = Array.from(url.searchParams.keys());
        keys.forEach(key => url.searchParams.delete(key));
        
        // Add new params
        Object.entries(params).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== '') {
                url.searchParams.set(key, value);
            }
        });
        
        window.history.pushState({}, '', url);
    }
    
    // Clear URL back to base path
    static clearURL() {
        window.history.pushState({}, '', window.location.pathname);
    }
    
    // Get current URL parameters
    static getParams() {
        return new URLSearchParams(window.location.search);
    }
}

export default URLManager;