const { Pool } = require('pg');
require('dotenv').config();

// Use separate test database configuration
const pool = new Pool({
  host: process.env.TEST_DB_HOST || process.env.DB_HOST || 'localhost',
  port: process.env.TEST_DB_PORT || process.env.DB_PORT || 5432,
  user: process.env.TEST_DB_USER || process.env.DB_USER || 'postgres',
  password: process.env.TEST_DB_PASSWORD || process.env.DB_PASSWORD || 'postgres',
  database: process.env.TEST_DB_NAME || process.env.DB_NAME_TEST || 'todo_db_test',
});

// Setup test database
const setupTestDB = async () => {
  try {
    // Drop and recreate table for clean state
    await pool.query(`
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
    console.log('✓ Test database setup complete');
  } catch (error) {
    console.error('✗ Error setting up test database:', error.message);
    throw error;
  }
};

// Clean up test database
const teardownTestDB = async () => {
  try {
    await pool.query('TRUNCATE TABLE todos RESTART IDENTITY CASCADE');
  } catch (error) {
    console.error('Error cleaning up test database:', error);
    throw error;
  }
};

// Close pool connection
const closeTestDB = async () => {
  await pool.end();
};

module.exports = {
  pool,
  setupTestDB,
  teardownTestDB,
  closeTestDB,
};
