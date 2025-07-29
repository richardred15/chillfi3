/**
 * Artists Module - Handles artist-related operations
 */
const database = require('./database');
const logger = require('./utils/logger');
const { success, error, paginated } = require('./utils/response');
const rateLimiter = require('./middleware/rateLimiter');
const { secureImageUrl } = require('./utils/s3Utils');

// Handle socket events
function handleSocket(socket, _io) {
    // List artists
    socket.on('artist:list', async (data) => {
        try {
            if (!(await rateLimiter(socket, 'artist:list'))) {
                return error(socket, 'artist:list', 'Rate limit exceeded');
            }

            if (!socket.authenticated) {
                return error(socket, 'artist:list', 'Authentication required');
            }

            const { page = 1, limit = 24 } = data;
            const offset = (page - 1) * limit;

            const artists = await database.query(`
                SELECT a.id, a.name, 
                       COUNT(DISTINCT s.id) as song_count,
                       COUNT(DISTINCT s.album_id) as album_count,
                       (
                           SELECT al2.cover_art_url 
                           FROM albums al2 
                           JOIN songs s2 ON al2.id = s2.album_id 
                           WHERE s2.artist_id = a.id AND al2.cover_art_url IS NOT NULL
                           ORDER BY s2.uploaded_at DESC 
                           LIMIT 1
                       ) as cover_art_url
                FROM artists a
                LEFT JOIN songs s ON a.id = s.artist_id
                GROUP BY a.id, a.name
                HAVING song_count > 0
                ORDER BY song_count DESC
                LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
            `);

            // Secure artwork URLs
            for (const artist of artists) {
                if (artist.cover_art_url) {
                    artist.cover_art_url = await secureImageUrl(artist.cover_art_url);
                }
            }

            const [totalCount] = await database.query(`
                SELECT COUNT(DISTINCT a.id) as count
                FROM artists a
                LEFT JOIN songs s ON a.id = s.artist_id
                WHERE s.id IS NOT NULL
            `);

            paginated(
                socket,
                'artist:list',
                artists,
                totalCount.count,
                page,
                limit
            );
        } catch (err) {
            logger.error('List artists error', { error: err.message, userId: socket.user?.id });
            error(socket, 'artist:list', 'Failed to get artists');
        }
    });

    // Get artist by ID
    socket.on('artist:get', async (data) => {
        try {
            if (!socket.authenticated) {
                return error(socket, 'artist:get', 'Authentication required');
            }

            const { artistId } = data;

            if (!artistId) {
                return error(socket, 'artist:get', 'Artist ID required');
            }

            const artists = await database.query(`
                SELECT a.id, a.name,
                       COUNT(DISTINCT s.id) as song_count,
                       COUNT(DISTINCT s.album_id) as album_count,
                       (
                           SELECT al2.cover_art_url 
                           FROM albums al2 
                           JOIN songs s2 ON al2.id = s2.album_id 
                           WHERE s2.artist_id = a.id AND al2.cover_art_url IS NOT NULL
                           ORDER BY s2.uploaded_at DESC 
                           LIMIT 1
                       ) as cover_art_url
                FROM artists a
                LEFT JOIN songs s ON a.id = s.artist_id
                WHERE a.id = ?
                GROUP BY a.id, a.name
            `, [artistId]);

            if (artists.length === 0) {
                return error(socket, 'artist:get', 'Artist not found');
            }

            const artist = artists[0];
            
            // Secure artwork URL
            if (artist.cover_art_url) {
                artist.cover_art_url = await secureImageUrl(artist.cover_art_url);
            }

            success(socket, 'artist:get', { artist });
        } catch (err) {
            logger.error('Get artist error', { error: err.message, artistId: data.artistId, userId: socket.user?.id });
            error(socket, 'artist:get', 'Failed to get artist');
        }
    });
}

module.exports = {
    handleSocket,
};