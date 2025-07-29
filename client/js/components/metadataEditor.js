/**
 * Metadata Editor Component
 */
class MetadataEditor {
    constructor(api, toast) {
        this.api = api;
        this.toast = toast;
        this.currentSong = null;
    }

    // Show metadata editor modal
    show(songData, isAlbum = false, editMode = 'song') {
        this.currentSong = songData;
        this.isAlbum = isAlbum;
        this.editMode = editMode; // 'song', 'album', or 'artist'
        const modal = this.createModal();
        document.body.appendChild(modal);
    }

    // Create metadata editor modal
    createModal() {
        const modal = document.createElement("div");
        modal.className = "metadata-modal";
        
        const isArtist = this.editMode === 'artist';
        const modalTitle = isArtist ? 'Edit Artist' : (this.isAlbum ? 'Edit Album' : 'Edit Song Metadata');
        const artLabel = isArtist ? 'Artist Image' : 'Album Art';
        
        modal.innerHTML = `
            <div class="metadata-modal-content">
                <div class="metadata-modal-header">
                    <h2>${modalTitle}</h2>
                    <button class="metadata-modal-close"><img src="client/icons/close.svg" alt="Close" width="16" height="16"></button>
                </div>
                <form class="metadata-form" id="metadataForm">
                    <div class="form-group">
                        <label>${artLabel}</label>
                        <div class="album-art-section">
                            <div class="album-art-preview" id="albumArtPreview">
                                <img src="client/icons/upload.svg" alt="Upload" width="24" height="24">
                            </div>
                            <input type="file" id="albumArtInput" accept="image/*" style="display: none;">
                            <button type="button" class="btn-upload-art" onclick="document.getElementById('albumArtInput').click()">Change ${isArtist ? 'Image' : 'Art'}</button>
                        </div>
                    </div>
                    ${isArtist ? `
                        <div class="form-group">
                            <label for="artistName">Artist Name</label>
                            <input type="text" id="artistName" name="name" value="${this.currentSong.title || ""}" required>
                        </div>
                        <div class="form-group">
                            <label for="artistBio">Biography</label>
                            <textarea id="artistBio" name="bio" rows="4" placeholder="Enter artist biography...">${this.currentSong.bio || ""}</textarea>
                        </div>
                    ` : `
                        <div class="form-group" ${this.isAlbum ? 'style="display: none;"' : ''}>
                            <label for="songTitle">Title</label>
                            <input type="text" id="songTitle" name="title" value="${
                                this.currentSong.title || ""
                            }" ${this.isAlbum ? 'disabled' : 'required'}>
                        </div>
                        <div class="form-group" ${this.isAlbum ? 'style="display: none;"' : ''}>
                            <label for="songArtist">Artist</label>
                            <input type="text" id="songArtist" name="artist" value="${
                                this.currentSong.artist || ""
                            }" ${this.isAlbum ? 'disabled' : 'required'}>
                        </div>
                        <div class="form-group">
                            <label for="songAlbum">${this.isAlbum ? 'Album Name' : 'Album'}</label>
                            <input type="text" id="songAlbum" name="album" value="${
                                this.currentSong.album || ""
                            }" ${this.isAlbum ? 'required' : ''}>
                        </div>
                        <div class="form-group">
                            <label for="songGenre">Genre</label>
                            <input type="text" id="songGenre" name="genre" value="${
                                this.currentSong.genre || ""
                            }">
                        </div>
                        <div class="form-group" ${this.isAlbum ? 'style="display: none;"' : ''}>
                            <label for="songTrackNumber">Track Number</label>
                            <input type="number" id="songTrackNumber" name="track_number" value="${
                                this.currentSong.track_number || ""
                            }" min="1" ${this.isAlbum ? 'disabled' : ''}>
                        </div>
                    `}
                    <div class="form-actions">
                        <button type="button" class="btn-cancel">Cancel</button>
                        <button type="submit" class="btn-save">Save Changes</button>
                    </div>
                </form>
            </div>
        `;

        // Handle form submission
        const form = modal.querySelector("#metadataForm");
        form.addEventListener("submit", (e) => this.handleSubmit(e, modal));

        // Setup album art preview
        this.setupAlbumArt(modal);
        
        // Handle close buttons
        const closeBtn = modal.querySelector(".metadata-modal-close");
        const cancelBtn = modal.querySelector(".btn-cancel");

        closeBtn.addEventListener("click", () => modal.remove());
        cancelBtn.addEventListener("click", () => modal.remove());

        // Close on backdrop click
        modal.addEventListener("click", (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });

        return modal;
    }

    // Handle form submission
    async handleSubmit(e, modal) {
        e.preventDefault();

        const formData = new FormData(e.target);
        const metadata = Object.fromEntries(formData.entries());
        
        // For album editing, only include allowed fields
        if (this.isAlbum) {
            const allowedFields = ['album', 'genre'];
            const filteredMetadata = {};
            allowedFields.forEach(field => {
                if (metadata[field] !== undefined) {
                    filteredMetadata[field] = metadata[field];
                }
            });
            Object.assign(metadata, filteredMetadata);
            // Remove disabled fields
            delete metadata.title;
            delete metadata.artist;
            delete metadata.track_number;
        }
        
        // Include album art if changed
        const preview = modal.querySelector('#albumArtPreview');
        if (preview.dataset.newArt) {
            metadata.cover_art = preview.dataset.newArt;
        } else if (preview.dataset.newArtUrl) {
            metadata.cover_art_url = preview.dataset.newArtUrl;
        }
        
        metadata.isAlbum = this.isAlbum;
        
        const saveBtn = modal.querySelector(".btn-save");

        saveBtn.disabled = true;
        saveBtn.textContent = "Saving...";

        try {
            let response;
            if (this.editMode === 'artist') {
                // Use artist update endpoint
                const artistUpdates = {
                    name: metadata.name,
                    bio: metadata.bio
                };
                // Include image if changed
                const preview = modal.querySelector('#albumArtPreview');
                if (preview.dataset.newArt) {
                    artistUpdates.image_data = preview.dataset.newArt;
                } else if (preview.dataset.newArtUrl) {
                    artistUpdates.image_url = preview.dataset.newArtUrl;
                }
                response = await this.api.updateArtist(this.currentSong.id, artistUpdates);
            } else if (this.isAlbum) {
                // Use album update endpoint
                const albumUpdates = {
                    title: metadata.album,
                    release_year: metadata.year
                };
                response = await this.api.updateAlbum(this.currentSong.album_id, albumUpdates);
            } else {
                // Use song update endpoint
                response = await this.api.updateSong(this.currentSong.id, metadata);
            }
            
            if (response.success) {
                const successMessage = this.editMode === 'artist' ? "Artist updated successfully" : 
                                     (this.isAlbum ? "Album updated successfully" : "Metadata updated successfully");
                this.toast.show(successMessage);
                modal.remove();

                // Refresh content if content manager exists
                if (window.contentManager) {
                    if (this.editMode === 'artist') {
                        // For artist updates, refresh artist-related content without full reset
                        const currentSection = document.querySelector('.section[style*="block"]');
                        if (currentSection) {
                            const sectionId = currentSection.id;
                            if (sectionId.includes('artist') || sectionId.includes('Artist')) {
                                // Refresh the current artist view
                                if (sectionId === 'artistsSection') {
                                    window.contentManager.loadArtists();
                                } else if (sectionId === 'artistAlbumsSection') {
                                    // Keep the current artist albums view
                                    const title = currentSection.querySelector('.section-title')?.textContent;
                                    if (title && title.includes('Albums by')) {
                                        const artistName = title.replace('Albums by ', '');
                                        window.contentManager.showArtistAlbums('current_user', artistName);
                                    }
                                }
                            } else {
                                // For other sections, do minimal refresh
                                window.contentManager.renderHomeSections();
                            }
                        }
                    } else {
                        window.contentManager.init();
                    }
                }
            } else {
                throw new Error(response.message || "Update failed");
            }
        } catch (error) {
            console.error("Failed to update metadata:", error);
            this.toast.show("Failed to update metadata");
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = "Save Changes";
        }
    }
    
    // Setup album art functionality
    setupAlbumArt(modal) {
        const preview = modal.querySelector('#albumArtPreview');
        const input = modal.querySelector('#albumArtInput');
        
        // Load existing album art if available
        if (this.currentSong.cover_art_url) {
            preview.style.backgroundImage = `url(${this.currentSong.cover_art_url})`;
            preview.style.backgroundSize = 'cover';
            preview.style.backgroundPosition = 'center';
            preview.innerHTML = '';
        }
        
        // Handle file selection
        input.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file && file.type.startsWith('image/')) {
                await this.handleImageUpload(file, preview);
            }
        });
    }
    
    // Handle image upload with chunking for large files
    async handleImageUpload(file, preview) {
        const MAX_SIZE = 2 * 1024 * 1024; // 2MB threshold for chunking
        
        // Show preview immediately
        const reader = new FileReader();
        reader.onload = (e) => {
            preview.style.backgroundImage = `url(${e.target.result})`;
            preview.style.backgroundSize = 'cover';
            preview.style.backgroundPosition = 'center';
            preview.innerHTML = '';
        };
        reader.readAsDataURL(file);
        
        try {
            if (file.size <= MAX_SIZE) {
                // Small file - use direct upload
                const dataUrl = await this.fileToDataUrl(file);
                preview.dataset.newArt = dataUrl;
            } else {
                // Large file - use chunked upload
                const imageUrl = await this.uploadImageChunked(file);
                preview.dataset.newArtUrl = imageUrl;
            }
        } catch (error) {
            console.error('Image upload failed:', error);
            this.toast.show('Failed to process image');
        }
    }
    
    // Convert file to data URL
    fileToDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
    
    // Upload image in chunks
    async uploadImageChunked(file) {
        const CHUNK_SIZE = 512 * 1024; // 512KB chunks
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
        const uploadId = Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        let imageUrl = null;
        
        for (let i = 0; i < totalChunks; i++) {
            const start = i * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, file.size);
            const chunk = file.slice(start, end);
            
            const chunkData = await this.fileToDataUrl(chunk);
            
            const response = await this.api.uploadImageChunk({
                uploadId,
                chunkIndex: i,
                totalChunks,
                data: chunkData,
                filename: file.name,
                mimeType: file.type
            });
            
            // Last chunk returns the image URL
            if (response.imageUrl) {
                imageUrl = response.imageUrl;
            }
        }
        
        return imageUrl;
    }
}

export default MetadataEditor;
