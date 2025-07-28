/**
 * Test Environment Setup
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DB_HOST = 'localhost';
process.env.DB_USER = 'root';
process.env.DB_PASSWORD = 'test';
process.env.DB_NAME = 'musiclib_test';
process.env.JWT_SECRET = 'test_secret_key_for_testing';
process.env.LOG_LEVEL = 'ERROR';

// Mock AWS SDK to prevent real AWS calls
jest.mock('@aws-sdk/client-s3', () => ({
    S3Client: jest.fn(() => ({
        send: jest.fn()
    })),
    PutObjectCommand: jest.fn(),
    GetObjectCommand: jest.fn(),
    DeleteObjectCommand: jest.fn()
}));