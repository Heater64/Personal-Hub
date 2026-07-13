// js/firebase-config.js
// Configuración completa de Firebase (Auth, Firestore, Storage)
// Con sesión persistente y soporte para Email + Google

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

// Variable global para saber si Firebase está listo
let firebaseReady = false;
let authReady = false;

// Función para inicializar Firebase
function initFirebase() {
    if (typeof firebase !== 'undefined') {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
            console.log('✅ Firebase inicializado desde script externo');
        }

        window.auth = firebase.auth();
        window.db = firebase.firestore();

        firebaseReady = true;

        // ==========================================
        // PERSISTENCIA DE SESIÓN: LOCAL (sobrevive al cerrar navegador)
        // ==========================================
        window.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
            .then(() => {
                authReady = true;
                console.log('✅ Auth persistence: LOCAL (sesión persistente)');
            })
            .catch((err) => {
                authReady = true;
                console.error('❌ Error configurando persistence:', err);
            });

        console.log('✅ Servicios de Firebase disponibles');
        return true;
    }

    console.warn('⏳ Firebase no cargado aún, esperando...');
    return false;
}

// Intentar inicializar inmediatamente
if (!initFirebase()) {
    window.addEventListener('load', function () {
        initFirebase();
    });
}

// ==========================================
// FUNCIONES DE AUTENTICACIÓN
// ==========================================

/** Iniciar sesión con email y contraseña */
async function loginWithEmail(email, password) {
    if (!window.auth) throw new Error('Firebase Auth no disponible');
    const result = await window.auth.signInWithEmailAndPassword(email, password);
    return result.user;
}

/** Cerrar sesión */
async function logoutUser() {
    if (!window.auth) throw new Error('Firebase Auth no disponible');
    await window.auth.signOut();
}

/** Obtener usuario actual (síncrono) */
function getCurrentUser() {
    if (!window.auth) return null;
    return window.auth.currentUser;
}

/** Verificar si el usuario actual es admin */
function isAdminUser(user) {
    if (!user || !user.email) return false;
    return user.email === 'admin@personalhub.com';
}

/** Helper para autenticación */
function requireAuth() {
    return new Promise((resolve, reject) => {
        if (!window.auth) {
            reject(new Error('Firebase Auth no está disponible'));
            return;
        }

        const unsubscribe = window.auth.onAuthStateChanged(user => {
            unsubscribe();
            if (user) {
                resolve(user);
            } else {
                reject(new Error('No autenticado'));
            }
        });
    });
}

/** Esperar a que Firebase esté listo */
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

/** Esperar a que Auth esté listo con persistencia */
async function waitForAuth() {
    if (authReady && window.auth) return true;
    return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
            if (authReady && window.auth) {
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

// Exportar funciones globales
if (typeof window !== 'undefined') {
    window.requireAuth = requireAuth;
    window.waitForFirebase = waitForFirebase;
    window.waitForAuth = waitForAuth;
    window.firebaseReady = () => firebaseReady;
    window.loginWithEmail = loginWithEmail;
    window.logoutUser = logoutUser;
    window.getCurrentUser = getCurrentUser;
    window.isAdminUser = isAdminUser;
}

// ==========================================
// AUTO-CREACIÓN DE PERFIL AL INICIAR SESIÓN
// ==========================================
function setupProfileTrigger() {
    if (typeof window.auth === 'undefined' || !window.auth) {
        setTimeout(setupProfileTrigger, 300);
        return;
    }

    window.auth.onAuthStateChanged(function (user) {
        if (user && typeof ProfileSystem !== 'undefined') {
            ProfileSystem.ensureProfile(user);
        }
    });
}

// Iniciar después de que el DOM cargue
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupProfileTrigger);
} else {
    setTimeout(setupProfileTrigger, 500);
}

console.log('📁 firebase-config.js cargado');
