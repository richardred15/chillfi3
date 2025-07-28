/**
 * Offline Manager UI Component
 */
class OfflineManagerUI {
    constructor() {
        this.isVisible = false;
        this.init();
    }

    init() {
        this.createUI();
        this.bindEvents();
    }

    createUI() {
        const container = document.createElement('div');
        container.id = 'offline-manager-ui';
        container.innerHTML = `
            <div class="offline-manager-overlay" style="display: none;">
                <div class="offline-manager-modal">
                    <div class="offline-manager-header">
                        <h3>Offline Mode Settings</h3>
                        <button class="close-btn">&times;</button>
                    </div>
                    
                    <div class="offline-manager-content">
                        <div class="cache-info">
                            <h4>Cache Information</h4>
                            <div class="cache-stats">
                                <div class="stat">
                                    <span class="label">Cached Songs:</span>
                                    <span class="value" id="cached-songs-count">0</span>
                                </div>
                                <div class="stat">
                                    <span class="label">Cache Size:</span>
                                    <span class="value" id="cache-size">0 KB</span>
                                </div>
                                <div class="stat">
                                    <span class="label">Offline Playlists:</span>
                                    <span class="value" id="offline-playlists-count">0</span>
                                </div>
                                <div class="stat">
                                    <span class="label">Queued Actions:</span>
                                    <span class="value" id="queued-actions-count">0</span>
                                </div>
                            </div>
                        </div>

                        <div class="offline-actions">
                            <h4>Actions</h4>
                            <button class="btn btn-primary" id="sync-now-btn">
                                Sync Now
                            </button>
                            <button class="btn btn-secondary" id="refresh-cache-btn">
                                Refresh Cache Info
                            </button>
                            <button class="btn btn-danger" id="clear-cache-btn">
                                Clear All Cache
                            </button>
                        </div>

                        <div class="offline-playlists">
                            <h4>Offline Playlists</h4>
                            <div id="offline-playlists-list">
                                <!-- Populated dynamically -->
                            </div>
                        </div>

                        <div class="queued-actions">
                            <h4>Queued Actions</h4>
                            <div id="queued-actions-list">
                                <!-- Populated dynamically -->
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style>
                .offline-manager-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.7);
                    z-index: 10001;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .offline-manager-modal {
                    background: var(--bg-color, #1a1a1a);
                    color: var(--text-color, #ffffff);
                    border-radius: 12px;
                    width: 90%;
                    max-width: 600px;
                    max-height: 80vh;
                    overflow-y: auto;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
                }

                .offline-manager-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 20px;
                    border-bottom: 1px solid var(--border-color, #333);
                }

                .offline-manager-header h3 {
                    margin: 0;
                    font-size: 1.5rem;
                }

                .close-btn {
                    background: none;
                    border: none;
                    color: var(--text-color, #ffffff);
                    font-size: 24px;
                    cursor: pointer;
                    padding: 0;
                    width: 30px;
                    height: 30px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .offline-manager-content {
                    padding: 20px;
                }

                .offline-manager-content h4 {
                    margin: 20px 0 10px 0;
                    color: var(--accent-color, #4CAF50);
                }

                .cache-stats {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 10px;
                    margin-bottom: 20px;
                }

                .stat {
                    display: flex;
                    justify-content: space-between;
                    padding: 8px 12px;
                    background: var(--card-bg, #2a2a2a);
                    border-radius: 6px;
                }

                .offline-actions {
                    display: flex;
                    gap: 10px;
                    flex-wrap: wrap;
                    margin-bottom: 20px;
                }

                .btn {
                    padding: 8px 16px;
                    border: none;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 14px;
                    transition: background-color 0.2s;
                }

                .btn-primary {
                    background: var(--accent-color, #4CAF50);
                    color: white;
                }

                .btn-secondary {
                    background: var(--secondary-color, #666);
                    color: white;
                }

                .btn-danger {
                    background: #f44336;
                    color: white;
                }

                .btn:hover {
                    opacity: 0.8;
                }

                .playlist-item, .action-item {
                    padding: 8px 12px;
                    background: var(--card-bg, #2a2a2a);
                    border-radius: 6px;
                    margin-bottom: 8px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .playlist-item .name {
                    font-weight: 500;
                }

                .playlist-item .info {
                    font-size: 12px;
                    opacity: 0.7;
                }

                .action-item .type {
                    font-weight: 500;
                    color: var(--accent-color, #4CAF50);
                }

                .action-item .time {
                    font-size: 12px;
                    opacity: 0.7;
                }
            </style>
        `;

        document.body.appendChild(container);
    }

    bindEvents() {
        const overlay = document.querySelector('.offline-manager-overlay');
        const closeBtn = document.querySelector('.close-btn');
        const syncBtn = document.getElementById('sync-now-btn');
        const refreshBtn = document.getElementById('refresh-cache-btn');
        const clearBtn = document.getElementById('clear-cache-btn');

        closeBtn.addEventListener('click', () => this.hide());
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this.hide();
        });

        syncBtn.addEventListener('click', () => this.syncNow());
        refreshBtn.addEventListener('click', () => this.refreshInfo());
        clearBtn.addEventListener('click', () => this.clearCache());
    }

    show() {
        const overlay = document.querySelector('.offline-manager-overlay');
        overlay.style.display = 'flex';
        this.isVisible = true;
        this.refreshInfo();
    }

    hide() {
        const overlay = document.querySelector('.offline-manager-overlay');
        overlay.style.display = 'none';
        this.isVisible = false;
    }

    refreshInfo() {
        if (!window.offlineManager) return;

        const om = window.offlineManager;
        
        // Update cache stats
        document.getElementById('cached-songs-count').textContent = om.cachedSongs.size;
        document.getElementById('cache-size').textContent = this.formatBytes(om.getCacheSize());
        document.getElementById('offline-playlists-count').textContent = om.getOfflinePlaylists().length;
        document.getElementById('queued-actions-count').textContent = om.offlineQueue.length;

        // Update offline playlists
        this.updatePlaylistsList();
        this.updateActionsList();
    }

    updatePlaylistsList() {
        const container = document.getElementById('offline-playlists-list');
        const playlists = window.offlineManager.getOfflinePlaylists();

        if (playlists.length === 0) {
            container.innerHTML = '<p style="opacity: 0.7;">No offline playlists</p>';
            return;
        }

        container.innerHTML = playlists.map(playlist => `
            <div class="playlist-item">
                <div>
                    <div class="name">${playlist.name}</div>
                    <div class="info">${playlist.songs.length} songs • ${playlist.offline ? 'Offline' : 'Synced'}</div>
                </div>
            </div>
        `).join('');
    }

    updateActionsList() {
        const container = document.getElementById('queued-actions-list');
        const actions = window.offlineManager.offlineQueue;

        if (actions.length === 0) {
            container.innerHTML = '<p style="opacity: 0.7;">No queued actions</p>';
            return;
        }

        container.innerHTML = actions.slice(0, 10).map(action => `
            <div class="action-item">
                <div>
                    <div class="type">${action.type}</div>
                    <div class="time">${new Date(action.timestamp).toLocaleString()}</div>
                </div>
            </div>
        `).join('');

        if (actions.length > 10) {
            container.innerHTML += `<p style="opacity: 0.7;">... and ${actions.length - 10} more</p>`;
        }
    }

    async syncNow() {
        if (!window.offlineManager || !window.offlineManager.isOnline) {
            this.showToast('Cannot sync while offline', 'error');
            return;
        }

        const syncBtn = document.getElementById('sync-now-btn');
        syncBtn.textContent = 'Syncing...';
        syncBtn.disabled = true;

        try {
            await window.offlineManager.syncOfflineQueue();
            this.showToast('Sync completed successfully', 'success');
            this.refreshInfo();
        } catch (error) {
            this.showToast('Sync failed: ' + error.message, 'error');
        } finally {
            syncBtn.textContent = 'Sync Now';
            syncBtn.disabled = false;
        }
    }

    clearCache() {
        if (confirm('Are you sure you want to clear all cached data? This cannot be undone.')) {
            window.offlineManager.clearCache();
            this.showToast('Cache cleared successfully', 'success');
            this.refreshInfo();
        }
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    showToast(message, type = 'info') {
        // Use existing toast system if available
        if (window.showToast) {
            window.showToast(message, type);
        } else {
            alert(message);
        }
    }
}

// Create global instance
window.offlineManagerUI = new OfflineManagerUI();

export default OfflineManagerUI;