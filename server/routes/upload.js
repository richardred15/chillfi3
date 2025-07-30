/**
 * Unified Upload Routes
 */
const express = require('express');
const multer = require('multer');
const { authenticateToken } = require('../middleware/auth');
const uploadService = require('../services/uploadService');

const router = express.Router();

// Configure multer for memory storage
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Upload profile image
router.post('/profile-image', authenticateToken, upload.single('image'), async (req, res) => {
    try {
        const { userId } = req.body;
        
        // Check permissions
        if (req.user.id !== parseInt(userId) && !req.user.is_admin) {
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }
        
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No image file provided' });
        }
        
        // Upload image to S3
        const imageUrl = await uploadService.uploadImage(req.file, 'profiles');
        
        // Update user profile
        const database = require('../database');
        await database.query(
            'UPDATE users SET profile_image_url = ? WHERE id = ?',
            [imageUrl, userId]
        );
        
        // Generate secure URL
        const { generateSecureUrl } = uploadService;
        const { extractS3Key } = require('../utils/s3Utils');
        const s3Key = extractS3Key(imageUrl);
        const secureUrl = s3Key ? await generateSecureUrl(s3Key) : imageUrl;
        
        res.json({
            success: true,
            imageUrl: secureUrl
        });
        
    } catch (error) {
        console.error('Profile image upload error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to upload profile image: ' + error.message 
        });
    }
});

// Upload album art
router.post('/album-art', authenticateToken, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No image file provided' });
        }
        
        // Upload image to S3
        const imageUrl = await uploadService.uploadImage(req.file, 'album_art');
        
        res.json({
            success: true,
            imageUrl
        });
        
    } catch (error) {
        console.error('Album art upload error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to upload album art: ' + error.message 
        });
    }
});

// Upload songs
router.post('/songs', authenticateToken, upload.array('files'), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'No files provided' 
            });
        }

        const metadata = JSON.parse(req.body.metadata || '[]');
        const results = [];

        for (let i = 0; i < req.files.length; i++) {
            const file = req.files[i];
            const fileMeta = metadata[i] || {};

            try {
                const songId = await uploadService.processFile(file, fileMeta, req.user.id);
                results.push({
                    success: true,
                    songId,
                    filename: file.originalname
                });
            } catch (error) {
                console.error('File upload error:', error);
                results.push({
                    success: false,
                    error: 'Failed to upload file',
                    filename: file.originalname
                });
            }
        }

        res.json({
            success: true,
            results
        });
        
    } catch (error) {
        console.error('Songs upload error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to upload songs: ' + error.message 
        });
    }
});

module.exports = router;