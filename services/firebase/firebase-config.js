// services/firebase/firebase-config.js
// Configuración completa de Firebase

console.log('🔧 Iniciando Firebase config...');

const firebaseConfig = {
    apiKey: "AIzaSyCYQOZzxIJZ6CPRtoJSJTpJdzyfKQBvAtI",
    authDomain: "formularios-biblicos.firebaseapp.com",
    projectId: "formularios-biblicos",
    storageBucket: "formularios-biblicos.firebasestorage.app",
    messagingSenderId: "1026544180674",
    appId: "1:1026544180674:web:ebae954649b80989e70a5b",
    measurementId: "G-4BPHW9GS96"
};

let firebaseReady = false;
let authReady = false;

function initFirebase() {
    if (typeof firebase !== 'undefined') {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
            console.log('✅ Firebase inicializado');
        }

        window.auth = firebase.auth();
        window.db = firebase.firestore();
        firebaseReady = true;

        // Persistencia LOCAL
        window.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
            .then(() => {
                authReady = true;
                console.log('✅ Auth persistence: LOCAL');
            })
            .catch((err) => {
                authReady = true;
                console.error('❌ Error configurando persistence:', err);
            });

        return true;
    }

    console.warn('⏳ Firebase no cargado aún');
    return false;
}

// Intentar inicializar
if (!initFirebase()) {
    window.addEventListener('load', initFirebase);
}

// ==========================================
// FUNCIONES DE AUTENTICACIÓN
// ==========================================

async function loginWithEmail(email, password) {
    if (!window.auth) throw new Error('Firebase Auth no disponible');
    const result = await window.auth.signInWithEmailAndPassword(email, password);
    return result.user;
}

async function logoutUser() {
    if (!window.auth) throw new Error('Firebase Auth no disponible');
    await window.auth.signOut();
}

function getCurrentUser() {
    if (!window.auth) return null;
    return window.auth.currentUser;
}

function isAdminUser(user) {
    if (!user || !user.email) return false;
    return user.email === 'admin@personalhub.com';
}

function requireAuth() {
    return new Promise((resolve, reject) => {
        if (!window.auth) {
            reject(new Error('Firebase Auth no está disponible'));
            return;
        }

        const unsubscribe = window.auth.onAuthStateChanged(user => {
            unsubscribe();
            if (user) resolve(user);
            else reject(new Error('No autenticado'));
        });
    });
}

async function waitForFirebase() {
    return new Promise((resolve) => {
        if (firebaseReady && window.db) {
            resolve(true);
            return;
        }

        const checkInterval = setInterval(() => {
            if (firebaseReady && window.db) {
                clearInterval(checkInterval);
                resolve(true);
            }
        }, 100);

        setTimeout(() => {
            clearInterval(checkInterval);
            resolve(false);
        }, 5000);
    });
}

// Exportar globalmente
if (typeof window !== 'undefined') {
    window.requireAuth = requireAuth;
    window.waitForFirebase = waitForFirebase;
    window.firebaseReady = () => firebaseReady;
    window.loginWithEmail = loginWithEmail;
    window.logoutUser = logoutUser;
    window.getCurrentUser = getCurrentUser;
    window.isAdminUser = isAdminUser;
}

// ==========================================
// AUTO-CREACIÓN DE PERFIL
// ==========================================
function setupProfileTrigger() {
    if (typeof window.auth === 'undefined' || !window.auth) {
        setTimeout(setupProfileTrigger, 300);
        return;
    }

    window.auth.onAuthStateChanged(function(user) {
        if (user && typeof ProfileSystem !== 'undefined') {
            ProfileSystem.ensureProfile(user);
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupProfileTrigger);
} else {
    setTimeout(setupProfileTrigger, 500);
}

console.log('📁 firebase-config.js cargado');