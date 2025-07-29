/**
 * Artists Module - Handles artist-related operations
 */
const database = require('./database');
const logger = require('./utils/logger');
const { success, error, paginated } = require('./utils/response');
const rateLimiter = require('./middleware/rateLimiter');
const { secureImageUrl } = require('./utils/s3Utils');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const crypto = require('crypto');
const config = require('./config');

const s3Client = new S3Client({
    region: config.aws.region,
    credentials: {
        accessKeyId: config.aws.accessKeyId,
        secretAccessKey: config.aws.secretAccessKey,
    },
});
const BUCKET_NAME = config.aws.s3Bucket;

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
                SELECT a.id, a.name, a.bio, a.image_url,
                       COUNT(DISTINCT s.id) as song_count,
                       COUNT(DISTINCT s.album_id) as album_count,
                       COALESCE(a.image_url, (
                           SELECT al2.cover_art_url 
                           FROM albums al2 
                           JOIN songs s2 ON al2.id = s2.album_id 
                           WHERE s2.artist_id = a.id AND al2.cover_art_url IS NOT NULL
                           ORDER BY s2.uploaded_at DESC 
                           LIMIT 1
                       )) as cover_art_url
                FROM artists a
                LEFT JOIN songs s ON a.id = s.artist_id
                GROUP BY a.id, a.name, a.bio, a.image_url
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
                SELECT a.id, a.name, a.bio, a.image_url,
                       COUNT(DISTINCT s.id) as song_count,
                       COUNT(DISTINCT s.album_id) as album_count,
                       COALESCE(a.image_url, (
                           SELECT al2.cover_art_url 
                           FROM albums al2 
                           JOIN songs s2 ON al2.id = s2.album_id 
                           WHERE s2.artist_id = a.id AND al2.cover_art_url IS NOT NULL
                           ORDER BY s2.uploaded_at DESC 
                           LIMIT 1
                       )) as cover_art_url
                FROM artists a
                LEFT JOIN songs s ON a.id = s.artist_id
                WHERE a.id = ?
                GROUP BY a.id, a.name, a.bio, a.image_url
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

    // Update artist
    socket.on('artist:update', async (data) => {
        try {
            if (!socket.authenticated) {
                return error(socket, 'artist:update', 'Authentication required');
            }

            const { artistId, metadata } = data;

            if (!artistId) {
                return error(socket, 'artist:update', 'Artist ID required');
            }

            // Check if user has permission (owns songs by this artist or is admin)
            const artistSongs = await database.query(
                'SELECT DISTINCT s.uploaded_by FROM songs s WHERE s.artist_id = ?',
                [artistId]
            );
            
            const hasPermission = socket.user.is_admin || 
                artistSongs.some(song => song.uploaded_by === socket.user.id);

            if (!hasPermission) {
                return error(socket, 'artist:update', 'Unauthorized');
            }

            const updateFields = [];
            const updateValues = [];

            // Allow updating name and bio
            if (metadata.name !== undefined) {
                updateFields.push('name = ?');
                updateValues.push(metadata.name);
            }
            
            if (metadata.bio !== undefined) {
                updateFields.push('bio = ?');
                updateValues.push(metadata.bio);
            }
            
            // Handle image upload
            if (metadata.image_data) {
                try {
                    // Upload image to S3
                    const imageBuffer = Buffer.from(metadata.image_data.split(',')[1], 'base64');
                    const imageHash = crypto.createHash('sha256').update(imageBuffer).digest('hex');
                    const key = `artist_images/${imageHash}.jpg`;
                    
                    const uploadCommand = new PutObjectCommand({
                        Bucket: BUCKET_NAME,
                        Key: key,
                        Body: imageBuffer,
                        ContentType: 'image/jpeg',
                    });
                    
                    await s3Client.send(uploadCommand);
                    const imageUrl = `https://${BUCKET_NAME}.s3.${config.aws.region}.amazonaws.com/${key}`;
                    
                    updateFields.push('image_url = ?');
                    updateValues.push(imageUrl);
                } catch (uploadError) {
                    logger.error('Artist image upload failed', { error: uploadError.message, artistId });
                    // Continue without image update
                }
            } else if (metadata.image_url !== undefined) {
                updateFields.push('image_url = ?');
                updateValues.push(metadata.image_url);
            }

            if (updateFields.length > 0) {
                updateValues.push(artistId);
                await database.query(
                    `UPDATE artists SET ${updateFields.join(', ')} WHERE id = ?`,
                    updateValues
                );
            }

            // Get updated artist
            const updatedArtists = await database.query(
                'SELECT * FROM artists WHERE id = ?',
                [artistId]
            );

            success(socket, 'artist:update', { artist: updatedArtists[0] });
        } catch (err) {
            logger.error('Update artist error', { error: err.message, artistId: data.artistId, userId: socket.user?.id });
            error(socket, 'artist:update', err.message || 'Failed to update artist');
        }
    });
}

module.exports = {
    handleSocket,
};