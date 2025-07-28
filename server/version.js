const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');

class VersionManager {
    constructor() {
        this.versionFile = path.join(__dirname, '..', 'ver.json');
        this.currentVersion = null;
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
            } else {
                this.currentVersion = '1.0.1';
                this.saveVersion();
            }
            console.log(`Version loaded: ${this.currentVersion}`);
        } catch (error) {
            console.error('Error loading version:', error);
            this.currentVersion = '1.0.1';
            this.saveVersion();
        }
    }

    saveVersion() {
        try {
            const data = { version: this.currentVersion };
            fs.writeFileSync(this.versionFile, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('Error saving version:', error);
        }
    }

    incrementVersion() {
        const parts = this.currentVersion.split('.');
        const patch = parseInt(parts[2]) + 1;
        this.currentVersion = `${parts[0]}.${parts[1]}.${patch}`;
        this.saveVersion();
        console.log(`Version incremented to: ${this.currentVersion}`);
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