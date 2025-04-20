// Firebase configuration
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
    // Your Firebase config here
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM Elements
const loginBtn = document.getElementById('loginBtn');
const signupBtn = document.getElementById('signupBtn');
const userSection = document.getElementById('userSection');

// Auth State Observer
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // User is signed in
        updateUIForAuthenticatedUser(user);
        checkSubscriptionStatus(user.uid);
    } else {
        // User is signed out
        updateUIForUnauthenticatedUser();
    }
});

// UI Updates
function updateUIForAuthenticatedUser(user) {
    userSection.innerHTML = `
        <div class="user-dropdown">
            <button class="btn btn-outline dropdown-toggle">
                <i class="fas fa-user"></i>
                ${user.email}
            </button>
            <div class="dropdown-menu">
                <a href="/dashboard" class="dropdown-item">Dashboard</a>
                <a href="/settings" class="dropdown-item">Settings</a>
                <button id="logoutBtn" class="dropdown-item">Log out</button>
            </div>
        </div>
    `;

    // Add logout functionality
    document.getElementById('logoutBtn').addEventListener('click', () => {
        signOut(auth).catch(error => {
            console.error('Error signing out:', error);
        });
    });
}

function updateUIForUnauthenticatedUser() {
    userSection.innerHTML = `
        <button id="loginBtn" class="btn btn-outline">Log In</button>
        <button id="signupBtn" class="btn btn-primary">Sign Up</button>
    `;
    attachAuthListeners();
}

// Auth Event Listeners
function attachAuthListeners() {
    const loginBtn = document.getElementById('loginBtn');
    const signupBtn = document.getElementById('signupBtn');

    loginBtn?.addEventListener('click', showLoginModal);
    signupBtn?.addEventListener('click', showSignupModal);
}

// Modal Management
function showLoginModal() {
    const modal = createModal('Login', `
        <form id="loginForm" class="auth-form">
            <div class="form-group">
                <label for="loginEmail">Email</label>
                <input type="email" id="loginEmail" required>
            </div>
            <div class="form-group">
                <label for="loginPassword">Password</label>
                <input type="password" id="loginPassword" required>
            </div>
            <button type="submit" class="btn btn-primary btn-full">Log In</button>
        </form>
    `);

    document.body.appendChild(modal);

    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        try {
            await signInWithEmailAndPassword(auth, email, password);
            modal.remove();
        } catch (error) {
            showError(modal, error.message);
        }
    });
}

function showSignupModal() {
    const modal = createModal('Sign Up', `
        <form id="signupForm" class="auth-form">
            <div class="form-group">
                <label for="signupEmail">Email</label>
                <input type="email" id="signupEmail" required>
            </div>
            <div class="form-group">
                <label for="signupPassword">Password</label>
                <input type="password" id="signupPassword" required>
            </div>
            <button type="submit" class="btn btn-primary btn-full">Sign Up</button>
        </form>
    `);

    document.body.appendChild(modal);

    document.getElementById('signupForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('signupEmail').value;
        const password = document.getElementById('signupPassword').value;

        try {
            await createUserWithEmailAndPassword(auth, email, password);
            modal.remove();
        } catch (error) {
            showError(modal, error.message);
        }
    });
}

function createModal(title, content) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>${title}</h2>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                ${content}
            </div>
        </div>
    `;

    modal.querySelector('.modal-close').addEventListener('click', () => {
        modal.remove();
    });

    return modal;
}

function showError(modal, message) {
    const errorDiv = modal.querySelector('.error-message') || document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    
    const form = modal.querySelector('form');
    form.insertBefore(errorDiv, form.firstChild);
}

// Subscription Management
async function checkSubscriptionStatus(userId) {
    try {
        const docRef = doc(db, 'subscriptions', userId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists() && docSnap.data().status === 'active') {
            // User has active subscription
            document.body.classList.add('premium-subscribed');
        } else {
            // User doesn't have active subscription
            document.body.classList.remove('premium-subscribed');
        }
    } catch (error) {
        console.error('Error checking subscription:', error);
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    attachAuthListeners();
    
    // Handle subscription button clicks
    document.querySelectorAll('.premium-button').forEach(button => {
        button.addEventListener('click', async () => {
            if (!auth.currentUser) {
                showLoginModal();
                return;
            }
            
            try {
                const response = await fetch('/api/create-checkout-session', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        userId: auth.currentUser.uid
                    })
                });
                
                const data = await response.json();
                
                if (data.error) {
                    throw new Error(data.error);
                }
                
                // Redirect to Stripe Checkout
                window.location.href = data.url;
            } catch (error) {
                console.error('Error creating checkout session:', error);
                alert('Failed to start checkout process. Please try again.');
            }
        });
    });
}); 