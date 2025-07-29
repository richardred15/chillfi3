/**
 * S3 Utilities
 */
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const config = require('../config');

const s3Client = new S3Client({
    region: config.aws.region,
    credentials: {
        accessKeyId: config.aws.accessKeyId,
        secretAccessKey: config.aws.secretAccessKey,
    },
});

// URL cache for pre-signed URLs
const urlCache = new Map();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// Helper to extract S3 key from URL
function extractS3Key(url) {
    if (!url) return null;
    return url.split('/').slice(-2).join('/');
}

// Generate secure URL with caching
async function generateSecureUrl(s3Key, expiresIn = 900) {
    const cacheKey = `${s3Key}_${expiresIn}`;
    const cached = urlCache.get(cacheKey);
    
    if (cached && Date.now() < cached.expires) {
        return cached.url;
    }
    
    const command = new GetObjectCommand({
        Bucket: config.aws.s3Bucket,
        Key: s3Key
    });
    
    const url = await getSignedUrl(s3Client, command, { expiresIn });
    
    urlCache.set(cacheKey, {
        url,
        expires: Date.now() + CACHE_DURATION
    });
    
    return url;
}

// Helper to secure image URLs
async function secureImageUrl(url) {
    const key = extractS3Key(url);
    return key ? await generateSecureUrl(key, 3600) : url;
}

module.exports = {
    extractS3Key,
    generateSecureUrl,
    secureImageUrl
};