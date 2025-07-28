/**
 * Users Socket Handler Tests
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
    aws: {
        region: 'us-west-2',
        accessKeyId: 'test',
        secretAccessKey: 'test',
        s3Bucket: 'test-bucket'
    }
}));

const users = require('../users');
const database = require('../database');

describe('Users Socket Handlers', () => {
    let mockSocket, mockIo;

    beforeEach(() => {
        jest.clearAllMocks();
        
        mockSocket = {
            emit: jest.fn(),
            on: jest.fn(),
            authenticated: true,
            user: { id: 1, is_admin: false },
            handshake: { address: '127.0.0.1' }
        };
        
        mockIo = {};
        
        // Setup socket handlers
        users.handleSocket(mockSocket, mockIo);
    });

    describe('user:profile', () => {
        test('should return user profile', async () => {
            const mockUser = {
                id: 1,
                username: 'testuser',
                bio: 'Test bio',
                profile_image: null
            };

            const mockStats = { uploadCount: 5, totalListens: 100 };
            const mockUploads = [{ id: 1, title: 'Test Song' }];

            database.query
                .mockResolvedValueOnce([[mockUser]]) // user query
                .mockResolvedValueOnce([[mockStats]]) // stats query
                .mockResolvedValueOnce([mockUploads]); // uploads query

            const handler = mockSocket.on.mock.calls.find(call => call[0] === 'user:profile')[1];
            await handler({ userId: 1 });

            expect(mockSocket.emit).toHaveBeenCalledWith('user:profile', expect.objectContaining({
                success: true,
                user: mockUser,
                stats: mockStats,
                recentUploads: mockUploads
            }));
        });

        test('should return error for non-existent user', async () => {
            database.query.mockResolvedValueOnce([[]]);

            const handler = mockSocket.on.mock.calls.find(call => call[0] === 'user:profile')[1];
            await handler({ userId: 999 });

            expect(mockSocket.emit).toHaveBeenCalledWith('user:profile', expect.objectContaining({
                success: false,
                message: 'User not found'
            }));
        });
    });

    describe('user:update', () => {
        test('should update user profile', async () => {
            database.query.mockResolvedValueOnce([{}]);

            const handler = mockSocket.on.mock.calls.find(call => call[0] === 'user:update')[1];
            await handler({ 
                userId: 1, 
                updates: { username: 'newname', bio: 'New bio' } 
            });

            expect(mockSocket.emit).toHaveBeenCalledWith('user:update', expect.objectContaining({
                success: true
            }));
        });

        test('should reject unauthorized updates', async () => {
            const handler = mockSocket.on.mock.calls.find(call => call[0] === 'user:update')[1];
            await handler({ 
                userId: 2, 
                updates: { username: 'newname' } 
            });

            expect(mockSocket.emit).toHaveBeenCalledWith('user:update', expect.objectContaining({
                success: false,
                message: 'Unauthorized'
            }));
        });
    });

    describe('user:getStats', () => {
        test('should return user statistics', async () => {
            const mockStats = {
                uploadCount: 10,
                totalListens: 500,
                topSongs: [{ id: 1, title: 'Popular Song', listens: 50 }]
            };

            database.query
                .mockResolvedValueOnce([[{ uploadCount: 10 }]])
                .mockResolvedValueOnce([[{ totalListens: 500 }]])
                .mockResolvedValueOnce([mockStats.topSongs]);

            const handler = mockSocket.on.mock.calls.find(call => call[0] === 'user:getStats')[1];
            await handler({ userId: 1 });

            expect(mockSocket.emit).toHaveBeenCalledWith('user:getStats', expect.objectContaining({
                success: true,
                stats: expect.objectContaining({
                    uploadCount: expect.any(Number),
                    totalListens: expect.any(Number)
                })
            }));
        });
    });

    describe('Error Handling', () => {
        test('should handle database errors gracefully', async () => {
            database.query.mockRejectedValueOnce(new Error('Database error'));

            const handler = mockSocket.on.mock.calls.find(call => call[0] === 'user:profile')[1];
            await handler({ userId: 1 });

            expect(mockSocket.emit).toHaveBeenCalledWith('user:profile', expect.objectContaining({
                success: false,
                message: expect.any(String)
            }));
        });

        test('should validate required parameters', async () => {
            const handler = mockSocket.on.mock.calls.find(call => call[0] === 'user:profile')[1];
            await handler({});

            expect(mockSocket.emit).toHaveBeenCalledWith('user:profile', expect.objectContaining({
                success: false,
                message: 'User ID required'
            }));
        });
    });
});