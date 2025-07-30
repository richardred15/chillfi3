/**
 * Upload Service
 */
const crypto = require('crypto');
const config = require('../config');
const database = require('../database');
const storageService = require('./storageService');
const { findOrCreateArtist, findOrCreateAlbum } = require('./songService');
const logger = require('../utils/logger');

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
    const processId = `process-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    logger.info('Starting file processing', {
        processId,
        userId,
        filename: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
        metadata: {
            title: metadata.title,
            artist: metadata.artist,
            album: metadata.album,
            hasArtwork: !!metadata.artwork
        }
    });
    
    try {
        if (!file.buffer) {
            throw new Error('File buffer is missing');
        }
        
        const fileBuffer = file.buffer;
        logger.info('Generating file hash', {
            processId,
            userId,
            filename: file.originalname,
            bufferSize: fileBuffer.length
        });
        
        const fileHash = crypto
            .createHash('sha256')
            .update(fileBuffer)
            .digest('hex');

        // Generate unique filename
        const fileExtension = file.originalname.split('.').pop();
        if (!fileExtension) {
            throw new Error('File has no extension');
        }
        
        const fileName = `songs/${fileHash}.${fileExtension}`;
        
        logger.info('Generated file identifiers', {
            processId,
            userId,
            filename: file.originalname,
            fileHash: fileHash.substring(0, 16) + '...',
            fileName,
            extension: fileExtension
        });

        // Check for duplicate before upload
        logger.info('Checking for duplicate files', {
            processId,
            userId,
            fileHash: fileHash.substring(0, 16) + '...'
        });
        
        const existing = await database.query(
            'SELECT id, title FROM songs WHERE file_path LIKE ?',
            [`%${fileHash}%`]
        );

        if (existing.length > 0) {
            logger.warn('Duplicate file detected', {
                processId,
                userId,
                filename: file.originalname,
                existingSongId: existing[0].id,
                existingTitle: existing[0].title
            });
            throw new Error(`File already exists as: ${existing[0].title}`);
        }

        // Upload using storage service
        logger.info('Starting storage upload', {
            processId,
            userId,
            filename: file.originalname,
            fileName,
            storageType: config.storage?.type || 'unknown'
        });
        
        const fileUrl = await storageService.uploadFile(fileBuffer, fileName, file.mimetype);
        
        logger.info('Storage upload completed', {
            processId,
            userId,
            filename: file.originalname,
            fileUrl: fileUrl.substring(0, 50) + '...'
        });

        // Create song from metadata
        logger.info('Creating song from metadata', {
            processId,
            userId,
            filename: file.originalname,
            metadata: {
                title: metadata.title || 'Unknown Title',
                artist: metadata.artist,
                album: metadata.album,
                genre: metadata.genre
            }
        });
        
        const songId = await createSongFromMetadata(
            metadata,
            fileUrl,
            fileHash,
            userId
        );
        
        logger.info('File processing completed successfully', {
            processId,
            userId,
            filename: file.originalname,
            songId
        });

        return songId;
    } catch (error) {
        logger.error('File processing failed', {
            processId,
            userId,
            filename: file.originalname,
            size: file.size,
            mimetype: file.mimetype,
            error: error.message,
            stack: error.stack
        });
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
