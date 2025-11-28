const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Application = require('../models/Application');
const logger = require('../utils/logger');

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access denied. No token provided.'
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Find user and check if still active
    const user = await User.findById(decoded.userId).select('-password -refreshTokens');
    
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token or user not found.'
      });
    }

    // Add user info to request object
    req.user = user;
    req.userId = user._id;
    
    next();
  } catch (error) {
    logger.warn('Authentication failed:', {
      error: error.message,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expired.'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token.'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Authentication error.'
    });
  }
};

const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required.'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions.'
      });
    }

    next();
  };
};

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      // No token provided, continue without authentication
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password -refreshTokens');
    
    if (user && user.isActive) {
      req.user = user;
      req.userId = user._id;
    }

    next();
  } catch (error) {
    // Invalid token, continue without authentication
    next();
  }
};

const authenticateApplication = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access denied. No token provided.'
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if token is for application
    if (decoded.type !== 'application') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token type.'
      });
    }
    
    // Find application and check if still active
    const application = await Application.findById(decoded.id);
    
    if (!application || !application.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token or application not found.'
      });
    }

    // Add application info to request object
    req.application = {
      id: application._id,
      name: application.name,
      domain: application.domain,
      plan: application.plan,
      limits: application.limits,
      settings: application.settings
    };
    
    next();
  } catch (error) {
    logger.warn('Application authentication failed:', {
      error: error.message,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expired.'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token.'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Authentication error.'
    });
  }
};

const optionalApplicationAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      // No token provided, continue without authentication
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.type === 'application') {
      const application = await Application.findById(decoded.id);
      
      if (application && application.isActive) {
        req.application = {
          id: application._id,
          name: application.name,
          domain: application.domain,
          plan: application.plan,
          limits: application.limits,
          settings: application.settings
        };
      }
    }

    next();
  } catch (error) {
    // Invalid token, continue without authentication
    next();
  }
};

module.exports = {
  authenticateToken,
  authorizeRoles,
  optionalAuth,
  authenticateApplication,
  optionalApplicationAuth
};
