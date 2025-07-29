/**
 * Universal Card Component
 * Handles rendering of song, album, and artist cards with consistent styling and behavior
 */
import URLManager from '../utils/urlManager.js';

export default class Card {
    constructor(item, type, options = {}) {
        this.item = item;
        this.type = type; // 'song', 'album', 'artist'
        this.options = {
            showPlayButton: options.showPlayButton !== false, // default true
            clickHandler: options.clickHandler,
            context: options.context || "default",
            sanitizeHTML:
                options.sanitizeHTML ||
                ((str) => {
                    const div = document.createElement("div");
                    div.textContent = str;
                    return div.innerHTML;
                }),
        };
    }

    // Create and return the card element
    createElement() {
        const card = document.createElement("div");
        card.className = "card";

        // Set data attributes for context menu and interactions
        this.setDataAttributes(card);

        // Set artwork style
        const artworkStyle = this.getArtworkStyle();

        // Build card content
        card.innerHTML = `
            <div class="card-image" style="${artworkStyle}"></div>
            <div class="card-content">
                <div class="card-title">${this.getTitle()}</div>
                <div class="card-subtitle">${this.getSubtitle()}</div>
            </div>
            ${this.options.showPlayButton ? this.getPlayButton() : ""}
        `;

        // Add click handler
        if (this.options.clickHandler) {
            card.addEventListener("click", () =>
                this.options.clickHandler(this.item, this.type)
            );
        } else {
            card.addEventListener("click", () => this.handleDefaultClick());
        }

        return card;
    }

    // Set appropriate data attributes based on type
    setDataAttributes(card) {
        switch (this.type) {
            case "song":
                card.dataset.songId = this.item.id;
                card.dataset.type = "song";
                card.dataset.songTitle = this.item.title || "Unknown Title";
                card.dataset.songArtist = this.item.artist || "Unknown Artist";
                card.dataset.songAlbum = this.item.album || "Unknown Album";
                break;

            case "album":
                card.dataset.albumId = this.item.id;
                card.dataset.songId = this.item.id; // Fallback for context menu
                card.dataset.type = "album";
                card.dataset.itemType = "album";
                card.dataset.itemId = this.item.id;
                card.dataset.itemTitle = this.item.title || "Unknown Album";
                card.dataset.itemArtist = this.item.artist || "Unknown Artist";
                card.dataset.albumTitle = this.item.title || "Unknown Album";
                card.dataset.artistName = this.item.artist || "Unknown Artist";
                break;

            case "artist":
                card.dataset.itemId = this.item.id;
                card.dataset.itemType = "artist";
                card.dataset.itemTitle = this.item.name || "Unknown Artist";
                card.dataset.itemArtist = this.item.name || "Unknown Artist";
                break;
        }
    }

    // Get artwork style based on type and available URLs
    getArtworkStyle() {
        let imageUrl = null;

        switch (this.type) {
            case "song":
                imageUrl = this.item.cover_art_url || this.item.artwork_url;
                break;
            case "album":
                imageUrl = this.item.cover_art_url;
                break;
            case "artist":
                imageUrl = this.item.cover_art_url || this.item.image_url;
                break;
        }

        return imageUrl
            ? `background: url(${imageUrl}) center/cover no-repeat`
            : "background: linear-gradient(45deg, #8C67EF, #4F9EFF)";
    }

    // Get sanitized title based on type
    getTitle() {
        switch (this.type) {
            case "song":
                return this.options.sanitizeHTML(
                    this.item.title || "Unknown Title"
                );
            case "album":
                return this.options.sanitizeHTML(
                    this.item.title || "Unknown Album"
                );
            case "artist":
                return this.options.sanitizeHTML(
                    this.item.name || "Unknown Artist"
                );
            default:
                return "Unknown";
        }
    }

    // Get subtitle based on type
    getSubtitle() {
        switch (this.type) {
            case "song":
                return this.options.sanitizeHTML(
                    this.item.artist || "Unknown Artist"
                );
            case "album":
                // Show different subtitle based on context
                if (this.options.context === "artist_albums") {
                    const year = this.item.year || "Unknown Year";
                    const songCount = this.item.song_count || 0;
                    return `${year} • ${songCount} songs`;
                }
                return this.options.sanitizeHTML(
                    this.item.artist || "Unknown Artist"
                );
            case "artist":
                const albumCount = this.item.album_count || 0;
                const songCount = this.item.song_count || 0;
                return `${albumCount} albums • ${songCount} songs`;
            default:
                return "";
        }
    }

    // Get play button HTML
    getPlayButton() {
        return `
            <button class="card-play">
                <img src="client/icons/play_white.svg" alt="Play" width="24" height="24">
            </button>
        `;
    }

    // Handle default click behavior based on type
    handleDefaultClick() {
        switch (this.type) {
            case "song":
                if (window.contentManager) {
                    window.contentManager.playSong(
                        this.item,
                        this.options.context
                    );
                }
                break;

            case "album":
                if (window.albumView) {
                    window.albumView.show(
                        this.item.title,
                        this.item.artist,
                        this.item.id
                    );
                    URLManager.setURL({
                        album: this.item.title,
                        artist: this.item.artist,
                    });
                }
                break;

            case "artist":
                if (window.contentManager) {
                    const username = this.options.context?.includes(
                        "user_library"
                    )
                        ? this.options.context.split("_")[1] + "_library"
                        : "current_user";
                    window.contentManager.showArtistAlbums(
                        this.item.id,
                        this.item.name,
                        username
                    );
                    URLManager.setURL({ artist: this.item.name });
                }
                break;
        }
    }

    // Static helper method to create multiple cards
    static createCards(items, type, container, options = {}) {
        if (!container) return;

        container.innerHTML = "";

        items.forEach((item) => {
            const card = new Card(item, type, options);
            container.appendChild(card.createElement());
        });
    }
}
