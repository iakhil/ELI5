// Import Firebase auth
import { auth } from './firebase-config.js';
import { signOut } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

// Check if we're running in a Chrome extension context
const isExtension = window.chrome && chrome.runtime && chrome.runtime.id;

// Only execute this code if we're NOT in a Chrome extension
if (!isExtension) {
    console.log('Running in website context');

    // DOM Elements
    const userEmailElement = document.getElementById('userEmail');
    const loginButton = document.getElementById('loginButton');
    const signupButton = document.getElementById('signupButton');
    const logoutButton = document.getElementById('logoutButton');

    // Auth State Observer
    auth.onAuthStateChanged((user) => {
        if (user) {
            // User is signed in
            userEmailElement.textContent = user.email;
            loginButton.style.display = 'none';
            signupButton.style.display = 'none';
            logoutButton.style.display = 'block';
        } else {
            // User is signed out
            userEmailElement.textContent = '';
            loginButton.style.display = 'block';
            signupButton.style.display = 'block';
            logoutButton.style.display = 'none';
        }
    });

    // Handle logout
    async function handleLogout() {
        try {
            await signOut(auth);
            window.location.href = '/login';
        } catch (error) {
            console.error('Logout error:', error);
            alert('Failed to log out. Please try again.');
        }
    }

    // Event Listeners
    if (loginButton) {
        loginButton.addEventListener('click', () => {
            window.location.href = '/login';
        });
    }

    if (signupButton) {
        signupButton.addEventListener('click', () => {
            window.location.href = '/signup';
        });
    }

    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
    }
} 