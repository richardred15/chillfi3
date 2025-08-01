/**
 * Songs Module
 *
 * Handles song and album management, including listing, uploading (with chunked support), updating, deleting,
 * playing, searching, and tracking listens. Integrates with AWS S3 for file storage and provides real-time
 * socket event handlers for client interactions.
 */
require("dotenv").config({ path: __dirname + "/.env" });
// const {
//     S3Client,
//     DeleteObjectCommand,
// } = require('@aws-sdk/client-s3');
// const config = require('./config');
const database = require("./database");
const logger = require("./utils/logger");
const { success, error, paginated } = require("./utils/response");
const rateLimiter = require("./middleware/rateLimiter");
const uploadService = require("./services/uploadService");
const songService = require("./services/songService");
const deletionService = require("./services/deletionService");
const storageService = require("./services/storageService");

// const s3Client = new S3Client({
//     region: config.aws.region,
//     credentials: {
//         accessKeyId: config.aws.accessKeyId,
//         secretAccessKey: config.aws.secretAccessKey,
//     },
// });
// const BUCKET_NAME = config.aws.s3Bucket;

// Handle socket events
function handleSocket(socket, _io) {
    // List songs
    socket.on("song:list", async (data) => {
        try {
            if (!(await rateLimiter(socket, "song:list"))) {
                return error(socket, "song:list", "Rate limit exceeded");
            }

            if (!socket.authenticated) {
                return error(socket, "song:list", "Authentication required");
            }

            const { filters = {}, page = 1, limit = 20 } = data;

            // Handle current_user filter
            if (filters.uploadedBy === "current_user") {
                filters.uploadedBy = socket.user.id;
            }

            const result = await songService.getSongs(filters, page, limit);

            paginated(
                socket,
                "song:list",
                result.songs,
                result.total,
                result.page,
                limit
            );
        } catch (err) {
            logger.error("List songs error", {
                error: err.message,
                stack: err.stack,
                userId: socket.user?.id,
                socketId: socket.id,
            });
            error(socket, "song:list", "Failed to get songs");
        }
    });

    // Get song details
    socket.on("song:get", async (data) => {
        try {
            if (!socket.authenticated) {
                return error(socket, "song:get", "Authentication required");
            }

            const { songId } = data;

            if (!songId) {
                return error(socket, "song:get", "Song ID required");
            }

            const song = await songService.getSongById(songId);

            if (!song) {
                return error(socket, "song:get", "Song not found");
            }

            success(socket, "song:get", { song });
        } catch (err) {
            logger.error("Get song error", {
                error: err.message,
                songId: data.songId,
                userId: socket.user?.id,
            });
            error(socket, "song:get", "Failed to get song");
        }
    });

    // Update album
    socket.on("album:update", async (data) => {
        try {
            if (!socket.authenticated) {
                return socket.emit("album:update", {
                    success: false,
                    message: "Authentication required",
                });
            }

            const { albumId, updates } = data;

            if (!albumId) {
                return socket.emit("album:update", {
                    success: false,
                    message: "Album ID required",
                });
            }

            // Check if user has permission (album owner or admin)
            const albumSongs = await database.query(
                "SELECT DISTINCT s.uploaded_by FROM songs s WHERE s.album_id = ?",
                [albumId]
            );
            const hasPermission =
                socket.user.is_admin ||
                albumSongs.some((song) => song.uploaded_by === socket.user.id);

            if (!hasPermission) {
                return socket.emit("album:update", {
                    success: false,
                    message: "Unauthorized",
                });
            }

            const allowedFields = ["title", "release_year"];
            const updateFields = [];
            const updateValues = [];

            for (const field of allowedFields) {
                if (updates[field] !== undefined) {
                    updateFields.push(`${field} = ?`);
                    updateValues.push(updates[field]);
                }
            }

            if (updateFields.length > 0) {
                updateValues.push(albumId);
                const updateQuery = `UPDATE albums SET ${updateFields.join(
                    ", "
                )} WHERE id = ?`;
                await database.query(updateQuery, updateValues);
            }

            // Get updated album
            const albums = await database.query(
                "SELECT * FROM albums WHERE id = ?",
                [albumId]
            );

            socket.emit("album:update", {
                success: true,
                album: albums[0],
            });
        } catch (error) {
            console.error("Update album error:", error);
            socket.emit("album:update", {
                success: false,
                message: "Failed to update album",
            });
        }
    });

    // Update song
    socket.on("song:update", async (data) => {
        try {
            if (!socket.authenticated) {
                return error(socket, "song:update", "Authentication required");
            }

            const { songId, metadata } = data;

            const updatedSong = await songService.updateSong(
                songId,
                metadata,
                socket.user.id,
                socket.user.is_admin
            );

            success(socket, "song:update", { song: updatedSong });
        } catch (err) {
            logger.error("Update song error", {
                error: err.message,
                songId: data.songId,
                userId: socket.user?.id,
            });
            error(
                socket,
                "song:update",
                err.message || "Failed to update song"
            );
        }
    });

    // Delete song
    socket.on("song:delete", async (data) => {
        try {
            if (!socket.authenticated) {
                return error(socket, "song:delete", "Authentication required");
            }

            const { songId } = data;

            if (!songId) {
                return error(socket, "song:delete", "Song ID required");
            }

            const result = await deletionService.deleteSong(
                songId,
                socket.user.id,
                socket.user.is_admin
            );

            success(socket, "song:delete", result);
        } catch (err) {
            logger.error("Delete song error", {
                error: err.message,
                songId: data.songId,
                userId: socket.user?.id,
            });
            error(
                socket,
                "song:delete",
                err.message || "Failed to delete song"
            );
        }
    });

    // Delete album
    socket.on("album:delete", async (data) => {
        try {
            if (!socket.authenticated) {
                return error(socket, "album:delete", "Authentication required");
            }

            const { albumId } = data;

            if (!albumId) {
                return error(socket, "album:delete", "Album ID required");
            }

            const result = await deletionService.deleteAlbum(
                albumId,
                socket.user.id,
                socket.user.is_admin
            );

            success(socket, "album:delete", result);
        } catch (err) {
            logger.error("Delete album error", {
                error: err.message,
                albumId: data.albumId,
                userId: socket.user?.id,
            });
            error(
                socket,
                "album:delete",
                err.message || "Failed to delete album"
            );
        }
    });

    // Delete artist
    socket.on("artist:delete", async (data) => {
        try {
            if (!socket.authenticated) {
                return error(
                    socket,
                    "artist:delete",
                    "Authentication required"
                );
            }

            const { artistId } = data;

            if (!artistId) {
                return error(socket, "artist:delete", "Artist ID required");
            }

            const result = await deletionService.deleteArtist(
                artistId,
                socket.user.id,
                socket.user.is_admin
            );

            success(socket, "artist:delete", result);
        } catch (err) {
            logger.error("Delete artist error", {
                error: err.message,
                artistId: data.artistId,
                userId: socket.user?.id,
            });
            error(
                socket,
                "artist:delete",
                err.message || "Failed to delete artist"
            );
        }
    });

    // Play song (fallback for when cached URL is not available)
    socket.on("song:play", async (data) => {
        try {
            if (!socket.authenticated) {
                return socket.emit("song:play", {
                    error: true,
                    message: "Authentication required",
                });
            }

            const { songId } = data;

            if (!songId) {
                return socket.emit("song:play", {
                    error: true,
                    message: "Song ID required",
                });
            }

            // Simplified query - just get file_path for URL generation
            const songs = await database.query(
                "SELECT file_path, title FROM songs WHERE id = ?",
                [songId]
            );

            if (songs.length === 0) {
                return socket.emit("song:play", {
                    error: true,
                    message: "Song not found",
                });
            }

            const song = songs[0];
            const secureAudioUrl = await storageService.generateUrl(
                song.file_path
            );

            socket.emit("song:play", {
                url: secureAudioUrl,
                metadata: {
                    id: songId,
                    title: song.title,
                },
            });
        } catch (error) {
            console.error("Play song error:", error);
            socket.emit("song:play", {
                error: true,
                message: "Failed to get song URL",
            });
        }
    });

    // Record listen
    socket.on("song:recordListen", async (data) => {
        try {
            const { songId } = data;

            if (!songId) {
                return error(socket, "song:recordListen", "Song ID required");
            }

            const listenCount = await songService.recordListen(
                songId,
                socket.authenticated ? socket.user.id : null,
                socket.handshake.address
            );

            success(socket, "song:recordListen", { listenCount });
        } catch (err) {
            logger.error("Record listen error", {
                error: err.message,
                songId: data.songId,
                userId: socket.user?.id,
            });
            error(socket, "song:recordListen", "Failed to record listen");
        }
    });

    // Get listen stats
    socket.on("song:getListens", async (data) => {
        try {
            const { songId } = data;

            if (!songId) {
                return socket.emit("song:getListens", {
                    error: true,
                    message: "Song ID required",
                });
            }

            const [total] = await database.query(
                "SELECT COUNT(*) as count FROM song_listens WHERE song_id = ?",
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

            socket.emit("song:getListens", {
                total: total.count,
                recentListens,
            });
        } catch (error) {
            console.error("Get listens error:", error);
            socket.emit("song:getListens", {
                error: true,
                message: "Failed to get listen stats",
            });
        }
    });

    // Get albums
    socket.on("albums:list", async (data) => {
        try {
            if (!socket.authenticated) {
                return error(socket, "albums:list", "Authentication required");
            }

            const { page = 1, limit = 20 } = data;
            const offset = (page - 1) * limit;

            const albums = await database.query(`
                SELECT al.id, al.title, al.release_year, al.cover_art_url,
                       a.name as artist,
                       COUNT(s.id) as song_count
                FROM albums al
                LEFT JOIN artists a ON al.artist_id = a.id
                LEFT JOIN songs s ON al.id = s.album_id
                GROUP BY al.id
                HAVING song_count > 0
                ORDER BY al.title
                LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
            `);

            // Generate album art URLs
            for (const album of albums) {
                if (album.cover_art_url) {
                    album.cover_art_url = await storageService.generateUrl(
                        album.cover_art_url
                    );
                }
            }

            const [totalCount] = await database.query(`
                SELECT COUNT(DISTINCT al.id) as count
                FROM albums al
                LEFT JOIN songs s ON al.id = s.album_id
                WHERE s.id IS NOT NULL
            `);

            paginated(
                socket,
                "albums:list",
                albums,
                totalCount.count,
                page,
                limit
            );
        } catch (err) {
            logger.error("List albums error", {
                error: err.message,
                userId: socket.user?.id,
            });
            error(socket, "albums:list", "Failed to get albums - songs.js");
        }
    });

    // Search songs
    socket.on("song:search", async (data) => {
        try {
            if (!(await rateLimiter(socket, "song:search"))) {
                return error(socket, "song:search", "Rate limit exceeded");
            }

            const { query, page = 1, limit = 20 } = data;

            if (!query || query.trim().length < 2) {
                return success(socket, "song:search", {
                    songs: [],
                    total: 0,
                    page,
                });
            }

            const searchTerm = `%${query.trim()}%`;
            const offset = (page - 1) * limit;

            // Search songs with pagination
            const songs = await database.query(
                `
                SELECT s.*, a.name as artist, al.title as album, 
                       COALESCE(s.cover_art_url, al.cover_art_url) as cover_art_url
                FROM songs s
                LEFT JOIN artists a ON s.artist_id = a.id
                LEFT JOIN albums al ON s.album_id = al.id
                WHERE s.title LIKE ? OR a.name LIKE ? OR al.title LIKE ? OR s.genre LIKE ?
                ORDER BY s.title ASC
                LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
            `,
                [searchTerm, searchTerm, searchTerm, searchTerm]
            );

            // Generate URLs for songs
            for (const song of songs) {
                if (song.cover_art_url) {
                    song.cover_art_url = await storageService.generateUrl(
                        song.cover_art_url
                    );
                }
                // Pre-generate play URL for faster playback
                if (song.file_path) {
                    song.play_url = await storageService.generateUrl(
                        song.file_path
                    );
                }
            }

            // Get total count
            const [totalResult] = await database.query(
                `
                SELECT COUNT(DISTINCT s.id) as count
                FROM songs s
                LEFT JOIN artists a ON s.artist_id = a.id
                LEFT JOIN albums al ON s.album_id = al.id
                WHERE s.title LIKE ? OR a.name LIKE ? OR al.title LIKE ? OR s.genre LIKE ?
            `,
                [searchTerm, searchTerm, searchTerm, searchTerm]
            );

            success(socket, "song:search", {
                songs,
                total: totalResult.count,
                page,
                query,
            });
        } catch (error) {
            console.error("Search songs error:", error);
            error(socket, "song:search", "Failed to search songs");
        }
    });

    // Check if file hash exists
    socket.on("song:checkHash", async (data) => {
        try {
            if (!socket.authenticated) {
                return socket.emit("song:checkHash", {
                    success: false,
                    message: "Authentication required",
                });
            }

            const { hash } = data;
            if (!hash) {
                return socket.emit("song:checkHash", {
                    success: false,
                    message: "Hash required",
                });
            }

            // Check if any song has a file path containing this hash
            const existing = await database.query(
                "SELECT id FROM songs WHERE file_path LIKE ?",
                [`%${hash}%`]
            );

            socket.emit("song:checkHash", {
                success: true,
                exists: existing.length > 0,
            });
        } catch (error) {
            console.error("Check hash error:", error);
            socket.emit("song:checkHash", {
                success: false,
                message: "Failed to check hash",
            });
        }
    });

    // Get recently played songs
    socket.on("song:recentlyPlayed", async (data) => {
        try {
            const { limit = 10 } = data;

            if (!socket.authenticated) {
                return socket.emit("song:recentlyPlayed", {
                    success: true,
                    songs: [],
                    total: 0,
                });
            }

            const songs = await songService.getRecentlyPlayed(socket.user.id, limit);

            socket.emit("song:recentlyPlayed", {
                success: true,
                songs,
                total: songs.length,
            });
        } catch (error) {
            logger.error("Failed to get recently played", {
                error: error.message,
                userId: socket.user?.id,
            });
            socket.emit("song:recentlyPlayed", {
                success: false,
                message: "Failed to get recently played songs",
            });
        }
    });
}

module.exports = {
    handleSocket,
};
