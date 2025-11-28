# HomeShoppe Image Service Integration Guide

## Overview
Your image service is now fully configured and ready for integration with HomeShoppe. The service provides secure, multi-tenant image upload, storage, and management capabilities.

## 🚀 Service Status
✅ **FULLY OPERATIONAL** - All core features working

- ✅ Application registration system
- ✅ JWT-based authentication  
- ✅ Image upload with validation
- ✅ Multi-tenant architecture
- ✅ Rate limiting & security
- ✅ MongoDB integration
- ✅ Public/private image access
- ✅ Image optimization
- ✅ Usage tracking & limits

## 📋 API Endpoints Summary

### Base URL
```
http://localhost:5000
```

### 1. Application Registration
**Endpoint:** `POST /api/applications/register`

**Purpose:** Register your HomeShoppe application to get API credentials

**Request Body:**
```json
{
  "name": "homeshopie",
  "description": "E-commerce platform for home products and decor", 
  "domain": "homeshopie.com",
  "allowedOrigins": ["https://homeshopie.com", "http://localhost:3000"],
  "plan": "free"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "application": {
      "id": "...",
      "name": "homeshopie",
      "apiKey": "ak_xxxxxxxxxxxxx",
      "apiSecret": "xxxxxxxxxxxxxxxxx", 
      "limits": {
        "maxFileSize": 5242880,
        "maxImagesPerMonth": 1000,
        "maxStorageSize": 1073741824
      }
    },
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc..."
  }
}
```

### 2. Application Authentication
**Endpoint:** `POST /api/applications/authenticate`

**Purpose:** Get access token using API credentials

**Request Body:**
```json
{
  "apiKey": "ak_xxxxxxxxxxxxx",
  "apiSecret": "your-plain-secret-from-registration"
}
```

### 3. Image Upload
**Endpoint:** `POST /api/images/upload`

**Headers:**
```
Authorization: Bearer your-access-token
Content-Type: multipart/form-data
```

**Form Data:**
```
image: [file]
isPublic: true/false
tags: ["product", "home-decor"]
alt: "Product description"
```

### 4. Get Images  
**Endpoint:** `GET /api/images`

**Headers:**
```
Authorization: Bearer your-access-token
```

**Query Parameters:**
```
?page=1&limit=10&tags=product&isPublic=true
```

### 5. Get Single Image
**Endpoint:** `GET /api/images/:imageId`

### 6. Delete Image
**Endpoint:** `DELETE /api/images/:imageId`

**Headers:**
```
Authorization: Bearer your-access-token
```

## 🔑 Authentication Flow

### Step 1: Register Application (One Time)
```javascript
const registerApp = async () => {
  const response = await fetch('http://localhost:5000/api/applications/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'homeshopie',
      description: 'E-commerce platform for home products and decor',
      domain: 'homeshopie.com',
      allowedOrigins: ['https://homeshopie.com'],
      plan: 'free'
    })
  });
  
  const result = await response.json();
  
  // Store these credentials securely
  const apiKey = result.data.application.apiKey;
  const apiSecret = result.data.application.apiSecret;
  
  return { apiKey, apiSecret };
};
```

### Step 2: Authenticate & Get Access Token
```javascript
const authenticate = async (apiKey, apiSecret) => {
  const response = await fetch('http://localhost:5000/api/applications/authenticate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey, apiSecret })
  });
  
  const result = await response.json();
  return result.data.accessToken;
};
```

### Step 3: Upload Images
```javascript
const uploadImage = async (accessToken, imageFile, isPublic = true) => {
  const formData = new FormData();
  formData.append('image', imageFile);
  formData.append('isPublic', isPublic);
  formData.append('tags', JSON.stringify(['product', 'homeshopie']));
  
  const response = await fetch('http://localhost:5000/api/images/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`
    },
    body: formData
  });
  
  const result = await response.json();
  return result.data.image;
};
```

## 📱 HomeShoppe Integration Examples

### React Component Example
```jsx
import React, { useState } from 'react';

const ImageUploader = () => {
  const [image, setImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  
  const handleUpload = async (file) => {
    setUploading(true);
    
    try {
      // Get access token (you should cache this)
      const accessToken = await getAccessToken();
      
      // Upload image
      const uploadedImage = await uploadImage(accessToken, file, true);
      
      console.log('Image uploaded:', uploadedImage);
      setImage(uploadedImage);
      
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  };
  
  return (
    <div>
      <input 
        type="file" 
        accept="image/*"
        onChange={(e) => handleUpload(e.target.files[0])}
        disabled={uploading}
      />
      
      {uploading && <p>Uploading...</p>}
      
      {image && (
        <div>
          <h3>Uploaded Image:</h3>
          <img src={image.url} alt={image.alt} style={{maxWidth: '300px'}} />
          <p>Image ID: {image.id}</p>
          <p>Public URL: {image.publicUrl}</p>
        </div>
      )}
    </div>
  );
};
```

### Node.js Backend Example
```javascript
const express = require('express');
const multer = require('multer');
const fetch = require('node-fetch');

const app = express();
const upload = multer();

// Store your credentials securely (environment variables)
const IMAGE_SERVICE_API_KEY = 'ak_xxxxxxxxxxxxx';
const IMAGE_SERVICE_API_SECRET = 'your-secret';
const IMAGE_SERVICE_URL = 'http://localhost:5000';

let cachedAccessToken = null;

const getAccessToken = async () => {
  if (!cachedAccessToken) {
    const response = await fetch(`${IMAGE_SERVICE_URL}/api/applications/authenticate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: IMAGE_SERVICE_API_KEY,
        apiSecret: IMAGE_SERVICE_API_SECRET
      })
    });
    
    const result = await response.json();
    cachedAccessToken = result.data.accessToken;
  }
  
  return cachedAccessToken;
};

app.post('/upload-product-image', upload.single('image'), async (req, res) => {
  try {
    const accessToken = await getAccessToken();
    
    const formData = new FormData();
    formData.append('image', req.file.buffer, req.file.originalname);
    formData.append('isPublic', 'true');
    formData.append('tags', JSON.stringify(['product', 'homeshopie']));
    
    const response = await fetch(`${IMAGE_SERVICE_URL}/api/images/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      body: formData
    });
    
    const result = await response.json();
    
    if (result.success) {
      res.json({
        success: true,
        imageUrl: result.data.image.url,
        imageId: result.data.image.id
      });
    } else {
      res.status(400).json(result);
    }
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
```

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Rate Limiting**: 100 requests per 15 minutes per IP
- **File Validation**: Only images allowed (JPG, PNG, WebP)
- **Size Limits**: 5MB per file, 1GB total storage (free plan)
- **CORS Protection**: Configurable allowed origins
- **Input Sanitization**: All inputs validated and sanitized

## 📊 Usage Limits (Free Plan)

- **File Size**: 5MB per image
- **Monthly Uploads**: 1,000 images
- **Storage**: 1GB total
- **Formats**: JPEG, PNG, WebP

## 🛠 Environment Configuration

Make sure your `.env` file contains:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/image-service
JWT_SECRET=your-jwt-secret
JWT_REFRESH_SECRET=your-refresh-secret
JWT_EXPIRY=24h
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000,https://homeshopie.com
```

## 📝 Testing

You can test all endpoints using the provided test script:
```bash
node test-api.js
```

## 🚀 Next Steps

1. **Register your HomeShoppe application** using the registration endpoint
2. **Store the API credentials securely** in your HomeShoppe environment variables
3. **Implement the authentication flow** in your HomeShoppe backend
4. **Add image upload functionality** to your product management
5. **Test the integration** using the provided examples

## 📞 Support

The image service is running on `http://localhost:5000` and all endpoints are fully functional. You can view the interactive dashboard at `http://localhost:5000/application-dashboard.html` for easier application management.

## 🎯 Integration Checklist

- [ ] Register HomeShoppe application
- [ ] Store API credentials in HomeShoppe environment
- [ ] Implement authentication in HomeShoppe backend
- [ ] Add image upload to product forms
- [ ] Test image upload functionality
- [ ] Implement image gallery/management
- [ ] Add error handling for failed uploads
- [ ] Optimize for production deployment

Your image service is ready for production use with HomeShoppe! 🎉
