/**
 * Card Hover Effect Component
 */
export default class CardHover {
    constructor() {
        this.cards = document.querySelectorAll('.card');
        this.activeCard = null;
        this.init();
    }
    
    init() {
        this.setupCardEvents();
        
        // Hide play buttons when touching outside
        document.addEventListener('touchstart', (e) => {
            if (!e.target.closest('.card') && this.activeCard) {
                this.hidePlayButton(this.activeCard.querySelector('.card-play'));
                this.activeCard = null;
            }
        });
    }
    
    setupCardEvents() {
        // Use event delegation for dynamic cards
        document.addEventListener('click', (e) => {
            const card = e.target.closest('.card');
            if (!card) return;
            
            const playButton = e.target.closest('.card-play');
            if (playButton) {
                // Play button clicked
                e.stopPropagation();
                this.handlePlayClick(card);
            } else {
                // Card clicked
                this.handleCardClick(card);
            }
        });
        
        // Desktop hover effects
        document.addEventListener('mouseenter', (e) => {
            if (!e.target || typeof e.target.closest !== 'function') return;
            const card = e.target.closest('.card');
            if (card) {
                const playButton = card.querySelector('.card-play');
                if (playButton) this.showPlayButton(playButton);
            }
        }, true);
        
        document.addEventListener('mouseleave', (e) => {
            if (!e.target || typeof e.target.closest !== 'function') return;
            const card = e.target.closest('.card');
            if (card) {
                const playButton = card.querySelector('.card-play');
                if (playButton) this.hidePlayButton(playButton);
            }
        }, true);
        
        // Mobile touch to show play button
        document.addEventListener('touchstart', (e) => {
            const card = e.target.closest('.card');
            if (card && !e.target.closest('.card-play')) {
                this.handleTouch(card);
            }
        });
    }
    
    handleCardClick(card) {
        const cardType = card.dataset.type;
        const songId = card.dataset.songId;
        const albumTitle = card.dataset.albumTitle;
        const artistName = card.dataset.artistName;
        
        if (cardType === 'album' && albumTitle && artistName && window.albumView) {
            window.albumView.show(albumTitle, artistName);
        } else if (songId && window.playSong) {
            window.playSong(songId);
        }
    }
    
    handlePlayClick(card) {
        const songId = card.dataset.songId;
        if (songId && window.playSong) {
            window.playSong(songId);
        }
    }
    
    showPlayButton(playButton) {
        playButton.style.opacity = '1';
        playButton.style.transform = 'translateY(0)';
    }
    
    hidePlayButton(playButton) {
        playButton.style.opacity = '0';
        playButton.style.transform = 'translateY(10px)';
    }
    
    handleTouch(card) {
        const playButton = card.querySelector('.card-play');
        if (!playButton) return;
        
        // Hide previous active card's play button
        if (this.activeCard && this.activeCard !== card) {
            this.hidePlayButton(this.activeCard.querySelector('.card-play'));
        }
        
        // Show current card's play button
        this.showPlayButton(playButton);
        this.activeCard = card;
    }
}