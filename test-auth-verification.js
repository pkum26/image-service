const fetch = require('node-fetch');

async function verifyAuthenticationFlow() {
  console.log('🔐 Testing Application Authentication Flow & compareSecret Method\n');
  
  try {
    // Step 1: Register a new application to get fresh credentials
    console.log('1. Registering new application...');
    const timestamp = Date.now();
    const registrationData = {
      name: `auth-test-${timestamp}`,
      description: "Authentication verification test",
      domain: `auth-test-${timestamp}.com`,
      allowedOrigins: ["http://localhost:3000"],
      plan: "free"
    };
    
    const registerResponse = await fetch('http://localhost:5000/api/applications/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(registrationData)
    });
    
    const registerResult = await registerResponse.json();
    console.log('Registration Status:', registerResponse.status);
    
    if (registerResult.success) {
      const { apiKey, apiSecret } = registerResult.data.application;
      console.log('✅ Registration Success!');
      console.log('API Key:', apiKey);
      console.log('API Secret (plain text):', apiSecret);
      console.log('Secret Length:', apiSecret.length);
      
      // Step 2: Test authentication with correct credentials
      console.log('\n2. Testing authentication with CORRECT credentials...');
      const authResponse = await fetch('http://localhost:5000/api/applications/authenticate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          apiKey: apiKey,
          apiSecret: apiSecret 
        })
      });
      
      const authResult = await authResponse.json();
      console.log('Auth Status:', authResponse.status);
      
      if (authResult.success) {
        console.log('✅ Authentication SUCCESS - compareSecret method is working!');
        console.log('Access Token received:', authResult.data.accessToken ? 'Yes' : 'No');
        
        // Step 3: Test with WRONG secret to verify security
        console.log('\n3. Testing authentication with WRONG secret...');
        const wrongAuthResponse = await fetch('http://localhost:5000/api/applications/authenticate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            apiKey: apiKey,
            apiSecret: 'wrong_secret_here' 
          })
        });
        
        const wrongAuthResult = await wrongAuthResponse.json();
        console.log('Wrong Auth Status:', wrongAuthResponse.status);
        
        if (wrongAuthResponse.status === 401) {
          console.log('✅ Security VERIFIED - Wrong secret properly rejected!');
          console.log('Error:', wrongAuthResult.error);
        } else {
          console.log('❌ Security ISSUE - Wrong secret was accepted!');
        }
        
        // Step 4: Test image upload with valid token
        console.log('\n4. Testing image upload with valid access token...');
        const accessToken = authResult.data.accessToken;
        
        // Test the /api/images endpoint (GET request)
        const imagesResponse = await fetch('http://localhost:5000/api/images', {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        const imagesResult = await imagesResponse.json();
        console.log('Images API Status:', imagesResponse.status);
        
        if (imagesResult.success) {
          console.log('✅ Token validation SUCCESS - Image API accessible!');
          console.log('Images found:', imagesResult.data.images.length);
        } else {
          console.log('❌ Token validation FAILED');
          console.log('Error:', imagesResult.error);
        }
        
        // Step 5: Test application profile access
        console.log('\n5. Testing application profile access...');
        const profileResponse = await fetch('http://localhost:5000/api/applications/profile', {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        const profileResult = await profileResponse.json();
        console.log('Profile Status:', profileResponse.status);
        
        if (profileResult.success) {
          console.log('✅ Profile access SUCCESS!');
          console.log('Application name:', profileResult.data.application.name);
          console.log('Usage stats:', {
            totalImages: profileResult.data.application.usage.totalImages,
            monthlyUploads: profileResult.data.application.usage.currentMonthUploads
          });
        }
        
      } else {
        console.log('❌ Authentication FAILED with correct credentials!');
        console.log('Error:', authResult.error);
        console.log('This indicates an issue with compareSecret method or authentication flow');
      }
      
    } else {
      console.log('❌ Registration FAILED:', registerResult.error);
    }
    
  } catch (error) {
    console.error('❌ Test Error:', error.message);
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('🎯 AUTHENTICATION VERIFICATION COMPLETE');
  console.log('='.repeat(70));
}

// Run the verification
verifyAuthenticationFlow();
