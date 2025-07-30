/**
 * Upload Service
 */
const crypto = require('crypto');
const config = require('../config');
const database = require('../database');
const storageService = require('./storageService');
const { findOrCreateArtist, findOrCreateAlbum } = require('./songService');

const activeUploads = new Map(); // Track active HTTP uploads

// URL cache for pre-signed URLs
const urlCache = new Map();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// Generate secure URL with caching
async function generateSecureUrl(key, expiresIn = 900) {
    const cacheKey = `${key}_${expiresIn}`;
    const cached = urlCache.get(cacheKey);
    
    if (cached && Date.now() < cached.expires) {
        return cached.url;
    }
    
    const url = await storageService.generateUrl(key, expiresIn);
    
    urlCache.set(cacheKey, {
        url,
        expires: Date.now() + CACHE_DURATION
    });
    
    return url;
}

// Cleanup function for graceful shutdown
function cleanup() {
    urlCache.clear();
    console.log('Upload service cleaned up');
}

async function createSongFromMetadata(metadata, fileUrl, fileHash, userId) {
    // Find or create artist with proper ownership
    let artistId = null;
    if (metadata.artist) {
        artistId = await findOrCreateArtist(metadata.artist, userId);
    }

    // Find or create album with proper ownership
    let albumId = null;
    if (metadata.album && artistId) {
        albumId = await findOrCreateAlbum(
            metadata.album,
            artistId,
            userId,
            metadata.year
        );
    }

    // Handle song artwork (per-song now)
    let songCoverArtUrl = null;
    if (metadata.artwork) {
        songCoverArtUrl = await uploadArtwork(
            metadata.artwork,
            `${fileHash}_song`
        );
        
        // Also set album artwork if album doesn't have one
        if (albumId) {
            const albums = await database.query(
                'SELECT cover_art_url FROM albums WHERE id = ?',
                [albumId]
            );
            
            if (albums.length > 0 && !albums[0].cover_art_url) {
                await database.query(
                    'UPDATE albums SET cover_art_url = ? WHERE id = ?',
                    [songCoverArtUrl, albumId]
                );
            }
        }
    }

    // Insert song with cover art
    const songResult = await database.query(
        `
        INSERT INTO songs (title, artist_id, album_id, genre, track_number, duration, 
                         file_path, cover_art_url, uploaded_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
        [
            metadata.title || 'Unknown Title',
            artistId,
            albumId,
            metadata.genre || null,
            metadata.trackNumber || null,
            metadata.duration || null,
            fileUrl,
            songCoverArtUrl,
            userId,
        ]
    );

    return songResult.insertId;
}

async function uploadArtwork(artworkData, filename) {
    const artworkBuffer = Buffer.from(artworkData, 'base64');
    const key = filename.includes('_song') ? 
        `song_art/${filename}.jpg` : 
        `album_art/${filename}.jpg`;

    return await storageService.uploadFile(artworkBuffer, key, 'image/jpeg');
}



// Process complete file for HTTP uploads
async function processFile(file, metadata, userId) {
    try {
        const fileBuffer = file.buffer;
        const fileHash = crypto
            .createHash('sha256')
            .update(fileBuffer)
            .digest('hex');

        // Generate unique filename
        const fileExtension = file.originalname.split('.').pop();
        const fileName = `songs/${fileHash}.${fileExtension}`;

        // Upload using storage service
        const fileUrl = await storageService.uploadFile(fileBuffer, fileName, file.mimetype);

        // Check for duplicate
        const existing = await database.query(
            'SELECT id FROM songs WHERE file_path = ?',
            [fileUrl]
        );

        if (existing.length > 0) {
            throw new Error('File already exists');
        }

        return await createSongFromMetadata(
            metadata,
            fileUrl,
            fileHash,
            userId
        );
    } catch (error) {
        console.error('ProcessFile error:', error);
        throw error;
    }
}



// Upload image via HTTP (unified approach)
async function uploadImage(file, folder = 'album_art') {
    const fileHash = crypto
        .createHash('sha256')
        .update(file.buffer)
        .digest('hex');
    const fileExtension = file.originalname.split('.').pop() || 'jpg';
    const fileName = `${folder}/${fileHash}.${fileExtension}`;

    return await storageService.uploadFile(file.buffer, fileName, file.mimetype || 'image/jpeg');
}

module.exports = {
    processFile,
    uploadImage,
    generateSecureUrl,
    cleanup,
    getActiveUploads: () => activeUploads,
};
