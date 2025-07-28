# Testing Guide

Comprehensive testing setup for ChillFi3 with unit, integration, and client-side tests.

## Test Structure

```
server/tests/
├── auth.test.js          # Authentication & JWT tests
├── database.test.js      # Database & security tests  
├── api.test.js          # HTTP endpoint tests
├── integration.test.js   # Full workflow tests
├── songService.test.js   # Service layer tests
└── setup.js             # Jest configuration

client/tests/
├── auth.test.js         # Client auth component tests
└── ui.test.js           # UI component tests
```

## Running Tests

### Server Tests
```bash
cd server

# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run integration tests only
npm run test:integration

# Watch mode for development
npm run test:watch

# Run linting
npm run lint
```

### Client Tests
```bash
cd client

# Run client tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## Test Categories

### 1. Unit Tests
- **Authentication**: JWT token generation/verification, password hashing
- **Database**: Schema generation, query security validation
- **Services**: Song management, user operations
- **Utilities**: Helper functions, validation

### 2. Integration Tests
- **Full Workflows**: Login → upload → play sequences
- **Socket.IO**: Real-time communication testing
- **Database Integration**: End-to-end data flow
- **Error Handling**: Graceful failure scenarios

### 3. API Tests
- **HTTP Endpoints**: REST API functionality
- **OpenGraph**: Social sharing metadata
- **Rate Limiting**: Abuse prevention
- **Error Responses**: Proper error handling

### 4. Client Tests
- **UI Components**: DOM manipulation, event handling
- **Authentication**: Login modal, token management
- **Theme System**: CSS custom properties, class toggles
- **Responsive Design**: Mobile/desktop behavior

## Coverage Requirements

### Server Coverage Targets
- **Branches**: 70%
- **Functions**: 70%
- **Lines**: 70%
- **Statements**: 70%

### Key Areas Covered
- ✅ Authentication & authorization
- ✅ Database operations & security
- ✅ API endpoints & rate limiting
- ✅ Socket.IO real-time features
- ✅ File upload handling
- ✅ Error handling & validation

## CI/CD Integration

### GitHub Actions Pipeline
1. **Linting**: ESLint code quality checks
2. **Unit Tests**: Individual component testing
3. **Integration Tests**: Full workflow validation
4. **Client Tests**: Frontend component testing
5. **Coverage Reports**: Codecov integration
6. **Security Audit**: Vulnerability scanning

### Test Environment
- **Node.js**: 18+
- **Database**: MySQL 8.0 (test instance)
- **Mocking**: Jest mocks for external dependencies
- **DOM Testing**: JSDOM for client-side tests

## Writing Tests

### Test Structure
```javascript
describe('Component Name', () => {
    beforeEach(() => {
        // Setup before each test
        jest.clearAllMocks();
    });

    describe('Feature Group', () => {
        test('should do something specific', () => {
            // Arrange
            const input = 'test data';
            
            // Act
            const result = functionUnderTest(input);
            
            // Assert
            expect(result).toBe('expected output');
        });
    });
});
```

### Mocking Guidelines
- **Database**: Mock all database calls
- **External APIs**: Mock HTTP requests
- **File System**: Mock file operations
- **Time**: Mock Date.now() for consistent tests

### Best Practices
- **Descriptive Names**: Clear test descriptions
- **Single Responsibility**: One assertion per test
- **Isolation**: Tests don't depend on each other
- **Fast Execution**: Avoid real network/file operations
- **Edge Cases**: Test error conditions and boundaries

## Debugging Tests

### Common Issues
```bash
# Test timeout
jest.setTimeout(10000);

# Async operations
await expect(asyncFunction()).resolves.toBe(value);

# Mock not working
jest.clearAllMocks(); // in beforeEach

# Database connection
// Use test database, not production
```

### Debug Commands
```bash
# Run single test file
npm test auth.test.js

# Debug mode
node --inspect-brk node_modules/.bin/jest --runInBand

# Verbose output
npm test -- --verbose

# Watch specific file
npm run test:watch -- auth.test.js
```

## Performance Testing

### Load Testing (Future)
- **Artillery**: API endpoint load testing
- **Socket.IO Load**: Concurrent connection testing
- **Database Performance**: Query optimization validation

### Metrics to Monitor
- **Response Times**: API endpoint performance
- **Memory Usage**: Memory leak detection
- **Database Queries**: Query efficiency
- **File Upload**: Large file handling

## Security Testing

### Current Security Tests
- **SQL Injection**: Parameter validation
- **XSS Prevention**: Input sanitization
- **Authentication**: JWT security
- **Rate Limiting**: Abuse prevention

### Security Audit Tools
- **npm audit**: Dependency vulnerabilities
- **ESLint Security**: Code security rules
- **Trivy**: Container security scanning

## Continuous Improvement

### Test Metrics
- **Coverage Trends**: Track coverage over time
- **Test Performance**: Monitor test execution time
- **Flaky Tests**: Identify unreliable tests
- **Bug Detection**: Tests catching real issues

### Regular Maintenance
- **Update Dependencies**: Keep testing tools current
- **Review Coverage**: Identify untested code paths
- **Refactor Tests**: Improve test maintainability
- **Add Edge Cases**: Expand test scenarios

## Resources

- **Jest Documentation**: https://jestjs.io/docs/
- **Supertest Guide**: https://github.com/visionmedia/supertest
- **Socket.IO Testing**: https://socket.io/docs/v4/testing/
- **JSDOM Documentation**: https://github.com/jsdom/jsdom