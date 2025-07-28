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
    }

    // Initialize connection
    async connect() {
        return new Promise((resolve, reject) => {
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
                }
                this.attemptReconnect();
            });
        });
    }

    // Generic event emitter with promise support
    emit(event, data = {}) {
        return new Promise((resolve, reject) => {
            if (!this.connected) {
                reject(new Error("Not connected to server"));
                return;
            }

            // Use longer timeout for upload operations, shorter for others
            const timeoutDuration = event.includes("upload") ? 300000 : 30000; // 5 min for uploads, 30s for others
            const timeout = setTimeout(() => {
                reject(new Error("Request timeout"));
            }, timeoutDuration);

            this.socket.emit(event, data);

            this.socket.once(event, (response) => {
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
            });
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

    async getUserStats(userId) {
        return await this.emit("user:getStats", { userId });
    }

    async getUserUploads(userId, page = 1, limit = 20) {
        return await this.emit("user:getUploads", { userId, page, limit });
    }

    // Song methods
    async getSongs(filters = {}, page = 1, limit = 20) {
        return await this.emit("song:list", { filters, page, limit });
    }

    async getSong(songId) {
        return await this.emit("song:get", { songId });
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

    async playSong(songId) {
        return await this.emit("song:play", { songId });
    }

    async recordListen(songId) {
        return await this.emit("song:recordListen", { songId });
    }

    async getSongListens(songId) {
        return await this.emit("song:getListens", { songId });
    }

    async getRecentlyPlayed(limit = 10, offset = 0) {
        return await this.emit("song:recentlyPlayed", { limit, offset });
    }

    async searchSongs(query, page = 1, limit = 20) {
        return await this.emit("song:search", { query, page, limit });
    }

    async getAlbums(page = 1, limit = 20) {
        return await this.emit("albums:list", { page, limit });
    }

    // Playlist methods
    async getPlaylists(userId = null, page = 1, limit = 20) {
        // If no userId provided, use current user
        const targetUserId = userId || (this.user ? this.user.id : null);
        return await this.emit("playlist:list", {
            userId: targetUserId,
            page,
            limit,
        });
    }

    async getPlaylist(playlistId, songPage = 1, songLimit = 50) {
        return await this.emit("playlist:get", {
            playlistId,
            songPage,
            songLimit,
        });
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

    async addToPlaylist(playlistId, songId) {
        return await this.addSongToPlaylist(playlistId, songId);
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

    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log("Max reconnection attempts reached");
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
