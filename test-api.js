const fetch = require('node-fetch');
const fs = require('fs');

async function testAPI() {
  console.log('Testing Image Service API...\n');
  
  try {
    // Test 1: Register Application
    console.log('1. Testing Application Registration...');
    const timestamp = Date.now();
    const registrationData = {
      name: `homeshopie-${timestamp}`,
      description: "E-commerce platform for home products and decor",
      domain: `homeshopie-${timestamp}.com`,
      allowedOrigins: ["https://homeshopie.com"],
      plan: "free"
    };
    
    const registerResponse = await fetch('http://localhost:5000/api/applications/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(registrationData)
    });
    
    const registerResult = await registerResponse.json();
    console.log('Registration Status:', registerResponse.status);
    console.log('Registration Response:', JSON.stringify(registerResult, null, 2));
    
    if (registerResult.success) {
      const { apiKey, apiSecret } = registerResult.data.application;
      console.log('\n✅ Registration Success!');
      console.log('API Key:', apiKey);
      console.log('API Secret:', apiSecret);
      
      // Test 2: Authenticate Application
      console.log('\n2. Testing Application Authentication...');
      const authResponse = await fetch('http://localhost:5000/api/applications/authenticate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, apiSecret })
      });
      
      const authResult = await authResponse.json();
      console.log('Authentication Status:', authResponse.status);
      console.log('Authentication Response:', JSON.stringify(authResult, null, 2));
      
      if (authResult.success) {
        const { accessToken } = authResult.data;
        console.log('\n✅ Authentication Success!');
        
        // Test 3: Upload Image
        console.log('\n3. Testing Image Upload...');
        
        // Check if test image exists
        if (fs.existsSync('test-image.png')) {
          const FormData = require('form-data');
          const form = new FormData();
          form.append('image', fs.createReadStream('test-image.png'));
          form.append('isPublic', 'true');
          form.append('tags', JSON.stringify(['test', 'homeshopie']));
          
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
            
            // Test 4: Get Images
            console.log('\n4. Testing Get Images...');
            const getImagesResponse = await fetch('http://localhost:5000/api/images', {
              headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            
            const getImagesResult = await getImagesResponse.json();
            console.log('Get Images Status:', getImagesResponse.status);
            console.log('Get Images Response:', JSON.stringify(getImagesResult, null, 2));
            
            if (getImagesResult.success) {
              console.log('\n✅ Get Images Success!');
            }
          }
        } else {
          console.log('❌ test-image.png not found, skipping upload test');
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Test Error:', error.message);
  }
}

testAPI();
