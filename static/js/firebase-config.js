// Import Firebase modules
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyBe9RJyJZT79mxMk0KFYJTZaQBAvOix4qk",
    authDomain: "eli5-322a1.firebaseapp.com",
    projectId: "eli5-322a1",
    storageBucket: "eli5-322a1.appspot.com",
    messagingSenderId: "982021280682",
    appId: "1:982021280682:web:edfe3ef280b626a3dbd1d3",
    measurementId: "G-HV2VD3RJJB"
};

let app, auth, db;

try {
    // Initialize Firebase
    app = initializeApp(firebaseConfig);
    
    // Initialize Auth with custom domain settings
    auth = getAuth();
    auth.settings = {
        authDomain: window.location.hostname,
        redirectUrl: `${window.location.origin}/dashboard`
    };
    
    // Initialize Firestore
    db = getFirestore();
    
    // Log initialization details
    console.log('Firebase initialization:', {
        hostname: window.location.hostname,
        origin: window.location.origin,
        authDomain: firebaseConfig.authDomain,
        projectId: firebaseConfig.projectId
    });

    // Add auth state observer
    auth.onAuthStateChanged((user) => {
        console.log('Auth state changed:', user ? `User ${user.email} signed in` : 'No user signed in');
    });

} catch (error) {
    console.error('Firebase initialization error:', {
        code: error.code,
        message: error.message,
        stack: error.stack,
        location: window.location.href
    });
    throw error;
}

export { auth, db }; 