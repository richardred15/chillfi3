/**
 * Content Manager - Handles loading and displaying songs, albums, etc.
 */
import { formatDuration } from "./utils/formatters.js";
import URLManager from "./utils/urlManager.js";

class ContentManager {
    constructor(api, toast) {
        this.api = api;
        this.toast = toast;
        this.currentSongs = [];

        // Constants
        this.HOME_SECTION_ITEM_COUNT = 10;
    }

    // Sanitize HTML to prevent XSS
    sanitizeHTML(str) {
        const div = document.createElement("div");
        div.textContent = str;
        return div.innerHTML;
    }

    // Initialize content loading
    async init() {
        const errorHandler = window.errorHandler;
        try {
            await this.loadAllSongs();
            this.renderHomeSections();
            this.setupSearch();
            this.setupSeeAllHandlers();
        } catch (error) {
            if (errorHandler) {
                errorHandler.handleError(error, "Content initialization");
            } else {
                console.error("Failed to initialize content:", error);
                this.toast.show("Failed to load content");
            }
        }
    }

    // Load all songs once
    async loadAllSongs() {
        try {
            // Load recent songs for home page (server-side limited)
            const response = await this.api.getSongs(
                {},
                1,
                this.HOME_SECTION_ITEM_COUNT
            );

            if (response.error || !response.success) {
                throw new Error(response.message || "Server returned error");
            }

            const songs = response.data?.items || response.songs || [];
            this.allSongs = songs; // For search - will need to load more when searching
            this.currentSongs = songs;
        } catch (error) {
            console.error("Failed to load songs:", error);
            this.allSongs = [];
            this.currentSongs = [];
        }
    }

    // Show empty state
    showEmptyState() {
        const container = document.getElementById("recentSongsList");
        if (container) {
            container.innerHTML =
                '<div class="empty-state">No songs uploaded yet. Upload some music to get started!</div>';
        }
    }

    // Render home sections using loaded data
    renderHomeSections() {
        this.renderSongList(this.currentSongs);
        this.loadAlbums(); // Load albums from API
        this.loadRecentlyPlayed(); // Only this needs API call
    }

    // Load recently played songs (only API call needed)
    async loadRecentlyPlayed() {
        try {
            const response = await this.api.getRecentlyPlayed(
                this.HOME_SECTION_ITEM_COUNT
            );
            const songs = response.data?.items || response.songs || [];
            this.renderRecentlyPlayedGrid(songs);
        } catch (error) {
            console.error("Failed to load recently played:", error);
            const container = document.getElementById("recentlyPlayedGrid");
            if (container) {
                container.innerHTML =
                    '<div class="empty-state">No recently played songs</div>';
            }
        }
    }

    // Render song list
    renderSongList(songs) {
        const container = document.getElementById("recentSongsList");
        if (!container) return;

        container.innerHTML = "";

        songs.forEach((song, index) => {
            const songItem = document.createElement("div");
            songItem.className = "song-item";
            songItem.dataset.songId = song.id;
            songItem.dataset.type = "song";

            const artworkStyle = song.cover_art_url
                ? `background: url(${song.cover_art_url}) center/cover no-repeat`
                : "background: linear-gradient(45deg, #8C67EF, #4F9EFF)";

            const sanitizedTitle = this.sanitizeHTML(
                song.title || "Unknown Title"
            );
            const sanitizedArtist = this.sanitizeHTML(
                song.artist || "Unknown Artist"
            );

            songItem.innerHTML = `
                <div class="song-artwork" style="${artworkStyle}"></div>
                <div class="song-info">
                    <div class="song-title">${sanitizedTitle}</div>
                    <div class="song-artist">${sanitizedArtist}</div>
                </div>
                <div class="song-artist-desktop">${sanitizedArtist}</div>
                <div class="song-duration">${formatDuration(
                    song.duration
                )}</div>
            `;

            // Add click handler for play
            songItem.addEventListener("click", () => this.playSong(song));

            container.appendChild(songItem);
        });
    }

    // Load albums from API
    async loadAlbums() {
        try {
            const response = await this.api.getAlbums(
                1,
                this.HOME_SECTION_ITEM_COUNT
            );
            const albums = response.data?.items || response.albums || [];
            this.renderAlbumGrid(albums);
        } catch (error) {
            console.error("Failed to load albums:", error);
            const container = document.getElementById("topAlbumsGrid");
            if (container) {
                container.innerHTML =
                    '<div class="empty-state">No albums available</div>';
            }
        }
    }

    // Render album grid using album data
    renderAlbumGrid(albums) {
        const container = document.getElementById("topAlbumsGrid");
        if (!container) return;

        container.innerHTML = "";

        albums.forEach((album) => {
            const card = document.createElement("div");
            card.className = "card";
            card.dataset.albumId = album.id;
            card.dataset.songId = album.id; // Use album ID as fallback for context menu
            card.dataset.type = "album";

            const artworkStyle = album.cover_art_url
                ? `background: url(${album.cover_art_url}) center/cover no-repeat`
                : "background: linear-gradient(45deg, #8C67EF, #4F9EFF)";

            const sanitizedTitle = this.sanitizeHTML(
                album.title || "Unknown Album"
            );
            const sanitizedArtist = this.sanitizeHTML(
                album.artist || "Unknown Artist"
            );

            card.innerHTML = `
                <div class="card-image" style="${artworkStyle}"></div>
                <div class="card-content">
                    <div class="card-title">${sanitizedTitle}</div>
                    <div class="card-subtitle">${sanitizedArtist}</div>
                </div>
                <button class="card-play">
                    <img src="client/icons/play.svg" alt="Play" width="24" height="24">
                </button>
            `;

            // Add album click handler
            card.addEventListener("click", () => {
                if (window.albumView) {
                    window.albumView.show(album.title, album.artist, album.id);
                }
            });

            container.appendChild(card);
        });
    }

    // Render recently played grid
    renderRecentlyPlayedGrid(songs) {
        const container = document.getElementById("recentlyPlayedGrid");
        if (!container) return;

        container.innerHTML = "";

        songs.forEach((song, index) => {
            // Preload first few images for better LCP
            if (index < 3 && song.cover_art_url) {
                const img = new Image();
                img.src = song.cover_art_url;
            }
            const card = document.createElement("div");
            card.className = "card";
            card.dataset.songId = song.id;
            card.dataset.type = "song";

            const artworkStyle = song.cover_art_url
                ? `background: url(${song.cover_art_url}) center/cover no-repeat`
                : "background: linear-gradient(45deg, #8C67EF, #4F9EFF)";

            const sanitizedTitle = this.sanitizeHTML(
                song.title || "Unknown Title"
            );
            const sanitizedArtist = this.sanitizeHTML(
                song.artist || "Unknown Artist"
            );

            card.innerHTML = `
                <div class="card-image" style="${artworkStyle}"></div>
                <div class="card-content">
                    <div class="card-title">${sanitizedTitle}</div>
                    <div class="card-subtitle">${sanitizedArtist}</div>
                </div>`;

            // Add card click handler
            card.addEventListener("click", () => {
                this.playSong(song, "recently_played");
            });

            container.appendChild(card);
        });
    }

    // Setup search functionality
    setupSearch() {
        const searchInput = document.getElementById("searchInput");
        if (!searchInput) return;

        let searchTimeout;
        searchInput.addEventListener("input", (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.performSearch(e.target.value);
            }, 500); // Increased debounce for server calls
        });
    }

    // Perform search using server-side search
    async performSearch(query, page = 1, limit = 20) {
        if (!query.trim()) {
            this.showHomeSections();
            return;
        }

        try {
            const response = await this.api.searchSongs(query, page, limit);
            const songs = response.data?.songs || response.songs || [];
            const total = response.data?.total || response.total || 0;

            this.showSearchResults(query, songs, page, limit, total);
        } catch (error) {
            console.error("Search failed:", error);
            this.toast.show("Search failed");
            this.showSearchResults(query, [], 1, limit, 0);
        }
    }

    // Show search results section with pagination
    showSearchResults(query, songs, page = 1, limit = 20, total = 0) {
        // Show search results section
        this.showSection("searchResults");

        // Create or show search results section
        let searchSection = document.getElementById("searchResults");
        if (!searchSection) {
            searchSection = document.createElement("section");
            searchSection.id = "searchResults";
            searchSection.className = "section";
            searchSection.innerHTML = `
                <div class="section-header">
                    <h2 class="section-title">Search Results</h2>
                    <div class="section-actions">
                        <div class="search-query"></div>
                        <div class="pagination-controls">
                            <select id="searchPageSizeSelect">
                                <option value="10">10 per page</option>
                                <option value="20" selected>20 per page</option>
                                <option value="50">50 per page</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div id="searchResultsList" class="song-list"></div>
                <div id="searchPaginationNav" class="pagination-nav"></div>
            `;
            document.getElementById("content").appendChild(searchSection);
        }

        searchSection.style.display = "block";

        // Update search query display
        const queryDisplay = searchSection.querySelector(".search-query");
        if (queryDisplay) {
            queryDisplay.textContent = query
                ? `"${this.sanitizeHTML(query)}"`
                : "Type to search...";
        }

        // Update page size selector
        const pageSizeSelect = document.getElementById("searchPageSizeSelect");
        if (pageSizeSelect) {
            pageSizeSelect.value = limit;
            pageSizeSelect.onchange = () => {
                this.performSearch(query, 1, parseInt(pageSizeSelect.value));
            };
        }

        // Render search results
        this.renderSearchResults(songs);

        // Render pagination
        this.renderPagination(
            page,
            limit,
            total,
            "search",
            "searchPaginationNav",
            "searchPageSizeSelect",
            query
        );

        // Set active nav item for search
        const navItems = document.querySelectorAll(".nav-item");
        navItems.forEach((item) => item.classList.remove("active"));
        const searchNavItem = Array.from(navItems).find((item) =>
            item.querySelector(".nav-item-text")?.textContent.includes("Search")
        );
        if (searchNavItem) {
            searchNavItem.classList.add("active");
        }
    }

    // Render search results
    renderSearchResults(songs) {
        const container = document.getElementById("searchResultsList");
        if (!container) return;

        container.innerHTML = "";

        if (songs.length === 0) {
            container.innerHTML =
                '<div class="empty-state">No songs found</div>';
            return;
        }

        songs.forEach((song, index) => {
            const songItem = document.createElement("div");
            songItem.className = "song-item";
            songItem.dataset.songId = song.id;

            const sanitizedTitle = this.sanitizeHTML(
                song.title || "Unknown Title"
            );
            const sanitizedArtist = this.sanitizeHTML(
                song.artist || "Unknown Artist"
            );

            const artworkStyle = song.cover_art_url
                ? `background: url(${song.cover_art_url}) center/cover no-repeat`
                : "background: linear-gradient(45deg, #8C67EF, #4F9EFF)";

            songItem.innerHTML = `
                <div class="song-artwork" style="${artworkStyle}"></div>
                <div class="song-info">
                    <div class="song-title">${sanitizedTitle}</div>
                    <div class="song-artist">${sanitizedArtist}</div>
                </div>
                <div class="song-artist-desktop">${sanitizedArtist}</div>
                <div class="song-duration">${formatDuration(
                    song.duration
                )}</div>
            `;

            // Add click handler for play
            songItem.addEventListener("click", () =>
                this.playSong(song, "search")
            );

            container.appendChild(songItem);
        });
    }

    // Show search section
    showSearchSection() {
        this.showSearchResults("", [], 1, 20, 0);
        const searchInput = document.getElementById("searchInput");
        if (searchInput) {
            searchInput.focus();
        }

        // Set active nav item
        const navItems = document.querySelectorAll(".nav-item");
        navItems.forEach((item) => item.classList.remove("active"));
        const searchNavItem = Array.from(navItems).find((item) =>
            item.querySelector(".nav-item-text")?.textContent.includes("Search")
        );
        if (searchNavItem) {
            searchNavItem.classList.add("active");
        }
    }

    // Show my library section
    async showMyLibrary(page = 1, limit = 24) {
        try {
            const artists = await this.getUserArtists(
                "current_user",
                page,
                limit
            );
            this.showArtistsSection(
                "My Library",
                artists,
                "library",
                page,
                limit
            );

            // Set active nav item
            const navItems = document.querySelectorAll(".nav-item");
            navItems.forEach((item) => item.classList.remove("active"));
            const libraryNavItem = document.getElementById("libraryNavItem");
            if (libraryNavItem) {
                libraryNavItem.classList.add("active");
            }
        } catch (error) {
            console.error("Failed to load library:", error);
            this.toast.show("Failed to load library");
        }
    }

    // Show user library section (for shared links)
    async showUserLibrary(username, page = 1, limit = 24) {
        try {
            const artists = await this.getUserArtists(username, page, limit);
            const title =
                username === this.api.user?.username
                    ? "My Library"
                    : `${username}'s Library`;
            this.showArtistsSection(
                title,
                artists,
                "user_library",
                page,
                limit
            );

            // Clear active nav items since this is a shared view
            const navItems = document.querySelectorAll(".nav-item");
            navItems.forEach((item) => item.classList.remove("active"));
        } catch (error) {
            console.error("Failed to load user library:", error);
            this.toast.show(`Failed to load ${username}'s library`);
        }
    }

    // Get artists for a user
    async getUserArtists(username, page = 1, limit = 24) {
        const response = await this.api.getSongs(
            { uploadedBy: username },
            1,
            1000
        ); // Get all songs
        const songs = response.data?.items || response.songs || [];

        // Group songs by artist
        const artistMap = new Map();
        songs.forEach((song) => {
            const artistName = song.artist || "Unknown Artist";
            if (!artistMap.has(artistName)) {
                artistMap.set(artistName, {
                    name: artistName,
                    albums: new Set(),
                    songCount: 0,
                    artwork: song.cover_art_url,
                });
            }
            const artist = artistMap.get(artistName);
            artist.albums.add(song.album || "Unknown Album");
            artist.songCount++;
            if (!artist.artwork && song.cover_art_url) {
                artist.artwork = song.cover_art_url;
            }
        });

        // Convert to array and add album count
        const artists = Array.from(artistMap.values()).map((artist) => ({
            ...artist,
            albumCount: artist.albums.size,
            albums: undefined, // Remove Set object
        }));

        // Sort by song count (most popular first)
        artists.sort((a, b) => b.songCount - a.songCount);

        // Apply pagination
        const offset = (page - 1) * limit;
        const paginatedArtists = artists.slice(offset, offset + limit);

        return {
            artists: paginatedArtists,
            total: artists.length,
            page,
        };
    }

    // Show artists section
    showArtistsSection(title, artistsData, context, page, limit) {
        const sectionId = `${context}Section`;
        const gridId = `${context}Grid`;
        const navId = `${context}PaginationNav`;
        const selectId = `${context}PageSizeSelect`;

        // Show artists section
        this.showSection(sectionId);

        // Create or show section
        let section = document.getElementById(sectionId);
        if (!section) {
            section = document.createElement("section");
            section.id = sectionId;
            section.className = "section";
            section.innerHTML = `
                <div class="section-header">
                    <h2 class="section-title"></h2>
                    <div class="section-actions">
                        <div class="pagination-controls">
                            <select id="${selectId}">
                                <option value="12">12 per page</option>
                                <option value="24" selected>24 per page</option>
                                <option value="48">48 per page</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div id="${gridId}" class="card-grid"></div>
                <div id="${navId}" class="pagination-nav"></div>
            `;
            document.getElementById("content").appendChild(section);
        }

        section.style.display = "block";
        section.querySelector(".section-title").textContent = title;

        // Render artist cards
        const container = document.getElementById(gridId);
        container.innerHTML = "";

        artistsData.artists.forEach((artist) => {
            const card = document.createElement("div");
            card.className = "card";
            card.dataset.artistName = artist.name;
            card.dataset.songId = `artist_${artist.name}`; // For context menu
            card.dataset.type = "artist";

            const artworkStyle = artist.artwork
                ? `background: url(${artist.artwork}) center/cover no-repeat`
                : "background: linear-gradient(45deg, #8C67EF, #4F9EFF)";

            card.innerHTML = `
                <div class="card-image" style="${artworkStyle}"></div>
                <div class="card-content">
                    <div class="card-title">${this.sanitizeHTML(
                        artist.name
                    )}</div>
                    <div class="card-subtitle">${artist.albumCount} albums • ${
                artist.songCount
            } songs</div>
                </div>
                <button class="card-play">
                    <img src="client/icons/play.svg" alt="Play" width="24" height="24">
                </button>
            `;

            // Add click handler to show artist's albums
            card.addEventListener("click", () => {
                const username = context.includes("user_library")
                    ? context.split("_")[1] + "_library"
                    : "current_user";
                this.showArtistAlbums(artist.name, username);
                // Update URL for artist
                URLManager.setURL({ artist: artist.name });
            });

            container.appendChild(card);
        });

        // Setup pagination
        this.renderPagination(
            page,
            limit,
            artistsData.total,
            context,
            navId,
            selectId
        );
    }

    // Show albums for a specific artist
    async showArtistAlbums(artistName, username = "current_user") {
        try {
            const response = await this.api.getSongs(
                { uploadedBy: username, artist: artistName },
                1,
                1000
            );
            const songs = response.data?.items || response.songs || [];

            // Group songs by album
            const albumMap = new Map();
            songs.forEach((song) => {
                const albumName = song.album || "Unknown Album";
                if (!albumMap.has(albumName)) {
                    albumMap.set(albumName, {
                        title: albumName,
                        artist: artistName,
                        year: song.year,
                        artwork: song.cover_art_url,
                        songs: [],
                    });
                }
                albumMap.get(albumName).songs.push(song);
            });

            const albums = Array.from(albumMap.values());

            // Show albums section
            this.showAlbumsForArtist(artistName, albums, username);
        } catch (error) {
            console.error("Failed to load artist albums:", error);
            this.toast.show("Failed to load albums");
        }
    }

    // Show albums section for an artist
    showAlbumsForArtist(artistName, albums, username) {
        const sectionId = "artistAlbumsSection";

        // Show artist albums section
        this.showSection(sectionId);

        // Create or show section
        let section = document.getElementById(sectionId);
        if (!section) {
            section = document.createElement("section");
            section.id = sectionId;
            section.className = "section";
            section.innerHTML = `
                <div class="section-header">
                    <h2 class="section-title"></h2>
                    <div class="section-actions">
                        <button class="btn btn-secondary back-button" id="backToArtists">
                            <img src="client/icons/arrow-left.svg" alt="Back" width="16" height="16">
                            Back to Artists
                        </button>
                    </div>
                </div>
                <div id="artistAlbumsGrid" class="card-grid"></div>
            `;
            document.getElementById("content").appendChild(section);
        }

        section.style.display = "block";
        section.querySelector(
            ".section-title"
        ).textContent = `${artistName} - Albums`;

        // Setup back button - only show if accessed from library context
        const backButton = document.getElementById("backToArtists");
        if (backButton) {
            // Show back button only if we have a library context (not from shared URL)
            if (
                username === "current_user" ||
                username.includes("user_library")
            ) {
                backButton.style.display = "flex";
            } else {
                backButton.style.display = "none";
            }

            backButton.onclick = () => {
                if (username === "current_user") {
                    this.showMyLibrary();
                } else {
                    this.showUserLibrary(username);
                }
            };
        }

        // Render album cards
        const container = document.getElementById("artistAlbumsGrid");
        container.innerHTML = "";

        albums.forEach((album) => {
            const card = document.createElement("div");
            card.className = "card";
            card.dataset.albumTitle = album.title;
            card.dataset.artistName = album.artist;

            const artworkStyle = album.artwork
                ? `background: url(${album.artwork}) center/cover no-repeat`
                : "background: linear-gradient(45deg, #8C67EF, #4F9EFF)";

            card.innerHTML = `
                <div class="card-image" style="${artworkStyle}"></div>
                <div class="card-content">
                    <div class="card-title">${this.sanitizeHTML(
                        album.title
                    )}</div>
                    <div class="card-subtitle">${
                        album.year || "Unknown Year"
                    } • ${album.songs.length} songs</div>
                </div>
                <button class="card-play">
                    <img src="client/icons/play.svg" alt="Play" width="24" height="24">
                </button>
            `;

            // Add click handler to show album view
            card.addEventListener("click", () => {
                if (window.albumView) {
                    window.albumView.show(album.title, album.artist);
                    // Update URL for album
                    URLManager.setURL({
                        album: album.title,
                        artist: album.artist,
                    });
                }
            });

            container.appendChild(card);
        });
    }

    // Setup See All handlers
    setupSeeAllHandlers() {
        // Recently Played See All
        const recentlyPlayedSeeAll = document.querySelector(
            "#recentlyPlayedSection .section-action"
        );
        if (recentlyPlayedSeeAll) {
            recentlyPlayedSeeAll.addEventListener("click", () => {
                this.showAllRecentlyPlayed();
            });
        }

        // Top Albums See All
        const topAlbumsSeeAll = document.querySelector(
            "#topAlbumsSection .section-action"
        );
        if (topAlbumsSeeAll) {
            topAlbumsSeeAll.addEventListener("click", () => {
                this.showAllAlbums();
            });
        }
    }

    // Show all recently played songs
    async showAllRecentlyPlayed(page = 1, limit = 20) {
        try {
            // Calculate offset for pagination
            const offset = (page - 1) * limit;
            const response = await this.api.getRecentlyPlayed(limit, offset);
            const songs = response.data?.items || response.songs || [];

            // Get total count from response
            const total =
                response.total ||
                response.data?.pagination?.total ||
                songs.length;

            this.showPaginatedSectionWithControls(
                "All Recently Played",
                songs,
                "recently_played",
                page,
                limit,
                total
            );
        } catch (error) {
            console.error("Failed to load all recently played:", error);
            this.toast.show("Failed to load recently played songs");
        }
    }

    // Show all albums
    async showAllAlbums(page = 1, limit = 24) {
        try {
            // Use proper server-side pagination
            const response = await this.api.getAlbums(page, limit);
            const albums = response.data?.items || response.albums || [];
            const total =
                response.data?.pagination?.total || response.total || 0;
            this.showAlbumsSection("All Albums", albums, page, limit, total);
        } catch (error) {
            console.error("Failed to load all albums:", error);
            this.toast.show("Failed to load albums");
        }
    }

    // Show paginated section with controls
    showPaginatedSectionWithControls(
        title,
        songs,
        context,
        page,
        limit,
        total
    ) {
        const sectionId =
            context === "library"
                ? "librarySection"
                : context === "recently_played"
                ? "allRecentlyPlayedSection"
                : "paginatedSection";
        const listId =
            context === "library"
                ? "libraryList"
                : context === "recently_played"
                ? "allRecentlyPlayedList"
                : "paginatedList";
        const navId =
            context === "library"
                ? "libraryPaginationNav"
                : context === "recently_played"
                ? "allRecentlyPlayedPaginationNav"
                : "paginationNav";
        const selectId =
            context === "library"
                ? "libraryPageSizeSelect"
                : context === "recently_played"
                ? "allRecentlyPlayedPageSizeSelect"
                : "pageSizeSelect";

        // Show paginated section
        this.showSection(sectionId);

        // Create or show section
        let section = document.getElementById(sectionId);
        if (!section) {
            section = document.createElement("section");
            section.id = sectionId;
            section.className = "section";
            section.innerHTML = `
                <div class="section-header">
                    <h2 class="section-title"></h2>
                    <div class="section-actions">
                        <div class="pagination-controls">
                            <select id="${selectId}">
                                <option value="10">10 per page</option>
                                <option value="20" selected>20 per page</option>
                                <option value="50">50 per page</option>
                                <option value="100">100 per page</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div id="${listId}" class="song-list"></div>
                <div id="${navId}" class="pagination-nav"></div>
            `;
            document.getElementById("content").appendChild(section);
        }

        section.style.display = "block";
        section.querySelector(".section-title").textContent = title;

        // Update page size selector
        const pageSizeSelect = document.getElementById(selectId);
        if (pageSizeSelect) {
            pageSizeSelect.value = limit;
            pageSizeSelect.onchange = () => {
                if (context === "library") {
                    this.showMyLibrary(1, parseInt(pageSizeSelect.value));
                } else if (context === "recently_played") {
                    this.showAllRecentlyPlayed(
                        1,
                        parseInt(pageSizeSelect.value)
                    );
                }
            };
        }

        // Render songs
        const container = document.getElementById(listId);
        if (container) {
            container.innerHTML = "";

            songs.forEach((song, index) => {
                const songItem = document.createElement("div");
                songItem.className = "song-item";
                songItem.dataset.songId = song.id;

                const artworkStyle = song.cover_art_url
                    ? `background: url(${song.cover_art_url}) center/cover no-repeat`
                    : "background: linear-gradient(45deg, #8C67EF, #4F9EFF)";

                songItem.innerHTML = `
                    <div class="song-artwork" style="${artworkStyle}"></div>
                    <div class="song-info">
                        <div class="song-title">${song.title}</div>
                        <div class="song-artist">${
                            song.artist || "Unknown Artist"
                        }</div>
                    </div>
                    <div class="song-artist-desktop">${
                        song.artist || "Unknown Artist"
                    }</div>
                    <div class="song-duration">${formatDuration(
                        song.duration
                    )}</div>
                `;

                songItem.addEventListener("click", () =>
                    this.playSong(song, context)
                );
                container.appendChild(songItem);
            });
        }

        // Render pagination
        this.renderPagination(page, limit, total, context, navId, selectId);

        // Remove active class from nav items
        const navItems = document.querySelectorAll(".nav-item");
        navItems.forEach((item) => item.classList.remove("active"));
    }

    // Render pagination controls
    renderPagination(
        currentPage,
        limit,
        total,
        context,
        navId,
        selectId,
        searchQuery = null
    ) {
        const container = document.getElementById(navId);
        if (!container) {
            return;
        }

        const totalPages = Math.ceil(total / limit) || 1;

        let paginationHTML = '<div class="pagination">';

        // Previous button
        const prevDisabled = currentPage <= 1;
        paginationHTML += `<button class="pagination-btn${
            prevDisabled ? " disabled" : ""
        }" data-page="${currentPage - 1}" ${
            prevDisabled ? "disabled" : ""
        }>Previous</button>`;

        // Page numbers
        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, currentPage + 2);

        for (let i = startPage; i <= endPage; i++) {
            const activeClass = i === currentPage ? " active" : "";
            paginationHTML += `<button class="pagination-btn${activeClass}" data-page="${i}">${i}</button>`;
        }

        // Next button
        const nextDisabled = currentPage >= totalPages;
        paginationHTML += `<button class="pagination-btn${
            nextDisabled ? " disabled" : ""
        }" data-page="${currentPage + 1}" ${
            nextDisabled ? "disabled" : ""
        }>Next</button>`;

        paginationHTML += "</div>";
        container.innerHTML = paginationHTML;

        // Add click handlers
        container.querySelectorAll(".pagination-btn").forEach((btn) => {
            btn.addEventListener("click", () => {
                if (btn.disabled) return;
                const page = parseInt(btn.dataset.page);
                const limit = parseInt(document.getElementById(selectId).value);

                // Validate pagination parameters
                if (isNaN(page) || page < 1 || isNaN(limit) || limit < 1)
                    return;

                if (context === "library") {
                    this.showMyLibrary(page, limit);
                } else if (context === "user_library") {
                    // Extract username from current URL
                    const urlParams = new URLSearchParams(
                        window.location.search
                    );
                    const username = urlParams.get("library");
                    if (username) {
                        this.showUserLibrary(username, page, limit);
                    }
                } else if (context === "recently_played") {
                    this.showAllRecentlyPlayed(page, limit);
                } else if (context === "albums") {
                    this.showAllAlbums(page, limit);
                } else if (context === "search" && searchQuery) {
                    this.performSearch(searchQuery, page, limit);
                }
            });
        });
    }

    // Render pagination controls for albums (uses main pagination method)
    renderAlbumPagination(currentPage, limit, total) {
        this.renderPagination(
            currentPage,
            limit,
            total,
            "albums",
            "albumsPaginationNav",
            "albumPageSizeSelect"
        );
    }

    // Show albums section with pagination
    showAlbumsSection(title, albums, page, limit, total) {
        // Show albums section
        this.showSection("albumsSection");

        // Create or show albums section
        let albumsSection = document.getElementById("albumsSection");
        if (!albumsSection) {
            albumsSection = document.createElement("section");
            albumsSection.id = "albumsSection";
            albumsSection.className = "section";
            albumsSection.innerHTML = `
                <div class="section-header">
                    <h2 class="section-title"></h2>
                    <div class="section-actions">
                        <div class="pagination-controls">
                            <select id="albumPageSizeSelect">
                                <option value="12">12 per page</option>
                                <option value="24" selected>24 per page</option>
                                <option value="48">48 per page</option>
                                <option value="96">96 per page</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div id="albumsGrid" class="card-grid"></div>
                <div id="albumsPaginationNav" class="pagination-nav"></div>
            `;
            document.getElementById("content").appendChild(albumsSection);
        }

        albumsSection.style.display = "block";
        albumsSection.querySelector(".section-title").textContent = title;

        // Update page size selector
        const pageSizeSelect = document.getElementById("albumPageSizeSelect");
        if (pageSizeSelect) {
            pageSizeSelect.value = limit;
            pageSizeSelect.onchange = () => {
                this.showAllAlbums(1, parseInt(pageSizeSelect.value));
            };
        }

        const container = document.getElementById("albumsGrid");
        container.innerHTML = "";

        albums.forEach((album) => {
            const card = document.createElement("div");
            card.className = "card";
            card.dataset.albumId = album.id;
            card.dataset.songId = album.id;

            const artworkStyle = album.cover_art_url
                ? `background: url(${album.cover_art_url}) center/cover no-repeat`
                : "background: linear-gradient(45deg, #8C67EF, #4F9EFF)";

            card.innerHTML = `
                <div class="card-image" style="${artworkStyle}"></div>
                <div class="card-content">
                    <div class="card-title">${album.title}</div>
                    <div class="card-subtitle">${album.artist}</div>
                </div>
                <button class="card-play">
                    <img src="client/icons/play.svg" alt="Play" width="24" height="24">
                </button>
            `;

            card.addEventListener("click", () => {
                if (window.albumView) {
                    window.albumView.show(album.title, album.artist, album.id);
                }
            });

            container.appendChild(card);
        });

        // Render pagination for albums
        this.renderAlbumPagination(page, limit, total);

        // Remove active class from nav items
        const navItems = document.querySelectorAll(".nav-item");
        navItems.forEach((item) => item.classList.remove("active"));
    }

    // Centralized section management
    showSection(sectionId, homeSections = []) {
        const sections = document.querySelectorAll("#content .section");
        sections.forEach((section) => {
            if (section.id === sectionId || homeSections.includes(section.id)) {
                section.style.display = "block";
            } else {
                section.style.display = "none";
            }
        });

        // Clear URL when showing home sections
        if (homeSections.length > 0) {
            URLManager.clearURL();
        }
    }

    // Show home sections
    showHomeSections() {
        const homeSectionIds = [
            "recentlyPlayedSection",
            "topAlbumsSection",
            "recentlyAddedSection",
        ];
        this.showSection(null, homeSectionIds);

        // Reload all home content
        this.renderHomeSections();

        // Restore active class to home nav item
        const navItems = document.querySelectorAll(".nav-item");
        navItems.forEach((item) => item.classList.remove("active"));
        const homeNavItem = document.querySelector(".nav-item");
        if (homeNavItem) {
            homeNavItem.classList.add("active");
        }

        // Clear URL when going home
        URLManager.clearURL();
    }

    // Play song with queue context
    async playSong(song, context = "recent") {
        const errorHandler = window.errorHandler;
        const wrappedApiCall = errorHandler
            ? errorHandler.wrapAsync(
                  this.api.playSong.bind(this.api),
                  "Play song"
              )
            : this.api.playSong.bind(this.api);

        try {
            const response = await wrappedApiCall(song.id);

            // Build queue based on context
            let queue = [];
            if (context === "recent") {
                queue = await this.buildQueueFromSongs(this.currentSongs, song);
            }

            // Use the global player component
            if (window.player) {
                window.player.playSong(
                    {
                        url: response.url,
                        metadata: {
                            id: song.id,
                            title: song.title,
                            artist: song.artist || "Unknown Artist",
                            album: song.album,
                            artwork: song.cover_art_url || song.artwork_url,
                            duration: song.duration,
                        },
                    },
                    queue
                );
            }

            // Record listen
            await this.api.recordListen(song.id);

            this.toast.show(`Now playing: ${song.title}`);
        } catch (error) {
            console.error("Failed to play song:", error);
            this.toast.show("Failed to play song");
        }
    }

    // Build queue from song list
    async buildQueueFromSongs(songs, currentSong) {
        const queue = [];

        for (const song of songs) {
            try {
                const response = await this.api.playSong(song.id);
                queue.push({
                    url: response.url,
                    metadata: {
                        id: song.id,
                        title: song.title,
                        artist: song.artist || "Unknown Artist",
                        album: song.album,
                        artwork: song.cover_art_url || song.artwork_url,
                        duration: song.duration,
                    },
                });
            } catch (error) {
                console.error("Failed to get song URL for queue:", error);
            }
        }

        return queue;
    }

    // Add song to queue
    async addToQueue(songId) {
        try {
            await this.api.addToQueue(songId);
            this.toast.show("Added to queue");
        } catch (error) {
            console.error("Failed to add to queue:", error);
            this.toast.show("Failed to add to queue");
        }
    }

    // Show playlist error (called by ShareManager)
    showPlaylistError(message) {
        this.showSection("playlistError");

        let errorSection = document.getElementById("playlistError");
        if (!errorSection) {
            errorSection = document.createElement("section");
            errorSection.id = "playlistError";
            errorSection.className = "section";
            document.getElementById("content").appendChild(errorSection);
        }

        errorSection.style.display = "block";
        errorSection.innerHTML = `
            <div class="section-header">
                <h2 class="section-title">Playlist Unavailable</h2>
            </div>
            <div class="playlist-error-content">
                <p>${this.sanitizeHTML(message)}</p>
                <button class="btn btn-primary" onclick="window.contentManager.showHomeSections(); window.history.pushState({}, '', window.location.pathname);">Go Home</button>
            </div>
        `;
    }

    // Show shared playlist (called by ShareManager)
    showSharedPlaylist(playlist, songs, shareManager) {
        this.showSection("sharedPlaylistContent");

        let playlistSection = document.getElementById("sharedPlaylistContent");
        if (!playlistSection) {
            playlistSection = document.createElement("section");
            playlistSection.id = "sharedPlaylistContent";
            playlistSection.className = "section";
            document.getElementById("content").appendChild(playlistSection);
        }

        playlistSection.style.display = "block";
        const canEdit =
            this.api &&
            this.api.user &&
            (this.api.user.id === playlist.user_id || this.api.user.is_admin);
        const editButtons = canEdit
            ? `
            <button class="btn btn-secondary" onclick="window.playlistManager.editPlaylist(${playlist.id})">Edit</button>
            <button class="btn btn-secondary" onclick="window.playlistManager.deletePlaylist(${playlist.id})">Delete</button>
        `
            : "";

        playlistSection.innerHTML = `
            <div class="section-header">
                <h2 class="section-title">${this.sanitizeHTML(
                    playlist.name
                )}</h2>
                <div class="section-actions">
                    ${editButtons}
                    <button class="btn btn-primary" onclick="window.shareManager.playSharedPlaylist(${
                        playlist.id
                    })">Play All</button>
                </div>
            </div>
            <div class="playlist-info">
                <p>${songs.length} songs • ${
            playlist.is_public ? "Public" : "Private"
        } • by ${this.sanitizeHTML(playlist.owner_username || "Unknown")}</p>
            </div>
            <div class="song-list">
                <div class="song-list-header">
                    <div class="song-list-header-item">#</div>
                    <div class="song-list-header-item">Title</div>
                    <div class="song-list-header-item">Artist</div>
                    <div class="song-list-header-item">Duration</div>
                </div>
                <div id="sharedPlaylistSongs"></div>
            </div>
        `;

        const songsList = document.getElementById("sharedPlaylistSongs");
        if (songs.length === 0) {
            songsList.innerHTML =
                '<div class="song-item-empty">No songs in this playlist</div>';
        } else {
            songs.forEach((song, index) => {
                const songItem = document.createElement("div");
                songItem.className = "song-item";
                songItem.dataset.songId = song.id;
                songItem.innerHTML = `
                    <div class="song-number">${index + 1}</div>
                    <div class="song-info">
                        <div class="song-title">${this.sanitizeHTML(
                            song.title
                        )}</div>
                    </div>
                    <div class="song-artist">${this.sanitizeHTML(
                        song.artist || "Unknown Artist"
                    )}</div>
                    <div class="song-duration">${formatDuration(
                        song.duration || 0
                    )}</div>
                `;

                songItem.addEventListener("click", () => this.playSong(song));
                songsList.appendChild(songItem);
            });
        }
    }

    // Show shared content (called by ShareManager)
    showSharedContent(type, item, items, shareManager) {
        this.showSection("sharedContent");

        let sharedSection = document.getElementById("sharedContent");
        if (!sharedSection) {
            sharedSection = document.createElement("section");
            sharedSection.id = "sharedContent";
            sharedSection.className = "section";
            document.getElementById("content").appendChild(sharedSection);
        }

        sharedSection.style.display = "block";

        if (type === "profile") {
            const avatarUrl = item.profile_image_url || "";
            const avatarStyle = avatarUrl
                ? `background-image: url(${avatarUrl}); background-size: cover; background-position: center;`
                : `background: var(--gradient); display: flex; align-items: center; justify-content: center; color: white; font-size: 32px; font-weight: bold;`;

            sharedSection.innerHTML = `
                <div class="section-header">
                    <h2 class="section-title">Shared Profile</h2>
                </div>
                <div class="shared-item">
                    <div class="shared-avatar${
                        !avatarUrl ? " no-image" : ""
                    }" ${
                avatarUrl ? `style="background-image: url(${avatarUrl});"` : ""
            }>
                        ${
                            !avatarUrl
                                ? this.sanitizeHTML(
                                      (item.display_name || item.username)
                                          .charAt(0)
                                          .toUpperCase()
                                  )
                                : ""
                        }
                    </div>
                    <div class="shared-info">
                        <h3>${this.sanitizeHTML(
                            item.display_name || item.username
                        )}</h3>
                        <p>${this.sanitizeHTML(
                            item.bio || "No bio available"
                        )}</p>
                        <div class="shared-stats">
                            <div><strong>${
                                items.length
                            }</strong> <span>Recent Uploads</span></div>
                        </div>
                    </div>
                </div>
                ${
                    items.length > 0
                        ? `
                    <div class="song-list">
                        <div class="song-list-header">
                            <div class="song-list-header-item">#</div>
                            <div class="song-list-header-item">Title</div>
                            <div class="song-list-header-item">Artist</div>
                        </div>
                        <div id="sharedProfileSongs"></div>
                    </div>
                `
                        : '<p class="no-uploads">No recent uploads</p>'
                }
            `;

            if (items.length > 0) {
                const songsList = document.getElementById("sharedProfileSongs");
                items.forEach((song, index) => {
                    const songItem = document.createElement("div");
                    songItem.className = "song-item";
                    songItem.innerHTML = `
                        <div class="song-number">${index + 1}</div>
                        <div class="song-info">
                            <div class="song-title">${this.sanitizeHTML(
                                song.title
                            )}</div>
                        </div>
                        <div class="song-artist">${this.sanitizeHTML(
                            song.artist || "Unknown Artist"
                        )}</div>
                    `;
                    songItem.addEventListener("click", () =>
                        shareManager.playSong(song.id)
                    );
                    songsList.appendChild(songItem);
                });
            }
        }
    }
}

export default ContentManager;
