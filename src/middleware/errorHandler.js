const logger = require('../utils/logger');

// Custom error class
class AppError extends Error {
  constructor(message, statusCode, code = null) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    this.code = code;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Handle cast errors (invalid MongoDB ObjectId)
const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400);
};

// Handle duplicate field errors
const handleDuplicateFieldsDB = (err) => {
  const field = Object.keys(err.keyValue)[0];
  const message = `${field} already exists. Please use another value.`;
  return new AppError(message, 400);
};

// Handle validation errors
const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map(el => el.message);
  const message = `Invalid input data. ${errors.join('. ')}`;
  return new AppError(message, 400);
};

// Handle JWT errors
const handleJWTError = () =>
  new AppError('Invalid token. Please log in again!', 401);

const handleJWTExpiredError = () =>
  new AppError('Your token has expired! Please log in again.', 401);

// Send error response for development
const sendErrorDev = (err, res) => {
  logger.error('Development Error:', {
    error: err.message,
    stack: err.stack,
    statusCode: err.statusCode
  });

  res.status(err.statusCode || 500).json({
    success: false,
    error: err.message,
    stack: err.stack,
    details: err
  });
};

// Send error response for production
const sendErrorProd = (err, res) => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    logger.error('Operational Error:', {
      error: err.message,
      statusCode: err.statusCode,
      code: err.code
    });

    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code
    });
  } else {
    // Programming or other unknown error: don't leak error details
    logger.error('Programming Error:', {
      error: err.message,
      stack: err.stack
    });

    res.status(500).json({
      success: false,
      error: 'Something went wrong!',
      code: 'INTERNAL_ERROR'
    });
  }
};

// Global error handler middleware
const globalErrorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Log the error with request context
  logger.error('Global Error Handler:', {
    error: err.message,
    statusCode: err.statusCode,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.userId || 'anonymous',
    stack: err.stack
  });

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, res);
  } else {
    let error = { ...err };
    error.message = err.message;

    // Handle specific error types
    if (error.name === 'CastError') error = handleCastErrorDB(error);
    if (error.code === 11000) error = handleDuplicateFieldsDB(error);
    if (error.name === 'ValidationError') error = handleValidationErrorDB(error);
    if (error.name === 'JsonWebTokenError') error = handleJWTError();
    if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();

    sendErrorProd(error, res);
  }
};

// Handle unhandled promise rejections
const handleUnhandledRejection = () => {
  process.on('unhandledRejection', (err, promise) => {
    logger.error('Unhandled Promise Rejection:', {
      error: err.message,
      stack: err.stack,
      promise
    });

    // Close server gracefully
    process.exit(1);
  });
};

// Handle uncaught exceptions
const handleUncaughtException = () => {
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception:', {
      error: err.message,
      stack: err.stack
    });

    // Close process immediately
    process.exit(1);
  });
};

// 404 handler for undefined routes
const notFoundHandler = (req, res, next) => {
  const err = new AppError(`Can't find ${req.originalUrl} on this server!`, 404);
  next(err);
};

// Async error wrapper
const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};

// Validation error handler
const validationErrorHandler = (req, res, next) => {
  const { error } = req.validationResult || {};
  
  if (error) {
    const message = error.details.map(detail => detail.message).join(', ');
    return next(new AppError(message, 400, 'VALIDATION_ERROR'));
  }
  
  next();
};

module.exports = {
  AppError,
  globalErrorHandler,
  notFoundHandler,
  catchAsync,
  validationErrorHandler,
  handleUnhandledRejection,
  handleUncaughtException
};
