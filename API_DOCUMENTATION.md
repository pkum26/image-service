# Secure Image Service API Documentation

## Overview

A secure image service built with Node.js that provides secure image upload, download, delete, and replace functionality with JWT authentication, comprehensive security measures, and support for both local and S3 cloud storage.

## Base URL
```
http://localhost:3000/api
```

## Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Response Format

All API responses follow this consistent format:

### Success Response
```json
{
  "success": true,
  "data": {
    // Response data
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE" // Optional error code
}
```

## Authentication Endpoints

### Register User
**POST** `/auth/register`

Register a new user account.

**Request Body:**
```json
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

**Validation Requirements:**
- Username: 3-30 characters, alphanumeric, hyphens, underscores only
- Email: Valid email format
- Password: Minimum 8 characters with at least one lowercase, uppercase, number, and special character

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_id",
      "username": "john_doe",
      "email": "john@example.com",
      "role": "user",
      "createdAt": "2023-01-01T00:00:00.000Z"
    },
    "accessToken": "jwt_access_token",
    "refreshToken": "jwt_refresh_token"
  }
}
```

### Login
**POST** `/auth/login`

Authenticate user and receive tokens.

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_id",
      "username": "john_doe",
      "email": "john@example.com",
      "role": "user"
    },
    "accessToken": "jwt_access_token",
    "refreshToken": "jwt_refresh_token"
  }
}
```

### Refresh Token
**POST** `/auth/refresh-token`

Get new access token using refresh token.

**Request Body:**
```json
{
  "refreshToken": "jwt_refresh_token"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "new_jwt_access_token",
    "refreshToken": "new_jwt_refresh_token"
  }
}
```

### Get Profile
**GET** `/auth/profile`

Get current user profile information.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_id",
      "username": "john_doe",
      "email": "john@example.com",
      "role": "user",
      "createdAt": "2023-01-01T00:00:00.000Z",
      "updatedAt": "2023-01-01T00:00:00.000Z"
    }
  }
}
```

### Logout
**POST** `/auth/logout`

Logout user and invalidate refresh token.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "refreshToken": "jwt_refresh_token"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### Logout All Devices
**POST** `/auth/logout-all`

Logout user from all devices.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Logged out from all devices successfully"
}
```

## Image Endpoints

### Upload Image
**POST** `/images/upload`

Upload a new image file with automatic optimization and size variants generation.

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: multipart/form-data
```

**Form Data:**
- `image` (file): Image file (JPG, PNG, WebP only, max 5MB)
- `entityId` (string, optional): ID to associate with specific entity
- `entityType` (string, optional): Type of entity (e.g., 'profile', 'product')
- `productId` (string, optional): Specific product ID for ecommerce
- `category` (string, optional): Image category (default: 'uncategorized')
- `tags` (string, optional): Comma-separated tags for the image
- `alt` (string, optional): Alt text for accessibility
- `title` (string, optional): Title for the image

**Response:**
```json
{
  "success": true,
  "data": {
    "imageId": "550e8400-e29b-41d4-a716-446655440000",
    "originalName": "photo.jpg",
    "filename": "550e8400-e29b-41d4-a716-446655440000_photo.jpg",
    "size": 1048576,
    "mimetype": "image/jpeg",
    "uploadedAt": "2023-01-01T00:00:00.000Z",
    "metadata": {
      "width": 1920,
      "height": 1080,
      "format": "jpeg",
      "hasAlpha": false
    },
    "variants": {
      "thumbnail": {
        "path": "uploads/variants/.../thumbnail.webp",
        "size": 15360,
        "width": 150,
        "height": 150,
        "format": "webp"
      },
      "small": { "width": 300, "height": 300, "..." },
      "medium": { "width": 600, "height": 600, "..." },
      "large": { "width": 1200, "height": 1200, "..." },
      "original": { "path": "...", "width": 1920, "height": 1080 }
    },
    "category": "product",
    "tags": ["electronics", "smartphone"],
    "alt": "Product image",
    "title": "iPhone 15 Pro",
    "accessUrl": "/api/images/550e8400-e29b-41d4-a716-446655440000?token=access_token",
    "accessToken": "signed_access_token",
    "urls": {
      "thumbnail": "/api/images/550e8400-e29b-41d4-a716-446655440000?size=thumbnail&token=access_token",
      "small": "/api/images/550e8400-e29b-41d4-a716-446655440000?size=small&token=access_token",
      "medium": "/api/images/550e8400-e29b-41d4-a716-446655440000?size=medium&token=access_token",
      "large": "/api/images/550e8400-e29b-41d4-a716-446655440000?size=large&token=access_token",
      "original": "/api/images/550e8400-e29b-41d4-a716-446655440000?token=access_token"
    }
  }
}
```

### Bulk Upload Images
**POST** `/images/bulk-upload`

Upload multiple images at once (up to 10 files per request).

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: multipart/form-data
```

**Form Data:**
- `images[]` (files): Array of image files (JPG, PNG, WebP only, max 5MB each)
- `entityId` (string, optional): ID to associate with all images
- `entityType` (string, optional): Type of entity (e.g., 'profile', 'product')
- `productId` (string, optional): Specific product ID for ecommerce
- `category` (string, optional): Category for all images (default: 'uncategorized')

**Response:**
```json
{
  "success": true,
  "data": {
    "uploaded": [
      {
        "imageId": "550e8400-e29b-41d4-a716-446655440000",
        "originalName": "photo1.jpg",
        "filename": "550e8400-e29b-41d4-a716-446655440000_photo1.jpg",
        "size": 1048576,
        "accessUrl": "/api/images/550e8400-e29b-41d4-a716-446655440000?token=access_token",
        "accessToken": "signed_access_token"
      },
      {
        "imageId": "660f9511-f3ac-52e5-b827-557766551111",
        "originalName": "photo2.jpg",
        "filename": "660f9511-f3ac-52e5-b827-557766551111_photo2.jpg",
        "size": 2097152,
        "accessUrl": "/api/images/660f9511-f3ac-52e5-b827-557766551111?token=access_token",
        "accessToken": "signed_access_token"
      }
    ],
    "errors": [],
    "summary": {
      "total": 2,
      "successful": 2,
      "failed": 0
    }
  }
}
```

### Get Image
**GET** `/images/:imageId`

Retrieve an image file with size variant support.

**Parameters:**
- `imageId` (string): UUID of the image

**Query Parameters:**
- `token` (string, optional): Signed access token for public access
- `size` (string, optional): Image size variant ('thumbnail', 'small', 'medium', 'large', 'original'). Default: 'original'

**Alternative Authentication:**
- Authorization header with Bearer token

**Response:**
- Returns the actual image file with appropriate headers
- Content-Type: image/jpeg, image/png, image/webp (variants are WebP for better compression)
- Cache-Control: public, max-age=31536000
- ETag and Last-Modified headers for caching

**Size Variants:**
- `thumbnail`: 150x150px (WebP)
- `small`: 300x300px (WebP)
- `medium`: 600x600px (WebP)
- `large`: 1200x1200px (WebP)
- `original`: Original uploaded image

**Examples:**
```
GET /api/images/550e8400-e29b-41d4-a716-446655440000?size=thumbnail&token=ACCESS_TOKEN
GET /api/images/550e8400-e29b-41d4-a716-446655440000?size=large&token=ACCESS_TOKEN
```

### List Images
**GET** `/images`

Get list of user's uploaded images with advanced filtering, search, and pagination.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Query Parameters:**
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 20, max: 100)
- `entityId` (string, optional): Filter by entity ID
- `entityType` (string, optional): Filter by entity type
- `productId` (string, optional): Filter by product ID
- `category` (string, optional): Filter by category
- `tags` (string, optional): Filter by tags (comma-separated)
- `search` (string, optional): Search in image name, title, alt text, and tags
- `sort` (string, optional): Sort order ('name', 'size', 'accessed', 'oldest'). Default: newest first

**Response:**
```json
{
  "success": true,
  "data": {
    "images": [
      {
        "imageId": "550e8400-e29b-41d4-a716-446655440000",
        "originalName": "product_main.jpg",
        "filename": "550e8400-e29b-41d4-a716-446655440000_product_main.jpg",
        "size": 1048576,
        "mimetype": "image/jpeg",
        "entityId": "product_123",
        "entityType": "product",
        "productId": "prod_abc123",
        "category": "electronics",
        "tags": ["smartphone", "tech", "featured"],
        "alt": "iPhone 15 Pro main product image",
        "title": "iPhone 15 Pro - Space Black",
        "metadata": {
          "width": 1920,
          "height": 1080,
          "format": "jpeg",
          "hasAlpha": false
        },
        "accessCount": 5,
        "lastAccessedAt": "2023-01-01T00:00:00.000Z",
        "createdAt": "2023-01-01T00:00:00.000Z",
        "updatedAt": "2023-01-01T00:00:00.000Z",
        "accessUrl": "/api/images/550e8400-e29b-41d4-a716-446655440000?token=access_token",
        "urls": {
          "thumbnail": "/api/images/550e8400-e29b-41d4-a716-446655440000?size=thumbnail&token=access_token",
          "small": "/api/images/550e8400-e29b-41d4-a716-446655440000?size=small&token=access_token",
          "medium": "/api/images/550e8400-e29b-41d4-a716-446655440000?size=medium&token=access_token",
          "large": "/api/images/550e8400-e29b-41d4-a716-446655440000?size=large&token=access_token",
          "original": "/api/images/550e8400-e29b-41d4-a716-446655440000?token=access_token"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 50,
      "totalPages": 3,
      "hasNext": true,
      "hasPrev": false
    },
    "filters": {
      "entityId": "product_123",
      "entityType": "product",
      "productId": "prod_abc123",
      "category": "electronics",
      "tags": "smartphone,tech",
      "search": "iPhone",
      "sort": "name"
    }
  }
}
```

### Update Image Metadata
**PATCH** `/images/:imageId/metadata`

Update metadata for an existing image (category, tags, alt text, title).

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Parameters:**
- `imageId` (string): UUID of the image to update

**Request Body:**
```json
{
  "category": "electronics",
  "tags": ["smartphone", "tech", "featured"],
  "alt": "Updated alt text for accessibility",
  "title": "Updated image title"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "imageId": "550e8400-e29b-41d4-a716-446655440000",
    "originalName": "product_main.jpg",
    "category": "electronics",
    "tags": ["smartphone", "tech", "featured"],
    "alt": "Updated alt text for accessibility",
    "title": "Updated image title",
    "updatedAt": "2023-01-01T00:00:00.000Z"
  }
}
```

### Get Categories
**GET** `/images/categories/list`

Get list of all image categories used by the authenticated user.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "categories": [
      "electronics",
      "clothing",
      "home-decor",
      "books",
      "sports"
    ]
  }
}
```

### Replace Image
**PUT** `/images/:imageId`

Replace an existing image with a new file.

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: multipart/form-data
```

**Parameters:**
- `imageId` (string): UUID of the image to replace

**Form Data:**
- `image` (file): New image file (JPG, PNG, WebP only, max 5MB)

**Response:**
```json
{
  "success": true,
  "data": {
    "imageId": "550e8400-e29b-41d4-a716-446655440000",
    "originalName": "new_photo.jpg",
    "filename": "550e8400-e29b-41d4-a716-446655440000_new_photo.jpg",
    "size": 2097152,
    "mimetype": "image/jpeg",
    "updatedAt": "2023-01-01T00:00:00.000Z",
    "metadata": {
      "width": 2560,
      "height": 1440,
      "format": "jpeg",
      "hasAlpha": false
    },
    "accessUrl": "/api/images/550e8400-e29b-41d4-a716-446655440000?token=new_access_token",
    "accessToken": "new_signed_access_token",
    "versionsCount": 1
  }
}
```

### Delete Image
**DELETE** `/images/:imageId`

Delete an image (soft delete with scheduled physical deletion).

**Headers:**
```
Authorization: Bearer <access_token>
```

**Parameters:**
- `imageId` (string): UUID of the image to delete

**Response:**
```json
{
  "success": true,
  "message": "Image deleted successfully"
}
```

## Security Features

### Rate Limiting

Different endpoints have different rate limits:
- **Authentication endpoints**: 5 requests per 15 minutes
- **Upload/Replace endpoints**: 10 requests per 15 minutes
- **General endpoints**: 100 requests per 15 minutes

### File Security

- **Allowed formats**: JPG, JPEG, PNG, WebP only
- **File size limit**: 5MB maximum
- **MIME type validation**: Both header and content validation
- **Filename sanitization**: Removes dangerous characters and prevents path traversal
- **Unique naming**: UUID-based filenames prevent conflicts

### Input Validation

- All inputs are validated and sanitized
- XSS prevention through input cleaning
- SQL injection prevention (NoSQL injection for MongoDB)
- Path traversal prevention

### CORS Protection

Configured CORS with specific allowed origins, methods, and headers.

### Security Headers

Uses Helmet.js for setting secure HTTP headers including:
- Content Security Policy
- X-Content-Type-Options
- X-Frame-Options
- X-XSS-Protection

## Error Codes

| HTTP Status | Error Code | Description |
|-------------|------------|-------------|
| 400 | VALIDATION_ERROR | Invalid input data |
| 401 | UNAUTHORIZED | Invalid or missing authentication |
| 403 | FORBIDDEN | Insufficient permissions |
| 404 | NOT_FOUND | Resource not found |
| 409 | CONFLICT | Resource conflict (duplicate data) |
| 413 | PAYLOAD_TOO_LARGE | File size exceeds limit |
| 429 | RATE_LIMIT_EXCEEDED | Too many requests |
| 500 | INTERNAL_ERROR | Server error |

## Environment Configuration

Key environment variables:

```bash
# Server
PORT=3000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/image-service

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRY=24h
JWT_REFRESH_SECRET=your-refresh-secret

# Storage
STORAGE_TYPE=local # or 's3'
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=5242880

# AWS S3 (if using cloud storage)
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS
CORS_ORIGIN=http://localhost:3000,http://localhost:3001
```

## Example Usage

### JavaScript/Fetch API

```javascript
// Register user
const registerResponse = await fetch('/api/auth/register', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    username: 'john_doe',
    email: 'john@example.com',
    password: 'SecurePass123!'
  })
});

const { data } = await registerResponse.json();
const { accessToken } = data;

// Upload image
const formData = new FormData();
formData.append('image', fileInput.files[0]);
formData.append('entityId', 'profile_123');
formData.append('entityType', 'profile');

const uploadResponse = await fetch('/api/images/upload', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
  },
  body: formData
});

const uploadResult = await uploadResponse.json();
console.log('Image uploaded:', uploadResult.data);
```

### cURL Examples

```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"john_doe","email":"john@example.com","password":"SecurePass123!"}'

# Upload image
curl -X POST http://localhost:3000/api/images/upload \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "image=@/path/to/image.jpg" \
  -F "entityId=profile_123" \
  -F "entityType=profile"

# Get image
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3000/api/images/IMAGE_ID

# Or with access token
curl http://localhost:3000/api/images/IMAGE_ID?token=ACCESS_TOKEN
