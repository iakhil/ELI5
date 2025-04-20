document.addEventListener('DOMContentLoaded', function() {
  // Get DOM elements - Explain mode
  const eli5Button = document.getElementById('eli5Button');
  const explanationDiv = document.getElementById('explanation');
  const loadingElement = document.getElementById('loading');
  const explanationContainer = document.getElementById('explanation-container');
  const copyButton = document.getElementById('copyButton');
  
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
      explanationDiv.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-circle"></i> Error: ${err.message}</div>`;
      explanationContainer.classList.remove('hidden');
      return '';
    }
  }

  // Handle the ELI5 button click
  eli5Button.addEventListener('click', async function() {
    loadingElement.classList.remove('hidden');
    explanationContainer.classList.add('hidden');
    explanationDiv.innerHTML = ''; // Clear previous errors
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const highlightedText = await getSelectedText(tab);
      
      if (!highlightedText) {
        if (!explanationDiv.innerHTML) {
            loadingElement.classList.add('hidden');
            explanationDiv.innerHTML = '<div class="error-message"><i class="fas fa-highlighter"></i> Please highlight some text on the page first.</div>';
            explanationContainer.classList.remove('hidden');
        }
        return;
      }
      
      console.log('[popup.js] Sending text to background for explanation:', highlightedText);
      chrome.runtime.sendMessage({ text: highlightedText }, function(response) {
        loadingElement.classList.add('hidden');
        console.log('[popup.js] Received response from background:', response);
        
        if (response && response.explanation) {
          explanationDiv.innerText = response.explanation;
          explanationContainer.classList.remove('hidden');
        } else if (response && response.error) {
          explanationDiv.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-circle"></i> API Error: ${response.error}</div>`;
          explanationContainer.classList.remove('hidden');
        } else {
          explanationDiv.innerHTML = '<div class="error-message"><i class="fas fa-exclamation-circle"></i> Failed to get explanation. Unknown error.</div>';
          explanationContainer.classList.remove('hidden');
        }
      });

    } catch (error) {
      console.error('[popup.js] Error in ELI5 button click handler:', error);
      loadingElement.classList.add('hidden');
      explanationDiv.innerHTML = '<div class="error-message"><i class="fas fa-exclamation-circle"></i> An unexpected error occurred. Check console.</div>';
      explanationContainer.classList.remove('hidden');
    }
  });
  
  // Handle copy button click for explanation
  copyButton.addEventListener('click', function() {
    const textToCopy = explanationDiv.innerText;
    
    // Copy text to clipboard
    navigator.clipboard.writeText(textToCopy).then(function() {
      // Show success feedback
      const originalIcon = copyButton.innerHTML;
      copyButton.innerHTML = '<i class="fas fa-check"></i>';
      
      // Reset icon after 2 seconds
      setTimeout(function() {
        copyButton.innerHTML = originalIcon;
      }, 2000);
    }).catch(function(err) {
      console.error('Could not copy text: ', err);
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
  `;
  document.head.appendChild(style);
});