/**
 * Users Module
 */
const database = require('./database');
const { generateSecureUrl } = require('./services/uploadService');

// Helper to secure profile image URLs
async function secureProfileImage(url) {
    if (!url) return url;
    const key = url.split('/').slice(-2).join('/');
    return await generateSecureUrl(key, 3600); // 1 hour for profile images
}

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
            
            // Secure profile image URL
            if (user.profile_image_url) {
                user.profile_image_url = await secureProfileImage(user.profile_image_url);
            }
            
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
            
            const allowedFields = ['username', 'display_name', 'bio', 'profile_image_url'];
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
            
            const user = users[0];
            
            // Secure profile image URL
            if (user.profile_image_url) {
                user.profile_image_url = await secureProfileImage(user.profile_image_url);
            }
            
            socket.emit('user:update', {
                success: true,
                user
            });
            
        } catch (error) {
            console.error('Update user error:', error);
            socket.emit('user:update', { 
                success: false, 
                message: 'Failed to update profile' 
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

    // Update user theme
    socket.on('user:updateTheme', async (data) => {
        try {
            if (!socket.authenticated) {
                return socket.emit('user:updateTheme', { 
                    success: false, 
                    message: 'Authentication required' 
                });
            }
            
            const { theme } = data;
            
            if (!theme || typeof theme !== 'string') {
                return socket.emit('user:updateTheme', { 
                    success: false, 
                    message: 'Valid theme name required' 
                });
            }
            
            // Validate theme name (basic validation)
            const validThemes = ['default', 'dark', 'ocean', 'spotify', 'sunset', 'synthwave'];
            if (!validThemes.includes(theme)) {
                return socket.emit('user:updateTheme', { 
                    success: false, 
                    message: 'Invalid theme name' 
                });
            }
            
            await database.query(
                'UPDATE users SET theme = ? WHERE id = ?',
                [theme, socket.user.id]
            );
            
            socket.emit('user:updateTheme', {
                success: true,
                theme
            });
            
        } catch (error) {
            console.error('Update user theme error:', error);
            socket.emit('user:updateTheme', { 
                success: false, 
                message: 'Failed to update theme' 
            });
        }
    });

    // Get user theme
    socket.on('user:getTheme', async (_data) => {
        try {
            if (!socket.authenticated) {
                return socket.emit('user:getTheme', { 
                    success: false, 
                    message: 'Authentication required' 
                });
            }
            
            const users = await database.query(
                'SELECT theme FROM users WHERE id = ?',
                [socket.user.id]
            );
            
            const theme = users.length > 0 ? users[0].theme || 'default' : 'default';
            
            socket.emit('user:getTheme', {
                success: true,
                theme
            });
            
        } catch (error) {
            console.error('Get user theme error:', error);
            socket.emit('user:getTheme', { 
                success: false, 
                message: 'Failed to get theme' 
            });
        }
    });
}

module.exports = {
    handleSocket
};