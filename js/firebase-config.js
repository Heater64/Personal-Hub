// js/firebase-config.js
// Configuración completa de Firebase (Auth, Firestore, Storage)

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

// Función para inicializar Firebase
function initFirebase() {
    // Verificar si firebase ya está disponible (cargado por script)
    if (typeof firebase !== 'undefined') {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
            console.log('✅ Firebase inicializado desde script externo');
        }
        
        window.auth = firebase.auth();
        window.db = firebase.firestore();
        
        firebaseReady = true;
        console.log('✅ Servicios de Firebase disponibles');
        return true;
    }
    
    // Si no está disponible, esperar
    console.warn('⏳ Firebase no cargado aún, esperando...');
    return false;
}

// Intentar inicializar inmediatamente
if (!initFirebase()) {
    // Si no está disponible, esperar a que se cargue el script
    window.addEventListener('load', function() {
        setTimeout(function() {
            initFirebase();
        }, 500);
    });
    
    // También intentar cada segundo (por si tarda)
    let attempts = 0;
    const interval = setInterval(function() {
        attempts++;
        if (initFirebase() || attempts > 10) {
            clearInterval(interval);
            if (attempts > 10 && !firebaseReady) {
                console.error('❌ Firebase no se pudo cargar después de 10 intentos');
            }
        }
    }, 1000);
}

// Helper para verificar autenticación
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

// Verificar si Firebase está listo (para usar en async/await)
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

// Exportar funciones globales
if (typeof window !== 'undefined') {
    window.requireAuth = requireAuth;
    window.waitForFirebase = waitForFirebase;
    window.firebaseReady = () => firebaseReady;
}

/** Carga catálogo de regalos desde Firestore (opcional; fallback: gifts.json) */
async function loadGiftsFromFirebase() {
    if (!window.db) return null;
    try {
        const doc = await window.db.collection('config').doc('gifts').get();
        if (doc.exists) return doc.data();
    } catch (err) {
        console.warn('loadGiftsFromFirebase:', err);
    }
    return null;
}

if (typeof window !== 'undefined') {
    window.loadGiftsFromFirebase = loadGiftsFromFirebase;
}


console.log('📁 firebase-config.js cargado');