/**
 * Local Storage Provider
 */
const fs = require('fs').promises;
const path = require('path');
const jwt = require('jsonwebtoken');
const config = require('../../config');

class LocalStorageProvider {
    constructor(storagePath) {
        this.storagePath = storagePath;
        this.baseUrl = `${config.client.url}/files`;
    }

    async initialize() {
        // Create directory structure
        const folders = ['songs', 'album_art', 'song_art', 'profiles', 'artist_images'];
        
        for (const folder of folders) {
            const folderPath = path.join(this.storagePath, folder);
            await fs.mkdir(folderPath, { recursive: true });
        }
    }

    async uploadFile(buffer, key, contentType) {
        const filePath = path.join(this.storagePath, key);
        const dir = path.dirname(filePath);
        
        // Ensure directory exists
        await fs.mkdir(dir, { recursive: true });
        
        // Write file
        await fs.writeFile(filePath, buffer);
        
        return `${this.baseUrl}/${key}`;
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