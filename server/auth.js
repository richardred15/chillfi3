/**
 * Authentication Module
 */
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('./config');
const database = require('./database');
const logger = require('./utils/logger');
const { success, error } = require('./utils/response');
const rateLimiter = require('./middleware/rateLimiter');

const JWT_SECRET = config.auth.jwtSecret;
const TOKEN_EXPIRY = config.auth.tokenExpiry;

// Generate JWT token
function generateToken(user) {
    return jwt.sign(
        { 
            userId: user.id, 
            username: user.username,
            isAdmin: user.is_admin 
        },
        JWT_SECRET,
        { expiresIn: TOKEN_EXPIRY }
    );
}

// Verify JWT token
function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
}



// Socket.IO authentication middleware
function authenticateSocket(socket, next) {
    const token = socket.handshake.auth.token;
    
    if (!token) {
        socket.authenticated = false;
        socket.user = null;
        return next();
    }
    
    const decoded = verifyToken(token);
    if (!decoded) {
        socket.authenticated = false;
        socket.user = null;
        return next();
    }
    
    // Get user from database
    database.query('SELECT * FROM users WHERE id = ?', [decoded.userId])
        .then(users => {
            if (users.length === 0) {
                socket.authenticated = false;
                socket.user = null;
            } else {
                socket.authenticated = true;
                socket.user = users[0];
            }
            next();
        })
        .catch(() => {
            socket.authenticated = false;
            socket.user = null;
            next();
        });
}

// Handle socket events
function handleSocket(socket, _io) {
    // Login
    socket.on('auth:login', async (data) => {
        console.log('Login attempt:', { username: data?.username, hasPassword: !!data?.password });
        try {
            if (!rateLimiter(socket, 'auth:login')) {
                console.log('Rate limit exceeded for login');
                return error(socket, 'auth:login', 'Too many login attempts. Please wait.');
            }
            
            const { username, password } = data;
            
            if (!username || !password) {
                console.log('Missing username or password');
                return error(socket, 'auth:login', 'Username and password required');
            }
            
            // Get user from database
            console.log('Querying database for user:', username);
            const users = await database.query(
                'SELECT * FROM users WHERE username = ?', 
                [username]
            );
            console.log('Database query result:', { userCount: users.length });
            
            if (users.length === 0) {
                console.log('User not found:', username);
                return error(socket, 'auth:login', 'Invalid credentials');
            }
            
            const user = users[0];
            console.log('User found:', { id: user.id, username: user.username, hasPassword: !!user.password });
            
            // Check password
            if (!user.password) {
                console.log('User has no password set');
                return error(socket, 'auth:login', 'Invalid credentials');
            }
            
            const validPassword = await bcrypt.compare(password, user.password);
            console.log('Password validation result:', validPassword);
            if (!validPassword) {
                console.log('Invalid password for user:', username);
                return error(socket, 'auth:login', 'Invalid credentials');
            }
            
            // Generate token
            const token = generateToken(user);
            
            // Store session reference (not the JWT token itself)
            const sessionId = crypto.randomBytes(32).toString('hex');
            await database.query(
                'INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))',
                [user.id, sessionId]
            );
            
            // Update last login
            await database.query(
                'UPDATE users SET last_login = NOW() WHERE id = ?',
                [user.id]
            );
            
            success(socket, 'auth:login', {
                token,
                sessionId,
                user: {
                    id: user.id,
                    username: user.username,
                    bio: user.bio,
                    profile_image: user.profile_image_url,
                    is_admin: user.is_admin
                }
            });
            
        } catch (err) {
            console.error('Login error details:', {
                message: err.message,
                stack: err.stack,
                username: data?.username
            });
            logger.error('Login error:', err);
            error(socket, 'auth:login', 'Login failed');
        }
    });
    
    // Create user (admin only)
    socket.on('auth:createUser', async (data) => {
        try {
            if (!socket.authenticated || !socket.user.is_admin) {
                return socket.emit('auth:createUser', { 
                    success: false, 
                    message: 'Admin access required' 
                });
            }
            
            const { username, password, isAdmin } = data;
            
            if (!username) {
                return socket.emit('auth:createUser', { 
                    success: false, 
                    message: 'Username required' 
                });
            }
            
            // Check if user exists
            const existing = await database.query(
                'SELECT id FROM users WHERE username = ?', 
                [username]
            );
            
            if (existing.length > 0) {
                return socket.emit('auth:createUser', { 
                    success: false, 
                    message: 'Username already exists' 
                });
            }
            
            let passwordHash = null;
            
            if (password) {
                passwordHash = await bcrypt.hash(password, 10);
            }
            
            // Create user
            await database.query(
                'INSERT INTO users (username, password, is_admin) VALUES (?, ?, ?)',
                [username, passwordHash, isAdmin || false]
            );
            
            socket.emit('auth:createUser', {
                success: true,
                message: 'User created successfully'
            });
            
        } catch (error) {
            console.error('Create user error:', error);
            socket.emit('auth:createUser', { 
                success: false, 
                message: 'Failed to create user' 
            });
        }
    });
    
    // Set password (admin only)
    socket.on('auth:setPassword', async (data) => {
        try {
            if (!socket.authenticated || !socket.user.is_admin) {
                return socket.emit('auth:setPassword', { 
                    success: false, 
                    message: 'Admin access required' 
                });
            }
            
            const { userId, password } = data;
            
            if (!userId || !password) {
                return socket.emit('auth:setPassword', { 
                    success: false, 
                    message: 'User ID and password required' 
                });
            }
            
            const passwordHash = await bcrypt.hash(password, 10);
            
            await database.query(
                'UPDATE users SET password = ? WHERE id = ?',
                [passwordHash, userId]
            );
            
            socket.emit('auth:setPassword', { success: true });
            
        } catch (error) {
            console.error('Set password error:', error);
            socket.emit('auth:setPassword', { 
                success: false, 
                message: 'Failed to set password' 
            });
        }
    });
    

    
    // Reset password
    socket.on('auth:resetPassword', async (data) => {
        try {
            if (!socket.authenticated) {
                return socket.emit('auth:resetPassword', {
                    success: false,
                    message: 'Authentication required'
                });
            }
            
            const { currentPassword, newPassword } = data;
            
            if (!currentPassword || !newPassword) {
                return socket.emit('auth:resetPassword', {
                    success: false,
                    message: 'Current and new passwords are required'
                });
            }
            
            // Get user's current password hash
            const users = await database.query(
                'SELECT password FROM users WHERE id = ?',
                [socket.user.id]
            );
            
            if (users.length === 0) {
                return socket.emit('auth:resetPassword', {
                    success: false,
                    message: 'User not found'
                });
            }
            
            // Verify current password
            const isValidPassword = await bcrypt.compare(currentPassword, users[0].password);
            if (!isValidPassword) {
                return socket.emit('auth:resetPassword', {
                    success: false,
                    message: 'Current password is incorrect'
                });
            }
            
            // Hash new password
            const hashedNewPassword = await bcrypt.hash(newPassword, 10);
            
            // Update password
            await database.query(
                'UPDATE users SET password = ? WHERE id = ?',
                [hashedNewPassword, socket.user.id]
            );
            
            // Invalidate all sessions for this user
            await database.query(
                'DELETE FROM sessions WHERE user_id = ?',
                [socket.user.id]
            );
            
            // Clear user data from socket
            socket.authenticated = false;
            socket.user = null;
            
            socket.emit('auth:resetPassword', { success: true });
        } catch (error) {
            console.error('Reset password error:', error);
            socket.emit('auth:resetPassword', {
                success: false,
                message: 'Failed to reset password'
            });
        }
    });
    
    // Logout
    socket.on('auth:logout', async (data) => {
        try {
            const { sessionId } = data;
            
            if (sessionId) {
                await database.query(
                    'DELETE FROM sessions WHERE token = ?',
                    [sessionId]
                );
            }
            
            socket.authenticated = false;
            socket.user = null;
            
            socket.emit('auth:logout', { success: true });
            
        } catch (error) {
            console.error('Logout error:', error);
            socket.emit('auth:logout', { 
                success: false, 
                message: 'Logout failed' 
            });
        }
    });
    
    // Refresh token
    socket.on('auth:refresh', async (data) => {
        try {
            const { token } = data;
            
            if (!token) {
                return socket.emit('auth:refresh', { 
                    success: false, 
                    message: 'Token required' 
                });
            }
            
            const decoded = verifyToken(token);
            if (!decoded) {
                return socket.emit('auth:refresh', { 
                    success: false, 
                    message: 'Invalid token' 
                });
            }
            
            // Get user
            const users = await database.query(
                'SELECT * FROM users WHERE id = ?',
                [decoded.userId]
            );
            
            if (users.length === 0) {
                return socket.emit('auth:refresh', { 
                    success: false, 
                    message: 'User not found' 
                });
            }
            
            const user = users[0];
            const newToken = generateToken(user);
            
            // Update session
            await database.query(
                'UPDATE sessions SET token = ?, expires_at = DATE_ADD(NOW(), INTERVAL 7 DAY) WHERE token = ?',
                [newToken, token]
            );
            
            socket.emit('auth:refresh', {
                success: true,
                newToken
            });
            
        } catch (error) {
            console.error('Refresh token error:', error);
            socket.emit('auth:refresh', { 
                success: false, 
                message: 'Token refresh failed' 
            });
        }
    });
}

module.exports = {
    handleSocket,
    authenticateSocket,
    verifyToken,
    generateToken
};