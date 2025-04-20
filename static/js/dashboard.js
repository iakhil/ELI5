// Import Firebase services
import { auth, db } from './firebase-config.js';
import { signOut } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { doc, getDoc, collection, getDocs, query, orderBy, limit } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// DOM Elements
const userEmailElement = document.getElementById('userEmail');
const logoutButton = document.getElementById('logoutButton');
const subscriptionBadge = document.getElementById('subscriptionBadge');
const currentPlanElement = document.getElementById('currentPlan');
const subscriptionStatusElement = document.getElementById('subscriptionStatus');
const nextBillingElement = document.getElementById('nextBilling');
const upgradeButton = document.getElementById('upgradeButton');
const manageSubscriptionButton = document.getElementById('manageSubscriptionButton');
const totalExplanationsElement = document.getElementById('totalExplanations');
const totalFlashcardsElement = document.getElementById('totalFlashcards');
const recentActivityElement = document.getElementById('recentActivity');

// Auth State Observer
auth.onAuthStateChanged(async (user) => {
    if (user) {
        // User is signed in
        console.log('User is signed in:', user.email);
        userEmailElement.textContent = user.email;
        logoutButton.style.display = 'block';
        
        try {
            // Get ID token for API calls
            const idToken = await user.getIdToken();

            // Check subscription status from API first (most accurate)
            const subscriptionStatus = await checkSubscriptionStatus(idToken);
            console.log('Subscription status from API:', subscriptionStatus);
            
            // Also check Firestore directly for comparison/debugging
            const firestoreStatus = await checkFirestoreSubscription(user);
            console.log('Subscription status from Firestore:', firestoreStatus);
            
            // If there's a mismatch, log it
            if (subscriptionStatus.isPremium !== firestoreStatus.isPremium) {
                console.warn('⚠️ SUBSCRIPTION STATUS MISMATCH ⚠️');
                console.warn('API says:', subscriptionStatus.isPremium ? 'Premium' : 'Free');
                console.warn('Firestore says:', firestoreStatus.isPremium ? 'Premium' : 'Free');
            }
            
            // Load user data from Firestore (for activity and stats)
            await loadUserData(user.uid);
        } catch (error) {
            console.error('Error initializing dashboard:', error);
        }
    } else {
        // User is signed out
        console.log('User is signed out, redirecting to login');
        window.location.href = '/login';
    }
});

// Check Subscription Status from API
async function checkSubscriptionStatus(idToken) {
    try {
        // Check for local storage override (temporary fix for Firebase issues)
        const premiumOverride = localStorage.getItem('eli5_premium_override') === 'true';
        const overrideTimestamp = localStorage.getItem('eli5_premium_timestamp');
        const overrideActive = premiumOverride && overrideTimestamp && 
                              (Date.now() - parseInt(overrideTimestamp) < 30 * 24 * 60 * 60 * 1000); // 30 days
        
        if (overrideActive) {
            console.log('Using local premium override - Firebase issues workaround');
            const premiumData = {
                isPremium: true,
                subscription: {
                    status: 'active',
                    plan: 'premium',
                    currentPeriodEnd: Math.floor(Date.now()/1000) + 30 * 24 * 60 * 60
                }
            };
            
            // Update UI with premium status
            updateSubscriptionStatus(premiumData.subscription, premiumData.isPremium);
            return premiumData;
        }
        
        // Continue with API check if override not active
        // Get test mode from the page config - don't force test_premium
        const isTestMode = window.appConfig && window.appConfig.testMode;
        const apiUrl = `/api/user/subscription`;
        
        console.log(`Checking subscription status with API URL: ${apiUrl}`);
        
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${idToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('API subscription data:', data);
        
        // Update UI with subscription status
        updateSubscriptionStatus(data.subscription, data.isPremium);
        
        return data;
    } catch (error) {
        console.error('Error checking subscription status:', error);
        
        // Check for local storage override as fallback
        const premiumOverride = localStorage.getItem('eli5_premium_override') === 'true';
        if (premiumOverride) {
            console.log('Using local premium override as fallback');
            const premiumData = {
                isPremium: true,
                subscription: {
                    status: 'active',
                    plan: 'premium',
                    currentPeriodEnd: Math.floor(Date.now()/1000) + 30 * 24 * 60 * 60
                }
            };
            
            // Update UI with premium status
            updateSubscriptionStatus(premiumData.subscription, premiumData.isPremium);
            return premiumData;
        }
        
        return { isPremium: false };
    }
}

// Direct Firestore subscription check (for comparison/debugging)
async function checkFirestoreSubscription(user) {
    try {
        console.log(`Loading user data for: ${user.uid}`);
        
        // Get user doc from Firestore
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        
        if (!userDoc.exists()) {
            console.log('No user document found in Firestore');
            return { isPremium: false };
        }
        
        const userData = userDoc.data();
        console.log('Firestore user data:', userData);
        
        // Check subscription status
        const subscription = userData.subscription || {};
        const isPremium = subscription.status === 'active';
        
        console.log(`Firestore subscription status: ${subscription.status}, isPremium: ${isPremium}`);
        
        return { 
            isPremium,
            subscription
        };
    } catch (error) {
        console.error('Error fetching Firestore subscription:', error);
        return { isPremium: false };
    }
}

// Load User Data
async function loadUserData(userId) {
    try {
        console.log('Loading user data for:', userId);
        const userDocRef = doc(db, 'users', userId);
        const userDoc = await getDoc(userDocRef);
        
        if (!userDoc.exists()) {
            console.warn('User document not found in Firestore');
            return;
        }
        
        const userData = userDoc.data();
        console.log('User data from Firestore:', userData);

        if (userData) {
            // Update subscription status if API call failed
            if (!subscriptionBadge.classList.contains('premium')) {
                updateSubscriptionStatus(userData.subscription);
            }
            
            // Update usage stats
            updateUsageStats(userData);
            
            // Load recent activity
            await loadRecentActivity(userId);
        }
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

// Update Subscription Status
function updateSubscriptionStatus(subscription = {}, isPremium = false) {
    console.log('Updating subscription UI with:', subscription, 'isPremium:', isPremium);
    
    if ((subscription && subscription.status === 'active') || isPremium) {
        subscriptionBadge.textContent = 'Premium Plan';
        subscriptionBadge.classList.remove('free');
        subscriptionBadge.classList.add('premium');
        
        currentPlanElement.textContent = 'Premium';
        subscriptionStatusElement.textContent = 'Active';
        
        // Format the next billing date if available
        if (subscription && subscription.currentPeriodEnd) {
            const nextBillingDate = new Date(subscription.currentPeriodEnd * 1000);
            nextBillingElement.textContent = nextBillingDate.toLocaleDateString();
        } else {
            nextBillingElement.textContent = 'Processing';
        }
        
        upgradeButton.style.display = 'none';
        manageSubscriptionButton.style.display = 'block';
    } else {
        subscriptionBadge.textContent = 'Free Plan';
        subscriptionBadge.classList.remove('premium');
        subscriptionBadge.classList.add('free');
        
        currentPlanElement.textContent = 'Free';
        subscriptionStatusElement.textContent = 'Active';
        nextBillingElement.textContent = 'N/A';
        
        upgradeButton.style.display = 'block';
        manageSubscriptionButton.style.display = 'none';
    }
}

// Update Usage Stats
function updateUsageStats(userData) {
    try {
        // Display total explanations
        const explanationsGenerated = userData.explanations_generated || 0;
        totalExplanationsElement.textContent = explanationsGenerated;
        
        // Display total flashcards
        const flashcardsGenerated = userData.flashcards_generated || 0;
        totalFlashcardsElement.textContent = flashcardsGenerated;
    } catch (error) {
        console.error('Error updating usage stats:', error);
    }
}

// Load Recent Activity
async function loadRecentActivity(userId) {
    try {
        const activities = [];
        
        // Get recent explanations
        const explanationsRef = collection(db, 'users', userId, 'explanation_history');
        const explanationsQuery = query(explanationsRef, orderBy('timestamp', 'desc'), limit(5));
        const explanationsDocs = await getDocs(explanationsQuery);
        
        explanationsDocs.forEach(doc => {
            const data = doc.data();
            activities.push({
                type: 'explanation',
                timestamp: data.timestamp?.toDate() || new Date(),
                description: `Explained: "${truncateText(data.original_text, 50)}"`
            });
        });
        
        // Get recent flashcards
        const flashcardsRef = collection(db, 'users', userId, 'flashcards');
        const flashcardsQuery = query(flashcardsRef, orderBy('created_at', 'desc'), limit(5));
        const flashcardsDocs = await getDocs(flashcardsQuery);
        
        flashcardsDocs.forEach(doc => {
            const data = doc.data();
            activities.push({
                type: 'flashcard',
                timestamp: data.created_at ? new Date(data.created_at * 1000) : new Date(),
                description: `Created flashcard: "${truncateText(data.front, 50)}"`
            });
        });
        
        // Sort by time (newest first)
        activities.sort((a, b) => b.timestamp - a.timestamp);
        
        // Update UI
        updateRecentActivity(activities.slice(0, 5));
    } catch (error) {
        console.error('Error loading recent activity:', error);
        recentActivityElement.innerHTML = '<p class="empty-state">Error loading activity</p>';
    }
}

// Truncate text helper
function truncateText(text, maxLength) {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

// Update Recent Activity
function updateRecentActivity(activities) {
    if (activities && activities.length > 0) {
        const activityHTML = activities.map(item => `
            <div class="activity-item">
                <i class="fas ${getActivityIcon(item.type)}"></i>
                <div class="activity-content">
                    <p>${item.description}</p>
                    <small>${item.timestamp.toLocaleString()}</small>
                </div>
            </div>
        `).join('');
        
        recentActivityElement.innerHTML = activityHTML;
    } else {
        recentActivityElement.innerHTML = '<p class="empty-state">No recent activity</p>';
    }
}

// Get Activity Icon
function getActivityIcon(type) {
    switch (type) {
        case 'explanation':
            return 'fa-comment-alt';
        case 'flashcard':
            return 'fa-clone';
        default:
            return 'fa-info-circle';
    }
}

// Event Listeners
logoutButton.addEventListener('click', async () => {
    try {
        console.log('Attempting to sign out...');
        await signOut(auth);
        console.log('Sign out successful, redirecting to login');
        window.location.href = '/login';
    } catch (error) {
        console.error('Error signing out:', error);
    }
});

upgradeButton.addEventListener('click', async () => {
    try {
        // Get ID token for auth
        const idToken = await auth.currentUser.getIdToken();
        
        // Create checkout session
        const response = await fetch('/create-checkout-session', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const { id } = await response.json();
        console.log('Created checkout session:', id);
        
        // Redirect to pricing page with session ID
        window.location.href = `/pricing?session_id=${id}`;
    } catch (error) {
        console.error('Error creating checkout session:', error);
        alert('Failed to start checkout process. Please try again.');
    }
});

manageSubscriptionButton.addEventListener('click', async () => {
    try {
        // Get ID token for auth
        const idToken = await auth.currentUser.getIdToken();
        
        const response = await fetch('/create-portal-session', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${idToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const { url } = await response.json();
        window.location.href = url;
    } catch (error) {
        console.error('Error creating portal session:', error);
        alert('Failed to open subscription portal. Please try again.');
    }
}); 