/**
 * Share Manager Component - Handles shared content URLs
 */
import { formatDuration } from '../utils/formatters.js';
import URLManager from '../utils/urlManager.js';

class ShareManager {
    constructor(api, toast) {
        this.api = api;
        this.toast = toast;
    }

    // Handle share URLs
    handleShareURL() {
        let urlParams = new URLSearchParams(window.location.search);
        
        // Check for pending share URL from session storage
        const pendingShare = sessionStorage.getItem('pendingShareURL');
        if (pendingShare) {
            urlParams = new URLSearchParams(pendingShare);
            sessionStorage.removeItem('pendingShareURL');
        }
        
        // Check if user is authenticated
        if (!window.authManager?.isAuthenticated) {
            console.log('User not authenticated, cannot load shared content');
            return;
        }
        
        if (urlParams.has('song')) {
            const songId = urlParams.get('song');
            this.loadSharedSong(songId);
            return; // Stop processing other parameters
        }
        
        if (urlParams.has('album')) {
            const albumParam = urlParams.get('album');
            const artistParam = urlParams.get('artist');
            this.loadAlbumFromURL(albumParam, artistParam);
            return;
        }
        
        if (urlParams.has('playlist')) {
            const playlistId = urlParams.get('playlist');
            this.loadSharedPlaylist(playlistId);
            return;
        }
        
        if (urlParams.has('profile')) {
            const profileId = urlParams.get('profile');
            this.loadSharedProfile(profileId);
            return;
        }
        
        if (urlParams.has('library')) {
            const username = urlParams.get('library');
            this.loadLibraryFromURL(username);
            return;
        }
        
        if (urlParams.has('artist')) {
            const artistName = urlParams.get('artist');
            this.loadArtistFromURL(artistName);
            return;
        }
        
        if (urlParams.has('view')) {
            const view = urlParams.get('view');
            this.loadViewFromURL(view);
        }
    }

    // Load shared song
    async loadSharedSong(songId) {
        try {
            const response = await this.api.getSong(songId);
            const song = response.data?.song;
            if (song && window.albumView) {
                // Show the album containing this song
                await window.albumView.show(song.album, song.artist);
                
                // Highlight the specific song after album loads
                setTimeout(() => {
                    // Look specifically for song in album view container
                    const albumView = document.getElementById('albumView');
                    const songElement = albumView ? albumView.querySelector(`.song-item[data-song-id="${songId}"]`) : null;
                    console.log('Album view:', albumView);
                    console.log('Found album song element:', songElement);
                    if (songElement) {
                        console.log('Highlighting album song');
                        songElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        songElement.style.backgroundColor = 'rgba(140, 103, 239, 0.2)';
                        songElement.style.transition = 'background-color 0.3s ease';
                        
                        // Remove highlight on next user click
                        const removeHighlight = () => {
                            songElement.style.backgroundColor = '';
                            document.removeEventListener('click', removeHighlight);
                        };
                        document.addEventListener('click', removeHighlight);
                    } else {
                        console.log('Album song element not found, trying again...');
                        // Try again after more time
                        setTimeout(() => {
                            const albumView2 = document.getElementById('albumView');
                            const songElement2 = albumView2 ? albumView2.querySelector(`.song-item[data-song-id="${songId}"]`) : null;
                            if (songElement2) {
                                songElement2.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                songElement2.style.backgroundColor = 'rgba(140, 103, 239, 0.2)';
                                songElement2.style.transition = 'background-color 0.3s ease';
                            }
                        }, 1000);
                    }
                }, 500);
            }
        } catch (error) {
            console.error('Failed to load shared song:', error);
        }
    }

    // Load album from URL
    async loadAlbumFromURL(albumParam, artistParam) {
        try {
            if (window.albumView) {
                // Check if albumParam is numeric (album ID) or string (album name)
                const albumId = /^\d+$/.test(albumParam) ? parseInt(albumParam) : null;
                const albumTitle = albumId ? null : albumParam;
                
                if (albumId) {
                    // Load by ID - need to get album details first
                    const response = await this.api.getSongs({ album_id: albumId }, 1, 1);
                    const songs = response.songs || response.data?.items || [];
                    if (songs.length > 0) {
                        window.albumView.show(songs[0].album, songs[0].artist, albumId);
                    }
                } else {
                    // Load by name
                    window.albumView.show(albumTitle, artistParam);
                }
            }
        } catch (error) {
            console.error('Failed to load album from URL:', error);
        }
    }

    // Load library from URL
    loadLibraryFromURL(username) {
        if (window.contentManager) {
            if (username === 'current' || username === this.api?.user?.username) {
                window.contentManager.showMyLibrary();
            } else {
                window.contentManager.showUserLibrary(username);
            }
        }
    }
    
    // Load artist from URL
    async loadArtistFromURL(artistName) {
        try {
            if (window.contentManager) {
                // Use existing artist albums functionality
                await window.contentManager.showArtistAlbums(artistName, 'current_user');
            }
        } catch (error) {
            console.error('Failed to load artist from URL:', error);
        }
    }

    // Load view from URL
    loadViewFromURL(view) {
        if (window.contentManager) {
            switch (view) {
                case 'search':
                    window.contentManager.showSearchSection();
                    break;
                case 'library':
                    window.contentManager.showMyLibrary();
                    break;
                default:
                    window.contentManager.showHomeSections();
            }
        }
    }

    // Load shared playlist
    async loadSharedPlaylist(playlistId) {
        try {
            const response = await this.api.getPlaylist(playlistId);
            const playlist = response.playlist;
            const songs = response.songs || [];
            
            if (!playlist) {
                this.showPlaylistError('Playlist not found');
                return;
            }
            
            // Check if playlist is private and user doesn't have access
            if (!playlist.is_public && (!this.api.user || this.api.user.id !== playlist.user_id)) {
                this.showPlaylistError('This playlist is private');
                return;
            }
            
            // Show playlist content
            this.showSharedPlaylist(playlist, songs);
            
        } catch (error) {
            console.error('Failed to load shared playlist:', error);
            this.showPlaylistError('Failed to load playlist');
        }
    }

    showPlaylistError(message) {
        if (window.contentManager) {
            window.contentManager.showPlaylistError(message);
        }
    }

    showSharedPlaylist(playlist, songs, updateUrl = false) {
        // Only update URL if this is user-initiated navigation
        if (updateUrl) {
            URLManager.setURL({ playlist: playlist.id });
        }
        
        if (window.contentManager) {
            window.contentManager.showSharedPlaylist(playlist, songs, this);
        }
        
        // Set active nav item for shared playlist
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => item.classList.remove('active'));
        const playlistNavItem = Array.from(navItems).find(
            item => item.querySelector('.nav-item-text')?.textContent === playlist.name
        );
        if (playlistNavItem) {
            playlistNavItem.classList.add('active');
        }
    }

    async playSharedPlaylist(playlistId) {
        try {
            const response = await this.api.getPlaylist(playlistId);
            const songs = response.songs || [];
            
            if (songs.length > 0 && window.contentManager) {
                await window.contentManager.playSong(songs[0]);
            }
        } catch (error) {
            console.error('Failed to play playlist:', error);
        }
    }

    // Load shared profile
    async loadSharedProfile(profileId) {
        try {
            const response = await this.api.getUserProfile(profileId);
            if (response.user) {
                this.showSharedContent('profile', response.user, response.recentUploads || []);
            }
        } catch (error) {
            console.error('Failed to load shared profile:', error);
        }
    }

    // Helper functions for playing content
    async playSong(songId) {
        try {
            const response = await this.api.getSong(songId);
            if (response.song && window.contentManager) {
                await window.contentManager.playSong(response.song);
            }
        } catch (error) {
            console.error('Failed to play song:', error);
        }
    }

    async playAlbum(albumName) {
        try {
            const response = await this.api.getSongs({ search: albumName }, 1, 100);
            const albumSongs = response.songs.filter(s => s.album === albumName);
            if (albumSongs.length > 0 && window.contentManager) {
                await window.contentManager.playSong(albumSongs[0]);
            }
        } catch (error) {
            console.error('Failed to play album:', error);
        }
    }

    // Show shared content
    showSharedContent(type, item, items = []) {
        if (window.contentManager) {
            window.contentManager.showSharedContent(type, item, items, this);
        }
    }
}

export default ShareManager;