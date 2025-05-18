// ELI5 Buddy - Content Script (DEBUG VERSION)

console.log('ELI5 Buddy content script loaded - DEBUG VERSION');
    
// Create a fixed floating button that's always visible
function createDebugButton() {
    // Create button element
    const captureButton = document.createElement('button');
    captureButton.id = 'eli5-debug-button';
    captureButton.textContent = 'ELI5 Debug Button';
    
    // Add explicit inline styles for maximum compatibility
    Object.assign(captureButton.style, {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: '2147483647', // Maximum z-index
        padding: '12px 20px',
        backgroundColor: 'red',
        color: 'white',
        border: 'none',
        borderRadius: '30px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
        fontFamily: 'Arial, sans-serif',
        fontSize: '16px',
        fontWeight: 'bold',
        cursor: 'pointer'
    });
    
    // Add click event
    captureButton.addEventListener('click', () => {
        alert('Debug button clicked!');
    });
    
    // Append to body with delay to ensure DOM is ready
    setTimeout(() => {
        document.body.appendChild(captureButton);
        console.log('Debug button added to page');
    }, 1000);
}

// Create and add the normal capture button
function createFixedCaptureButton() {
    console.log('Creating fixed capture button');
    
    // Check if the button already exists
    if (document.querySelector('.eli5-buddy-capture-button')) {
        console.log('Capture button already exists, not creating again');
        return;
    }
    
    try {
        // Create button element
        const captureButton = document.createElement('button');
        captureButton.className = 'eli5-buddy-ui eli5-buddy-capture-button';
        captureButton.id = 'eli5-capture-button';
        captureButton.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path>
            </svg>
            <span>Capture & Explain</span>
        `;
        
        // Add explicit inline styles for maximum compatibility
        Object.assign(captureButton.style, {
            position: 'fixed',
            bottom: '80px',
            right: '20px',
            zIndex: '2147483647', // Maximum z-index
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 20px',
            backgroundColor: '#4285f4',
            color: 'white',
            border: 'none',
            borderRadius: '30px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
            fontFamily: 'Arial, sans-serif',
            fontSize: '16px',
            fontWeight: '500',
            cursor: 'pointer'
        });
    
        // Add click event
        captureButton.addEventListener('click', () => {
            alert('Capture button clicked!');
    });
    
        // Append to body with delay to ensure DOM is ready
        setTimeout(() => {
            document.body.appendChild(captureButton);
            console.log('Fixed capture button added to page');
        }, 2000);
    } catch (error) {
        console.error('Error creating capture button:', error);
    }
}

// Initialize
function initialize() {
    console.log('ELI5 Buddy initializing...');
    
    // Create both buttons for debugging
    createDebugButton();
    createFixedCaptureButton();
    
    // Log document.body state
    console.log('Document body ready state:', document.readyState);
    console.log('Document body exists:', !!document.body);
}

// Make sure DOM is ready before initializing
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
                } else {
    initialize();
}

// Additional fallback initialization
window.addEventListener('load', () => {
    console.log('Window load event fired');
initialize(); 
}); 