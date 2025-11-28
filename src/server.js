require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs').promises;

// Import middleware
const logger = require('./utils/logger');
const { cors, helmet, sanitizeInput } = require('./middleware/security');
const {
  globalErrorHandler,
  notFoundHandler,
  handleUnhandledRejection,
  handleUncaughtException
} = require('./middleware/errorHandler');

// Import routes
const authRoutes = require('./routes/auth');
const applicationRoutes = require('./routes/applications');
const imageRoutes = require('./routes/images');

// Handle uncaught exceptions and unhandled rejections
handleUncaughtException();
handleUnhandledRejection();

const app = express();

// Trust proxy (for accurate IP addresses behind reverse proxy)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet);
app.use(cors);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Input sanitization
app.use(sanitizeInput);

// Request logging middleware (for development)
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`, {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      body: req.method === 'POST' ? req.body : undefined
    });
    next();
  });
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/images', imageRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Multi-Tenant Secure Image Service API',
    version: '2.0.0',
    documentation: '/api/docs',
    architecture: 'Application-based multi-tenant',
    endpoints: {
      auth: '/api/auth (Legacy - User-based)',
      applications: '/api/applications (Application Management)',
      images: '/api/images (Image Operations - Application-based)',
      health: '/health'
    },
    gettingStarted: {
      step1: 'Register your application at POST /api/applications/register',
      step2: 'Authenticate with API key and secret at POST /api/applications/authenticate',
      step3: 'Use the access token for image operations',
      step4: 'Upload images with POST /api/images/upload'
    }
  });
});

// Handle undefined routes
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(globalErrorHandler);

// Database connection
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/image-service';
    
    await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    logger.info('MongoDB connected successfully', {
      host: mongoose.connection.host,
      database: mongoose.connection.name
    });

    // Create upload directory if it doesn't exist (for local storage)
    if (process.env.STORAGE_TYPE !== 's3') {
      const uploadDir = process.env.UPLOAD_DIR || './uploads';
      await fs.mkdir(uploadDir, { recursive: true });
      logger.info('Upload directory ensured:', { path: uploadDir });
    }

    // Create logs directory
    const logsDir = './logs';
    await fs.mkdir(logsDir, { recursive: true });
    logger.info('Logs directory ensured:', { path: logsDir });

  } catch (error) {
    logger.error('Database connection failed:', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
};

// Graceful shutdown
const gracefulShutdown = (signal) => {
  logger.info(`${signal} signal received: closing HTTP server`);
  
  server.close(() => {
    logger.info('HTTP server closed');
    
    // Close database connection
    mongoose.connection.close(false, () => {
      logger.info('MongoDB connection closed');
      process.exit(0);
    });
  });

  // Force close server after 30 seconds
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 30000);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const PORT = process.env.PORT || 3000;
let server;

const startServer = async () => {
  try {
    // Connect to database first
    await connectDB();

    // Start the server
    server = app.listen(PORT, () => {
      logger.info('Server started successfully', {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        nodeVersion: process.version,
        storageType: process.env.STORAGE_TYPE || 'local'
      });

      // Log important configuration
      logger.info('Configuration:', {
        maxFileSize: `${(parseInt(process.env.MAX_FILE_SIZE) || 5242880) / 1024 / 1024}MB`,
        rateLimitWindow: `${parseInt(process.env.RATE_LIMIT_WINDOW_MS) / 1000 / 60}min`,
        rateLimitMax: process.env.RATE_LIMIT_MAX_REQUESTS || 100,
        jwtExpiry: process.env.JWT_EXPIRY || '24h'
      });
    });

    server.on('error', (error) => {
      if (error.syscall !== 'listen') {
        throw error;
      }

      const bind = typeof PORT === 'string' ? 'Pipe ' + PORT : 'Port ' + PORT;

      switch (error.code) {
        case 'EACCES':
          logger.error(`${bind} requires elevated privileges`);
          process.exit(1);
          break;
        case 'EADDRINUSE':
          logger.error(`${bind} is already in use`);
          process.exit(1);
          break;
        default:
          throw error;
      }
    });

  } catch (error) {
    logger.error('Failed to start server:', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
};

// Start the application
if (require.main === module) {
  startServer();
}

module.exports = app;
