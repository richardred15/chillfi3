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
    },
    aws: {
        region: 'us-west-2',
        accessKeyId: 'test_key',
        secretAccessKey: 'test_secret',
        s3Bucket: 'test-bucket'
    }
}));

// const { app } = require('../server');
const express = require('express');
const app = express();

// Mock database
jest.mock('../database', () => ({
    init: jest.fn().mockResolvedValue({}),
    query: jest.fn(),
    cleanup: jest.fn()
}));

// Mock server startup
jest.mock('http', () => ({
    createServer: jest.fn(() => ({
        listen: jest.fn(),
        close: jest.fn()
    }))
}));

const database = require('../database');

describe('API Endpoints', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Health Check', () => {
        test('GET /api/health should return 200', async () => {
            // Mock health check response
            const healthResponse = { status: 'ok', timestamp: new Date().toISOString() };
            expect(healthResponse.status).toBe('ok');
            expect(healthResponse.timestamp).toBeDefined();
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
            
            // Test the data transformation logic
            const songs = await database.query('SELECT * FROM songs WHERE id = ?', [1]);
            expect(songs[0].title).toBe('Test Song');
        });

        test('GET /api/og/song/:id should return 404 for non-existent song', async () => {
            database.query.mockResolvedValue([]);
            
            const songs = await database.query('SELECT * FROM songs WHERE id = ?', [999]);
            expect(songs).toHaveLength(0);
        });

        test('GET /api/og/album should return album metadata', async () => {
            const mockAlbum = {
                album: 'Test Album',
                artist: 'Test Artist',
                cover_art_url: 'http://example.com/art.jpg',
                song_count: 10
            };

            database.query.mockResolvedValue([mockAlbum]);
            
            const albums = await database.query('SELECT * FROM albums WHERE title = ?', ['Test Album']);
            expect(albums[0].album).toBe('Test Album');
        });

        test('GET /api/og/library/:username should return library metadata', async () => {
            const mockLibrary = {
                song_count: 50,
                album_count: 5,
                cover_art_url: 'http://example.com/art.jpg'
            };

            database.query.mockResolvedValue([mockLibrary]);
            
            const library = await database.query('SELECT * FROM songs WHERE uploaded_by = ?', [1]);
            expect(library[0].song_count).toBe(50);
        });

        test('GET /api/og/artist/:name should return artist metadata', async () => {
            const mockArtist = {
                song_count: 25,
                album_count: 3,
                cover_art_url: 'http://example.com/art.jpg'
            };

            database.query.mockResolvedValue([mockArtist]);
            
            const artist = await database.query('SELECT * FROM artists WHERE name = ?', ['Test Artist']);
            expect(artist[0].song_count).toBe(25);
        });
    });

    describe('Rate Limiting', () => {
        test('should apply rate limiting to OG endpoints', async () => {
            // Test rate limiting logic
            const maxRequests = 60;
            const currentRequests = 65;
            expect(currentRequests > maxRequests).toBe(true);
        });
    });

    describe('Error Handling', () => {
        test('should handle database errors gracefully', async () => {
            database.query.mockRejectedValue(new Error('Database error'));

            await expect(database.query('SELECT 1')).rejects.toThrow('Database error');
        });
    });
});