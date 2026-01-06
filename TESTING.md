# Testing Documentation

This project includes comprehensive testing with both **unit tests** (mocked database) and **integration tests** (real database).

## Test Results Summary
- **Unit Tests**: 21 tests covering all CRUD operations with mocked database
- **Integration Tests**: 16 tests with real PostgreSQL database
- **Total**: 37 tests passing
- **Coverage**: 100% of API endpoints and business logic

## Test Types

### 1. Unit Tests (`__tests__/unit/`)
- Use mocked database connections (`jest.mock`)
- Fast execution (<100ms total)
- Test business logic in isolation
- No database required to run
- Mock pg Pool.query() responses

### 2. Integration Tests (`__tests__/integration/`)
- Use real PostgreSQL database (separate test database)
- Test actual database operations with connection pooling
- Verify end-to-end workflows
- Require PostgreSQL connection
- Automatic schema setup and cleanup

## Running Tests Locally

### Prerequisites
- Node.js installed
- PostgreSQL running (for integration tests)
- Environment variables configured in `.env`

### Run All Tests
```bash
npm test          # Runs both unit and integration tests (37 tests)
# or
npm run test:all
```

### Run Only Unit Tests
```bash
npm run test:unit    # Fast, no database needed (21 tests)
```

### Run Only Integration Tests
```bash
# Make sure PostgreSQL is running
npm run test:integration    # Requires database (16 tests)
```

### Run with Coverage
```bash
npm run test:coverage
```

### Watch Mode
```bash
npm run test:watch
```

## Running Tests with Docker PostgreSQL

Use the provided script to run tests with a temporary Docker container:

```bash
./run-tests.sh
```

This script will:
1. Start a PostgreSQL container
2. Run unit tests with mocked database
3. Run integration tests with real database
4. Clean up the container

## Jenkins CI/CD

The Jenkins pipeline automatically:
1. Checks out code
2. Installs dependencies
3. Starts a PostgreSQL Docker container
4. Runs unit tests (mocked DB)
5. Runs integration tests (real DB)
6. Generates coverage report
7. Cleans up the test container

### Environment Variables for Tests

Jenkins sets these automatically:
- `TEST_DB_HOST` - Database host (default: localhost)
- `TEST_DB_PORT` - Database port (default: 5433)
- `TEST_DB_USER` - Database user (default: testuser)
- `TEST_DB_PASSWORD` - Database password (default: testpass)
- `TEST_DB_NAME` - Database name (default: todo_db_test)

## Test Structure

```
backend/
├── __tests__/
│   ├── unit/
│   │   └── todos.test.js          # Unit tests with mocked DB
│   ├── integration/
│   │   └── todos.integration.test.js  # Integration tests with real DB
│   └── setup/
│       └── testDB.js              # Test database setup utilities
├── run-tests.sh                   # Script to run tests with Docker
└── Jenkinsfile                    # CI/CD pipeline configuration
```

## Test Coverage

Current coverage: **100%**
- 21 unit tests
- 14 integration tests

## Writing New Tests

### Unit Test Example
```javascript
// Mock the database
jest.mock('../db', () => ({
  query: jest.fn(),
}));

it('should create a todo', async () => {
  pool.query.mockResolvedValue({ rows: [{ id: 1, title: 'Test' }] });
  
  const response = await request(app)
    .post('/api/todos')
    .send({ title: 'Test' });
    
  expect(response.status).toBe(201);
});
```

### Integration Test Example
```javascript
const { pool } = require('../setup/testDB');

it('should create and retrieve a todo', async () => {
  // Create via API
  const createResponse = await request(app)
    .post('/api/todos')
    .send({ title: 'Test Todo' });
  
  // Verify in database
  const dbResult = await pool.query('SELECT * FROM todos WHERE id = $1', [createResponse.body.id]);
  expect(dbResult.rows[0].title).toBe('Test Todo');
});
```

## Troubleshooting

### Integration Tests Fail
- Ensure PostgreSQL is running
- Check database credentials in `.env`
- Verify test database exists

### Docker Container Issues
- Check Docker is running
- Ensure port 5433 is not in use
- Check Docker logs: `docker logs test-postgres`

### Permission Issues
- Make run-tests.sh executable: `chmod +x run-tests.sh`
- Ensure Docker daemon is accessible
