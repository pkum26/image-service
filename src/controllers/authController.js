const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');

// Generate JWT tokens
const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRY || '24h' }
  );

  const refreshToken = jwt.sign(
    { userId, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
};

// Register Controller
const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      const field = existingUser.email === email ? 'email' : 'username';
      return res.status(400).json({
        success: false,
        error: `User with this ${field} already exists`
      });
    }

    // Create new user
    const user = new User({
      username,
      email,
      password
    });

    await user.save();

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user._id);

    // Store refresh token
    user.refreshTokens.push({
      token: refreshToken
    });
    await user.save();

    logger.info('User registered successfully:', {
      userId: user._id,
      username: user.username,
      email: user.email
    });

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt
        },
        accessToken,
        refreshToken
      }
    });

  } catch (error) {
    logger.error('Registration failed:', {
      error: error.message,
      email: req.body.email,
      username: req.body.username,
      stack: error.stack
    });

    if (error.code === 11000) {
      // Duplicate key error
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        error: `${field} already exists`
      });
    }

    res.status(500).json({
      success: false,
      error: 'Registration failed'
    });
  }
};

// Login Controller
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user and include password for validation
    const user = await User.findOne({ email }).select('+password');

    if (!user || !user.isActive) {
      logger.warn('Login attempt with invalid email:', {
        email,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      logger.warn('Login attempt with invalid password:', {
        userId: user._id,
        email,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user._id);

    // Clean up old refresh tokens (keep only last 5)
    if (user.refreshTokens.length >= 5) {
      user.refreshTokens = user.refreshTokens.slice(-4);
    }

    // Store new refresh token
    user.refreshTokens.push({
      token: refreshToken
    });

    await user.save();

    logger.info('User logged in successfully:', {
      userId: user._id,
      email: user.email,
      ip: req.ip
    });

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role
        },
        accessToken,
        refreshToken
      }
    });

  } catch (error) {
    logger.error('Login failed:', {
      error: error.message,
      email: req.body.email,
      ip: req.ip,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Login failed'
    });
  }
};

// Refresh Token Controller
const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        error: 'Refresh token required'
      });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    if (decoded.type !== 'refresh') {
      return res.status(401).json({
        success: false,
        error: 'Invalid refresh token'
      });
    }

    // Find user and check if refresh token exists
    const user = await User.findById(decoded.userId);

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Invalid refresh token'
      });
    }

    const tokenExists = user.refreshTokens.some(t => t.token === refreshToken);

    if (!tokenExists) {
      return res.status(401).json({
        success: false,
        error: 'Invalid refresh token'
      });
    }

    // Generate new tokens
    const tokens = generateTokens(user._id);

    // Remove old refresh token and add new one
    user.refreshTokens = user.refreshTokens.filter(t => t.token !== refreshToken);
    user.refreshTokens.push({
      token: tokens.refreshToken
    });

    await user.save();

    logger.info('Token refreshed successfully:', {
      userId: user._id
    });

    res.json({
      success: true,
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken
      }
    });

  } catch (error) {
    logger.error('Token refresh failed:', {
      error: error.message,
      stack: error.stack
    });

    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid refresh token'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Token refresh failed'
    });
  }
};

// Logout Controller
const logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const user = await User.findById(userId);

    if (user && refreshToken) {
      // Remove the specific refresh token
      user.refreshTokens = user.refreshTokens.filter(t => t.token !== refreshToken);
      await user.save();
    }

    logger.info('User logged out successfully:', {
      userId
    });

    res.json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    logger.error('Logout failed:', {
      error: error.message,
      userId: req.userId,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Logout failed'
    });
  }
};

// Get Profile Controller
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    if (!user || !user.isActive) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        }
      }
    });

  } catch (error) {
    logger.error('Get profile failed:', {
      error: error.message,
      userId: req.userId,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Failed to retrieve profile'
    });
  }
};

// Logout from all devices
const logoutAll = async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    if (user) {
      // Clear all refresh tokens
      user.refreshTokens = [];
      await user.save();
    }

    logger.info('User logged out from all devices:', {
      userId: req.userId
    });

    res.json({
      success: true,
      message: 'Logged out from all devices successfully'
    });

  } catch (error) {
    logger.error('Logout all failed:', {
      error: error.message,
      userId: req.userId,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      error: 'Logout failed'
    });
  }
};

module.exports = {
  register,
  login,
  refreshToken,
  logout,
  getProfile,
  logoutAll
};
