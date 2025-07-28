/**
 * Test Database Mock
 */

const mockDatabase = {
    query: jest.fn(),
    execute: jest.fn(),
    end: jest.fn(),
    createConnection: jest.fn(() => mockDatabase),
    createPool: jest.fn(() => mockDatabase)
};

// Default successful responses - return empty arrays in the expected format
mockDatabase.query.mockResolvedValue([[], {}]);
mockDatabase.execute.mockResolvedValue([[], {}]);

// Helper to set up specific mock responses
mockDatabase.mockQueryResult = (result) => {
    mockDatabase.query.mockResolvedValueOnce([result, {}]);
};

mockDatabase.mockQueryResults = (...results) => {
    results.forEach(result => {
        mockDatabase.query.mockResolvedValueOnce([result, {}]);
    });
};

module.exports = mockDatabase;