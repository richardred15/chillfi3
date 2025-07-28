/**
 * Authentication Tests
 */
const bcrypt = require('bcrypt');
// const jwt = require('jsonwebtoken');
const auth = require('../auth');

// Mock dependencies
jest.mock('../database');
jest.mock('../config', () => ({
    auth: {
        jwtSecret: 'test_secret',
        tokenExpiry: '7d'
    }
}));

const database = require('../database');

describe('Authentication', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('JWT Token Management', () => {
        test('should generate valid JWT token', () => {
            const user = { id: 1, username: 'test', is_admin: false };
            const token = auth.generateToken(user);
            
            expect(token).toBeDefined();
            expect(typeof token).toBe('string');
        });

        test('should verify valid JWT token', () => {
            const user = { id: 1, username: 'test', is_admin: false };
            const token = auth.generateToken(user);
            const decoded = auth.verifyToken(token);
            
            expect(decoded.userId).toBe(1);
            expect(decoded.username).toBe('test');
            expect(decoded.isAdmin).toBe(false);
        });

        test('should reject invalid JWT token', () => {
            const result = auth.verifyToken('invalid_token');
            expect(result).toBeNull();
        });
    });

    describe('Socket Authentication', () => {
        test('should handle missing token', (done) => {
            const socket = {
                handshake: { auth: {} }
            };

            auth.authenticateSocket(socket, () => {
                expect(socket.authenticated).toBe(false);
                expect(socket.user).toBeNull();
                done();
            });
        });

        test('should handle valid token with user', (done) => {
            const mockUser = { id: 1, username: 'test' };
            database.query.mockResolvedValue([mockUser]);

            const user = { id: 1, username: 'test', is_admin: false };
            const token = auth.generateToken(user);
            
            const socket = {
                handshake: { auth: { token } }
            };

            auth.authenticateSocket(socket, () => {
                expect(socket.authenticated).toBe(true);
                expect(socket.user).toEqual(mockUser);
                done();
            });
        });
    });

    describe('Password Handling', () => {
        test('should hash passwords correctly', async () => {
            const password = 'testpassword';
            const hash = await bcrypt.hash(password, 10);
            
            expect(hash).toBeDefined();
            expect(hash).not.toBe(password);
            
            const isValid = await bcrypt.compare(password, hash);
            expect(isValid).toBe(true);
        });

        test('should reject wrong passwords', async () => {
            const password = 'testpassword';
            const wrongPassword = 'wrongpassword';
            const hash = await bcrypt.hash(password, 10);
            
            const isValid = await bcrypt.compare(wrongPassword, hash);
            expect(isValid).toBe(false);
        });
    });
});