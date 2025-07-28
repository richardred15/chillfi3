/**
 * Playlist Manager Component
 */
import URLManager from '../utils/urlManager.js';

export default class PlaylistManager {
    constructor(api, toast) {
        this.api = api;
        this.toast = toast;
        this.playlists = [];
        this.init();
    }
    
    init() {
        this.loadPlaylists();
    }
    
    async loadPlaylists() {
        try {
            const response = await this.api.getPlaylists();
            this.playlists = response.data?.playlists || response.playlists || [];
            this.updateSidebar();
        } catch (error) {
            console.error('Failed to load playlists:', error);
        }
    }
    
    updateSidebar() {
        const playlistSection = document.querySelector('.playlist-section');
        if (!playlistSection) return;
        
        // Remove existing playlist items (keep title)
        const existingItems = playlistSection.querySelectorAll('.nav-item, .playlist-empty');
        existingItems.forEach(item => item.remove());
        
        if (this.playlists.length === 0) {
            const emptyDiv = document.createElement('div');
            emptyDiv.className = 'playlist-empty';
            emptyDiv.textContent = 'No playlists yet';
            playlistSection.appendChild(emptyDiv);
        } else {
            this.playlists.forEach(playlist => {
                const playlistItem = document.createElement('div');
                playlistItem.className = 'nav-item';
                playlistItem.innerHTML = `
                    <img src="client/icons/playlist.svg" alt="Playlist" class="nav-item-icon" data-theme-svg="true">
                    <span class="nav-item-text">${playlist.name}</span>
                `;
                
                playlistItem.addEventListener('click', () => {
                    this.openPlaylist(playlist.id, playlist.name);
                    // Update URL using URLManager
                    URLManager.setURL({ playlist: playlist.id });
                });
                
                playlistSection.appendChild(playlistItem);
            });
            
            // Update theme for newly added playlist icons
            if (window.themeSwitcher && typeof window.themeSwitcher.updateThemeIcons === 'function') {
                window.themeSwitcher.updateThemeIcons();
            }
        }
    }
    
    async openPlaylist(playlistId, playlistName) {
        try {
            const response = await this.api.getPlaylist(playlistId);
            const playlist = response.playlist;
            const songs = response.songs || [];
            
            if (!playlist) {
                console.error('No playlist data in response:', response);
                this.toast.show('Playlist not found');
                return;
            }
            
            // Show playlist content
            this.showPlaylistContent(playlist, songs);
            
        } catch (error) {
            console.error('Failed to load playlist:', error);
            this.toast.show('Failed to load playlist');
        }
    }
    
    showPlaylistContent(playlist, songs) {
        // Show playlist content section
        if (window.contentManager) {
            window.contentManager.showSection('playlistContent');
        }
        
        // Create or get playlist section
        let playlistSection = document.getElementById('playlistContent');
        if (!playlistSection) {
            playlistSection = document.createElement('section');
            playlistSection.id = 'playlistContent';
            playlistSection.className = 'section';
            document.getElementById('content').appendChild(playlistSection);
        }
        
        playlistSection.style.display = 'block';
        
        // Set active nav item for current playlist
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => item.classList.remove('active'));
        const playlistNavItem = Array.from(navItems).find(
            item => item.querySelector('.nav-item-text')?.textContent === playlist.name
        );
        if (playlistNavItem) {
            playlistNavItem.classList.add('active');
        }
        
        console.log('Showing playlist:', playlist, 'Songs:', songs);
        
        // Check if user can edit (owner or admin)
        const canEdit = this.api.user && (this.api.user.id === playlist.user_id || this.api.user.is_admin);
        const editButtons = canEdit ? `
            <button class="btn btn-secondary" onclick="window.playlistManager.editPlaylist(${playlist.id})">Edit</button>
            <button class="btn btn-secondary" onclick="window.playlistManager.deletePlaylist(${playlist.id})">Delete</button>
        ` : '';
        
        playlistSection.innerHTML = `
            <div class="section-header">
                <h2 class="section-title">${playlist.name}</h2>
                <div class="section-actions">
                    ${editButtons}
                    <button class="btn btn-primary" onclick="window.playlistManager.playPlaylist(${playlist.id})">Play All</button>
                </div>
            </div>
            <div class="playlist-info">
                <p>${songs.length} songs • ${playlist.is_public ? 'Public' : 'Private'}</p>
            </div>
            <div class="song-list">
                <div class="song-list-header">
                    <div class="song-list-header-item">#</div>
                    <div class="song-list-header-item">Title</div>
                    <div class="song-list-header-item">Artist</div>
                    <div class="song-list-header-item">Duration</div>
                </div>
                <div id="playlistSongsList"></div>
            </div>
        `;
        
        // Populate songs
        const songsList = document.getElementById('playlistSongsList');
        
        if (songs.length === 0) {
            songsList.innerHTML = '<div class="song-item-empty">No songs in this playlist</div>';
            return;
        }
        
        songs.forEach((song, index) => {
            const songItem = document.createElement('div');
            songItem.className = 'song-item';
            songItem.dataset.songId = song.id;
            songItem.innerHTML = `
                <div class="song-number">${index + 1}</div>
                <div class="song-info">
                    <div class="song-title">${song.title}</div>
                </div>
                <div class="song-artist">${song.artist || 'Unknown Artist'}</div>
                <div class="song-duration">${this.formatDuration(song.duration || 0)}</div>
            `;
            
            songItem.addEventListener('click', () => {
                if (window.contentManager) {
                    window.contentManager.playSong(song);
                }
            });
            
            songsList.appendChild(songItem);
        });
    }
    
    async playPlaylist(playlistId) {
        try {
            const response = await this.api.getPlaylist(playlistId);
            const songs = response.songs || [];
            
            if (songs.length > 0 && window.contentManager) {
                await window.contentManager.playSong(songs[0]);
            }
        } catch (error) {
            console.error('Failed to play playlist:', error);
            this.toast.show('Failed to play playlist');
        }
    }
    
    formatDuration(seconds) {
        if (!seconds) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    async editPlaylist(playlistId) {
        try {
            // Get current playlist data
            const response = await this.api.getPlaylist(playlistId);
            const playlist = response.playlist;
            const songs = response.songs || [];
            
            if (!playlist) {
                this.toast.show('Playlist not found');
                return;
            }
            
            this.showEditPlaylistModal(playlist, songs);
        } catch (error) {
            console.error('Failed to load playlist for editing:', error);
            this.toast.show('Failed to load playlist');
        }
    }
    
    showEditPlaylistModal(playlist, songs) {
        // Create modal if it doesn't exist
        let modal = document.getElementById('editPlaylistModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'editPlaylistModal';
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content" style="max-width: 600px;">
                    <div class="modal-header">
                        <h3>Edit Playlist</h3>
                        <button class="modal-close" id="editPlaylistClose">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label for="editPlaylistName">Playlist Name</label>
                            <input type="text" id="editPlaylistName" maxlength="100">
                        </div>
                        <div class="form-group">
                            <label>
                                <input type="checkbox" id="editPlaylistPublic"> Make playlist public
                            </label>
                        </div>
                        <div class="form-group">
                            <label>Songs (uncheck to remove)</label>
                            <div class="edit-playlist-songs" id="editPlaylistSongs"></div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" id="editPlaylistCancel">Cancel</button>
                        <button class="btn btn-primary" id="editPlaylistSave">Save Changes</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }
        
        // Populate form
        document.getElementById('editPlaylistName').value = playlist.name;
        document.getElementById('editPlaylistPublic').checked = playlist.is_public;
        
        // Populate songs
        const songsContainer = document.getElementById('editPlaylistSongs');
        songsContainer.innerHTML = '';
        
        if (songs.length === 0) {
            songsContainer.innerHTML = '<p style="color: var(--text-secondary); font-style: italic;">No songs in this playlist</p>';
        } else {
            songs.forEach(song => {
                const songItem = document.createElement('div');
                songItem.className = 'edit-song-item';
                songItem.innerHTML = `
                    <label class="edit-song-label">
                        <div class="edit-song-info">
                            <div class="edit-song-title">${song.title}</div>
                            <div class="edit-song-artist">${song.artist || 'Unknown Artist'}</div>
                        </div>
                        <input type="checkbox" class="edit-song-checkbox" data-song-id="${song.id}" checked>
                    </label>
                `;
                songsContainer.appendChild(songItem);
            });
        }
        
        // Show modal
        modal.style.display = 'flex';
        document.getElementById('editPlaylistName').focus();
        
        // Event handlers
        const closeModal = () => {
            modal.style.display = 'none';
        };
        
        document.getElementById('editPlaylistClose').onclick = closeModal;
        document.getElementById('editPlaylistCancel').onclick = closeModal;
        
        document.getElementById('editPlaylistSave').onclick = async () => {
            const name = document.getElementById('editPlaylistName').value.trim();
            const isPublic = document.getElementById('editPlaylistPublic').checked;
            
            if (!name) {
                this.toast.show('Please enter a playlist name');
                return;
            }
            
            try {
                // Update playlist metadata
                await this.api.updatePlaylist(playlist.id, { name, is_public: isPublic });
                
                // Handle song removals
                const checkboxes = modal.querySelectorAll('.edit-song-checkbox');
                const removedSongs = [];
                
                checkboxes.forEach(checkbox => {
                    if (!checkbox.checked) {
                        removedSongs.push(checkbox.dataset.songId);
                    }
                });
                
                // Remove unchecked songs
                for (const songId of removedSongs) {
                    await this.api.removeSongFromPlaylist(playlist.id, songId);
                }
                
                this.toast.show('Playlist updated');
                closeModal();
                
                // Refresh playlist view and sidebar
                await this.refresh();
                await this.openPlaylist(playlist.id, name);
                
            } catch (error) {
                console.error('Failed to update playlist:', error);
                this.toast.show('Failed to update playlist');
            }
        };
        
        // Click outside to close
        modal.onclick = (e) => {
            if (e.target === modal) {
                closeModal();
            }
        };
    }
    
    async deletePlaylist(playlistId) {
        if (!confirm('Are you sure you want to delete this playlist?')) {
            return;
        }
        
        try {
            await this.api.deletePlaylist(playlistId);
            this.toast.show('Playlist deleted');
            
            // Refresh sidebar and go back to home
            await this.refresh();
            if (window.contentManager) {
                window.contentManager.showHomeSections();
            }
        } catch (error) {
            console.error('Failed to delete playlist:', error);
            this.toast.show('Failed to delete playlist');
        }
    }
    
    // Refresh playlists (called after creating new playlist)
    async refresh() {
        await this.loadPlaylists();
    }
}