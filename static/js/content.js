// ELI5 Buddy - Content Script

// Create and inject the ELI5 button
let eli5Button = null;
let selectedText = '';
let isExplaining = false;

// Set up message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'getSelectedText') {
        sendResponse({ text: getSelectedText() });
    } else if (message.action === 'showExplanation') {
        showExplanation(message.explanation, message.originalText);
        sendResponse({ success: true });
    }
    return true; // Required for async sendResponse
});

// Initialize when content script is loaded
function initialize() {
    console.log('ELI5 Buddy content script loaded');
    
    // Create floating action button
    createFloatingButton();
    
    // Add selection event listener
    document.addEventListener('mouseup', handleTextSelection);
    
    // Add escape key listener to hide explanation
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hideExplanation();
            hideFloatingButton();
        }
    });
}

// Handle text selection
function handleTextSelection(event) {
    // Ignore selection events in our own UI
    if (event.target.closest('.eli5-buddy-ui')) return;
    
    selectedText = getSelectedText();
    
    if (selectedText && selectedText.length > 20) {
        showFloatingButton(event);
    } else {
        hideFloatingButton();
    }
}

// Get the selected text
function getSelectedText() {
    return window.getSelection().toString().trim();
}

// Create floating action button
function createFloatingButton() {
    if (eli5Button) return;
    
    eli5Button = document.createElement('button');
    eli5Button.className = 'eli5-buddy-ui eli5-buddy-button';
    eli5Button.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path>
        </svg>
        <span>ELI5</span>
    `;
    
    eli5Button.style.cssText = `
        position: absolute;
        z-index: 9999;
        display: none;
        align-items: center;
        gap: 4px;
        padding: 6px 12px;
        background-color: #4285f4;
        color: white;
        border: none;
        border-radius: 20px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        outline: none;
    `;
    
    eli5Button.addEventListener('mouseover', () => {
        eli5Button.style.backgroundColor = '#3367d6';
        eli5Button.style.transform = 'translateY(-2px)';
        eli5Button.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
    });
    
    eli5Button.addEventListener('mouseout', () => {
        eli5Button.style.backgroundColor = '#4285f4';
        eli5Button.style.transform = 'translateY(0)';
        eli5Button.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.2)';
    });
    
    eli5Button.addEventListener('click', handleExplainClick);
    document.body.appendChild(eli5Button);
    
    // Add styles for the explanation box
    const style = document.createElement('style');
    style.textContent = `
        .eli5-buddy-ui {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }
        
        .eli5-buddy-explanation {
            position: fixed;
            z-index: 9998;
            top: 0;
            right: 0;
            width: 350px;
            max-height: 100vh;
            background-color: white;
            box-shadow: 0 0 20px rgba(0, 0, 0, 0.2);
            border-left: 4px solid #4285f4;
            overflow-y: auto;
            transform: translateX(100%);
            transition: transform 0.3s ease;
        }
        
        .eli5-buddy-explanation.visible {
            transform: translateX(0);
        }
        
        .eli5-explanation-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 16px;
            background-color: #f5f6fa;
            border-bottom: 1px solid #e0e0e0;
        }
        
        .eli5-explanation-title {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 16px;
            font-weight: 600;
            color: #4285f4;
        }
        
        .eli5-close-button {
            background: none;
            border: none;
            cursor: pointer;
            color: #666;
            font-size: 18px;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 4px;
        }
        
        .eli5-explanation-content {
            padding: 16px;
        }
        
        .eli5-explanation-content h3 {
            font-size: 16px;
            margin-bottom: 12px;
            color: #333;
        }
        
        .eli5-explanation-content p {
            font-size: 14px;
            line-height: 1.5;
            margin-bottom: 12px;
            color: #444;
        }
        
        .eli5-original-text {
            font-size: 13px;
            line-height: 1.4;
            padding: 10px;
            background-color: #f5f6fa;
            border-left: 3px solid #ddd;
            margin: 10px 0;
            color: #666;
            max-height: 100px;
            overflow-y: auto;
        }
        
        .eli5-action-buttons {
            display: flex;
            gap: 8px;
            margin-top: 16px;
        }
        
        .eli5-action-button {
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 13px;
            cursor: pointer;
            border: none;
        }
        
        .eli5-action-button.primary {
            background-color: #4285f4;
            color: white;
        }
        
        .eli5-action-button.secondary {
            background-color: #f1f3f4;
            color: #444;
        }
        
        .eli5-loading {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 24px;
        }
        
        .eli5-spinner {
            border: 3px solid rgba(0, 0, 0, 0.1);
            border-top: 3px solid #4285f4;
            border-radius: 50%;
            width: 24px;
            height: 24px;
            animation: spin 1s linear infinite;
            margin-bottom: 16px;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);
    
    // Create explanation container (hidden initially)
    const explanationContainer = document.createElement('div');
    explanationContainer.className = 'eli5-buddy-ui eli5-buddy-explanation';
    explanationContainer.id = 'eli5-explanation';
    explanationContainer.innerHTML = `
        <div class="eli5-explanation-header">
            <div class="eli5-explanation-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path>
                </svg>
                <span>ELI5 Explanation</span>
            </div>
            <button class="eli5-close-button" id="eli5-close">×</button>
        </div>
        <div class="eli5-explanation-content" id="eli5-content"></div>
    `;
    document.body.appendChild(explanationContainer);
    
    // Add close event listener
    document.getElementById('eli5-close').addEventListener('click', hideExplanation);
}

// Show floating button near the selection
function showFloatingButton(event) {
    if (!eli5Button) return;
    
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    
    // Position the button below the selection
    const buttonX = rect.left + (rect.width / 2) - (eli5Button.offsetWidth / 2);
    const buttonY = rect.bottom + window.scrollY + 10; // 10px below selection
    
    eli5Button.style.left = `${Math.max(10, buttonX)}px`;
    eli5Button.style.top = `${buttonY}px`;
    eli5Button.style.display = 'flex';
}

// Hide floating button
function hideFloatingButton() {
    if (eli5Button && !isExplaining) {
        eli5Button.style.display = 'none';
    }
}

// Handle explain button click
function handleExplainClick() {
    if (!selectedText || selectedText.length < 20) {
        alert('Please select more text to explain (at least 20 characters)');
        return;
    }
    
    isExplaining = true;
    hideFloatingButton();
    
    // Show explanation with loading state
    const explanationElement = document.getElementById('eli5-explanation');
    const contentElement = document.getElementById('eli5-content');
    
    contentElement.innerHTML = `
        <div class="eli5-loading">
            <div class="eli5-spinner"></div>
            <p>Creating simple explanation...</p>
        </div>
    `;
    
    explanationElement.classList.add('visible');
    
    // Send message to background script to get explanation
    chrome.runtime.sendMessage(
        { 
            action: 'getExplanation', 
            text: selectedText 
        },
        response => {
            if (response.error) {
                showExplanationError(response.error);
            } else if (response.explanation) {
                showExplanation(response.explanation, selectedText);
            }
            isExplaining = false;
        }
    );
}

// Show explanation
function showExplanation(explanation, originalText) {
    const contentElement = document.getElementById('eli5-content');
    const explanationElement = document.getElementById('eli5-explanation');
    
    if (!contentElement) return;
    
    // Truncate original text if too long
    const displayText = originalText.length > 150 
        ? originalText.substring(0, 150) + '...' 
        : originalText;
    
    contentElement.innerHTML = `
        <h3>Simple Explanation</h3>
        <p>${explanation}</p>
        <div class="eli5-original-text">
            <strong>Selected text:</strong><br>
            ${displayText}
        </div>
        <div class="eli5-action-buttons">
            <button class="eli5-action-button primary" id="eli5-flashcard">Create Flashcard</button>
            <button class="eli5-action-button secondary" id="eli5-copy">Copy Explanation</button>
        </div>
    `;
    
    explanationElement.classList.add('visible');
    
    // Add event listeners for action buttons
    document.getElementById('eli5-flashcard').addEventListener('click', () => {
        createFlashcard(originalText, explanation);
    });
    
    document.getElementById('eli5-copy').addEventListener('click', () => {
        navigator.clipboard.writeText(explanation)
            .then(() => {
                alert('Explanation copied to clipboard!');
            })
            .catch(err => {
                console.error('Failed to copy text: ', err);
            });
    });
}

// Show explanation error
function showExplanationError(errorMessage) {
    const contentElement = document.getElementById('eli5-content');
    
    contentElement.innerHTML = `
        <h3>Error</h3>
        <p>Sorry, we couldn't generate an explanation:</p>
        <p>${errorMessage}</p>
        <div class="eli5-action-buttons">
            <button class="eli5-action-button secondary" id="eli5-try-again">Try Again</button>
        </div>
    `;
    
    document.getElementById('eli5-try-again').addEventListener('click', () => {
        hideExplanation();
        handleExplainClick();
    });
}

// Hide explanation
function hideExplanation() {
    const explanationElement = document.getElementById('eli5-explanation');
    if (explanationElement) {
        explanationElement.classList.remove('visible');
    }
    isExplaining = false;
}

// Create flashcard from explanation
function createFlashcard(originalText, explanation) {
    // Send message to background to check if user is premium
    chrome.runtime.sendMessage({ action: 'checkPremium' }, response => {
        if (response.isPremium) {
            // User is premium, create flashcard
            chrome.runtime.sendMessage({
                action: 'createFlashcard',
                front: `What does this mean: "${originalText.substring(0, 100)}${originalText.length > 100 ? '...' : ''}"`,
                back: explanation,
                category: 'Explanation'
            }, response => {
                if (response.success) {
                    alert('Flashcard created successfully!');
                } else {
                    alert('Failed to create flashcard. Please try again or check if you are logged in.');
                }
            });
        } else {
            // Show premium upgrade message
            alert('Flashcards are a premium feature. Please upgrade to create flashcards!');
            chrome.runtime.sendMessage({ action: 'openUpgrade' });
        }
    });
}

// Initialize the content script
initialize(); 