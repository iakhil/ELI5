// ELI5 Buddy - Background Script

const API_BASE_URL = 'http://localhost:5001';

// Listen for extension installation
chrome.runtime.onInstalled.addListener(details => {
    console.log('ELI5 Buddy extension installed!', details);
});

// Initialize context menu
function initContextMenu() {
    chrome.contextMenus.create({
        id: 'eli5-context-menu',
        title: 'Explain Like I\'m 5',
        contexts: ['selection']
    });
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'eli5-context-menu') {
        if (info.selectionText && info.selectionText.length > 10) {
            // Send the selected text to the content script to handle
            chrome.tabs.sendMessage(tab.id, {
                action: 'explainText',
                text: info.selectionText
            });
        } else {
            // Send error message to the content script
            chrome.tabs.sendMessage(tab.id, {
                action: 'showError',
                error: 'Please select more text (at least 10 characters)'
            });
        }
    }
});

// Initialize context menu when background script loads
if (chrome.contextMenus) {
    initContextMenu();
}

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Background received message:', message);
    
    // Capture visible tab as screenshot
    if (message.action === 'captureVisibleTab') {
        captureVisibleTab()
            .then(imageData => {
                sendResponse({ imageData });
            })
            .catch(error => {
                console.error('Screenshot capture error:', error);
                sendResponse({ error: error.message || 'Failed to capture screenshot' });
            });
        return true; // Keep channel open for async response
    }
    
    // Process and explain image
    if (message.action === 'explainImage') {
        processAndExplainImage(message.imageData)
            .then(response => {
                sendResponse(response);
            })
            .catch(error => {
                console.error('Image explanation error:', error);
                sendResponse({ 
                    error: error.message || 'Failed to process image'
                });
            });
        return true; // Keep channel open for async response
    }
    
    // Check authentication status
    if (message.action === 'checkAuth') {
        checkAuthStatus()
            .then(isAuthenticated => {
                sendResponse({ isAuthenticated });
            })
            .catch(error => {
                console.error('Auth check error:', error);
                sendResponse({ isAuthenticated: false });
            });
        return true; // Keep channel open for async response
    }
    
    // Check premium status
    if (message.action === 'checkPremium') {
        checkPremiumStatus()
            .then(isPremium => {
                sendResponse({ isPremium });
            })
            .catch(error => {
                console.error('Premium check error:', error);
                sendResponse({ isPremium: false });
            });
        return true; // Keep channel open for async response
    }
    
    // Get explanation from API
    if (message.action === 'getExplanation') {
        getExplanation(message.text)
            .then(response => {
                sendResponse(response);
            })
            .catch(error => {
                console.error('Explanation error:', error);
                sendResponse({ 
                    error: error.message || 'Failed to generate explanation. Please try again.'
                });
            });
        return true; // Keep channel open for async response
    }
    
    // Create flashcard
    if (message.action === 'createFlashcard') {
        createFlashcard(message.front, message.back, message.category)
            .then(response => {
                sendResponse(response);
            })
            .catch(error => {
                console.error('Create flashcard error:', error);
                sendResponse({ 
                    success: false, 
                    error: error.message || 'Failed to create flashcard. Please try again.'
                });
            });
        return true; // Keep channel open for async response
    }
    
    // Open upgrade page
    if (message.action === 'openUpgrade') {
        chrome.tabs.create({ url: `${API_BASE_URL}/pricing` });
        sendResponse({ success: true });
    }
});

// Capture current tab as an image
async function captureVisibleTab() {
    return new Promise((resolve, reject) => {
        try {
            chrome.tabs.captureVisibleTab(
                null, 
                { format: 'png', quality: 100 }, 
                dataUrl => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                    } else if (!dataUrl) {
                        reject(new Error('Failed to capture tab image'));
                    } else {
                        resolve(dataUrl);
                    }
                }
            );
        } catch (error) {
            reject(error);
        }
    });
}

// Process image with OCR and get explanation
async function processAndExplainImage(imageData) {
    try {
        // Get auth token
        const token = await getAuthToken();
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        
        console.log('Sending image data to API for OCR and explanation...');
        
        // Call API endpoint to process the image
        const response = await fetch(`${API_BASE_URL}/api/extract-and-explain`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...headers
            },
            body: JSON.stringify({ 
                imageData 
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('API Error Response:', errorData);
            throw new Error(errorData.error || `Server error: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Log the full API response for debugging
        console.log('=== API RESPONSE START ===');
        console.log('Status:', response.status);
        console.log('Extracted Text:', data.extractedText);
        console.log('Explanation:', data.explanation);
        console.log('=== API RESPONSE END ===');
        
        return { 
            explanation: data.explanation,
            extractedText: data.extractedText
        };
    } catch (error) {
        console.error('Error processing image:', error);
        throw error;
    }
}

// Check if user is authenticated
async function checkAuthStatus() {
    // Get auth token from storage
    const token = await getAuthToken();
    if (!token) return false;
    
    try {
        // Verify token with the backend
        const response = await fetch(`${API_BASE_URL}/api/verify-token`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        return response.ok;
    } catch (error) {
        console.error('Error verifying auth token:', error);
        return false;
    }
}

// Check if user has premium status
async function checkPremiumStatus() {
    // Get auth token from storage
    const token = await getAuthToken();
    if (!token) return false;
    
    try {
        // Check premium status with the backend
        const response = await fetch(`${API_BASE_URL}/api/user/subscription?test_premium=true`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) return false;
        
        const data = await response.json();
        return data.isPremium;
    } catch (error) {
        console.error('Error checking premium status:', error);
        return false;
    }
}

// Get explanation from API
async function getExplanation(text) {
    try {
        // Get auth token
        const token = await getAuthToken();
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        
        // Call API to get explanation
        const response = await fetch(`${API_BASE_URL}/api/explain`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...headers
            },
            body: JSON.stringify({ text })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to generate explanation');
        }
        
        const data = await response.json();
        return { explanation: data.explanation };
    } catch (error) {
        console.error('Error getting explanation:', error);
        throw error;
    }
}

// Create a flashcard
async function createFlashcard(front, back, category) {
    // Get auth token from storage
    const token = await getAuthToken();
    if (!token) {
        throw new Error('Authentication required to create flashcards');
    }
    
    try {
        // Call API to create flashcard
        const response = await fetch(`${API_BASE_URL}/api/flashcards?test_premium=true`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                front,
                back,
                category: category || 'General'
            })
        });
        
        if (!response.ok) {
            if (response.status === 403) {
                throw new Error('Premium subscription required to create flashcards');
            }
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to create flashcard');
        }
        
        const data = await response.json();
        return { success: true, flashcard: data.flashcard };
    } catch (error) {
        console.error('Error creating flashcard:', error);
        throw error;
    }
}

// Get auth token from storage
async function getAuthToken() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['authToken'], (result) => {
            resolve(result.authToken || null);
        });
    });
}

// Set auth token in storage
async function setAuthToken(token) {
    return new Promise((resolve) => {
        chrome.storage.local.set({ authToken: token }, () => {
            resolve();
        });
    });
}

// Listen for authentication changes from Firebase Auth
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'setAuthToken') {
        setAuthToken(message.token)
            .then(() => {
                sendResponse({ success: true });
            })
            .catch(error => {
                console.error('Error setting auth token:', error);
                sendResponse({ success: false });
            });
        return true; // Keep channel open for async response
    }
}); 