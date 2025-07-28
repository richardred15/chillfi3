/**
 * Auth Socket Handler Tests
 */

// Mock dependencies first
jest.mock('../database', () => require('./test-database'));
jest.mock('../config', () => ({
    database: {
        host: 'localhost',
        port: 3306,
        user: 'root',
        password: 'test',
        database: 'musiclib_test'
    },
    auth: {
        jwtSecret: 'test_secret',
        tokenExpiry: '7d'
    }
}));

const auth = require('../auth');
const database = require('../database');

describe('Auth Socket Handlers', () => {
    let mockSocket, mockIo;

    beforeEach(() => {
        jest.clearAllMocks();
        
        mockSocket = {
            emit: jest.fn(),
            on: jest.fn(),
            authenticated: false,
            user: null,
            handshake: { address: '127.0.0.1' }
        };
        
        mockIo = {};
        
        // Setup socket handlers
        auth.handleSocket(mockSocket, mockIo);
    });

    describe('auth:login', () => {
        test('should authenticate valid user', async () => {
            const mockUser = {
                id: 1,
                username: 'testuser',
                password: '$2b$10$hashedpassword',
                is_admin: false
            };

            database.query.mockResolvedValueOnce([[mockUser]]);
            
            // Mock bcrypt
            const bcrypt = require('bcrypt');
            bcrypt.compare = jest.fn().mockResolvedValueOnce(true);

            const handler = mockSocket.on.mock.calls.find(call => call[0] === 'auth:login')[1];
            await handler({ username: 'testuser', password: 'password' });

            expect(mockSocket.emit).toHaveBeenCalledWith('auth:login', expect.objectContaining({
                success: true,
                token: expect.any(String),
                user: expect.objectContaining({
                    id: 1,
                    username: 'testuser'
                })
            }));
        });

        test('should reject invalid credentials', async () => {
            database.query.mockResolvedValueOnce([[]]);

            const handler = mockSocket.on.mock.calls.find(call => call[0] === 'auth:login')[1];
            await handler({ username: 'invalid', password: 'wrong' });

            expect(mockSocket.emit).toHaveBeenCalledWith('auth:login', expect.objectContaining({
                success: false,
                message: 'Invalid credentials'
            }));
        });
    });

    describe('auth:createUser', () => {
        test('should create user when admin', async () => {
            mockSocket.authenticated = true;
            mockSocket.user = { id: 1, is_admin: true };

            database.query.mockResolvedValueOnce([{}]);

            const handler = mockSocket.on.mock.calls.find(call => call[0] === 'auth:createUser')[1];
            await handler({ username: 'newuser', password: 'password' });

            expect(mockSocket.emit).toHaveBeenCalledWith('auth:createUser', expect.objectContaining({
                success: true
            }));
        });

        test('should reject non-admin user creation', async () => {
            mockSocket.authenticated = true;
            mockSocket.user = { id: 1, is_admin: false };

            const handler = mockSocket.on.mock.calls.find(call => call[0] === 'auth:createUser')[1];
            await handler({ username: 'newuser', password: 'password' });

            expect(mockSocket.emit).toHaveBeenCalledWith('auth:createUser', expect.objectContaining({
                success: false,
                message: 'Admin access required'
            }));
        });
    });

    describe('auth:logout', () => {
        test('should logout user successfully', async () => {
            mockSocket.authenticated = true;
            mockSocket.user = { id: 1 };

            const handler = mockSocket.on.mock.calls.find(call => call[0] === 'auth:logout')[1];
            await handler({});

            expect(mockSocket.emit).toHaveBeenCalledWith('auth:logout', expect.objectContaining({
                success: true
            }));
        });
    });
});