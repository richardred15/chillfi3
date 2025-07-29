import APIEvents from "./api_events.js";

/**
 * Socket.IO API Client
 */
class API {
    constructor() {
        this.socket = null;
        this.token = localStorage.getItem("chillfi_token");
        this.user = null;
        this.connected = false;
        this.eventHandlers = new Map();
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectDelay = 5000;
        this.onConnectionChange = null;
        this.events = new APIEvents();
        this.urlCache = new Map(); // Cache for pre-generated URLs
    }

    // Initialize connection
    async connect() {
        return new Promise((resolve, reject) => {
            // Prevent multiple connection attempts
            if (this.socket && this.socket.connected) {
                resolve();
                return;
            }

            // Disconnect existing socket if present
            if (this.socket) {
                this.socket.disconnect();
            }

            const serverUrl =
                window.location.hostname === "localhost"
                    ? "http://localhost:3005"
                    : `https://${window.location.hostname}:3005`;

            this.socket = io(serverUrl, {
                auth: {
                    token: this.token,
                },
            });

            this.socket.on("connect", () => {
                this.connected = true;
                this.reconnectAttempts = 0;
                console.log("Connected to server");
                // Trigger online mode
                if (window.offlineManager) {
                    window.offlineManager.handleOnline();
                }
                if (this.onConnectionChange) {
                    this.onConnectionChange(true);
                }
                resolve();
            });

            this.socket.on("disconnect", () => {
                this.connected = false;
                console.log("Disconnected from server");
                if (this.onConnectionChange) {
                    this.onConnectionChange(false);
                }
                // Don't immediately trigger offline mode - wait for reconnect attempts
                this.attemptReconnect();
            });

            this.socket.on("connect_error", (error) => {
                console.error("Connection error:", error);
                this.connected = false;
                if (this.onConnectionChange) {
                    this.onConnectionChange(false);
                }
                if (this.reconnectAttempts === 0) {
                    reject(error);
                } else {
                    this.attemptReconnect();
                }
            });
        });
    }

    // Generic event emitter with promise support
    emit(event, data = {}) {
        return new Promise((resolve, reject) => {
            if (!this.connected) {
                // Try offline fallback
                const offlineResult = this.handleOfflineRequest(event, data);
                if (offlineResult) {
                    resolve(offlineResult);
                    return;
                }
                reject(new Error("Not connected to server"));
                return;
            }

            // Use longer timeout for upload operations, shorter for others
            const timeoutDuration = event.includes("upload") ? 300000 : 10000; // 5 min for uploads, 10s for others
            const timeout = setTimeout(() => {
                reject(new Error("Request timeout"));
            }, timeoutDuration);

            this.socket.emit(event, data);

            const responseHandler = (response) => {
                // If request has requestId, only accept matching responses
                if (data.requestId && response.requestId !== data.requestId) {
                    return; // Ignore responses that don't match our request ID
                }
                
                this.socket.off(event, responseHandler);
                clearTimeout(timeout);
                
                if (response === undefined || response === null) {
                    reject(new Error("No response from server"));
                } else if (response.success === false) {
                    const errorMessage =
                        response.error?.message ||
                        response.message ||
                        "Server error";
                    reject(new Error(errorMessage));
                } else {
                    resolve(response);
                }
            };

            this.socket.on(event, responseHandler);
        });
    }

    // Authentication methods
    async login(username, password) {
        console.log("Client login attempt:", {
            username,
            hasPassword: !!password,
        });
        try {
            const response = await this.emit("auth:login", {
                username,
                password,
            });
            console.log("Login response:", response);

            if (response.data && response.data.token && response.data.user) {
                this.token = response.data.token;
                this.user = response.data.user;
                localStorage.setItem("chillfi_token", this.token);
                console.log("Login successful");
                this.events.fire("authenticated");
                return {
                    success: true,
                    token: response.data.token,
                    user: response.data.user,
                };
            }
            console.log("Login failed - no token/user in response");
            return {
                success: false,
                message: response.message || "Login failed",
            };
        } catch (error) {
            console.error("Login error:", error);
            return { success: false, message: error.message || "Login failed" };
        }
    }

    async logout() {
        const response = await this.emit("auth:logout", { token: this.token });
        this.token = null;
        this.user = null;
        localStorage.removeItem("chillfi_token");
        return response;
    }

    async refreshToken() {
        const response = await this.emit("auth:refresh", { token: this.token });
        if (response.success) {
            this.token = response.newToken;
            localStorage.setItem("chillfi_token", this.token);
            // Get user info from token
            const decoded = this.decodeToken(this.token);
            if (decoded) {
                this.user = {
                    id: decoded.userId,
                    username: decoded.username,
                    is_admin: decoded.isAdmin,
                };
                // Trigger authenticated callbacks
                this.events.fire("authenticated");
            }
        }
        return response;
    }

    async resetPassword(currentPassword, newPassword) {
        return await this.emit("auth:resetPassword", {
            currentPassword,
            newPassword,
        });
    }

    // Decode JWT token
    decodeToken(token) {
        try {
            const payload = token.split(".")[1];
            return JSON.parse(atob(payload));
        } catch (error) {
            return null;
        }
    }

    // User methods
    async getUserProfile(userId) {
        return await this.emit("user:profile", { userId });
    }

    async updateUser(userId, updates) {
        return await this.emit("user:update", { userId, updates });
    }

    async uploadAvatar(userId, imageFile) {
        return await this.emit("user:uploadAvatar", { userId, imageFile });
    }
    
    async updateUserAvatar(userId, imageUrl) {
        return await this.emit("user:updateAvatar", { userId, imageUrl });
    }

    async getUserStats(userId) {
        return await this.emit("user:getStats", { userId });
    }

    async getUserUploads(userId, page = 1, limit = 20) {
        return await this.emit("user:getUploads", { userId, page, limit });
    }

    async updateUserTheme(theme) {
        return await this.emit("user:updateTheme", { theme });
    }

    async getUserTheme() {
        return await this.emit("user:getTheme", {});
    }

    // Song methods
    async getSongs(filters = {}, page = 1, limit = 20) {
        try {
            const result = await this.emit("song:list", {
                filters,
                page,
                limit,
            });

            // Cache songs for offline use and URLs for faster playback
            if (
                window.offlineManager &&
                result.success &&
                result.data &&
                result.data.items
            ) {
                result.data.items.forEach((song) =>
                    window.offlineManager.cacheSong(song)
                );
                // Cache pre-generated URLs
                this.cacheSongUrls(result.data.items);
            }
            return result;
        } catch (error) {
            // Return cached songs if offline
            if (window.offlineManager && !window.offlineManager.isOnline) {
                const cachedSongs = window.offlineManager.getOfflineLibrary();
                return {
                    success: true,
                    data: {
                        items: cachedSongs,
                        pagination: {
                            total: cachedSongs.length,
                            page: 1,
                            limit: cachedSongs.length,
                            totalPages: 1,
                        },
                    },
                    offline: true,
                };
            }
            throw error;
        }
    }

    async getSong(songId) {
        try {
            const result = await this.emit("song:get", { songId });

            // Cache the song for offline use
            if (
                window.offlineManager &&
                result.success &&
                result.data &&
                result.data.song
            ) {
                window.offlineManager.cacheSong(result.data.song);
            }

            return result;
        } catch (error) {
            // Return cached song if offline
            if (window.offlineManager && !window.offlineManager.isOnline) {
                return this.handleOfflineRequest("song:get", { songId });
            }
            throw error;
        }
    }

    async updateSong(songId, metadata) {
        return await this.emit("song:update", { songId, metadata });
    }

    async updateAlbum(albumId, updates) {
        return await this.emit("album:update", { albumId, updates });
    }

    async deleteSong(songId) {
        return await this.emit("song:delete", { songId });
    }

    async deleteAlbum(albumId) {
        return await this.emit("album:delete", { albumId });
    }

    async deleteArtist(artistId) {
        return await this.emit("artist:delete", { artistId });
    }

    async updateArtist(artistId, metadata) {
        return await this.emit("artist:update", { artistId, metadata });
    }

    async playSong(songId) {
        try {
            // Check if we have a cached URL first
            const cachedUrl = this.getCachedUrl(songId);
            if (cachedUrl) {
                // Return immediately with cached URL
                return {
                    url: cachedUrl,
                    metadata: { id: songId }, // Minimal metadata, full metadata should be available client-side
                    cached: true,
                };
            }

            // Fallback to server request if no cached URL
            const result = await this.emit("song:play", { songId });

            // Cache the song metadata for offline use
            if (window.offlineManager && result.success && result.metadata) {
                window.offlineManager.cacheSong({
                    id: result.metadata.id,
                    title: result.metadata.title,
                    artist: result.metadata.artist,
                    album: result.metadata.album,
                    duration: result.metadata.duration,
                    // Add other metadata if available
                    ...result.metadata,
                });
            }

            return result;
        } catch (error) {
            throw error;
        }
    }

    async recordListen(songId) {
        try {
            return await this.emit("song:recordListen", { songId });
        } catch (error) {
            // Queue for offline sync
            if (window.offlineManager) {
                window.offlineManager.queueAction({
                    type: "recordListen",
                    songId: songId,
                });
                return { success: true, queued: true };
            }
            throw error;
        }
    }

    async getSongListens(songId) {
        return await this.emit("song:getListens", { songId });
    }

    async getRecentlyPlayed(limit = 10, offset = 0) {
        const result = await this.emit("song:recentlyPlayed", {
            limit,
            offset,
        });

        // Cache pre-generated URLs from recently played songs
        if (result.success && result.songs) {
            this.cacheSongUrls(result.songs);
        }

        return result;
    }

    async searchSongs(query, page = 1, limit = 20) {
        const result = await this.emit("song:search", { query, page, limit });

        // Cache pre-generated URLs from search results
        if (result.success && result.songs) {
            this.cacheSongUrls(result.songs);
        }

        return result;
    }

    async getAlbums(page = 1, limit = 20) {
        try {
            const result = await this.emit("albums:list", { page, limit });

            // Cache album artwork URLs (albums don't have play URLs)
            if (result.success && result.data?.items) {
                // Albums don't need URL caching since they don't have play_url
                // but we could cache album artwork if needed
            }

            return result;
        } catch (error) {
            // Return cached albums if offline
            if (window.offlineManager && !window.offlineManager.isOnline) {
                return this.handleOfflineRequest("albums:list", {
                    page,
                    limit,
                });
            }
            throw error;
        }
    }

    // Get artists
    async getArtists(page = 1, limit = 24) {
        return this.emit("artist:list", { page, limit });
    }

    // Get artist by ID
    async getArtist(artistId) {
        return this.emit("artist:get", { artistId });
    }

    // Get albums by artist
    async getAlbumsByArtist(artistId, page = 1, limit = 24) {
        const requestId = `artist_${artistId}_${Date.now()}`;
        return this.emit('albums:list', { artistId, page, limit, requestId });
    }

    // Get album by ID
    async getAlbum(albumId) {
        return this.emit("albums:get", { albumId });
    }

    // Playlist methods
    async getPlaylists(userId = null, page = 1, limit = 20) {
        try {
            // If no userId provided, use current user
            const targetUserId = userId || (this.user ? this.user.id : null);
            const response = await this.emit("playlist:list", {
                userId: targetUserId,
                page,
                limit,
            });
            console.log("Playlists response:", response);
            return response;
        } catch (error) {
            // Return empty playlists if offline or not connected
            if (
                !this.connected ||
                (window.offlineManager && !window.offlineManager.isOnline)
            ) {
                const offlinePlaylists = window.offlineManager
                    ? window.offlineManager.getOfflinePlaylists()
                    : [];
                return {
                    success: true,
                    data: {
                        items: offlinePlaylists,
                        pagination: {
                            total: offlinePlaylists.length,
                            page: 1,
                            limit: offlinePlaylists.length,
                            totalPages: 1,
                        },
                    },
                    offline: true,
                };
            }
            throw error;
        }
    }

    async getPlaylist(playlistId, songPage = 1, songLimit = 50) {
        const result = await this.emit("playlist:get", {
            playlistId,
            songPage,
            songLimit,
        });

        // Cache pre-generated URLs from playlist songs
        if (result.success && result.songs) {
            this.cacheSongUrls(result.songs);
        }

        return result;
    }

    async createPlaylist(name, isPublic = false) {
        return await this.emit("playlist:create", { name, isPublic });
    }

    async updatePlaylist(playlistId, updates) {
        return await this.emit("playlist:update", { playlistId, updates });
    }

    async deletePlaylist(playlistId) {
        return await this.emit("playlist:delete", { playlistId });
    }

    async addSongToPlaylist(playlistId, songId) {
        return await this.emit("playlist:addSong", { playlistId, songId });
    }

    async removeSongFromPlaylist(playlistId, songId) {
        return await this.emit("playlist:removeSong", { playlistId, songId });
    }

    async sharePlaylist(playlistId) {
        return await this.emit("playlist:share", { playlistId });
    }

    // Player methods
    async getQueue() {
        return await this.emit("player:queue");
    }

    async addToQueue(songId) {
        return await this.emit("player:addToQueue", { songId });
    }

    async removeFromQueue(index) {
        return await this.emit("player:removeFromQueue", { index });
    }

    async getPlayerStatus() {
        return await this.emit("player:status");
    }

    // Version methods
    async getVersion() {
        return await this.emit("version:get", {});
    }

    // Image upload methods
    async uploadImageChunk(chunkData) {
        return await this.emit("song:uploadImageChunk", chunkData);
    }

    // Check if file hash already exists
    async checkFileHash(hash) {
        return await this.emit("song:checkHash", { hash });
    }

    // Cache song URLs from API responses
    cacheSongUrls(songs) {
        if (!Array.isArray(songs)) songs = [songs];

        songs.forEach((song) => {
            if (song.id && song.play_url) {
                this.urlCache.set(song.id, {
                    url: song.play_url,
                    expires: Date.now() + 45 * 60 * 1000, // 45 minutes
                });
            }
        });
    }

    // Get cached URL or null if expired/missing
    getCachedUrl(songId) {
        const cached = this.urlCache.get(songId);
        if (cached && Date.now() < cached.expires) {
            return cached.url;
        }
        this.urlCache.delete(songId);
        return null;
    }

    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log(
                "Max reconnection attempts reached - switching to offline mode"
            );
            this.socket.disconnect();
            // Trigger offline mode instead of reload button
            if (window.offlineManager) {
                window.offlineManager.handleOffline();
            }
            return;
        }

        this.reconnectAttempts++;
        console.log(
            `Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`
        );

        setTimeout(() => {
            if (!this.connected && this.socket) {
                this.socket.connect();
            }
        }, this.reconnectDelay);
    }

    // Handle offline requests
    handleOfflineRequest(event, data) {
        if (!window.offlineManager) return null;

        switch (event) {
            case "song:list":
                let cachedSongs = window.offlineManager.getOfflineLibrary();

                // Apply filters for offline content
                if (data.filters) {
                    if (data.filters.artist) {
                        cachedSongs = cachedSongs.filter(
                            (song) => song.artist === data.filters.artist
                        );
                    }
                    if (data.filters.album) {
                        cachedSongs = cachedSongs.filter(
                            (song) => song.album === data.filters.album
                        );
                    }
                    if (data.filters.search) {
                        const searchTerm = data.filters.search.toLowerCase();
                        cachedSongs = cachedSongs.filter(
                            (song) =>
                                song.title
                                    ?.toLowerCase()
                                    .includes(searchTerm) ||
                                song.artist
                                    ?.toLowerCase()
                                    .includes(searchTerm) ||
                                song.album?.toLowerCase().includes(searchTerm)
                        );
                    }
                }

                return {
                    success: true,
                    data: {
                        items: cachedSongs,
                        pagination: {
                            total: cachedSongs.length,
                            page: 1,
                            limit: cachedSongs.length,
                            totalPages: 1,
                        },
                    },
                    offline: true,
                };

            case "albums:list":
                const allCachedSongs =
                    window.offlineManager.getOfflineLibrary();
                const albumsMap = new Map();

                // Group songs by album
                allCachedSongs.forEach((song) => {
                    if (song.album && song.album_id) {
                        if (!albumsMap.has(song.album_id)) {
                            albumsMap.set(song.album_id, {
                                id: song.album_id,
                                title: song.album,
                                artist: song.artist,
                                cover_art_url: song.cover_art_url,
                                song_count: 0,
                            });
                        }
                        albumsMap.get(song.album_id).song_count++;
                    }
                });

                const albums = Array.from(albumsMap.values());
                return {
                    success: true,
                    data: {
                        items: albums,
                        pagination: {
                            total: albums.length,
                            page: 1,
                            limit: albums.length,
                            totalPages: 1,
                        },
                    },
                    offline: true,
                };

            case "song:get":
                const song = window.offlineManager.getCachedSong(data.songId);
                if (song) {
                    return { success: true, data: { song }, offline: true };
                }
                break;

            case "song:recentlyPlayed":
                const recentSongs = window.offlineManager
                    .getOfflineLibrary()
                    .slice(0, data.limit || 10);
                return {
                    success: true,
                    data: {
                        songs: recentSongs,
                        total: recentSongs.length,
                    },
                    offline: true,
                };
        }

        return null;
    }

    // Event listeners
    on(event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event).push(handler);

        if (this.socket) {
            this.socket.on(event, handler);
        }
    }

    off(event, handler) {
        const handlers = this.eventHandlers.get(event);
        if (handlers) {
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }

        if (this.socket) {
            this.socket.off(event, handler);
        }
    }
}

// Create global API instance
window.api = new API();

export default API;
