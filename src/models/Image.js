const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema({
  imageId: {
    type: String,
    required: true,
    unique: true
  },
  originalName: {
    type: String,
    required: true
  },
  filename: {
    type: String,
    required: true
  },
  mimetype: {
    type: String,
    required: true,
    enum: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
  },
  size: {
    type: Number,
    required: true
  },
  path: {
    type: String,
    required: true
  },
  url: {
    type: String
  },
  s3Key: {
    type: String // For S3 storage
  },
  application: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Application',
    required: true
  },
  entityId: {
    type: String, // For associating with specific entities (profiles, products, etc.)
    index: true
  },
  entityType: {
    type: String, // Type of entity (profile, product, etc.)
    index: true
  },
  productId: {
    type: String, // Specific product ID for ecommerce
    index: true
  },
  category: {
    type: String,
    default: 'uncategorized',
    index: true
  },
  tags: [{
    type: String,
    index: true
  }],
  alt: {
    type: String,
    default: ''
  },
  title: {
    type: String,
    default: ''
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date
  },
  versions: [{
    filename: String,
    path: String,
    s3Key: String,
    variants: mongoose.Schema.Types.Mixed,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  variants: {
    type: mongoose.Schema.Types.Mixed, // Store different image sizes
    default: {}
  },
  metadata: {
    width: Number,
    height: Number,
    format: String,
    hasAlpha: Boolean
  },
  accessCount: {
    type: Number,
    default: 0
  },
  lastAccessedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes for better query performance
imageSchema.index({ application: 1, isDeleted: 1 });
imageSchema.index({ entityId: 1, entityType: 1, isDeleted: 1 });
imageSchema.index({ createdAt: 1 });
imageSchema.index({ isPublic: 1, isDeleted: 1 }); // For public image queries

// Pre-save middleware to auto-set public flag for product images
imageSchema.pre('save', function(next) {
  // Auto-set public for product images
  if (this.entityType === 'product' || 
      this.category === 'product' || 
      this.productId || 
      this.category === 'electronics' ||
      this.category === 'clothing' ||
      this.category === 'accessories') {
    this.isPublic = true;
  }
  next();
});

// Soft delete method
imageSchema.methods.softDelete = function() {
  this.isDeleted = true;
  this.deletedAt = new Date();
  return this.save();
};

// Method to increment access count
imageSchema.methods.recordAccess = function() {
  this.accessCount += 1;
  this.lastAccessedAt = new Date();
  return this.save();
};

module.exports = mongoose.model('Image', imageSchema);
