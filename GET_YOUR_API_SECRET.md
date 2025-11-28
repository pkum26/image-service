# 🔑 How to Get Your HomeShoppe API Secret

## Problem
Your MongoDB data shows:
- ✅ API Key: `ak_ac79cbe81f7e7cd45887a5c44b4b7082`
- ❌ API Secret: `$2a$12$KYLE/45NgS9dD70xVMCGHOwOuF5vZG.Jl12m1ITe35rygDIWDyV0C` (This is HASHED, not usable)

You need the **original plain text secret** for authentication.

## Solution Options

### Option 1: Use the Dashboard to Get Credentials (Recommended)
1. Open: http://localhost:5000/application-dashboard.html
2. Register a new application for HomeShoppe
3. Copy the plain text API secret when it's displayed
4. Use those credentials in your integration

### Option 2: Re-register HomeShoppe Application
Since the original secret is lost, create a new registration:

```bash
curl -X POST http://localhost:5000/api/applications/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "homeshopie-main",
    "description": "E-commerce platform for home products and decor",
    "domain": "homeshopie.com", 
    "allowedOrigins": ["https://homeshopie.com", "http://localhost:3000"],
    "plan": "free"
  }'
```

This will return:
```json
{
  "success": true,
  "data": {
    "application": {
      "apiKey": "ak_xxxxxxxxxxxxxxx",
      "apiSecret": "your_plain_text_secret_here"  // ← SAVE THIS!
    }
  }
}
```

### Option 3: Use Existing Credentials with Authentication Endpoint
Test if you have the original secret saved somewhere by trying authentication:

```bash
curl -X POST http://localhost:5000/api/applications/authenticate \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "ak_ac79cbe81f7e7cd45887a5c44b4b7082",
    "apiSecret": "your_original_plain_text_secret"
  }'
```

## 🚀 Once You Have Your Credentials

Use the integration code I created in `homeshopie-integration.js`:

```javascript
const { HomeshoppieImageService } = require('./homeshopie-integration.js');

// Initialize with your credentials
const imageService = new HomeshoppieImageService(
  'ak_ac79cbe81f7e7cd45887a5c44b4b7082',    // Your existing API key
  'your_plain_text_secret_here'              // The secret you'll get from re-registration
);

// Now you can use all the methods:
async function useImageService() {
  // Upload image
  const image = await imageService.uploadImage('product.jpg', {
    isPublic: true,
    alt: 'Product image',
    tags: ['product', 'homeshoppie']
  });

  // Get all images
  const images = await imageService.getImages({ limit: 10 });

  // Delete image
  await imageService.deleteImage(image.id);
}
```

## 📝 Quick Test Script

Save this as `test-homeshoppie-auth.js`:

```javascript
const fetch = require('node-fetch');

async function testAuth(apiKey, apiSecret) {
  try {
    const response = await fetch('http://localhost:5000/api/applications/authenticate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey, apiSecret })
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Authentication successful!');
      console.log('Access token received:', result.data.accessToken.substring(0, 20) + '...');
      return result.data.accessToken;
    } else {
      console.log('❌ Authentication failed:', result.error);
      return null;
    }
  } catch (error) {
    console.log('❌ Error:', error.message);
    return null;
  }
}

// Test with your credentials
testAuth('ak_ac79cbe81f7e7cd45887a5c44b4b7082', 'YOUR_PLAIN_TEXT_SECRET_HERE');
```

Run: `node test-homeshoppie-auth.js`
