/**
 * Test Configuration
 * Uses environment variables instead of mocked values
 */
module.exports = {
    server: {
        port: process.env.PORT || 3005,
        httpsKey: null, // No HTTPS in tests
        httpsCert: null,
        httpsCa: null
    },
    client: {
        url: process.env.CLIENT_URL || 'http://localhost'
    },
    auth: {
        jwtSecret: process.env.JWT_SECRET || 'test_secret_key',
        tokenExpiry: '7d'
    },
    database: {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || 'testuser',
        password: process.env.DB_PASSWORD || 'testpass',
        database: process.env.DB_NAME || 'musiclib_test'
    },
    aws: {
        region: process.env.AWS_REGION || 'us-west-2',
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test_key',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test_secret',
        s3Bucket: process.env.S3_BUCKET_NAME || 'test-bucket'
    },
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || undefined
    }
};