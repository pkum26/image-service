// HomeShoppe Image Service Integration
// Complete code examples for using your image service in another application

const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');

class HomeshoppieImageService {
  constructor(apiKey, apiSecret, baseUrl = 'http://localhost:5000') {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.baseUrl = baseUrl;
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  // Step 1: Authenticate and get access token
  async authenticate() {
    try {
      const response = await fetch(`${this.baseUrl}/api/applications/authenticate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: this.apiKey,
          apiSecret: this.apiSecret
        })
      });

      const result = await response.json();

      console.log("Result =======", result)
      
      if (result.success) {
        this.accessToken = result.data.accessToken;
        // JWT tokens expire in 24 hours by default
        this.tokenExpiry = Date.now() + (24 * 60 * 60 * 1000);
        console.log('✅ Authentication successful');
        return true;
      } else {
        console.error('❌ Authentication failed:', result.error);
        return false;
      }
    } catch (error) {
      console.error('❌ Authentication error:', error.message);
      return false;
    }
  }

  // Check if token is valid and refresh if needed
  async ensureAuthenticated() {
    if (!this.accessToken || Date.now() >= this.tokenExpiry) {
      return await this.authenticate();
    }
    return true;
  }

  // Step 2: Upload an image
  async uploadImage(imagePath, options = {}) {
    if (!await this.ensureAuthenticated()) {
      throw new Error('Authentication failed');
    }

    try {
      const form = new FormData();
      
      // Add the image file
      if (typeof imagePath === 'string') {
        // File path
        form.append('image', fs.createReadStream(imagePath));
      } else if (imagePath.buffer) {
        // Buffer (from multer, etc.)
        form.append('image', imagePath.buffer, imagePath.originalname);
      } else {
        // File stream or buffer
        form.append('image', imagePath);
      }

      // Add optional metadata
      form.append('isPublic', options.isPublic !== false ? 'true' : 'false');
      form.append('alt', options.alt || '');
      
      if (options.tags) {
        form.append('tags', JSON.stringify(options.tags));
      }
      
      if (options.category) {
        form.append('category', options.category);
      }

      const response = await fetch(`${this.baseUrl}/api/images/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          ...form.getHeaders()
        },
        body: form
      });

      const result = await response.json();
      
      if (result.success) {
        console.log('✅ Image uploaded successfully:', result.data.image.filename);
        return result.data.image;
      } else {
        console.error('❌ Upload failed:', result.error);
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('❌ Upload error:', error.message);
      throw error;
    }
  }

  // Step 3: Get all images
  async getImages(options = {}) {
    if (!await this.ensureAuthenticated()) {
      throw new Error('Authentication failed');
    }

    try {
      const params = new URLSearchParams();
      
      if (options.page) params.append('page', options.page);
      if (options.limit) params.append('limit', options.limit);
      if (options.tags) params.append('tags', options.tags);
      if (options.isPublic !== undefined) params.append('isPublic', options.isPublic);
      if (options.category) params.append('category', options.category);

      const url = `${this.baseUrl}/api/images?${params.toString()}`;
      
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${this.accessToken}` }
      });

      const result = await response.json();
      
      if (result.success) {
        console.log(`✅ Retrieved ${result.data.images.length} images`);
        return result.data;
      } else {
        console.error('❌ Get images failed:', result.error);
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('❌ Get images error:', error.message);
      throw error;
    }
  }

  // Step 4: Get single image
  async getImage(imageId) {
    if (!await this.ensureAuthenticated()) {
      throw new Error('Authentication failed');
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/images/${imageId}`, {
        headers: { 'Authorization': `Bearer ${this.accessToken}` }
      });

      const result = await response.json();
      
      if (result.success) {
        console.log('✅ Image retrieved:', result.data.image.filename);
        return result.data.image;
      } else {
        console.error('❌ Get image failed:', result.error);
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('❌ Get image error:', error.message);
      throw error;
    }
  }

  // Step 5: Delete an image
  async deleteImage(imageId) {
    if (!await this.ensureAuthenticated()) {
      throw new Error('Authentication failed');
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/images/${imageId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${this.accessToken}` }
      });

      const result = await response.json();
      
      if (result.success) {
        console.log('✅ Image deleted successfully');
        return true;
      } else {
        console.error('❌ Delete failed:', result.error);
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('❌ Delete error:', error.message);
      throw error;
    }
  }

  // Get application usage statistics
  async getUsageStats() {
    if (!await this.ensureAuthenticated()) {
      throw new Error('Authentication failed');
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/applications/profile`, {
        headers: { 'Authorization': `Bearer ${this.accessToken}` }
      });

      const result = await response.json();
      
      if (result.success) {
        return result.data.application.usage;
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('❌ Usage stats error:', error.message);
      throw error;
    }
  }
}

// Example usage for HomeShoppe
async function homeshoppieExample() {
  console.log('🏠 HomeShoppe Image Service Integration Example\n');

  // Your credentials (you'll need to get the plain text API secret)
  const imageService = new HomeshoppieImageService(
    'ak_ac79cbe81f7e7cd45887a5c44b4b7082', // Your API key
    'YOUR_PLAIN_TEXT_API_SECRET_HERE'       // You need the original plain text secret
  );

  try {
    // 1. Upload a product image
    console.log('1. Uploading product image...');
    if (fs.existsSync('test-image.png')) {
      const uploadedImage = await imageService.uploadImage('test-image.png', {
        isPublic: true,
        alt: 'Beautiful home decor product',
        tags: ['product', 'home-decor', 'furniture'],
        category: 'furniture'
      });
      
      console.log('Uploaded image URL:', uploadedImage.url);
      console.log('Public URL:', uploadedImage.publicUrl);
      
      // 2. Get all images
      console.log('\n2. Getting all images...');
      const allImages = await imageService.getImages({ limit: 10 });
      console.log(`Found ${allImages.images.length} images`);
      
      // 3. Get single image
      console.log('\n3. Getting single image...');
      const singleImage = await imageService.getImage(uploadedImage.id);
      console.log('Image details:', singleImage.filename, singleImage.size);
      
      // 4. Get usage statistics
      console.log('\n4. Getting usage statistics...');
      const stats = await imageService.getUsageStats();
      console.log('Usage stats:', {
        totalImages: stats.totalImages,
        storageUsed: `${(stats.totalStorageUsed / 1024 / 1024).toFixed(2)} MB`,
        monthlyUploads: stats.currentMonthUploads
      });
      
      // 5. Delete image (uncomment if needed)
      // console.log('\n5. Deleting image...');
      // await imageService.deleteImage(uploadedImage.id);
      
    } else {
      console.log('❌ test-image.png not found, please add a test image');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Express.js integration example
function expressIntegration() {
  const express = require('express');
  const multer = require('multer');
  const app = express();
  const upload = multer();

  // Initialize image service
  const imageService = new HomeshoppieImageService(
    'ak_ac79cbe81f7e7cd45887a5c44b4b7082',
    'YOUR_PLAIN_TEXT_API_SECRET_HERE'
  );

  // Upload product image endpoint
  app.post('/api/products/upload-image', upload.single('image'), async (req, res) => {
    try {
      const uploadedImage = await imageService.uploadImage(req.file, {
        isPublic: true,
        alt: req.body.alt || '',
        tags: req.body.tags ? JSON.parse(req.body.tags) : ['product'],
        category: req.body.category || 'general'
      });

      res.json({
        success: true,
        image: {
          id: uploadedImage.id,
          url: uploadedImage.url,
          publicUrl: uploadedImage.publicUrl,
          filename: uploadedImage.filename
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Get product images endpoint
  app.get('/api/products/images', async (req, res) => {
    try {
      const images = await imageService.getImages({
        page: req.query.page || 1,
        limit: req.query.limit || 20,
        tags: req.query.tags,
        category: req.query.category
      });

      res.json({
        success: true,
        ...images
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Delete product image endpoint
  app.delete('/api/products/images/:imageId', async (req, res) => {
    try {
      await imageService.deleteImage(req.params.imageId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  return app;
}

// React component example
const reactComponentCode = `
import React, { useState, useEffect } from 'react';

const ProductImageManager = () => {
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);

  // Upload image
  const handleImageUpload = async (file) => {
    setUploading(true);
    
    const formData = new FormData();
    formData.append('image', file);
    formData.append('alt', 'Product image');
    formData.append('tags', JSON.stringify(['product', 'homeshoppie']));
    
    try {
      const response = await fetch('/api/products/upload-image', {
        method: 'POST',
        body: formData
      });
      
      const result = await response.json();
      
      if (result.success) {
        setImages([result.image, ...images]);
      }
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  };

  // Load images
  useEffect(() => {
    fetch('/api/products/images')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setImages(data.images);
        }
      });
  }, []);

  return (
    <div>
      <input 
        type="file" 
        accept="image/*"
        onChange={(e) => handleImageUpload(e.target.files[0])}
        disabled={uploading}
      />
      
      {uploading && <p>Uploading...</p>}
      
      <div className="image-grid">
        {images.map(image => (
          <div key={image.id}>
            <img src={image.url} alt={image.alt} style={{width: '200px'}} />
            <p>{image.filename}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
`;

console.log('🚀 HomeShoppe Image Service Integration Ready!');
console.log('📖 React Component Code:');
console.log(reactComponentCode);

// Uncomment to run the example
// homeshoppieExample();

module.exports = { HomeshoppieImageService, expressIntegration };
