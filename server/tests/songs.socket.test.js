/**
 * Songs Socket Handler Tests
 */

// Mock dependencies first
jest.mock('../database', () => require('./test-database'));
jest.mock('../services/songService');
jest.mock('../middleware/rateLimiter', () => jest.fn(() => true));

const songs = require('../songs');
const database = require('../database');
const songService = require('../services/songService');

describe('Songs Socket Handlers', () => {
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
        songs.handleSocket(mockSocket, mockIo);
    });

    describe('song:list', () => {
        test('should return paginated song list', async () => {
            const mockResult = {
                songs: [{ id: 1, title: 'Test Song', artist: 'Test Artist' }],
                total: 1,
                page: 1
            };

            songService.getSongs.mockResolvedValueOnce(mockResult);

            const handler = mockSocket.on.mock.calls.find(call => call[0] === 'song:list')[1];
            await handler({ filters: {}, page: 1, limit: 20 });

            expect(mockSocket.emit).toHaveBeenCalledWith('song:list', expect.objectContaining({
                success: true,
                data: expect.objectContaining({
                    items: mockResult.songs,
                    pagination: expect.objectContaining({
                        total: 1,
                        page: 1,
                        limit: 20,
                        totalPages: 1
                    })
                })
            }));
        });

        test('should handle search filters', async () => {
            const filters = { search: 'test', artist: 'Test Artist' };
            const mockResult = { songs: [], total: 0, page: 1 };

            songService.getSongs.mockResolvedValueOnce(mockResult);

            const handler = mockSocket.on.mock.calls.find(call => call[0] === 'song:list')[1];
            await handler({ filters, page: 1, limit: 20 });

            expect(songService.getSongs).toHaveBeenCalledWith(filters, 1, 20);
        });
    });

    describe('song:get', () => {
        test('should return song details', async () => {
            const mockSong = { id: 1, title: 'Test Song', artist: 'Test Artist' };
            
            songService.getSongById.mockResolvedValueOnce(mockSong);

            const handler = mockSocket.on.mock.calls.find(call => call[0] === 'song:get')[1];
            await handler({ songId: 1 });

            expect(mockSocket.emit).toHaveBeenCalledWith('song:get', expect.objectContaining({
                success: true,
                data: { song: mockSong }
            }));
        });

        test('should return error for non-existent song', async () => {
            songService.getSongById.mockResolvedValueOnce(null);

            const handler = mockSocket.on.mock.calls.find(call => call[0] === 'song:get')[1];
            await handler({ songId: 999 });

            expect(mockSocket.emit).toHaveBeenCalledWith('song:get', expect.objectContaining({
                success: false,
                error: expect.objectContaining({
                    message: 'Song not found'
                })
            }));
        });
    });

    describe('song:update', () => {
        test('should update song metadata', async () => {
            const updatedSong = { id: 1, title: 'Updated Song', artist: 'Updated Artist' };
            
            songService.updateSong.mockResolvedValueOnce(updatedSong);

            const handler = mockSocket.on.mock.calls.find(call => call[0] === 'song:update')[1];
            await handler({
                songId: 1,
                metadata: { title: 'Updated Song', artist: 'Updated Artist' }
            });

            expect(mockSocket.emit).toHaveBeenCalledWith('song:update', expect.objectContaining({
                success: true,
                data: { song: updatedSong }
            }));
        });

        test('should reject unauthorized updates', async () => {
            songService.updateSong.mockRejectedValueOnce(new Error('Unauthorized'));

            const handler = mockSocket.on.mock.calls.find(call => call[0] === 'song:update')[1];
            await handler({ songId: 1, metadata: {} });

            expect(mockSocket.emit).toHaveBeenCalledWith('song:update', expect.objectContaining({
                success: false,
                error: expect.objectContaining({
                    message: 'Unauthorized'
                })
            }));
        });

        test('should require authentication', async () => {
            mockSocket.authenticated = false;

            const handler = mockSocket.on.mock.calls.find(call => call[0] === 'song:update')[1];
            await handler({ songId: 1, metadata: {} });

            expect(mockSocket.emit).toHaveBeenCalledWith('song:update', expect.objectContaining({
                success: false,
                error: expect.objectContaining({
                    message: 'Authentication required'
                })
            }));
        });
    });

    describe('song:delete', () => {
        test('should delete song successfully', async () => {
            database.query
                .mockResolvedValueOnce([[{ uploaded_by: 1 }]]) // ownership check
                .mockResolvedValueOnce([{}]); // delete query

            const handler = mockSocket.on.mock.calls.find(call => call[0] === 'song:delete')[1];
            await handler({ songId: 1 });

            expect(mockSocket.emit).toHaveBeenCalledWith('song:delete', expect.objectContaining({
                success: true
            }));
        });

        test('should allow admin to delete any song', async () => {
            mockSocket.user.is_admin = true;
            database.query
                .mockResolvedValueOnce([[{ uploaded_by: 2 }]])
                .mockResolvedValueOnce([{}]);

            const handler = mockSocket.on.mock.calls.find(call => call[0] === 'song:delete')[1];
            await handler({ songId: 1 });

            expect(mockSocket.emit).toHaveBeenCalledWith('song:delete', expect.objectContaining({
                success: true
            }));
        });
    });

    describe('song:play', () => {
        test('should return song play URL', async () => {
            const mockSong = { id: 1, title: 'Test Song', file_path: '/path/to/song.mp3' };
            
            database.query.mockResolvedValueOnce([[mockSong]]);

            const handler = mockSocket.on.mock.calls.find(call => call[0] === 'song:play')[1];
            await handler({ songId: 1 });

            expect(mockSocket.emit).toHaveBeenCalledWith('song:play', expect.objectContaining({
                url: expect.any(String),
                metadata: expect.objectContaining({
                    id: 1,
                    title: 'Test Song'
                })
            }));
        });

        test('should return error for non-existent song', async () => {
            database.query.mockResolvedValueOnce([[]]);

            const handler = mockSocket.on.mock.calls.find(call => call[0] === 'song:play')[1];
            await handler({ songId: 999 });

            expect(mockSocket.emit).toHaveBeenCalledWith('song:play', expect.objectContaining({
                error: true,
                message: 'Song not found'
            }));
        });
    });

    describe('song:recordListen', () => {
        test('should record listen successfully', async () => {
            database.query.mockResolvedValueOnce([{}]);

            const handler = mockSocket.on.mock.calls.find(call => call[0] === 'song:recordListen')[1];
            await handler({ songId: 1 });

            expect(mockSocket.emit).toHaveBeenCalledWith('song:recordListen', expect.objectContaining({
                success: true
            }));
        });

        test('should handle anonymous listens', async () => {
            mockSocket.authenticated = false;
            mockSocket.user = null;
            database.query.mockResolvedValueOnce([{}]);

            const handler = mockSocket.on.mock.calls.find(call => call[0] === 'song:recordListen')[1];
            await handler({ songId: 1 });

            expect(mockSocket.emit).toHaveBeenCalledWith('song:recordListen', expect.objectContaining({
                success: true
            }));
        });
    });

    describe('Error Handling', () => {
        test('should handle database errors gracefully', async () => {
            songService.getSongs.mockRejectedValueOnce(new Error('Database error'));

            const handler = mockSocket.on.mock.calls.find(call => call[0] === 'song:list')[1];
            await handler({ filters: {}, page: 1, limit: 20 });

            expect(mockSocket.emit).toHaveBeenCalledWith('song:list', expect.objectContaining({
                success: false,
                error: expect.objectContaining({
                    message: 'Failed to get songs'
                })
            }));
        });

        test('should validate required parameters', async () => {
            const handler = mockSocket.on.mock.calls.find(call => call[0] === 'song:get')[1];
            await handler({});

            expect(mockSocket.emit).toHaveBeenCalledWith('song:get', expect.objectContaining({
                success: false,
                error: expect.objectContaining({
                    message: 'Song ID required'
                })
            }));
        });
    });
});