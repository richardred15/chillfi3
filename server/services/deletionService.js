/**
 * Deletion Service - Handles deletion of songs, albums, and artists with S3 cleanup
 */
const { S3Client, DeleteObjectsCommand } = require('@aws-sdk/client-s3');
const database = require('../database');
const logger = require('../utils/logger');
const config = require('../config');
const { extractS3Key } = require('../utils/s3Utils');

const s3Client = new S3Client({
    region: config.aws.region,
    credentials: {
        accessKeyId: config.aws.accessKeyId,
        secretAccessKey: config.aws.secretAccessKey,
    },
});
const BUCKET_NAME = config.aws.s3Bucket;

// Delete a single song with all associated data
async function deleteSong(songId, userId, isAdmin = false) {
    const transaction = await database.beginTransaction();
    
    try {
        // Get song details
        const songs = await database.query(
            'SELECT * FROM songs WHERE id = ?',
            [songId]
        );
        
        if (songs.length === 0) {
            throw new Error('Song not found');
        }
        
        const song = songs[0];
        
        // Check permissions
        if (song.uploaded_by !== userId && !isAdmin) {
            throw new Error('Unauthorized');
        }
        
        // Collect S3 keys to delete
        const s3Keys = [];
        
        // Add audio file
        if (song.file_path) {
            const audioKey = extractS3Key(song.file_path);
            if (audioKey) s3Keys.push(audioKey);
        }
        
        // Add song artwork
        if (song.cover_art_url) {
            const artKey = extractS3Key(song.cover_art_url);
            if (artKey) s3Keys.push(artKey);
        }
        
        // Delete from database tables
        await database.query('DELETE FROM song_listens WHERE song_id = ?', [songId]);
        await database.query('DELETE FROM playlist_songs WHERE song_id = ?', [songId]);
        await database.query('DELETE FROM songs WHERE id = ?', [songId]);
        
        // Clean up orphaned records
        await cleanupOrphanedAlbums();
        await cleanupOrphanedArtists();
        
        await database.commitTransaction(transaction);
        
        // Delete S3 files (after successful DB transaction)
        if (s3Keys.length > 0) {
            await deleteS3Objects(s3Keys);
        }
        
        logger.info('Song deleted successfully', { songId, userId, s3Keys });
        return { success: true, deletedFiles: s3Keys.length };
        
    } catch (error) {
        await database.rollbackTransaction(transaction);
        logger.error('Song deletion failed', { songId, userId, error: error.message });
        throw error;
    }
}

// Delete an entire album with all songs
async function deleteAlbum(albumId, userId, isAdmin = false) {
    const transaction = await database.beginTransaction();
    
    try {
        // Get album and verify ownership
        const albums = await database.query(
            'SELECT * FROM albums WHERE id = ?',
            [albumId]
        );
        
        if (albums.length === 0) {
            throw new Error('Album not found');
        }
        
        // Get all songs in the album
        const songs = await database.query(
            'SELECT * FROM songs WHERE album_id = ?',
            [albumId]
        );
        
        // Check permissions - user must own at least one song or be admin
        const userOwnsAlbum = songs.some(song => song.uploaded_by === userId);
        if (!userOwnsAlbum && !isAdmin) {
            throw new Error('Unauthorized');
        }
        
        // Collect all S3 keys to delete
        const s3Keys = [];
        const songIds = [];
        
        for (const song of songs) {
            songIds.push(song.id);
            
            // Add audio file
            if (song.file_path) {
                const audioKey = extractS3Key(song.file_path);
                if (audioKey) s3Keys.push(audioKey);
            }
            
            // Add song artwork
            if (song.cover_art_url) {
                const artKey = extractS3Key(song.cover_art_url);
                if (artKey) s3Keys.push(artKey);
            }
        }
        
        // Add album artwork
        const album = albums[0];
        if (album.cover_art_url) {
            const albumArtKey = extractS3Key(album.cover_art_url);
            if (albumArtKey) s3Keys.push(albumArtKey);
        }
        
        // Delete from database
        if (songIds.length > 0) {
            await database.query(
                `DELETE FROM song_listens WHERE song_id IN (${songIds.map(() => '?').join(',')})`,
                songIds
            );
            await database.query(
                `DELETE FROM playlist_songs WHERE song_id IN (${songIds.map(() => '?').join(',')})`,
                songIds
            );
            await database.query(
                'DELETE FROM songs WHERE album_id = ?',
                [albumId]
            );
        }
        
        await database.query('DELETE FROM albums WHERE id = ?', [albumId]);
        await cleanupOrphanedArtists();
        
        await database.commitTransaction(transaction);
        
        // Delete S3 files
        if (s3Keys.length > 0) {
            await deleteS3Objects(s3Keys);
        }
        
        logger.info('Album deleted successfully', { albumId, userId, songsDeleted: songs.length, s3Keys: s3Keys.length });
        return { success: true, songsDeleted: songs.length, deletedFiles: s3Keys.length };
        
    } catch (error) {
        await database.rollbackTransaction(transaction);
        logger.error('Album deletion failed', { albumId, userId, error: error.message });
        throw error;
    }
}

// Delete an entire artist with all albums and songs
async function deleteArtist(artistId, userId, isAdmin = false) {
    const transaction = await database.beginTransaction();
    
    try {
        // Get artist
        const artists = await database.query(
            'SELECT * FROM artists WHERE id = ?',
            [artistId]
        );
        
        if (artists.length === 0) {
            throw new Error('Artist not found');
        }
        
        // Get all songs by this artist
        const songs = await database.query(
            'SELECT * FROM songs WHERE artist_id = ?',
            [artistId]
        );
        
        // Check permissions
        const userOwnsArtist = songs.some(song => song.uploaded_by === userId);
        if (!userOwnsArtist && !isAdmin) {
            throw new Error('Unauthorized');
        }
        
        // Get all albums by this artist
        const albums = await database.query(
            'SELECT * FROM albums WHERE artist_id = ?',
            [artistId]
        );
        
        // Collect all S3 keys
        const s3Keys = [];
        const songIds = [];
        
        for (const song of songs) {
            songIds.push(song.id);
            
            if (song.file_path) {
                const audioKey = extractS3Key(song.file_path);
                if (audioKey) s3Keys.push(audioKey);
            }
            
            if (song.cover_art_url) {
                const artKey = extractS3Key(song.cover_art_url);
                if (artKey) s3Keys.push(artKey);
            }
        }
        
        // Add album artwork
        for (const album of albums) {
            if (album.cover_art_url) {
                const albumArtKey = extractS3Key(album.cover_art_url);
                if (albumArtKey) s3Keys.push(albumArtKey);
            }
        }
        
        // Delete from database
        if (songIds.length > 0) {
            await database.query(
                `DELETE FROM song_listens WHERE song_id IN (${songIds.map(() => '?').join(',')})`,
                songIds
            );
            await database.query(
                `DELETE FROM playlist_songs WHERE song_id IN (${songIds.map(() => '?').join(',')})`,
                songIds
            );
        }
        
        await database.query('DELETE FROM songs WHERE artist_id = ?', [artistId]);
        await database.query('DELETE FROM albums WHERE artist_id = ?', [artistId]);
        await database.query('DELETE FROM artists WHERE id = ?', [artistId]);
        
        await database.commitTransaction(transaction);
        
        // Delete S3 files
        if (s3Keys.length > 0) {
            await deleteS3Objects(s3Keys);
        }
        
        logger.info('Artist deleted successfully', { 
            artistId, 
            userId, 
            songsDeleted: songs.length, 
            albumsDeleted: albums.length,
            s3Keys: s3Keys.length 
        });
        
        return { 
            success: true, 
            songsDeleted: songs.length, 
            albumsDeleted: albums.length,
            deletedFiles: s3Keys.length 
        };
        
    } catch (error) {
        await database.rollbackTransaction(transaction);
        logger.error('Artist deletion failed', { artistId, userId, error: error.message });
        throw error;
    }
}

// Clean up albums with no songs
async function cleanupOrphanedAlbums() {
    await database.query(`
        DELETE FROM albums 
        WHERE id NOT IN (
            SELECT DISTINCT album_id 
            FROM songs 
            WHERE album_id IS NOT NULL
        )
    `);
}

// Clean up artists with no songs
async function cleanupOrphanedArtists() {
    await database.query(`
        DELETE FROM artists 
        WHERE id NOT IN (
            SELECT DISTINCT artist_id 
            FROM songs 
            WHERE artist_id IS NOT NULL
        )
    `);
}

// Delete multiple S3 objects efficiently
async function deleteS3Objects(keys) {
    if (keys.length === 0) return;
    
    try {
        // S3 batch delete supports up to 1000 objects
        const batches = [];
        for (let i = 0; i < keys.length; i += 1000) {
            batches.push(keys.slice(i, i + 1000));
        }
        
        for (const batch of batches) {
            const deleteParams = {
                Bucket: BUCKET_NAME,
                Delete: {
                    Objects: batch.map(key => ({ Key: key })),
                    Quiet: true
                }
            };
            
            const command = new DeleteObjectsCommand(deleteParams);
            await s3Client.send(command);
        }
        
        logger.info('S3 objects deleted successfully', { count: keys.length });
    } catch (error) {
        logger.error('S3 deletion failed', { keys, error: error.message });
        // Don't throw - database cleanup already succeeded
    }
}

module.exports = {
    deleteSong,
    deleteAlbum,
    deleteArtist,
    cleanupOrphanedAlbums,
    cleanupOrphanedArtists
};