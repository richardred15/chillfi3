/**
 * Album View Component
 */
import { formatDuration } from '../utils/formatters.js';

export default class AlbumView {
    constructor(api, toast) {
        this.api = api;
        this.toast = toast;
        this.currentAlbum = null;
        this.init();
    }

    init() {
        this.createAlbumViewHTML();
        this.setupEventListeners();
    }

    createAlbumViewHTML() {
        const albumViewHTML = `
            <section class="section album-view" id="albumView" style="display: none;">
                <div class="album-view-content">
                    <div class="album-info">
                        <div class="album-cover"></div>
                        <div class="album-details">
                            <h1 class="album-title"></h1>
                            <p class="album-artist"></p>
                            <p class="album-year"></p>
                            <div class="album-actions">
                                <button class="album-play-all">
                                    <img src="client/icons/play.svg" alt="Play" width="20" height="20">
                                    Play All
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="album-tracks">
                        <div class="song-list-header">
                            <div class="song-list-header-item">#</div>
                            <div class="song-list-header-item">Title</div>
                            <div class="song-list-header-item">Duration</div>
                        </div>
                        <div class="album-song-list"></div>
                    </div>
                </div>
            </section>
        `;

        const contentDiv = document.getElementById('content');
        if (contentDiv) {
            contentDiv.insertAdjacentHTML('beforeend', albumViewHTML);
        }
    }

    setupEventListeners() {
        const playAllButton = document.querySelector('.album-play-all');

        if (playAllButton) {
            playAllButton.addEventListener('click', () => this.playAll());
        }
    }

    async show(albumTitle, artistName, albumId = null) {
        try {
            // Get album songs from API - try by album_id first, then fallback to name search
            let response;
            if (albumId) {
                response = await this.api.getSongs({ album_id: albumId }, 1, 100);
            } else {
                response = await this.api.getSongs({ 
                    album: albumTitle, 
                    artist: artistName 
                }, 1, 100);
            }
            
            // Check different possible response structures
            const songs = response.songs || response.data?.items || response.data?.songs || [];
            
            if (!songs || songs.length === 0) {
                this.toast.show('No songs found in this album');
                return;
            }

            this.currentAlbum = {
                title: albumTitle,
                artist: artistName,
                songs: songs.sort((a, b) => (a.track_number || 0) - (b.track_number || 0))
            };

            this.renderAlbum();
            this.showSection();
            
            // Update page metadata for link previews
            this.updatePageMetadata();
            
            // Update URL
            const url = new URL(window.location);
            url.searchParams.set('album', albumId || albumTitle);
            if (artistName) url.searchParams.set('artist', artistName);
            window.history.pushState({ albumId, albumTitle, artistName }, '', url);

        } catch (error) {
            console.error('Failed to load album:', error);
            this.toast.show('Failed to load album');
        }
    }

    renderAlbum() {
        if (!this.currentAlbum) return;

        const albumCover = document.querySelector('.album-cover');
        const albumTitle = document.querySelector('.album-title');
        const albumArtist = document.querySelector('.album-artist');
        const albumYear = document.querySelector('.album-year');
        const songList = document.querySelector('.album-song-list');

        // Set album info
        if (albumTitle) albumTitle.textContent = this.currentAlbum.title;
        if (albumArtist) albumArtist.textContent = this.currentAlbum.artist;

        // Set album cover
        const firstSong = this.currentAlbum.songs[0];
        if (albumCover && firstSong) {
            if (firstSong.cover_art_url) {
                albumCover.style.cssText = `background: url(${firstSong.cover_art_url}) center/cover no-repeat`;
            } else {
                albumCover.style.cssText = 'background: linear-gradient(45deg, #8C67EF, #4F9EFF)';
            }
        }

        // Set year
        if (albumYear && firstSong?.year) {
            albumYear.textContent = firstSong.year;
        }

        // Render songs
        if (songList) {
            songList.innerHTML = '';
            
            this.currentAlbum.songs.forEach((song, index) => {
                const songItem = document.createElement('div');
                songItem.className = 'song-item';
                songItem.dataset.songId = song.id;
                
                songItem.innerHTML = `
                    <div class="song-number">${song.track_number || index + 1}</div>
                    <div class="song-title">${song.title}</div>
                    <div class="song-duration">${formatDuration(song.duration)}</div>
                `;

                songItem.addEventListener('click', () => this.playSong(song));
                songList.appendChild(songItem);
            });
        }
    }

    async playSong(song) {
        try {
            const response = await this.api.playSong(song.id);
            
            if (window.player) {
                // Build queue from album songs
                const queue = [];
                for (const albumSong of this.currentAlbum.songs) {
                    try {
                        const songResponse = await this.api.playSong(albumSong.id);
                        queue.push({
                            url: songResponse.url,
                            metadata: {
                                id: albumSong.id,
                                title: albumSong.title,
                                artist: albumSong.artist || 'Unknown Artist',
                                album: albumSong.album,
                                artwork: albumSong.cover_art_url,
                                duration: albumSong.duration
                            }
                        });
                    } catch (error) {
                        console.error('Failed to get song URL for queue:', error);
                    }
                }

                window.player.playSong({
                    url: response.url,
                    metadata: {
                        id: song.id,
                        title: song.title,
                        artist: song.artist || 'Unknown Artist',
                        album: song.album,
                        artwork: song.cover_art_url,
                        duration: song.duration
                    }
                }, queue);
            }
            
            await this.api.recordListen(song.id);
            this.toast.show(`Now playing: ${song.title}`);
            
        } catch (error) {
            console.error('Failed to play song:', error);
            this.toast.show('Failed to play song');
        }
    }

    async playAll() {
        if (this.currentAlbum && this.currentAlbum.songs.length > 0) {
            await this.playSong(this.currentAlbum.songs[0]);
        }
    }

    hide() {
        const albumView = document.getElementById('albumView');
        if (albumView) {
            albumView.style.display = 'none';
        }
        this.currentAlbum = null;
        
        // Reset page metadata
        this.resetPageMetadata();
        
        // Clear URL params
        const url = new URL(window.location);
        url.searchParams.delete('album');
        url.searchParams.delete('artist');
        window.history.pushState({}, '', url);
    }
    
    updatePageMetadata() {
        if (!this.currentAlbum) return;
        
        const { title, artist, songs } = this.currentAlbum;
        const firstSong = songs[0];
        const albumArt = firstSong?.cover_art_url;
        const year = firstSong?.year;
        const trackCount = songs.length;
        
        // Update page title
        document.title = `${title} by ${artist} - ChillFi3`;
        
        // Update or create meta tags
        this.setMetaTag('description', `Listen to ${title} by ${artist} on ChillFi3. Album contains ${trackCount} tracks${year ? ` from ${year}` : ''}.`);
        this.setMetaTag('og:title', `${title} by ${artist}`);
        this.setMetaTag('og:description', `Listen to ${title} by ${artist} on ChillFi3. Album contains ${trackCount} tracks${year ? ` from ${year}` : ''}.`);
        this.setMetaTag('og:type', 'music.album');
        this.setMetaTag('og:url', window.location.href);
        
        if (albumArt) {
            this.setMetaTag('og:image', albumArt);
            this.setMetaTag('og:image:width', '400');
            this.setMetaTag('og:image:height', '400');
        }
        
        // Twitter Card
        this.setMetaTag('twitter:card', 'summary_large_image');
        this.setMetaTag('twitter:title', `${title} by ${artist}`);
        this.setMetaTag('twitter:description', `Listen to ${title} by ${artist} on ChillFi3. Album contains ${trackCount} tracks${year ? ` from ${year}` : ''}.`);
        if (albumArt) {
            this.setMetaTag('twitter:image', albumArt);
        }
        
        // Music-specific meta tags
        this.setMetaTag('music:album', title);
        this.setMetaTag('music:musician', artist);
        if (year) {
            this.setMetaTag('music:release_date', year.toString());
        }
    }
    
    resetPageMetadata() {
        document.title = 'ChillFi3 - Private Music Library';
        
        // Remove dynamic meta tags
        const metaTagsToRemove = [
            'description', 'og:title', 'og:description', 'og:type', 'og:url', 'og:image', 
            'og:image:width', 'og:image:height', 'twitter:card', 'twitter:title', 
            'twitter:description', 'twitter:image', 'music:album', 'music:musician', 'music:release_date'
        ];
        
        metaTagsToRemove.forEach(name => {
            const existing = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
            if (existing) {
                existing.remove();
            }
        });
    }
    
    setMetaTag(name, content) {
        // Remove existing tag
        const existing = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
        if (existing) {
            existing.remove();
        }
        
        // Create new tag
        const meta = document.createElement('meta');
        if (name.startsWith('og:') || name.startsWith('music:')) {
            meta.setAttribute('property', name);
        } else {
            meta.setAttribute('name', name);
        }
        meta.setAttribute('content', content);
        document.head.appendChild(meta);
    }
    
    showSection() {
        // Hide all other sections
        const sections = document.querySelectorAll('#content .section');
        sections.forEach(section => {
            if (section.id !== 'albumView') {
                section.style.display = 'none';
            }
        });
        
        // Remove active class from nav items
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => item.classList.remove('active'));
        
        // Show album view
        const albumView = document.getElementById('albumView');
        if (albumView) {
            albumView.style.display = 'block';
        }
    }


}