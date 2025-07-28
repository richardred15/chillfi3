/**
 * Song Service Tests
 */
const songService = require('../services/songService');

// Mock database
jest.mock('../database', () => ({
    query: jest.fn()
}));

const database = require('../database');

describe('SongService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    
    describe('getSongs', () => {
        it('should return songs with pagination', async () => {
            const mockSongs = [
                { id: 1, title: 'Test Song', artist: 'Test Artist' }
            ];
            const mockCount = [{ count: 1 }];
            
            database.query
                .mockResolvedValueOnce(mockSongs)
                .mockResolvedValueOnce(mockCount);
            
            const result = await songService.getSongs({}, 1, 20);
            
            expect(result.songs).toEqual(mockSongs);
            expect(result.total).toBe(1);
            expect(result.page).toBe(1);
        });
        
        it('should handle search filters', async () => {
            const filters = { search: 'test' };
            
            database.query
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([{ count: 0 }]);
            
            await songService.getSongs(filters, 1, 20);
            
            expect(database.query).toHaveBeenCalledWith(
                expect.stringContaining('LIKE'),
                expect.arrayContaining(['%test%'])
            );
        });
    });
    
    describe('getSongById', () => {
        it('should return song when found', async () => {
            const mockSong = { id: 1, title: 'Test Song' };
            database.query.mockResolvedValue([mockSong]);
            
            const result = await songService.getSongById(1);
            
            expect(result).toEqual(mockSong);
        });
        
        it('should return null when not found', async () => {
            database.query.mockResolvedValue([]);
            
            const result = await songService.getSongById(999);
            
            expect(result).toBeNull();
        });
    });
    
    describe('updateSong', () => {
        it('should throw error for unauthorized user', async () => {
            database.query.mockResolvedValue([{ uploaded_by: 2 }]);
            
            await expect(
                songService.updateSong(1, {}, 1, false)
            ).rejects.toThrow('Unauthorized');
        });
        
        it('should allow admin to update any song', async () => {
            database.query
                .mockResolvedValueOnce([{ uploaded_by: 2 }])
                .mockResolvedValueOnce({})
                .mockResolvedValueOnce([{ id: 1, title: 'Updated' }]);
            
            const result = await songService.updateSong(1, { title: 'Updated' }, 1, true);
            
            expect(result.title).toBe('Updated');
        });
    });
});