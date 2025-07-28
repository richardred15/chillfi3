const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');

class VersionManager {
    constructor() {
        this.versionFile = path.join(__dirname, '..', 'ver.json');
        this.currentVersion = null;
        this.buildNumber = 1;
        this.lastUpdate = new Date();
        this.init();
    }

    init() {
        this.loadVersion();
        this.setupWatchers();
    }

    loadVersion() {
        try {
            if (fs.existsSync(this.versionFile)) {
                const data = JSON.parse(fs.readFileSync(this.versionFile, 'utf8'));
                this.currentVersion = data.version;
                this.buildNumber = data.buildNumber || this.extractBuildNumber(data.version);
                this.lastUpdate = new Date(data.lastUpdate || Date.now());
                console.log(`Version loaded from disk: ${this.currentVersion} (build ${this.buildNumber})`);
            } else {
                this.currentVersion = '1.0.1';
                this.buildNumber = 1;
                this.lastUpdate = new Date();
                this.saveVersion();
                console.log(`Created new version file: ${this.currentVersion}`);
            }
        } catch (error) {
            console.error('Error loading version:', error);
            this.currentVersion = '1.0.1';
            this.buildNumber = 1;
            this.lastUpdate = new Date();
            this.saveVersion();
        }
    }

    saveVersion() {
        try {
            const data = {
                version: this.currentVersion,
                buildNumber: this.buildNumber,
                lastUpdate: this.lastUpdate.toISOString(),
                savedAt: new Date().toISOString()
            };
            fs.writeFileSync(this.versionFile, JSON.stringify(data, null, 2));
            console.log(`Version saved to disk: ${this.currentVersion}`);
        } catch (error) {
            console.error('Error saving version:', error);
        }
    }

    incrementVersion() {
        this.buildNumber++;
        const parts = this.currentVersion.split('.');
        this.currentVersion = `${parts[0]}.${parts[1]}.${this.buildNumber}`;
        this.lastUpdate = new Date();
        this.saveVersion();
        console.log(`Version incremented to: ${this.currentVersion}`);
    }

    extractBuildNumber(version) {
        const parts = version.split('.');
        return parseInt(parts[2]) || 1;
    }

    setupWatchers() {
        const rootPath = path.join(__dirname, '..');
        const clientPath = path.join(__dirname, '..', 'client');

        const rootWatcher = chokidar.watch(rootPath, {
            ignored: [
                '**/node_modules/**',
                '**/server/**',
                '**/ver.json',
                '**/.git/**'
            ],
            depth: 0,
            ignoreInitial: true
        });

        const clientWatcher = chokidar.watch(clientPath, {
            ignored: '**/node_modules/**',
            ignoreInitial: true
        });

        const handleChange = (filePath) => {
            console.log(`File changed: ${filePath}`);
            this.incrementVersion();
        };

        rootWatcher.on('change', handleChange);
        rootWatcher.on('add', handleChange);
        rootWatcher.on('unlink', handleChange);

        clientWatcher.on('change', handleChange);
        clientWatcher.on('add', handleChange);
        clientWatcher.on('unlink', handleChange);

        console.log('File watchers initialized');
    }

    getVersion() {
        return this.currentVersion;
    }

    handleSocket(socket) {
        socket.on('version:get', () => {
            socket.emit('version:get', {
                success: true,
                version: this.currentVersion
            });
        });
    }
}

module.exports = new VersionManager();