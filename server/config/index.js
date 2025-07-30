/**
 * Configuration Management
 */
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

function requireEnv(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Required environment variable ${name} is not set`);
    }
    return value;
}

const config = {
    // Server configuration
    server: {
        port: requireEnv('PORT'),
        host: requireEnv('HOST'),
        httpsKey: process.env.HTTPS_KEY,
        httpsCert: process.env.HTTPS_CERT,
        httpsCa: process.env.HTTPS_CA,
    },

    // Database configuration
    database: {
        host: requireEnv('DB_HOST'),
        port: requireEnv('DB_PORT'),
        user: requireEnv('DB_USER'),
        password: requireEnv('DB_PASSWORD'),
        database: requireEnv('DB_NAME'),
    },

    // AWS configuration (only required if using S3)
    aws: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION,
        s3Bucket: process.env.S3_BUCKET_NAME,
    },

    // Authentication configuration
    auth: {
        jwtSecret: requireEnv('JWT_SECRET'),
        tokenExpiry: requireEnv('TOKEN_EXPIRY'),
    },

    // Upload configuration
    upload: {
        maxFileSize: parseInt(requireEnv('MAX_FILE_SIZE')),
    },

    // Logging configuration
    logging: {
        level: requireEnv('LOG_LEVEL'),
    },

    // Client configuration
    client: {
        url: requireEnv('CLIENT_URL'),
    },

    // Storage configuration
    storage: {
        type: requireEnv('STORAGE_TYPE'),
        localPath: process.env.LOCAL_STORAGE_PATH,
    },

    // Environment
    env: requireEnv('NODE_ENV'),
    isProduction: process.env.NODE_ENV === 'production',
};

// Validate storage-specific requirements
if (config.storage.type === 'local' && !config.storage.localPath) {
    throw new Error('LOCAL_STORAGE_PATH is required when STORAGE_TYPE is local');
}

if (config.storage.type === 's3') {
    if (!config.aws.accessKeyId) throw new Error('AWS_ACCESS_KEY_ID is required when STORAGE_TYPE is s3');
    if (!config.aws.secretAccessKey) throw new Error('AWS_SECRET_ACCESS_KEY is required when STORAGE_TYPE is s3');
    if (!config.aws.region) throw new Error('AWS_REGION is required when STORAGE_TYPE is s3');
    if (!config.aws.s3Bucket) throw new Error('S3_BUCKET_NAME is required when STORAGE_TYPE is s3');
}

module.exports = config;
