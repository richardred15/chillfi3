/**
 * Main Application Entry Point
 */
import API from "./api.js";
import AuthManager from "./auth.js";
import ContentManager from "./content.js";
import UploadManager from "./upload.js";
import AdminManager from "./admin.js";
import OfflineManager from "./offline.js";
import CacheManager from "./utils/cacheManager.js";
import ContextMenu from "./components/contextMenu.js";
import MetadataEditor from "./components/metadataEditor.js";
import Toast from "./components/toast.js";
import Player from "./components/player.js";
import NowPlayingPopup from "./components/nowPlayingPopup.js";
import ResponsiveHandler from "./components/responsiveHandler.js";
import UserMenu from "./components/userMenu.js";
import CardHover from "./components/cardHover.js";
// import UploadModal from './components/uploadModal.js'; // Disabled - using new upload manager
import Modal from "./components/modal.js";
import ThemeSwitcher from "./components/themeSwitcher.js";
import AlbumView from "./components/albumView.js";
import Visualizer from "./components/visualizer.js";
import PlaylistManager from "./components/playlistManager.js";
import ShareManager from "./components/shareManager.js";
import { formatDuration } from "./utils/formatters.js";
import { getAllFilesFromDrop } from "./utils/fileHandlers.js";
import { initMobileNav } from "./utils/mobileNav.js";
import ErrorHandler from "./utils/errorHandler.js";
import URLManager from "./utils/urlManager.js";

// Register service worker
let serviceWorkerReady = false;
if ("serviceWorker" in navigator) {
    navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
            console.log("Service Worker registered:", registration);
            return navigator.serviceWorker.ready;
        })
        .then(() => {
            serviceWorkerReady = true;
            console.log("Service Worker ready");
        })
        .catch((error) => {
            console.error("Service Worker registration failed:", error);
        });
}

// Initialize application when DOM is loaded
document.addEventListener("DOMContentLoaded", async function () {
    // Initialize Toast first as it's used by other components
    const toast = new Toast("toast");

    // Initialize global error handler
    const errorHandler = new ErrorHandler(toast);

    // Initialize offline manager first
    const offlineManager = new OfflineManager();

    // Initialize API connection
    //const api = new API();

    // Setup loading handling
    const loadingOverlay = document.getElementById("loadingOverlay");
    const loadingStatus = document.getElementById("loadingStatus");

    let authManager,
        contentManager,
        uploadManager,
        adminManager,
        player,
        albumView,
        playlistManager;

    // Start initialization immediately
    initializeApp().catch((error) => {
        console.error("Failed to initialize app:", error);
        loadingOverlay.style.display = "none";
    });

    async function initializeApp() {
        // Start connection in parallel with manager initialization
        const connectionPromise = (async () => {
            try {
                loadingStatus.textContent = "Connecting to server...";
                await window.api.connect();
                console.log("Connected to ChillFi3 server");
                return true;
            } catch (error) {
                console.error("Connection failed:", error);
                return false;
            }
        })();

        // Initialize core managers first
        loadingStatus.textContent = "Initializing components...";
        authManager = new AuthManager(window.api, toast);
        contentManager = new ContentManager(window.api, toast);
        uploadManager = new UploadManager(window.api, toast);
        adminManager = new AdminManager(window.api, toast);

        // Wait for connection result before initializing components that need API
        const connected = await connectionPromise;

        // Initialize components after connection status is known
        const metadataEditor = new MetadataEditor(api, toast);
        const contextMenu = new ContextMenu(api, toast, metadataEditor);
        player = new Player();
        const nowPlayingPopup = new NowPlayingPopup();
        const responsiveHandler = new ResponsiveHandler();
        const userMenu = new UserMenu(toast);
        const cardHover = new CardHover();
        albumView = new AlbumView(api, toast);
        const themeSwitcher = new ThemeSwitcher();
        const visualizer = new Visualizer();
        playlistManager = new PlaylistManager(api, toast);
        const shareManager = new ShareManager(api, toast);

        // Setup connection change handler now that managers exist
        window.api.onConnectionChange = (connected) => {
            if (connected) {
                loadingOverlay.style.display = "none";

                // Resume uploads if upload manager exists
                if (
                    window.uploadManager &&
                    window.uploadManager.onConnectionRestored
                ) {
                    window.uploadManager.onConnectionRestored();
                }

                // Re-initialize if we have a token
                if (api.token && authManager) {
                    loadingStatus.textContent = "Loading application...";
                    initializeApp();
                } else if (authManager) {
                    loadingOverlay.style.display = "none";
                    authManager.showLogin();
                }
            } else {
                loadingOverlay.style.display = "none";
                // Offline manager handles this now
            }
        };

        if (connected) {
            loadingStatus.textContent = "Loading user data...";

            // Initialize authentication
            await authManager.init();

            // Initialize content if authenticated (non-blocking)
            if (authManager.isAuthenticated) {
                // Start content loading but don't wait for it
                contentManager
                    .init()
                    .then(() => {
                        // Check for share URLs after content is loaded
                        shareManager.handleShareURL();
                    })
                    .catch((error) => {
                        console.error("Content initialization failed:", error);
                    });
            } else {
                // Store share URL parameters for after login
                const urlParams = new URLSearchParams(window.location.search);
                if (
                    urlParams.has("song") ||
                    urlParams.has("album") ||
                    urlParams.has("playlist")
                ) {
                    sessionStorage.setItem(
                        "pendingShareURL",
                        window.location.search
                    );
                }
            }

            // Fetch version in background (non-blocking)
            window.api
                .getVersion()
                .then((versionResponse) => {
                    console.log("Server version:", versionResponse.version);

                    const updateServiceWorker = () => {
                        if (
                            "serviceWorker" in navigator &&
                            navigator.serviceWorker.controller
                        ) {
                            navigator.serviceWorker.controller.postMessage({
                                type: "VERSION_UPDATE",
                                version: versionResponse.version,
                            });
                        }
                    };

                    if (serviceWorkerReady) {
                        updateServiceWorker();
                    } else {
                        navigator.serviceWorker.ready.then(updateServiceWorker);
                    }
                })
                .catch((error) => {
                    console.error("Failed to get version:", error);
                });
        } else {
            // Handle offline mode
            loadingStatus.textContent = "Working offline...";
            await authManager.init();
        }

        // Initialize upload manager
        uploadManager.init();

        // Setup global drag and drop
        setupGlobalDragDrop();

        // Make managers and components globally available
        window.api = api;
        window.authManager = authManager;
        window.contentManager = contentManager;
        window.uploadManager = uploadManager;
        window.albumView = albumView;
        window.getAllFilesFromDrop = getAllFilesFromDrop;
        window.errorHandler = errorHandler;
        window.offlineManager = offlineManager;
        window.player = player;
        window.visualizer = visualizer;
        window.playlistManager = playlistManager;
        window.themeSwitcher = themeSwitcher;
        window.shareManager = shareManager;
        window.metadataEditor = metadataEditor;
        window.contextMenu = contextMenu;

        // Setup visualizer button after components are available
        setupVisualizerButton();

        // Hide loading overlay faster - don't wait for all content
        loadingStatus.textContent = "Ready!";
        setTimeout(() => {
            loadingOverlay.style.display = "none";
        }, 100);

        // Loading overlay will be hidden when theme is ready

        // Setup browser back/forward button handling
        window.addEventListener("popstate", (event) => {
            if (event.state && event.state.albumId) {
                // Navigate to album
                if (window.albumView) {
                    window.albumView.show(
                        event.state.albumTitle,
                        event.state.artistName,
                        event.state.albumId
                    );
                }
            } else if (event.state && event.state.library) {
                // Navigate to library
                loadLibraryFromURL(event.state.library);
            } else if (event.state && event.state.view) {
                // Navigate to view
                loadViewFromURL(event.state.view);
            } else {
                // Navigate to home
                if (window.albumView) {
                    window.albumView.hide();
                }
                if (window.contentManager) {
                    window.contentManager.showHomeSections();
                }
            }
        });
    }

    // Setup logout handler
    const logoutButton = document.getElementById("logoutButton");
    if (logoutButton) {
        logoutButton.addEventListener("click", () => {
            authManager.logout();
        });
    }

    // Setup upload handler
    const uploadButton = document.getElementById("uploadButton");
    if (uploadButton) {
        uploadButton.addEventListener("click", () => {
            if (authManager.isAuthenticated) {
                const modal = document.getElementById("uploadModal");
                if (modal) {
                    modal.classList.add("show");
                }
            } else {
                toast.show("Please login to upload music");
            }
        });
    }

    // Setup admin panel handler
    const adminPanelButton = document.getElementById("adminPanelButton");
    if (adminPanelButton) {
        adminPanelButton.addEventListener("click", () => {
            adminManager.showAdminPanel();
        });
    }

    // Setup home button handler
    const homeButton = document.querySelector(".nav-item");
    if (homeButton) {
        homeButton.addEventListener("click", (e) => {
            e.preventDefault();
            showHomeSections();
            // Clear URL parameters
            URLManager.clearURL();
        });
    }

    // Function to show default home sections
    function showHomeSections() {
        if (contentManager) {
            contentManager.showHomeSections();
        }
    }

    // Setup visualizer button handler
    function setupVisualizerButton() {
        // Remove any existing listeners first
        const existingHandler = document.querySelector("#visualizerButton");
        if (existingHandler) {
            existingHandler.removeEventListener("click", handleVisualizerClick);
        }

        // Add new listener
        document.addEventListener("click", handleVisualizerClick);
    }

    function handleVisualizerClick(e) {
        if (e.target.closest("#visualizerButton")) {
            console.log("Visualizer button clicked");
            if (
                window.player &&
                window.player.audio &&
                !window.player.audio.paused &&
                window.player.audio.src
            ) {
                console.log("Showing visualizer");
                if (window.visualizer) {
                    window.visualizer.show(window.player);
                }
            } else {
                console.log("Showing toast");
                if (window.toast) {
                    window.toast.show("Play a song to use the visualizer");
                } else {
                    toast.show("Play a song to use the visualizer");
                }
            }
        }
    }

    // Player controls are handled by Player component

    // Setup global drag and drop
    function setupGlobalDragDrop() {
        let dragCounter = 0;

        document.addEventListener("dragenter", (e) => {
            e.preventDefault();
            dragCounter++;

            // Only show overlay if upload modal is not open
            const uploadModal = document.getElementById("uploadModal");
            if (
                e.dataTransfer.types.includes("Files") &&
                !uploadModal?.classList.contains("show")
            ) {
                document.body.classList.add("drag-over");
            }
        });

        document.addEventListener("dragleave", (e) => {
            e.preventDefault();
            dragCounter--;

            if (dragCounter === 0) {
                document.body.classList.remove("drag-over");
            }
        });

        document.addEventListener("dragover", (e) => {
            e.preventDefault();
        });

        document.addEventListener("drop", async (e) => {
            e.preventDefault();
            dragCounter = 0;
            document.body.classList.remove("drag-over");

            // Check if upload modal is already open
            const uploadModal = document.getElementById("uploadModal");
            if (uploadModal && !uploadModal.classList.contains("show")) {
                // Handle both files and folders
                const allFiles = await getAllFilesFromDrop(e.dataTransfer);
                const audioExtensions = [
                    ".mp3",
                    ".wav",
                    ".flac",
                    ".m4a",
                    ".aac",
                    ".ogg",
                    ".wma",
                ];
                const hasAudio = allFiles.some(
                    (file) =>
                        file.type.startsWith("audio/") ||
                        audioExtensions.some((ext) =>
                            file.name.toLowerCase().endsWith(ext)
                        )
                );

                if (hasAudio && authManager.isAuthenticated) {
                    uploadModal.classList.add("show");
                    uploadManager.handleFileSelect(allFiles);
                } else if (hasAudio && !authManager.isAuthenticated) {
                    toast.show("Please login to upload music");
                }
            }
        });
    }

    // Initialize mobile navigation
    initMobileNav();

    // Setup search nav handler
    const searchNavItem = Array.from(
        document.querySelectorAll(".nav-item")
    ).find((item) =>
        item.querySelector(".nav-item-text")?.textContent.includes("Search")
    );
    if (searchNavItem) {
        searchNavItem.addEventListener("click", (e) => {
            e.preventDefault();
            contentManager.showSearchSection();
            // Update URL for search
            URLManager.setURL({ view: "search" });
        });
    }

    // Setup library nav handler
    const libraryNavItem = document.getElementById("libraryNavItem");
    if (libraryNavItem) {
        libraryNavItem.addEventListener("click", (e) => {
            e.preventDefault();
            contentManager.showMyLibrary();
            // Update URL for library with current user
            URLManager.setURL({
                library: window.api.user?.username || "current",
            });
        });
    }

    // Setup logo click handler
    const logo = document.getElementById("logo");
    if (logo) {
        logo.addEventListener("click", (e) => {
            e.preventDefault();
            showHomeSections();
            // Clear URL parameters
            URLManager.clearURL();
        });
        logo.style.cursor = "pointer";
    }
});

// Helper functions
window.playSong = async function (songId) {
    if (window.shareManager) {
        await window.shareManager.playSong(songId);
    }
};

window.playAlbum = async function (albumName) {
    if (window.shareManager) {
        await window.shareManager.playAlbum(albumName);
    }
};

window.playSharedPlaylist = async function (playlistId) {
    if (window.shareManager) {
        await window.shareManager.playSharedPlaylist(playlistId);
    }
};
