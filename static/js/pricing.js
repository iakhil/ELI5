// Import Firebase auth
import { auth } from './firebase-config.js';
import { signOut } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

// Initialize Stripe
const stripe = Stripe(stripePublishableKey);

// DOM Elements
const checkoutButton = document.getElementById('checkoutButton');
const upgradeButtons = document.querySelectorAll('.btn-primary');
const logoutButton = document.getElementById('logoutButton');
const userEmailElement = document.getElementById('userEmail');

// Auth state observer
auth.onAuthStateChanged((user) => {
    if (user) {
        // User is signed in
        userEmailElement.textContent = user.email;
        logoutButton.style.display = 'block';
    } else {
        // User is signed out
        window.location.href = '/login';
    }
});

// Function to handle checkout
async function handleCheckout() {
    try {
        // Get current user
        const user = auth.currentUser;
        if (!user) {
            window.location.href = '/login';
            return;
        }

        // Get ID token
        const idToken = await user.getIdToken();
        
        // Create checkout session
        const response = await fetch('/create-checkout-session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
            }
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to create checkout session');
        }

        const { id: sessionId } = await response.json();
        
        // Redirect to Stripe checkout
        const result = await stripe.redirectToCheckout({
            sessionId: sessionId
        });

        if (result.error) {
            throw new Error(result.error.message);
        }
    } catch (error) {
        console.error('Checkout error:', error);
        alert('Failed to start checkout. Please try again.');
    }
}

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

// Add click event listeners
upgradeButtons.forEach(button => {
    button.addEventListener('click', handleCheckout);
});

if (logoutButton) {
    logoutButton.addEventListener('click', handleLogout);
} 