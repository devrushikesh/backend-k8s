require('dotenv').config();
const app = require('./app');
const pool = require('./db');

const PORT = process.env.PORT || 3001;

// Test database connection on startup
const testDatabaseConnection = async () => {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('✓ Database connected successfully at:', result.rows[0].now);
  } catch (error) {
    console.error('✗ Database connection failed:', error.message);
    console.error('Please check your database credentials in .env file');
    process.exit(1);
  }
};

// Start server
const startServer = async () => {
  await testDatabaseConnection();
  
  const server = app.listen(PORT, () => {
    console.log(`✓ Server is running on port ${PORT}`);
    console.log(`✓ API available at http://localhost:${PORT}/api`);
    console.log(`✓ Press Ctrl+C to stop the server`);
  });

  // Keep the server running
  server.on('error', (error) => {
    console.error('Server error:', error);
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
      console.log('HTTP server closed');
      pool.end();
    });
  });

  process.on('SIGINT', () => {
    console.log('\nSIGINT signal received: closing HTTP server');
    server.close(() => {
      console.log('HTTP server closed');
      pool.end();
      process.exit(0);
    });
  });
};

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

startServer();
