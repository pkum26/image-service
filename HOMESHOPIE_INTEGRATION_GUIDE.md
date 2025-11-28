# Homeshopie Website Integration Guide

## Image Service Integration for E-commerce Platform

This guide provides complete integration details for connecting your homeshopie website with the secure image service running on port 5000.

## Service Configuration

### Base URL
```
http://localhost:5000/api
```

### Service Status
- **Port**: 5000
- **Environment**: Development
- **Storage**: Local filesystem (`./uploads`)
- **Max File Size**: 5MB
- **Supported Formats**: JPG, JPEG, PNG, WebP

## Quick Start Integration

### 1. Authentication Setup

```javascript
// Authentication service for homeshopie
class ImageServiceAuth {
  constructor() {
    this.baseURL = 'http://localhost:5000/api';
    this.token = localStorage.getItem('image_service_token');
  }

  async register(userData) {
    const response = await fetch(`${this.baseURL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    
    const data = await response.json();
    if (data.success) {
      this.token = data.data.accessToken;
      localStorage.setItem('image_service_token', this.token);
      localStorage.setItem('refresh_token', data.data.refreshToken);
    }
    return data;
  }

  async login(email, password) {
    const response = await fetch(`${this.baseURL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    if (data.success) {
      this.token = data.data.accessToken;
      localStorage.setItem('image_service_token', this.token);
      localStorage.setItem('refresh_token', data.data.refreshToken);
    }
    return data;
  }

  getToken() {
    return this.token || localStorage.getItem('image_service_token');
  }
}
```

### 2. Product Image Upload

```javascript
// Product image upload service
class ProductImageService {
  constructor() {
    this.baseURL = 'http://localhost:5000/api';
    this.auth = new ImageServiceAuth();
  }

  async uploadProductImage(file, productData) {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('entityType', 'product');
    formData.append('productId', productData.id);
    formData.append('category', productData.category);
    formData.append('tags', productData.tags.join(','));
    formData.append('alt', productData.altText || `${productData.name} product image`);
    formData.append('title', productData.title || productData.name);

    const response = await fetch(`${this.baseURL}/images/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.auth.getToken()}`
      },
      body: formData
    });

    return await response.json();
  }

  async uploadMultipleImages(files, productData) {
    const formData = new FormData();
    
    // Add multiple files
    files.forEach(file => {
      formData.append('images[]', file);
    });
    
    formData.append('entityType', 'product');
    formData.append('productId', productData.id);
    formData.append('category', productData.category);

    const response = await fetch(`${this.baseURL}/images/bulk-upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.auth.getToken()}`
      },
      body: formData
    });

    return await response.json();
  }

  getImageURL(imageId, size = 'medium', accessToken) {
    return `${this.baseURL}/images/${imageId}?size=${size}&token=${accessToken}`;
  }

  async getProductImages(productId) {
    const response = await fetch(
      `${this.baseURL}/images?entityType=product&productId=${productId}`,
      {
        headers: {
          'Authorization': `Bearer ${this.auth.getToken()}`
        }
      }
    );
    
    return await response.json();
  }
}
```

## Frontend Components

### 3. React Upload Component

```jsx
import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

const ProductImageUpload = ({ productId, onUploadComplete }) => {
  const [uploading, setUploading] = useState(false);
  const [uploadedImages, setUploadedImages] = useState([]);
  const imageService = new ProductImageService();

  const onDrop = useCallback(async (acceptedFiles) => {
    setUploading(true);
    
    try {
      const productData = {
        id: productId,
        category: 'product',
        tags: ['product', 'ecommerce'],
        name: 'Product Image'
      };

      if (acceptedFiles.length === 1) {
        // Single file upload
        const result = await imageService.uploadProductImage(acceptedFiles[0], productData);
        if (result.success) {
          setUploadedImages([...uploadedImages, result.data]);
          onUploadComplete?.(result.data);
        }
      } else {
        // Multiple files upload
        const result = await imageService.uploadMultipleImages(acceptedFiles, productData);
        if (result.success) {
          setUploadedImages([...uploadedImages, ...result.data.uploaded]);
          onUploadComplete?.(result.data);
        }
      }
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  }, [productId, uploadedImages, onUploadComplete]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp']
    },
    maxSize: 5242880, // 5MB
    multiple: true,
    maxFiles: 10
  });

  return (
    <div className="image-upload-container">
      <div
        {...getRootProps()}
        className={`dropzone ${isDragActive ? 'active' : ''}`}
        style={{
          border: '2px dashed #ccc',
          borderRadius: '10px',
          padding: '20px',
          textAlign: 'center',
          cursor: 'pointer'
        }}
      >
        <input {...getInputProps()} />
        {uploading ? (
          <p>Uploading images...</p>
        ) : isDragActive ? (
          <p>Drop the images here...</p>
        ) : (
          <p>Drag & drop images here, or click to select files</p>
        )}
      </div>

      {/* Display uploaded images */}
      <div className="uploaded-images" style={{ marginTop: '20px' }}>
        {uploadedImages.map((img, index) => (
          <div key={img.imageId} className="image-preview" style={{ display: 'inline-block', margin: '10px' }}>
            <img
              src={img.urls.thumbnail}
              alt={img.alt}
              style={{ width: '100px', height: '100px', objectFit: 'cover' }}
            />
            <p style={{ fontSize: '12px' }}>{img.originalName}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProductImageUpload;
```

### 4. Image Display Component

```jsx
import React, { useState } from 'react';

const ProductImageGallery = ({ images, productName }) => {
  const [selectedSize, setSelectedSize] = useState('medium');
  const [selectedImage, setSelectedImage] = useState(0);

  const sizeOptions = [
    { value: 'thumbnail', label: 'Thumbnail (150px)' },
    { value: 'small', label: 'Small (300px)' },
    { value: 'medium', label: 'Medium (600px)' },
    { value: 'large', label: 'Large (1200px)' },
    { value: 'original', label: 'Original' }
  ];

  if (!images || images.length === 0) {
    return <div>No images available</div>;
  }

  return (
    <div className="product-gallery">
      {/* Size selector */}
      <div className="size-selector" style={{ marginBottom: '10px' }}>
        <label>Image Size: </label>
        <select 
          value={selectedSize} 
          onChange={(e) => setSelectedSize(e.target.value)}
        >
          {sizeOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Main image display */}
      <div className="main-image" style={{ marginBottom: '20px' }}>
        <img
          src={images[selectedImage].urls[selectedSize]}
          alt={images[selectedImage].alt || `${productName} image`}
          style={{ maxWidth: '100%', height: 'auto' }}
        />
      </div>

      {/* Thumbnail navigation */}
      <div className="thumbnails" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {images.map((image, index) => (
          <img
            key={image.imageId}
            src={image.urls.thumbnail}
            alt={image.alt}
            onClick={() => setSelectedImage(index)}
            style={{
              width: '80px',
              height: '80px',
              objectFit: 'cover',
              cursor: 'pointer',
              border: selectedImage === index ? '2px solid #007bff' : '2px solid transparent',
              borderRadius: '4px'
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default ProductImageGallery;
```

## API Usage Examples

### 5. Complete Integration Example

```javascript
// Complete homeshopie integration example
class HomeshopieImageIntegration {
  constructor() {
    this.imageService = new ProductImageService();
    this.auth = new ImageServiceAuth();
  }

  // Initialize authentication for a customer
  async initializeCustomer(customerData) {
    try {
      const result = await this.auth.register({
        username: customerData.username,
        email: customerData.email,
        password: customerData.password
      });
      
      return result;
    } catch (error) {
      console.error('Customer initialization failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Upload product images during product creation
  async createProductWithImages(productData, imageFiles) {
    const results = {
      product: productData,
      images: [],
      errors: []
    };

    try {
      // Upload images
      for (const file of imageFiles) {
        const uploadResult = await this.imageService.uploadProductImage(file, {
          id: productData.id,
          category: productData.category,
          tags: productData.tags || [],
          name: productData.name,
          altText: `${productData.name} - ${file.name}`,
          title: productData.name
        });

        if (uploadResult.success) {
          results.images.push(uploadResult.data);
        } else {
          results.errors.push({
            file: file.name,
            error: uploadResult.error
          });
        }
      }

      return results;
    } catch (error) {
      console.error('Product creation with images failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Get all images for a product
  async getProductGallery(productId) {
    try {
      const result = await this.imageService.getProductImages(productId);
      
      if (result.success) {
        return result.data.images.map(img => ({
          id: img.imageId,
          urls: img.urls,
          alt: img.alt,
          title: img.title,
          tags: img.tags
        }));
      }
      
      return [];
    } catch (error) {
      console.error('Failed to get product gallery:', error);
      return [];
    }
  }

  // Search images by category or tags
  async searchProductImages(searchParams) {
    const queryParams = new URLSearchParams();
    
    if (searchParams.category) queryParams.append('category', searchParams.category);
    if (searchParams.tags) queryParams.append('tags', searchParams.tags.join(','));
    if (searchParams.search) queryParams.append('search', searchParams.search);
    if (searchParams.entityType) queryParams.append('entityType', searchParams.entityType);

    try {
      const response = await fetch(
        `${this.imageService.baseURL}/images?${queryParams.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${this.auth.getToken()}`
          }
        }
      );

      return await response.json();
    } catch (error) {
      console.error('Image search failed:', error);
      return { success: false, error: error.message };
    }
  }
}
```

## Configuration & Deployment

### 6. Environment Setup for Production

```javascript
// Configuration for different environments
const config = {
  development: {
    imageServiceURL: 'http://localhost:5000/api',
    corsOrigin: 'http://localhost:3000'
  },
  production: {
    imageServiceURL: 'https://your-domain.com/api',
    corsOrigin: 'https://homeshopie.com'
  }
};

// Usage
const currentConfig = config[process.env.NODE_ENV || 'development'];
```

### 7. Error Handling

```javascript
// Centralized error handling for image operations
class ImageErrorHandler {
  static handleUploadError(error) {
    if (error.code === 'PAYLOAD_TOO_LARGE') {
      return 'Image file is too large. Maximum size is 5MB.';
    }
    
    if (error.code === 'VALIDATION_ERROR') {
      return 'Invalid image format. Please use JPG, PNG, or WebP.';
    }
    
    if (error.code === 'RATE_LIMIT_EXCEEDED') {
      return 'Too many uploads. Please wait before uploading more images.';
    }
    
    return 'Upload failed. Please try again.';
  }

  static handleAuthError(error) {
    if (error.code === 'UNAUTHORIZED') {
      // Redirect to login
      window.location.href = '/login';
      return;
    }
    
    return 'Authentication failed. Please login again.';
  }
}
```

## Testing Your Integration

### 8. Test the Service

```javascript
// Test script to verify integration
async function testImageService() {
  const integration = new HomeshopieImageIntegration();
  
  console.log('Testing image service integration...');
  
  try {
    // Test authentication
    const authResult = await integration.initializeCustomer({
      username: 'test_user',
      email: 'test@homeshopie.com',
      password: 'TestPass123!'
    });
    
    console.log('Auth test:', authResult.success ? 'PASSED' : 'FAILED');
    
    // Test image search
    const searchResult = await integration.searchProductImages({
      category: 'electronics',
      entityType: 'product'
    });
    
    console.log('Search test:', searchResult.success ? 'PASSED' : 'FAILED');
    
  } catch (error) {
    console.error('Integration test failed:', error);
  }
}

// Run test
testImageService();
```

## Service Endpoints Summary

| Endpoint | Method | Purpose | Authentication |
|----------|--------|---------|----------------|
| `/auth/register` | POST | Register new user | None |
| `/auth/login` | POST | User login | None |
| `/images/upload` | POST | Single image upload | Required |
| `/images/bulk-upload` | POST | Multiple image upload | Required |
| `/images/:id` | GET | Retrieve image | Token or Auth |
| `/images` | GET | List images with filters | Required |
| `/images/:id/metadata` | PATCH | Update image metadata | Required |
| `/images/:id` | PUT | Replace image | Required |
| `/images/:id` | DELETE | Delete image | Required |

## Next Steps

1. **Start the service**: `npm start` (runs on port 5000)
2. **Test endpoints**: Use the provided test scripts
3. **Integrate components**: Add React components to your homeshopie frontend
4. **Configure production**: Update CORS settings for your production domain
5. **Monitor usage**: Check logs in `./logs/` directory

Your image service is now ready for homeshopie integration with full e-commerce functionality!
