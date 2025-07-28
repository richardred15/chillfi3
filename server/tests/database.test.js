/**
 * Database Tests
 */
const database = require('../database');
const { validateQueryParams } = require('../middleware/sqlSecurity');

// Mock mysql2
jest.mock('mysql2/promise');
jest.mock('../config', () => ({
    database: {
        host: 'localhost',
        port: 3306,
        user: 'test',
        password: 'test',
        database: 'test_db'
    }
}));

const mysql = require('mysql2/promise');

describe('Database', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Schema Generation', () => {
        test('should generate CREATE TABLE SQL from schema', () => {
            const mockSchema = {
                tables: {
                    users: {
                        columns: {
                            id: { type: 'INT', primaryKey: true, autoIncrement: true },
                            username: { type: 'VARCHAR(255)', notNull: true, unique: true },
                            password: { type: 'VARCHAR(255)' }
                        }
                    }
                }
            };

            const sql = database.generateSchemaSQL(mockSchema);
            
            expect(sql).toContain('CREATE TABLE IF NOT EXISTS users');
            expect(sql).toContain('id INT AUTO_INCREMENT NOT NULL');
            expect(sql).toContain('username VARCHAR(255) NOT NULL UNIQUE');
            expect(sql).toContain('PRIMARY KEY (id)');
        });

        test('should handle foreign keys in schema', () => {
            const mockSchema = {
                tables: {
                    songs: {
                        columns: {
                            id: { type: 'INT', primaryKey: true },
                            user_id: { type: 'INT' }
                        },
                        foreignKeys: [{
                            column: 'user_id',
                            references: 'users(id)',
                            onDelete: 'CASCADE'
                        }]
                    }
                }
            };

            const sql = database.generateSchemaSQL(mockSchema);
            
            expect(sql).toContain('FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE');
        });
    });

    describe('Query Security', () => {
        test('should validate safe query parameters', () => {
            const safeParams = ['test', 123, true];
            expect(validateQueryParams(safeParams)).toBe(true);
        });

        test('should reject SQL injection attempts', () => {
            const maliciousParams = ['\'; DROP TABLE users; --'];
            expect(validateQueryParams(maliciousParams)).toBe(false);
        });

        test('should reject script injection attempts', () => {
            const scriptParams = ['<script>alert("xss")</script>'];
            expect(validateQueryParams(scriptParams)).toBe(false);
        });

        test('should allow auth context parameters', () => {
            const authParams = ['admin', 'password123'];
            expect(validateQueryParams(authParams, 'auth')).toBe(true);
        });
    });

    describe('Connection Management', () => {
        test('should handle connection errors gracefully', async () => {
            const mockConnection = {
                execute: jest.fn().mockRejectedValue(new Error('Connection failed')),
                release: jest.fn()
            };
            
            const mockPool = {
                getConnection: jest.fn().mockResolvedValue(mockConnection)
            };

            mysql.createPool.mockReturnValue(mockPool);

            await expect(database.query('SELECT 1')).rejects.toThrow('Database operation failed');
            expect(mockConnection.release).toHaveBeenCalled();
        });
    });
});