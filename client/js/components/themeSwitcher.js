/**
 * Theme Switcher Component
 */
class ThemeSwitcher {
    constructor() {
        this.themes = {
            default: "Default",
            spotify: "Spotify",
            sunset: "Sunset",
            ocean: "Ocean",
            synthwave: "Synthwave",
        };
        this.isReady = false;
        this.readyCallbacks = [];
        this.themeLoaded = false;
        this.observer = null;
        this.updateTimeout = null;
        this.setupAuthenticationListener();
        this.init();
    }

    init() {
        // Start with localStorage theme immediately for better UX
        this.currentTheme = localStorage.getItem("chillfi-theme") || "default";
        this.loadTheme(this.currentTheme);
        this.createThemeSelector();
        this.setupDOMObserver();
    }

    loadTheme(themeName) {
        // Remove existing theme
        const existingTheme = document.getElementById("theme-css");
        if (existingTheme) {
            existingTheme.remove();
        }

        // Load new theme (skip for default)
        if (themeName !== "default") {
            const link = document.createElement("link");
            link.id = "theme-css";
            link.rel = "stylesheet";
            link.href = `client/css/theme/${themeName}.css`;
            document.head.appendChild(link);

            // Wait for CSS to load then update SVGs
            link.onload = () => this.updateSVGGradients();
        } else {
            // For default theme, update immediately
            setTimeout(() => this.updateSVGGradients(), 50);
        }

        this.currentTheme = themeName;
        this.themeLoaded = true;
        localStorage.setItem("chillfi-theme", themeName);
    }

    updateSVGGradients() {
        // Get current theme colors
        const computedStyle = getComputedStyle(document.documentElement);
        const primary = computedStyle
            .getPropertyValue("--accent-primary")
            .trim();
        const secondary = computedStyle
            .getPropertyValue("--accent-secondary")
            .trim();

        // Update all gradient stops in inline SVGs
        const gradientStops = document.querySelectorAll(
            "svg defs linearGradient stop"
        );
        gradientStops.forEach((stop) => {
            if (
                stop.getAttribute("offset") === "0" ||
                !stop.getAttribute("offset")
            ) {
                stop.setAttribute("stop-color", primary);
            } else {
                stop.setAttribute("stop-color", secondary);
            }
        });

        // Update specific gradients by ID in inline SVGs
        const gradientIds = [
            "logoGradient",
            "playGradient",
            "playStrokeGradient",
            "homeGradient",
            "searchGradient",
            "menuGradient",
        ];
        gradientIds.forEach((id) => {
            const gradient = document.getElementById(id);
            if (gradient) {
                const stops = gradient.querySelectorAll("stop");
                if (stops[0]) stops[0].setAttribute("stop-color", primary);
                if (stops[1]) stops[1].setAttribute("stop-color", secondary);
            }
        });

        // Handle external SVG files by reloading them with updated colors
        this.updateExternalSVGs(primary, secondary).then(() => {
            this.markReady();
        });
    }

    async updateExternalSVGs(primary, secondary, onlyNew = false) {
        // First pass: find and tag themed SVGs
        const selector = onlyNew
            ? 'img[src$=".svg"]:not([data-theme-svg])'
            : 'img[src$=".svg"]';
        const allSvgImages = document.querySelectorAll(selector);
        allSvgImages.forEach((img) => {
            if (
                img.src.includes("logo.svg") ||
                img.src.includes("menu.svg") ||
                img.src.includes("home.svg") ||
                img.src.includes("search.svg") ||
                img.src.includes("library.svg") ||
                img.src.includes("playlist.svg") ||
                img.src.includes("upload.svg") ||
                img.src.includes("queue.svg") ||
                img.src.includes("volume.svg") ||
                img.src.includes("activity.svg") ||
                img.src.includes("play.svg") ||
                img.src.includes("share.svg") ||
                img.src.includes("edit.svg")
            ) {
                img.dataset.themeSvg = "true";
                if (!img.dataset.originalSrc) {
                    img.dataset.originalSrc = img.src;
                }
            }
        });

        // Second pass: update all tagged themed SVGs
        const themedSvgImages = document.querySelectorAll(
            'img[data-theme-svg="true"]'
        );

        for (const img of themedSvgImages) {
            const originalSrc = img.dataset.originalSrc || img.src;

            try {
                const response = await fetch(originalSrc);
                let svgText = await response.text();

                // Validate that we got SVG content, not HTML
                if (
                    svgText.includes("<!DOCTYPE html>") ||
                    svgText.includes("<html")
                ) {
                    console.warn(
                        "Received HTML instead of SVG for:",
                        originalSrc
                    );
                    continue;
                }

                // Ensure it contains SVG content
                if (!svgText.includes("<svg")) {
                    console.warn("No SVG content found in:", originalSrc);
                    continue;
                }

                // Replace hardcoded colors with current theme colors
                svgText = svgText.replace(/#8C67EF/g, primary);
                svgText = svgText.replace(/#4F9EFF/g, secondary);

                // Create blob URL and update image
                const blob = new Blob([svgText], { type: "image/svg+xml" });
                const url = URL.createObjectURL(blob);

                // Clean up previous blob URL
                if (img.dataset.blobUrl) {
                    URL.revokeObjectURL(img.dataset.blobUrl);
                }

                img.src = url;
                img.dataset.blobUrl = url;
            } catch (error) {
                console.warn("Failed to update SVG:", originalSrc, error);
            }
        }
    }

    markReady() {
        if (!this.isReady) {
            this.isReady = true;
            this.readyCallbacks.forEach((callback) => callback());
            this.readyCallbacks = [];
        }
    }

    onReady(callback) {
        if (this.isReady) {
            callback();
        } else {
            this.readyCallbacks.push(callback);
        }
    }

    createThemeSelector() {
        const userDropdown = document.querySelector(".user-dropdown");
        if (!userDropdown) return;

        // Check if already exists
        if (userDropdown.querySelector(".theme-selector")) return;

        // Create theme section
        const themeSection = document.createElement("div");
        themeSection.className = "theme-section";

        // Add theme buttons
        Object.entries(this.themes).forEach(([key, name]) => {
            const themeItem = document.createElement("div");
            themeItem.className = `user-dropdown-item theme-item ${
                key === this.currentTheme ? "active" : ""
            }`;
            themeItem.innerHTML = `
                <div class="theme-color-preview theme-${key}"></div>
                <span>${name}</span>
                ${
                    key === this.currentTheme
                        ? '<span class="theme-check">✓</span>'
                        : ""
                }
            `;

            // Prevent menu close and handle theme change
            themeItem.addEventListener("click", (e) => {
                e.stopPropagation();
                this.changeTheme(key);
            });

            themeSection.appendChild(themeItem);
        });

        // Insert before logout button
        const logoutButton = document.getElementById("logoutButton");
        if (logoutButton) {
            userDropdown.insertBefore(themeSection, logoutButton);
        } else {
            userDropdown.appendChild(themeSection);
        }
    }

    async changeTheme(themeName) {
        this.loadTheme(themeName);

        // Update active states
        document.querySelectorAll(".theme-item").forEach((item) => {
            item.classList.remove("active");
            const check = item.querySelector(".theme-check");
            if (check) check.remove();
        });

        const themeItems = document.querySelectorAll(".theme-item");
        themeItems.forEach((item) => {
            if (item.querySelector(`.theme-${themeName}`)) {
                item.classList.add("active");
                item.innerHTML += '<span class="theme-check">✓</span>';
            }
        });

        // Save theme to server if user is authenticated
        if (window.api && window.api.user) {
            try {
                await window.api.updateUserTheme(themeName);
            } catch (error) {
                console.error("Failed to save theme to server:", error);
                // Continue anyway - localStorage will be the fallback
            }
        }

        // Update any dynamically created content
        this.updateDynamicContent();

        // Clean up any blob URLs when theme changes
        this.cleanupBlobUrls();
    }

    cleanupBlobUrls() {
        const svgImages = document.querySelectorAll(
            'img[data-theme-svg="true"]'
        );
        svgImages.forEach((img) => {
            if (img.dataset.blobUrl) {
                URL.revokeObjectURL(img.dataset.blobUrl);
                delete img.dataset.blobUrl;
            }
        });
    }

    updateDynamicContent() {
        // Update any elements that might have been created after initial load
        const elementsToUpdate = document.querySelectorAll(
            ".no-artwork, .card-image:empty"
        );
        elementsToUpdate.forEach((element) => {
            // Force CSS recalculation
            element.style.display = "none";
            element.offsetHeight;
            element.style.display = "";
        });
    }

    // Method to update theme icons for dynamically added elements
    async updateThemeIcons() {
        const computedStyle = getComputedStyle(document.documentElement);
        const primary = computedStyle
            .getPropertyValue("--accent-primary")
            .trim();
        const secondary = computedStyle
            .getPropertyValue("--accent-secondary")
            .trim();

        await this.updateExternalSVGs(primary, secondary);
    }

    // Setup authentication listener to load theme from server
    setupAuthenticationListener() {
        if (window.api && window.api.events) {
            window.api.events.on("authenticated", async () => {
                await this.loadThemeFromServer();
            });
        } else {
            // API not ready yet, wait for it
            setTimeout(() => this.setupAuthenticationListener(), 100);
        }
    }

    // Load theme from server after authentication
    async loadThemeFromServer() {
        if (!window.api || !window.api.user) return;

        try {
            const response = await window.api.getUserTheme();

            if (response.success && response.theme) {
                const serverTheme = response.theme;

                if (serverTheme !== this.currentTheme) {
                    this.loadTheme(serverTheme);
                    this.updateThemeSelector();
                } else {
                    // Still sync to localStorage to ensure consistency
                    localStorage.setItem("chillfi-theme", serverTheme);
                }
            }
        } catch (error) {
            console.error("Failed to load theme from server:", error);
        }
    }

    // Update theme selector UI to reflect current theme
    updateThemeSelector() {
        document.querySelectorAll(".theme-item").forEach((item) => {
            item.classList.remove("active");
            const check = item.querySelector(".theme-check");
            if (check) check.remove();
        });

        const themeItems = document.querySelectorAll(".theme-item");
        themeItems.forEach((item) => {
            if (item.querySelector(`.theme-${this.currentTheme}`)) {
                item.classList.add("active");
                item.innerHTML += '<span class="theme-check">✓</span>';
            }
        });
    }

    // Setup DOM observer to watch for new SVGs
    setupDOMObserver() {
        this.observer = new MutationObserver((mutations) => {
            let hasNewSVGs = false;

            mutations.forEach((mutation) => {
                if (mutation.type === "childList") {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            // Check if added node is SVG or contains SVGs
                            if (
                                node.tagName === "IMG" &&
                                node.src?.endsWith(".svg")
                            ) {
                                hasNewSVGs = true;
                            } else if (node.querySelectorAll) {
                                const svgs =
                                    node.querySelectorAll('img[src$=".svg"]');
                                if (svgs.length > 0) hasNewSVGs = true;
                            }
                        }
                    });
                }
            });

            if (hasNewSVGs) {
                this.debouncedUpdateNewSVGs();
            }
        });

        this.observer.observe(document.body, {
            childList: true,
            subtree: true,
        });
    }

    // Debounced update for new SVGs
    debouncedUpdateNewSVGs() {
        clearTimeout(this.updateTimeout);
        this.updateTimeout = setTimeout(() => {
            this.updateNewSVGs();
        }, 100);
    }

    // Update only newly added SVGs
    async updateNewSVGs() {
        const computedStyle = getComputedStyle(document.documentElement);
        const primary = computedStyle
            .getPropertyValue("--accent-primary")
            .trim();
        const secondary = computedStyle
            .getPropertyValue("--accent-secondary")
            .trim();

        await this.updateExternalSVGs(primary, secondary, true);
    }

    // Cleanup observer and timeouts
    cleanup() {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        clearTimeout(this.updateTimeout);
    }
}

export default ThemeSwitcher;
