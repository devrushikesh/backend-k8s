const { Pool } = require('pg');
const isTestEnv = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;
require('dotenv').config();

// Database configuration with connection pool settings
const poolConfig = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  // Connection pool settings
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 5000, // Return error after 5 seconds if connection not established
  // Retry configuration
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
};

const pool = new Pool(poolConfig);

// Handle pool errors gracefully - don't crash the application
pool.on('error', (err, client) => {
  // Log the error but don't exit - let Kubernetes handle it via health checks
  console.error('Unexpected error on idle client:', err.message);
  console.error('Stack:', err.stack);
  // Client will be removed from pool automatically
});

// Handle client connection events (only log in non-test environment)
if (!isTestEnv) {
  pool.on('connect', (client) => {
    console.log('New client connected to database');
  });

  pool.on('acquire', (client) => {
    console.log('Client acquired from pool');
  });

  pool.on('remove', (client) => {
    console.log('Client removed from pool');
  });
}

// Function to check database connectivity
const checkDatabaseConnection = async () => {
  let client;
  try {
    client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    console.log('✓ Database connection verified at:', result.rows[0].now);
    return true;
  } catch (error) {
    console.error('✗ Database connection failed:', error.message);
    return false;
  } finally {
    if (client) {
      client.release();
    }
  }
};

// Function to execute queries with retry logic
const queryWithRetry = async (text, params, maxRetries = 3) => {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await pool.query(text, params);
      return result;
    } catch (error) {
      lastError = error;
      console.error(`Query attempt ${attempt}/${maxRetries} failed:`, error.message);
      
      // If it's a connection error and we have retries left, wait and retry
      if (attempt < maxRetries && isRetryableError(error)) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff, max 5s
        console.log(`Retrying after ${delay}ms...`);
        await sleep(delay);
      } else {
        throw error;
      }
    }
  }
  
  throw lastError;
};

// Check if error is retryable
const isRetryableError = (error) => {
  const retryableCodes = [
    'ECONNREFUSED',
    'ENOTFOUND',
    'ETIMEDOUT',
    'ECONNRESET',
    '57P03', // cannot_connect_now
    '08006', // connection_failure
    '08003', // connection_does_not_exist
  ];
  
  return retryableCodes.some(code => 
    error.code === code || error.message.includes(code)
  );
};

// Helper function for delays
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Initialize database schema - create tables if they don't exist
const initializeDatabase = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS todos (
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
    
    if (!isTestEnv) {
      console.log('✓ Database schema initialized successfully');
    }
    return true;
  } catch (error) {
    console.error('✗ Error initializing database schema:', error.message);
    return false;
  }
};

// Graceful shutdown
const closePool = async () => {
  try {
    await pool.end();
    if (!isTestEnv) {
      console.log('Database pool closed');
    }
  } catch (error) {
    console.error('Error closing database pool:', error);
  }
};

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
  queryWithRetry,
  checkDatabaseConnection,
  initializeDatabase,
  closePool,
};
