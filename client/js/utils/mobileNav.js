/**
 * Mobile Navigation Utility
 * Moves header actions to mobile navbar on small screens
 */

function initMobileNav() {
    const moveElementsToMobileNav = () => {
        const isMobile = window.innerWidth <= 576;
        const navSection = document.querySelector('.nav-section');
        const headerActions = document.querySelector('.header-actions');
        const uploadButton = document.getElementById('uploadButton');
        const userMenu = document.getElementById('userMenu');
        
        if (isMobile && navSection && headerActions) {
            // Move upload button and user menu to navbar
            if (uploadButton && !navSection.contains(uploadButton)) {
                navSection.appendChild(uploadButton);
            }
            if (userMenu && !navSection.contains(userMenu)) {
                navSection.appendChild(userMenu);
            }
        } else if (!isMobile && headerActions) {
            // Move back to header on desktop
            if (uploadButton && !headerActions.contains(uploadButton)) {
                headerActions.appendChild(uploadButton);
            }
            if (userMenu && !headerActions.contains(userMenu)) {
                headerActions.appendChild(userMenu);
            }
        }
    };
    
    // Initial setup
    moveElementsToMobileNav();
    
    // Handle resize
    window.addEventListener('resize', moveElementsToMobileNav);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileNav);
} else {
    initMobileNav();
}

export { initMobileNav };