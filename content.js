// ELI5 Buddy - Content Script with area selection

console.log('ELI5 Buddy content script loaded');

// Variables for area selection
let isAreaSelectionActive = false;
let selectionBox = null;
let startX = 0;
let startY = 0;

// Make startAreaSelection function available globally
window.startAreaSelection = startAreaSelection;

// Create the selection button
function createSelectionButton() {
    console.log('Creating selection button...');
    
    // Check if we're in a frame
    if (window !== window.top) {
        console.log('Running in iframe, not creating button');
        return;
    }
    
    // Check if button already exists
    if (document.getElementById('eli5-area-select-button')) {
        console.log('Button already exists');
        return;
    }
    
    try {
        // Create button element with more visible styling
        const btn = document.createElement('button');
        btn.id = 'eli5-area-select-button';
        btn.textContent = '📷 Capture & Explain';
        
        // Add styles for high visibility
        Object.assign(btn.style, {
            position: 'fixed',
            bottom: '30px',
            right: '30px',
            zIndex: '2147483647',
            padding: '12px 20px',
            backgroundColor: '#4285f4',
            color: 'white',
            border: 'none',
            borderRadius: '30px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
            fontFamily: 'Arial, sans-serif',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
        });
        
        // Add hover effect
        btn.addEventListener('mouseover', function() {
            Object.assign(btn.style, {
                backgroundColor: '#3367d6',
                transform: 'translateY(-2px)',
                boxShadow: '0 6px 16px rgba(0, 0, 0, 0.5)'
            });
        });
        
        btn.addEventListener('mouseout', function() {
            Object.assign(btn.style, {
                backgroundColor: '#4285f4',
                transform: 'translateY(0)',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)'
            });
        });
        
        // Add click event
        btn.addEventListener('click', function() {
            console.log('Selection button clicked');
            startAreaSelection();
        });
        
        // Append to body
        document.body.appendChild(btn);
        console.log('✅ Selection button added successfully');
    } catch (error) {
        console.error('Error creating selection button:', error);
    }
}

// Start the area selection process
function startAreaSelection() {
    console.log('Starting area selection mode');
    isAreaSelectionActive = true;
    
    // Hide the button if it exists
    const selectionButton = document.getElementById('eli5-area-select-button');
    if (selectionButton) selectionButton.style.display = 'none';
    
    // First remove any existing overlays if present
    const existingOverlay = document.getElementById('eli5-selection-overlay');
    if (existingOverlay) existingOverlay.remove();
    
    // Create the overlay
    const overlay = document.createElement('div');
    overlay.id = 'eli5-selection-overlay';
    Object.assign(overlay.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        zIndex: '2147483646',
        cursor: 'crosshair'
    });
    document.body.appendChild(overlay);
    
    // Create the selection box
    selectionBox = document.createElement('div');
    selectionBox.id = 'eli5-selection-box';
    Object.assign(selectionBox.style, {
        position: 'absolute',
        border: '2px dashed #4285f4',
        backgroundColor: 'rgba(66, 133, 244, 0.1)',
        display: 'none',
        zIndex: '2147483647'
    });
    overlay.appendChild(selectionBox);
    
    console.log('Selection box created:', selectionBox ? 'Success' : 'Failed');
    
    // Add mouse event listeners
    overlay.addEventListener('mousedown', handleSelectionStart);
    overlay.addEventListener('mousemove', handleSelectionMove);
    overlay.addEventListener('mouseup', handleSelectionEnd);
    
    // Add escape key listener
    document.addEventListener('keydown', function escKeyHandler(e) {
        if (e.key === 'Escape') {
            cancelAreaSelection();
            document.removeEventListener('keydown', escKeyHandler);
        }
    });
}

// Handle the start of selection
function handleSelectionStart(e) {
    if (!selectionBox) {
        console.error('Selection box not initialized');
        return;
    }
    
    startX = e.clientX;
    startY = e.clientY;
    selectionBox.style.left = startX + 'px';
    selectionBox.style.top = startY + 'px';
    selectionBox.style.width = '0';
    selectionBox.style.height = '0';
    selectionBox.style.display = 'block';
    
    console.log('Selection started at', startX, startY);
}

// Handle selection movement
function handleSelectionMove(e) {
    if (!selectionBox || selectionBox.style.display === 'none') return;
    
    const currentX = e.clientX;
    const currentY = e.clientY;
    
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);
    
    const left = Math.min(startX, currentX);
    const top = Math.min(startY, currentY);
    
    selectionBox.style.left = left + 'px';
    selectionBox.style.top = top + 'px';
    selectionBox.style.width = width + 'px';
    selectionBox.style.height = height + 'px';
}

// Handle the end of selection
function handleSelectionEnd(e) {
    const overlay = document.getElementById('eli5-selection-overlay');
    if (!overlay || !selectionBox) {
        console.error('Selection overlay or box not found');
        return;
    }
    
    overlay.removeEventListener('mousedown', handleSelectionStart);
    overlay.removeEventListener('mousemove', handleSelectionMove);
    overlay.removeEventListener('mouseup', handleSelectionEnd);
    
    // Check if the selection is too small
    const width = parseInt(selectionBox.style.width, 10);
    const height = parseInt(selectionBox.style.height, 10);
    
    console.log('Selection ended with dimensions:', width, height);
    
    if (width < 50 || height < 50) {
        // Selection too small
        console.log('Selection too small, cancelling');
        cancelAreaSelection();
        return;
    }
    
    // Add control buttons
    const controlsElement = document.createElement('div');
    controlsElement.id = 'eli5-selection-controls';
    Object.assign(controlsElement.style, {
        position: 'fixed',
        display: 'flex',
        gap: '8px',
        padding: '10px',
        backgroundColor: 'white',
        borderRadius: '5px',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
        zIndex: '2147483647'
    });
    
    // Position the controls below the selection box
    const boxRect = selectionBox.getBoundingClientRect();
    controlsElement.style.left = boxRect.left + 'px';
    controlsElement.style.top = (boxRect.bottom + 10) + 'px';
    
    // Create capture button
    const captureButton = document.createElement('button');
    captureButton.textContent = 'Capture & Explain';
    Object.assign(captureButton.style, {
        padding: '8px 16px',
        borderRadius: '4px',
        fontSize: '14px',
        cursor: 'pointer',
        border: 'none',
        backgroundColor: '#4285f4',
        color: 'white'
    });
    captureButton.addEventListener('click', captureSelectedArea);
    
    // Create cancel button
    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    Object.assign(cancelButton.style, {
        padding: '8px 16px',
        borderRadius: '4px',
        fontSize: '14px',
        cursor: 'pointer',
        border: 'none',
        backgroundColor: '#f1f3f4',
        color: '#444'
    });
    cancelButton.addEventListener('click', cancelAreaSelection);
    
    // Add buttons to controls
    controlsElement.appendChild(captureButton);
    controlsElement.appendChild(cancelButton);
    
    // Add controls to body
    document.body.appendChild(controlsElement);
}

// Capture the selected area and send for explanation
function captureSelectedArea() {
    console.log('Capturing selected area');
    
    // Check if selection box exists
    if (!selectionBox) {
        console.error('Error: Selection box not found');
        showError('Error: Could not find selection area');
        return;
    }
    
    // Get selection coordinates
    const boxRect = selectionBox.getBoundingClientRect();
    const area = {
        x: Math.round(boxRect.left),
        y: Math.round(boxRect.top),
        width: Math.round(boxRect.width),
        height: Math.round(boxRect.height)
    };
    
    console.log('Selection box dimensions:', area);
    
    // Clean up selection UI
    cancelAreaSelection();
    
    // Show a loading message
    const loadingMessage = document.createElement('div');
    loadingMessage.id = 'eli5-loading-message';
    Object.assign(loadingMessage.style, {
        position: 'fixed',
        bottom: '80px',
        right: '30px',
        padding: '10px 20px',
        backgroundColor: 'white',
        borderRadius: '5px',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
        zIndex: '2147483647',
        fontFamily: 'Arial, sans-serif'
    });
    loadingMessage.textContent = 'Capturing and processing image...';
    document.body.appendChild(loadingMessage);
    
    // Simplified approach: Just ask for the screenshot and do all processing here
    console.log('Sending captureTab message to background');
    try {
        chrome.runtime.sendMessage({
            action: 'captureTab'
        }, response => {
            // Check for runtime error (like context invalidation)
            if (chrome.runtime.lastError) {
                console.error('Chrome runtime error:', chrome.runtime.lastError.message);
                if (loadingMessage) loadingMessage.remove();
                showError(`Extension error: ${chrome.runtime.lastError.message}. Try refreshing the page.`);
                return;
            }
            
            console.log('Received captureTab response:', response ? 'Success' : 'No response');
            
            if (loadingMessage) {
                loadingMessage.remove();
            }
            
            if (response && response.screenshot) {
                console.log('Screenshot received, cropping in content script');
                
                // Process the screenshot in the content script
                cropImage(response.screenshot, area)
                    .then(croppedImage => {
                        console.log('Image cropped successfully, data length:', croppedImage.length);
                        
                        // Create another loading message for the explanation part
                        const processingMessage = document.createElement('div');
                        processingMessage.id = 'eli5-processing-message';
                        Object.assign(processingMessage.style, {
                            position: 'fixed',
                            bottom: '80px',
                            right: '30px',
                            padding: '10px 20px',
                            backgroundColor: 'white',
                            borderRadius: '5px',
                            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
                            zIndex: '2147483647',
                            fontFamily: 'Arial, sans-serif'
                        });
                        processingMessage.textContent = 'Getting explanation from AI...';
                        document.body.appendChild(processingMessage);
                        
                        // Now send for explanation
                        console.log('Sending explainImage message to background');
                        try {
                            // Log the image data details before sending
                            console.log('Image data length before sending:', croppedImage.length);
                            console.log('Image data format validation:', croppedImage.startsWith('data:image/'));
                            
                            chrome.runtime.sendMessage({
                                action: 'explainImage',
                                imageData: croppedImage
                            }, explanationResponse => {
                                // Check for runtime error again
                                if (chrome.runtime.lastError) {
                                    console.error('Chrome runtime error:', chrome.runtime.lastError.message);
                                    if (processingMessage) processingMessage.remove();
                                    showError(`Extension error: ${chrome.runtime.lastError.message}. Try refreshing the page.`);
                                    return;
                                }
                                
                                console.log('=== RECEIVED EXPLANATION RESPONSE ===');
                                console.log('Response received:', !!explanationResponse);
                                
                                if (explanationResponse) {
                                    // Check for errors first
                                    if (explanationResponse.error) {
                                        console.error('Error in explanation response:', explanationResponse.error);
                                        
                                        if (processingMessage) processingMessage.remove();
                                        
                                        // Show fallback explanation in case of errors
                                        const fallbackMessage = "I can see you're trying to explain a PDF image. Due to current server constraints, we're using a simplified explanation. We're actively improving our image processing capabilities.";
                                        showExplanation(fallbackMessage, "PDF image capture", true);
                                        return;
                                    }
                                    
                                    // Print full response info
                                    console.log('Has explanation:', !!explanationResponse.explanation);
                                    console.log('Has extracted text:', !!explanationResponse.extractedText);
                                    console.log('Is local fallback:', !!explanationResponse.isLocalFallback);
                                    
                                    if (explanationResponse.explanation) {
                                        console.log('Explanation length:', explanationResponse.explanation.length);
                                        console.log('Explanation sample:', explanationResponse.explanation.substring(0, 100) + 
                                            (explanationResponse.explanation.length > 100 ? '...' : ''));
                                        console.log('Extracted text length:', explanationResponse.extractedText ? explanationResponse.extractedText.length : 0);
                                        console.log('Extracted text sample:', explanationResponse.extractedText ? 
                                            explanationResponse.extractedText.substring(0, 100) + 
                                            (explanationResponse.extractedText.length > 100 ? '...' : '') : 'None');
                                    }
                                }
                                
                                if (processingMessage) {
                                    processingMessage.remove();
                                }
                                
                                if (explanationResponse && explanationResponse.explanation) {
                                    console.log('Explanation received successfully');
                                    // Check if this is a local fallback
                                    const isLocalFallback = explanationResponse.isLocalFallback === true;
                                    showExplanation(
                                        explanationResponse.explanation, 
                                        explanationResponse.extractedText || 'Image content',
                                        isLocalFallback
                                    );
                                } else if (explanationResponse && explanationResponse.error) {
                                    // Check if this is a fallback case (API is down)
                                    if (explanationResponse.fallback) {
                                        console.log('API service is down, showing fallback explanation');
                                        showFallbackExplanation(explanationResponse.error);
                                    } else {
                                        // Show regular error message
                                        showError(`Error: ${explanationResponse.error}`, explanationResponse.details);
                                    }
                                } else {
                                    console.error('Unknown error explaining image, no valid response');
                                    showError('Unknown error explaining image');
                                }
                            });
                        } catch (runtimeError) {
                            console.error('Error sending explainImage message:', runtimeError);
                            if (processingMessage) processingMessage.remove();
                            showError('Extension communication error. Please refresh the page and try again.');
                        }
                    })
                    .catch(error => {
                        console.error('Error cropping image:', error);
                        showError(`Error cropping image: ${error.message}`);
                    });
            } else if (response && response.error) {
                console.error('Error in captureTab response:', response.error);
                showError(`Error: ${response.error}`);
            } else {
                console.error('Failed to capture screenshot, no valid response');
                showError('Failed to capture screenshot');
            }
        });
    } catch (runtimeError) {
        console.error('Error sending captureTab message:', runtimeError);
        if (loadingMessage) loadingMessage.remove();
        showError('Extension communication error. Please refresh the page and try again.');
    }
}

// Simplified image cropping function
function cropImage(imageData, area) {
    return new Promise((resolve, reject) => {
        try {
            console.log('Cropping image in content script');
            
            // Create a canvas for cropping
            const canvas = document.createElement('canvas');
            canvas.width = area.width;
            canvas.height = area.height;
            const ctx = canvas.getContext('2d');
            
            // Create a new image
            const img = new Image();
            
            // Set up image load handler
            img.onload = () => {
                try {
                    // Draw the selected portion to the canvas
                    ctx.drawImage(
                        img,
                        area.x, area.y, area.width, area.height, // Source rectangle
                        0, 0, area.width, area.height // Destination rectangle
                    );
                    
                    // Convert canvas to data URL
                    const croppedImageData = canvas.toDataURL('image/png');
                    console.log('Image cropped successfully in content script');
                    resolve(croppedImageData);
                } catch (drawError) {
                    console.error('Error drawing image to canvas:', drawError);
                    reject(drawError);
                }
            };
            
            // Set up error handler
            img.onerror = (error) => {
                console.error('Error loading image for cropping:', error);
                reject(new Error('Failed to load image for cropping'));
            };
            
            // Set the image source
            img.src = imageData;
        } catch (error) {
            console.error('Error in cropImage:', error);
            reject(error);
        }
    });
}

// Show explanation in a nice pop-up
function showExplanation(explanation, originalText, isLocalFallback) {
    // Ensure we have some text to display
    explanation = explanation || "No explanation was generated.";
    
    // Create explanation container
    const container = document.createElement('div');
    container.id = 'eli5-explanation-container';
    Object.assign(container.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        width: '350px',
        maxHeight: '80vh',
        backgroundColor: 'white',
        boxShadow: '0 0 20px rgba(0, 0, 0, 0.2)',
        borderRadius: '8px',
        zIndex: '2147483647',
        overflow: 'hidden',
        fontFamily: 'Arial, sans-serif'
    });
    
    // Create header
    const header = document.createElement('div');
    Object.assign(header.style, {
        padding: '12px 16px',
        backgroundColor: '#f5f6fa',
        borderBottom: '1px solid #e0e0e0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
    });
    
    const title = document.createElement('div');
    title.textContent = 'Simple Explanation';
    Object.assign(title.style, {
        fontWeight: 'bold',
        color: '#4285f4'
    });
    
    const closeButton = document.createElement('button');
    closeButton.textContent = '×';
    Object.assign(closeButton.style, {
        background: 'none',
        border: 'none',
        fontSize: '24px',
        cursor: 'pointer',
        color: '#666'
    });
    closeButton.addEventListener('click', () => container.remove());
    
    header.appendChild(title);
    header.appendChild(closeButton);
    
    // Create content
    const content = document.createElement('div');
    Object.assign(content.style, {
        padding: '16px',
        overflowY: 'auto',
        maxHeight: 'calc(80vh - 50px)'
    });
    
    // Check if this is a PDF image capture
    const isPdfCapture = originalText === "Image from PDF document" || originalText === "PDF image capture";
    
    // Add explanation text
    const explanationText = document.createElement('p');
    explanationText.textContent = explanation;
    Object.assign(explanationText.style, {
        margin: '0',
        lineHeight: '1.5',
        fontSize: '14px',
        color: '#444'
    });
    
    // Add content
    content.appendChild(explanationText);
    
    // Add PDF-specific message if needed
    if (isPdfCapture) {
        const pdfNotice = document.createElement('div');
        pdfNotice.innerHTML = '<i>📄 PDF capture mode: We\'re using image-based explanation for PDF content.</i>';
        Object.assign(pdfNotice.style, {
            marginTop: '15px',
            padding: '8px 12px',
            backgroundColor: '#e8f0fe',
            borderRadius: '4px',
            fontSize: '12px',
            color: '#1a73e8',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
        });
        content.appendChild(pdfNotice);
    }
    
    // Add fallback notice if needed
    if (isLocalFallback) {
        const fallbackNotice = document.createElement('div');
        fallbackNotice.innerHTML = '<i>⚠️ Using local image processing. Connection to our AI service is currently unavailable.</i>';
        Object.assign(fallbackNotice.style, {
            marginTop: '15px',
            padding: '8px 12px',
            backgroundColor: '#fff3cd',
            borderRadius: '4px',
            fontSize: '12px',
            color: '#856404'
        });
        content.appendChild(fallbackNotice);
    }
    
    // Add header and content to container
    container.appendChild(header);
    container.appendChild(content);
    
    // Add to page
    document.body.appendChild(container);
}

// Show error message
function showError(message, details) {
    // Create error popup
    const errorPopup = document.createElement('div');
    errorPopup.id = 'eli5-error-popup';
    Object.assign(errorPopup.style, {
        position: 'fixed',
        bottom: '80px',
        right: '30px',
        padding: '12px 20px',
        backgroundColor: 'white',
        borderRadius: '5px',
        boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
        zIndex: '2147483647',
        fontFamily: 'Arial, sans-serif',
        borderLeft: '4px solid #e74c3c',
        color: '#333',
        maxWidth: '400px'
    });
    
    // Add error message
    const messageElem = document.createElement('div');
    messageElem.textContent = message;
    Object.assign(messageElem.style, {
        fontWeight: 'bold',
        marginBottom: details ? '8px' : '0'
    });
    errorPopup.appendChild(messageElem);
    
    // Add details if provided
    if (details) {
        const detailsElem = document.createElement('div');
        detailsElem.textContent = details;
        Object.assign(detailsElem.style, {
            fontSize: '12px',
            color: '#666',
            maxHeight: '60px',
            overflowY: 'auto',
            padding: '4px',
            backgroundColor: '#f9f9f9',
            borderRadius: '3px'
        });
        errorPopup.appendChild(detailsElem);
    }
    
    // Add close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    Object.assign(closeBtn.style, {
        position: 'absolute',
        top: '5px',
        right: '5px',
        background: 'none',
        border: 'none',
        fontSize: '16px',
        cursor: 'pointer',
        color: '#666'
    });
    closeBtn.addEventListener('click', () => errorPopup.remove());
    
    errorPopup.appendChild(closeBtn);
    document.body.appendChild(errorPopup);
    
    // Auto-remove after 8 seconds (longer for errors with details)
    setTimeout(() => {
        if (errorPopup.parentNode) {
            errorPopup.remove();
        }
    }, details ? 8000 : 5000);
}

// Cancel the area selection
function cancelAreaSelection() {
    console.log('Cancelling area selection');
    isAreaSelectionActive = false;
    
    // Remove selection elements
    const overlay = document.getElementById('eli5-selection-overlay');
    if (overlay) overlay.remove();
    
    // Remove controls element if it exists
    const controls = document.getElementById('eli5-selection-controls');
    if (controls) controls.remove();
    
    // Show the button again
    const selectionButton = document.getElementById('eli5-area-select-button');
    if (selectionButton) selectionButton.style.display = 'flex';
    
    selectionBox = null;
}

// Initialize with multiple approaches to ensure the button appears
function initialize() {
    console.log('Initializing ELI5 Buddy content script');
    
    // Create button immediately if the body exists
    if (document.body) {
        createSelectionButton();
    }
    
    // Also try when DOM is fully loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createSelectionButton);
    }
    
    // Final fallback on window load
    window.addEventListener('load', createSelectionButton);
    
    // Additional fallback - try again after a delay
    setTimeout(createSelectionButton, 1000);
    setTimeout(createSelectionButton, 3000);
}

// Start initialization
initialize();

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[content.js] Received message:', request);
    if (request.action === 'getSelectedText') {
        const selectedText = window.getSelection().toString();
        console.log('[content.js] Selected text:', selectedText);
        sendResponse({ text: selectedText });
    } else if (request.action === 'startAreaSelection') {
        startAreaSelection();
        sendResponse({ success: true });
    }
    return true; // Required for async response
});

// Function to provide a fallback explanation when the API is down
function showFallbackExplanation(error) {
    console.log('Showing fallback explanation due to API issues');
    
    const container = document.createElement('div');
    container.id = 'eli5-fallback-container';
    Object.assign(container.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        width: '350px',
        backgroundColor: 'white',
        boxShadow: '0 0 20px rgba(0, 0, 0, 0.2)',
        borderRadius: '8px',
        zIndex: '2147483647',
        overflow: 'hidden',
        fontFamily: 'Arial, sans-serif'
    });
    
    // Create header
    const header = document.createElement('div');
    Object.assign(header.style, {
        padding: '12px 16px',
        backgroundColor: '#f5f6fa',
        borderBottom: '1px solid #e0e0e0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
    });
    
    const title = document.createElement('div');
    title.textContent = 'Service Temporarily Unavailable';
    Object.assign(title.style, {
        fontWeight: 'bold',
        color: '#e74c3c'
    });
    
    const closeButton = document.createElement('button');
    closeButton.textContent = '×';
    Object.assign(closeButton.style, {
        background: 'none',
        border: 'none',
        fontSize: '24px',
        cursor: 'pointer',
        color: '#666'
    });
    closeButton.addEventListener('click', () => container.remove());
    
    header.appendChild(title);
    header.appendChild(closeButton);
    
    // Create content
    const content = document.createElement('div');
    Object.assign(content.style, {
        padding: '16px'
    });
    
    // Add fallback message
    const message = document.createElement('p');
    message.innerHTML = "Sorry, we can't analyze this image right now. Our explanation service is currently unavailable or experiencing high traffic.<br><br>Please try again in a few minutes.";
    Object.assign(message.style, {
        margin: '0 0 16px 0',
        lineHeight: '1.5',
        fontSize: '14px',
        color: '#444'
    });
    
    // Add error details if appropriate
    if (error && typeof error === 'string') {
        const errorDetails = document.createElement('p');
        errorDetails.textContent = `Error details: ${error}`;
        Object.assign(errorDetails.style, {
            margin: '8px 0 0 0',
            padding: '8px',
            backgroundColor: '#f9f9f9',
            borderRadius: '4px',
            fontSize: '12px',
            color: '#666'
        });
        content.appendChild(message);
        content.appendChild(errorDetails);
    } else {
        content.appendChild(message);
    }
    
    // Add container
    container.appendChild(header);
    container.appendChild(content);
    document.body.appendChild(container);
} 