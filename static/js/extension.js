// Import Firebase auth
import { auth } from './firebase-config.js';
import { signOut } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

// Check if we're running in a Chrome extension context
const isExtension = window.chrome && chrome.runtime && chrome.runtime.id;

// Base URL for API calls
const API_BASE_URL = 'http://localhost:5001';

// Only execute this code if we're in a Chrome extension
if (isExtension) {
    console.log('Running in Chrome extension context');

    // Wait for DOM to be fully loaded
    document.addEventListener('DOMContentLoaded', async function() {
        // Create login status element if it doesn't exist
        let headerElement = document.querySelector('header') || document.querySelector('.header');
        
        // If no header found, try to find the title area or create a container after the title
        if (!headerElement) {
            const titleElement = document.querySelector('h1') || document.querySelector('.logo');
            
            if (titleElement) {
                // Create a status container and insert it after the title
                const statusContainer = document.createElement('div');
                statusContainer.className = 'login-status-container';
                statusContainer.style.cssText = 'display: flex; justify-content: flex-end; margin: 5px 0; padding: 0 10px;';
                titleElement.parentNode.insertBefore(statusContainer, titleElement.nextSibling);
                headerElement = statusContainer;
            }
        }
        
        // Create login status elements if header found
        if (headerElement) {
            // Create login status elements if they don't exist
            if (!document.getElementById('loginStatus')) {
                const loginStatusElement = document.createElement('div');
                loginStatusElement.id = 'loginStatus';
                loginStatusElement.className = 'login-status';
                loginStatusElement.style.cssText = 'font-size: 12px; padding: 2px 8px; border-radius: 10px; margin-left: auto; font-weight: bold;';
                headerElement.appendChild(loginStatusElement);
            }
            
            if (!document.getElementById('userEmail')) {
                const userEmailElement = document.createElement('span');
                userEmailElement.id = 'userEmail';
                userEmailElement.className = 'user-email';
                userEmailElement.style.cssText = 'font-size: 11px; margin-left: 5px; color: #666;';
                headerElement.appendChild(userEmailElement);
            }
            
            // Create premium badge if it doesn't exist
            if (!document.getElementById('premiumBadge')) {
                const premiumBadge = document.createElement('span');
                premiumBadge.id = 'premiumBadge';
                premiumBadge.className = 'premium-badge';
                premiumBadge.textContent = 'PREMIUM';
                premiumBadge.style.cssText = 'display: none; background-color: gold; color: #333; font-size: 10px; padding: 1px 5px; border-radius: 8px; margin-left: 5px;';
                headerElement.appendChild(premiumBadge);
            }
        }
        
        // Get Elements (now that we've created them if needed)
        const loginStatusElement = document.getElementById('loginStatus');
        const userEmailElement = document.getElementById('userEmail');
        const premiumBadge = document.getElementById('premiumBadge');
        
        // Find or create login/logout buttons
        let loginButton = document.getElementById('loginButton');
        let logoutButton = document.getElementById('logoutButton');
        
        // If no login button, try to find any button we can use
        if (!loginButton) {
            const explainButton = document.querySelector('button:not(#logoutButton)');
            if (explainButton && explainButton.parentNode) {
                loginButton = document.createElement('button');
                loginButton.id = 'loginButton';
                loginButton.textContent = 'Login';
                loginButton.style.cssText = 'display: none; margin-top: 10px; padding: 8px 16px; border-radius: 4px; background-color: #6c5ce7; color: white; border: none; cursor: pointer;';
                explainButton.parentNode.appendChild(loginButton);
            }
        }
        
        // Setup the flashcards tab content
        setupFlashcardTab();
        
        // Auth State Observer
        auth.onAuthStateChanged((user) => {
            if (!loginStatusElement) return;
            
            if (user) {
                // User is signed in
                console.log('User is signed in:', user.email);
                
                loginStatusElement.textContent = 'Logged in';
                loginStatusElement.style.backgroundColor = 'rgba(0, 184, 148, 0.1)';
                loginStatusElement.style.color = '#00b894';
                
                if (userEmailElement) {
                    userEmailElement.textContent = user.email;
                }
                
                // Check premium status and update UI
                checkPremiumStatus(user.uid);
                
                // Update UI buttons
                if (loginButton) loginButton.style.display = 'none';
                if (logoutButton) logoutButton.style.display = 'block';
            } else {
                // User is signed out
                console.log('User is signed out');
                
                loginStatusElement.textContent = 'Not logged in';
                loginStatusElement.style.backgroundColor = 'rgba(214, 48, 49, 0.1)';
                loginStatusElement.style.color = '#d63031';
                
                if (userEmailElement) {
                    userEmailElement.textContent = '';
                }
                
                // Hide premium badge
                if (premiumBadge) {
                    premiumBadge.style.display = 'none';
                }
                
                // Reset flashcard UI to non-premium state
                updateFlashcardUI(false);
                
                // Update UI buttons
                if (loginButton) loginButton.style.display = 'block';
                if (logoutButton) logoutButton.style.display = 'none';
            }
        });
        
        // Check premium status
        async function checkPremiumStatus(userId) {
            try {
                const user = auth.currentUser;
                if (!user) return false;
                
                // Get ID token for authentication
                const idToken = await user.getIdToken();
                
                // Call API to check subscription status
                const response = await fetch(`${API_BASE_URL}/api/user/subscription?test_premium=true`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${idToken}`
                    }
                });
                
                if (!response.ok) {
                    throw new Error(`Failed to check premium status: ${response.status}`);
                }
                
                const data = await response.json();
                console.log('Premium status check:', data);
                
                // Update UI based on premium status
                if (premiumBadge) {
                    premiumBadge.style.display = data.isPremium ? 'inline-block' : 'none';
                }
                
                // Update flashcard UI
                updateFlashcardUI(data.isPremium);
                
                return data.isPremium;
            } catch (error) {
                console.error('Error checking premium status:', error);
                return false;
            }
        }
        
        // Add event listeners
        if (loginButton) {
            loginButton.addEventListener('click', () => {
                // Open login page in new tab
                chrome.tabs.create({ url: `${API_BASE_URL}/login` });
            });
        }
        
        // Setup flashcard tab UI elements
        function setupFlashcardTab() {
            const flashcardTab = document.querySelector('[data-tab="flashcards"]');
            const flashcardContent = document.getElementById('flashcards-content');
            
            if (flashcardContent) {
                // Clear existing content
                flashcardContent.innerHTML = '';
                
                // Create initial UI elements
                const container = document.createElement('div');
                container.style.cssText = 'padding: 20px; text-align: center;';
                
                const title = document.createElement('h3');
                title.textContent = 'Flashcards';
                title.style.cssText = 'margin-bottom: 15px;';
                
                const description = document.createElement('p');
                description.id = 'flashcard-description';
                description.textContent = 'Create flashcards from your explanations';
                
                const actions = document.createElement('div');
                actions.id = 'flashcard-actions';
                actions.style.cssText = 'margin-top: 20px;';
                
                // Premium upsell button
                const upgradeBanner = document.createElement('div');
                upgradeBanner.id = 'premium-upgrade-banner';
                upgradeBanner.className = 'premium-upgrade-banner';
                upgradeBanner.style.cssText = 'background-color: rgba(255, 215, 0, 0.1); padding: 10px; border-radius: 8px; margin: 15px 0; border: 1px solid gold;';
                
                const upgradeText = document.createElement('p');
                upgradeText.textContent = '✨ Upgrade to Premium to unlock Flashcards';
                upgradeText.style.cssText = 'margin-bottom: 10px;';
                
                const upgradeButton = document.createElement('button');
                upgradeButton.textContent = 'Upgrade Now';
                upgradeButton.className = 'btn-primary';
                upgradeButton.style.cssText = 'background-color: #ffc107; color: #333; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;';
                upgradeButton.addEventListener('click', handleUpgradeClick);
                
                // Premium features UI
                const createFlashcardButton = document.createElement('button');
                createFlashcardButton.id = 'create-flashcard';
                createFlashcardButton.textContent = 'Create Flashcard';
                createFlashcardButton.className = 'btn-primary';
                createFlashcardButton.style.cssText = 'background-color: #4285f4; color: white; border: none; padding: 8px 16px; border-radius: 20px; cursor: pointer; margin-right: 8px; display: none;';
                createFlashcardButton.addEventListener('click', handleCreateFlashcard);
                
                const generateFlashcardsButton = document.createElement('button');
                generateFlashcardsButton.id = 'generate-flashcards';
                generateFlashcardsButton.textContent = 'Auto Generate';
                generateFlashcardsButton.className = 'btn-primary';
                generateFlashcardsButton.style.cssText = 'background-color: #4285f4; color: white; border: none; padding: 8px 16px; border-radius: 20px; cursor: pointer; display: none;';
                generateFlashcardsButton.addEventListener('click', handleGenerateFlashcards);
                
                // Assemble the UI
                upgradeBanner.appendChild(upgradeText);
                upgradeBanner.appendChild(upgradeButton);
                
                actions.appendChild(createFlashcardButton);
                actions.appendChild(generateFlashcardsButton);
                
                container.appendChild(title);
                container.appendChild(description);
                container.appendChild(upgradeBanner);
                container.appendChild(actions);
                
                flashcardContent.appendChild(container);
                
                // Flashcard list container
                const flashcardListContainer = document.createElement('div');
                flashcardListContainer.id = 'flashcard-list';
                flashcardListContainer.style.cssText = 'margin-top: 20px; display: none;';
                flashcardContent.appendChild(flashcardListContainer);
            }
        }
        
        // Update flashcard UI based on premium status
        function updateFlashcardUI(isPremium) {
            const upgradeContainer = document.getElementById('premium-upgrade-banner');
            const createButton = document.getElementById('create-flashcard');
            const generateButton = document.getElementById('generate-flashcards');
            const description = document.getElementById('flashcard-description');
            const flashcardList = document.getElementById('flashcard-list');
            
            if (upgradeContainer) {
                upgradeContainer.style.display = isPremium ? 'none' : 'block';
            }
            
            if (createButton) {
                createButton.style.display = isPremium ? 'inline-block' : 'none';
            }
            
            if (generateButton) {
                generateButton.style.display = isPremium ? 'inline-block' : 'none';
            }
            
            if (description) {
                description.textContent = isPremium ? 
                    'Create and study flashcards to reinforce your learning' : 
                    'Create flashcards from your explanations';
            }
            
            if (flashcardList) {
                flashcardList.style.display = isPremium ? 'block' : 'none';
                
                if (isPremium) {
                    // Fetch user's flashcards
                    fetchFlashcards();
                }
            }
        }
        
        // Handle upgrade button click
        async function handleUpgradeClick() {
            try {
                const user = auth.currentUser;
                if (!user) {
                    alert('Please log in to upgrade to Premium');
                    return;
                }
                
                // Get ID token for authentication
                const idToken = await user.getIdToken();
                
                // Create checkout session
                const response = await fetch(`${API_BASE_URL}/create-checkout-session`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${idToken}`
                    }
                });
                
                if (!response.ok) {
                    throw new Error(`Failed to create checkout session: ${response.status}`);
                }
                
                const { id: sessionId } = await response.json();
                
                // Open checkout in new tab
                chrome.tabs.create({ url: `${API_BASE_URL}/pricing?session_id=${sessionId}` });
            } catch (error) {
                console.error('Error starting checkout:', error);
                alert('Failed to start checkout. Please try again.');
            }
        }
        
        // Handle create flashcard button click
        function handleCreateFlashcard() {
            alert('Create flashcard feature coming soon!');
            // Implement flashcard creation UI here
        }
        
        // Handle generate flashcards button click
        async function handleGenerateFlashcards() {
            try {
                // Get selected text from current tab
                chrome.tabs.executeScript({
                    code: 'window.getSelection().toString();'
                }, async function(selectionResults) {
                    if (!selectionResults || !selectionResults[0]) {
                        alert('Please highlight text first to generate flashcards');
                        return;
                    }
                    
                    const selectedText = selectionResults[0];
                    if (selectedText.length < 20) {
                        alert('Please select more text to generate flashcards (at least 20 characters)');
                        return;
                    }
                    
                    // Get auth token
                    const user = auth.currentUser;
                    if (!user) {
                        alert('Please log in to generate flashcards');
                        return;
                    }
                    
                    // Show loading state
                    const generateButton = document.getElementById('generate-flashcards');
                    if (generateButton) {
                        generateButton.textContent = 'Generating...';
                        generateButton.disabled = true;
                    }
                    
                    // Get ID token for authentication
                    const idToken = await user.getIdToken();
                    
                    // Call API to generate flashcards
                    const response = await fetch(`${API_BASE_URL}/api/generate-flashcards?test_premium=true`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${idToken}`
                        },
                        body: JSON.stringify({ text: selectedText })
                    });
                    
                    // Reset button state
                    if (generateButton) {
                        generateButton.textContent = 'Auto Generate';
                        generateButton.disabled = false;
                    }
                    
                    if (!response.ok) {
                        if (response.status === 403) {
                            alert('Premium subscription required to generate flashcards');
                            return;
                        }
                        throw new Error(`Failed to generate flashcards: ${response.status}`);
                    }
                    
                    const data = await response.json();
                    console.log('Generated flashcards:', data);
                    
                    // Show success message
                    alert(`Successfully generated ${data.flashcards.length} flashcards!`);
                    
                    // Fetch and display updated flashcards
                    fetchFlashcards();
                });
            } catch (error) {
                console.error('Error generating flashcards:', error);
                alert('Failed to generate flashcards. Please try again.');
                
                // Reset button state
                const generateButton = document.getElementById('generate-flashcards');
                if (generateButton) {
                    generateButton.textContent = 'Auto Generate';
                    generateButton.disabled = false;
                }
            }
        }
        
        // Fetch user's flashcards
        async function fetchFlashcards() {
            try {
                const user = auth.currentUser;
                if (!user) return;
                
                // Get ID token for authentication
                const idToken = await user.getIdToken();
                
                // Call API to fetch flashcards
                const response = await fetch(`${API_BASE_URL}/api/flashcards?test_premium=true`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${idToken}`
                    }
                });
                
                if (!response.ok) {
                    throw new Error(`Failed to fetch flashcards: ${response.status}`);
                }
                
                const data = await response.json();
                console.log('Fetched flashcards:', data);
                
                // Update UI with flashcards
                displayFlashcards(data.flashcards || []);
            } catch (error) {
                console.error('Error fetching flashcards:', error);
            }
        }
        
        // Display flashcards in the UI
        function displayFlashcards(flashcards) {
            const flashcardListContainer = document.getElementById('flashcard-list');
            if (!flashcardListContainer) return;
            
            // Clear existing content
            flashcardListContainer.innerHTML = '';
            
            if (flashcards.length === 0) {
                const emptyMessage = document.createElement('p');
                emptyMessage.textContent = 'No flashcards yet. Create or generate some!';
                emptyMessage.style.cssText = 'text-align: center; color: #666; margin-top: 20px;';
                flashcardListContainer.appendChild(emptyMessage);
                return;
            }
            
            // Create flashcard list
            const listTitle = document.createElement('h4');
            listTitle.textContent = 'Your Flashcards';
            listTitle.style.cssText = 'margin-bottom: 10px; text-align: left; padding: 0 15px;';
            flashcardListContainer.appendChild(listTitle);
            
            // Create flashcard items
            const list = document.createElement('div');
            list.style.cssText = 'max-height: 150px; overflow-y: auto; padding: 0 15px;';
            
            // Sort flashcards by creation date (newest first)
            flashcards.sort((a, b) => b.created_at - a.created_at);
            
            flashcards.forEach(flashcard => {
                const item = document.createElement('div');
                item.className = 'flashcard-item';
                item.style.cssText = 'padding: 8px; margin-bottom: 8px; border-radius: 4px; background-color: #f5f6fa; cursor: pointer;';
                
                const front = document.createElement('div');
                front.className = 'flashcard-front';
                front.textContent = flashcard.front;
                front.style.cssText = 'font-weight: bold; margin-bottom: 3px;';
                
                const category = document.createElement('div');
                category.className = 'flashcard-category';
                category.textContent = `Category: ${flashcard.category}`;
                category.style.cssText = 'font-size: 10px; color: #666;';
                
                item.appendChild(front);
                item.appendChild(category);
                
                // Add click event to show flashcard details
                item.addEventListener('click', () => {
                    alert(`Front: ${flashcard.front}\nBack: ${flashcard.back}`);
                });
                
                list.appendChild(item);
            });
            
            flashcardListContainer.appendChild(list);
        }
    });
} 