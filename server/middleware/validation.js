/**
 * Input Validation Middleware
 */
const validator = require('validator');

// Sanitize string input
function sanitizeString(str) {
    if (typeof str !== 'string') return str;
    return validator.escape(str.trim());
}

// Validate song metadata
function validateSongMetadata(req, res, next) {
    const { metadata } = req.body;
    
    if (metadata) {
        if (metadata.title && !validator.isLength(metadata.title, { min: 1, max: 200 })) {
            return res.status(400).json({ error: 'Invalid title length' });
        }
        
        if (metadata.artist && !validator.isLength(metadata.artist, { min: 1, max: 100 })) {
            return res.status(400).json({ error: 'Invalid artist length' });
        }
        
        if (metadata.genre && !validator.isAlphanumeric(metadata.genre.replace(/\s/g, ''))) {
            return res.status(400).json({ error: 'Invalid genre format' });
        }
        
        // Sanitize strings
        if (metadata.title) metadata.title = sanitizeString(metadata.title);
        if (metadata.artist) metadata.artist = sanitizeString(metadata.artist);
        if (metadata.album) metadata.album = sanitizeString(metadata.album);
        if (metadata.genre) metadata.genre = sanitizeString(metadata.genre);
    }
    
    next();
}

// Validate user input
function validateUserInput(req, res, next) {
    const { username, bio } = req.body;
    
    if (username && !validator.isLength(username, { min: 3, max: 50 })) {
        return res.status(400).json({ error: 'Username must be 3-50 characters' });
    }
    
    if (bio && !validator.isLength(bio, { max: 500 })) {
        return res.status(400).json({ error: 'Bio must be under 500 characters' });
    }
    
    next();
}

module.exports = {
    validateSongMetadata,
    validateUserInput,
    sanitizeString
};