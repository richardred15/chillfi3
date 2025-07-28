/**
 * Configuration Management
 */
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const config = {
    // Server configuration
    server: {
        port: process.env.PORT || 3005,
        host: process.env.HOST || 'localhost',
        httpsKey: process.env.HTTPS_KEY,
        httpsCert: process.env.HTTPS_CERT,
        httpsCa: process.env.HTTPS_CA,
    },

    // Database configuration
    database: {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'musiclib',
    },

    // AWS configuration
    aws: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION || 'us-west-2',
        s3Bucket: process.env.S3_BUCKET_NAME || 'musiclib-storage',
    },

    // Authentication configuration
    auth: {
        jwtSecret: process.env.JWT_SECRET || 'change-this-secret-key',
        tokenExpiry: process.env.TOKEN_EXPIRY || '7d',
    },

    // Upload configuration
    upload: {
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 100 * 1024 * 1024,
        chunkSize: parseInt(process.env.CHUNK_SIZE) || 512 * 1024,
    },

    // Logging configuration
    logging: {
        level: process.env.LOG_LEVEL || 'INFO',
    },

    // Client configuration
    client: {
        url: process.env.CLIENT_URL || 'http://localhost',
    },

    // Environment
    env: process.env.NODE_ENV || 'development',
    isProduction: process.env.NODE_ENV === 'production',
};

module.exports = config;
