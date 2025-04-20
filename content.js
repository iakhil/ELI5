// Function to get selected text
function getSelectedText() {
    return window.getSelection().toString();
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[content.js] Received message:', request);
    if (request.action === 'getSelectedText') {
        const selectedText = window.getSelection().toString();
        console.log('[content.js] Selected text:', selectedText);
        sendResponse({ text: selectedText });
    }
    return true; // Required for async response
});

console.log('[content.js] Script loaded and listening.'); 