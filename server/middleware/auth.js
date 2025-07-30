/**
 * HTTP Authentication Middleware
 */
const { verifyToken } = require('../auth');
const database = require('../database');
const logger = require('../utils/logger');

// Authenticate HTTP requests using JWT token
async function authenticateToken(req, res, next) {
    const requestId = `auth-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    logger.debug('Authentication attempt', {
        requestId,
        method: req.method,
        url: req.url,
        userAgent: req.headers['user-agent'],
        ip: req.ip || req.connection.remoteAddress,
        hasAuthHeader: !!req.headers['authorization']
    });
    
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
        
        if (!token) {
            logger.warn('Authentication failed - no token', {
                requestId,
                method: req.method,
                url: req.url,
                ip: req.ip || req.connection.remoteAddress,
                authHeader: authHeader ? 'present but invalid format' : 'missing'
            });
            return res.status(401).json({ 
                success: false, 
                message: 'Access token required',
                requestId 
            });
        }
        
        const decoded = verifyToken(token);
        if (!decoded) {
            logger.warn('Authentication failed - invalid token', {
                requestId,
                method: req.method,
                url: req.url,
                ip: req.ip || req.connection.remoteAddress,
                tokenLength: token.length,
                tokenPrefix: token.substring(0, 20) + '...'
            });
            return res.status(403).json({ 
                success: false, 
                message: 'Invalid or expired token',
                requestId 
            });
        }
        
        logger.debug('Token decoded successfully', {
            requestId,
            userId: decoded.userId,
            username: decoded.username,
            isAdmin: decoded.isAdmin,
            tokenExp: decoded.exp
        });
        
        // Get user from database
        const users = await database.query('SELECT * FROM users WHERE id = ?', [decoded.userId]);
        if (users.length === 0) {
            logger.warn('Authentication failed - user not found', {
                requestId,
                userId: decoded.userId,
                username: decoded.username,
                method: req.method,
                url: req.url
            });
            return res.status(403).json({ 
                success: false, 
                message: 'User not found',
                requestId 
            });
        }
        
        req.user = users[0];
        req.requestId = requestId;
        
        logger.debug('Authentication successful', {
            requestId,
            userId: req.user.id,
            username: req.user.username,
            isAdmin: req.user.is_admin,
            method: req.method,
            url: req.url
        });
        
        next();
    } catch (error) {
        logger.error('Authentication middleware error', {
            requestId,
            method: req.method,
            url: req.url,
            ip: req.ip || req.connection.remoteAddress,
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({ 
            success: false, 
            message: 'Authentication error',
            requestId 
        });
    }
}

module.exports = {
    authenticateToken
};