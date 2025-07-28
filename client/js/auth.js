/**
 * Authentication Manager
 */
class AuthManager {
    constructor(api, toast) {
        this.api = api;
        this.toast = toast;
        this.user = null;
        this.isAuthenticated = false;
    }

    // Initialize authentication
    async init() {
        const token = localStorage.getItem("chillfi_token");
        if (token) {
            try {
                const response = await this.api.refreshToken();
                if (response.success && this.api.user) {
                    this.isAuthenticated = true;
                    this.user = this.api.user;

                    // Load full profile data including avatar
                    await this.loadUserProfile();

                    this.updateUI();
                } else {
                    throw new Error("Token refresh failed");
                }
            } catch (error) {
                console.log("Token refresh failed, user needs to login");
                this.showLoginModal();
            }
        } else {
            this.showLoginModal();
        }
    }

    // Show login modal
    showLoginModal() {
        const loginModal = this.createLoginModal();
        document.body.appendChild(loginModal);
    }

    // Create login modal
    createLoginModal() {
        const modal = document.createElement("div");
        modal.className = "login-modal";
        modal.innerHTML = `
            <div class="login-modal-content">
                <div class="login-modal-header">
                    <h2>Welcome to ChillFi3</h2>
                    <p>Please sign in to continue</p>
                </div>
                <form class="login-form" id="loginForm">
                    <div class="form-group">
                        <label for="username">Username</label>
                        <input type="text" id="username" name="username" required>
                    </div>
                    <div class="form-group">
                        <label for="password">Password</label>
                        <input type="password" id="password" name="password" required>
                    </div>
                    <button type="submit" class="login-button">Sign In</button>
                </form>
                <div class="login-error" id="loginError" style="display: none;"></div>
            </div>
        `;

        // Add styles
        const style = document.createElement("style");
        style.textContent = `
            .login-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
            }
            .login-modal-content {
                background: var(--bg-secondary);
                padding: 2rem;
                border-radius: 12px;
                width: 400px;
                max-width: 90vw;
            }
            .login-modal-header h2 {
                color: var(--text-primary);
                margin: 0 0 0.5rem 0;
            }
            .login-modal-header p {
                color: var(--text-secondary);
                margin: 0 0 2rem 0;
            }
            .login-form .form-group {
                margin-bottom: 1rem;
            }
            .login-form label {
                display: block;
                color: var(--text-primary);
                margin-bottom: 0.5rem;
                font-size: 0.9rem;
            }
            .login-form input {
                width: 100%;
                padding: 0.75rem;
                border: 1px solid var(--border-color);
                border-radius: 6px;
                background: var(--bg-primary);
                color: var(--text-primary);
                font-size: 1rem;
            }
            .login-form input:focus {
                outline: none;
                border-color: var(--accent-primary);
            }
            .login-button {
                width: 100%;
                padding: 0.75rem;
                background: var(--gradient);
                color: white;
                border: none;
                border-radius: 6px;
                font-size: 1rem;
                cursor: pointer;
                margin-top: 1rem;
            }
            .login-button:hover {
                opacity: 0.9;
            }
            .login-button:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            .login-error {
                color: #ff4444;
                margin-top: 1rem;
                padding: 0.75rem;
                background: rgba(255, 68, 68, 0.1);
                border-radius: 6px;
                font-size: 0.9rem;
            }
        `;
        document.head.appendChild(style);

        // Handle form submission
        const form = modal.querySelector("#loginForm");
        const errorDiv = modal.querySelector("#loginError");

        form.addEventListener("submit", async (e) => {
            e.preventDefault();

            const username = form.username.value;
            const password = form.password.value;
            const submitButton = form.querySelector(".login-button");

            submitButton.disabled = true;
            submitButton.textContent = "Signing in...";
            errorDiv.style.display = "none";

            try {
                const response = await this.api.login(username, password);
                if (response && response.success) {
                    this.toast.show("Welcome back!");
                    modal.remove();

                    // Reload page immediately to refresh all content
                    window.location.reload();
                } else {
                    throw new Error(response?.message || "Login failed");
                }
            } catch (error) {
                errorDiv.textContent = error.message;
                errorDiv.style.display = "block";
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = "Sign In";
            }
        });

        return modal;
    }

    // Update UI with user info
    updateUI() {
        if (this.user) {
            const userAvatar = document.querySelector(".user-avatar");
            const userName = document.querySelector(".user-name");

            if (userAvatar) {
                if (this.user.profile_image_url) {
                    userAvatar.style.backgroundImage = `url(${this.user.profile_image_url})`;
                    userAvatar.style.backgroundSize = "cover";
                    userAvatar.style.backgroundPosition = "center";
                    userAvatar.textContent = "";
                } else {
                    userAvatar.textContent = this.user.username
                        .charAt(0)
                        .toUpperCase();
                }
            }

            if (userName) {
                userName.textContent =
                    this.user.display_name || this.user.username;
            }

            // Show admin panel button if user is admin
            const adminButton = document.getElementById("adminPanelButton");
            if (adminButton) {
                if (this.user.is_admin) {
                    adminButton.style.display = "block";
                } else {
                    adminButton.style.display = "none";
                }
            }

            // Update profile popup
            this.updateProfilePopup();
        }
    }

    // Update profile popup with user data
    updateProfilePopup() {
        const profileAvatar = document.querySelector(".profile-avatar");
        const profileName = document.querySelector(".profile-name");

        if (profileAvatar) {
            if (this.user.profile_image_url) {
                profileAvatar.style.backgroundImage = `url(${this.user.profile_image_url})`;
                profileAvatar.style.backgroundSize = "cover";
                profileAvatar.style.backgroundPosition = "center";
                profileAvatar.textContent = "";
            } else {
                profileAvatar.textContent = this.user.username
                    .charAt(0)
                    .toUpperCase();
            }
        }

        if (profileName) {
            profileName.textContent =
                this.user.display_name || this.user.username;
        }

        // Update bio
        const profileBio = document.querySelector(".profile-bio p");
        if (profileBio) {
            profileBio.textContent =
                this.user.bio ||
                "Welcome to ChillFi3! Upload your music and start building your library.";
        }

        // Load user stats
        this.loadUserStats();
    }

    // Load user statistics
    async loadUserStats() {
        try {
            const stats = await this.api.getUserStats(this.user.id);

            const uploadStat = document.querySelector(
                ".profile-stat:first-child .profile-stat-value"
            );
            const listenStat = document.querySelector(
                ".profile-stat:last-child .profile-stat-value"
            );

            if (uploadStat) uploadStat.textContent = stats.uploadCount;
            if (listenStat) listenStat.textContent = stats.totalListens;
        } catch (error) {
            console.error("Failed to load user stats:", error);
        }
    }

    // Load full user profile data
    async loadUserProfile() {
        if (!this.user || !this.user.id) {
            console.warn("Cannot load user profile: user not set");
            return;
        }

        try {
            const response = await this.api.getUserProfile(this.user.id);
            if (response.user) {
                // Merge profile data with existing user data
                this.user = { ...this.user, ...response.user };

                // Update recent uploads if available
                if (response.recentUploads) {
                    this.updateRecentUploads(
                        response.recentUploads.slice(0, 5)
                    );
                }
            }
        } catch (error) {
            console.error("Failed to load user profile:", error);
        }
    }

    // Update recent uploads in profile popup
    updateRecentUploads(uploads) {
        const songList = document.getElementById("profileSongList");
        if (!songList) return;

        if (uploads.length === 0) {
            songList.innerHTML =
                '<div class="profile-no-uploads">No uploads yet</div>';
            return;
        }

        songList.innerHTML = uploads
            .map(
                (song) => `
            <div class="profile-song-item" data-song-id="${song.id}">
                <div class="profile-song-info">
                    <div class="profile-song-title">${song.title}</div>
                    <div class="profile-song-artist">${
                        song.artist || "Unknown Artist"
                    }</div>
                </div>
                <button class="profile-song-play" onclick="playSong(${
                    song.id
                })">
                    <img src="client/icons/play.svg" alt="Play" width="16" height="16">
                </button>
            </div>
        `
            )
            .join("");
    }

    // Logout
    async logout() {
        try {
            await this.api.logout();
            this.isAuthenticated = false;
            this.user = null;
            this.toast.show("Logged out successfully");
            setTimeout(() => window.location.reload(), 1000);
        } catch (error) {
            console.error("Logout error:", error);
            this.toast.show("Logout failed");
        }
    }
}

export default AuthManager;
