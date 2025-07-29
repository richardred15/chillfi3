/**
 * Universal Context Menu Component
 */
export default class ContextMenu {
    constructor(api, toast, metadataEditor) {
        this.api = api;
        this.toast = toast;
        this.metadataEditor = metadataEditor;
        this.currentSong = null;
        this.menu = null;
        this.playlists = [];
        this.init();
    }

    init() {
        this.createMenu();
        this.setupEventListeners();
    }

    createMenu() {
        this.menu = document.createElement("div");
        this.menu.className = "context-menu";
        this.menu.innerHTML = `
            <div class="context-menu-item" data-action="play">
                <img src="client/icons/play.svg" alt="Play" width="16" height="16">
                <span class="context-menu-text">Play</span>
            </div>
            <div class="context-menu-item" data-action="queue">
                <img src="client/icons/queue.svg" alt="Add to Queue" width="16" height="16">
                <span class="context-menu-text">Add to Queue</span>
            </div>
            <div class="context-menu-item context-menu-submenu" data-action="playlist">
                <img src="client/icons/playlist.svg" alt="Add to Playlist" width="16" height="16">
                <span class="context-menu-text">Add to Playlist</span>
                <span class="context-menu-arrow">▶</span>
                <div class="context-submenu" id="playlistSubmenu">
                    <div class="context-menu-item" data-action="create-playlist">
                        <img src="client/icons/add.svg" alt="Create Playlist" width="16" height="16">
                        <span class="context-menu-text">Create New Playlist</span>
                    </div>
                    <div class="context-menu-separator"></div>
                    <div class="playlist-list"></div>
                </div>
            </div>
            <div class="context-menu-item" data-action="share">
                <img src="client/icons/share.svg" alt="Share" width="16" height="16">
                <span class="context-menu-text">Share</span>
            </div>
            <div class="context-menu-separator"></div>
            <div class="context-menu-item" data-action="edit">
                <img src="client/icons/edit.svg" alt="Edit" width="16" height="16">
                <span class="context-menu-text">Edit Metadata</span>
            </div>
        `;

        this.menu.style.display = "none";
        document.body.appendChild(this.menu);

        // Add menu item click handlers
        this.menu.addEventListener("click", (e) => {
            const item = e.target.closest(".context-menu-item");
            if (item && !item.classList.contains("context-menu-submenu")) {
                this.handleMenuAction(
                    item.dataset.action,
                    item.dataset.playlistId
                );
                this.hideMenu();
            }
        });

        // Handle submenu hover
        const playlistItem = this.menu.querySelector(
            '[data-action="playlist"]'
        );
        if (playlistItem) {
            playlistItem.addEventListener("mouseenter", () => {
                this.loadPlaylists();
            });
        }
    }

    setupEventListeners() {
        // Universal right-click handler
        document.addEventListener("contextmenu", (e) => {
            const songElement = e.target.closest(".song-item, .card");
            if (songElement) {
                e.preventDefault();
                this.showMenu(e, songElement);
            }
        });

        // Add touch and hold for mobile
        let touchTimer;
        let touchStarted = false;
        document.addEventListener("touchstart", (e) => {
            const songElement = e.target.closest(".song-item, .card");
            if (songElement) {
                touchStarted = true;
                touchTimer = setTimeout(() => {
                    if (touchStarted) {
                        this.showMenu(
                            {
                                pageX: e.touches[0].pageX,
                                pageY: e.touches[0].pageY,
                            },
                            songElement
                        );
                    }
                }, 500);
            }
        });

        document.addEventListener("touchend", () => {
            touchStarted = false;
            if (touchTimer) {
                clearTimeout(touchTimer);
            }
        });

        document.addEventListener("touchmove", () => {
            touchStarted = false;
            if (touchTimer) {
                clearTimeout(touchTimer);
            }
        });

        // Hide menu on click outside
        document.addEventListener("click", (e) => {
            if (!this.menu.contains(e.target)) {
                this.hideMenu();
            }
        });
    }

    showMenu(e, songElement) {
        // Get song data from element
        this.currentSong = this.getSongDataFromElement(songElement);
        this.currentElement = songElement; // Store reference to element

        if (!this.currentSong) return;

        // Position the menu
        this.menu.style.left = `${e.pageX}px`;
        this.menu.style.top = `${e.pageY}px`;
        this.menu.style.display = "block";
    }

    hideMenu() {
        this.menu.style.display = "none";
    }

    getSongDataFromElement(element) {
        const itemId = element.dataset.itemId || element.dataset.songId; // Support both new and old formats
        const itemType = element.dataset.itemType || element.dataset.type;

        if (itemId) {
            const title = element.dataset.itemTitle || element.dataset.songTitle || element.dataset.albumTitle;
            const artist = element.dataset.itemArtist || element.dataset.songArtist || element.dataset.artistName;

            return {
                id: itemId,
                title: title,
                artist: artist,
                type: itemType,
            };
        }
        return null;
    }

    async handleMenuAction(action) {
        if (!this.currentSong) return;

        switch (action) {
            case "play":
                await this.playSong();
                break;
            case "edit":
                await this.editMetadata();
                break;
            case "queue":
                await this.addToQueue();
                break;
            case "share":
                console.log("Share action triggered");
                this.showShareModal();
                break;
            case "create-playlist":
                this.showCreatePlaylistModal();
                break;
            case "add-to-playlist":
                this.addToPlaylist(arguments[1]); // playlistId
                break;
        }
    }

    async playSong() {
        try {
            const isAlbum =
                this.currentElement &&
                this.currentElement.dataset.type === "album";

            if (isAlbum) {
                // Get songs from album using album title and artist
                const albumTitle = this.currentSong.title;
                const albumArtist = this.currentSong.artist;

                const albumResponse = await this.api.getSongs(
                    {
                        search: albumTitle,
                    },
                    1,
                    100
                );

                const songs =
                    albumResponse.data?.items || albumResponse.songs || [];
                const albumSongs = songs.filter(
                    (s) => s.album === albumTitle && s.artist === albumArtist
                );

                if (window.albumView && albumSongs.length > 0) {
                    window.albumView.show(albumTitle, albumArtist);
                }
            } else {
                // Simulate clicking on the song element
                const element = document.querySelector(
                    `[data-song-id="${this.currentSong.id}"]`
                );
                if (element) {
                    element.click();
                }
            }
        } catch (error) {
            console.error("Failed to play:", error);
            this.toast.show("Failed to play");
        }
    }

    async addToQueue() {
        try {
            const isAlbum =
                this.currentElement &&
                this.currentElement.dataset.type === "album";

            if (isAlbum) {
                // Get songs from album using album title and artist
                const albumTitle = this.currentSong.title;
                const albumArtist = this.currentSong.artist;

                const albumResponse = await this.api.getSongs(
                    {
                        search: albumTitle,
                    },
                    1,
                    100
                );

                const songs =
                    albumResponse.data?.items || albumResponse.songs || [];
                const albumSongs = songs.filter(
                    (s) => s.album === albumTitle && s.artist === albumArtist
                );

                if (window.player && albumSongs.length > 0) {
                    if (window.player.queue.length === 0) {
                        // No existing queue, play first song and create queue
                        if (window.contentManager) {
                            window.contentManager.playSong(albumSongs[0]);
                        }
                    } else {
                        // Add to existing queue
                        for (const song of albumSongs) {
                            try {
                                const response = await this.api.playSong(
                                    song.id
                                );
                                window.player.queue.push({
                                    url: response.url,
                                    metadata: {
                                        id: song.id,
                                        title: song.title,
                                        artist: song.artist,
                                        album: song.album,
                                        artwork:
                                            song.cover_art_url ||
                                            song.artwork_url,
                                        duration: song.duration,
                                    },
                                });
                            } catch (error) {
                                console.error(
                                    "Failed to get song URL for queue:",
                                    error
                                );
                            }
                        }
                        window.player.updateQueueUI();
                    }
                }
                this.toast.show(`Added ${albumSongs.length} songs to queue`);
            } else {
                // Add single song to queue
                if (window.player) {
                    if (window.player.queue.length === 0) {
                        // No existing queue, simulate clicking the song
                        this.currentElement.click();
                    } else {
                        // Add to existing queue
                        try {
                            const response = await this.api.playSong(
                                this.currentSong.id
                            );
                            window.player.queue.push({
                                url: response.url,
                                metadata: {
                                    id: this.currentSong.id,
                                    title: this.currentSong.title,
                                    artist: this.currentSong.artist,
                                    artwork: this.currentSong.artwork,
                                },
                            });
                            window.player.updateQueueUI();
                        } catch (error) {
                            console.error(
                                "Failed to get song URL for queue:",
                                error
                            );
                        }
                    }
                }
                this.toast.show("Added to queue");
            }
        } catch (error) {
            console.error("Failed to add to queue:", error);
            this.toast.show("Failed to add to queue");
        }
    }

    async showShareModal() {
        console.log("showShareModal called", this.currentSong);
        const modal = document.getElementById("shareModal");
        console.log("Share modal element:", modal);
        const itemType = this.currentElement && (this.currentElement.dataset.itemType || this.currentElement.dataset.type);
        const isAlbum = itemType === "album";
        const isArtist = itemType === "artist";
        console.log("Item type:", itemType, "Is album:", isAlbum, "Is artist:", isArtist);

        // Populate modal content
        const artwork = modal.querySelector(".share-item-artwork");
        const title = modal.querySelector(".share-item-title");
        const subtitle = modal.querySelector(".share-item-subtitle");
        const urlInput = document.getElementById("shareUrlInput");

        if (isAlbum) {
            const albumTitle = this.currentSong.title;
            const albumArtist = this.currentSong.artist;

            // Get album artwork from first song
            const albumResponse = await this.api.getSongs(
                { search: albumTitle },
                1,
                1
            );
            console.log(albumResponse);
            const songs =
                albumResponse.data?.items || albumResponse.songs || [];
            const firstSong = songs.find(
                (s) => s.album === albumTitle && s.artist === albumArtist
            );

            // Use secured URL from server response
            const artworkUrl = firstSong?.cover_art_url || "";
            artwork.style.backgroundImage = artworkUrl
                ? `url(${artworkUrl})`
                : "";
            title.textContent = albumTitle;
            subtitle.textContent = `by ${albumArtist}`;
            urlInput.value = `${
                window.location.origin
            }/?album=${encodeURIComponent(
                albumTitle
            )}&artist=${encodeURIComponent(albumArtist)}`;
        } else if (isArtist) {
            // Handle artist sharing - get artist data from API
            try {
                const artistData = await this.api.getArtist(this.currentSong.id);
                const artist = artistData.data?.artist || artistData.artist;
                
                const artworkUrl = artist?.cover_art_url || "";
                artwork.style.backgroundImage = artworkUrl
                    ? `url(${artworkUrl})`
                    : "";
                if (!artworkUrl) {
                    artwork.style.background = "linear-gradient(45deg, #8C67EF, #4F9EFF)";
                }
                
                title.textContent = artist ? artist.name : this.currentSong.title;
                subtitle.textContent = "Artist";
                urlInput.value = `${
                    window.location.origin
                }/?artist=${encodeURIComponent(artist ? artist.name : this.currentSong.title)}`;
            } catch (error) {
                console.error('Failed to get artist data:', error);
                // Fallback to basic data
                artwork.style.backgroundImage = "";
                artwork.style.background = "linear-gradient(45deg, #8C67EF, #4F9EFF)";
                title.textContent = this.currentSong.title;
                subtitle.textContent = "Artist";
                urlInput.value = `${
                    window.location.origin
                }/?artist=${encodeURIComponent(this.currentSong.title)}`;
            }
        } else {
            console.log("Getting song data for ID:", this.currentSong.id);
            // Get full song data from API for songs
            try {
                const response = await this.api.getSong(this.currentSong.id);
                console.log("API response:", response);
                const songData = response.data?.song || response.song;
                if (!songData) {
                    console.log("No song data in response");
                    return;
                }
                console.log("Song data:", songData);

                // Use secured URL from server response
                const artworkUrl =
                    songData.cover_art_url || songData.album_artwork || "";
                artwork.style.backgroundImage = artworkUrl
                    ? `url(${artworkUrl})`
                    : "";
                title.textContent = songData.title;
                subtitle.textContent = `by ${songData.artist}`;
                urlInput.value = `${window.location.origin}/?song=${songData.id}`;
            } catch (error) {
                console.error("Error getting song data:", error);
                // Fallback to basic data - only if it's a numeric ID
                if (/^\d+$/.test(this.currentSong.id)) {
                    title.textContent = this.currentSong.title;
                    subtitle.textContent = `by ${this.currentSong.artist}`;
                    urlInput.value = `${window.location.origin}/?song=${this.currentSong.id}`;
                } else {
                    console.log(
                        "Invalid song ID format, cannot create share URL"
                    );
                    return;
                }
            }
        }

        console.log("About to show modal");

        artwork.style.backgroundSize = "cover";
        artwork.style.backgroundPosition = "center";

        // Show modal
        modal.style.display = "flex";
        modal.style.position = "fixed";
        modal.style.top = "0";
        modal.style.left = "0";
        modal.style.width = "100%";
        modal.style.height = "100%";
        modal.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
        modal.style.zIndex = "1000";
        modal.style.alignItems = "center";
        modal.style.justifyContent = "center";

        // Setup copy button
        const copyBtn = document.getElementById("copyShareUrl");
        const newCopyBtn = copyBtn.cloneNode(true);
        copyBtn.parentNode.replaceChild(newCopyBtn, copyBtn);

        newCopyBtn.addEventListener("click", () => {
            urlInput.select();
            document.execCommand("copy");
            this.toast.show("Share URL copied to clipboard");
        });

        // Setup close handlers
        const closeBtn = document.getElementById("shareModalClose");
        const newCloseBtn = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);

        newCloseBtn.addEventListener("click", () => {
            modal.style.display = "none";
        });

        modal.addEventListener("click", (e) => {
            if (e.target === modal) {
                modal.style.display = "none";
            }
        });
    }

    async editMetadata() {
        try {
            const isAlbum =
                this.currentElement &&
                this.currentElement.dataset.type === "album";

            if (isAlbum) {
                // For albums, get first song to edit album metadata
                const albumTitle = this.currentSong.title;
                const albumArtist = this.currentSong.artist;

                const albumResponse = await this.api.getSongs(
                    { search: albumTitle },
                    1,
                    1
                );
                const songs =
                    albumResponse.data?.items || albumResponse.songs || [];
                const firstSong = songs.find(
                    (s) => s.album === albumTitle && s.artist === albumArtist
                );

                if (firstSong) {
                    this.metadataEditor.show(firstSong, true);
                }
            } else {
                const response = await this.api.getSong(this.currentSong.id);
                const song = response.data?.song;
                if (song) {
                    this.metadataEditor.show(song, false);
                }
            }
        } catch (error) {
            console.error("Failed to load song data:", error);
            this.toast.show("Failed to load song data");
        }
    }

    async loadPlaylists() {
        try {
            const response = await this.api.getPlaylists();
            this.playlists =
                response.data?.playlists || response.playlists || [];
            this.updatePlaylistSubmenu();
        } catch (error) {
            console.error("Failed to load playlists:", error);
        }
    }

    updatePlaylistSubmenu() {
        const playlistList = this.menu.querySelector(".playlist-list");
        if (!playlistList) return;

        playlistList.innerHTML = "";

        if (this.playlists.length === 0) {
            playlistList.innerHTML =
                '<div class="playlist-empty">No playlists found</div>';
            return;
        }

        this.playlists.forEach((playlist) => {
            const item = document.createElement("div");
            item.className = "context-menu-item";
            item.dataset.action = "add-to-playlist";
            item.dataset.playlistId = playlist.id;
            item.innerHTML = `
                <img src="client/icons/playlist.svg" alt="Playlist" width="16" height="16">
                <span class="context-menu-text">${playlist.name}</span>
            `;
            playlistList.appendChild(item);
        });
    }

    showCreatePlaylistModal() {
        // Create modal if it doesn't exist
        let modal = document.getElementById("createPlaylistModal");
        if (!modal) {
            modal = document.createElement("div");
            modal.id = "createPlaylistModal";
            modal.className = "modal";
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Create New Playlist</h3>
                        <button class="modal-close" id="createPlaylistClose">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label for="playlistName">Playlist Name</label>
                            <input type="text" id="playlistName" placeholder="Enter playlist name" maxlength="100">
                        </div>
                        <div class="form-group">
                            <label>
                                <input type="checkbox" id="playlistPublic"> Make playlist public
                            </label>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-secondary" id="createPlaylistCancel">Cancel</button>
                        <button class="btn btn-primary" id="createPlaylistSubmit">Create Playlist</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }

        // Reset form
        document.getElementById("playlistName").value = "";
        document.getElementById("playlistPublic").checked = false;

        // Show modal
        modal.style.display = "flex";
        document.getElementById("playlistName").focus();

        // Event handlers
        const closeModal = () => {
            modal.style.display = "none";
        };

        document.getElementById("createPlaylistClose").onclick = closeModal;
        document.getElementById("createPlaylistCancel").onclick = closeModal;

        document.getElementById("createPlaylistSubmit").onclick = async () => {
            const name = document.getElementById("playlistName").value.trim();
            const isPublic = document.getElementById("playlistPublic").checked;

            if (!name) {
                this.toast.show("Please enter a playlist name");
                return;
            }

            try {
                const response = await this.api.createPlaylist(name, isPublic);
                const playlistId =
                    response.data?.playlistId || response.playlistId;

                if (playlistId) {
                    // Add current song to the new playlist
                    await this.addToPlaylist(playlistId);
                    this.toast.show(
                        `Created playlist "${name}" and added song`
                    );
                } else {
                    this.toast.show(`Created playlist "${name}"`);
                }

                // Refresh playlist list
                await this.loadPlaylists();

                // Refresh sidebar playlists
                if (window.playlistManager) {
                    await window.playlistManager.refresh();
                }

                closeModal();
            } catch (error) {
                console.error("Failed to create playlist:", error);
                this.toast.show("Failed to create playlist");
            }
        };

        // Enter key to submit
        document.getElementById("playlistName").onkeypress = (e) => {
            if (e.key === "Enter") {
                document.getElementById("createPlaylistSubmit").click();
            }
        };

        // Click outside to close
        modal.onclick = (e) => {
            if (e.target === modal) {
                closeModal();
            }
        };
    }

    async addToPlaylist(playlistId) {
        console.log(
            "Adding to playlist:",
            playlistId,
            "Current song:",
            this.currentSong
        );
        if (!this.currentSong || !playlistId) {
            console.log("Missing song or playlist ID");
            return;
        }

        try {
            const isAlbum =
                this.currentElement &&
                this.currentElement.dataset.type === "album";

            if (isAlbum) {
                // Add all songs from album
                const albumTitle = this.currentSong.title;
                const albumArtist = this.currentSong.artist;

                const albumResponse = await this.api.getSongs(
                    {
                        search: albumTitle,
                    },
                    1,
                    100
                );

                const songs =
                    albumResponse.data?.items || albumResponse.songs || [];
                const albumSongs = songs.filter(
                    (s) => s.album === albumTitle && s.artist === albumArtist
                );

                for (const song of albumSongs) {
                    await this.api.addToPlaylist(playlistId, song.id);
                }

                this.toast.show(`Added ${albumSongs.length} songs to playlist`);
            } else {
                // Add single song
                console.log(
                    "Adding single song to playlist:",
                    playlistId,
                    this.currentSong.id
                );
                const result = await this.api.addToPlaylist(
                    playlistId,
                    this.currentSong.id
                );
                console.log("Add to playlist result:", result);
                this.toast.show("Added to playlist");
            }
        } catch (error) {
            console.error("Failed to add to playlist:", error);
            this.toast.show("Failed to add to playlist");
        }
    }
}
