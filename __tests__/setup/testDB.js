const { Pool } = require('pg');
require('dotenv').config();

// Use separate test database configuration
const testPool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'todo_db_test',
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Setup test database schema
const setupTestDB = async () => {
  try {
    await testPool.query(`
      DROP TABLE IF EXISTS todos CASCADE;
      
      CREATE TABLE todos (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        completed BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = CURRENT_TIMESTAMP;
          RETURN NEW;
      END;
      $$ language 'plpgsql';

      DROP TRIGGER IF EXISTS update_todos_updated_at ON todos;
      
      CREATE TRIGGER update_todos_updated_at 
          BEFORE UPDATE ON todos 
          FOR EACH ROW 
          EXECUTE FUNCTION update_updated_at_column();
    `);
    // console.log('✓ Test database schema created'); // Suppressed for cleaner test output
  } catch (error) {
    console.error('✗ Error setting up test database:', error.message);
    throw error;
  }
};

// Clean up test data between tests
const teardownTestDB = async () => {
  try {
    await testPool.query('TRUNCATE TABLE todos RESTART IDENTITY CASCADE');
  } catch (error) {
    console.error('Error cleaning up test database:', error);
    throw error;
  }
};

// Close pool connection
const closeTestDB = async () => {
  await testPool.end();
};

module.exports = {
  pool: testPool,
  setupTestDB,
  teardownTestDB,
  closeTestDB,
};
