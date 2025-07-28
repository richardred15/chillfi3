/**
 * Users Module
 */
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
// const multer = require('multer');
const config = require('./config');
const database = require('./database');

const s3Client = new S3Client({
    region: config.aws.region,
    credentials: {
        accessKeyId: config.aws.accessKeyId,
        secretAccessKey: config.aws.secretAccessKey
    }
});
const BUCKET_NAME = config.aws.s3Bucket;

// Handle socket events
function handleSocket(socket, _io) {
    // Get user profile
    socket.on('user:profile', async (data) => {
        try {
            const { userId } = data;
            
            if (!userId) {
                return socket.emit('user:profile', { 
                    error: true, 
                    message: 'User ID required' 
                });
            }
            
            // Get user info
            const users = await database.query(
                'SELECT id, username, display_name, bio, profile_image_url, is_admin, created_at FROM users WHERE id = ?',
                [userId]
            );
            
            if (users.length === 0) {
                return socket.emit('user:profile', { 
                    error: true, 
                    message: 'User not found' 
                });
            }
            
            const user = users[0];
            
            // Get user stats
            const [uploadCount] = await database.query(
                'SELECT COUNT(*) as count FROM songs WHERE uploaded_by = ?',
                [userId]
            );
            
            const [totalListens] = await database.query(
                'SELECT COUNT(*) as count FROM song_listens sl JOIN songs s ON sl.song_id = s.id WHERE s.uploaded_by = ?',
                [userId]
            );
            
            // Get top songs
            const topSongs = await database.query(`
                SELECT s.id, s.title, a.name as artist, COUNT(sl.id) as listen_count
                FROM songs s
                LEFT JOIN artists a ON s.artist_id = a.id
                LEFT JOIN song_listens sl ON s.id = sl.song_id
                WHERE s.uploaded_by = ?
                GROUP BY s.id
                ORDER BY listen_count DESC
                LIMIT 5
            `, [userId]);
            
            // Get recent uploads
            const recentUploads = await database.query(`
                SELECT s.id, s.title, a.name as artist, s.uploaded_at
                FROM songs s
                LEFT JOIN artists a ON s.artist_id = a.id
                WHERE s.uploaded_by = ?
                ORDER BY s.uploaded_at DESC
                LIMIT 10
            `, [userId]);
            
            const stats = {
                uploadCount: uploadCount.count,
                totalListens: totalListens.count,
                topSongs,
                recentUploads
            };
            
            socket.emit('user:profile', {
                user,
                stats,
                recentUploads
            });
            
        } catch (error) {
            console.error('Get user profile error:', error);
            socket.emit('user:profile', { 
                error: true, 
                message: 'Failed to get user profile' 
            });
        }
    });
    
    // Update user profile
    socket.on('user:update', async (data) => {
        try {
            if (!socket.authenticated) {
                return socket.emit('user:update', { 
                    success: false, 
                    message: 'Authentication required' 
                });
            }
            
            const { userId, updates } = data;
            
            // Check permissions
            if (socket.user.id !== userId && !socket.user.is_admin) {
                return socket.emit('user:update', { 
                    success: false, 
                    message: 'Unauthorized' 
                });
            }
            
            const allowedFields = ['username', 'display_name', 'bio'];
            const updateFields = [];
            const updateValues = [];
            
            for (const field of allowedFields) {
                if (updates[field] !== undefined) {
                    updateFields.push(`${field} = ?`);
                    updateValues.push(updates[field]);
                }
            }
            
            if (updateFields.length === 0) {
                return socket.emit('user:update', { 
                    success: false, 
                    message: 'No valid fields to update' 
                });
            }
            
            // Check if username is unique (if updating username)
            if (updates.username) {
                const existing = await database.query(
                    'SELECT id FROM users WHERE username = ? AND id != ?',
                    [updates.username, userId]
                );
                
                if (existing.length > 0) {
                    return socket.emit('user:update', { 
                        success: false, 
                        message: 'Username already exists' 
                    });
                }
            }
            
            updateValues.push(userId);
            
            await database.query(
                `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
                updateValues
            );
            
            // Get updated user
            const users = await database.query(
                'SELECT id, username, display_name, bio, profile_image_url, is_admin FROM users WHERE id = ?',
                [userId]
            );
            
            socket.emit('user:update', {
                success: true,
                user: users[0]
            });
            
        } catch (error) {
            console.error('Update user error:', error);
            socket.emit('user:update', { 
                success: false, 
                message: 'Failed to update profile' 
            });
        }
    });
    
    // Upload avatar
    socket.on('user:uploadAvatar', async (data) => {
        try {
            if (!socket.authenticated) {
                return socket.emit('user:uploadAvatar', { 
                    success: false, 
                    message: 'Authentication required' 
                });
            }
            
            const { userId, imageFile } = data;
            
            // Check permissions
            if (socket.user.id !== userId && !socket.user.is_admin) {
                return socket.emit('user:uploadAvatar', { 
                    success: false, 
                    message: 'Unauthorized' 
                });
            }
            
            if (!imageFile) {
                return socket.emit('user:uploadAvatar', { 
                    success: false, 
                    message: 'Image file required' 
                });
            }
            
            // Generate unique filename
            const fileExtension = imageFile.name.split('.').pop();
            const fileName = `profiles/${userId}_${Date.now()}.${fileExtension}`;
            
            // Upload to S3
            const base64Data = imageFile.data.split(',')[1] || imageFile.data;
            const uploadCommand = new PutObjectCommand({
                Bucket: BUCKET_NAME,
                Key: fileName,
                Body: Buffer.from(base64Data, 'base64'),
                ContentType: imageFile.type
            });
            
            await s3Client.send(uploadCommand);
            const profileImageUrl = `https://${BUCKET_NAME}.s3.${config.aws.region}.amazonaws.com/${fileName}`;
            
            // Update user profile
            await database.query(
                'UPDATE users SET profile_image_url = ? WHERE id = ?',
                [profileImageUrl, userId]
            );
            
            socket.emit('user:uploadAvatar', {
                success: true,
                profileImageUrl
            });
            
        } catch (error) {
            console.error('Upload avatar error:', error);
            socket.emit('user:uploadAvatar', { 
                success: false, 
                message: 'Failed to upload avatar' 
            });
        }
    });
    
    // Get user stats
    socket.on('user:getStats', async (data) => {
        try {
            const { userId } = data;
            
            if (!userId) {
                return socket.emit('user:getStats', { 
                    error: true, 
                    message: 'User ID required' 
                });
            }
            
            const [uploadCount] = await database.query(
                'SELECT COUNT(*) as count FROM songs WHERE uploaded_by = ?',
                [userId]
            );
            
            const [totalListens] = await database.query(
                'SELECT COUNT(*) as count FROM song_listens sl JOIN songs s ON sl.song_id = s.id WHERE s.uploaded_by = ?',
                [userId]
            );
            
            const topSongs = await database.query(`
                SELECT s.id, s.title, a.name as artist, COUNT(sl.id) as listen_count
                FROM songs s
                LEFT JOIN artists a ON s.artist_id = a.id
                LEFT JOIN song_listens sl ON s.id = sl.song_id
                WHERE s.uploaded_by = ?
                GROUP BY s.id
                ORDER BY listen_count DESC
                LIMIT 10
            `, [userId]);
            
            socket.emit('user:getStats', {
                uploadCount: uploadCount.count,
                totalListens: totalListens.count,
                topSongs
            });
            
        } catch (error) {
            console.error('Get user stats error:', error);
            socket.emit('user:getStats', { 
                error: true, 
                message: 'Failed to get user stats' 
            });
        }
    });
    
    // Get user uploads
    socket.on('user:getUploads', async (data) => {
        try {
            const { userId, page = 1, limit = 20 } = data;
            
            if (!userId) {
                return socket.emit('user:getUploads', { 
                    error: true, 
                    message: 'User ID required' 
                });
            }
            
            const offset = (page - 1) * limit;
            
            const songs = await database.query(`
                SELECT s.id, s.title, a.name as artist, al.title as album, s.duration, s.uploaded_at,
                       COUNT(sl.id) as listen_count
                FROM songs s
                LEFT JOIN artists a ON s.artist_id = a.id
                LEFT JOIN albums al ON s.album_id = al.id
                LEFT JOIN song_listens sl ON s.id = sl.song_id
                WHERE s.uploaded_by = ?
                GROUP BY s.id
                ORDER BY s.uploaded_at DESC
                LIMIT ? OFFSET ?
            `, [userId, limit, offset]);
            
            const [totalCount] = await database.query(
                'SELECT COUNT(*) as count FROM songs WHERE uploaded_by = ?',
                [userId]
            );
            
            socket.emit('user:getUploads', {
                songs,
                total: totalCount.count,
                page
            });
            
        } catch (error) {
            console.error('Get user uploads error:', error);
            socket.emit('user:getUploads', { 
                error: true, 
                message: 'Failed to get user uploads' 
            });
        }
    });
}

module.exports = {
    handleSocket
};