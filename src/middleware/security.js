const rateLimit = require('express-rate-limit');
const cors = require('cors');
const helmet = require('helmet');
const { body, param, query, validationResult } = require('express-validator');
const logger = require('../utils/logger');

// Rate limiting configuration
const createRateLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs: windowMs || parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
    max: max || parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: {
      success: false,
      error: message || 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      logger.warn('Rate limit exceeded:', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path
      });
      
      res.status(429).json({
        success: false,
        error: 'Too many requests from this IP, please try again later.'
      });
    }
  });
};

// Different rate limits for different operations
const uploadRateLimit = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  10, // 10 uploads per 15 minutes
  'Too many upload attempts, please try again later.'
);

const generalRateLimit = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  100, // 100 requests per 15 minutes
  'Too many requests, please try again later.'
);

const authRateLimit = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  5, // 5 login attempts per 15 minutes
  'Too many authentication attempts, please try again later.'
);

// CORS configuration
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = process.env.CORS_ORIGIN 
      ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
      : ['http://localhost:3000', 'http://localhost:3001'];
    
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      logger.warn('CORS blocked request from:', { origin });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 86400 // 24 hours
};

// Helmet security headers configuration
const helmetConfig = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false // Allows image uploads
};

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    logger.warn('Validation errors:', {
      errors: errors.array(),
      path: req.path,
      ip: req.ip
    });
    
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array().map(err => ({
        field: err.path || err.param,
        message: err.msg,
        value: err.value
      }))
    });
  }
  
  next();
};

// Common validation rules
const validateImageId = [
  param('imageId')
    .isUUID(4)
    .withMessage('Invalid image ID format'),
  handleValidationErrors
];

const validateEntityParams = [
  body('entityId')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Entity ID must be between 1 and 100 characters')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Entity ID can only contain alphanumeric characters, hyphens, and underscores'),
  
  body('entityType')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('Entity type must be between 1 and 50 characters')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Entity type can only contain alphanumeric characters, hyphens, and underscores'),
  
  handleValidationErrors
];

const validateUserRegistration = [
  body('username')
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('Username can only contain letters, numbers, hyphens, and underscores'),
  
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'),
  
  handleValidationErrors
];

const validateUserLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  
  handleValidationErrors
];

const validatePaginationQuery = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  handleValidationErrors
];

// Security middleware to sanitize user input
const sanitizeInput = (req, res, next) => {
  // Remove any potential XSS attempts from request body
  if (req.body) {
    for (const key in req.body) {
      if (typeof req.body[key] === 'string') {
        // Basic XSS prevention - remove script tags and javascript: protocols
        req.body[key] = req.body[key]
          .replace(/<script[^>]*>.*?<\/script>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=/gi, '');
      }
    }
  }
  
  next();
};

// CSRF protection for state-changing operations
const csrfProtection = (req, res, next) => {
  // Skip CSRF for API requests with valid JWT tokens
  if (req.headers.authorization) {
    return next();
  }
  
  // For browser requests, check for CSRF token in header
  const csrfToken = req.headers['x-csrf-token'] || req.body._token;
  
  if (['POST', 'PUT', 'DELETE'].includes(req.method) && !csrfToken) {
    logger.warn('CSRF token missing:', {
      method: req.method,
      path: req.path,
      ip: req.ip
    });
    
    return res.status(403).json({
      success: false,
      error: 'CSRF token required for this operation'
    });
  }
  
  next();
};

module.exports = {
  // Rate limiting
  uploadRateLimit,
  generalRateLimit,
  authRateLimit,
  
  // CORS and security headers
  cors: cors(corsOptions),
  helmet: helmet(helmetConfig),
  
  // Validation
  validateImageId,
  validateEntityParams,
  validateUserRegistration,
  validateUserLogin,
  validatePaginationQuery,
  handleValidationErrors,
  
  // Security utilities
  sanitizeInput,
  csrfProtection
};
