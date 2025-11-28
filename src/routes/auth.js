const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const {
  authRateLimit,
  generalRateLimit,
  validateUserRegistration,
  validateUserLogin,
  sanitizeInput
} = require('../middleware/security');

// Public routes with rate limiting
router.post('/register', 
  authRateLimit,
  sanitizeInput,
  validateUserRegistration,
  authController.register
);

router.post('/login', 
  authRateLimit,
  sanitizeInput,
  validateUserLogin,
  authController.login
);

router.post('/refresh-token', 
  generalRateLimit,
  sanitizeInput,
  authController.refreshToken
);

// Protected routes
router.post('/logout', 
  generalRateLimit,
  optionalAuth, // Optional since user might have expired token
  authController.logout
);

router.post('/logout-all', 
  generalRateLimit,
  authenticateToken,
  authController.logoutAll
);

router.get('/profile', 
  generalRateLimit,
  authenticateToken,
  authController.getProfile
);

module.exports = router;
