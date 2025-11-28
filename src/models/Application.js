const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const applicationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 2,
    maxlength: 50
  },
  description: {
    type: String,
    maxlength: 200
  },
  domain: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  allowedOrigins: [{
    type: String,
    required: true
  }],
  apiKey: {
    type: String,
    unique: true,
    sparse: true, // Allow null/undefined values to be unique
    required: false // Will be generated automatically
  },
  apiSecret: {
    type: String,
    required: false // Will be generated automatically
  },
  isActive: {
    type: Boolean,
    default: true
  },
  plan: {
    type: String,
    enum: ['free', 'basic', 'premium', 'enterprise'],
    default: 'free'
  },
  limits: {
    maxFileSize: {
      type: Number,
      default: 5242880 // 5MB
    },
    maxImagesPerMonth: {
      type: Number,
      default: 1000
    },
    maxStorageSize: {
      type: Number,
      default: 1073741824 // 1GB
    }
  },
  usage: {
    totalImages: {
      type: Number,
      default: 0
    },
    totalStorageUsed: {
      type: Number,
      default: 0
    },
    currentMonthUploads: {
      type: Number,
      default: 0
    },
    lastResetDate: {
      type: Date,
      default: Date.now
    }
  },
  settings: {
    enablePublicAccess: {
      type: Boolean,
      default: true
    },
    enableImageOptimization: {
      type: Boolean,
      default: true
    },
    defaultImageQuality: {
      type: Number,
      default: 85,
      min: 50,
      max: 100
    },
    allowedFormats: [{
      type: String,
      enum: ['jpeg', 'jpg', 'png', 'webp'],
      default: ['jpeg', 'png', 'webp']
    }]
  },
  refreshTokens: [{
    token: String,
    createdAt: {
      type: Date,
      default: Date.now,
      expires: '30d'
    }
  }]
}, {
  timestamps: true
});

// Generate API key and secret before saving
applicationSchema.pre('save', async function(next) {
  if (this.isNew) {
    // Generate API key
    this.apiKey = 'ak_' + crypto.randomBytes(16).toString('hex');
    
    // Generate and hash API secret
    const apiSecret = crypto.randomBytes(32).toString('hex');
    const salt = await bcrypt.genSalt(12);
    this.apiSecret = await bcrypt.hash(apiSecret, salt);
    
    // Store the plain secret temporarily to return to user
    this._plainSecret = apiSecret;
  }
  next();
});

// Compare API secret method
applicationSchema.methods.compareSecret = async function(candidateSecret) {
  console.log("Comparing./...........::", candidateSecret, this.apiSecret )
  return bcrypt.compare(candidateSecret, this.apiSecret);
};

// Method to reset monthly usage
applicationSchema.methods.resetMonthlyUsage = function() {
  const now = new Date();
  const lastReset = new Date(this.usage.lastResetDate);
  
  // Reset if it's a new month
  if (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
    this.usage.currentMonthUploads = 0;
    this.usage.lastResetDate = now;
  }
};

// Method to check if application can upload more images
applicationSchema.methods.canUpload = function(fileSize = 0) {
  this.resetMonthlyUsage();
  
  const withinMonthlyLimit = this.usage.currentMonthUploads < this.limits.maxImagesPerMonth;
  const withinStorageLimit = (this.usage.totalStorageUsed + fileSize) <= this.limits.maxStorageSize;
  const withinFileSizeLimit = fileSize <= this.limits.maxFileSize;
  
  return {
    allowed: withinMonthlyLimit && withinStorageLimit && withinFileSizeLimit,
    reasons: {
      monthlyLimit: withinMonthlyLimit,
      storageLimit: withinStorageLimit,
      fileSizeLimit: withinFileSizeLimit
    },
    limits: {
      monthlyRemaining: this.limits.maxImagesPerMonth - this.usage.currentMonthUploads,
      storageRemaining: this.limits.maxStorageSize - this.usage.totalStorageUsed,
      maxFileSize: this.limits.maxFileSize
    }
  };
};

// Method to update usage after upload
applicationSchema.methods.recordUpload = function(fileSize) {
  this.usage.totalImages += 1;
  this.usage.totalStorageUsed += fileSize;
  this.usage.currentMonthUploads += 1;
  return this.save();
};

// Remove sensitive data when converting to JSON
applicationSchema.methods.toJSON = function() {
  const appObject = this.toObject();
  delete appObject.apiSecret;
  delete appObject.refreshTokens;
  return appObject;
};

// Static method to find by API key
applicationSchema.statics.findByApiKey = function(apiKey) {
  return this.findOne({ apiKey, isActive: true });
};

module.exports = mongoose.model('Application', applicationSchema);
