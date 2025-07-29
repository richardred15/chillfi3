/**
 * HTTP Authentication Middleware
 */
const { verifyToken } = require('../auth');
const database = require('../database');

// Authenticate HTTP requests using JWT token
async function authenticateToken(req, res, next) {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
        
        if (!token) {
            return res.status(401).json({ success: false, message: 'Access token required' });
        }
        
        const decoded = verifyToken(token);
        if (!decoded) {
            return res.status(403).json({ success: false, message: 'Invalid or expired token' });
        }
        
        // Get user from database
        const users = await database.query('SELECT * FROM users WHERE id = ?', [decoded.userId]);
        if (users.length === 0) {
            return res.status(403).json({ success: false, message: 'User not found' });
        }
        
        req.user = users[0];
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(500).json({ success: false, message: 'Authentication error' });
    }
}

module.exports = {
    authenticateToken
};