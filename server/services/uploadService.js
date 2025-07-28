/**
 * Upload Service
 */
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
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
const MAX_UPLOAD_SESSIONS = 100;

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

// Cleanup function for graceful shutdown
function cleanup() {
    clearInterval(cleanupInterval);
    imageUploadSessions.clear();
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

        // Handle album artwork
        if (metadata.artwork) {
            const albums = await database.query(
                'SELECT cover_art_url FROM albums WHERE id = ?',
                [albumId]
            );

            if (albums.length > 0 && !albums[0].cover_art_url) {
                const coverArtUrl = await uploadArtwork(
                    metadata.artwork,
                    `${fileHash}_album`
                );
                await database.query(
                    'UPDATE albums SET cover_art_url = ? WHERE id = ?',
                    [coverArtUrl, albumId]
                );
            }
        }
    }

    // Insert song
    const songResult = await database.query(
        `
        INSERT INTO songs (title, artist_id, album_id, genre, track_number, duration, 
                         file_path, uploaded_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
        [
            metadata.title || 'Unknown Title',
            artistId,
            albumId,
            metadata.genre || null,
            metadata.trackNumber || null,
            metadata.duration || null,
            fileUrl,
            userId,
        ]
    );

    return songResult.insertId;
}

async function uploadArtwork(artworkData, filename) {
    const artworkBuffer = Buffer.from(artworkData, 'base64');
    const key = `album_art/${filename}.jpg`;

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

    // Store chunk (remove data URL prefix)
    const base64Data = chunkData.split(',')[1] || chunkData;
    if (session.chunks[chunkIndex] === undefined) {
        session.chunks[chunkIndex] = base64Data;
        session.receivedCount++;
    }

    // Check if all chunks received
    if (session.receivedCount === totalChunks) {
        // Combine all chunks
        const combinedData = session.chunks.join('');
        const imageBuffer = Buffer.from(combinedData, 'base64');

        // Generate unique filename
        const fileHash = crypto
            .createHash('sha256')
            .update(imageBuffer)
            .digest('hex');
        const fileExtension = filename.split('.').pop() || 'jpg';
        const s3FileName = `album_art/${fileHash}.${fileExtension}`;

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

module.exports = {
    processImageChunk,
    processFile,
    imageUploadSessions,
    cleanup,
};
