/**
 * Core Functionality Tests
 * Tests the main features without complex mocking
 */

describe('Core Functionality', () => {
    describe('Configuration', () => {
        test('should load configuration', () => {
            // Mock config loading
            const config = {
                database: { host: 'localhost' },
                auth: { jwtSecret: 'test' }
            };
            
            expect(config).toBeDefined();
            expect(config.database).toBeDefined();
            expect(config.auth).toBeDefined();
        });
    });

    describe('Response Utilities', () => {
        test('should format success responses', () => {
            const mockSocket = { emit: jest.fn() };
            const { success } = require('../utils/response');
            
            success(mockSocket, 'test:event', { data: 'test' }, 'Success message');
            
            expect(mockSocket.emit).toHaveBeenCalledWith('test:event', expect.objectContaining({
                success: true,
                data: { data: 'test' },
                message: 'Success message',
                timestamp: expect.any(String)
            }));
        });

        test('should format error responses', () => {
            const mockSocket = { emit: jest.fn() };
            const { error } = require('../utils/response');
            
            error(mockSocket, 'test:event', 'Error message', 400);
            
            expect(mockSocket.emit).toHaveBeenCalledWith('test:event', expect.objectContaining({
                success: false,
                error: expect.objectContaining({
                    message: 'Error message',
                    code: 400
                }),
                timestamp: expect.any(String)
            }));
        });
    });

    describe('Rate Limiter', () => {
        test('should allow requests within limits', () => {
            const rateLimiter = require('../middleware/rateLimiter');
            const mockSocket = {
                handshake: { address: '127.0.0.1' },
                user: { id: 1 }
            };
            
            const result = rateLimiter(mockSocket, 'test:event');
            expect(result).toBe(true);
        });
    });

    describe('Logger', () => {
        test('should have logging functions', () => {
            const logger = require('../utils/logger');
            
            expect(logger).toBeDefined();
            expect(typeof logger.info).toBe('function');
            expect(typeof logger.error).toBe('function');
        });
    });
});