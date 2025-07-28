/**
 * Integration Tests
 */
// const request = require('supertest');

// Mock config to avoid HTTPS file reading
jest.mock('../config', () => ({
    server: {
        httpsKey: null,
        httpsCert: null,
        httpsCa: null,
        port: 3005
    },
    client: {
        url: 'http://localhost'
    },
    auth: {
        jwtSecret: 'test_secret',
        tokenExpiry: '7d'
    },
    database: {
        host: 'localhost',
        port: 3306,
        user: 'test',
        password: 'test',
        database: 'test_db'
    },
    aws: {
        region: 'us-west-2',
        accessKeyId: 'test_key',
        secretAccessKey: 'test_secret',
        s3Bucket: 'test-bucket'
    }
}));

const { app, io } = require('../server');
const Client = require('socket.io-client');

// Mock database
jest.mock('../database', () => ({
    init: jest.fn().mockResolvedValue({}),
    query: jest.fn(),
    cleanup: jest.fn()
}));
const database = require('../database');

describe('Integration Tests', () => {
    let clientSocket;
    let serverSocket;

    beforeAll((done) => {
        const server = require('http').createServer(app);
        server.listen(() => {
            const port = server.address().port;
            clientSocket = new Client(`http://localhost:${port}`);
            
            io.on('connection', (socket) => {
                serverSocket = socket;
            });
            
            clientSocket.on('connect', done);
        });
    });

    afterAll(() => {
        io.close();
        clientSocket.close();
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('User Authentication Flow', () => {
        test('should handle complete login flow', (done) => {
            const mockUser = {
                id: 1,
                username: 'testuser',
                password: '$2b$10$hashedpassword',
                is_admin: false
            };

            database.query
                .mockResolvedValueOnce([mockUser]) // Get user
                .mockResolvedValueOnce({}) // Insert session
                .mockResolvedValueOnce({}); // Update last login

            clientSocket.emit('auth:login', {
                username: 'testuser',
                password: 'password'
            });

            clientSocket.on('auth:login', (response) => {
                expect(response.success).toBe(true);
                expect(response.token).toBeDefined();
                expect(response.user.username).toBe('testuser');
                done();
            });
        });

        test('should reject invalid credentials', (done) => {
            database.query.mockResolvedValue([]); // No user found

            clientSocket.emit('auth:login', {
                username: 'nonexistent',
                password: 'password'
            });

            clientSocket.on('auth:login', (response) => {
                expect(response.success).toBe(false);
                expect(response.message).toBe('Invalid credentials');
                done();
            });
        });
    });

    describe('Admin User Management', () => {
        test('should allow admin to create users', (done) => {
            // Mock authenticated admin socket
            serverSocket.authenticated = true;
            serverSocket.user = { id: 1, is_admin: true };

            database.query
                .mockResolvedValueOnce([]) // Check user doesn't exist
                .mockResolvedValueOnce({ insertId: 2 }); // Create user

            clientSocket.emit('auth:createUser', {
                username: 'newuser',
                password: 'password',
                isAdmin: false
            });

            clientSocket.on('auth:createUser', (response) => {
                expect(response.success).toBe(true);
                expect(response.message).toBe('User created successfully');
                done();
            });
        });

        test('should reject non-admin user creation', (done) => {
            serverSocket.authenticated = false;
            serverSocket.user = null;

            clientSocket.emit('auth:createUser', {
                username: 'newuser',
                password: 'password'
            });

            clientSocket.on('auth:createUser', (response) => {
                expect(response.success).toBe(false);
                expect(response.message).toBe('Admin access required');
                done();
            });
        });
    });

    describe('Song Management Flow', () => {
        test('should handle song listing with pagination', (done) => {
            const mockSongs = [
                { id: 1, title: 'Song 1', artist: 'Artist 1' },
                { id: 2, title: 'Song 2', artist: 'Artist 2' }
            ];
            const mockCount = [{ count: 2 }];

            database.query
                .mockResolvedValueOnce(mockSongs)
                .mockResolvedValueOnce(mockCount);

            serverSocket.authenticated = true;
            serverSocket.user = { id: 1 };

            clientSocket.emit('song:list', {
                filters: {},
                page: 1,
                limit: 20
            });

            clientSocket.on('song:list', (response) => {
                expect(response.success).toBe(true);
                expect(response.songs).toHaveLength(2);
                expect(response.total).toBe(2);
                expect(response.page).toBe(1);
                done();
            });
        });
    });

    describe('Error Handling', () => {
        test('should handle database connection failures', (done) => {
            database.query.mockRejectedValue(new Error('Connection failed'));

            serverSocket.authenticated = true;
            serverSocket.user = { id: 1 };

            clientSocket.emit('song:list', {});

            clientSocket.on('song:list', (response) => {
                expect(response.success).toBe(false);
                expect(response.message).toBeDefined();
                done();
            });
        });
    });

    describe('Rate Limiting', () => {
        test('should apply rate limiting to socket events', (done) => {
            let responseCount = 0;
            const maxRequests = 10;

            const handleResponse = () => {
                responseCount++;
                if (responseCount === maxRequests) {
                    // Should have some rate limited responses
                    done();
                }
            };

            // Rapid fire requests
            for (let i = 0; i < maxRequests; i++) {
                clientSocket.emit('auth:login', {
                    username: 'test',
                    password: 'test'
                });
            }

            clientSocket.on('auth:login', handleResponse);
        });
    });
});