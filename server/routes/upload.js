/**
 * Unified Upload Routes
 */
const express = require('express');
const multer = require('multer');
const { authenticateToken } = require('../middleware/auth');
const uploadService = require('../services/uploadService');
const logger = require('../utils/logger');

const router = express.Router();

// Configure multer for memory storage
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { 
        fileSize: 50 * 1024 * 1024,    // 50MB file limit
        fieldSize: 10 * 1024 * 1024    // 10MB field limit (for base64 artwork)
    },
    fileFilter: (req, file, cb) => {
        logger.info('Upload file filter', {
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            userId: req.user?.id
        });
        cb(null, true);
    }
});

// Upload profile image
router.post('/profile-image', authenticateToken, upload.single('image'), async (req, res) => {
    const requestId = `profile-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    logger.info('Profile image upload started', {
        requestId,
        userId: req.user.id,
        targetUserId: req.body.userId,
        hasFile: !!req.file,
        fileSize: req.file?.size,
        mimetype: req.file?.mimetype
    });
    
    try {
        const { userId } = req.body;
        
        if (!userId) {
            logger.warn('Profile upload missing userId', { requestId, userId: req.user.id });
            return res.status(400).json({ success: false, message: 'User ID required' });
        }
        
        // Check permissions
        if (req.user.id !== parseInt(userId) && !req.user.is_admin) {
            logger.warn('Profile upload unauthorized', {
                requestId,
                userId: req.user.id,
                targetUserId: userId,
                isAdmin: req.user.is_admin
            });
            return res.status(403).json({ success: false, message: 'Unauthorized' });
        }
        
        if (!req.file) {
            logger.warn('Profile upload no file provided', { requestId, userId: req.user.id });
            return res.status(400).json({ success: false, message: 'No image file provided' });
        }
        
        logger.info('Starting profile image upload to storage', {
            requestId,
            userId: req.user.id,
            filename: req.file.originalname,
            size: req.file.size
        });
        
        // Upload image to S3
        const imageUrl = await uploadService.uploadImage(req.file, 'profiles');
        
        logger.info('Profile image uploaded to storage', {
            requestId,
            userId: req.user.id,
            imageUrl
        });
        
        // Update user profile
        const database = require('../database');
        await database.query(
            'UPDATE users SET profile_image_url = ? WHERE id = ?',
            [imageUrl, userId]
        );
        
        logger.info('Profile image URL updated in database', {
            requestId,
            userId: req.user.id,
            targetUserId: userId
        });
        
        // Generate secure URL
        const { generateSecureUrl } = uploadService;
        const { extractS3Key } = require('../utils/s3Utils');
        const s3Key = extractS3Key(imageUrl);
        const secureUrl = s3Key ? await generateSecureUrl(s3Key) : imageUrl;
        
        logger.info('Profile image upload completed', {
            requestId,
            userId: req.user.id,
            success: true
        });
        
        res.json({
            success: true,
            imageUrl: secureUrl
        });
        
    } catch (error) {
        logger.error('Profile image upload failed', {
            requestId,
            userId: req.user?.id,
            error: error.message,
            stack: error.stack,
            fileSize: req.file?.size,
            mimetype: req.file?.mimetype
        });
        res.status(500).json({ 
            success: false, 
            message: 'Failed to upload profile image: ' + error.message,
            requestId 
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
    const requestId = `songs-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    logger.info('Songs upload started', {
        requestId,
        userId: req.user.id,
        fileCount: req.files?.length || 0,
        totalSize: req.files?.reduce((sum, f) => sum + f.size, 0) || 0,
        hasMetadata: !!req.body.metadata,
        files: req.files?.map(f => ({ name: f.originalname, size: f.size })) || []
    });
    
    try {
        if (!req.files || req.files.length === 0) {
            logger.warn('Songs upload no files provided', {
                requestId,
                userId: req.user.id,
                hasFiles: !!req.files,
                fileCount: req.files?.length || 0
            });
            return res.status(400).json({ 
                success: false, 
                message: 'No files provided',
                requestId
            });
        }

        let metadata = [];
        try {
            metadata = JSON.parse(req.body.metadata || '[]');
            logger.info('Parsed upload metadata', {
                requestId,
                userId: req.user.id,
                metadataCount: metadata.length,
                fileCount: req.files.length
            });
        } catch (parseError) {
            logger.error('Failed to parse upload metadata', {
                requestId,
                userId: req.user.id,
                error: parseError.message,
                rawMetadata: req.body.metadata
            });
        }

        const results = [];
        let successCount = 0;
        let failureCount = 0;

        for (let i = 0; i < req.files.length; i++) {
            const file = req.files[i];
            const fileMeta = metadata[i] || {};
            const fileRequestId = `${requestId}-file-${i}`;

            logger.info('Processing individual file', {
                requestId: fileRequestId,
                userId: req.user.id,
                filename: file.originalname,
                size: file.size,
                mimetype: file.mimetype,
                metadata: fileMeta
            });

            try {
                logger.info('About to process file', {
                    requestId: fileRequestId,
                    userId: req.user.id,
                    filename: file.originalname,
                    size: file.size,
                    metadata: fileMeta
                });
                
                const songId = await uploadService.processFile(file, fileMeta, req.user.id);
                
                logger.info('File upload successful', {
                    requestId: fileRequestId,
                    userId: req.user.id,
                    filename: file.originalname,
                    songId
                });
                
                results.push({
                    success: true,
                    songId,
                    filename: file.originalname,
                    requestId: fileRequestId
                });
                successCount++;
            } catch (error) {
                logger.error('Individual file upload failed', {
                    requestId: fileRequestId,
                    userId: req.user.id,
                    filename: file.originalname,
                    size: file.size,
                    mimetype: file.mimetype,
                    error: error.message,
                    stack: error.stack,
                    metadata: fileMeta
                });
                
                results.push({
                    success: false,
                    error: error.message || 'Failed to upload file',
                    filename: file.originalname,
                    requestId: fileRequestId
                });
                failureCount++;
            }
        }

        logger.info('Songs upload batch completed', {
            requestId,
            userId: req.user.id,
            totalFiles: req.files.length,
            successCount,
            failureCount,
            results: results.map(r => ({ success: r.success, filename: r.filename, error: r.error }))
        });

        res.json({
            success: true,
            results,
            summary: {
                total: req.files.length,
                successful: successCount,
                failed: failureCount
            },
            requestId
        });
        
    } catch (error) {
        logger.error('Songs upload batch failed', {
            requestId,
            userId: req.user?.id,
            error: error.message,
            stack: error.stack,
            fileCount: req.files?.length || 0
        });
        res.status(500).json({ 
            success: false, 
            message: 'Failed to upload songs: ' + error.message,
            requestId
        });
    }
});

module.exports = router;