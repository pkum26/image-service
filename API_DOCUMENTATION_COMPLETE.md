# 📚 HomeShoppe Image Service - Complete API Documentation

## 🌐 Base Information

**Base URL:** `http://localhost:5000`  
**API Version:** 1.0.0  
**Authentication:** JWT Bearer Token  

## 🔐 Authentication Flow

### 1. Application Registration (One-time Setup)

Register your application to get API credentials.

**Endpoint:** `POST /api/applications/register`

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

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "application": {
      "id": "673c9a8f92bd6ebc1ee68b2f",
      "name": "homeshopie",
      "description": "E-commerce platform for home products and decor",
      "domain": "homeshopie.com",
      "allowedOrigins": ["https://homeshopie.com", "http://localhost:3000"],
      "plan": "free",
      "apiKey": "ak_ac79cbe81f7e7cd45887a5c44b4b7082",
      "apiSecret": "plain_text_secret_here",
      "limits": {
        "maxFileSize": 5242880,
        "maxImagesPerMonth": 1000,
        "maxStorageSize": 1073741824
      },
      "usage": {
        "totalImages": 0,
        "totalStorageUsed": 0,
        "currentMonthUploads": 0,
        "lastResetDate": "2025-11-28T06:00:00.000Z"
      },
      "settings": {
        "enablePublicAccess": true,
        "enableImageOptimization": true,
        "defaultImageQuality": 85,
        "allowedFormats": ["jpeg", "png", "webp"]
      },
      "createdAt": "2025-11-28T06:00:00.000Z"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### 2. Application Authentication

Get access token using your API credentials.

**Endpoint:** `POST /api/applications/authenticate`

**Request Body:**
```json
{
  "apiKey": "ak_ac79cbe81f7e7cd45887a5c44b4b7082",
  "apiSecret": "your_plain_text_secret_here"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "application": {
      "id": "673c9a8f92bd6ebc1ee68b2f",
      "name": "homeshopie",
      "domain": "homeshopie.com",
      "plan": "free",
      "limits": {
        "maxFileSize": 5242880,
        "maxImagesPerMonth": 1000,
        "maxStorageSize": 1073741824
      },
      "usage": {
        "totalImages": 0,
        "totalStorageUsed": 0,
        "currentMonthUploads": 0
      }
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### 3. Refresh Access Token

**Endpoint:** `POST /api/applications/refresh-token`

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

## 📷 Image Management APIs

### 4. Upload Image

Upload an image file with metadata.

**Endpoint:** `POST /api/images/upload`

**Headers:**
```
Authorization: Bearer {accessToken}
Content-Type: multipart/form-data
```

**Form Data:**
- `image` (File) - Image file (JPEG, PNG, WebP)
- `isPublic` (String) - "true" or "false" (default: "true")
- `alt` (String) - Alt text for accessibility
- `tags` (String) - JSON array of tags, e.g., `["product", "home-decor"]`
- `category` (String) - Image category

**Example Request (cURL):**
```bash
curl -X POST http://localhost:5000/api/images/upload \
  -H "Authorization: Bearer your_access_token" \
  -F "image=@product-image.jpg" \
  -F "isPublic=true" \
  -F "alt=Beautiful sofa for living room" \
  -F "tags=[\"product\", \"furniture\", \"sofa\"]" \
  -F "category=furniture"
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "image": {
      "id": "673c9b8f92bd6ebc1ee68b30",
      "filename": "product-image.jpg",
      "originalName": "sofa-image.jpg",
      "mimeType": "image/jpeg",
      "size": 245760,
      "url": "http://localhost:5000/uploads/673c9b8f92bd6ebc1ee68b30_product-image.jpg",
      "publicUrl": "http://localhost:5000/api/images/673c9b8f92bd6ebc1ee68b30/view",
      "isPublic": true,
      "alt": "Beautiful sofa for living room",
      "tags": ["product", "furniture", "sofa"],
      "category": "furniture",
      "metadata": {
        "width": 800,
        "height": 600,
        "format": "jpeg"
      },
      "uploadedBy": "673c9a8f92bd6ebc1ee68b2f",
      "createdAt": "2025-11-28T06:15:00.000Z",
      "updatedAt": "2025-11-28T06:15:00.000Z"
    }
  }
}
```

### 5. Get All Images

Retrieve paginated list of images.

**Endpoint:** `GET /api/images`

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Query Parameters:**
- `page` (Number) - Page number (default: 1)
- `limit` (Number) - Items per page (default: 10, max: 50)
- `tags` (String) - Filter by tag
- `category` (String) - Filter by category
- `isPublic` (Boolean) - Filter by public/private
- `search` (String) - Search in filename, alt text
- `sortBy` (String) - Sort field: "createdAt", "size", "filename"
- `sortOrder` (String) - "asc" or "desc" (default: "desc")

**Example Request:**
```
GET /api/images?page=1&limit=20&tags=product&category=furniture&sortBy=createdAt&sortOrder=desc
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "images": [
      {
        "id": "673c9b8f92bd6ebc1ee68b30",
        "filename": "product-image.jpg",
        "originalName": "sofa-image.jpg",
        "mimeType": "image/jpeg",
        "size": 245760,
        "url": "http://localhost:5000/uploads/673c9b8f92bd6ebc1ee68b30_product-image.jpg",
        "publicUrl": "http://localhost:5000/api/images/673c9b8f92bd6ebc1ee68b30/view",
        "isPublic": true,
        "alt": "Beautiful sofa for living room",
        "tags": ["product", "furniture", "sofa"],
        "category": "furniture",
        "metadata": {
          "width": 800,
          "height": 600,
          "format": "jpeg"
        },
        "createdAt": "2025-11-28T06:15:00.000Z",
        "updatedAt": "2025-11-28T06:15:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalImages": 1,
      "hasNext": false,
      "hasPrev": false
    }
  }
}
```

### 6. Get Single Image

Retrieve details of a specific image.

**Endpoint:** `GET /api/images/{imageId}`

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "image": {
      "id": "673c9b8f92bd6ebc1ee68b30",
      "filename": "product-image.jpg",
      "originalName": "sofa-image.jpg",
      "mimeType": "image/jpeg",
      "size": 245760,
      "url": "http://localhost:5000/uploads/673c9b8f92bd6ebc1ee68b30_product-image.jpg",
      "publicUrl": "http://localhost:5000/api/images/673c9b8f92bd6ebc1ee68b30/view",
      "isPublic": true,
      "alt": "Beautiful sofa for living room",
      "tags": ["product", "furniture", "sofa"],
      "category": "furniture",
      "metadata": {
        "width": 800,
        "height": 600,
        "format": "jpeg"
      },
      "uploadedBy": "673c9a8f92bd6ebc1ee68b2f",
      "createdAt": "2025-11-28T06:15:00.000Z",
      "updatedAt": "2025-11-28T06:15:00.000Z"
    }
  }
}
```

### 7. Update Image

Update image metadata (not the file itself).

**Endpoint:** `PATCH /api/images/{imageId}`

**Headers:**
```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**Request Body:**
```json
{
  "alt": "Updated alt text",
  "tags": ["updated", "tags"],
  "category": "new-category",
  "isPublic": false
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "image": {
      "id": "673c9b8f92bd6ebc1ee68b30",
      "alt": "Updated alt text",
      "tags": ["updated", "tags"],
      "category": "new-category",
      "isPublic": false,
      "updatedAt": "2025-11-28T06:30:00.000Z"
    }
  }
}
```

### 8. Delete Image

Delete an image permanently.

**Endpoint:** `DELETE /api/images/{imageId}`

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Image deleted successfully"
}
```

### 9. Get Image Information

Get comprehensive image metadata without downloading the file.

**Endpoint:** `GET /api/images/{imageId}/info`

**Headers:**
```
Authorization: Bearer {accessToken} (only required for private images)
```

**Query Parameters:**
- `token` (String) - Access token for private images (alternative to Authorization header)

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "imageId": "c7904139-6d1f-4ef9-9822-70627b0e8479",
    "originalName": "image.png",
    "filename": "d8d3a2ef-faf9-4491-9b05-d6f044a26db9_image.png",
    "size": 145655,
    "mimetype": "image/png",
    "isPublic": true,
    "metadata": {
      "width": 1400,
      "height": 898,
      "format": "png",
      "hasAlpha": false
    },
    "variants": {
      "thumbnail": {
        "width": 150,
        "height": 96,
        "size": 2210,
        "format": "webp"
      },
      "small": {
        "width": 300,
        "height": 192,
        "size": 7182,
        "format": "webp"
      },
      "medium": {
        "width": 600,
        "height": 385,
        "size": 22964,
        "format": "webp"
      },
      "large": {
        "width": 1200,
        "height": 770,
        "size": 66810,
        "format": "webp"
      },
      "original": {
        "width": null,
        "height": null,
        "format": "png"
      }
    },
    "category": "product",
    "tags": ["homeshoppie", "product"],
    "alt": "Product image - image.png",
    "title": "image.png",
    "entityType": "product",
    "entityId": "entity-123",
    "productId": "69285d5bfbf02472c1bd46dc",
    "accessCount": 3,
    "lastAccessedAt": "2025-11-29T03:00:06.081Z",
    "createdAt": "2025-11-29T02:52:26.943Z",
    "updatedAt": "2025-11-29T03:00:06.085Z",
    "urls": {
      "thumbnail": "http://localhost:5000/api/images/{id}?size=thumbnail",
      "small": "http://localhost:5000/api/images/{id}?size=small",
      "medium": "http://localhost:5000/api/images/{id}?size=medium",
      "large": "http://localhost:5000/api/images/{id}?size=large",
      "original": "http://localhost:5000/api/images/{id}",
      "info": "http://localhost:5000/api/images/{id}/info"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." // Only for private images
  }
}
```

**Use Cases:**
- Check image dimensions before displaying
- Validate image exists without downloading
- Get available size variants for responsive design
- Retrieve metadata for SEO (alt text, titles)
- Admin panels and image management interfaces

### 10. View Public Image

Access public image directly (no authentication required).

**Endpoint:** `GET /api/images/{imageId}/view`

**Response:** Image file (Content-Type: image/*)

---

## 🏢 Application Management APIs

### 10. Get Application Profile

Get current application details and usage statistics.

**Endpoint:** `GET /api/applications/profile`

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "application": {
      "id": "673c9a8f92bd6ebc1ee68b2f",
      "name": "homeshopie",
      "description": "E-commerce platform for home products and decor",
      "domain": "homeshopie.com",
      "allowedOrigins": ["https://homeshopie.com"],
      "plan": "free",
      "apiKey": "ak_ac79cbe81f7e7cd45887a5c44b4b7082",
      "limits": {
        "maxFileSize": 5242880,
        "maxImagesPerMonth": 1000,
        "maxStorageSize": 1073741824
      },
      "usage": {
        "totalImages": 25,
        "totalStorageUsed": 12582912,
        "currentMonthUploads": 25,
        "lastResetDate": "2025-11-01T00:00:00.000Z"
      },
      "settings": {
        "enablePublicAccess": true,
        "enableImageOptimization": true,
        "defaultImageQuality": 85,
        "allowedFormats": ["jpeg", "png", "webp"]
      },
      "createdAt": "2025-11-28T06:00:00.000Z",
      "updatedAt": "2025-11-28T06:00:00.000Z"
    }
  }
}
```

### 11. Update Application Settings

Update application configuration.

**Endpoint:** `PATCH /api/applications/settings`

**Headers:**
```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**Request Body:**
```json
{
  "description": "Updated description",
  "allowedOrigins": ["https://homeshopie.com", "https://www.homeshopie.com"],
  "settings": {
    "enablePublicAccess": false,
    "defaultImageQuality": 90,
    "enableImageOptimization": true
  }
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "application": {
      "id": "673c9a8f92bd6ebc1ee68b2f",
      "description": "Updated description",
      "allowedOrigins": ["https://homeshopie.com", "https://www.homeshopie.com"],
      "settings": {
        "enablePublicAccess": false,
        "defaultImageQuality": 90,
        "enableImageOptimization": true
      },
      "updatedAt": "2025-11-28T06:45:00.000Z"
    }
  }
}
```

### 12. Logout Application

Invalidate specific refresh token.

**Endpoint:** `POST /api/applications/logout`

**Headers:**
```
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### 13. Logout All Devices

Invalidate all refresh tokens for the application.

**Endpoint:** `POST /api/applications/logout-all`

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Logged out from all devices successfully"
}
```

---

## 👤 User Authentication APIs (Optional)

### 14. User Registration

**Endpoint:** `POST /api/auth/register`

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@homeshopie.com",
  "password": "securePassword123"
}
```

### 15. User Login

**Endpoint:** `POST /api/auth/login`

**Request Body:**
```json
{
  "email": "john@homeshopie.com",
  "password": "securePassword123"
}
```

---

## 🚨 Error Responses

All endpoints return standardized error responses:

### Validation Error (400)
```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    {
      "type": "field",
      "msg": "Image file is required",
      "path": "image",
      "location": "files"
    }
  ]
}
```

### Authentication Error (401)
```json
{
  "success": false,
  "error": "Invalid API credentials"
}
```

### Authorization Error (403)
```json
{
  "success": false,
  "error": "Access denied. Invalid token"
}
```

### Not Found Error (404)
```json
{
  "success": false,
  "error": "Image not found"
}
```

### Rate Limit Error (429)
```json
{
  "success": false,
  "error": "Too many requests, please try again later"
}
```

### Server Error (500)
```json
{
  "success": false,
  "error": "Internal server error"
}
```

---

## 📊 Rate Limits

- **General endpoints:** 100 requests per 15 minutes per IP
- **Authentication endpoints:** 5 requests per 15 minutes per IP
- **Upload endpoints:** 20 requests per 5 minutes per application

---

## 📝 Usage Limits by Plan

### Free Plan
- **Monthly uploads:** 1,000 images
- **Storage:** 1GB total
- **File size:** 5MB per image
- **Formats:** JPEG, PNG, WebP

### Basic Plan ($19/month)
- **Monthly uploads:** 5,000 images
- **Storage:** 5GB total
- **File size:** 10MB per image
- **Formats:** JPEG, PNG, WebP

### Premium Plan ($49/month)
- **Monthly uploads:** 25,000 images
- **Storage:** 25GB total
- **File size:** 20MB per image
- **Formats:** JPEG, PNG, WebP

### Enterprise Plan ($199/month)
- **Monthly uploads:** Unlimited
- **Storage:** Unlimited
- **File size:** 50MB per image
- **Formats:** All supported formats

---

## 🔧 Example Integration Code

### JavaScript/Node.js
```javascript
const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');

class ImageServiceAPI {
  constructor(apiKey, apiSecret, baseUrl = 'http://localhost:5000') {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.baseUrl = baseUrl;
    this.accessToken = null;
  }

  async authenticate() {
    const response = await fetch(`${this.baseUrl}/api/applications/authenticate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: this.apiKey,
        apiSecret: this.apiSecret
      })
    });
    
    const result = await response.json();
    if (result.success) {
      this.accessToken = result.data.accessToken;
      return true;
    }
    throw new Error(result.error);
  }

  async uploadImage(imagePath, options = {}) {
    if (!this.accessToken) await this.authenticate();
    
    const form = new FormData();
    form.append('image', fs.createReadStream(imagePath));
    form.append('isPublic', options.isPublic !== false ? 'true' : 'false');
    form.append('alt', options.alt || '');
    if (options.tags) form.append('tags', JSON.stringify(options.tags));
    if (options.category) form.append('category', options.category);

    const response = await fetch(`${this.baseUrl}/api/images/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        ...form.getHeaders()
      },
      body: form
    });

    return await response.json();
  }

  async getImages(options = {}) {
    if (!this.accessToken) await this.authenticate();
    
    const params = new URLSearchParams(options);
    const response = await fetch(`${this.baseUrl}/api/images?${params}`, {
      headers: { 'Authorization': `Bearer ${this.accessToken}` }
    });

    return await response.json();
  }

  async deleteImage(imageId) {
    if (!this.accessToken) await this.authenticate();
    
    const response = await fetch(`${this.baseUrl}/api/images/${imageId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${this.accessToken}` }
    });

    return await response.json();
  }
}

// Usage
const imageAPI = new ImageServiceAPI(
  'ak_ac79cbe81f7e7cd45887a5c44b4b7082',
  'your_plain_text_secret'
);

// Upload image
const uploadResult = await imageAPI.uploadImage('product.jpg', {
  isPublic: true,
  alt: 'Product image',
  tags: ['product', 'furniture'],
  category: 'furniture'
});

// Get images
const images = await imageAPI.getImages({ 
  page: 1, 
  limit: 20, 
  category: 'furniture' 
});

// Delete image
await imageAPI.deleteImage('image-id-here');
```

### Python
```python
import requests
import json

class ImageServiceAPI:
    def __init__(self, api_key, api_secret, base_url='http://localhost:5000'):
        self.api_key = api_key
        self.api_secret = api_secret
        self.base_url = base_url
        self.access_token = None

    def authenticate(self):
        response = requests.post(f'{self.base_url}/api/applications/authenticate', 
            json={
                'apiKey': self.api_key,
                'apiSecret': self.api_secret
            })
        
        result = response.json()
        if result['success']:
            self.access_token = result['data']['accessToken']
            return True
        raise Exception(result['error'])

    def upload_image(self, image_path, **options):
        if not self.access_token:
            self.authenticate()
        
        files = {'image': open(image_path, 'rb')}
        data = {
            'isPublic': str(options.get('isPublic', True)).lower(),
            'alt': options.get('alt', ''),
            'category': options.get('category', '')
        }
        
        if 'tags' in options:
            data['tags'] = json.dumps(options['tags'])
        
        headers = {'Authorization': f'Bearer {self.access_token}'}
        
        response = requests.post(f'{self.base_url}/api/images/upload',
            files=files, data=data, headers=headers)
        
        return response.json()

    def get_images(self, **params):
        if not self.access_token:
            self.authenticate()
        
        headers = {'Authorization': f'Bearer {self.access_token}'}
        response = requests.get(f'{self.base_url}/api/images',
            params=params, headers=headers)
        
        return response.json()

    def delete_image(self, image_id):
        if not self.access_token:
            self.authenticate()
        
        headers = {'Authorization': f'Bearer {self.access_token}'}
        response = requests.delete(f'{self.base_url}/api/images/{image_id}',
            headers=headers)
        
        return response.json()

# Usage
api = ImageServiceAPI('ak_ac79cbe81f7e7cd45887a5c44b4b7082', 'your_plain_text_secret')

# Upload image
result = api.upload_image('product.jpg', 
    isPublic=True, 
    alt='Product image',
    tags=['product', 'furniture'],
    category='furniture')

# Get images
images = api.get_images(page=1, limit=20, category='furniture')

# Delete image
api.delete_image('image-id-here')
```

---

## 🎯 Integration Checklist

- [ ] Register your application and save credentials securely
- [ ] Implement authentication flow in your backend
- [ ] Add image upload functionality to your forms
- [ ] Implement image gallery/management features
- [ ] Add error handling for API responses
- [ ] Set up rate limiting awareness
- [ ] Monitor usage statistics
- [ ] Implement image optimization settings
- [ ] Test all endpoints thoroughly
- [ ] Deploy to production environment

---

## 📞 Support

- **Dashboard:** http://localhost:5000/application-dashboard.html
- **Service Status:** All endpoints operational
- **Rate Limits:** Active and enforced
- **Authentication:** JWT-based, 24h token expiry

Your HomeShoppe Image Service is fully operational and ready for production use! 🚀
