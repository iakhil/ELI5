// Import Firebase services
import { auth, db } from './firebase-config.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { doc, setDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// DOM Elements
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');

// Login form handler
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        try {
            console.log('Attempting to sign in user:', email);
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            console.log('Sign in successful:', userCredential.user.uid);
            window.location.href = '/dashboard';
        } catch (error) {
            console.error('Login error:', {
                code: error.code,
                message: error.message,
                stack: error.stack
            });
            let errorMessage = error.message;
            if (error.code === 'auth/invalid-credential') {
                errorMessage = 'Invalid email or password';
            }
            showError(errorMessage.replace('Firebase: ', ''));
        }
    });
}

// Message handling
function showError(message) {
    console.log('Showing error:', message);
    const messageElement = createMessageElement(message, 'error', 'fa-circle-exclamation');
    insertMessage(messageElement);
}

function showSuccess(message) {
    return new Promise((resolve) => {
        console.log('Showing success message:', message);
        const messageElement = createMessageElement(message, 'success', 'fa-circle-check');
        console.log('Created success element:', messageElement);
        insertMessage(messageElement);
        
        // Display for 3 seconds before redirecting
        setTimeout(resolve, 3000);
    });
}

function createMessageElement(message, type, icon) {
    console.log(`Creating ${type} message element for: ${message}`);
    const div = document.createElement('div');
    div.className = `message ${type}-message`;
    
    // Add icon if provided
    if (icon) {
        const iconElement = document.createElement('i');
        iconElement.className = `fas ${icon}`;
        iconElement.style.marginRight = '8px';
        div.appendChild(iconElement);
    }
    
    const textSpan = document.createElement('span');
    textSpan.textContent = message;
    div.appendChild(textSpan);
    
    // Force visibility with inline styles
    div.style.display = 'flex';
    div.style.opacity = '1';
    div.style.alignItems = 'center';
    div.style.justifyContent = 'center';
    
    return div;
}

function insertMessage(messageElement) {
    console.log('Inserting message element...');
    // Remove any existing messages
    const existingMessages = document.querySelectorAll('.message');
    existingMessages.forEach(msg => msg.remove());

    // Find the auth card and title
    const authCard = document.querySelector('.auth-card');
    console.log('Found auth card:', authCard);
    const title = authCard.querySelector('h2');
    console.log('Found title:', title);

    // Insert the message after the title
    title.insertAdjacentElement('afterend', messageElement);
    console.log('Message inserted into DOM');
}

// Signup form handler
if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Disable form submission
        const submitButton = signupForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        
        // Verify auth is initialized
        if (!auth) {
            console.error('Auth is not initialized');
            showError('Authentication service is not available. Please try again later.');
            submitButton.disabled = false;
            return;
        }

        const email = document.getElementById('signupEmail').value;
        const password = document.getElementById('signupPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (password !== confirmPassword) {
            showError('Passwords do not match');
            submitButton.disabled = false;
            return;
        }

        try {
            console.log('Starting signup process for:', email);
            
            // Create user with email and password
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            console.log('User created successfully:', userCredential.user.uid);
            
            // Create user document in Firestore
            try {
                console.log('Creating user document in Firestore');
                const userDocRef = doc(db, 'users', userCredential.user.uid);
                await setDoc(userDocRef, {
                    email: userCredential.user.email,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    explanations_generated: 0,
                    flashcards_generated: 0,
                    subscription: {
                        status: 'free',
                        created_at: new Date().toISOString()
                    }
                });
                console.log('User document created in Firestore');
            } catch (firestoreError) {
                console.error('Failed to create Firestore document:', firestoreError);
                // Show error but don't prevent redirect
                showError('Account created, but there was an issue setting up your profile. Please contact support if issues persist.');
            }
            
            // Show success message
            const successOverlay = document.getElementById('successOverlay');
            if (successOverlay) {
                successOverlay.style.display = 'flex';
            } else {
                alert('Account created successfully! Redirecting to dashboard...');
            }
            
            // Redirect to dashboard
            setTimeout(() => {
                window.location.href = '/dashboard';
            }, 2000);
            
        } catch (error) {
            console.error('Signup error:', {
                code: error.code,
                message: error.message,
                stack: error.stack,
                auth: auth ? 'Initialized' : 'Not initialized'
            });
            
            let errorMessage = error.message;
            if (error.code === 'auth/email-already-in-use') {
                errorMessage = 'This email is already registered';
            } else if (error.code === 'auth/weak-password') {
                errorMessage = 'Password should be at least 6 characters';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = 'Invalid email address';
            } else if (error.code === 'auth/configuration-not-found') {
                errorMessage = 'Authentication service is not properly configured. Please check authorized domains.';
            } else if (error.code === 'auth/network-request-failed') {
                errorMessage = 'Network error. Please check your internet connection.';
            }
            showError(errorMessage.replace('Firebase: ', ''));
            submitButton.disabled = false;
        }
    });
} 