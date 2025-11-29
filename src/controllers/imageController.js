const fs = require('fs').promises;
const path = require('path');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const AWS = require('aws-sdk');
const sharp = require('sharp');
const Image = require('../models/Image');
const Application = require('../models/Application');
const logger = require('../utils/logger');

// Configure AWS S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

// Image sizes for ecommerce
const IMAGE_SIZES = {
  thumbnail: { width: 150, height: 150 },
  small: { width: 300, height: 300 },
  medium: { width: 600, height: 600 },
  large: { width: 1200, height: 1200 },
  original: null // Keep original size
};

// Helper function to generate image variants
const generateImageVariants = async (inputPath, imageId, mimetype) => {
  const variants = {};
  const baseDir = process.env.UPLOAD_DIR || './uploads';
  const variantsDir = path.join(baseDir, 'variants', imageId);
  
  // Create variants directory
  await fs.mkdir(variantsDir, { recursive: true });

  for (const [sizeName, dimensions] of Object.entries(IMAGE_SIZES)) {
    if (sizeName === 'original') {
      variants[sizeName] = {
        path: inputPath,
        width: null,
        height: null
      };
      continue;
    }

    const outputPath = path.join(variantsDir, `${sizeName}.webp`);
    let sharpInstance = sharp(inputPath);

    if (dimensions) {
      sharpInstance = sharpInstance.resize(dimensions.width, dimensions.height, {
        fit: 'inside',
        withoutEnlargement: true
      });
    }

    // Convert to WebP for better compression
    await sharpInstance
      .webp({ quality: 85 })
      .toFile(outputPath);

    const stats = await fs.stat(outputPath);
    const metadata = await sharp(outputPath).metadata();

    variants[sizeName] = {
      path: path.relative(process.cwd(), outputPath),
      size: stats.size,
      width: metadata.width,
      height: metadata.height,
      format: 'webp'
    };
  }

  return variants;
};

// Helper function to generate S3 image variants
const generateS3ImageVariants = async (s3Key, imageId, mimetype) => {
  const variants = {};
  const bucket = process.env.AWS_S3_BUCKET;

  // Get original image from S3
  const originalObject = await s3.getObject({
    Bucket: bucket,
    Key: s3Key
  }).promise();

  for (const [sizeName, dimensions] of Object.entries(IMAGE_SIZES)) {
    if (sizeName === 'original') {
      variants[sizeName] = {
        s3Key: s3Key,
        width: null,
        height: null
      };
      continue;
    }

    let sharpInstance = sharp(originalObject.Body);

    if (dimensions) {
      sharpInstance = sharpInstance.resize(dimensions.width, dimensions.height, {
        fit: 'inside',
        withoutEnlargement: true
      });
    }

    // Convert to WebP
    const processedBuffer = await sharpInstance
      .webp({ quality: 85 })
      .toBuffer();

    const variantKey = `variants/${imageId}/${sizeName}.webp`;

    // Upload variant to S3
    const uploadResult = await s3.upload({
      Bucket: bucket,
      Key: variantKey,
      Body: processedBuffer,
      ContentType: 'image/webp',
      ACL: 'private'
    }).promise();

    const metadata = await sharp(processedBuffer).metadata();

    variants[sizeName] = {
      s3Key: variantKey,
      url: uploadResult.Location,
      size: processedBuffer.length,
      width: metadata.width,
      height: metadata.height,
      format: 'webp'
    };
  }

  return variants;
};

// Upload Image Controller (Enhanced for ecommerce)
const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    // Get application and check limits
    const application = await Application.findById(req.application.id);
    if (!application) {
      return res.status(404).json({
        success: false,
        error: 'Application not found'
      });
    }

    // Check upload limits
    const canUpload = application.canUpload(req.file.size);
    if (!canUpload.allowed) {
      const errors = [];
      if (!canUpload.reasons.monthlyLimit) {
        errors.push(`Monthly upload limit exceeded (${application.limits.maxImagesPerMonth} images)`);
      }
      if (!canUpload.reasons.storageLimit) {
        errors.push(`Storage limit exceeded (${Math.round(application.limits.maxStorageSize / 1024 / 1024)}MB)`);
      }
      if (!canUpload.reasons.fileSizeLimit) {
        errors.push(`File size exceeds limit (${Math.round(application.limits.maxFileSize / 1024 / 1024)}MB)`);
      }
      
      return res.status(413).json({
        success: false,
        error: 'Upload limits exceeded',
        details: errors,
        limits: canUpload.limits
      });
    }

    const { entityId, entityType, category, tags, alt, title, productId } = req.body;
    const imageId = uuidv4();

    // Check if replacing existing image for entity
    if (entityId && entityType) {
      const existingImage = await Image.findOne({
        application: req.application.id,
        entityId,
        entityType,
        isDeleted: false
      });

      if (existingImage) {
        // Archive current version before replacing
        if (existingImage.versions) {
          existingImage.versions.push({
            filename: existingImage.filename,
            path: existingImage.path,
            s3Key: existingImage.s3Key
          });
        }
      }
    }

    // Generate image variants for better performance
    let variants = {};
    try {
      if (process.env.STORAGE_TYPE === 's3') {
        variants = await generateS3ImageVariants(req.file.s3.key, imageId, req.file.mimetype);
      } else {
        variants = await generateImageVariants(req.file.path, imageId, req.file.mimetype);
      }
    } catch (variantError) {
      logger.warn('Failed to generate image variants:', {
        imageId,
        error: variantError.message
      });
      // Continue without variants if generation fails
    }

    // Create image record
    const imageData = {
      imageId,
      originalName: req.file.originalname,
      filename: req.file.filename,
      mimetype: req.file.mimetype,
      size: req.file.size,
      application: req.application.id,
      metadata: {
        width: req.fileMetadata.width,
        height: req.fileMetadata.height,
        format: req.fileMetadata.format,
        hasAlpha: req.fileMetadata.hasAlpha
      },
      variants: variants,
      category: category || 'uncategorized',
      tags: tags ? tags.split(',').map(tag => tag.trim()).filter(tag => tag) : [],
      alt: alt || '',
      title: title || req.file.originalname
    };

    // Set storage-specific fields
    if (process.env.STORAGE_TYPE === 's3') {
      imageData.s3Key = req.file.s3.key;
      imageData.url = req.file.s3.location;
      imageData.path = req.file.s3.key;
    } else {
      const relativePath = path.relative(process.cwd(), req.file.path);
      imageData.path = relativePath;
    }

    // Add entity information if provided
    if (entityId) imageData.entityId = entityId;
    if (entityType) imageData.entityType = entityType;
    if (productId) imageData.productId = productId;

    const image = new Image(imageData);
    await image.save();

    // Update application usage
    await application.recordUpload(req.file.size);

    // Generate signed URL for secure access
    const accessToken = jwt.sign(
      { imageId: image.imageId, applicationId: req.application.id },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    logger.info('Image uploaded successfully:', {
      imageId: image.imageId,
      applicationId: req.application.id,
      applicationName: req.application.name,
      filename: image.filename,
      size: image.size,
      category: image.category,
      isPublic: image.isPublic,
      variants: Object.keys(variants)
    });

    // Generate URLs based on whether image is public
    const baseUrl = `/api/images/${image.imageId}`;
    const urlsWithToken = {
      thumbnail: `${baseUrl}?size=thumbnail&token=${accessToken}`,
      small: `${baseUrl}?size=small&token=${accessToken}`,
      medium: `${baseUrl}?size=medium&token=${accessToken}`,
      large: `${baseUrl}?size=large&token=${accessToken}`,
      original: `${baseUrl}?token=${accessToken}`
    };

    const publicUrls = image.isPublic ? {
      thumbnail: `${baseUrl}?size=thumbnail`,
      small: `${baseUrl}?size=small`,
      medium: `${baseUrl}?size=medium`,
      large: `${baseUrl}?size=large`,
      original: baseUrl
    } : null;

    res.status(201).json({
      success: true,
      data: {
        imageId: image.imageId,
        originalName: image.originalName,
        filename: image.filename,
        size: image.size,
        mimetype: image.mimetype,
        uploadedAt: image.createdAt,
        metadata: image.metadata,
        variants: variants,
        category: image.category,
        tags: image.tags,
        alt: image.alt,
        title: image.title,
        isPublic: image.isPublic,
        accessUrl: image.isPublic ? baseUrl : `${baseUrl}?token=${accessToken}`,
        accessToken,
        urls: urlsWithToken,
        publicUrls: publicUrls
      }
    });

  } catch (error) {
    logger.error('Image upload failed:', {
      error: error.message,
      applicationId: req.application?.id,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Failed to upload image'
    });
  }
};

// Bulk Upload Images Controller
const bulkUploadImages = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded'
      });
    }

    // Get application and check limits for all files
    const application = await Application.findById(req.application.id);
    if (!application) {
      return res.status(404).json({
        success: false,
        error: 'Application not found'
      });
    }

    const totalSize = req.files.reduce((sum, file) => sum + file.size, 0);
    const canUpload = application.canUpload(totalSize);
    if (!canUpload.allowed) {
      const errors = [];
      if (!canUpload.reasons.monthlyLimit) {
        errors.push(`Monthly upload limit would be exceeded (${application.limits.maxImagesPerMonth} images)`);
      }
      if (!canUpload.reasons.storageLimit) {
        errors.push(`Storage limit would be exceeded (${Math.round(application.limits.maxStorageSize / 1024 / 1024)}MB)`);
      }
      
      return res.status(413).json({
        success: false,
        error: 'Upload limits would be exceeded',
        details: errors,
        limits: canUpload.limits
      });
    }

    const { entityId, entityType, category, productId } = req.body;
    const results = [];
    const errors = [];

    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const imageId = uuidv4();

      try {
        // Generate image variants
        let variants = {};
        try {
          if (process.env.STORAGE_TYPE === 's3') {
            variants = await generateS3ImageVariants(file.s3.key, imageId, file.mimetype);
          } else {
            variants = await generateImageVariants(file.path, imageId, file.mimetype);
          }
        } catch (variantError) {
          logger.warn('Failed to generate variants for bulk upload:', {
            imageId,
            filename: file.originalname,
            error: variantError.message
          });
        }

        // Create image record
        const imageData = {
          imageId,
          originalName: file.originalname,
          filename: file.filename,
          mimetype: file.mimetype,
          size: file.size,
          application: req.application.id,
          metadata: file.metadata || {},
          variants: variants,
          category: category || 'uncategorized',
          tags: [],
          alt: '',
          title: file.originalname
        };

        // Set storage-specific fields
        if (process.env.STORAGE_TYPE === 's3') {
          imageData.s3Key = file.s3.key;
          imageData.url = file.s3.location;
          imageData.path = file.s3.key;
        } else {
          const relativePath = path.relative(process.cwd(), file.path);
          imageData.path = relativePath;
        }

        // Add entity information if provided
        if (entityId) imageData.entityId = entityId;
        if (entityType) imageData.entityType = entityType;
        if (productId) imageData.productId = productId;

        const image = new Image(imageData);
        await image.save();

        // Update application usage for each successful upload
        await application.recordUpload(file.size);

        // Generate access token
        const accessToken = jwt.sign(
          { imageId: image.imageId, applicationId: req.application.id },
          process.env.JWT_SECRET,
          { expiresIn: '1h' }
        );

        results.push({
          imageId: image.imageId,
          originalName: image.originalName,
          filename: image.filename,
          size: image.size,
          accessUrl: `/api/images/${image.imageId}?token=${accessToken}`,
          accessToken
        });

      } catch (error) {
        errors.push({
          filename: file.originalname,
          error: error.message
        });

        logger.error('Bulk upload item failed:', {
          filename: file.originalname,
          error: error.message,
          applicationId: req.application.id
        });
      }
    }

    logger.info('Bulk upload completed:', {
      applicationId: req.application.id,
      applicationName: req.application.name,
      totalFiles: req.files.length,
      successful: results.length,
      failed: errors.length
    });

    res.status(201).json({
      success: true,
      data: {
        uploaded: results,
        errors: errors,
        summary: {
          total: req.files.length,
          successful: results.length,
          failed: errors.length
        }
      }
    });

  } catch (error) {
    logger.error('Bulk upload failed:', {
      error: error.message,
      applicationId: req.application?.id,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Failed to process bulk upload'
    });
  }
};

// Get Image Controller (Enhanced with size support and public access)
const getImage = async (req, res) => {
  try {
    const { imageId } = req.params;
    const { token, size = 'original' } = req.query;

    const image = await Image.findOne({
      imageId,
      isDeleted: false
    });

    if (!image) {
      return res.status(404).json({
        success: false,
        error: 'Image not found'
      });
    }

    // 🔓 NEW: Allow public access for public images (e.g., product images)
    if (image.isPublic) {
      // No authentication required for public images
      await image.recordAccess();
    } else {
      // Existing authentication logic for private images
      if (token) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          if (decoded.imageId !== imageId) {
            return res.status(403).json({
              success: false,
              error: 'Invalid access token for this image'
            });
          }
        } catch (tokenError) {
          return res.status(401).json({
            success: false,
            error: 'Invalid or expired access token'
          });
        }
      } else if (!req.userId) {
        // No token and no authenticated user for private image
        return res.status(401).json({
          success: false,
          error: 'Access token required or authenticate to access image'
        });
      } else if (req.userId.toString() !== image.owner.toString()) {
        // Check ownership for private images
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
      
      // Record access for private images
      await image.recordAccess();
    }

    // Get the requested size variant
    let targetPath = image.path;
    let targetS3Key = image.s3Key;
    let mimetype = image.mimetype;

    if (size !== 'original' && image.variants && image.variants[size]) {
      const variant = image.variants[size];
      targetPath = variant.path;
      targetS3Key = variant.s3Key;
      mimetype = 'image/webp'; // Variants are WebP
    }

    // Serve image based on storage type
    if (process.env.STORAGE_TYPE === 's3') {
      // Generate signed URL for S3
      const signedUrl = s3.getSignedUrl('getObject', {
        Bucket: process.env.AWS_S3_BUCKET,
        Key: targetS3Key,
        Expires: 3600 // 1 hour
      });

      return res.redirect(signedUrl);
    } else {
      // Serve from local storage
      const imagePath = path.resolve(process.cwd(), targetPath);
      
      try {
        await fs.access(imagePath);
        
        res.set({
          'Content-Type': mimetype,
          'Cache-Control': 'public, max-age=31536000', // 1 year
          'ETag': `"${image.imageId}-${size}-${image.updatedAt.getTime()}"`,
          'Last-Modified': image.updatedAt.toUTCString()
        });

        res.sendFile(imagePath);
      } catch (fileError) {
        logger.error('File not found on disk:', {
          imageId: image.imageId,
          path: imagePath,
          size: size,
          error: fileError.message
        });

        res.status(404).json({
          success: false,
          error: 'Image file not found on storage'
        });
      }
    }

  } catch (error) {
    logger.error('Get image failed:', {
      error: error.message,
      imageId: req.params.imageId,
      size: req.query.size,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve image'
    });
  }
};

// Delete Image Controller
const deleteImage = async (req, res) => {
  try {
    const { imageId } = req.params;

    const image = await Image.findOne({
      imageId,
      application: req.application.id,
      isDeleted: false
    });

    if (!image) {
      return res.status(404).json({
        success: false,
        error: 'Image not found or already deleted'
      });
    }

    // Soft delete the image
    await image.softDelete();

    // Schedule physical file deletion (in production, use a queue)
    setTimeout(async () => {
      try {
        if (process.env.STORAGE_TYPE === 's3') {
          // Delete from S3
          await s3.deleteObject({
            Bucket: process.env.AWS_S3_BUCKET,
            Key: image.s3Key
          }).promise();

          // Delete variants
          if (image.variants) {
            for (const [sizeName, variant] of Object.entries(image.variants)) {
              if (variant.s3Key && sizeName !== 'original') {
                await s3.deleteObject({
                  Bucket: process.env.AWS_S3_BUCKET,
                  Key: variant.s3Key
                }).promise();
              }
            }
          }

          // Delete versions if any
          if (image.versions && image.versions.length > 0) {
            const deleteParams = {
              Bucket: process.env.AWS_S3_BUCKET,
              Delete: {
                Objects: image.versions
                  .filter(v => v.s3Key)
                  .map(v => ({ Key: v.s3Key }))
              }
            };
            await s3.deleteObjects(deleteParams).promise();
          }
        } else {
          // Delete from local storage
          const imagePath = path.resolve(process.cwd(), image.path);
          await fs.unlink(imagePath).catch(() => {}); // Ignore if file doesn't exist

          let deletedVariants = [];
          // Delete variants and variants directory
          if (image.variants) {
            for (const [sizeName, variant] of Object.entries(image.variants)) {
              if (variant.path && sizeName !== 'original') {
                const variantPath = path.resolve(process.cwd(), variant.path);
                try {
                  await fs.unlink(variantPath);
                  deletedVariants.push(sizeName);
                  logger.info('Variant file deleted:', {
                    imageId: image.imageId,
                    variant: sizeName,
                    path: variant.path
                  });
                } catch (err) {
                  logger.warn('Failed to delete variant file:', {
                    imageId: image.imageId,
                    variant: sizeName,
                    path: variant.path,
                    error: err.message
                  });
                }
              }
            }

            // Delete variants directory if it exists
            const baseDir = process.env.UPLOAD_DIR || './uploads';
            const variantsDir = path.resolve(process.cwd(), baseDir, 'variants', image.imageId);
            try {
              await fs.rmdir(variantsDir);
              logger.info('Variants directory deleted:', {
                imageId: image.imageId,
                directory: variantsDir
              });
            } catch (err) {
              logger.warn('Failed to delete variants directory (may be empty or not exist):', {
                imageId: image.imageId,
                directory: variantsDir,
                error: err.message
              });
            }
          }

          // Delete versions
          if (image.versions && image.versions.length > 0) {
            for (const version of image.versions) {
              if (version.path) {
                const versionPath = path.resolve(process.cwd(), version.path);
                await fs.unlink(versionPath).catch(() => {});
              }
            }
          }
        }

        logger.info('Image file deleted from storage:', {
          imageId: image.imageId,
          path: image.path,
          variantsDeleted: deletedVariants || []
        });
      } catch (deleteError) {
        logger.error('Failed to delete image file:', {
          imageId: image.imageId,
          error: deleteError.message
        });
      }
    }, 5000); // 5-second delay

    logger.info('Image deleted successfully:', {
      imageId: image.imageId,
      applicationId: req.application.id
    });

    res.json({
      success: true,
      message: 'Image deleted successfully'
    });

  } catch (error) {
    logger.error('Delete image failed:', {
      error: error.message,
      imageId: req.params.imageId,
      applicationId: req.application?.id,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Failed to delete image'
    });
  }
};

// Replace Image Controller
const replaceImage = async (req, res) => {
  try {
    const { imageId } = req.params;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No replacement file uploaded'
      });
    }

    const existingImage = await Image.findOne({
      imageId,
      application: req.application.id,
      isDeleted: false
    });

    if (!existingImage) {
      return res.status(404).json({
        success: false,
        error: 'Image not found'
      });
    }

    // Archive current version
    existingImage.versions.push({
      filename: existingImage.filename,
      path: existingImage.path,
      s3Key: existingImage.s3Key,
      variants: existingImage.variants,
      createdAt: new Date()
    });

    // Generate new variants
    let variants = {};
    try {
      if (process.env.STORAGE_TYPE === 's3') {
        variants = await generateS3ImageVariants(req.file.s3.key, imageId, req.file.mimetype);
      } else {
        variants = await generateImageVariants(req.file.path, imageId, req.file.mimetype);
      }
    } catch (variantError) {
      logger.warn('Failed to generate variants for replacement:', {
        imageId,
        error: variantError.message
      });
    }

    // Update image with new file details
    existingImage.originalName = req.file.originalname;
    existingImage.filename = req.file.filename;
    existingImage.mimetype = req.file.mimetype;
    existingImage.size = req.file.size;
    existingImage.metadata = {
      width: req.fileMetadata.width,
      height: req.fileMetadata.height,
      format: req.fileMetadata.format,
      hasAlpha: req.fileMetadata.hasAlpha
    };
    existingImage.variants = variants;

    // Update storage-specific fields
    if (process.env.STORAGE_TYPE === 's3') {
      existingImage.s3Key = req.file.s3.key;
      existingImage.url = req.file.s3.location;
      existingImage.path = req.file.s3.key;
    } else {
      const relativePath = path.relative(process.cwd(), req.file.path);
      existingImage.path = relativePath;
    }

    await existingImage.save();

    // Generate new access token
    const accessToken = jwt.sign(
      { imageId: existingImage.imageId, applicationId: req.application.id },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    logger.info('Image replaced successfully:', {
      imageId: existingImage.imageId,
      applicationId: req.application.id,
      newFilename: existingImage.filename
    });

    res.json({
      success: true,
      data: {
        imageId: existingImage.imageId,
        originalName: existingImage.originalName,
        filename: existingImage.filename,
        size: existingImage.size,
        mimetype: existingImage.mimetype,
        updatedAt: existingImage.updatedAt,
        metadata: existingImage.metadata,
        variants: variants,
        accessUrl: `/api/images/${existingImage.imageId}?token=${accessToken}`,
        accessToken,
        versionsCount: existingImage.versions.length,
        urls: {
          thumbnail: `/api/images/${existingImage.imageId}/thumbnail?token=${accessToken}`,
          small: `/api/images/${existingImage.imageId}/small?token=${accessToken}`,
          medium: `/api/images/${existingImage.imageId}/medium?token=${accessToken}`,
          large: `/api/images/${existingImage.imageId}/large?token=${accessToken}`,
          original: `/api/images/${existingImage.imageId}?token=${accessToken}`
        }
      }
    });

  } catch (error) {
    logger.error('Replace image failed:', {
      error: error.message,
      imageId: req.params.imageId,
      applicationId: req.application?.id,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Failed to replace image'
    });
  }
};

// List Images Controller (Enhanced with search and filtering)
const listImages = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const query = {
      application: req.application.id,
      isDeleted: false
    };

    // Enhanced filtering options
    if (req.query.entityId) query.entityId = req.query.entityId;
    if (req.query.entityType) query.entityType = req.query.entityType;
    if (req.query.productId) query.productId = req.query.productId;
    if (req.query.category) query.category = req.query.category;
    if (req.query.tags) {
      const tags = req.query.tags.split(',').map(tag => tag.trim());
      query.tags = { $in: tags };
    }

    // Search functionality
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i');
      query.$or = [
        { originalName: searchRegex },
        { title: searchRegex },
        { alt: searchRegex },
        { tags: searchRegex }
      ];
    }

    // Sort options
    let sortOption = { createdAt: -1 }; // Default: newest first
    if (req.query.sort) {
      switch (req.query.sort) {
        case 'name':
          sortOption = { originalName: 1 };
          break;
        case 'size':
          sortOption = { size: -1 };
          break;
        case 'accessed':
          sortOption = { lastAccessedAt: -1 };
          break;
        case 'oldest':
          sortOption = { createdAt: 1 };
          break;
      }
    }

    const [images, total] = await Promise.all([
      Image.find(query)
        .select('-versions -__v')
        .sort(sortOption)
        .skip(skip)
        .limit(limit),
      Image.countDocuments(query)
    ]);

    const totalPages = Math.ceil(total / limit);

    // Generate access tokens for images
    const imagesWithTokens = images.map(image => {
      const accessToken = jwt.sign(
        { imageId: image.imageId, applicationId: req.application.id },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      return {
        imageId: image.imageId,
        originalName: image.originalName,
        filename: image.filename,
        size: image.size,
        mimetype: image.mimetype,
        entityId: image.entityId,
        entityType: image.entityType,
        productId: image.productId,
        category: image.category,
        tags: image.tags,
        alt: image.alt,
        title: image.title,
        metadata: image.metadata,
        accessCount: image.accessCount,
        lastAccessedAt: image.lastAccessedAt,
        createdAt: image.createdAt,
        updatedAt: image.updatedAt,
        accessUrl: `/api/images/${image.imageId}?token=${accessToken}`,
        urls: {
          thumbnail: `/api/images/${image.imageId}?size=thumbnail&token=${accessToken}`,
          small: `/api/images/${image.imageId}?size=small&token=${accessToken}`,
          medium: `/api/images/${image.imageId}?size=medium&token=${accessToken}`,
          large: `/api/images/${image.imageId}?size=large&token=${accessToken}`,
          original: `/api/images/${image.imageId}?token=${accessToken}`
        }
      };
    });

    res.json({
      success: true,
      data: {
        images: imagesWithTokens,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        },
        filters: {
          entityId: req.query.entityId,
          entityType: req.query.entityType,
          productId: req.query.productId,
          category: req.query.category,
          tags: req.query.tags,
          search: req.query.search,
          sort: req.query.sort
        }
      }
    });

  } catch (error) {
    logger.error('List images failed:', {
      error: error.message,
      applicationId: req.application?.id,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve images'
    });
  }
};

// Update Image Metadata Controller
const updateImageMetadata = async (req, res) => {
  try {
    const { imageId } = req.params;
    const { category, tags, alt, title } = req.body;

    const image = await Image.findOne({
      imageId,
      application: req.application.id,
      isDeleted: false
    });

    if (!image) {
      return res.status(404).json({
        success: false,
        error: 'Image not found'
      });
    }

    // Update metadata
    if (category !== undefined) image.category = category;
    if (tags !== undefined) {
      image.tags = Array.isArray(tags) ? tags : tags.split(',').map(tag => tag.trim()).filter(tag => tag);
    }
    if (alt !== undefined) image.alt = alt;
    if (title !== undefined) image.title = title;

    await image.save();

    logger.info('Image metadata updated:', {
      imageId: image.imageId,
      applicationId: req.application.id,
      updates: { category, tags: image.tags, alt, title }
    });

    res.json({
      success: true,
      data: {
        imageId: image.imageId,
        originalName: image.originalName,
        category: image.category,
        tags: image.tags,
        alt: image.alt,
        title: image.title,
        updatedAt: image.updatedAt
      }
    });

  } catch (error) {
    logger.error('Update image metadata failed:', {
      error: error.message,
      imageId: req.params.imageId,
      applicationId: req.application?.id,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Failed to update image metadata'
    });
  }
};

// Get Image Info Controller - returns metadata without serving the file
const getImageInfo = async (req, res) => {
  try {
    const { imageId } = req.params;
    const { token } = req.query;

    const image = await Image.findOne({
      imageId,
      isDeleted: false
    }).select('-versions -__v'); // Exclude version history for performance

    if (!image) {
      return res.status(404).json({
        success: false,
        error: 'Image not found'
      });
    }

    // Handle access control (same logic as getImage)
    let hasAccess = false;
    let accessToken = null;

    if (image.isPublic) {
      // Public images - no authentication required
      hasAccess = true;
      await image.recordAccess();
    } else {
      // Private images - require authentication
      if (token) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          if (decoded.imageId === imageId) {
            hasAccess = true;
          }
        } catch (tokenError) {
          return res.status(401).json({
            success: false,
            error: 'Invalid or expired access token'
          });
        }
      } else if (req.application && req.application.id) {
        // Check if image belongs to the authenticated application
        if (image.application.toString() === req.application.id.toString()) {
          hasAccess = true;
          // Generate new access token for private images
          accessToken = jwt.sign(
            { imageId: image.imageId, applicationId: req.application.id },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
          );
        }
      }

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. Authentication required for private images.'
        });
      }

      await image.recordAccess();
    }

    // Prepare variant information
    const variantInfo = {};
    if (image.variants) {
      for (const [sizeName, variant] of Object.entries(image.variants)) {
        variantInfo[sizeName] = {
          width: variant.width,
          height: variant.height,
          size: variant.size,
          format: variant.format || (sizeName === 'original' ? image.metadata?.format : 'webp')
        };
      }
    }

    // Generate URLs based on access level
    const baseUrl = `${req.protocol}://${req.get('host')}/api/images/${image.imageId}`;
    let urls = {};

    if (image.isPublic) {
      // Public URLs - no token needed
      urls = {
        thumbnail: `${baseUrl}?size=thumbnail`,
        small: `${baseUrl}?size=small`,
        medium: `${baseUrl}?size=medium`,
        large: `${baseUrl}?size=large`,
        original: baseUrl,
        info: `${baseUrl}/info`
      };
    } else {
      // Private URLs - include access token
      const tokenParam = accessToken ? `token=${accessToken}` : (token ? `token=${token}` : '');
      urls = {
        thumbnail: `${baseUrl}?size=thumbnail&${tokenParam}`,
        small: `${baseUrl}?size=small&${tokenParam}`,
        medium: `${baseUrl}?size=medium&${tokenParam}`,
        large: `${baseUrl}?size=large&${tokenParam}`,
        original: `${baseUrl}?${tokenParam}`,
        info: `${baseUrl}/info${tokenParam ? `?${tokenParam}` : ''}`
      };
    }

    // Prepare comprehensive response
    const responseData = {
      imageId: image.imageId,
      originalName: image.originalName,
      filename: image.filename,
      size: image.size,
      mimetype: image.mimetype,
      isPublic: image.isPublic,
      metadata: {
        width: image.metadata?.width,
        height: image.metadata?.height,
        format: image.metadata?.format,
        hasAlpha: image.metadata?.hasAlpha
      },
      variants: variantInfo,
      category: image.category,
      tags: image.tags || [],
      alt: image.alt || '',
      title: image.title || image.originalName,
      entityId: image.entityId,
      entityType: image.entityType,
      productId: image.productId,
      accessCount: image.accessCount || 0,
      lastAccessedAt: image.lastAccessedAt,
      createdAt: image.createdAt,
      updatedAt: image.updatedAt,
      urls: urls
    };

    // Add access token for private images if generated
    if (accessToken) {
      responseData.accessToken = accessToken;
    }

    logger.info('Image info retrieved:', {
      imageId: image.imageId,
      isPublic: image.isPublic,
      hasAuth: !!req.application,
      accessCount: image.accessCount
    });

    res.json({
      success: true,
      data: responseData
    });

  } catch (error) {
    logger.error('Get image info failed:', {
      error: error.message,
      imageId: req.params.imageId,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve image information'
    });
  }
};

// Get Categories Controller
const getCategories = async (req, res) => {
  try {
    const categories = await Image.distinct('category', {
      application: req.application.id,
      isDeleted: false
    });

    res.json({
      success: true,
      data: {
        categories: categories.filter(cat => cat && cat !== '')
      }
    });

  } catch (error) {
    logger.error('Get categories failed:', {
      error: error.message,
      applicationId: req.application?.id,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve categories'
    });
  }
};

module.exports = {
  uploadImage,
  bulkUploadImages,
  getImage,
  getImageInfo,
  deleteImage,
  replaceImage,
  listImages,
  updateImageMetadata,
  getCategories
};
