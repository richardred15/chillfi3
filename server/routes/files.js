/**
 * File Serving Routes for Local Storage
 */
const express = require('express');
const path = require('path');
const jwt = require('jsonwebtoken');
const config = require('../config');

const router = express.Router();

// Serve files with optional JWT authentication
router.get('/*', (req, res) => {
    try {
        const filePath = req.params[0];
        const token = req.query.token;
        
        // If token provided, verify it
        if (token) {
            try {
                const decoded = jwt.verify(token, config.auth.jwtSecret);
                if (decoded.key !== filePath) {
                    return res.status(403).json({ error: 'Invalid token for file' });
                }
            } catch (error) {
                return res.status(403).json({ error: 'Invalid or expired token' });
            }
        }
        
        // Serve file from local storage
        const fullPath = path.join(config.storage.localPath, filePath);
        
        // Security: prevent path traversal
        if (!fullPath.startsWith(path.resolve(config.storage.localPath))) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        res.sendFile(fullPath, (err) => {
            if (err) {
                if (err.code === 'ENOENT') {
                    res.status(404).json({ error: 'File not found' });
                } else {
                    res.status(500).json({ error: 'Failed to serve file' });
                }
            }
        });
        
    } catch (error) {
        console.error('File serving error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;