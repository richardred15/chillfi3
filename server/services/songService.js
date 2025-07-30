/**
 * Song Service
 */
const database = require('../database');
const storageService = require('./storageService');

async function getSongs(filters = {}, page = 1, limit = 20) {
    const offset = (page - 1) * limit;

    let whereClause = '1=1';
    let queryParams = [];

    // Apply filters
    if (filters.search) {
        whereClause +=
            ' AND (s.title LIKE ? OR a.name LIKE ? OR al.title LIKE ?)';
        const searchTerm = `%${filters.search}%`;
        queryParams.push(searchTerm, searchTerm, searchTerm);
    }

    if (filters.genre) {
        whereClause += ' AND s.genre = ?';
        queryParams.push(filters.genre);
    }

    if (filters.artist) {
        whereClause += ' AND a.name = ?';
        queryParams.push(filters.artist);
    }

    if (filters.uploadedBy) {
        if (
            typeof filters.uploadedBy === 'string' &&
            isNaN(filters.uploadedBy) &&
            filters.uploadedBy !== 'current_user'
        ) {
            // Filter by username
            whereClause += ' AND u.username = ?';
            queryParams.push(filters.uploadedBy);
        } else {
            // Filter by user ID (including 'current_user' which gets converted to ID by caller)
            whereClause += ' AND s.uploaded_by = ?';
            queryParams.push(filters.uploadedBy);
        }
    }

    if (filters.album_id) {
        whereClause += ' AND s.album_id = ?';
        queryParams.push(filters.album_id);
    }

    if (filters.album) {
        whereClause += ' AND al.title = ?';
        queryParams.push(filters.album);
    }

    const songs = await database.query(
        `
        SELECT s.id, s.title, s.duration, s.genre, s.track_number, s.file_path,
               a.name as artist, al.title as album, al.release_year as year, 
               COALESCE(s.cover_art_url, al.cover_art_url) as cover_art_url,
               u.username as uploaded_by_username,
               COUNT(sl.id) as listen_count
        FROM songs s
        LEFT JOIN artists a ON s.artist_id = a.id
        LEFT JOIN albums al ON s.album_id = al.id
        LEFT JOIN users u ON s.uploaded_by = u.id
        LEFT JOIN song_listens sl ON s.id = sl.song_id
        WHERE ${whereClause}
        GROUP BY s.id
        ORDER BY s.uploaded_at DESC
        LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
    `,
        queryParams
    );

    // Generate URLs
    for (const song of songs) {
        if (song.cover_art_url) {
            song.cover_art_url = await storageService.generateUrl(song.cover_art_url);
        }
        if (song.file_path) {
            song.play_url = await storageService.generateUrl(song.file_path);
        }
    }

    const [totalCount] = await database.query(
        `
        SELECT COUNT(DISTINCT s.id) as count
        FROM songs s
        LEFT JOIN artists a ON s.artist_id = a.id
        LEFT JOIN albums al ON s.album_id = al.id
        LEFT JOIN users u ON s.uploaded_by = u.id
        WHERE ${whereClause}
    `,
        queryParams
    );

    return {
        songs,
        total: totalCount.count,
        page: parseInt(page),
    };
}

async function getSongById(songId) {
    const songs = await database.query(
        `
        SELECT s.*, a.name as artist, al.title as album, al.release_year as year, 
               al.cover_art_url as album_artwork, 
               COALESCE(s.cover_art_url, al.cover_art_url) as cover_art_url,
               u.username as uploaded_by_username,
               COUNT(sl.id) as listen_count
        FROM songs s
        LEFT JOIN artists a ON s.artist_id = a.id
        LEFT JOIN albums al ON s.album_id = al.id
        LEFT JOIN users u ON s.uploaded_by = u.id
        LEFT JOIN song_listens sl ON s.id = sl.song_id
        WHERE s.id = ?
        GROUP BY s.id
    `,
        [songId]
    );

    if (songs.length === 0) return null;
    
    const song = songs[0];
    
    // Generate URLs
    if (song.album_artwork) {
        song.album_artwork = await storageService.generateUrl(song.album_artwork);
    }
    if (song.cover_art_url) {
        song.cover_art_url = await storageService.generateUrl(song.cover_art_url);
    }
    
    return song;
}

async function findOrCreateArtist(artistName, uploadedBy) {
    if (!artistName || artistName.trim() === '') {
        artistName = 'Unknown Artist';
    }

    // First try to find existing artist by name and uploader
    let artists = await database.query(
        'SELECT id FROM artists WHERE name = ? AND created_by = ?',
        [artistName.trim(), uploadedBy]
    );

    if (artists.length > 0) {
        return artists[0].id;
    }

    // If not found, create new artist
    const result = await database.query(
        'INSERT INTO artists (name, created_by) VALUES (?, ?)',
        [artistName.trim(), uploadedBy]
    );

    return result.insertId;
}

async function findOrCreateAlbum(
    albumName,
    artistId,
    uploadedBy,
    releaseYear = null
) {
    if (!albumName || albumName.trim() === '') {
        albumName = 'Unknown Album';
    }

    // First try to find existing album by name, artist, and uploader
    let albums = await database.query(
        'SELECT id FROM albums WHERE title = ? AND artist_id = ? AND created_by = ?',
        [albumName.trim(), artistId, uploadedBy]
    );

    if (albums.length > 0) {
        return albums[0].id;
    }

    // If not found, create new album
    const result = await database.query(
        'INSERT INTO albums (title, artist_id, release_year, created_by) VALUES (?, ?, ?, ?)',
        [albumName.trim(), artistId, releaseYear, uploadedBy]
    );

    return result.insertId;
}

async function updateSong(songId, metadata, userId, isAdmin = false) {
    // Check ownership
    const songs = await database.query(
        'SELECT uploaded_by FROM songs WHERE id = ?',
        [songId]
    );

    if (songs.length === 0) {
        throw new Error('Song not found');
    }

    if (songs[0].uploaded_by !== userId && !isAdmin) {
        throw new Error('Unauthorized');
    }

    const updateFields = [];
    const updateValues = [];

    // Handle direct song fields
    const allowedFields = ['title', 'genre', 'track_number'];
    for (const field of allowedFields) {
        if (metadata[field] !== undefined) {
            updateFields.push(`${field} = ?`);
            updateValues.push(metadata[field]);
        }
    }

    // Handle artist update
    if (metadata.artist !== undefined) {
        const artistId = await findOrCreateArtist(metadata.artist, userId);
        updateFields.push('artist_id = ?');
        updateValues.push(artistId);
    }

    // Handle album update
    if (metadata.album !== undefined) {
        let artistId;
        if (metadata.artist !== undefined) {
            // Use the new artist
            artistId = await findOrCreateArtist(metadata.artist, userId);
        } else {
            // Get current artist
            const currentSong = await database.query(
                'SELECT artist_id FROM songs WHERE id = ?',
                [songId]
            );
            artistId = currentSong[0].artist_id;
        }

        const albumId = await findOrCreateAlbum(
            metadata.album,
            artistId,
            userId,
            metadata.year
        );
        updateFields.push('album_id = ?');
        updateValues.push(albumId);
    }

    if (updateFields.length > 0) {
        updateValues.push(songId);
        await database.query(
            `UPDATE songs SET ${updateFields.join(', ')} WHERE id = ?`,
            updateValues
        );
    }

    return await getSongById(songId);
}

async function deleteSong(songId, userId, isAdmin = false) {
    const songs = await database.query(
        'SELECT uploaded_by, file_path FROM songs WHERE id = ?',
        [songId]
    );

    if (songs.length === 0) {
        throw new Error('Song not found');
    }

    if (songs[0].uploaded_by !== userId && !isAdmin) {
        throw new Error('Unauthorized');
    }

    await database.query('DELETE FROM songs WHERE id = ?', [songId]);

    return songs[0];
}

async function recordListen(songId, userId = null, ipAddress = null) {
    await database.query(
        'INSERT INTO song_listens (song_id, user_id, ip_address) VALUES (?, ?, ?)',
        [songId, userId, ipAddress]
    );

    const [result] = await database.query(
        'SELECT COUNT(*) as count FROM song_listens WHERE song_id = ?',
        [songId]
    );

    return result.count;
}

async function getListenStats(songId) {
    const [total] = await database.query(
        'SELECT COUNT(*) as count FROM song_listens WHERE song_id = ?',
        [songId]
    );

    const recentListens = await database.query(
        `
        SELECT sl.listened_at, u.username
        FROM song_listens sl
        LEFT JOIN users u ON sl.user_id = u.id
        WHERE sl.song_id = ?
        ORDER BY sl.listened_at DESC
        LIMIT 10
    `,
        [songId]
    );

    return {
        total: total.count,
        recentListens,
    };
}

async function getRecentlyPlayed(userId, limit = 10) {
    return await database.query(
        `
        SELECT DISTINCT s.*, a.name as artist, al.title as album, 
               COALESCE(s.cover_art_url, al.cover_art_url) as cover_art_url
        FROM song_listens sl
        JOIN songs s ON sl.song_id = s.id
        LEFT JOIN artists a ON s.artist_id = a.id
        LEFT JOIN albums al ON s.album_id = al.id
        WHERE sl.user_id = ?
        ORDER BY sl.listened_at DESC
        LIMIT ${parseInt(limit)}
    `,
        [userId]
    );
}

module.exports = {
    getSongs,
    getSongById,
    updateSong,
    deleteSong,
    recordListen,
    getListenStats,
    getRecentlyPlayed,
    findOrCreateArtist,
    findOrCreateAlbum,
};
