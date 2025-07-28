/**
 * Global Error Handler
 */

class ErrorHandler {
    constructor(toast) {
        this.toast = toast;
        this.setupGlobalHandlers();
    }
    
    setupGlobalHandlers() {
        // Handle unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            this.handleError(event.reason, 'Promise rejection');
            event.preventDefault();
        });
        
        // Handle JavaScript errors
        window.addEventListener('error', (event) => {
            console.error('JavaScript error:', event.error);
            this.handleError(event.error, 'JavaScript error');
        });
        
        // Handle API errors
        this.setupAPIErrorHandling();
    }
    
    setupAPIErrorHandling() {
        // Wrap API calls to handle errors consistently
        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
            try {
                const response = await originalFetch(...args);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                return response;
            } catch (error) {
                this.handleError(error, 'Network error');
                throw error;
            }
        };
    }
    
    handleError(error, context = 'Unknown') {
        const errorMessage = this.getErrorMessage(error);
        
        // Log error details
        console.error(`[${context}]`, {
            message: errorMessage,
            stack: error?.stack,
            timestamp: new Date().toISOString()
        });
        
        // Show user-friendly message
        if (this.toast) {
            this.toast.show(this.getUserFriendlyMessage(error, context));
        }
        
        // Report to analytics/monitoring service if available
        this.reportError(error, context);
    }
    
    getErrorMessage(error) {
        if (typeof error === 'string') return error;
        if (error?.message) return error.message;
        if (error?.toString) return error.toString();
        return 'Unknown error occurred';
    }
    
    getUserFriendlyMessage(error, context) {
        const message = this.getErrorMessage(error);
        
        // Network errors
        if (message.includes('fetch') || message.includes('Network')) {
            return 'Connection error. Please check your internet connection.';
        }
        
        // Authentication errors
        if (message.includes('401') || message.includes('Unauthorized')) {
            return 'Please log in to continue.';
        }
        
        if (message.includes('Invalid credentials')) {
            return 'Invalid username or password.';
        }
        
        if (message.includes('Username and password required')) {
            return 'Please enter both username and password.';
        }
        
        // Server errors
        if (message.includes('500') || message.includes('Internal Server Error')) {
            return 'Server error. Please try again later.';
        }
        
        // Rate limiting
        if (message.includes('429') || message.includes('Rate limit')) {
            return 'Too many requests. Please wait a moment.';
        }
        
        // Default message
        return 'Something went wrong. Please try again.';
    }
    
    reportError(error, context) {
        // Placeholder for error reporting service
        // Could integrate with services like Sentry, LogRocket, etc.
        if (window.location.hostname !== 'localhost') {
            // Report to monitoring service in production
        }
    }
    
    // Wrapper for async functions to handle errors
    wrapAsync(fn, context = 'Async operation') {
        return async (...args) => {
            try {
                return await fn(...args);
            } catch (error) {
                this.handleError(error, context);
                throw error;
            }
        };
    }
    
    // Wrapper for event handlers
    wrapEventHandler(fn, context = 'Event handler') {
        return (...args) => {
            try {
                const result = fn(...args);
                if (result instanceof Promise) {
                    result.catch(error => this.handleError(error, context));
                }
                return result;
            } catch (error) {
                this.handleError(error, context);
            }
        };
    }
}

export default ErrorHandler;