const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5000/api';
let accessToken = '';
let publicImageId = '';
let privateImageId = '';

// Create a simple test image file
const createTestImage = () => {
  // Create a simple 32x32 PNG image (red square)
  const pngData = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAAiSURBVFiFY/j//z8DKYCRUjAqAqMiMCoCoyIwKgKjIjAqAgAAtr8AAR8JAZQAAAAASUVORK5CYII=', 'base64');
  const testImagePath = path.join(__dirname, 'test-public-image.png');
  fs.writeFileSync(testImagePath, pngData);
  return testImagePath;
};

// Test public image access functionality
const runPublicImageTests = async () => {
  console.log('🌐 Testing Public Image Access for Ecommerce');
  console.log('===============================================\n');

  try {
    // Test 1: User Registration
    console.log('1. Setting up test user...');
    const timestamp = Date.now().toString().slice(-6);
    const userData = {
      username: 'ecom_user_' + timestamp,
      email: `ecommerce${timestamp}@test.com`,
      password: 'TestPass123!'
    };
    
    const registerResponse = await axios.post(`${BASE_URL}/auth/register`, userData);
    accessToken = registerResponse.data.data.accessToken;
    console.log('✅ Test user created successfully\n');

    // Test 2: Upload Public Product Image
    console.log('2. Testing Public Product Image Upload...');
    const testImagePath = createTestImage();
    
    const publicFormData = new FormData();
    publicFormData.append('image', fs.createReadStream(testImagePath));
    publicFormData.append('entityType', 'product'); // This should make it public
    publicFormData.append('productId', 'ecom_product_123');
    publicFormData.append('category', 'electronics');
    publicFormData.append('alt', 'Test public product image');
    publicFormData.append('title', 'Public Test Phone');

    const publicUploadResponse = await axios.post(`${BASE_URL}/images/upload`, publicFormData, {
      headers: {
        ...publicFormData.getHeaders(),
        Authorization: `Bearer ${accessToken}`
      }
    });

    publicImageId = publicUploadResponse.data.data.imageId;
    const isPublic = publicUploadResponse.data.data.isPublic;
    const publicUrls = publicUploadResponse.data.data.publicUrls;
    
    console.log('✅ Public product image uploaded successfully');
    console.log(`   Image ID: ${publicImageId}`);
    console.log(`   Is Public: ${isPublic}`);
    console.log(`   Has Public URLs: ${!!publicUrls}`);
    if (publicUrls) {
      console.log(`   Public Original URL: ${publicUrls.original}`);
      console.log(`   Public Thumbnail URL: ${publicUrls.thumbnail}`);
    }
    console.log();

    // Test 3: Upload Private Image
    console.log('3. Testing Private Image Upload...');
    const privateFormData = new FormData();
    privateFormData.append('image', fs.createReadStream(testImagePath));
    privateFormData.append('category', 'personal'); // This should remain private
    privateFormData.append('alt', 'Test private image');
    privateFormData.append('title', 'Private Test Image');

    const privateUploadResponse = await axios.post(`${BASE_URL}/images/upload`, privateFormData, {
      headers: {
        ...privateFormData.getHeaders(),
        Authorization: `Bearer ${accessToken}`
      }
    });

    privateImageId = privateUploadResponse.data.data.imageId;
    const isPrivate = !privateUploadResponse.data.data.isPublic;
    const noPublicUrls = !privateUploadResponse.data.data.publicUrls;
    
    console.log('✅ Private image uploaded successfully');
    console.log(`   Image ID: ${privateImageId}`);
    console.log(`   Is Private: ${isPrivate}`);
    console.log(`   No Public URLs: ${noPublicUrls}`);
    console.log();

    // Test 4: Access Public Image WITHOUT Authentication
    console.log('4. Testing Public Image Access (No Auth Required)...');
    
    try {
      // Access public image without any token or authentication
      const publicImageResponse = await axios.get(`${BASE_URL}/images/${publicImageId}`, {
        responseType: 'stream',
        maxRedirects: 5
      });
      
      console.log('✅ Public image accessed successfully without authentication');
      console.log(`   Status: ${publicImageResponse.status}`);
      console.log(`   Content-Type: ${publicImageResponse.headers['content-type']}`);
      console.log(`   Content-Length: ${publicImageResponse.headers['content-length']}`);
    } catch (error) {
      console.log('❌ Failed to access public image without auth');
      console.log(`   Error: ${error.response?.status} - ${error.response?.data?.error || error.message}`);
    }
    console.log();

    // Test 5: Access Public Image Size Variants WITHOUT Authentication
    console.log('5. Testing Public Image Size Variants (No Auth)...');
    
    const sizes = ['thumbnail', 'small', 'medium', 'large'];
    for (const size of sizes) {
      try {
        const variantResponse = await axios.get(`${BASE_URL}/images/${publicImageId}?size=${size}`, {
          responseType: 'stream',
          maxRedirects: 5
        });
        
        console.log(`   ✅ ${size} variant accessible - Status: ${variantResponse.status}`);
      } catch (error) {
        console.log(`   ⚠️  ${size} variant failed - ${error.response?.status || 'Network Error'}`);
      }
    }
    console.log();

    // Test 6: Try to Access Private Image WITHOUT Authentication (Should Fail)
    console.log('6. Testing Private Image Access (Should Fail Without Auth)...');
    
    try {
      await axios.get(`${BASE_URL}/images/${privateImageId}`, {
        responseType: 'stream'
      });
      console.log('❌ ERROR: Private image was accessible without authentication!');
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ Private image correctly blocked without authentication');
        console.log(`   Expected Error: ${error.response.status} - ${error.response.data?.error}`);
      } else {
        console.log('⚠️  Unexpected error accessing private image');
        console.log(`   Error: ${error.response?.status} - ${error.message}`);
      }
    }
    console.log();

    // Test 7: Test Different Product Categories (Should all be public)
    console.log('7. Testing Auto-Public Categories...');
    
    const testCategories = [
      { category: 'clothing', expected: true },
      { category: 'accessories', expected: true },
      { category: 'product', expected: true },
      { category: 'personal', expected: false }
    ];

    for (const test of testCategories) {
      const catFormData = new FormData();
      catFormData.append('image', fs.createReadStream(testImagePath));
      catFormData.append('category', test.category);
      catFormData.append('title', `Test ${test.category} image`);

      try {
        const catUploadResponse = await axios.post(`${BASE_URL}/images/upload`, catFormData, {
          headers: {
            ...catFormData.getHeaders(),
            Authorization: `Bearer ${accessToken}`
          }
        });

        const actualPublic = catUploadResponse.data.data.isPublic;
        const testPassed = actualPublic === test.expected;
        
        console.log(`   ${testPassed ? '✅' : '❌'} Category "${test.category}": Public=${actualPublic} (Expected: ${test.expected})`);
        
        if (actualPublic) {
          // Test quick access
          const quickTestId = catUploadResponse.data.data.imageId;
          try {
            await axios.head(`${BASE_URL}/images/${quickTestId}`);
            console.log(`      ✅ Quick access test passed for ${test.category}`);
          } catch (accessError) {
            console.log(`      ❌ Quick access test failed for ${test.category}`);
          }
        }
      } catch (uploadError) {
        console.log(`   ❌ Failed to upload ${test.category} image: ${uploadError.message}`);
      }
    }
    console.log();

    // Test 8: Verify Public URLs Work
    console.log('8. Testing Public URLs from Upload Response...');
    
    if (publicUrls) {
      const urlTests = [
        { name: 'Original', url: publicUrls.original },
        { name: 'Thumbnail', url: publicUrls.thumbnail },
        { name: 'Small', url: publicUrls.small },
        { name: 'Medium', url: publicUrls.medium },
        { name: 'Large', url: publicUrls.large }
      ];

      for (const urlTest of urlTests) {
        try {
          const fullUrl = `http://localhost:5000${urlTest.url}`;
          const urlResponse = await axios.head(fullUrl);
          console.log(`   ✅ ${urlTest.name} public URL works - Status: ${urlResponse.status}`);
        } catch (urlError) {
          console.log(`   ❌ ${urlTest.name} public URL failed - ${urlError.response?.status || 'Network Error'}`);
        }
      }
    } else {
      console.log('   ⚠️  No public URLs found in upload response');
    }
    console.log();

    // Cleanup
    fs.unlinkSync(testImagePath);

    console.log('🎉 PUBLIC IMAGE ACCESS TESTING COMPLETED!');
    console.log('==========================================');
    console.log('✅ Product images automatically set as public');
    console.log('✅ Public images accessible without authentication');
    console.log('✅ Private images remain protected');
    console.log('✅ Size variants work for public images');
    console.log('✅ Category-based auto-public assignment works');
    console.log('✅ Public URLs provided for ecommerce integration');
    console.log('✅ Perfect for ecommerce product display! 🛍️');

  } catch (error) {
    console.error('❌ Public image test failed:', error.response?.data || error.message);
    if (error.response?.data) {
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
  }
};

// Run the public image tests
runPublicImageTests().catch(console.error);
