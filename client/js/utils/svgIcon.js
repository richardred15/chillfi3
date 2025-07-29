/**
 * SVG Icon Utility
 * Creates SVG icons using sprite references
 */

// Load sprite on first use
let spriteLoaded = false;

function loadSprite() {
    if (spriteLoaded) return;
    
    fetch('client/icons/sprite.svg')
        .then(response => response.text())
        .then(svg => {
            const div = document.createElement('div');
            div.innerHTML = svg;
            div.style.display = 'none';
            document.body.insertBefore(div, document.body.firstChild);
            spriteLoaded = true;
        })
        .catch(error => {
            console.warn('Failed to load SVG sprite:', error);
        });
}

/**
 * Create an SVG icon element
 * @param {string} iconName - Name of the icon from the sprite
 * @param {number} size - Size in pixels (default: 16)
 * @param {string} className - Additional CSS classes
 * @returns {SVGElement} SVG element
 */
export function createIcon(iconName, size = 16, className = '') {
    loadSprite();
    
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('class', className);
    
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', `#${iconName}`);
    
    svg.appendChild(use);
    return svg;
}

/**
 * Replace img elements with SVG sprites
 * @param {Element} container - Container to search within (default: document)
 */
export function replaceImgWithSprite(container = document) {
    const images = container.querySelectorAll('img[src*="client/icons/"]');
    
    images.forEach(img => {
        const src = img.getAttribute('src');
        const iconName = src.split('/').pop().replace('.svg', '');
        const size = img.getAttribute('width') || img.getAttribute('height') || 16;
        const alt = img.getAttribute('alt');
        
        const svg = createIcon(iconName, parseInt(size), img.className);
        if (alt) svg.setAttribute('aria-label', alt);
        
        img.parentNode.replaceChild(svg, img);
    });
}

export default { createIcon, replaceImgWithSprite };