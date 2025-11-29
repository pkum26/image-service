const fetch = require('node-fetch');

async function testImageInfoEndpoint() {
  console.log('🧪 Testing Image Info Endpoint\n');

  try {
    // First, let's test with a non-existent image ID to verify 404 handling
    console.log('1. Testing with non-existent image ID...');
    const testImageId = 'c7904139-6d1f-4ef9-9822-70627b0e8479'; // From your error log
    
    const infoResponse = await fetch(`http://localhost:5000/api/images/${testImageId}/info`);
    const infoResult = await infoResponse.json();
    
    console.log('Status:', infoResponse.status);
    console.log('Response:', JSON.stringify(infoResult, null, 2));
    
    if (infoResponse.status === 404) {
      console.log('✅ Correctly returns 404 for non-existent image');
    } else {
      console.log('❌ Unexpected response for non-existent image');
    }

    // Test with authentication if needed
    console.log('\n2. Testing authenticated access...');
    
    // You can replace these with real credentials if available
    const authResponse = await fetch('http://localhost:5000/api/applications/authenticate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: 'ak_8a2d8bcec1d29a24e9306652f6d5209a', // Example from logs
        apiSecret: '7a4427291dccc797ac64521b9a67ebe7e82e37d658c09f39089138168cfeb45b'
      })
    });

    if (authResponse.ok) {
      const authResult = await authResponse.json();
      console.log('✅ Authentication successful');
      
      // Test with auth token
      const authenticatedInfoResponse = await fetch(`http://localhost:5000/api/images/${testImageId}/info`, {
        headers: { 'Authorization': `Bearer ${authResult.data.accessToken}` }
      });
      
      const authenticatedInfoResult = await authenticatedInfoResponse.json();
      console.log('Authenticated Status:', authenticatedInfoResponse.status);
      console.log('Authenticated Response:', JSON.stringify(authenticatedInfoResult, null, 2));
    } else {
      console.log('⚠️ Authentication failed - testing without auth only');
    }

  } catch (error) {
    console.error('❌ Test Error:', error.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('🎯 INFO ENDPOINT TEST COMPLETE');
  console.log('='.repeat(60));
}

// Also test a few different scenarios
async function testInfoEndpointScenarios() {
  console.log('\n📋 Testing Various Info Endpoint Scenarios\n');

  const scenarios = [
    {
      name: 'Valid image ID format but non-existent',
      imageId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      expectedStatus: 404
    },
    {
      name: 'Invalid image ID format',
      imageId: 'invalid-id',
      expectedStatus: 400
    },
    {
      name: 'Empty image ID',
      imageId: '',
      expectedStatus: 404
    }
  ];

  for (const scenario of scenarios) {
    try {
      console.log(`Testing: ${scenario.name}`);
      const url = `http://localhost:5000/api/images/${scenario.imageId}/info`;
      console.log(`URL: ${url}`);
      
      const response = await fetch(url);
      const result = await response.json();
      
      console.log(`Status: ${response.status} (expected: ${scenario.expectedStatus})`);
      console.log(`Response: ${JSON.stringify(result, null, 2)}`);
      
      if (response.status === scenario.expectedStatus) {
        console.log('✅ Expected response received');
      } else {
        console.log('⚠️ Unexpected response status');
      }
      
      console.log('-'.repeat(40));
    } catch (error) {
      console.error(`❌ Error testing ${scenario.name}:`, error.message);
    }
  }
}

// Run tests
testImageInfoEndpoint().then(() => {
  return testInfoEndpointScenarios();
});
