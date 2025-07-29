/**
 * Services Integration Tests
 * Verify that external services (MySQL, Redis) are working in CI
 */

// Use test config
if (process.env.NODE_ENV === 'test') {
    jest.mock('../config', () => ({
        server: {
            port: process.env.PORT || 3005,
            httpsKey: null,
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
    }));
}

describe('Services Integration', () => {
    describe('MySQL Service', () => {
        test('should connect to MySQL', async () => {
            const mysql = require('mysql2/promise');
            const config = require('../config');
            
            const connection = await mysql.createConnection({
                host: config.database.host,
                port: config.database.port,
                user: config.database.user,
                password: config.database.password,
                database: config.database.database
            });
            
            const [rows] = await connection.execute('SELECT 1 as test');
            expect(rows[0].test).toBe(1);
            
            await connection.end();
        });
    });

    describe('Redis Service', () => {
        test('should connect to Redis', async () => {
            const redis = require('redis');
            const config = require('../config');
            
            const client = redis.createClient({
                host: config.redis.host,
                port: config.redis.port
            });
            
            await client.connect();
            
            // Test basic Redis operations
            await client.set('test_key', 'test_value');
            const value = await client.get('test_key');
            expect(value).toBe('test_value');
            
            await client.del('test_key');
            await client.disconnect();
        });
    });
});