/**
 * Local Storage Provider
 */
const fs = require('fs').promises;
const path = require('path');
const config = require('../../config');

class LocalStorageProvider {
    constructor(storagePath) {
        this.storagePath = storagePath;
    }

    initialize() {
        // Create directory structure synchronously
        const folders = ['songs', 'album_art', 'song_art', 'profiles', 'artist_images'];
        
        for (const folder of folders) {
            const folderPath = path.join(this.storagePath, folder);
            require('fs').mkdirSync(folderPath, { recursive: true });
        }
    }

    async uploadFile(buffer, key, contentType) {
        const filePath = path.join(this.storagePath, key);
        const dir = path.dirname(filePath);
        
        // Ensure directory exists
        await fs.mkdir(dir, { recursive: true });
        
        // Write file
        await fs.writeFile(filePath, buffer);
        
        return key; // Return just the key for local storage
    }

    async generateUrl(key, expiresIn = 900) {
        // For local storage, return public URL
        return `/files/${key}`;
    }

    async deleteFile(key) {
        const filePath = path.join(this.storagePath, key);
        try {
            await fs.unlink(filePath);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                throw error;
            }
        }
    }
}

module.exports = LocalStorageProvider;