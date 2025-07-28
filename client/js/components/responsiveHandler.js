/**
 * Responsive Handler Component
 */
export default class ResponsiveHandler {
    constructor() {
        this.mediaQuery = window.matchMedia('(max-width: 768px)');
        this.sidebar = document.querySelector('.sidebar');
        this.navItems = document.querySelectorAll('.nav-item');
        
        this.init();
    }
    
    init() {
        // Initial check
        this.handleScreenChange(this.mediaQuery);
        
        // Add listener for changes
        this.mediaQuery.addEventListener('change', this.handleScreenChange.bind(this));
    }
    
    handleScreenChange(e) {
        if (e.matches) {
            // Mobile view
            this.navItems.forEach(item => {
                const icon = item.querySelector('.nav-item-icon');
                const text = item.querySelector('.nav-item-text');
                
                if (text) {
                    text.style.display = 'none';
                }
                
                if (icon) {
                    icon.style.marginRight = '0';
                }
                
                item.style.justifyContent = 'center';
            });
        } else {
            // Desktop view
            this.navItems.forEach(item => {
                const icon = item.querySelector('.nav-item-icon');
                const text = item.querySelector('.nav-item-text');
                
                if (text) {
                    text.style.display = 'block';
                }
                
                if (icon) {
                    icon.style.marginRight = '12px';
                }
                
                item.style.justifyContent = 'flex-start';
            });
        }
    }
}