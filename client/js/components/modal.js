/**
 * Generic Modal Component
 */
export default class Modal {
    constructor(modalId) {
        this.modal = document.getElementById(modalId);
        this.isOpen = false;
        
        // Bind the click outside handler once
        this.boundClickOutside = this.handleClickOutside.bind(this);
        
        this.init();
    }
    
    init() {
        // Add close button listeners if they exist
        const closeButtons = this.modal.querySelectorAll('[data-modal-close]');
        closeButtons.forEach(button => {
            button.addEventListener('click', () => this.hide());
        });
    }
    
    show() {
        if (this.isOpen) return;
        
        // Create backdrop if it doesn't exist
        if (!this.backdrop) {
            this.backdrop = document.createElement('div');
            this.backdrop.className = 'modal-backdrop';
            this.backdrop.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                z-index: 1000;
                opacity: 0;
                transition: opacity 0.3s ease;
            `;
            document.body.appendChild(this.backdrop);
        }
        
        // Show backdrop
        this.backdrop.style.display = 'block';
        setTimeout(() => this.backdrop.style.opacity = '1', 10);
        
        // Prevent body scroll
        document.body.style.overflow = 'hidden';
        
        this.modal.classList.add('show');
        this.isOpen = true;
        
        // Add click outside listener after a brief delay
        setTimeout(() => {
            document.addEventListener('click', this.boundClickOutside);
        }, 0);
        
        // Emit custom event
        this.modal.dispatchEvent(new CustomEvent('modal:show'));
    }
    
    hide() {
        if (!this.isOpen) return;
        
        this.modal.classList.remove('show');
        this.isOpen = false;
        
        // Remove click outside listener
        document.removeEventListener('click', this.boundClickOutside);
        
        // Emit custom event
        this.modal.dispatchEvent(new CustomEvent('modal:hide'));
    }
    
    toggle() {
        if (this.isOpen) {
            this.hide();
        } else {
            this.show();
        }
    }
    
    handleClickOutside(e) {
        if (!this.modal.contains(e.target)) {
            e.stopPropagation();
            this.hide();
        }
    }
    
    // Allow custom validation before closing
    setCloseValidator(validator) {
        this.closeValidator = validator;
    }
    
    // Override hide method to include validation
    hide() {
        if (this.closeValidator && !this.closeValidator()) {
            return false;
        }
        
        if (!this.isOpen) return;
        
        // Hide backdrop
        if (this.backdrop) {
            this.backdrop.style.opacity = '0';
            setTimeout(() => {
                this.backdrop.style.display = 'none';
            }, 300);
        }
        
        // Restore body scroll
        document.body.style.overflow = '';
        
        this.modal.classList.remove('show');
        this.isOpen = false;
        
        document.removeEventListener('click', this.boundClickOutside);
        this.modal.dispatchEvent(new CustomEvent('modal:hide'));
        
        return true;
    }
}