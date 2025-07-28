/**
 * Audio Visualizer Module
 * Waveform with particle effects
 */
import MountainRenderer from "./mountainRenderer.js";

export default class Visualizer {
    constructor() {
        this.isActive = false;
        this.audioContext = null;
        this.analyser = null;
        this.source = null;
        this.canvas = null;
        this.ctx = null;
        this.particles = [];
        this.animationId = null;
        this.dataArray = null;
        this.currentAudioElement = null;
        this.previousDataArray = null;
        this.smoothedDataArray = null;
        this.waveformTrails = [];
        this.debugLogged = false;
        this.mountainRenderer = new MountainRenderer();
        
        // FPS tracking
        this.frameCount = 0;
        this.lastTime = performance.now();
        this.fps = 0;
        this.sunImage = null;

        // Cache DOM elements
        this.playerElement = null;
        this.nowPlayingPopup = null;
        this.visualizerButton = null;

        // Load sun image
        this.loadSunImage();

        this.init();
    }

    init() {
        this.createHTML();
        this.setupCanvas();
        this.setupEventListeners();
    }

    createHTML() {
        const visualizerHTML = `
            <div id="visualizer" class="visualizer">
                <button class="visualizer-close" id="closeVisualizer">
                    <img src="client/icons/close.svg" alt="Close" width="16" height="16">
                </button>
                <canvas id="visualizerCanvas" class="visualizer-canvas"></canvas>
            </div>
        `;

        document.body.insertAdjacentHTML("beforeend", visualizerHTML);
        this.canvas = document.getElementById("visualizerCanvas");
        this.ctx = this.canvas.getContext("2d");
    }

    setupCanvas() {
        this.resizeCanvas();
        this.mountainRenderer.generateMountain();
        window.addEventListener("resize", () => this.resizeCanvas());
    }

    resizeCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * window.devicePixelRatio;
        this.canvas.height = rect.height * window.devicePixelRatio;
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        this.canvas.style.width = rect.width + "px";
        this.canvas.style.height = rect.height + "px";
    }

    setupEventListeners() {
        const closeBtn = document.getElementById("closeVisualizer");
        closeBtn.addEventListener("click", () => this.hide());

        // Close on escape key
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && this.isActive) {
                this.hide();
            }
        });
    }

    async show(player) {
        if (!player) return;

        try {
            // Store player reference
            this.player = player;
            this.audioElement = player.audio;

            // Cache DOM elements if not already cached
            if (!this.playerElement)
                this.playerElement = document.querySelector(".player");
            if (!this.nowPlayingPopup)
                this.nowPlayingPopup =
                    document.querySelector(".now-playing-popup");
            if (!this.visualizerButton)
                this.visualizerButton =
                    document.getElementById("visualizerButton");

            // Show visualizer
            document.getElementById("visualizer").classList.add("active");
            this.playerElement?.classList.add("visualizer-overlay");

            // Handle now-playing popup
            this.nowPlayingPopup?.classList.add("visualizer-overlay");

            // Hide visualizer button
            this.visualizerButton?.classList.add("hidden");

            this.isActive = true;

            // Initialize particles and mountains
            this.initParticles();
            this.mountainRenderer.generateMountain();

            // Start animation
            this.animate();
        } catch (error) {
            console.error("Failed to start visualizer:", error);
        }
    }

    hide() {
        document.getElementById("visualizer").classList.remove("active");
        this.playerElement?.classList.remove("visualizer-overlay");

        // Handle now-playing popup
        this.nowPlayingPopup?.classList.remove("visualizer-overlay");

        // Show visualizer button
        this.visualizerButton?.classList.remove("hidden");

        this.isActive = false;

        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    initParticles() {
        this.particles = [];
        const particleCount = 50;

        for (let i = 0; i < particleCount; i++) {
            this.particles.push({
                x:
                    (Math.random() * this.canvas.width) /
                    window.devicePixelRatio,
                y:
                    (Math.random() * this.canvas.height) /
                    window.devicePixelRatio,
                vx: (Math.random() - 0.5) * 2,
                vy: (Math.random() - 0.5) * 2,
                size: Math.random() * 80 + 60,
                opacity: Math.random() * 0.3 + 0.2,
                frequency: Math.floor(Math.random() * 64), // Limit to 15kHz range
            });
        }
    }

    animate() {
        if (!this.isActive) return;

        // Get frequency data from player
        this.dataArray = this.player.getFrequencyData();

        // Clear canvas
        this.ctx.clearRect(
            0,
            0,
            this.canvas.width / window.devicePixelRatio,
            this.canvas.height / window.devicePixelRatio
        );

        // Draw waveform (real or fallback)
        if (this.dataArray && this.player.isAudioAnalysisReady()) {
            this.applyWaveformHysteresis();
            this.drawWaveformTrails();
            this.drawWaveformWithGlow();
            this.updateParticles();
        } else {
            this.drawTimeBasedWaveformWithGlow();
            this.updateTimeBasedParticles();
        }
        this.drawSun();

        // Draw lofi effects
        this.mountainRenderer.render(
            this.ctx,
            this.canvas.width / window.devicePixelRatio,
            this.canvas.height / window.devicePixelRatio,
            Date.now() * 0.001,
            this.getThemeColor("--accent-primary", "#8C67EF")
        );
        this.drawScanlines();
        this.drawFPS();

        this.animationId = requestAnimationFrame(() => this.animate());
    }

    drawWaveform() {
        const width = this.canvas.width / window.devicePixelRatio;
        const height = this.canvas.height / window.devicePixelRatio;
        const centerY = height / 2;

        // Get CSS variables for theme colors
        const primaryColor = this.getThemeColor("--accent-primary", "#8C67EF");
        const secondaryColor = this.getThemeColor(
            "--accent-secondary",
            "#4F9EFF"
        );

        // Create gradient
        const gradient = this.ctx.createLinearGradient(0, 0, width, 0);
        gradient.addColorStop(0, primaryColor);
        gradient.addColorStop(1, secondaryColor);

        // Draw smooth waveform with curves
        this.ctx.beginPath();
        this.ctx.strokeStyle = gradient;
        this.ctx.lineWidth = 4;
        this.ctx.lineCap = "round";
        this.ctx.lineJoin = "round";

        const points = [];

        // Generate points (only up to 15kHz - roughly half the frequency bins)
        const maxBin = Math.floor(this.smoothedDataArray.length * 0.5); // 15kHz out of ~22kHz
        const sliceWidth = width / (maxBin - 1); // Scale to fit full width including last point

        for (let i = 0; i < maxBin; i++) {
            const amplitude = this.smoothedDataArray[i] / 255.0;
            const x = i * sliceWidth;
            const y = centerY - (amplitude - 0.5) * height * 0.4;
            points.push({ x, y });
        }

        // Draw smooth curves between points
        if (points.length > 0) {
            this.ctx.moveTo(points[0].x, points[0].y);

            for (let i = 1; i < points.length - 1; i++) {
                const cp1x = (points[i].x + points[i - 1].x) / 2;
                const cp1y = (points[i].y + points[i - 1].y) / 2;
                const cp2x = (points[i].x + points[i + 1].x) / 2;
                const cp2y = (points[i].y + points[i + 1].y) / 2;

                this.ctx.quadraticCurveTo(points[i].x, points[i].y, cp2x, cp2y);
            }

            if (points.length > 1) {
                this.ctx.lineTo(
                    points[points.length - 1].x,
                    points[points.length - 1].y
                );
            }
        }

        this.ctx.stroke();
    }

    drawTimeBasedWaveform() {
        const width = this.canvas.width / window.devicePixelRatio;
        const height = this.canvas.height / window.devicePixelRatio;
        const centerY = height / 2;
        const time = Date.now() * 0.001;

        // Get CSS variables for theme colors
        const primaryColor = this.getThemeColor("--accent-primary", "#8C67EF");
        const secondaryColor = this.getThemeColor(
            "--accent-secondary",
            "#4F9EFF"
        );

        // Create gradient
        const gradient = this.ctx.createLinearGradient(0, 0, width, 0);
        gradient.addColorStop(0, primaryColor);
        gradient.addColorStop(1, secondaryColor);

        // Draw animated waveform
        this.ctx.beginPath();
        this.ctx.strokeStyle = gradient;
        this.ctx.lineWidth = 3;

        const points = 100;
        for (let i = 0; i < points; i++) {
            const x = (i / points) * width;
            const frequency = 0.02;
            const amplitude = height * 0.1;
            const y =
                centerY +
                Math.sin(time * 2 + i * frequency) *
                    amplitude *
                    (this.audioElement && !this.audioElement.paused ? 1 : 0.3);

            if (i === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
        }

        this.ctx.stroke();
    }

    updateParticles() {
        const width = this.canvas.width / window.devicePixelRatio;
        const height = this.canvas.height / window.devicePixelRatio;

        // Get CSS variables for theme colors
        const primaryColor = this.getThemeColor("--accent-primary", "#8C67EF");
        const accentColor = this.getThemeColor("--accent-secondary", "#FF6B9D");

        this.particles.forEach((particle) => {
            // Get frequency data for this particle (use raw data for particles)
            const frequencyValue = this.dataArray[particle.frequency] / 255.0;

            // Much slower, gentler movement
            particle.vx += (Math.random() - 0.5) * frequencyValue * 0.1;
            particle.vy += (Math.random() - 0.5) * frequencyValue * 0.1;

            // Apply velocity
            particle.x += particle.vx;
            particle.y += particle.vy;

            // Stronger damping for slower movement
            particle.vx *= 0.95;
            particle.vy *= 0.95;

            // Wrap around edges
            if (particle.x < 0) particle.x = width;
            if (particle.x > width) particle.x = 0;
            if (particle.y < 0) particle.y = height;
            if (particle.y > height) particle.y = 0;

            // Much larger particles with lower opacity
            const dynamicSize = particle.size * (1.5 + frequencyValue * 0.5);
            const dynamicOpacity =
                particle.opacity * (0.05 + frequencyValue * 0.1);

            // Create radial gradient for particle
            const gradient = this.ctx.createRadialGradient(
                particle.x,
                particle.y,
                0,
                particle.x,
                particle.y,
                dynamicSize
            );

            // Use different colors based on frequency range
            const color =
                particle.frequency < this.dataArray.length / 2
                    ? primaryColor
                    : accentColor;
            gradient.addColorStop(0, this.hexToRgba(color, dynamicOpacity));
            gradient.addColorStop(1, this.hexToRgba(color, 0)); // Fade to transparent

            // Draw particle
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, dynamicSize, 0, Math.PI * 2);
            this.ctx.fillStyle = gradient;
            this.ctx.fill();
        });
    }

    updateTimeBasedParticles() {
        const width = this.canvas.width / window.devicePixelRatio;
        const height = this.canvas.height / window.devicePixelRatio;
        const time = Date.now() * 0.001;
        const isPlaying = this.audioElement && !this.audioElement.paused;

        // Get CSS variables for theme colors
        const primaryColor = this.getThemeColor("--accent-primary", "#8C67EF");
        const accentColor = this.getThemeColor("--accent-secondary", "#FF6B9D");

        this.particles.forEach((particle, index) => {
            // Time-based animation
            const timeOffset = index * 0.1;
            const intensity = isPlaying ? 1 : 0.3;

            // Update position with sine wave motion
            particle.vx += Math.sin(time + timeOffset) * 0.1 * intensity;
            particle.vy += Math.cos(time + timeOffset * 1.5) * 0.1 * intensity;

            // Apply velocity
            particle.x += particle.vx;
            particle.y += particle.vy;

            // Damping
            particle.vx *= 0.98;
            particle.vy *= 0.98;

            // Wrap around edges
            if (particle.x < 0) particle.x = width;
            if (particle.x > width) particle.x = 0;
            if (particle.y < 0) particle.y = height;
            if (particle.y > height) particle.y = 0;

            // Update size and opacity based on time and play state
            const pulse = Math.sin(time * 3 + timeOffset) * 0.5 + 0.5;
            const dynamicSize = particle.size * (1 + pulse * 0.5 * intensity);
            const dynamicOpacity =
                particle.opacity * (0.1 + pulse * 0.1) * intensity;

            // Create radial gradient for particle
            const gradient = this.ctx.createRadialGradient(
                particle.x,
                particle.y,
                0,
                particle.x,
                particle.y,
                dynamicSize
            );

            // Alternate colors
            const color = index % 2 === 0 ? primaryColor : accentColor;
            gradient.addColorStop(0, this.hexToRgba(color, dynamicOpacity));
            gradient.addColorStop(1, this.hexToRgba(color, 0)); // Fade to transparent

            // Draw particle
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, dynamicSize, 0, Math.PI * 2);
            this.ctx.fillStyle = gradient;
            this.ctx.fill();
        });
    }

    applyWaveformHysteresis() {
        if (!this.previousDataArray) {
            this.previousDataArray = new Uint8Array(this.dataArray.length);
            this.smoothedDataArray = new Uint8Array(this.dataArray.length);
        }

        const smoothingFactor = 0.7; // Higher = more smoothing

        for (let i = 0; i < this.dataArray.length; i++) {
            this.smoothedDataArray[i] =
                this.previousDataArray[i] * smoothingFactor +
                this.dataArray[i] * (1 - smoothingFactor);
            this.previousDataArray[i] = this.smoothedDataArray[i];
        }

        // Add current waveform to trails
        this.waveformTrails.push({
            data: new Uint8Array(this.smoothedDataArray),
            opacity: 1.0,
            timestamp: Date.now(),
        });

        // Remove old trails (keep last 8 frames)
        if (this.waveformTrails.length > 8) {
            this.waveformTrails.shift();
        }
    }

    drawWaveformTrails() {
        const width = this.canvas.width / window.devicePixelRatio;
        const height = this.canvas.height / window.devicePixelRatio;
        const centerY = height / 2;
        const currentTime = Date.now();

        // Get CSS variables for theme colors
        const primaryColor = this.getThemeColor("--accent-primary", "#8C67EF");
        const secondaryColor = this.getThemeColor(
            "--accent-secondary",
            "#4F9EFF"
        );

        // Draw fading trails (skip the most recent one as it will be drawn as main waveform)
        for (
            let trailIndex = 0;
            trailIndex < this.waveformTrails.length - 1;
            trailIndex++
        ) {
            const trail = this.waveformTrails[trailIndex];
            const age = currentTime - trail.timestamp;
            const fadeOpacity = Math.max(0, 1 - age / 400); // Fade over 400ms

            if (fadeOpacity <= 0) continue;

            // Create gradient with fading opacity
            const gradient = this.ctx.createLinearGradient(0, 0, width, 0);
            gradient.addColorStop(
                0,
                this.hexToRgba(primaryColor, fadeOpacity * 0.2)
            );
            gradient.addColorStop(
                1,
                this.hexToRgba(secondaryColor, fadeOpacity * 0.2)
            );

            // Draw trail waveform
            this.ctx.beginPath();
            this.ctx.strokeStyle = gradient;
            this.ctx.lineWidth = 2;
            this.ctx.lineCap = "round";
            this.ctx.lineJoin = "round";

            const points = [];

            const maxBin = Math.floor(trail.data.length * 0.5); // 15kHz limit
            const sliceWidth = width / (maxBin - 1); // Scale to fit full width including last point

            for (let i = 0; i < maxBin; i++) {
                const amplitude = trail.data[i] / 255.0;
                const x = i * sliceWidth;
                const y = centerY - (amplitude - 0.5) * height * 0.4;
                points.push({ x, y });
            }

            if (points.length > 0) {
                this.ctx.moveTo(points[0].x, points[0].y);

                for (let i = 1; i < points.length - 1; i++) {
                    const cp2x = (points[i].x + points[i + 1].x) / 2;
                    const cp2y = (points[i].y + points[i + 1].y) / 2;
                    this.ctx.quadraticCurveTo(
                        points[i].x,
                        points[i].y,
                        cp2x,
                        cp2y
                    );
                }

                if (points.length > 1) {
                    this.ctx.lineTo(
                        points[points.length - 1].x,
                        points[points.length - 1].y
                    );
                }
            }

            this.ctx.stroke();
        }
    }

    getThemeColor(cssVar, fallback) {
        const color = getComputedStyle(document.documentElement)
            .getPropertyValue(cssVar)
            .trim();

        // Debug only once
        if (!this.debugLogged) {
            console.log(
                `Theme debug - ${cssVar}: '${color}' (using: ${
                    color && color.startsWith("#") ? color : fallback
                })`
            );

            // Log all CSS custom properties to see what's available
            if (cssVar === "--accent-primary") {
                const styles = getComputedStyle(document.documentElement);
                const allProps = [];
                for (let i = 0; i < styles.length; i++) {
                    const prop = styles[i];
                    if (prop.startsWith("--")) {
                        allProps.push(
                            `${prop}: ${styles.getPropertyValue(prop).trim()}`
                        );
                    }
                }
                console.log("All CSS custom properties:", allProps);
                this.debugLogged = true;
            }
        }

        return color && color.startsWith("#") ? color : fallback;
    }

    drawWaveformWithGlow() {
        // Draw glow effect first
        this.ctx.save();
        this.ctx.shadowColor = this.getThemeColor(
            "--accent-primary",
            "#8C67EF"
        );
        this.ctx.shadowBlur = 20;
        this.drawWaveform();
        this.ctx.restore();

        // Draw main waveform on top
        this.drawWaveform();
    }

    drawTimeBasedWaveformWithGlow() {
        // Draw glow effect first
        this.ctx.save();
        this.ctx.shadowColor = this.getThemeColor(
            "--accent-primary",
            "#8C67EF"
        );
        this.ctx.shadowBlur = 15;
        this.drawTimeBasedWaveform();
        this.ctx.restore();

        // Draw main waveform on top
        this.drawTimeBasedWaveform();
    }

    drawScanlines() {
        const width = this.canvas.width / window.devicePixelRatio;
        const height = this.canvas.height / window.devicePixelRatio;
        const time = Date.now() * 0.001;

        this.ctx.save();
        this.ctx.globalAlpha = 0.03;
        this.ctx.strokeStyle = "#ffffff";
        this.ctx.lineWidth = 1;

        // Moving scanlines
        const lineSpacing = 4;
        const offset = (time * 30) % (lineSpacing * 2);

        for (let y = -offset; y < height + lineSpacing; y += lineSpacing) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(width, y);
            this.ctx.stroke();
        }

        this.ctx.restore();
    }

    loadSunImage() {
        this.sunImage = new Image();
        this.sunImage.src = "client/images/sun.png";
    }

    drawSun() {
        if (!this.sunImage || !this.sunImage.complete) return;

        const width = this.canvas.width / window.devicePixelRatio;
        const height = this.canvas.height / window.devicePixelRatio;

        // Position sun at the horizon in the center
        const sunX = width / 2;
        const sunY = height * 0.2; // Same as mountain horizon
        const sunSize = 500;

        this.ctx.save();
        this.ctx.globalAlpha = 0.6;
        this.ctx.drawImage(
            this.sunImage,
            sunX - sunSize / 2,
            sunY - sunSize / 2,
            sunSize,
            sunSize
        );
        this.ctx.restore();
    }

    drawFPS() {
        // Calculate FPS
        this.frameCount++;
        const currentTime = performance.now();
        if (currentTime - this.lastTime >= 1000) {
            this.fps = Math.round((this.frameCount * 1000) / (currentTime - this.lastTime));
            this.frameCount = 0;
            this.lastTime = currentTime;
        }
        
        // Draw FPS overlay
        this.ctx.save();
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        this.ctx.font = '14px monospace';
        this.ctx.fillText(`FPS: ${this.fps}`, 20, 30);
        this.ctx.restore();
    }

    hexToRgba(hex, alpha) {
        // Clean up CSS variable values
        hex = hex.trim();

        // Handle CSS variables that might not be hex or might be empty
        if (!hex || !hex.startsWith("#")) {
            hex = "#8C67EF";
        }

        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
}
