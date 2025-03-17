document.addEventListener('DOMContentLoaded', function() {
  // Get DOM elements
  const eli5Button = document.getElementById('eli5Button');
  const explanationDiv = document.getElementById('explanation');
  const loadingElement = document.getElementById('loading');
  const explanationContainer = document.getElementById('explanation-container');
  const copyButton = document.getElementById('copyButton');
  
  // Handle the ELI5 button click
  eli5Button.addEventListener('click', function() {
    // Show loading animation and hide any previous explanation
    loadingElement.classList.remove('hidden');
    explanationContainer.classList.add('hidden');
    
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      chrome.tabs.executeScript(tabs[0].id, { code: "window.getSelection().toString();" }, function(selection) {
        const highlightedText = selection[0];
        
        if (highlightedText && highlightedText.trim() !== '') {
          // Send message to background script
          chrome.runtime.sendMessage({ text: highlightedText }, function(response) {
            // Hide loading animation
            loadingElement.classList.add('hidden');
            
            if (response && response.explanation && response.explanation.choices && response.explanation.choices[0]) {
              const explanation = response.explanation.choices[0].message.content.trim();
              
              // Display the explanation
              explanationDiv.innerText = explanation;
              explanationContainer.classList.remove('hidden');
            } else {
              // Show error message
              explanationDiv.innerHTML = '<div class="error-message"><i class="fas fa-exclamation-circle"></i> Failed to generate explanation. Please try again.</div>';
              explanationContainer.classList.remove('hidden');
            }
          });
        } else {
          // Hide loading and show error for no text selected
          loadingElement.classList.add('hidden');
          explanationDiv.innerHTML = '<div class="error-message"><i class="fas fa-highlighter"></i> Please highlight some text on the page first.</div>';
          explanationContainer.classList.remove('hidden');
        }
      });
    });
  });
  
  // Handle copy button click
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