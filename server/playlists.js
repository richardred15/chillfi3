/**
 * Playlists Module
 */
const database = require('./database');

// Handle socket events
function handleSocket(socket, _io) {
    // List user playlists
    socket.on('playlist:list', async (data) => {
        try {
            const { userId, page = 1 } = data;

            if (!userId) {
                return socket.emit('playlist:list', {
                    error: true,
                    message: 'User ID required',
                });
            }

            // Simplified query - just get user's playlists
            const playlists = await database.query(
                `
                SELECT p.id, p.name, p.is_public, p.created_at, p.updated_at
                FROM playlists p
                WHERE p.user_id = ?
                ORDER BY p.updated_at DESC
            `,
                [userId]
            );

            socket.emit('playlist:list', {
                success: true,
                data: {
                    playlists,
                    total: playlists.length,
                    page,
                },
            });
        } catch (error) {
            console.error('List playlists error:', error);
            socket.emit('playlist:list', {
                error: true,
                message: 'Failed to get playlists',
            });
        }
    });

    // Get playlist details
    socket.on('playlist:get', async (data) => {
        try {
            console.log('Getting playlist:', data);
            const { playlistId } = data;

            if (!playlistId) {
                return socket.emit('playlist:get', {
                    error: true,
                    message: 'Playlist ID required',
                });
            }

            // Get playlist info
            const playlists = await database.query(
                `
                SELECT p.*, u.username as owner_username
                FROM playlists p
                LEFT JOIN users u ON p.user_id = u.id
                WHERE p.id = ?
            `,
                [playlistId]
            );

            if (playlists.length === 0) {
                return socket.emit('playlist:get', {
                    error: true,
                    message: 'Playlist not found',
                });
            }

            const playlist = playlists[0];

            // Check permissions for private playlists
            if (!playlist.is_public) {
                if (
                    !socket.authenticated ||
                    (socket.user.id !== playlist.user_id &&
                        !socket.user.is_admin)
                ) {
                    return socket.emit('playlist:get', {
                        error: true,
                        message: 'Unauthorized',
                    });
                }
            }

            // Get playlist songs with pagination
            const { songPage = 1, songLimit = 50 } = data;
            const songOffset = (songPage - 1) * songLimit;

            const songs = await database.query(
                `
                SELECT s.id, s.title, s.duration, al.cover_art_url,
                       a.name as artist, al.title as album,
                       ps.position, ps.added_at
                FROM playlist_songs ps
                JOIN songs s ON ps.song_id = s.id
                LEFT JOIN artists a ON s.artist_id = a.id
                LEFT JOIN albums al ON s.album_id = al.id
                WHERE ps.playlist_id = ?
                ORDER BY ps.position ASC
                LIMIT ? OFFSET ?
            `,
                [playlistId, parseInt(songLimit), parseInt(songOffset)]
            );

            // Get total song count
            const [songCountResult] = await database.query(
                'SELECT COUNT(*) as count FROM playlist_songs WHERE playlist_id = ?',
                [playlistId]
            );

            socket.emit('playlist:get', {
                success: true,
                playlist,
                songs,
                songTotal: songCountResult.count,
                songPage,
            });
        } catch (error) {
            console.error('Get playlist error:', error);
            socket.emit('playlist:get', {
                success: false,
                error: true,
                message: 'Failed to get playlist',
            });
        }
    });

    // Create playlist
    socket.on('playlist:create', async (data) => {
        try {
            if (!socket.authenticated) {
                return socket.emit('playlist:create', {
                    success: false,
                    message: 'Authentication required',
                });
            }

            const { name, isPublic = false } = data;

            if (!name) {
                return socket.emit('playlist:create', {
                    success: false,
                    message: 'Playlist name required',
                });
            }

            const result = await database.query(
                'INSERT INTO playlists (name, user_id, is_public) VALUES (?, ?, ?)',
                [name, socket.user.id, isPublic ? 1 : 0]
            );

            socket.emit('playlist:create', {
                success: true,
                data: {
                    playlistId: result.insertId,
                },
            });
        } catch (error) {
            console.error('Create playlist error:', error);
            socket.emit('playlist:create', {
                success: false,
                message: 'Failed to create playlist',
            });
        }
    });

    // Update playlist
    socket.on('playlist:update', async (data) => {
        try {
            if (!socket.authenticated) {
                return socket.emit('playlist:update', {
                    success: false,
                    message: 'Authentication required',
                });
            }

            const { playlistId, updates } = data;

            if (!playlistId) {
                return socket.emit('playlist:update', {
                    success: false,
                    message: 'Playlist ID required',
                });
            }

            // Check ownership
            const playlists = await database.query(
                'SELECT user_id FROM playlists WHERE id = ?',
                [playlistId]
            );

            if (playlists.length === 0) {
                return socket.emit('playlist:update', {
                    success: false,
                    message: 'Playlist not found',
                });
            }

            if (
                playlists[0].user_id !== socket.user.id &&
                !socket.user.is_admin
            ) {
                return socket.emit('playlist:update', {
                    success: false,
                    message: 'Unauthorized',
                });
            }

            const allowedFields = ['name', 'is_public'];
            const updateFields = [];
            const updateValues = [];

            for (const field of allowedFields) {
                if (updates[field] !== undefined) {
                    updateFields.push(`${field} = ?`);
                    updateValues.push(updates[field]);
                }
            }

            if (updateFields.length === 0) {
                return socket.emit('playlist:update', {
                    success: false,
                    message: 'No valid fields to update',
                });
            }

            updateValues.push(playlistId);

            await database.query(
                `UPDATE playlists SET ${updateFields.join(
                    ', '
                )}, updated_at = NOW() WHERE id = ?`,
                updateValues
            );

            // Get updated playlist
            const updatedPlaylists = await database.query(
                'SELECT * FROM playlists WHERE id = ?',
                [playlistId]
            );

            socket.emit('playlist:update', {
                success: true,
                playlist: updatedPlaylists[0],
            });
        } catch (error) {
            console.error('Update playlist error:', error);
            socket.emit('playlist:update', {
                success: false,
                message: 'Failed to update playlist',
            });
        }
    });

    // Delete playlist
    socket.on('playlist:delete', async (data) => {
        try {
            if (!socket.authenticated) {
                return socket.emit('playlist:delete', {
                    success: false,
                    message: 'Authentication required',
                });
            }

            const { playlistId } = data;

            if (!playlistId) {
                return socket.emit('playlist:delete', {
                    success: false,
                    message: 'Playlist ID required',
                });
            }

            // Check ownership
            const playlists = await database.query(
                'SELECT user_id FROM playlists WHERE id = ?',
                [playlistId]
            );

            if (playlists.length === 0) {
                return socket.emit('playlist:delete', {
                    success: false,
                    message: 'Playlist not found',
                });
            }

            if (
                playlists[0].user_id !== socket.user.id &&
                !socket.user.is_admin
            ) {
                return socket.emit('playlist:delete', {
                    success: false,
                    message: 'Unauthorized',
                });
            }

            // Delete playlist (cascade will handle playlist_songs)
            await database.query('DELETE FROM playlists WHERE id = ?', [
                playlistId,
            ]);

            socket.emit('playlist:delete', { success: true });
        } catch (error) {
            console.error('Delete playlist error:', error);
            socket.emit('playlist:delete', {
                success: false,
                message: 'Failed to delete playlist',
            });
        }
    });

    // Add song to playlist
    socket.on('playlist:addSong', async (data) => {
        try {
            console.log('Adding song to playlist:', data);
            if (!socket.authenticated) {
                return socket.emit('playlist:addSong', {
                    success: false,
                    message: 'Authentication required',
                });
            }

            const { playlistId, songId } = data;

            if (!playlistId || !songId) {
                return socket.emit('playlist:addSong', {
                    success: false,
                    message: 'Playlist ID and Song ID required',
                });
            }

            // Check playlist ownership
            const playlists = await database.query(
                'SELECT user_id FROM playlists WHERE id = ?',
                [playlistId]
            );

            if (playlists.length === 0) {
                return socket.emit('playlist:addSong', {
                    success: false,
                    message: 'Playlist not found',
                });
            }

            if (
                playlists[0].user_id !== socket.user.id &&
                !socket.user.is_admin
            ) {
                return socket.emit('playlist:addSong', {
                    success: false,
                    message: 'Unauthorized',
                });
            }

            // Check if song exists
            const songs = await database.query(
                'SELECT id FROM songs WHERE id = ?',
                [songId]
            );

            if (songs.length === 0) {
                return socket.emit('playlist:addSong', {
                    success: false,
                    message: 'Song not found',
                });
            }

            // Check if song is already in playlist
            const existing = await database.query(
                'SELECT playlist_id FROM playlist_songs WHERE playlist_id = ? AND song_id = ?',
                [playlistId, songId]
            );

            if (existing.length > 0) {
                console.log('Song already in playlist');
                return socket.emit('playlist:addSong', {
                    success: false,
                    message: 'Song already in playlist',
                });
            }

            // Get next position
            const [maxPosition] = await database.query(
                'SELECT COALESCE(MAX(position), 0) + 1 as next_position FROM playlist_songs WHERE playlist_id = ?',
                [playlistId]
            );

            // Add song to playlist
            console.log(
                'Inserting into playlist_songs:',
                playlistId,
                songId,
                maxPosition.next_position
            );
            await database.query(
                'INSERT INTO playlist_songs (playlist_id, song_id, position) VALUES (?, ?, ?)',
                [playlistId, songId, maxPosition.next_position]
            );
            console.log('Successfully added song to playlist');

            // Update playlist timestamp
            await database.query(
                'UPDATE playlists SET updated_at = NOW() WHERE id = ?',
                [playlistId]
            );

            socket.emit('playlist:addSong', { success: true });
        } catch (error) {
            console.error('Add song to playlist error:', error);
            socket.emit('playlist:addSong', {
                success: false,
                message: 'Failed to add song to playlist',
            });
        }
    });

    // Remove song from playlist
    socket.on('playlist:removeSong', async (data) => {
        try {
            if (!socket.authenticated) {
                return socket.emit('playlist:removeSong', {
                    success: false,
                    message: 'Authentication required',
                });
            }

            const { playlistId, songId } = data;

            if (!playlistId || !songId) {
                return socket.emit('playlist:removeSong', {
                    success: false,
                    message: 'Playlist ID and Song ID required',
                });
            }

            // Check playlist ownership
            const playlists = await database.query(
                'SELECT user_id FROM playlists WHERE id = ?',
                [playlistId]
            );

            if (playlists.length === 0) {
                return socket.emit('playlist:removeSong', {
                    success: false,
                    message: 'Playlist not found',
                });
            }

            if (
                playlists[0].user_id !== socket.user.id &&
                !socket.user.is_admin
            ) {
                return socket.emit('playlist:removeSong', {
                    success: false,
                    message: 'Unauthorized',
                });
            }

            // Remove song from playlist
            await database.query(
                'DELETE FROM playlist_songs WHERE playlist_id = ? AND song_id = ?',
                [playlistId, songId]
            );

            // Reorder positions
            await database.query(
                `
                UPDATE playlist_songs ps1
                JOIN (
                    SELECT playlist_id, song_id, ROW_NUMBER() OVER (ORDER BY position) as new_position
                    FROM playlist_songs
                    WHERE playlist_id = ?
                ) ps2 ON ps1.playlist_id = ps2.playlist_id AND ps1.song_id = ps2.song_id
                SET ps1.position = ps2.new_position
                WHERE ps1.playlist_id = ?
            `,
                [playlistId, playlistId]
            );

            // Update playlist timestamp
            await database.query(
                'UPDATE playlists SET updated_at = NOW() WHERE id = ?',
                [playlistId]
            );

            socket.emit('playlist:removeSong', { success: true });
        } catch (error) {
            console.error('Remove song from playlist error:', error);
            socket.emit('playlist:removeSong', {
                success: false,
                message: 'Failed to remove song from playlist',
            });
        }
    });

    // Share playlist
    socket.on('playlist:share', async (data) => {
        try {
            const { playlistId } = data;

            if (!playlistId) {
                return socket.emit('playlist:share', {
                    error: true,
                    message: 'Playlist ID required',
                });
            }

            // Check if playlist exists and is public
            const playlists = await database.query(
                'SELECT id, is_public, user_id FROM playlists WHERE id = ?',
                [playlistId]
            );

            if (playlists.length === 0) {
                return socket.emit('playlist:share', {
                    error: true,
                    message: 'Playlist not found',
                });
            }

            const playlist = playlists[0];

            // Check if user can share (owner, admin, or public playlist)
            if (
                !playlist.is_public &&
                (!socket.authenticated ||
                    (socket.user.id !== playlist.user_id &&
                        !socket.user.is_admin))
            ) {
                return socket.emit('playlist:share', {
                    error: true,
                    message: 'Cannot share private playlist',
                });
            }

            const shareUrl = `${process.env.CLIENT_URL}/?playlist=${playlistId}`;

            socket.emit('playlist:share', { url: shareUrl });
        } catch (error) {
            console.error('Share playlist error:', error);
            socket.emit('playlist:share', {
                error: true,
                message: 'Failed to generate share URL',
            });
        }
    });
}

module.exports = {
    handleSocket,
};
