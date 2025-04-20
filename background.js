// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Received message in background:', request);
  
  if (!request.text) {
    sendResponse({ error: 'No text provided' });
    return true;
  }
  
  generateExplanation(request.text, sendResponse);
  return true; // Keep the message channel open for async response
});

async function generateExplanation(text, sendResponse) {
  console.log('Generating explanation for:', text.substring(0, 30) + '...');
  try {
    // Make request to your proxy server instead of directly to OpenAI
    const response = await fetch('https://eli5-6qbb.onrender.com/api/explain', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: text
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to connect to server' }));
      throw new Error(errorData.message || `Server error: ${response.status}`);
    }

    const data = await response.json();
    console.log('API response received');
    
    if (data.error) {
      console.error('API error:', data.error);
      sendResponse({ error: data.error });
      return;
    }

    console.log('Successfully generated explanation');
    sendResponse({ explanation: data.explanation });
  } catch (error) {
    console.error('Error generating explanation:', error);
    sendResponse({ error: error.message });
  }
}