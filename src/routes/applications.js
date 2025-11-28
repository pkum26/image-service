const express = require('express');
const { body, param } = require('express-validator');
const rateLimit = require('express-rate-limit');
const applicationController = require('../controllers/applicationController');
const { authenticateApplication } = require('../middleware/auth');

const router = express.Router();

// Rate limiting for application endpoints
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: {
    success: false,
    error: 'Too many requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Validation rules
const applicationValidation = {
  register: [
    body('name')
      .trim()
      .isLength({ min: 2, max: 50 })
      .matches(/^[a-zA-Z0-9\s\-_]+$/)
      .withMessage('Name must be 2-50 characters long and contain only letters, numbers, spaces, hyphens, and underscores'),
    body('description')
      .optional()
      .trim()
      .isLength({ max: 200 })
      .withMessage('Description must be less than 200 characters'),
    body('domain')
      .trim()
      .isLength({ min: 3, max: 100 })
      .matches(/^[a-zA-Z0-9\-\.]+$/)
      .withMessage('Domain must be valid'),
    body('allowedOrigins')
      .isArray({ min: 1 })
      .withMessage('At least one allowed origin is required')
      .custom((origins) => {
        const urlRegex = /^https?:\/\/[a-zA-Z0-9\-\.]+(?::[0-9]+)?$/;
        const localhostRegex = /^http:\/\/localhost(?::[0-9]+)?$/;
        
        for (const origin of origins) {
          if (!urlRegex.test(origin) && !localhostRegex.test(origin)) {
            throw new Error(`Invalid origin format: ${origin}`);
          }
        }
        return true;
      }),
    body('plan')
      .optional()
      .isIn(['free', 'basic', 'premium', 'enterprise'])
      .withMessage('Invalid plan type')
  ],
  
  authenticate: [
    body('apiKey')
      .trim()
      .isLength({ min: 1 })
      .withMessage('API key is required'),
    body('apiSecret')
      .trim()
      .isLength({ min: 1 })
      .withMessage('API secret is required')
  ],
  
  updateSettings: [
    body('description')
      .optional()
      .trim()
      .isLength({ max: 200 })
      .withMessage('Description must be less than 200 characters'),
    body('allowedOrigins')
      .optional()
      .isArray({ min: 1 })
      .withMessage('At least one allowed origin is required'),
    body('settings.enablePublicAccess')
      .optional()
      .isBoolean()
      .withMessage('enablePublicAccess must be a boolean'),
    body('settings.enableImageOptimization')
      .optional()
      .isBoolean()
      .withMessage('enableImageOptimization must be a boolean'),
    body('settings.defaultImageQuality')
      .optional()
      .isInt({ min: 50, max: 100 })
      .withMessage('defaultImageQuality must be between 50 and 100'),
    body('settings.allowedFormats')
      .optional()
      .isArray()
      .withMessage('allowedFormats must be an array')
  ]
};

/**
 * @route   POST /api/applications/register
 * @desc    Register a new application
 * @access  Public
 */
router.post('/register', 
  authRateLimit,
  applicationValidation.register,
  applicationController.register
);

/**
 * @route   POST /api/applications/authenticate
 * @desc    Authenticate application using API key and secret
 * @access  Public
 */
router.post('/authenticate',
  authRateLimit,
  applicationValidation.authenticate,
  applicationController.authenticate
);

/**
 * @route   POST /api/applications/refresh-token
 * @desc    Refresh access token using refresh token
 * @access  Public
 */
router.post('/refresh-token',
  authRateLimit,
  [
    body('refreshToken')
      .trim()
      .isLength({ min: 1 })
      .withMessage('Refresh token is required')
  ],
  applicationController.refreshToken
);

/**
 * @route   GET /api/applications/profile
 * @desc    Get current application profile
 * @access  Private (Application)
 */
router.get('/profile',
  generalRateLimit,
  authenticateApplication,
  applicationController.getProfile
);

/**
 * @route   PATCH /api/applications/settings
 * @desc    Update application settings
 * @access  Private (Application)
 */
router.patch('/settings',
  generalRateLimit,
  authenticateApplication,
  applicationValidation.updateSettings,
  applicationController.updateSettings
);

/**
 * @route   POST /api/applications/logout
 * @desc    Logout application (invalidate refresh token)
 * @access  Private (Application)
 */
router.post('/logout',
  generalRateLimit,
  authenticateApplication,
  [
    body('refreshToken')
      .trim()
      .isLength({ min: 1 })
      .withMessage('Refresh token is required')
  ],
  applicationController.logout
);

/**
 * @route   POST /api/applications/logout-all
 * @desc    Logout application from all devices
 * @access  Private (Application)
 */
router.post('/logout-all',
  generalRateLimit,
  authenticateApplication,
  applicationController.logoutAll
);

module.exports = router;
