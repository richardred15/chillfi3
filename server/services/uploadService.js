/**
 * Upload Service
 */
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');
const config = require('../config');
const database = require('../database');
const { findOrCreateArtist, findOrCreateAlbum } = require('./songService');

const s3Client = new S3Client({
    region: config.aws.region,
    credentials: {
        accessKeyId: config.aws.accessKeyId,
        secretAccessKey: config.aws.secretAccessKey,
    },
});
const BUCKET_NAME = config.aws.s3Bucket;

// Image upload sessions storage with size limit
const imageUploadSessions = new Map();
const activeUploads = new Map(); // Track active HTTP uploads
const MAX_UPLOAD_SESSIONS = 100;

// URL cache for pre-signed URLs
const urlCache = new Map();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// Clean up old image upload sessions
const cleanupInterval = setInterval(() => {
    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // 30 minutes
    let cleanedCount = 0;

    for (const [uploadId, session] of imageUploadSessions.entries()) {
        if (now - session.createdAt > maxAge) {
            cleanupSession(uploadId);
            cleanedCount++;
        }
    }

    // If still too many sessions, remove oldest ones
    if (imageUploadSessions.size > MAX_UPLOAD_SESSIONS) {
        const sortedSessions = Array.from(imageUploadSessions.entries()).sort(
            (a, b) => a[1].createdAt - b[1].createdAt
        );

        const toRemove = sortedSessions.slice(
            0,
            imageUploadSessions.size - MAX_UPLOAD_SESSIONS
        );
        toRemove.forEach(([uploadId]) => cleanupSession(uploadId));
        cleanedCount += toRemove.length;
    }

    if (cleanedCount > 0) {
        console.log(`Cleaned up ${cleanedCount} upload sessions`);
    }

    // Removed explicit global.gc() call for better performance and reliability
}, 15 * 60 * 1000);

// Cleanup function for individual sessions
function cleanupSession(uploadId) {
    const session = imageUploadSessions.get(uploadId);
    if (session) {
        if (session.chunks) {
            session.chunks.length = 0;
            delete session.chunks;
        }
        imageUploadSessions.delete(uploadId);
    }
}

// Generate secure URL with caching
async function generateSecureUrl(s3Key, expiresIn = 900) {
    const cacheKey = `${s3Key}_${expiresIn}`;
    const cached = urlCache.get(cacheKey);
    
    if (cached && Date.now() < cached.expires) {
        return cached.url;
    }
    
    const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key
    });
    
    const url = await getSignedUrl(s3Client, command, { expiresIn });
    
    urlCache.set(cacheKey, {
        url,
        expires: Date.now() + CACHE_DURATION
    });
    
    return url;
}

// Cleanup function for graceful shutdown
function cleanup() {
    clearInterval(cleanupInterval);
    imageUploadSessions.clear();
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

    const uploadCommand = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: artworkBuffer,
        ContentType: 'image/jpeg',
    });

    await s3Client.send(uploadCommand);
    return `https://${BUCKET_NAME}.s3.${config.aws.region}.amazonaws.com/${key}`;
}

async function processImageChunk(
    uploadId,
    chunkIndex,
    totalChunks,
    chunkData,
    filename,
    mimeType,
    userId
) {
    // Initialize upload session if first chunk
    if (chunkIndex === 0) {
        imageUploadSessions.set(uploadId, {
            userId,
            filename,
            mimeType,
            totalChunks,
            chunks: new Array(totalChunks),
            receivedCount: 0,
            createdAt: Date.now(),
        });
    }

    const session = imageUploadSessions.get(uploadId);
    if (!session || session.userId !== userId) {
        throw new Error('Invalid upload session');
    }

    // Store chunk (remove data URL prefix and clean base64)
    let base64Data = chunkData.split(',')[1] || chunkData;
    // Remove any whitespace or invalid base64 characters
    base64Data = base64Data.replace(/[^A-Za-z0-9+/=]/g, '');
    console.log(`Chunk ${chunkIndex} data length: ${base64Data.length} characters`);
    
    if (session.chunks[chunkIndex] === undefined) {
        session.chunks[chunkIndex] = base64Data;
        session.receivedCount++;
        console.log(`Stored chunk ${chunkIndex}, received count: ${session.receivedCount}/${totalChunks}`);
    }

    // Check if all chunks received
    if (session.receivedCount === totalChunks) {
        console.log(`All ${totalChunks} chunks received, combining...`);
        console.log('Chunks array length:', session.chunks.length);
        console.log('Chunks filled:', session.chunks.filter(chunk => chunk !== undefined).length);
        
        // Check for missing chunks
        const missingChunks = [];
        for (let i = 0; i < totalChunks; i++) {
            if (session.chunks[i] === undefined) {
                missingChunks.push(i);
            }
        }
        if (missingChunks.length > 0) {
            console.log('Missing chunks:', missingChunks);
        }
        
        // Combine all chunks
        const combinedData = session.chunks.join('');
        console.log('Individual chunk lengths:', session.chunks.map(chunk => chunk ? chunk.length : 'undefined'));
        console.log('Combined data length:', combinedData.length);
        
        // Validate base64 before decoding
        const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
        if (!base64Regex.test(combinedData)) {
            console.log('Invalid base64 data detected, cleaning...');
            const cleanedData = combinedData.replace(/[^A-Za-z0-9+/=]/g, '');
            console.log('Cleaned data length:', cleanedData.length);
        }
        
        const imageBuffer = Buffer.from(combinedData, 'base64');
        console.log('Buffer size after base64 decode:', imageBuffer.length);
        console.log('Expected buffer size (75% of base64):', Math.floor(combinedData.length * 0.75));

        // Generate unique filename based on uploadId prefix
        const fileHash = crypto
            .createHash('sha256')
            .update(imageBuffer)
            .digest('hex');
        const fileExtension = filename.split('.').pop() || 'jpg';
        
        // Determine folder based on uploadId content
        let folder = 'album_art';
        if (uploadId.includes('_avatar_')) {
            folder = 'profiles';
        } else if (uploadId.includes('_artist_')) {
            folder = 'artist_images';
        }
        
        const s3FileName = `${folder}/${fileHash}.${fileExtension}`;

        // Upload to S3
        const uploadCommand = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: s3FileName,
            Body: imageBuffer,
            ContentType: mimeType || 'image/jpeg',
        });

        await s3Client.send(uploadCommand);
        const imageUrl = `https://${BUCKET_NAME}.s3.${config.aws.region}.amazonaws.com/${s3FileName}`;

        // Clean up session
        cleanupSession(uploadId);

        return imageUrl;
    }

    return null;
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

        // Upload to S3
        const uploadCommand = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: fileName,
            Body: fileBuffer,
            ContentType: file.mimetype,
        });

        await s3Client.send(uploadCommand);
        const fileUrl = `https://${BUCKET_NAME}.s3.${config.aws.region}.amazonaws.com/${fileName}`;

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

// Upload tracking functions
function trackUpload(uploadId, session) {
    activeUploads.set(uploadId, session);
}

function updateUploadProgress(uploadId, progress) {
    const session = activeUploads.get(uploadId);
    if (session) {
        Object.assign(session, progress);
    }
}

function completeUpload(uploadId) {
    activeUploads.delete(uploadId);
}

function getActiveUploads() {
    return activeUploads;
}

// Upload image via HTTP (unified approach)
async function uploadImage(file, folder = 'album_art') {
    const fileHash = crypto
        .createHash('sha256')
        .update(file.buffer)
        .digest('hex');
    const fileExtension = file.originalname.split('.').pop() || 'jpg';
    const s3FileName = `${folder}/${fileHash}.${fileExtension}`;

    const uploadCommand = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3FileName,
        Body: file.buffer,
        ContentType: file.mimetype || 'image/jpeg',
    });

    await s3Client.send(uploadCommand);
    return `https://${BUCKET_NAME}.s3.${config.aws.region}.amazonaws.com/${s3FileName}`;
}

module.exports = {
    processImageChunk,
    processFile,
    uploadImage,
    imageUploadSessions,
    generateSecureUrl,
    cleanup,
    trackUpload,
    updateUploadProgress,
    completeUpload,
    getActiveUploads,
};
