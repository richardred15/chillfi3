/**
 * Albums Module - Handles album-related operations
 */
const database = require("./database");
const logger = require("./utils/logger");
const { success, error, paginated } = require("./utils/response");
const rateLimiter = require("./middleware/rateLimiter");
const { secureImageUrl } = require("./utils/s3Utils");

// Handle socket events
function handleSocket(socket, _io) {
    // List albums
    socket.on("albums:list", async (data) => {
        try {
            if (!(await rateLimiter(socket, "albums:list"))) {
                return error(socket, "albums:list", "Rate limit exceeded");
            }

            if (!socket.authenticated) {
                return error(socket, "albums:list", "Authentication required");
            }

            const { page = 1, limit = 24, artistId, requestId } = data;
            const offset = (page - 1) * limit;

            let whereClause = "1=1";
            let queryParams = [];

            // Filter by artist if provided
            if (artistId) {
                whereClause += " AND al.artist_id = ?";
                queryParams.push(artistId);
            }

            const albums = await database.query(
                `
                SELECT al.id, al.title, al.release_year as year, al.cover_art_url,
                       a.name as artist, a.id as artist_id,
                       COUNT(s.id) as song_count
                FROM albums al
                LEFT JOIN artists a ON al.artist_id = a.id
                LEFT JOIN songs s ON al.id = s.album_id
                WHERE ${whereClause}
                GROUP BY al.id, al.title, al.release_year, al.cover_art_url, a.name, a.id
                HAVING song_count > 0
                ORDER BY al.title ASC
                LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
            `,
                queryParams
            );

            // Secure artwork URLs
            for (const album of albums) {
                if (album.cover_art_url) {
                    album.cover_art_url = await secureImageUrl(
                        album.cover_art_url
                    );
                }
            }

            const [totalCount] = await database.query(
                `
                SELECT COUNT(DISTINCT al.id) as count
                FROM albums al
                LEFT JOIN songs s ON al.id = s.album_id
                WHERE ${whereClause} AND s.id IS NOT NULL
            `,
                queryParams
            );

            const response = {
                success: true,
                data: {
                    items: albums,
                    pagination: {
                        total: totalCount.count,
                        page: parseInt(page),
                        limit: parseInt(limit),
                        totalPages: Math.ceil(totalCount.count / limit) || 1
                    }
                },
                timestamp: new Date().toISOString(),
                requestId
            };
            

            socket.emit('albums:list', response);
        } catch (err) {
            logger.error("List albums error", {
                error: err.message,
                userId: socket.user?.id,
            });
            error(socket, "albums:list", "Failed to get albums");
        }
    });

    // Get album by ID
    socket.on("albums:get", async (data) => {
        try {
            if (!socket.authenticated) {
                return error(socket, "albums:get", "Authentication required");
            }

            const { albumId } = data;

            if (!albumId) {
                return error(socket, "albums:get", "Album ID required");
            }

            const albums = await database.query(
                `
                SELECT al.id, al.title, al.release_year as year, al.cover_art_url,
                       a.name as artist, a.id as artist_id,
                       COUNT(s.id) as song_count
                FROM albums al
                LEFT JOIN artists a ON al.artist_id = a.id
                LEFT JOIN songs s ON al.id = s.album_id
                WHERE al.id = ?
                GROUP BY al.id
            `,
                [albumId]
            );

            if (albums.length === 0) {
                return error(socket, "albums:get", "Album not found");
            }

            const album = albums[0];

            // Secure artwork URL
            if (album.cover_art_url) {
                album.cover_art_url = await secureImageUrl(album.cover_art_url);
            }

            success(socket, "albums:get", { album });
        } catch (err) {
            logger.error("Get album error", {
                error: err.message,
                albumId: data.albumId,
                userId: socket.user?.id,
            });
            error(socket, "albums:get", "Failed to get album");
        }
    });
}

module.exports = {
    handleSocket,
};
