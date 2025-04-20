import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, query, where, orderBy, getDocs } from 'firebase/firestore';

const firebaseConfig = {
    // Your Firebase config here
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM Elements
const flashcardsGrid = document.getElementById('flashcardsGrid');
const emptyState = document.getElementById('emptyState');
const searchInput = document.getElementById('searchInput');
const sortSelect = document.getElementById('sortSelect');

// Templates
const flashcardSetTemplate = document.getElementById('flashcardSetTemplate');
const studyModeTemplate = document.getElementById('studyModeTemplate');

// State
let flashcardSets = [];
let currentStudySet = null;
let currentCardIndex = 0;

// Auth State Observer
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // User is signed in
        loadFlashcardSets(user.uid);
        updateUIForAuthenticatedUser(user);
    } else {
        // User is signed out, redirect to home
        window.location.href = '/';
    }
});

// Load Flashcard Sets
async function loadFlashcardSets(userId) {
    try {
        const flashcardsRef = collection(db, 'flashcardSets');
        const q = query(
            flashcardsRef,
            where('userId', '==', userId),
            orderBy('createdAt', 'desc')
        );

        const querySnapshot = await getDocs(q);
        flashcardSets = [];
        
        querySnapshot.forEach((doc) => {
            flashcardSets.push({
                id: doc.id,
                ...doc.data()
            });
        });

        renderFlashcardSets();
    } catch (error) {
        console.error('Error loading flashcard sets:', error);
        showError('Failed to load flashcard sets. Please try again.');
    }
}

// Render Flashcard Sets
function renderFlashcardSets() {
    if (flashcardSets.length === 0) {
        flashcardsGrid.style.display = 'none';
        emptyState.classList.remove('hidden');
        return;
    }

    flashcardsGrid.style.display = 'grid';
    emptyState.classList.add('hidden');
    flashcardsGrid.innerHTML = '';

    flashcardSets.forEach(set => {
        const setElement = flashcardSetTemplate.content.cloneNode(true);
        
        setElement.querySelector('.set-title').textContent = set.title;
        setElement.querySelector('.card-count').textContent = `${set.cards.length} cards`;
        setElement.querySelector('.set-description').textContent = set.description;
        setElement.querySelector('.created-date').textContent = formatDate(set.createdAt);

        // Add event listeners
        const studyButton = setElement.querySelector('[title="Study"]');
        const editButton = setElement.querySelector('[title="Edit"]');
        const deleteButton = setElement.querySelector('[title="Delete"]');

        studyButton.addEventListener('click', () => startStudyMode(set));
        editButton.addEventListener('click', () => editFlashcardSet(set));
        deleteButton.addEventListener('click', () => deleteFlashcardSet(set));

        flashcardsGrid.appendChild(setElement);
    });
}

// Study Mode
function startStudyMode(set) {
    currentStudySet = set;
    currentCardIndex = 0;

    const modal = studyModeTemplate.content.cloneNode(true);
    document.body.appendChild(modal);

    const studyMode = document.querySelector('.study-mode');
    const flashcard = studyMode.querySelector('.flashcard');
    const prevButton = studyMode.querySelector('#prevCard');
    const nextButton = studyMode.querySelector('#nextCard');
    const flipButton = studyMode.querySelector('#flipCard');
    const closeButton = studyMode.querySelector('.modal-close');
    const progressFill = studyMode.querySelector('.progress-fill');
    const progressText = studyMode.querySelector('.progress-text');

    // Update card content
    updateCardContent();
    updateProgress();

    // Event listeners
    flashcard.addEventListener('click', () => flipCard(flashcard));
    flipButton.addEventListener('click', () => flipCard(flashcard));
    prevButton.addEventListener('click', () => navigateCards(-1, flashcard));
    nextButton.addEventListener('click', () => navigateCards(1, flashcard));
    closeButton.addEventListener('click', () => studyMode.remove());
}

function updateCardContent() {
    const card = currentStudySet.cards[currentCardIndex];
    const studyMode = document.querySelector('.study-mode');
    const front = studyMode.querySelector('.flashcard-front');
    const back = studyMode.querySelector('.flashcard-back');
    const prevButton = studyMode.querySelector('#prevCard');
    const nextButton = studyMode.querySelector('#nextCard');

    front.textContent = card.front;
    back.textContent = card.back;

    // Update navigation buttons
    prevButton.disabled = currentCardIndex === 0;
    nextButton.disabled = currentCardIndex === currentStudySet.cards.length - 1;
}

function updateProgress() {
    const studyMode = document.querySelector('.study-mode');
    const progressFill = studyMode.querySelector('.progress-fill');
    const progressText = studyMode.querySelector('.progress-text');
    const progress = ((currentCardIndex + 1) / currentStudySet.cards.length) * 100;

    progressFill.style.width = `${progress}%`;
    progressText.textContent = `Card ${currentCardIndex + 1} of ${currentStudySet.cards.length}`;
}

function flipCard(flashcard) {
    flashcard.classList.toggle('flipped');
}

function navigateCards(direction, flashcard) {
    const newIndex = currentCardIndex + direction;
    if (newIndex >= 0 && newIndex < currentStudySet.cards.length) {
        currentCardIndex = newIndex;
        flashcard.classList.remove('flipped');
        updateCardContent();
        updateProgress();
    }
}

// Search and Sort
searchInput.addEventListener('input', filterFlashcardSets);
sortSelect.addEventListener('change', sortFlashcardSets);

function filterFlashcardSets() {
    const searchTerm = searchInput.value.toLowerCase();
    const filteredSets = flashcardSets.filter(set => 
        set.title.toLowerCase().includes(searchTerm) ||
        set.description.toLowerCase().includes(searchTerm)
    );

    renderFilteredSets(filteredSets);
}

function sortFlashcardSets() {
    const sortBy = sortSelect.value;
    const sortedSets = [...flashcardSets];

    switch (sortBy) {
        case 'newest':
            sortedSets.sort((a, b) => b.createdAt - a.createdAt);
            break;
        case 'oldest':
            sortedSets.sort((a, b) => a.createdAt - b.createdAt);
            break;
        case 'alphabetical':
            sortedSets.sort((a, b) => a.title.localeCompare(b.title));
            break;
    }

    renderFilteredSets(sortedSets);
}

function renderFilteredSets(sets) {
    flashcardSets = sets;
    renderFlashcardSets();
}

// Utility Functions
function formatDate(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    
    document.querySelector('.dashboard-header').appendChild(errorDiv);
    
    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
} 