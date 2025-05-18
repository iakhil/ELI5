document.addEventListener('DOMContentLoaded', function() {
  // Get DOM elements
  const eli5Button = document.getElementById('eli5Button');
  const captureButton = document.getElementById('captureButton');
  const explanationDiv = document.getElementById('explanation');
  const loadingElement = document.getElementById('loading');
  const explanationContainer = document.getElementById('explanation-container');
  const copyButton = document.getElementById('copyButton');
  
  // Add test API button
  const testApiButton = document.createElement('button');
  testApiButton.id = 'testApiButton';
  testApiButton.textContent = 'Test API Connection';
  testApiButton.style.marginTop = '10px';
  testApiButton.style.padding = '5px 10px';
  testApiButton.style.backgroundColor = '#f1f3f4';
  testApiButton.style.border = '1px solid #ccc';
  testApiButton.style.borderRadius = '4px';
  testApiButton.style.cursor = 'pointer';
  testApiButton.style.fontSize = '12px';
  testApiButton.style.display = 'block';
  document.querySelector('.container').appendChild(testApiButton);
  
  // Add area selection option
  const instructionBox = document.querySelector('.instruction-box');
  if (instructionBox) {
    const captureOption = document.createElement('p');
    captureOption.innerHTML = '<i class="fas fa-camera"></i> Or capture an area of the screen';
    instructionBox.appendChild(captureOption);
  }
  
  // Function to get selected text
  async function getSelectedText(tab) {
    console.log('[popup.js] Attempting to get selected text from tab:', tab.id);
    try {
      // Use scripting.executeScript instead of messaging
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: () => window.getSelection().toString()
      });
      
      console.log('[popup.js] Script execution results:', results);
      
      if (!results || results.length === 0) {
        console.error('[popup.js] No results from executeScript');
        return '';
      }
      
      const selectedText = results[0].result || '';
      console.log('[popup.js] Successfully retrieved text:', selectedText);
      return selectedText.trim();
    } catch (err) {
      console.error('[popup.js] Exception in getSelectedText:', err);
      showError(`Error: ${err.message}`);
      return '';
    }
  }

  // Check if current page is a PDF
  async function isPdfDocument(tab) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: () => {
          // Check URL ending with .pdf
          if (window.location.pathname.toLowerCase().endsWith('.pdf')) {
            return true;
          }
          
          // Check content type
          if (document.contentType === 'application/pdf') {
            return true;
          }
          
          // Check for PDF elements
          if (document.querySelector('embed[type="application/pdf"]') || 
              document.querySelector('object[type="application/pdf"]') ||
              document.querySelector('iframe[src*=".pdf"]')) {
            return true;
          }
          
          return false;
        }
      });
      
      return results && results[0] && results[0].result;
    } catch (err) {
      console.error('[popup.js] Error checking if document is PDF:', err);
      return false;
    }
  }

  // Capture screenshot of the current tab
  async function captureTab(tab) {
    try {
      return await new Promise((resolve) => {
        chrome.tabs.captureVisibleTab(
          null, 
          { format: 'png', quality: 100 }, 
          (dataUrl) => {
            if (chrome.runtime.lastError) {
              console.error('[popup.js] Screenshot capture error:', chrome.runtime.lastError);
              resolve(null);
            } else {
              resolve(dataUrl);
            }
          }
        );
      });
    } catch (err) {
      console.error('[popup.js] Error capturing tab:', err);
      return null;
    }
  }

  // Trigger area selection in the current tab
  async function triggerAreaSelection(tab) {
    try {
      const result = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: () => {
          // This will be executed in the context of the page
          if (typeof startAreaSelection === 'function') {
            console.log('Starting area selection from popup');
            startAreaSelection();
            return true;
          } else {
            console.error('startAreaSelection function not found in the page');
            return false;
          }
        }
      });
      
      if (!result || !result[0] || result[0].result !== true) {
        showError('Could not start area selection. Try refreshing the page.');
        return;
      }
      
      // Close the popup
      window.close();
    } catch (err) {
      console.error('[popup.js] Error triggering area selection:', err);
      if (chrome.runtime.lastError) {
        showError(`Error: ${chrome.runtime.lastError.message}`);
      } else {
        showError(`Error: ${err.message}`);
      }
    }
  }
  
  // Display error message
  function showError(message, details) {
    loadingElement.classList.add('hidden');
    
    // Check for special API service down error
    if (message.includes('API Error') && (
        message.includes('service') || 
        message.includes('HTML instead of JSON') || 
        message.includes('invalid JSON'))) {
      explanationDiv.innerHTML = `
        <div class="service-down-message">
          <i class="fas fa-exclamation-triangle"></i>
          <h3>Service Temporarily Unavailable</h3>
          <p>Our explanation service is currently unavailable or experiencing high traffic.</p>
          <p>Please try again in a few minutes.</p>
          ${details ? `<div class="error-details">${details}</div>` : ''}
        </div>
      `;
    } else {
      explanationDiv.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-circle"></i> ${message}</div>`;
    }
    
    explanationContainer.classList.remove('hidden');
  }

  // Handle the explain button click
  eli5Button.addEventListener('click', async function() {
    loadingElement.classList.remove('hidden');
    explanationContainer.classList.add('hidden');
    explanationDiv.innerHTML = ''; // Clear previous content
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const highlightedText = await getSelectedText(tab);
      
      if (!highlightedText || highlightedText.length < 20) {
        showError('Please highlight more text (at least 20 characters) on the page first.');
        return;
      }
      
      loadingElement.querySelector('p').textContent = 'Generating simple explanation...';
      
      chrome.runtime.sendMessage({ 
        action: 'getExplanation',
        text: highlightedText 
      }, function(response) {
        loadingElement.classList.add('hidden');
        console.log('[popup.js] Received response:', response);
        
        if (response && response.explanation) {
          explanationDiv.innerHTML = `
            <div class="explanation-title">Simple Explanation:</div>
            <div class="explanation-text">${response.explanation}</div>
          `;
          
          // Add a note if this is a local fallback
          if (response.isLocalFallback) {
            explanationDiv.innerHTML += `
              <div class="fallback-notice">
                <i class="fas fa-exclamation-triangle"></i>
                Our explanation service is currently offline. 
                This is a simplified fallback response.
              </div>
            `;
          }
          
          explanationContainer.classList.remove('hidden');
        } else if (response && response.error) {
          if (response.fallback) {
            // This is an API service down error
            showError(`API Error: ${response.error}`, response.details);
          } else {
            // Regular error
            showError(`API Error: ${response.error}`);
          }
        } else {
          showError('Failed to get explanation. Unknown error.');
        }
      });
    } catch (err) {
      showError(`Error: ${err.message}`);
    }
  });
  
  // Handle the capture button click
  captureButton.addEventListener('click', async function() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Check if we can inject script into this tab
      let canInject = false;
      try {
        canInject = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          function: () => true
        }).then(() => true).catch(() => false);
      } catch (error) {
        console.error('[popup.js] Error checking if script can be injected:', error);
        showError("Cannot access this page. Try a regular webpage instead.");
        return;
      }
      
      if (!canInject) {
        showError("Cannot capture this page. Try a regular webpage instead.");
        return;
      }
      
      // First check if content script already initialized the function
      try {
        const result = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          function: () => {
            return typeof startAreaSelection === 'function';
          }
        });
        
        if (result && result[0] && result[0].result === true) {
          // The function exists, trigger it
          await triggerAreaSelection(tab);
        } else {
          // Inject the content script first
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['content.js']
            });
            
            // Wait a bit for the script to initialize
            setTimeout(async () => {
              await triggerAreaSelection(tab);
            }, 500);
          } catch (injectError) {
            console.error('[popup.js] Error injecting content script:', injectError);
            if (chrome.runtime.lastError) {
              showError(`Error: ${chrome.runtime.lastError.message}`);
            } else {
              showError('Failed to inject content script. Try refreshing the page.');
            }
          }
        }
      } catch (scriptError) {
        console.error('[popup.js] Error executing script:', scriptError);
        if (chrome.runtime.lastError) {
          showError(`Error: ${chrome.runtime.lastError.message}`);
        } else {
          showError('Error checking page compatibility. Try refreshing the page.');
        }
      }
    } catch (err) {
      console.error('[popup.js] Error in capture button handler:', err);
      showError(`Error: ${err.message}`);
    }
  });
  
  // Handle copy button click
  if (copyButton) {
    copyButton.addEventListener('click', function() {
      const explanationText = document.querySelector('.explanation-text');
      if (explanationText) {
        navigator.clipboard.writeText(explanationText.textContent)
          .then(() => {
            const originalHtml = copyButton.innerHTML;
            copyButton.innerHTML = '<i class="fas fa-check"></i>';
            setTimeout(() => {
              copyButton.innerHTML = originalHtml;
            }, 1500);
          })
          .catch(err => {
            console.error('Could not copy text: ', err);
          });
      }
    });
  }
  
  // Handle test API button click
  testApiButton.addEventListener('click', function() {
    testApiButton.disabled = true;
    testApiButton.textContent = 'Testing...';
    
    explanationDiv.innerHTML = '<div class="testing-message">Testing API connection...</div>';
    explanationContainer.classList.remove('hidden');
    
    chrome.runtime.sendMessage({ 
      action: 'testApi'
    }, function(response) {
      testApiButton.disabled = false;
      testApiButton.textContent = 'Test API Connection';
      
      console.log('[popup.js] API test response:', response);
      
      if (response && response.success) {
        explanationDiv.innerHTML = `
          <div class="success-message">
            <i class="fas fa-check-circle"></i>
            API connection successful!
          </div>
          <div class="test-details">
            <p>Status: ${response.status}</p>
            <p>Content Type: ${response.contentType || 'N/A'}</p>
            ${response.parsedData ? `
              <p>Explanation: ${response.parsedData.explanation ? response.parsedData.explanation.substring(0, 100) + '...' : 'N/A'}</p>
            ` : ''}
          </div>
        `;
      } else {
        explanationDiv.innerHTML = `
          <div class="error-message">
            <i class="fas fa-exclamation-circle"></i>
            API test failed
          </div>
          <div class="test-details">
            ${response.error ? `<p>Error: ${response.error}</p>` : ''}
            ${response.parseError ? `<p>Parse Error: ${response.parseError}</p>` : ''}
            ${response.status ? `<p>Status: ${response.status}</p>` : ''}
            ${response.contentType ? `<p>Content Type: ${response.contentType}</p>` : ''}
          </div>
          <div class="response-preview">
            <p>Response Preview:</p>
            <pre>${response.responseText || 'No response data'}</pre>
          </div>
        `;
      }
    });
  });
  
  // Add error message styling
  const style = document.createElement('style');
  style.textContent = `
    .error-message {
      color: #dc3545;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .error-message i {
      font-size: 16px;
    }
    .success-message {
      color: #28a745;
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: bold;
    }
    .success-message i {
      font-size: 16px;
    }
    .testing-message {
      color: #0d6efd;
      padding: 10px;
      text-align: center;
    }
    .test-details {
      margin-top: 10px;
      font-size: 13px;
    }
    .test-details p {
      margin: 5px 0;
    }
    .response-preview {
      margin-top: 10px;
      background-color: #f8f9fa;
      padding: 8px;
      border-radius: 4px;
      font-size: 12px;
    }
    .response-preview pre {
      white-space: pre-wrap;
      word-break: break-all;
      margin: 5px 0;
      max-height: 100px;
      overflow-y: auto;
    }
    .fallback-notice {
      margin-top: 10px;
      padding: 8px 12px;
      background-color: #fff3cd;
      border-radius: 4px;
      font-size: 12px;
      color: #856404;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .fallback-notice i {
      color: #e67e22;
    }
    .service-down-message {
      text-align: center;
      color: #856404;
      background-color: #fff3cd;
      border: 1px solid #ffeeba;
      border-radius: 4px;
      padding: 15px;
      margin: 10px 0;
    }
    .service-down-message i {
      font-size: 24px;
      color: #e67e22;
      margin-bottom: 10px;
    }
    .service-down-message h3 {
      font-size: 16px;
      margin: 5px 0;
    }
    .service-down-message p {
      font-size: 14px;
      margin: 5px 0;
    }
    .error-details {
      margin-top: 10px;
      font-size: 12px;
      color: #666;
      background-color: rgba(0,0,0,0.05);
      padding: 5px;
      border-radius: 3px;
      max-height: 60px;
      overflow-y: auto;
      text-align: left;
    }
    .explanation-title {
      font-weight: bold;
      font-size: 16px;
      margin-bottom: 8px;
    }
    .explanation-text {
      margin-bottom: 12px;
    }
    .extracted-text-container {
      margin-top: 10px;
      padding: 8px;
      background-color: #f8f9fa;
      border-radius: 4px;
    }
    .extracted-text-title {
      font-size: 12px;
      font-weight: bold;
      color: #666;
    }
    .extracted-text {
      font-size: 12px;
      color: #666;
      margin-top: 4px;
    }
  `;
  document.head.appendChild(style);
});