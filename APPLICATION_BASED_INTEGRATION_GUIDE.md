# Multi-Tenant Image Service Integration Guide

## Application-Based Architecture for Homeshopie

This guide provides complete integration details for connecting your homeshopie website with the **multi-tenant** secure image service running on port 5000. The service now uses an **application-based** architecture where each application (like homeshopie) registers independently and manages its own images.

## New Architecture Overview

### Base URL
```
http://localhost:5000/api
```

### Key Changes from Previous Version
- **Application Registration**: Each application must register separately
- **API Key Authentication**: Uses API Key + Secret instead of user accounts
- **Isolated Image Storage**: Each application's images are completely separate
- **Usage Limits**: Per-application limits and monitoring
- **Multi-tenancy**: Perfect for SaaS platforms serving multiple clients

### Service Status
- **Port**: 5000
- **Environment**: Development
- **Storage**: Local filesystem (`./uploads`)
- **Architecture**: Multi-tenant, application-based
- **Max File Size**: 5MB (configurable per application)
- **Supported Formats**: JPG, JPEG, PNG, WebP

## Getting Started - Application Registration

### Step 1: Register Homeshopie as an Application

```javascript
// Register homeshopie application
const registerApplication = async () => {
  const response = await fetch('http://localhost:5000/api/applications/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'homeshopie',
      description: 'E-commerce platform for home products and decor',
      domain: 'homeshopie.com',
      allowedOrigins: [
        'http://localhost:3000',
        'http://localhost:5000',
        'https://homeshopie.com',
        'https://www.homeshopie.com'
      ],
      plan: 'free' // or 'basic', 'premium', 'enterprise'
    })
  });

  const result = await response.json();
  
  if (result.success) {
    console.log('Application registered successfully!');
    console.log('API Key:', result.data.application.apiKey);
    console.log('API Secret:', result.data.application.apiSecret);
    console.log('Access Token:', result.data.accessToken);
    
    // IMPORTANT: Store these securely - the API secret is only shown once!
    localStorage.setItem('homeshopie_api_key', result.data.application.apiKey);
    localStorage.setItem('homeshopie_api_secret', result.data.application.apiSecret);
    localStorage.setItem('homeshopie_access_token', result.data.accessToken);
    localStorage.setItem('homeshopie_refresh_token', result.data.refreshToken);
    
    return result.data;
  } else {
    throw new Error(result.error);
  }
};
```

### Step 2: Application Authentication Service

```javascript
// Application authentication service for homeshopie
class HomeshopieImageService {
  constructor() {
    this.baseURL = 'http://localhost:5000/api';
    this.apiKey = localStorage.getItem('homeshopie_api_key');
    this.apiSecret = localStorage.getItem('homeshopie_api_secret');
    this.accessToken = localStorage.getItem('homeshopie_access_token');
    this.refreshToken = localStorage.getItem('homeshopie_refresh_token');
  }

  // Authenticate using API credentials
  async authenticate() {
    const response = await fetch(`${this.baseURL}/applications/authenticate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        apiKey: this.apiKey,
        apiSecret: this.apiSecret
      })
    });

    const result = await response.json();
    
    if (result.success) {
      this.accessToken = result.data.accessToken;
      this.refreshToken = result.data.refreshToken;
      
      // Store new tokens
      localStorage.setItem('homeshopie_access_token', this.accessToken);
      localStorage.setItem('homeshopie_refresh_token', this.refreshToken);
      
      return result.data;
    } else {
      throw new Error(result.error);
    }
  }

  // Refresh access token
  async refreshAccessToken() {
    try {
      const response = await fetch(`${this.baseURL}/applications/refresh-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refreshToken: this.refreshToken
        })
      });

      const result = await response.json();
      
      if (result.success) {
        this.accessToken = result.data.accessToken;
        this.refreshToken = result.data.refreshToken;
        
        localStorage.setItem('homeshopie_access_token', this.accessToken);
        localStorage.setItem('homeshopie_refresh_token', this.refreshToken);
        
        return true;
      }
      return false;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return false;
    }
  }

  // Get current access token
  getAccessToken() {
    return this.accessToken;
  }

  // Make authenticated request with auto token refresh
  async makeAuthenticatedRequest(url, options = {}) {
    let response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${this.accessToken}`
      }
    });

    // If unauthorized, try to refresh token and retry
    if (response.status === 401) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) {
        response = await fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            'Authorization': `Bearer ${this.accessToken}`
          }
        });
      }
    }

    return response;
  }
}
```

## Image Upload and Management

### Step 3: Product Image Upload

```javascript
// Enhanced product image service for homeshopie
class HomeshopieProductImageService extends HomeshopieImageService {
  
  // Upload single product image
  async uploadProductImage(file, productData) {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('entityType', 'product');
    formData.append('entityId', productData.id);
    formData.append('productId', productData.id);
    formData.append('category', productData.category || 'product');
    formData.append('tags', productData.tags ? productData.tags.join(',') : '');
    formData.append('alt', productData.altText || `${productData.name} product image`);
    formData.append('title', productData.title || productData.name);

    const response = await this.makeAuthenticatedRequest(`${this.baseURL}/images/upload`, {
      method: 'POST',
      body: formData
    });

    return await response.json();
  }

  // Upload multiple product images
  async uploadProductGallery(files, productData) {
    const formData = new FormData();
    
    // Add multiple files
    files.forEach(file => {
      formData.append('images[]', file);
    });
    
    formData.append('entityType', 'product');
    formData.append('entityId', productData.id);
    formData.append('productId', productData.id);
    formData.append('category', productData.category || 'product');

    const response = await this.makeAuthenticatedRequest(`${this.baseURL}/images/bulk-upload`, {
      method: 'POST',
      body: formData
    });

    return await response.json();
  }

  // Get product images
  async getProductImages(productId, options = {}) {
    const queryParams = new URLSearchParams({
      entityType: 'product',
      productId: productId,
      ...options
    });

    const response = await this.makeAuthenticatedRequest(
      `${this.baseURL}/images?${queryParams.toString()}`
    );
    
    return await response.json();
  }

  // Get image URL with specific size
  getImageURL(imageId, size = 'medium', accessToken) {
    return `${this.baseURL}/images/${imageId}?size=${size}&token=${accessToken}`;
  }

  // Update product image metadata
  async updateImageMetadata(imageId, metadata) {
    const response = await this.makeAuthenticatedRequest(`${this.baseURL}/images/${imageId}/metadata`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(metadata)
    });

    return await response.json();
  }

  // Delete product image
  async deleteImage(imageId) {
    const response = await this.makeAuthenticatedRequest(`${this.baseURL}/images/${imageId}`, {
      method: 'DELETE'
    });

    return await response.json();
  }

  // Replace existing image
  async replaceImage(imageId, newFile) {
    const formData = new FormData();
    formData.append('image', newFile);

    const response = await this.makeAuthenticatedRequest(`${this.baseURL}/images/${imageId}`, {
      method: 'PUT',
      body: formData
    });

    return await response.json();
  }

  // Search images across all products
  async searchImages(searchParams) {
    const queryParams = new URLSearchParams(searchParams);
    
    const response = await this.makeAuthenticatedRequest(
      `${this.baseURL}/images?${queryParams.toString()}`
    );

    return await response.json();
  }

  // Get application profile and usage stats
  async getApplicationProfile() {
    const response = await this.makeAuthenticatedRequest(`${this.baseURL}/applications/profile`);
    return await response.json();
  }

  // Get image categories
  async getCategories() {
    const response = await this.makeAuthenticatedRequest(`${this.baseURL}/images/categories/list`);
    return await response.json();
  }
}
```

## React Components for Homeshopie

### Step 4: Product Image Upload Component

```jsx
import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

const HomeshopieImageUpload = ({ productId, productData, onUploadComplete }) => {
  const [uploading, setUploading] = useState(false);
  const [uploadedImages, setUploadedImages] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(null);
  
  const imageService = new HomeshopieProductImageService();

  const onDrop = useCallback(async (acceptedFiles) => {
    setUploading(true);
    setUploadProgress({ current: 0, total: acceptedFiles.length });

    try {
      if (acceptedFiles.length === 1) {
        // Single file upload
        const result = await imageService.uploadProductImage(acceptedFiles[0], {
          id: productId,
          ...productData
        });
        
        if (result.success) {
          setUploadedImages([...uploadedImages, result.data]);
          onUploadComplete?.(result.data);
        } else {
          console.error('Upload failed:', result.error);
          alert(`Upload failed: ${result.error}`);
        }
      } else {
        // Multiple files upload
        const result = await imageService.uploadProductGallery(acceptedFiles, {
          id: productId,
          ...productData
        });
        
        if (result.success) {
          setUploadedImages([...uploadedImages, ...result.data.uploaded]);
          onUploadComplete?.(result.data);
          
          if (result.data.errors.length > 0) {
            console.warn('Some uploads failed:', result.data.errors);
          }
        } else {
          console.error('Bulk upload failed:', result.error);
          alert(`Bulk upload failed: ${result.error}`);
        }
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert(`Upload error: ${error.message}`);
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }, [productId, productData, uploadedImages, onUploadComplete]);

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

  const removeImage = async (imageId) => {
    try {
      const result = await imageService.deleteImage(imageId);
      if (result.success) {
        setUploadedImages(uploadedImages.filter(img => img.imageId !== imageId));
      } else {
        alert(`Delete failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert(`Delete error: ${error.message}`);
    }
  };

  return (
    <div className="homeshopie-image-upload">
      <div
        {...getRootProps()}
        className={`dropzone ${isDragActive ? 'active' : ''} ${uploading ? 'uploading' : ''}`}
        style={{
          border: '2px dashed #ddd',
          borderRadius: '8px',
          padding: '40px 20px',
          textAlign: 'center',
          cursor: uploading ? 'not-allowed' : 'pointer',
          backgroundColor: isDragActive ? '#f0f8ff' : '#fafafa'
        }}
      >
        <input {...getInputProps()} />
        {uploading ? (
          <div>
            <div className="spinner" />
            <p>Uploading images...</p>
            {uploadProgress && (
              <p>{uploadProgress.current} of {uploadProgress.total} uploaded</p>
            )}
          </div>
        ) : isDragActive ? (
          <p>Drop the images here...</p>
        ) : (
          <div>
            <p>📸 Drag & drop product images here, or click to select</p>
            <small>Supports JPG, PNG, WebP • Max 5MB per file • Up to 10 files</small>
          </div>
        )}
      </div>

      {/* Display uploaded images */}
      {uploadedImages.length > 0 && (
        <div className="uploaded-images" style={{ marginTop: '20px' }}>
          <h4>Uploaded Images ({uploadedImages.length})</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '15px' }}>
            {uploadedImages.map((img) => (
              <div key={img.imageId} className="image-card" style={{ position: 'relative' }}>
                <img
                  src={img.urls.thumbnail}
                  alt={img.alt}
                  style={{
                    width: '100%',
                    height: '150px',
                    objectFit: 'cover',
                    borderRadius: '4px'
                  }}
                />
                <button
                  onClick={() => removeImage(img.imageId)}
                  style={{
                    position: 'absolute',
                    top: '5px',
                    right: '5px',
                    background: 'rgba(255,0,0,0.8)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '50%',
                    width: '24px',
                    height: '24px',
                    cursor: 'pointer'
                  }}
                >
                  ×
                </button>
                <div style={{ padding: '8px', fontSize: '12px' }}>
                  <strong>{img.title}</strong>
                  <br />
                  <span style={{ color: '#666' }}>
                    {Math.round(img.size / 1024)}KB • {img.metadata.width}×{img.metadata.height}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default HomeshopieImageUpload;
```

### Step 5: Product Image Gallery Component

```jsx
import React, { useState, useEffect } from 'react';

const HomeshopieProductGallery = ({ productId, productName, showSizeSelector = true }) => {
  const [images, setImages] = useState([]);
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedSize, setSelectedSize] = useState('medium');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const imageService = new HomeshopieProductImageService();

  const sizeOptions = [
    { value: 'thumbnail', label: 'Thumbnail (150px)', description: 'For product lists' },
    { value: 'small', label: 'Small (300px)', description: 'For mobile view' },
    { value: 'medium', label: 'Medium (600px)', description: 'For desktop view' },
    { value: 'large', label: 'Large (1200px)', description: 'For zoom/lightbox' },
    { value: 'original', label: 'Original', description: 'Full resolution' }
  ];

  useEffect(() => {
    loadProductImages();
  }, [productId]);

  const loadProductImages = async () => {
    try {
      setLoading(true);
      const result = await imageService.getProductImages(productId, {
        sort: 'newest'
      });

      if (result.success) {
        setImages(result.data.images);
        if (result.data.images.length > 0) {
          setSelectedImage(0);
        }
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px' }}>
        <div className="spinner" />
        <p>Loading product images...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: 'red' }}>
        <p>Error loading images: {error}</p>
        <button onClick={loadProductImages}>Retry</button>
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
        <p>No images available for this product</p>
      </div>
    );
  }

  return (
    <div className="homeshopie-product-gallery">
      {/* Size selector */}
      {showSizeSelector && (
        <div className="size-selector" style={{ marginBottom: '15px' }}>
          <label style={{ fontWeight: 'bold', marginRight: '10px' }}>Image Size: </label>
          <select 
            value={selectedSize} 
            onChange={(e) => setSelectedSize(e.target.value)}
            style={{ padding: '5px 10px', borderRadius: '4px', border: '1px solid #ddd' }}
          >
            {sizeOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label} - {option.description}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Main image display */}
      <div className="main-image" style={{ marginBottom: '20px', textAlign: 'center' }}>
        <img
          src={images[selectedImage].urls[selectedSize]}
          alt={images[selectedImage].alt || `${productName} image ${selectedImage + 1}`}
          style={{ 
            maxWidth: '100%', 
            height: 'auto',
            maxHeight: '500px',
            borderRadius: '8px',
            boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
          }}
        />
        
        {/* Image metadata */}
        <div style={{ marginTop: '10px', fontSize: '14px', color: '#666' }}>
          <p><strong>{images[selectedImage].title || images[selectedImage].originalName}</strong></p>
          <p>
            {images[selectedImage].metadata.width} × {images[selectedImage].metadata.height} • 
            {Math.round(images[selectedImage].size / 1024)}KB • 
            {images[selectedImage].mimetype}
          </p>
          {images[selectedImage].tags && images[selectedImage].tags.length > 0 && (
            <p>
              Tags: {images[selectedImage].tags.map(tag => (
                <span key={tag} style={{ 
                  background: '#e9ecef', 
                  padding: '2px 6px', 
                  margin: '0 2px', 
                  borderRadius: '3px',
                  fontSize: '12px'
                }}>
                  {tag}
                </span>
              ))}
            </p>
          )}
        </div>
      </div>

      {/* Thumbnail navigation */}
      {images.length > 1 && (
        <div className="thumbnails" style={{ 
          display: 'flex', 
          gap: '10px', 
          flexWrap: 'wrap',
          justifyContent: 'center'
        }}>
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
                border: selectedImage === index ? '3px solid #007bff' : '2px solid #ddd',
                borderRadius: '6px',
                transition: 'border-color 0.2s'
              }}
            />
          ))}
        </div>
      )}

      {/* Image counter */}
      {images.length > 1 && (
        <p style={{ textAlign: 'center', marginTop: '10px', color: '#666' }}>
          Image {selectedImage + 1} of {images.length}
        </p>
      )}
    </div>
  );
};

export default HomeshopieProductGallery;
```

## Application Management

### Step 6: Application Dashboard Component

```jsx
import React, { useState, useEffect } from 'react';

const HomeshopieImageDashboard = () => {
  const [applicationProfile, setApplicationProfile] = useState(null);
  const [recentImages, setRecentImages] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const imageService = new HomeshopieProductImageService();

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      const [profileResult, imagesResult, categoriesResult] = await Promise.all([
        imageService.getApplicationProfile(),
        imageService.searchImages({ limit: 10, sort: 'newest' }),
        imageService.getCategories()
      ]);

      if (profileResult.success) {
        setApplicationProfile(profileResult.data.application);
      }
      
      if (imagesResult.success) {
        setRecentImages(imagesResult.data.images);
      }
      
      if (categoriesResult.success) {
        setCategories(categoriesResult.data.categories);
      }
    } catch (error) {
      console.error('Dashboard load error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading dashboard...</div>;
  }

  return (
    <div className="homeshopie-dashboard">
      <h2>Homeshopie Image Service Dashboard</h2>

      {/* Application Info */}
      {applicationProfile && (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
          gap: '20px',
          marginBottom: '30px'
        }}>
          <div className="stats-card" style={{ padding: '20px', background: '#f8f9fa', borderRadius: '8px' }}>
            <h3>Application Info</h3>
            <p><strong>Name:</strong> {applicationProfile.name}</p>
            <p><strong>Plan:</strong> {applicationProfile.plan}</p>
            <p><strong>Domain:</strong> {applicationProfile.domain}</p>
            <p><strong>Created:</strong> {new Date(applicationProfile.createdAt).toLocaleDateString()}</p>
          </div>

          <div className="stats-card" style={{ padding: '20px', background: '#f8f9fa', borderRadius: '8px' }}>
            <h3>Usage Statistics</h3>
            <p><strong>Total Images:</strong> {applicationProfile.usage.totalImages}</p>
            <p><strong>Storage Used:</strong> {Math.round(applicationProfile.usage.totalStorageUsed / 1024 / 1024)}MB</p>
            <p><strong>This Month:</strong> {applicationProfile.usage.currentMonthUploads} uploads</p>
          </div>

          <div className="stats-card" style={{ padding: '20px', background: '#f8f9fa', borderRadius: '8px' }}>
            <h3>Limits</h3>
            <p><strong>Monthly Limit:</strong> {applicationProfile.limits.maxImagesPerMonth} images</p>
            <p><strong>Storage Limit:</strong> {Math.round(applicationProfile.limits.maxStorageSize / 1024 / 1024)}MB</p>
            <p><strong>File Size Limit:</strong> {Math.round(applicationProfile.limits.maxFileSize / 1024 / 1024)}MB</p>
          </div>
        </div>
      )}

      {/* Categories */}
      {categories.length > 0 && (
        <div style={{ marginBottom: '30px' }}>
          <h3>Image Categories</h3>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {categories.map(category => (
              <span key={category} style={{
                background: '#007bff',
                color: 'white',
                padding: '6px 12px',
                borderRadius: '20px',
                fontSize: '14px'
              }}>
                {category}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recent Images */}
      {recentImages.length > 0 && (
        <div>
          <h3>Recent Images</h3>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', 
            gap: '15px' 
          }}>
            {recentImages.map(image => (
              <div key={image.imageId} className="recent-image-card" style={{
                border: '1px solid #ddd',
                borderRadius: '8px',
                overflow: 'hidden'
              }}>
                <img 
                  src={image.urls.small} 
                  alt={image.alt}
                  style={{ width: '100%', height: '150px', objectFit: 'cover' }}
                />
                <div style={{ padding: '10px' }}>
                  <h4 style={{ margin: '0 0 5px 0', fontSize: '14px' }}>{image.title}</h4>
                  <p style={{ margin: '0', fontSize: '12px', color: '#666' }}>
                    {image.category} • {Math.round(image.size / 1024)}KB
                  </p>
                  <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#666' }}>
                    {new Date(image.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default HomeshopieImageDashboard;
```

## Error Handling and Best Practices

### Step 7: Centralized Error Handling

```javascript
// Enhanced error handling for homeshopie
class HomeshopieImageErrorHandler {
  static handleApiError(error, context = '') {
    console.error(`Homeshopie Image Service Error (${context}):`, error);

    if (error.details && Array.isArray(error.details)) {
      // Upload limits exceeded
      return {
        type: 'LIMIT_EXCEEDED',
        message: 'Upload limits exceeded',
        details: error.details,
        userMessage: `Upload failed: ${error.details.join(', ')}`
      };
    }

    switch (error.code) {
      case 'VALIDATION_ERROR':
        return {
          type: 'VALIDATION',
          message: 'Invalid image format or data',
          userMessage: 'Please check your image format. Only JPG, PNG, and WebP are supported.'
        };
        
      case 'UNAUTHORIZED':
        return {
          type: 'AUTH',
          message: 'Authentication required',
          userMessage: 'Please refresh the page and try again.',
          action: 'REFRESH_AUTH'
        };
        
      case 'RATE_LIMIT_EXCEEDED':
        return {
          type: 'RATE_LIMIT',
          message: 'Too many requests',
          userMessage: 'Please wait a moment before uploading more images.'
        };
        
      case 'NOT_FOUND':
        return {
          type: 'NOT_FOUND',
          message: 'Image or resource not found',
          userMessage: 'The requested image could not be found.'
        };
        
      default:
        return {
          type: 'UNKNOWN',
          message: error.message || 'Unknown error occurred',
          userMessage: 'An unexpected error occurred. Please try again.'
        };
    }
  }

  static async handleWithRetry(apiCall, maxRetries = 3, delay = 1000) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await apiCall();
      } catch (error) {
        const handled = this.handleApiError(error, `Attempt ${i + 1}`);
        
        if (handled.action === 'REFRESH_AUTH' && i < maxRetries - 1) {
          // Try to refresh authentication
          const imageService = new HomeshopieProductImageService();
