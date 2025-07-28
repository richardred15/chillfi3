/**
 * Toast Notification Component
 */
export default class Toast {
    constructor(selector) {
        this.toast = document.getElementById(selector);
        this.timeout = null;
    }
    
    show(message, duration = 3000) {
        // Clear any existing timeout
        if (this.timeout) {
            clearTimeout(this.timeout);
        }
        
        // Set message
        this.toast.querySelector('.toast-message').textContent = message;
        
        // Show toast
        this.toast.classList.add('show');
        
        // Hide after duration
        this.timeout = setTimeout(() => {
            this.hide();
        }, duration);
    }
    
    hide() {
        this.toast.classList.remove('show');
    }
}