/**
 * API Endpoint Tests
 */
const request = require('supertest');

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
    }
}));

const { app } = require('../server');

// Mock database
jest.mock('../database', () => ({
    init: jest.fn().mockResolvedValue({}),
    query: jest.fn(),
    cleanup: jest.fn()
}));
const database = require('../database');

describe('API Endpoints', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Health Check', () => {
        test('GET /api/health should return 200', async () => {
            const response = await request(app)
                .get('/api/health')
                .expect(200);

            expect(response.body.status).toBe('ok');
            expect(response.body.timestamp).toBeDefined();
        });
    });

    describe('OpenGraph Endpoints', () => {
        test('GET /api/og/song/:id should return song metadata', async () => {
            const mockSong = {
                title: 'Test Song',
                artist: 'Test Artist',
                album: 'Test Album',
                cover_art_url: 'http://example.com/art.jpg'
            };

            database.query.mockResolvedValue([mockSong]);

            const response = await request(app)
                .get('/api/og/song/1')
                .expect(200);

            expect(response.body.title).toBe('Test Song');
            expect(response.body.artist).toBe('Test Artist');
            expect(response.body.album).toBe('Test Album');
            expect(response.body.image).toBe('http://example.com/art.jpg');
        });

        test('GET /api/og/song/:id should return 404 for non-existent song', async () => {
            database.query.mockResolvedValue([]);

            await request(app)
                .get('/api/og/song/999')
                .expect(404);
        });

        test('GET /api/og/album should return album metadata', async () => {
            const mockAlbum = {
                album: 'Test Album',
                artist: 'Test Artist',
                cover_art_url: 'http://example.com/art.jpg',
                song_count: 10
            };

            database.query.mockResolvedValue([mockAlbum]);

            const response = await request(app)
                .get('/api/og/album?name=Test Album&artist=Test Artist')
                .expect(200);

            expect(response.body.album).toBe('Test Album');
            expect(response.body.songCount).toBe(10);
        });

        test('GET /api/og/library/:username should return library metadata', async () => {
            const mockLibrary = {
                song_count: 50,
                album_count: 5,
                cover_art_url: 'http://example.com/art.jpg'
            };

            database.query.mockResolvedValue([mockLibrary]);

            const response = await request(app)
                .get('/api/og/library/testuser')
                .expect(200);

            expect(response.body.username).toBe('testuser');
            expect(response.body.songCount).toBe(50);
            expect(response.body.albumCount).toBe(5);
        });

        test('GET /api/og/artist/:name should return artist metadata', async () => {
            const mockArtist = {
                song_count: 25,
                album_count: 3,
                cover_art_url: 'http://example.com/art.jpg'
            };

            database.query.mockResolvedValue([mockArtist]);

            const response = await request(app)
                .get('/api/og/artist/Test Artist')
                .expect(200);

            expect(response.body.artist).toBe('Test Artist');
            expect(response.body.songCount).toBe(25);
            expect(response.body.albumCount).toBe(3);
        });
    });

    describe('Rate Limiting', () => {
        test('should apply rate limiting to OG endpoints', async () => {
            database.query.mockResolvedValue([{
                title: 'Test',
                artist: 'Test',
                album: 'Test',
                cover_art_url: null
            }]);

            // Make multiple requests quickly
            const requests = Array(65).fill().map(() => 
                request(app).get('/api/og/song/1')
            );

            const responses = await Promise.all(requests);
            const rateLimited = responses.some(res => res.status === 429);
            
            expect(rateLimited).toBe(true);
        });
    });

    describe('Error Handling', () => {
        test('should handle database errors gracefully', async () => {
            database.query.mockRejectedValue(new Error('Database error'));

            const response = await request(app)
                .get('/api/og/song/1')
                .expect(500);

            expect(response.body.error).toBe('Failed to get song');
        });
    });
});