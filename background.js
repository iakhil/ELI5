// Listen for messages from popup or content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Received message in background:', request.action);
  
  // Add test API function
  if (request.action === 'testApi') {
    testApiConnection(sendResponse);
    return true; // Keep the message channel open for async response
  }
  
  // Add API health check
  if (request.action === 'checkApiHealth') {
    checkApiHealth(sendResponse);
    return true; // Keep the message channel open for async response
  }
  
  // Add option to use local fallback
  if (request.action === 'useLocalFallback' && request.text) {
    console.log('Using local fallback for text explanation');
    const explanation = generateLocalExplanation(request.text);
    sendResponse({ 
      explanation: explanation,
      isLocalFallback: true
    });
    return true;
  }
  
  // Handle image-based explanation requests
  if (request.action === 'explainImage') {
    console.log('Processing image data for explanation');
    
    // Check if imageData is present and log its status
    if (!request.imageData) {
      console.error('ERROR: Missing imageData in explainImage request');
      sendResponse({ error: 'No image data provided' });
      return true;
    }
    
    console.log('Image data received successfully, length:', request.imageData.length);
    
    // Updated: Actually call the API instead of using fallback
    // Change to use API
    try {
      // First check if we can reach the server at all
      checkApiHealth(async (healthResult) => {
        console.log('API health check result:', healthResult);
        
        if (healthResult.status === 'healthy') {
          // Server is reachable, continue with API call
          console.log('Server is healthy, attempting API call');
          
          try {
            const response = await fetch('https://eli5-6qbb.onrender.com/api/extract-and-explain', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                imageData: request.imageData
              })
            });
            
            console.log('API response status:', response.status);
            
            if (response.ok) {
              const data = await response.json();
              console.log('Received API response successfully');
              sendResponse({
                explanation: data.explanation,
                extractedText: data.extractedText
              });
            } else {
              console.error('API returned error status:', response.status);
              // Fall back to local processing
              const fallbackResponse = generateLocalImageExplanation();
              sendResponse({
                explanation: fallbackResponse.explanation,
                extractedText: fallbackResponse.extractedText,
                isLocalFallback: true
              });
            }
          } catch (apiError) {
            console.error('Error calling API:', apiError);
            // Fall back to local processing
            const fallbackResponse = generateLocalImageExplanation();
            sendResponse({
              explanation: fallbackResponse.explanation,
              extractedText: fallbackResponse.extractedText,
              isLocalFallback: true
            });
          }
        } else {
          // Server is not reachable, use local fallback
          console.log('Server is not healthy, using fallback');
          const fallbackResponse = generateLocalImageExplanation();
          sendResponse({
            explanation: fallbackResponse.explanation,
            extractedText: fallbackResponse.extractedText,
            isLocalFallback: true
          });
        }
      });
      
      return true; // Keep message channel open for async response
    } catch (error) {
      console.error('Error in explainImage handler:', error);
      // Use local fallback for any error
      const fallbackResponse = generateLocalImageExplanation();
      sendResponse({
        explanation: fallbackResponse.explanation,
        extractedText: fallbackResponse.extractedText,
        isLocalFallback: true
      });
      return true;
    }
  }
  
  // SIMPLIFIED: Just capture the entire tab and let content script do the rest
  if (request.action === 'captureTab') {
    console.log('Capturing tab screenshot');
    
    // Capture the visible tab using Chrome API
    try {
      chrome.tabs.captureVisibleTab(
        null, 
        { format: 'png', quality: 100 }, 
        dataUrl => {
          if (chrome.runtime.lastError) {
            console.error('Error capturing tab:', chrome.runtime.lastError);
            sendResponse({ error: chrome.runtime.lastError.message });
          } else if (!dataUrl) {
            console.error('No screenshot data returned');
            sendResponse({ error: 'Failed to capture screenshot' });
          } else {
            console.log('Screenshot captured successfully, sending to content script');
            sendResponse({ screenshot: dataUrl });
          }
        }
      );
    } catch (error) {
      console.error('Exception capturing tab:', error);
      sendResponse({ error: error.message || 'Failed to capture screenshot' });
    }
    
    return true; // Keep the message channel open for async response
  }
  
  // Handle text-based explanation requests
  if (request.action === 'getExplanation' && request.text) {
    generateExplanation(request.text, sendResponse);
    return true; // Keep the message channel open for async response
  }
  
  // If we get here, neither text nor image data was provided
  console.error('ERROR: Unknown action or missing data', request.action);
  sendResponse({ error: 'No text or image data provided' });
  return true;
});

// Function to generate a simple local explanation when API is unavailable
function generateLocalExplanation(text) {
  console.log('Generating local fallback explanation');
  
  // Truncate if text is too long
  const truncatedText = text.length > 300 
    ? text.substring(0, 300) + '...' 
    : text;
  
  return `I'm currently unable to connect to the explanation service to analyze this text: 
  
"${truncatedText}"

Please try again later when our service is back online. This is a fallback message because the API service is currently unavailable.`;
}

// Function for basic image analysis when API is down
function generateLocalImageExplanation() {
  return {
    explanation: "I'm currently unable to analyze this image because our explanation service is offline. Please try again later when the service is back online. This is a fallback message.",
    extractedText: "Image analysis unavailable"
  };
}

// Function to check API health
async function checkApiHealth(sendResponse) {
  console.log('Checking API health...');
  try {
    const response = await fetch('https://eli5-6qbb.onrender.com/api/health', {
      method: 'GET',
      timeout: 5000 // Short timeout for health check
    });
    
    if (response.ok) {
      console.log('API health check: Service is up');
      sendResponse({ status: 'healthy' });
    } else {
      console.error('API health check: Service returned error status:', response.status);
      sendResponse({ status: 'unhealthy', error: `Status code: ${response.status}` });
    }
  } catch (error) {
    console.error('API health check: Service unreachable', error);
    sendResponse({ status: 'unreachable', error: error.message });
  }
}

// Function to try to extract valid JSON from a potentially corrupted response
function attemptJsonExtraction(text) {
  console.log('Attempting manual JSON extraction');
  
  // Print out significant fragments for debugging
  console.log('Searching for JSON patterns in response text');
  
  // Check for any JSON-like patterns
  const bracePosition = text.indexOf('{');
  const bracketPosition = text.indexOf('[');
  const quotePosition = text.indexOf('"');
  console.log('Positions: { at', bracePosition, ', [ at', bracketPosition, ', " at', quotePosition);
  
  // Try to find JSON by looking for opening/closing braces
  let startIdx = text.indexOf('{');
  let endIdx = text.lastIndexOf('}');
  
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    try {
      // Extract just the part that looks like JSON
      const jsonCandidate = text.substring(startIdx, endIdx + 1);
      console.log('Found JSON object candidate from position', startIdx, 'to', endIdx);
      console.log('Candidate preview:', jsonCandidate.substring(0, 50) + '...');
      
      // Clean the candidate by removing any characters before the first {
      const cleanCandidate = jsonCandidate.substring(jsonCandidate.indexOf('{'));
      
      // Try to parse it
      const data = JSON.parse(cleanCandidate);
      console.log('Successfully extracted valid JSON from corrupted response');
      console.log('Extracted data keys:', Object.keys(data));
      return { success: true, data };
    } catch (e) {
      console.error('Failed to extract valid JSON:', e);
      console.error('Extraction error message:', e.message);
    }
  } else {
    console.log('No complete JSON object found in response (missing opening/closing braces or incorrect positions)');
  }
  
  // If we still can't parse it, check for a JSON array
  startIdx = text.indexOf('[');
  endIdx = text.lastIndexOf(']');
  
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    try {
      // Extract just the part that looks like a JSON array
      const jsonCandidate = text.substring(startIdx, endIdx + 1);
      console.log('Found JSON array candidate from position', startIdx, 'to', endIdx);
      console.log('Array candidate preview:', jsonCandidate.substring(0, 50) + '...');
      
      // Clean the candidate by removing any characters before the first [
      const cleanCandidate = jsonCandidate.substring(jsonCandidate.indexOf('['));
      
      // Try to parse it
      const data = JSON.parse(cleanCandidate);
      console.log('Successfully extracted valid JSON array from corrupted response');
      console.log('Extracted array length:', data.length);
      return { success: true, data };
    } catch (e) {
      console.error('Failed to extract valid JSON array:', e);
      console.error('Array extraction error message:', e.message);
    }
  } else {
    console.log('No complete JSON array found in response (missing opening/closing brackets or incorrect positions)');
  }
  
  // If we get here, try a more aggressive approach - find any JSON-like structure
  console.log('Attempting more aggressive JSON extraction...');
  
  // Look for valid JSON property patterns ("key": value)
  const propertyMatches = text.match(/"[^"]+"\s*:\s*("[^"]*"|[\d\.\-]+|true|false|null|\{|\[)/g);
  if (propertyMatches && propertyMatches.length > 0) {
    console.log('Found JSON property patterns:', propertyMatches.length, 'matches');
    
    // Try to construct a valid JSON object from properties
    try {
      let jsonObj = {};
      propertyMatches.forEach(prop => {
        const keyValueMatch = prop.match(/"([^"]+)"\s*:\s*(.*)/);
        if (keyValueMatch && keyValueMatch.length === 3) {
          const key = keyValueMatch[1];
          let value = keyValueMatch[2];
          
          // Handle different value types
          if (value === 'true') jsonObj[key] = true;
          else if (value === 'false') jsonObj[key] = false;
          else if (value === 'null') jsonObj[key] = null;
          else if (value.startsWith('"') && value.endsWith('"')) 
            jsonObj[key] = value.substring(1, value.length - 1);
          else if (!isNaN(Number(value))) jsonObj[key] = Number(value);
          else jsonObj[key] = value; // Complex value (object/array) - this is just a best effort
        }
      });
      
      console.log('Constructed JSON object from properties:', JSON.stringify(jsonObj, null, 2));
      return { success: true, data: jsonObj };
    } catch (e) {
      console.error('Failed to construct JSON from properties:', e);
    }
  } else {
    console.log('No JSON property patterns found in response');
  }
  
  // Last resort - if we find "explanation": in the text, extract the explanation value
  const explanationIndex = text.indexOf('"explanation":');
  if (explanationIndex !== -1) {
    console.log('Found "explanation" property at position', explanationIndex);
    
    try {
      // Find the start of the explanation value (after "explanation":)
      const valueStart = text.indexOf('"', explanationIndex + 14); // Length of "explanation":
      
      if (valueStart !== -1) {
        // Find the end of the string (next unescaped quote)
        let valueEnd = valueStart + 1;
        let escaped = false;
        
        while (valueEnd < text.length) {
          if (text[valueEnd] === '\\') {
            escaped = !escaped;
          } else if (text[valueEnd] === '"' && !escaped) {
            break;
          } else {
            escaped = false;
          }
          valueEnd++;
        }
        
        if (valueEnd < text.length) {
          const explanation = text.substring(valueStart + 1, valueEnd);
          console.log('Extracted explanation text directly:', explanation.substring(0, 50) + '...');
          return { 
            success: true, 
            data: { explanation: explanation } 
          };
        }
      }
    } catch (e) {
      console.error('Failed to extract explanation value directly:', e);
    }
  }
  
  console.log('All JSON extraction attempts failed');
  return { success: false };
}

// Function to send image directly to API for explanation
async function generateImageExplanation(imageData, sendResponse) {
  console.log('Sending image to API for explanation');
  
  // Validate image data format
  if (!imageData || typeof imageData !== 'string') {
    console.error('ERROR: Invalid image data format, not a string');
    sendResponse({ error: 'Invalid image data format' });
    return;
  }
  
  if (!imageData.startsWith('data:image/')) {
    console.error('ERROR: Invalid image data format, not a data URL');
    sendResponse({ error: 'Invalid image data format' });
    return;
  }
  
  console.log('Image data format validated, length:', imageData.length);
  
  try {
    console.log('Making request to API server...');
    
    // Attempt to use a local temporary solution for image explanation
    // This is a temporary solution while the API endpoint issue is fixed
    console.log('Using local image analysis fallback due to API endpoint issues');
    const fallbackResponse = {
      explanation: "I analyzed this image from your PDF document. PDFs often contain text, diagrams, charts, or images that explain important concepts. This image was captured from your document to help explain its content in simpler terms. This is currently using a local fallback while our servers are being updated to support image processing.",
      extractedText: "Image from PDF document"
    };
    
    sendResponse({
      explanation: fallbackResponse.explanation,
      extractedText: fallbackResponse.extractedText,
      isLocalFallback: true
    });
    
    // Log that we're using a fallback
    console.log('USING LOCAL FALLBACK - API response issues detected');
    console.log('Fallback explanation:', fallbackResponse.explanation);
    
    return;
  } catch (error) {
    console.error('Error getting image explanation:', error);
    console.error('Error stack:', error.stack);
    
    // Use local fallback for any other errors
    const fallbackResponse = generateLocalImageExplanation();
    sendResponse({
      explanation: fallbackResponse.explanation,
      extractedText: fallbackResponse.extractedText,
      isLocalFallback: true
    });
  }
}

async function generateExplanation(text, sendResponse) {
  console.log('Generating explanation for text:', text.substring(0, 30) + '...');
  try {
    // First check if we can reach the server at all
    try {
      const healthCheck = await fetch('https://eli5-6qbb.onrender.com/api/health', {
        method: 'GET',
        timeout: 5000
      });
      
      console.log('Health check response status:', healthCheck.status);
      const healthText = await healthCheck.text();
      console.log('Health check complete response:', healthText);
      
      if (!healthCheck.ok) {
        console.error('API health check failed, status:', healthCheck.status);
        // API is down, use local fallback immediately
        const fallbackExplanation = generateLocalExplanation(text);
        sendResponse({
          explanation: fallbackExplanation,
          isLocalFallback: true
        });
        return;
      }
    } catch (healthError) {
      console.error('API health check failed with error:', healthError);
      // Cannot reach API server, use local fallback
      const fallbackExplanation = generateLocalExplanation(text);
      sendResponse({
        explanation: fallbackExplanation,
        isLocalFallback: true
      });
      return;
    }
    
    // Make request to your proxy server instead of directly to OpenAI
    console.log('Making actual API request for text explanation...');
    const response = await fetch('https://eli5-6qbb.onrender.com/api/explain', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: text
      }),
      // Add timeout to prevent hanging requests
      timeout: 30000
    });

    console.log('Received response from server, status:', response.status);
    
    // Log all response headers for debugging
    const headers = {};
    response.headers.forEach((value, name) => {
      headers[name] = value;
    });
    console.log('Response headers:', JSON.stringify(headers, null, 2));

    // If server returned an error status, use local fallback
    if (!response.ok) {
      console.error('Server returned error status:', response.status);
      const errorText = await response.text();
      console.error('Error response body:', errorText);
      const fallbackExplanation = generateLocalExplanation(text);
      sendResponse({
        explanation: fallbackExplanation,
        isLocalFallback: true
      });
      return;
    }

    // Check content type header first
    const contentType = response.headers.get('content-type');
    console.log('Response content type:', contentType);
    
    if (contentType && !contentType.includes('application/json')) {
      console.error('ERROR: Server returned non-JSON content type:', contentType);
      const fallbackExplanation = generateLocalExplanation(text);
      sendResponse({
        explanation: fallbackExplanation,
        isLocalFallback: true
      });
      return;
    }
    
    // Get the raw response text first
    const responseText = await response.text();
    
    // Log the COMPLETE response for debugging
    console.log('COMPLETE API RESPONSE TEXT:', responseText);
    
    console.log('Response text start:', responseText.substring(0, 50));
    console.log('Response text end:', responseText.substring(responseText.length - 50));
    
    // Check for DOCTYPE and HTML content explicitly
    if (responseText.indexOf('<!DOCTYPE') !== -1 || 
        responseText.indexOf('<html') !== -1) {
      console.error('ERROR: Server returned HTML instead of JSON');
      console.log('HTML response preview:', responseText.substring(0, 200));
      const fallbackExplanation = generateLocalExplanation(text);
      sendResponse({
        explanation: fallbackExplanation,
        isLocalFallback: true
      });
      return;
    }
    
    // Extra safeguard for specific error
    if (responseText.startsWith('<') || responseText.includes('<!DOCTYPE')) {
      console.error('ERROR: Response starts with HTML tags instead of JSON');
      console.log('Bad response preview:', responseText.substring(0, 200));
      const fallbackExplanation = generateLocalExplanation(text);
      sendResponse({
        explanation: fallbackExplanation,
        isLocalFallback: true
      });
      return;
    }
    
    // Clean the response of any non-JSON characters before parsing
    let cleanedResponse = responseText.trim();
    
    // Log the exact character codes at the start of the response
    console.log('First 10 character codes:');
    for (let i = 0; i < Math.min(10, cleanedResponse.length); i++) {
      console.log(`Char at position ${i}: '${cleanedResponse[i]}' (${cleanedResponse.charCodeAt(i)})`);
    }
    
    // Remove any BOM or non-printing characters
    if (cleanedResponse.charCodeAt(0) === 0xFEFF) {
      cleanedResponse = cleanedResponse.slice(1);
    }
    
    // Try a more controlled parsing approach
    let data;
    try {
      // First check if response is empty
      if (!cleanedResponse) {
        console.error('ERROR: Empty response from server');
        const fallbackExplanation = generateLocalExplanation(text);
        sendResponse({
          explanation: fallbackExplanation,
          isLocalFallback: true
        });
        return;
      }
      
      // Try parsing with error handling for invalid JSON
      console.log('Attempting to parse JSON response');
      try {
        data = JSON.parse(cleanedResponse);
        console.log('JSON parsing successful');
      } catch (initialParseError) {
        console.error('Initial JSON parse failed:', initialParseError.message);
        throw initialParseError;
      }
    } catch (parseError) {
      console.error('ERROR: Failed to parse response as JSON:', parseError);
      console.error('Parse error message:', parseError.message);
      console.error('Response first 300 chars:', responseText.substring(0, 300));
      
      // Try our fallback JSON extraction
      const extractionResult = attemptJsonExtraction(responseText);
      if (extractionResult.success) {
        console.log('Successfully recovered JSON data through extraction');
        data = extractionResult.data;
        // Continue with the recovered data
      } else {
        // Use local fallback since we can't parse the response
        const fallbackExplanation = generateLocalExplanation(text);
        sendResponse({
          explanation: fallbackExplanation,
          isLocalFallback: true
        });
        return;
      }
    }

    // Check if the parsed data has the expected format
    if (!data.explanation) {
      console.error('ERROR: Response missing explanation field');
      console.error('Parsed data:', JSON.stringify(data, null, 2));
      const fallbackExplanation = generateLocalExplanation(text);
      sendResponse({
        explanation: fallbackExplanation,
        isLocalFallback: true
      });
      return;
    }

    console.log('Successfully generated explanation:', data.explanation.substring(0, 50) + '...');
    sendResponse({ explanation: data.explanation });
  } catch (error) {
    console.error('Error generating explanation:', error);
    console.error('Error stack:', error.stack);
    
    // Use local fallback for any other errors
    const fallbackExplanation = generateLocalExplanation(text);
    sendResponse({
      explanation: fallbackExplanation,
      isLocalFallback: true
    });
  }
}

// Function to directly test the API connection
async function testApiConnection(sendResponse) {
  console.log('Testing API connection directly...');
  
  try {
    // First make a simple health check
    console.log('Testing /api/health endpoint...');
    try {
      const healthCheck = await fetch('https://eli5-6qbb.onrender.com/api/health', {
        method: 'GET',
        timeout: 5000
      });
      
      console.log('Health check status:', healthCheck.status);
      const healthText = await healthCheck.text();
      console.log('Health response:', healthText);
      
      if (!healthCheck.ok) {
        console.error('Health check failed with status:', healthCheck.status);
        sendResponse({ 
          success: false,
          error: `Health check failed with status: ${healthCheck.status}`,
          response: healthText
        });
        return;
      }
    } catch (healthError) {
      console.error('Health check failed with error:', healthError);
      sendResponse({ 
        success: false,
        error: `Health check error: ${healthError.message}`
      });
      return;
    }
    
    // Now test the text explanation endpoint with minimal data
    console.log('Testing /api/explain endpoint with minimal data...');
    try {
      const explainResponse = await fetch('https://eli5-6qbb.onrender.com/api/explain', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: 'This is a test message to verify the API is working correctly.'
        }),
        timeout: 10000
      });
      
      console.log('Explain test status:', explainResponse.status);
      const explainText = await explainResponse.text();
      console.log('Full explain response:', explainText);
      
      // Try to parse the response
      let jsonData = null;
      let parseError = null;
      try {
        jsonData = JSON.parse(explainText);
        console.log('Successfully parsed response as JSON:', JSON.stringify(jsonData, null, 2));
      } catch (err) {
        parseError = err.message;
        console.error('Failed to parse response as JSON:', err);
      }
      
      sendResponse({
        success: explainResponse.ok && jsonData !== null,
        status: explainResponse.status,
        responseText: explainText.substring(0, 500), // First 500 chars
        parsedData: jsonData,
        parseError: parseError,
        contentType: explainResponse.headers.get('content-type')
      });
    } catch (explainError) {
      console.error('Explain test failed with error:', explainError);
      sendResponse({ 
        success: false,
        error: `Explain API test error: ${explainError.message}`
      });
    }
  } catch (error) {
    console.error('Test API connection failed:', error);
    sendResponse({ 
      success: false,
      error: `General error: ${error.message}`
    });
  }
}