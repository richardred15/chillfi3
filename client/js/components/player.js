/**
 * Player Component
 */
import { formatDuration } from "../utils/formatters.js";

export default class Player {
    constructor() {
        this.audio = new Audio();
        this.audio.crossOrigin = 'anonymous';
        this.currentSong = null;
        this.isPlaying = false;
        this.volume = parseFloat(localStorage.getItem("chillfi_volume")) || 0.7;
        this.originalTitle = document.title;

        // Audio analysis setup
        this.audioContext = null;
        this.analyser = null;
        this.source = null;
        this.audioAnalysisReady = false;

        // Initialize Media Session API for mobile notifications
        if ("mediaSession" in navigator) {
            this.initMediaSession();
        }

        this.progressTrack = document.querySelector(".progress-track");
        this.progressCurrent = document.querySelector(".progress-current");
        this.progressHandle = document.querySelector(".progress-handle");
        this.volumeTrack = document.querySelector(".volume-track");
        this.volumeCurrent = document.querySelector(".volume-current");
        this.volumeHandle = document.querySelector(".volume-handle");
        this.playButton = document.querySelector(".player-button.primary");
        this.playIcon = this.playButton?.querySelector("img");
        this.currentTime = document.querySelector(
            ".progress-bar .progress-time:first-child"
        );
        this.totalTime = document.querySelector(
            ".progress-bar .progress-time:last-child"
        );
        this.nowPlayingTitle = document.querySelector(".now-playing-title");
        this.nowPlayingArtist = document.querySelector(".now-playing-artist");
        this.nowPlayingImage = document.querySelector(".now-playing-image");

        // Now playing popup elements
        this.popupTitle = document.querySelector(".now-playing-popup-song");
        this.popupArtist = document.querySelector(".now-playing-popup-artist");
        this.popupAlbum = document.querySelector(".now-playing-popup-album");
        this.popupImage = document.querySelector(".now-playing-popup-image");
        this.queueList = document.querySelector(".queue-list");

        // Queue management
        this.queue = [];
        this.currentIndex = 0;
        this.isShuffled = false;
        this.isRepeat = false;
        this.originalQueue = [];
        this.autoScrollEnabled = true;

        // Shuffle button - find by img alt text
        this.shuffleButton = Array.from(
            document.querySelectorAll(".player-button")
        ).find((btn) => btn.querySelector('img[alt="Shuffle"]'));

        // Repeat button - find by img alt text
        this.repeatButton = Array.from(
            document.querySelectorAll(".player-button")
        ).find((btn) => btn.querySelector('img[alt="Repeat"]'));

        // Next/Previous buttons
        this.nextButton = Array.from(
            document.querySelectorAll(".player-button")
        ).find((btn) => btn.querySelector('img[alt="Next"]'));
        this.previousButton = Array.from(
            document.querySelectorAll(".player-button")
        ).find((btn) => btn.querySelector('img[alt="Previous"]'));

        this.init();
        this.setupQueueScrollListener();
        this.setupAudioAnalysis();
    }

    init() {
        // Set initial volume
        this.audio.volume = this.volume;
        this.updateVolumeUI();

        // Reset progress bar initially
        this.resetProgress();

        // Audio event listeners
        this.audio.addEventListener("timeupdate", () => this.updateProgress());
        this.audio.addEventListener("loadedmetadata", () =>
            this.updateDuration()
        );
        this.audio.addEventListener("ended", () => this.onSongEnd());
        this.audio.addEventListener("play", () => this.onPlay());
        this.audio.addEventListener("pause", () => this.onPause());

        // Control event listeners with drag support
        if (this.progressTrack) {
            this.setupSliderEvents(this.progressTrack, (e) => this.seekTo(e));
        }

        if (this.volumeTrack) {
            this.setupSliderEvents(this.volumeTrack, (e) => this.setVolume(e));
        }

        if (this.playButton) {
            this.playButton.addEventListener("click", (e) => {
                e.stopPropagation();
                this.togglePlayPause();
            });
        }

        if (this.shuffleButton) {
            this.shuffleButton.addEventListener("click", (e) => {
                e.stopPropagation();
                this.toggleShuffle();
            });
        }

        if (this.repeatButton) {
            this.repeatButton.addEventListener("click", (e) => {
                e.stopPropagation();
                this.toggleRepeat();
            });
        }

        if (this.nextButton) {
            this.nextButton.addEventListener("click", (e) => {
                e.stopPropagation();
                this.playNext();
            });
        }

        if (this.previousButton) {
            this.previousButton.addEventListener("click", (e) => {
                e.stopPropagation();
                this.playPrevious();
            });
        }
    }

    playSong(songData, queue = null) {
        this.currentSong = songData;
        this.audio.src = songData.url;
        this.audio.load();

        // Update queue if provided
        if (queue) {
            this.queue = queue;
            this.originalQueue = [...queue];
            this.currentIndex = queue.findIndex(
                (song) => song.metadata.id === songData.metadata.id
            );
            this.autoScrollEnabled = true; // Re-enable auto-scroll for new queue
        }

        // Always update queue UI to reflect current song
        this.updateQueueUI();

        // Update main player UI
        if (this.nowPlayingTitle)
            this.nowPlayingTitle.textContent = songData.metadata.title;
        if (this.nowPlayingArtist)
            this.nowPlayingArtist.textContent = songData.metadata.artist;

        if (this.nowPlayingImage) {
            if (songData.metadata.artwork) {
                this.nowPlayingImage.setAttribute(
                    "style",
                    `background-image: url(${songData.metadata.artwork})`
                );
            } else {
                this.nowPlayingImage.style.background =
                    "linear-gradient(45deg, #8C67EF, #4F9EFF)";
            }
        }

        // Update popup UI
        if (this.popupTitle)
            this.popupTitle.textContent = songData.metadata.title;
        if (this.popupArtist)
            this.popupArtist.textContent = songData.metadata.artist;
        if (this.popupAlbum)
            this.popupAlbum.textContent = `Album: ${
                songData.metadata.album || "Unknown"
            }`;

        if (this.popupImage) {
            if (songData.metadata.artwork) {
                this.popupImage.setAttribute(
                    "style",
                    `background-image: url(${songData.metadata.artwork})`
                );
            } else {
                this.popupImage.style.background =
                    "linear-gradient(45deg, #8C67EF, #4F9EFF)";
            }
        }

        // Update page title and media session
        this.updatePageTitle();
        this.updateMediaSession();

        this.audio.play().catch((error) => {
            console.error("Error playing audio:", error);
        });
    }

    togglePlayPause() {
        if (this.isPlaying) {
            this.audio.pause();
        } else {
            this.audio.play();
        }
    }

    onPlay() {
        this.isPlaying = true;
        if (this.playIcon) {
            this.playIcon.setAttribute("src", "client/icons/pause.svg");
            this.playIcon.setAttribute("alt", "Pause");
        }
    }

    onPause() {
        this.isPlaying = false;
        if (this.playIcon) {
            this.playIcon.setAttribute("src", "client/icons/play.svg");
            this.playIcon.setAttribute("alt", "Play");
        }
        // Revert to original title when paused
        document.title = this.originalTitle;
    }

    onSongEnd() {
        this.isPlaying = false;
        if (this.playIcon) {
            this.playIcon.setAttribute("src", "client/icons/play.svg");
            this.playIcon.setAttribute("alt", "Play");
        }
        this.updateProgress();

        // Auto-play next song in queue
        this.playNext();
    }

    updatePageTitle() {
        if (this.currentSong && this.currentSong.metadata) {
            const artist = this.currentSong.metadata.artist || "Unknown Artist";
            const title = this.currentSong.metadata.title || "Unknown Title";
            document.title = `${artist} - ${title}`;
        } else {
            document.title = this.originalTitle;
        }
    }

    initMediaSession() {
        navigator.mediaSession.setActionHandler("play", () => {
            this.audio.play();
        });

        navigator.mediaSession.setActionHandler("pause", () => {
            this.audio.pause();
        });

        navigator.mediaSession.setActionHandler("previoustrack", () => {
            this.playPrevious();
        });

        navigator.mediaSession.setActionHandler("nexttrack", () => {
            this.playNext();
        });
    }

    updateMediaSession() {
        if (!("mediaSession" in navigator) || !this.currentSong) return;

        const metadata = this.currentSong.metadata;
        let artwork = [];

        if (metadata.artwork) {
            // Add multiple sizes for better compatibility
            artwork = [
                {
                    src: metadata.artwork,
                    sizes: "96x96",
                    type: "image/jpeg",
                },
                {
                    src: metadata.artwork,
                    sizes: "128x128",
                    type: "image/jpeg",
                },
                {
                    src: metadata.artwork,
                    sizes: "192x192",
                    type: "image/jpeg",
                },
                {
                    src: metadata.artwork,
                    sizes: "256x256",
                    type: "image/jpeg",
                },
                {
                    src: metadata.artwork,
                    sizes: "384x384",
                    type: "image/jpeg",
                },
                {
                    src: metadata.artwork,
                    sizes: "512x512",
                    type: "image/jpeg",
                },
            ];
        }

        navigator.mediaSession.metadata = new MediaMetadata({
            title: metadata.title || "Unknown Title",
            artist: metadata.artist || "Unknown Artist",
            album: metadata.album || "Unknown Album",
            artwork: artwork,
        });
    }

    playNext() {
        if (this.queue.length > 0) {
            if (this.currentIndex < this.queue.length - 1) {
                this.currentIndex++;
                this.playSong(this.queue[this.currentIndex]);
                this.updateQueueUI();
            } else if (this.isRepeat) {
                // Go back to beginning if repeat is enabled
                this.currentIndex = 0;
                this.playSong(this.queue[this.currentIndex]);
                this.updateQueueUI();
            }
        }
    }

    playPrevious() {
        if (this.queue.length > 0 && this.currentIndex > 0) {
            this.currentIndex--;
            this.playSong(this.queue[this.currentIndex]);
            this.updateQueueUI();
        }
    }

    updateQueueUI() {
        if (!this.queueList) return;

        this.queueList.innerHTML = "";

        if (this.queue.length === 0) {
            this.queueList.innerHTML =
                '<div class="queue-empty">No songs in queue</div>';
            return;
        }

        this.queue.forEach((songData, index) => {
            const queueItem = document.createElement("div");
            queueItem.className =
                index === this.currentIndex
                    ? "queue-item current-song"
                    : "queue-item";
            queueItem.innerHTML = `
                <div class="queue-item-info">
                    <div class="queue-item-title">${
                        songData.metadata.title
                    }</div>
                    <div class="queue-item-artist">${
                        songData.metadata.artist
                    }</div>
                </div>
                <div class="queue-item-duration">${formatDuration(
                    songData.metadata.duration || 0
                )}</div>
            `;

            // Click to jump to song (except current song)
            if (index !== this.currentIndex) {
                queueItem.addEventListener("click", (e) => {
                    e.stopPropagation();
                    this.currentIndex = index;
                    this.playSong(this.queue[this.currentIndex]);
                });
            }

            this.queueList.appendChild(queueItem);
        });

        // Auto-scroll to current song if enabled
        if (this.autoScrollEnabled) {
            this.scrollToCurrentSong();
        }
    }

    scrollToCurrentSong() {
        if (!this.queueList) return;

        const currentSongElement =
            this.queueList.querySelector(".current-song");
        if (currentSongElement) {
            currentSongElement.scrollIntoView({
                behavior: "smooth",
                block: "center",
            });
        }
    }

    setupQueueScrollListener() {
        if (!this.queueList) return;

        this.queueList.addEventListener("scroll", () => {
            this.autoScrollEnabled = false;
        });
    }

    setupAudioAnalysis() {
        // Setup audio analysis on first play
        const setupAnalysis = () => {
            if (this.audioAnalysisReady) return;

            try {
                this.audioContext = new (window.AudioContext ||
                    window.webkitAudioContext)();
                this.analyser = this.audioContext.createAnalyser();
                this.analyser.fftSize = 512; // Double the bins: 256 total, 128 displayed

                this.source = this.audioContext.createMediaElementSource(
                    this.audio
                );
                this.source.connect(this.analyser);
                this.analyser.connect(this.audioContext.destination);

                this.audioAnalysisReady = true;
                console.log("Audio analysis ready");
            } catch (error) {
                console.warn("Audio analysis setup failed:", error);
            }
        };

        // Setup on first play
        this.audio.addEventListener("play", setupAnalysis, { once: true });

        // Resume context on subsequent plays
        this.audio.addEventListener("play", () => {
            if (this.audioContext && this.audioContext.state === "suspended") {
                this.audioContext.resume();
            }
        });
    }

    getFrequencyData() {
        if (!this.analyser || !this.audioAnalysisReady) {
            return null;
        }

        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(dataArray);
        return dataArray;
    }

    isAudioAnalysisReady() {
        return this.audioAnalysisReady;
    }

    updateProgress() {
        if (this.audio.duration && !isNaN(this.audio.duration)) {
            const progress =
                (this.audio.currentTime / this.audio.duration) * 100;
            if (this.progressCurrent)
                this.progressCurrent.style.width = `${progress}%`;
            if (this.progressHandle)
                this.progressHandle.style.left = `${progress}%`;

            if (this.currentTime)
                this.currentTime.textContent = this.formatTime(
                    this.audio.currentTime
                );
        }
    }

    updateDuration() {
        if (this.audio.duration && this.totalTime) {
            this.totalTime.textContent = this.formatTime(this.audio.duration);
        }
    }

    seekTo(e) {
        if (this.audio.duration && !isNaN(this.audio.duration)) {
            const rect = this.progressTrack.getBoundingClientRect();
            const position = Math.max(
                0,
                Math.min(1, (e.clientX - rect.left) / rect.width)
            );
            this.audio.currentTime = position * this.audio.duration;
            this.updateProgress();
        }
    }

    setVolume(e) {
        const rect = this.volumeTrack.getBoundingClientRect();
        const position = (e.clientX - rect.left) / rect.width;
        this.volume = Math.max(0, Math.min(1, position));

        this.audio.volume = this.volume;
        this.updateVolumeUI();

        localStorage.setItem("chillfi_volume", this.volume.toString());
    }

    updateVolumeUI() {
        const percentage = this.volume * 100;
        if (this.volumeCurrent)
            this.volumeCurrent.style.width = `${percentage}%`;
        if (this.volumeHandle) this.volumeHandle.style.left = `${percentage}%`;
    }

    toggleShuffle() {
        this.isShuffled = !this.isShuffled;

        if (this.isShuffled) {
            this.shuffleQueue();
        } else {
            this.unshuffleQueue();
        }

        // Update shuffle button appearance
        if (this.shuffleButton) {
            if (this.isShuffled) {
                this.shuffleButton.classList.add("active");
            } else {
                this.shuffleButton.classList.remove("active");
            }
        }

        this.updateQueueUI();
    }

    shuffleQueue() {
        if (this.queue.length <= 1) return;

        // Get current song
        const currentSong = this.queue[this.currentIndex];

        // Get remaining songs (excluding current)
        const remainingSongs = [...this.queue];
        remainingSongs.splice(this.currentIndex, 1);

        // Shuffle remaining songs
        for (let i = remainingSongs.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [remainingSongs[i], remainingSongs[j]] = [
                remainingSongs[j],
                remainingSongs[i],
            ];
        }

        // Rebuild queue with current song at index 0
        this.queue = [currentSong, ...remainingSongs];
        this.currentIndex = 0;
    }

    unshuffleQueue() {
        if (this.originalQueue.length === 0) return;

        // Find current song in original queue
        const currentSong = this.queue[this.currentIndex];
        const originalIndex = this.originalQueue.findIndex(
            (song) => song.metadata.id === currentSong.metadata.id
        );

        // Restore original queue and index
        this.queue = [...this.originalQueue];
        this.currentIndex = originalIndex >= 0 ? originalIndex : 0;
    }

    toggleRepeat() {
        this.isRepeat = !this.isRepeat;

        // Update repeat button appearance
        if (this.repeatButton) {
            if (this.isRepeat) {
                this.repeatButton.classList.add("active");
            } else {
                this.repeatButton.classList.remove("active");
            }
        }
    }

    resetProgress() {
        if (this.progressCurrent) this.progressCurrent.style.width = "0%";
        if (this.progressHandle) this.progressHandle.style.left = "0%";
        if (this.currentTime) this.currentTime.textContent = "0:00";
        if (this.totalTime) this.totalTime.textContent = "0:00";
    }

    setupSliderEvents(track, handler) {
        let isDragging = false;
        
        // Click handler
        track.addEventListener("click", (e) => {
            if (!isDragging) {
                e.stopPropagation();
                handler(e);
            }
        });
        
        // Mouse down - start drag
        track.addEventListener("mousedown", (e) => {
            e.stopPropagation();
            e.preventDefault();
            isDragging = true;
            handler(e);
            
            // Mouse move during drag
            const onMouseMove = (e) => {
                if (isDragging) {
                    handler(e);
                }
            };
            
            // Mouse up - end drag
            const onMouseUp = () => {
                isDragging = false;
                document.removeEventListener("mousemove", onMouseMove);
                document.removeEventListener("mouseup", onMouseUp);
            };
            
            document.addEventListener("mousemove", onMouseMove);
            document.addEventListener("mouseup", onMouseUp);
        });
        
        // Touch events for mobile
        track.addEventListener("touchstart", (e) => {
            e.stopPropagation();
            e.preventDefault();
            isDragging = true;
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent("click", {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            handler(mouseEvent);
            
            const onTouchMove = (e) => {
                if (isDragging) {
                    const touch = e.touches[0];
                    const mouseEvent = new MouseEvent("click", {
                        clientX: touch.clientX,
                        clientY: touch.clientY
                    });
                    handler(mouseEvent);
                }
            };
            
            const onTouchEnd = () => {
                isDragging = false;
                document.removeEventListener("touchmove", onTouchMove);
                document.removeEventListener("touchend", onTouchEnd);
            };
            
            document.addEventListener("touchmove", onTouchMove, { passive: false });
            document.addEventListener("touchend", onTouchEnd);
        });
    }

    formatTime(seconds) {
        return formatDuration(seconds);
    }
}
