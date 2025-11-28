const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const AWS = require('aws-sdk');
const logger = require('../utils/logger');

// Configure AWS S3 if using cloud storage
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

// Allowed MIME types
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

// File size limit (5MB)
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE) || 5242880;

// Sanitize filename - remove dangerous characters
const sanitizeFilename = (filename) => {
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, '_') // Replace non-alphanumeric chars with underscore
    .replace(/_{2,}/g, '_') // Replace multiple underscores with single
    .replace(/^_+|_+$/g, '') // Remove leading/trailing underscores
    .substring(0, 100); // Limit length
};

// Generate unique filename with UUID
const generateUniqueFilename = (originalName) => {
  const ext = path.extname(originalName).toLowerCase();
  const sanitizedName = sanitizeFilename(path.basename(originalName, ext));
  return `${uuidv4()}_${sanitizedName}${ext}`;
};

// Validate file type using both extension and magic number
const validateFileType = async (file) => {
  try {
    // Check MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new Error('Invalid file type. Only JPG, PNG, and WebP images are allowed.');
    }

    // Use Sharp to validate that file is actually an image and get metadata
    let imageInput;
    if (file.buffer) {
      // Memory storage - file has buffer
      imageInput = file.buffer;
    } else if (file.path) {
      // Disk storage - file has path
      imageInput = file.path;
    } else {
      throw new Error('Invalid file data - no buffer or path available.');
    }

    const metadata = await sharp(imageInput).metadata();
    
    if (!metadata || !metadata.format) {
      throw new Error('Invalid image file or corrupted data.');
    }

    // Validate format matches expected types
    const validFormats = ['jpeg', 'png', 'webp'];
    if (!validFormats.includes(metadata.format)) {
      throw new Error('Invalid image format detected.');
    }

    return metadata;
  } catch (error) {
    logger.error('File validation failed:', {
      error: error.message,
      mimetype: file.mimetype,
      originalname: file.originalname,
      hasBuffer: !!file.buffer,
      hasPath: !!file.path
    });
    throw error;
  }
};

// Storage configuration for local files
const localStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const uploadDir = process.env.UPLOAD_DIR || './uploads';
      
      // Ensure upload directory exists
      await fs.mkdir(uploadDir, { recursive: true });
      
      cb(null, uploadDir);
    } catch (error) {
      logger.error('Failed to create upload directory:', error);
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    try {
      const uniqueFilename = generateUniqueFilename(file.originalname);
      cb(null, uniqueFilename);
    } catch (error) {
      logger.error('Failed to generate filename:', error);
      cb(error);
    }
  }
});

// Memory storage for S3 uploads
const memoryStorage = multer.memoryStorage();

// File filter for security
const fileFilter = (req, file, cb) => {
  try {
    // Check file extension
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExt = ['.jpg', '.jpeg', '.png', '.webp'];
    
    if (!allowedExt.includes(ext)) {
      return cb(new Error('Invalid file extension. Only .jpg, .jpeg, .png, and .webp are allowed.'));
    }

    // Check MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(new Error('Invalid MIME type. Only image files are allowed.'));
    }

    // Check for potential path traversal in filename
    if (file.originalname.includes('..') || file.originalname.includes('/') || file.originalname.includes('\\')) {
      return cb(new Error('Invalid filename. Path traversal attempts are not allowed.'));
    }

    cb(null, true);
  } catch (error) {
    logger.error('File filter error:', error);
    cb(error);
  }
};

// Create multer instance based on storage type
const createMulterUpload = (maxFiles = 1) => {
  const storageType = process.env.STORAGE_TYPE || 'local';
  
  return multer({
    storage: storageType === 's3' ? memoryStorage : localStorage,
    fileFilter,
    limits: {
      fileSize: MAX_FILE_SIZE,
      files: maxFiles, // Configurable number of files
      fieldSize: 1024 * 1024, // 1MB for form fields
      fieldNameSize: 100,
      fields: 10
    }
  });
};

// S3 upload function
const uploadToS3 = async (file, filename) => {
  try {
    const params = {
      Bucket: process.env.AWS_S3_BUCKET,
      Key: filename,
      Body: file.buffer,
      ContentType: file.mimetype,
      ServerSideEncryption: 'AES256'
    };

    const result = await s3.upload(params).promise();
    return {
      location: result.Location,
      key: result.Key,
      bucket: result.Bucket
    };
  } catch (error) {
    logger.error('S3 upload failed:', error);
    throw new Error('Failed to upload file to cloud storage.');
  }
};

// Main upload middleware
const uploadMiddleware = (req, res, next) => {
  const upload = createMulterUpload();
  
  upload.single('image')(req, res, async (err) => {
    try {
      if (err instanceof multer.MulterError) {
        logger.warn('Multer error:', {
          error: err.message,
          code: err.code,
          field: err.field
        });

        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`
          });
        }

        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({
            success: false,
            error: 'Too many files. Only one file per request is allowed.'
          });
        }

        return res.status(400).json({
          success: false,
          error: 'Upload error: ' + err.message
        });
      }

      if (err) {
        logger.error('Upload middleware error:', err);
        return res.status(400).json({
          success: false,
          error: err.message
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file provided. Please upload an image file.'
        });
      }

      // Validate file content
      const metadata = await validateFileType(req.file);
      req.fileMetadata = metadata;

      // If using S3, upload the file
      if (process.env.STORAGE_TYPE === 's3') {
        const uniqueFilename = generateUniqueFilename(req.file.originalname);
        const s3Result = await uploadToS3(req.file, uniqueFilename);
        
        req.file.s3 = s3Result;
        req.file.filename = uniqueFilename;
      }

      next();
    } catch (error) {
      logger.error('File processing error:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  });
};

// Bulk upload middleware for multiple files
const bulkUploadMiddleware = (maxFiles = 10) => {
  return (req, res, next) => {
    const upload = createMulterUpload(maxFiles);
    
    upload.array('images', maxFiles)(req, res, async (err) => {
      try {
        if (err instanceof multer.MulterError) {
          logger.warn('Bulk upload multer error:', {
            error: err.message,
            code: err.code,
            field: err.field
          });

          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
              success: false,
              error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB per file.`
            });
          }

          if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
              success: false,
              error: `Too many files. Maximum ${maxFiles} files per request.`
            });
          }

          return res.status(400).json({
            success: false,
            error: 'Upload error: ' + err.message
          });
        }

        if (err) {
          logger.error('Bulk upload middleware error:', err);
          return res.status(400).json({
            success: false,
            error: err.message
          });
        }

        if (!req.files || req.files.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'No files provided. Please upload at least one image file.'
          });
        }

        // Process each file
        for (let i = 0; i < req.files.length; i++) {
          const file = req.files[i];
          
          try {
            // Validate file content
            const metadata = await validateFileType(file);
            file.metadata = metadata;

            // If using S3, upload the file
            if (process.env.STORAGE_TYPE === 's3') {
              const uniqueFilename = generateUniqueFilename(file.originalname);
              const s3Result = await uploadToS3(file, uniqueFilename);
              
              file.s3 = s3Result;
              file.filename = uniqueFilename;
            }
          } catch (fileError) {
            logger.warn('File validation/upload failed for bulk upload:', {
              filename: file.originalname,
              error: fileError.message
            });
            
            // Mark file as invalid but continue with others
            file.validationError = fileError.message;
          }
        }

        next();
      } catch (error) {
        logger.error('Bulk file processing error:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to process uploaded files'
        });
      }
    });
  };
};

module.exports = {
  uploadMiddleware,
  bulkUploadMiddleware,
  validateFileType,
  generateUniqueFilename,
  uploadToS3,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE
};
