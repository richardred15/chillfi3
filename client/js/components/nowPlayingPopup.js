/**
 * Now Playing Popup Component
 */
export default class NowPlayingPopup {
    constructor() {
        this.nowPlayingButton = document.getElementById('nowPlayingButton');
        this.queueButton = document.getElementById('queueButton');
        this.popup = document.getElementById('nowPlayingPopup');
        
        this.init();
    }
    
    init() {
        if (this.nowPlayingButton) {
            this.nowPlayingButton.addEventListener('click', this.togglePopup.bind(this));
            this.nowPlayingButton.addEventListener('touchstart', this.togglePopup.bind(this), {passive: false});
        }
        
        if (this.queueButton) {
            this.queueButton.addEventListener('click', this.togglePopup.bind(this));
            this.queueButton.addEventListener('touchstart', this.togglePopup.bind(this), {passive: false});
        }
        
        // Close popup when clicking outside
        document.addEventListener('click', this.closePopupIfOutside.bind(this));
        document.addEventListener('touchstart', this.closePopupIfOutside.bind(this), {passive: true});
    }
    
    togglePopup(e) {
        e.preventDefault();
        e.stopPropagation();
        this.popup.classList.toggle('show');
    }
    
    closePopupIfOutside(e) {
        if (this.popup.classList.contains('show') && 
            !this.popup.contains(e.target) && 
            e.target !== this.nowPlayingButton && 
            !this.nowPlayingButton?.contains(e.target) &&
            e.target !== this.queueButton &&
            !this.queueButton?.contains(e.target)) {
            this.popup.classList.remove('show');
        }
    }
    
    show() {
        this.popup.classList.add('show');
    }
    
    hide() {
        this.popup.classList.remove('show');
    }
}