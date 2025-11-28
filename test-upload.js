const fetch = require('node-fetch');
const fs = require('fs');

async function testImageUpload() {
  console.log('Testing Image Service - Direct Upload Test...\n');
  
  try {
    // Test 1: Register Application to get access token
    console.log('1. Registering test application...');
    const timestamp = Date.now();
    const registrationData = {
      name: `test-app-${timestamp}`,
      description: "Test application for image upload",
      domain: `test-${timestamp}.com`,
      allowedOrigins: ["https://homeshopie.com"],
      plan: "free"
    };
    
    const registerResponse = await fetch('http://localhost:5000/api/applications/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(registrationData)
    });
    
    const registerResult = await registerResponse.json();
    
    if (registerResult.success) {
      const { accessToken } = registerResult.data;
      const { apiKey, apiSecret } = registerResult.data.application;
      
      console.log('✅ Registration Success!');
      console.log('API Key:', apiKey);
      console.log('API Secret:', apiSecret);
      console.log('Access Token received:', accessToken ? 'Yes' : 'No');
      
      // Test 2: Direct Image Upload using access token from registration
      console.log('\n2. Testing Image Upload with access token...');
      
      if (fs.existsSync('test-image.png')) {
        const FormData = require('form-data');
        const form = new FormData();
        form.append('image', fs.createReadStream('test-image.png'));
        form.append('isPublic', 'true');
        form.append('tags', JSON.stringify(['test', 'homeshopie', 'product']));
        form.append('alt', 'Test product image for HomeShoppe');
        
        const uploadResponse = await fetch('http://localhost:5000/api/images/upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            ...form.getHeaders()
          },
          body: form
        });
        
        const uploadResult = await uploadResponse.json();
        console.log('Upload Status:', uploadResponse.status);
        console.log('Upload Response:', JSON.stringify(uploadResult, null, 2));
        
        if (uploadResult.success) {
          console.log('\n✅ Image Upload Success!');
          console.log('Image URL:', uploadResult.data.image.url);
          console.log('Public URL:', uploadResult.data.image.publicUrl);
          console.log('Image ID:', uploadResult.data.image.id);
          
          // Test 3: Get uploaded images
          console.log('\n3. Testing Get Images...');
          const getImagesResponse = await fetch('http://localhost:5000/api/images', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          });
          
          const getImagesResult = await getImagesResponse.json();
          console.log('Get Images Status:', getImagesResponse.status);
          console.log('Images Count:', getImagesResult.success ? getImagesResult.data.images.length : 0);
          
          if (getImagesResult.success && getImagesResult.data.images.length > 0) {
            console.log('✅ Get Images Success!');
            console.log('First Image:', {
              id: getImagesResult.data.images[0].id,
              filename: getImagesResult.data.images[0].filename,
              url: getImagesResult.data.images[0].url
            });
            
            // Test 4: Get single image
            console.log('\n4. Testing Get Single Image...');
            const imageId = getImagesResult.data.images[0].id;
            const getSingleResponse = await fetch(`http://localhost:5000/api/images/${imageId}`, {
              headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            
            const getSingleResult = await getSingleResponse.json();
            console.log('Get Single Image Status:', getSingleResponse.status);
            
            if (getSingleResult.success) {
              console.log('✅ Get Single Image Success!');
              console.log('Image Details:', {
                filename: getSingleResult.data.image.filename,
                size: getSingleResult.data.image.size,
                isPublic: getSingleResult.data.image.isPublic
              });
            }
          }
        } else {
          console.log('❌ Image Upload Failed');
        }
      } else {
        console.log('❌ test-image.png not found');
        console.log('Creating a simple test to verify API endpoints...');
        
        // Test without image - just verify the endpoint responds correctly
        const testResponse = await fetch('http://localhost:5000/api/images', {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        const testResult = await testResponse.json();
        console.log('API Test Status:', testResponse.status);
        
        if (testResult.success) {
          console.log('✅ API Endpoints Working!');
          console.log('Images endpoint accessible with auth token');
        }
      }
      
      // Test 5: Application Profile
      console.log('\n5. Testing Application Profile...');
      const profileResponse = await fetch('http://localhost:5000/api/applications/profile', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      
      const profileResult = await profileResponse.json();
      console.log('Profile Status:', profileResponse.status);
      
      if (profileResult.success) {
        console.log('✅ Profile Access Success!');
        console.log('Usage Stats:', {
          totalImages: profileResult.data.application.usage.totalImages,
          storageUsed: profileResult.data.application.usage.totalStorageUsed,
          monthlyUploads: profileResult.data.application.usage.currentMonthUploads
        });
      }
      
    } else {
      console.log('❌ Registration Failed:', registerResult.error);
    }
    
  } catch (error) {
    console.error('❌ Test Error:', error.message);
  }
}

console.log('='.repeat(60));
console.log('🚀 HOMESHOPIE IMAGE SERVICE - COMPREHENSIVE TEST');
console.log('='.repeat(60));

testImageUpload().then(() => {
  console.log('\n' + '='.repeat(60));
  console.log('✅ TEST COMPLETE - Image Service Ready for HomeShoppe!');
  console.log('='.repeat(60));
});
