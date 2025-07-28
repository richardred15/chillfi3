module.exports = {
    testEnvironment: 'node',
    testMatch: [
        '**/tests/**/*.test.js'
    ],
    collectCoverageFrom: [
        '**/*.js',
        '!**/node_modules/**',
        '!**/coverage/**',
        '!**/tests/**',
        '!jest.config.js',
        '!.eslintrc.js'
    ],
    coverageReporters: [
        'text',
        'lcov',
        'html'
    ],
    coverageThreshold: {
        global: {
            branches: 5,
            functions: 4,
            lines: 5,
            statements: 5
        }
    },
    setupFilesAfterEnv: ['<rootDir>/tests/client-setup.js'],
    testTimeout: 10000
};