const express = require('express');
const router = express.Router();
const imageController = require('../controllers/imageController');
const { authenticateApplication, optionalApplicationAuth } = require('../middleware/auth');
const { uploadMiddleware, bulkUploadMiddleware } = require('../middleware/upload');
const {
  uploadRateLimit,
  generalRateLimit,
  validateImageId,
  validateEntityParams,
  validatePaginationQuery,
  sanitizeInput,
  csrfProtection
} = require('../middleware/security');

// Upload single image - protected route with upload rate limiting
router.post('/upload',
  uploadRateLimit,
  authenticateApplication,
  csrfProtection,
  sanitizeInput,
  validateEntityParams,
  uploadMiddleware,
  imageController.uploadImage
);

// Bulk upload images - protected route with upload rate limiting
router.post('/bulk-upload',
  uploadRateLimit,
  authenticateApplication,
  csrfProtection,
  sanitizeInput,
  validateEntityParams,
  bulkUploadMiddleware(10), // Allow up to 10 files
  imageController.bulkUploadImages
);

// Get categories - protected route
router.get('/categories/list',
  generalRateLimit,
  authenticateApplication,
  imageController.getCategories
);

// List application's images - protected route
router.get('/',
  generalRateLimit,
  authenticateApplication,
  validatePaginationQuery,
  imageController.listImages
);

// Get image info/metadata - public for public images
router.get('/:imageId/info',
  generalRateLimit,
  optionalApplicationAuth, // Same access pattern as image viewing
  validateImageId,
  imageController.getImageInfo
);

// Get image - can use token-based access or authentication
router.get('/:imageId',
  generalRateLimit,
  optionalApplicationAuth, // Optional auth allows token-based access
  validateImageId,
  imageController.getImage
);

// Update image metadata - protected route
router.patch('/:imageId/metadata',
  generalRateLimit,
  authenticateApplication,
  csrfProtection,
  validateImageId,
  sanitizeInput,
  imageController.updateImageMetadata
);

// Replace image - protected route with upload rate limiting
router.put('/:imageId',
  uploadRateLimit,
  authenticateApplication,
  csrfProtection,
  validateImageId,
  uploadMiddleware,
  imageController.replaceImage
);

// Delete image - protected route
router.delete('/:imageId',
  generalRateLimit,
  authenticateApplication,
  csrfProtection,
  validateImageId,
  imageController.deleteImage
);

module.exports = router;
