// Test script for the ELI5 image explanation API
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Configuration
const API_URL = 'http://localhost:3000/api/explain-image'; // Change to your actual server URL
const TEST_IMAGE_PATH = path.join(__dirname, 'test-image.png'); // Place a test image in the server directory

async function testImageApi() {
  try {
    console.log('Starting API test...');
    
    // Read the test image file
    if (!fs.existsSync(TEST_IMAGE_PATH)) {
      console.error(`Test image not found at: ${TEST_IMAGE_PATH}`);
      console.log('Please add a test image file named "test-image.png" to the server directory');
      return;
    }
    
    console.log('Reading test image...');
    const imageBuffer = fs.readFileSync(TEST_IMAGE_PATH);
    const base64Image = `data:image/png;base64,${imageBuffer.toString('base64')}`;
    console.log(`Image read successfully, base64 length: ${base64Image.length}`);
    
    // Send the request to the server
    console.log(`Sending request to: ${API_URL}`);
    const response = await axios.post(API_URL, {
      imageData: base64Image
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Response received:');
    console.log('Status:', response.status);
    console.log('Headers:', response.headers);
    console.log('Data:', response.data);
    
    if (response.data.explanation) {
      console.log('\nExplanation:');
      console.log(response.data.explanation);
      console.log('\nTest completed successfully!');
    } else {
      console.error('Error: No explanation returned');
    }
  } catch (error) {
    console.error('Test failed with error:');
    console.error(error);
    
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
  }
}

// Run the test
testImageApi(); 