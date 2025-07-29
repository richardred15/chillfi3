/**
 * Database Integration Tests
 * Tests actual database operations with real MySQL
 */
const database = require('../database');

// Use test config when NODE_ENV=test
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

// Increase timeout for database operations
jest.setTimeout(30000);

describe('Database Integration', () => {
    beforeAll(async () => {
        // Initialize database connection (database already exists in CI)
        await database.init();
    });

    afterAll(async () => {
        // Clean up
        await database.cleanup();
    });

    describe('Database Connection', () => {
        test('should connect to test database', async () => {
            const result = await database.query('SELECT DATABASE() as db_name');
            expect(result[0].db_name).toBe('musiclib_test');
        });

        test('should handle basic queries', async () => {
            const result = await database.query('SELECT 1 as test');
            expect(result[0].test).toBe(1);
        });
    });

    describe('Schema Operations', () => {
        test('should create tables from schema', async () => {
            // Check if main tables exist
            const tables = await database.query(`
                SELECT TABLE_NAME 
                FROM INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_SCHEMA = 'musiclib_test'
            `);
            
            const tableNames = tables.map(t => t.TABLE_NAME);
            expect(tableNames).toContain('users');
            expect(tableNames).toContain('songs');
            expect(tableNames).toContain('albums');
            expect(tableNames).toContain('artists');
        });

        test('should handle foreign key constraints', async () => {
            // Test that foreign keys are properly set up
            const constraints = await database.query(`
                SELECT CONSTRAINT_NAME, TABLE_NAME, REFERENCED_TABLE_NAME
                FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
                WHERE TABLE_SCHEMA = 'musiclib_test' 
                AND REFERENCED_TABLE_NAME IS NOT NULL
            `);
            
            expect(constraints.length).toBeGreaterThan(0);
        });
    });

    describe('CRUD Operations', () => {
        test('should insert and retrieve test data', async () => {
            // Insert test user
            const userResult = await database.query(`
                INSERT INTO users (username, password, is_admin) 
                VALUES ('testuser', 'hashedpass', 0)
            `);
            
            expect(userResult.insertId).toBeDefined();
            
            // Retrieve user
            const users = await database.query(
                'SELECT * FROM users WHERE username = ?', 
                ['testuser']
            );
            
            expect(users).toHaveLength(1);
            expect(users[0].username).toBe('testuser');
            
            // Clean up
            await database.query('DELETE FROM users WHERE username = ?', ['testuser']);
        });

        test('should handle transactions', async () => {
            const connection = await database.beginTransaction();
            
            try {
                // Insert test data in transaction
                await connection.execute(`
                    INSERT INTO users (username, password, is_admin) 
                    VALUES ('transactiontest', 'hashedpass', 0)
                `);
                
                // Verify data exists in transaction
                const [users] = await connection.execute(
                    'SELECT * FROM users WHERE username = ?', 
                    ['transactiontest']
                );
                
                expect(users).toHaveLength(1);
                
                // Rollback transaction
                await database.rollbackTransaction(connection);
                
                // Verify data was rolled back
                const usersAfterRollback = await database.query(
                    'SELECT * FROM users WHERE username = ?', 
                    ['transactiontest']
                );
                
                expect(usersAfterRollback).toHaveLength(0);
                
            } catch (error) {
                await database.rollbackTransaction(connection);
                throw error;
            }
        });
    });
});