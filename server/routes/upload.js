/**
 * HTTP Upload Routes
 */
const express = require('express');
const multer = require('multer');
const { verifyToken } = require('../auth');
const uploadService = require('../services/uploadService');
const rateLimiter = require('../middleware/rateLimiter');

const router = express.Router();

// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 200 * 1024 * 1024, // 200MB per file
        files: 20, // Max 20 files per request
        fieldSize: 500 * 1024 * 1024 // 500MB total request size
    },
    fileFilter: (req, file, cb) => {
        const audioTypes = ['audio/mpeg', 'audio/wav', 'audio/flac', 'audio/mp4', 'audio/aac', 'audio/ogg'];
        if (audioTypes.includes(file.mimetype) || file.originalname.match(/\.(mp3|wav|flac|m4a|aac|ogg|wma)$/i)) {
            cb(null, true);
        } else {
            cb(new Error('Only audio files are allowed'));
        }
    }
});

// Authentication middleware
const authenticate = (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    
    const decoded = verifyToken(token);
    if (!decoded) {
        return res.status(401).json({ error: 'Invalid token' });
    }
    
    req.user = { id: decoded.userId, username: decoded.username, is_admin: decoded.isAdmin };
    next();
};

// Rate limiting middleware
const checkRateLimit = (req, res, next) => {
    const mockSocket = {
        handshake: { address: req.ip },
        user: req.user
    };
    
    if (!rateLimiter(mockSocket, 'song:upload')) {
        return res.status(429).json({ error: 'Too many upload requests' });
    }
    
    next();
};

// Upload endpoint
router.post('/songs', authenticate, checkRateLimit, upload.array('files'), async (req, res) => {
    const uploadId = `upload_${Date.now()}_${req.user.id}`;
    
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }
        
        const metadata = JSON.parse(req.body.metadata || '[]');
        const results = [];
        
        // Track upload session
        uploadService.trackUpload(uploadId, {
            userId: req.user.id,
            username: req.user.username,
            totalFiles: req.files.length,
            processedFiles: 0,
            startTime: Date.now()
        });
        
        for (let i = 0; i < req.files.length; i++) {
            const file = req.files[i];
            const fileMetadata = metadata[i] || {};
            
            // Update progress
            uploadService.updateUploadProgress(uploadId, {
                currentFile: file.originalname,
                processedFiles: i
            });
            
            try {
                const songId = await uploadService.processFile(file, fileMetadata, req.user.id);
                results.push({ 
                    success: true, 
                    filename: file.originalname,
                    songId 
                });
            } catch (error) {
                results.push({ 
                    success: false, 
                    filename: file.originalname,
                    error: error.message 
                });
            }
        }
        
        // Complete upload session
        uploadService.completeUpload(uploadId);
        
        res.json({ 
            success: true,
            results,
            uploaded: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length
        });
        
    } catch (error) {
        console.error('Upload error:', error);
        uploadService.completeUpload(uploadId);
        res.status(500).json({ error: 'Upload failed' });
    }
});

module.exports = router;