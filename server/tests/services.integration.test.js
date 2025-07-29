/**
 * Services Integration Tests
 * Verify that external services (MySQL, Redis) are working in CI
 */

// Use test config
if (process.env.NODE_ENV === 'test') {
    jest.mock('../config', () => require('../config.test'));
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