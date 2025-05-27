// ELI5 Buddy - Content Script (Static Version)

console.log('ELI5 Buddy content script loaded - Static Version');
    
// BUTTON FUNCTIONS COMPLETELY REMOVED
// All floating buttons have been removed to comply with Chrome Web Store policies

// Initialize
function initialize() {
    console.log('ELI5 Buddy initializing... (No UI elements)');
    
    // NO UI ELEMENTS CREATED
    // This version operates only through the extension popup
    // No floating buttons or UI elements are added to the page
    
    // Log document state for debugging only
    console.log('Document ready state:', document.readyState);
}

// Make sure DOM is ready before initializing
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
    } else {
    initialize();
}

// Listen for messages from the extension popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[content.js] Received message:', request);
    if (request.action === 'getSelectedText') {
        const selectedText = window.getSelection().toString();
        sendResponse({ text: selectedText });
    }
    return true; // Required for async response
}); 