require('dotenv').config();
const app = require('./app');
const { checkDatabaseConnection, closePool } = require('./db');

const PORT = process.env.PORT || 3001;

let server;

// Graceful startup with DB check
const startServer = async () => {
  try {
    // Check database connectivity on startup (but don't fail if it's not ready)
    console.log('🔍 Checking database connectivity...');
    const isConnected = await checkDatabaseConnection();
    
    if (isConnected) {
      console.log('✓ Database is ready');
    } else {
      console.warn('⚠️  Database not ready yet - will retry on requests');
      console.warn('⚠️  App will still start and accept health checks');
    }
    
    // Start server regardless of DB status
    server = app.listen(PORT, () => {
      console.log(`✓ Server is running on port ${PORT}`);
      console.log(`✓ Health check: http://localhost:${PORT}/api/health`);
      console.log(`✓ Liveness probe: http://localhost:${PORT}/api/live`);
      console.log(`✓ Readiness probe: http://localhost:${PORT}/api/ready`);
      console.log('✓ Press Ctrl+C to stop the server');
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`✗ Port ${PORT} is already in use`);
      } else {
        console.error('✗ Server error:', error);
      }
      process.exit(1);
    });

  } catch (error) {
    console.error('✗ Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} signal received: starting graceful shutdown`);
  
  if (server) {
    server.close(async () => {
      console.log('✓ HTTP server closed');
      
      // Close database connections
      await closePool();
      
      console.log('✓ Graceful shutdown completed');
      process.exit(0);
    });

    // Force shutdown after 30 seconds
    setTimeout(() => {
      console.error('⚠️  Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  } else {
    await closePool();
    process.exit(0);
  }
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors - log but don't crash immediately
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  // In production, you might want to exit here, but give time for logging
  setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
  // Don't exit - log and continue
});

// Start the server
startServer();
