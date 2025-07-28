/**
 * Player Module - Queue Management
 */

// Store user queues in memory (in production, consider Redis)
const userQueues = new Map();

// Handle socket events
function handleSocket(socket, _io) {
    // Get current queue
    socket.on('player:queue', async () => {
        try {
            if (!socket.authenticated) {
                return socket.emit('player:queue', { 
                    queue: [] 
                });
            }
            
            const queue = userQueues.get(socket.user.id) || [];
            socket.emit('player:queue', { queue });
            
        } catch (error) {
            console.error('Get queue error:', error);
            socket.emit('player:queue', { 
                error: true, 
                message: 'Failed to get queue' 
            });
        }
    });
    
    // Add song to queue
    socket.on('player:addToQueue', async (data) => {
        try {
            if (!socket.authenticated) {
                return socket.emit('player:addToQueue', { 
                    success: false, 
                    message: 'Authentication required' 
                });
            }
            
            const { songId } = data;
            
            if (!songId) {
                return socket.emit('player:addToQueue', { 
                    success: false, 
                    message: 'Song ID required' 
                });
            }
            
            // Get song details
            const database = require('./database');
            const songs = await database.query(`
                SELECT s.id, s.title, s.duration, s.artwork_url,
                       a.name as artist, al.title as album
                FROM songs s
                LEFT JOIN artists a ON s.artist_id = a.id
                LEFT JOIN albums al ON s.album_id = al.id
                WHERE s.id = ?
            `, [songId]);
            
            if (songs.length === 0) {
                return socket.emit('player:addToQueue', { 
                    success: false, 
                    message: 'Song not found' 
                });
            }
            
            const song = songs[0];
            const queue = userQueues.get(socket.user.id) || [];
            
            // Add to queue
            queue.push({
                id: song.id,
                title: song.title,
                artist: song.artist,
                album: song.album,
                duration: song.duration,
                artwork: song.artwork_url,
                addedAt: new Date().toISOString()
            });
            
            userQueues.set(socket.user.id, queue);
            
            socket.emit('player:addToQueue', {
                success: true,
                queue
            });
            
        } catch (error) {
            console.error('Add to queue error:', error);
            socket.emit('player:addToQueue', { 
                success: false, 
                message: 'Failed to add to queue' 
            });
        }
    });
    
    // Remove song from queue
    socket.on('player:removeFromQueue', async (data) => {
        try {
            if (!socket.authenticated) {
                return socket.emit('player:removeFromQueue', { 
                    success: false, 
                    message: 'Authentication required' 
                });
            }
            
            const { index } = data;
            
            if (index === undefined || index < 0) {
                return socket.emit('player:removeFromQueue', { 
                    success: false, 
                    message: 'Valid index required' 
                });
            }
            
            const queue = userQueues.get(socket.user.id) || [];
            
            if (index >= queue.length) {
                return socket.emit('player:removeFromQueue', { 
                    success: false, 
                    message: 'Index out of range' 
                });
            }
            
            // Remove from queue
            queue.splice(index, 1);
            userQueues.set(socket.user.id, queue);
            
            socket.emit('player:removeFromQueue', {
                success: true,
                queue
            });
            
        } catch (error) {
            console.error('Remove from queue error:', error);
            socket.emit('player:removeFromQueue', { 
                success: false, 
                message: 'Failed to remove from queue' 
            });
        }
    });
    
    // Get player status (placeholder for future implementation)
    socket.on('player:status', async () => {
        try {
            // This would be expanded to track actual playback state
            socket.emit('player:status', {
                playing: false,
                currentSong: null,
                position: 0
            });
            
        } catch (error) {
            console.error('Get player status error:', error);
            socket.emit('player:status', { 
                error: true, 
                message: 'Failed to get player status' 
            });
        }
    });
    
    // Clean up queue on disconnect
    socket.on('disconnect', () => {
        if (socket.authenticated && socket.user) {
            // Keep queue for reconnection, but could implement cleanup after timeout
        }
    });
}

module.exports = {
    handleSocket
};