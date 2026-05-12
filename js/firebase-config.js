// js/firebase-config.js
// Configuración completa de Firebase (Auth, Firestore, Storage)

// Importar Firebase de forma correcta (necesitas agregar los scripts en HTML)
// En tu HTML debes tener:
// <script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js"></script>
// <script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js"></script>
// <script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore-compat.js"></script>
// <script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-storage-compat.js"></script>

const firebaseConfig = {
    apiKey: "AIzaSyCYQOZzxIJZ6CPRtoJSJTpJdzyfKQBvAtI",
    authDomain: "formularios-biblicos.firebaseapp.com",
    projectId: "formularios-biblicos",
    storageBucket: "formularios-biblicos.firebasestorage.app",
    messagingSenderId: "1026544180674",
    appId: "1:1026544180674:web:ebae954649b80989e70a5b",
    measurementId: "G-4BPHW9GS96"
};

// Inicializar Firebase solo si no existe
if (typeof firebase !== 'undefined' && !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
} else if (typeof firebase === 'undefined') {
    console.error('Firebase no está cargado. Revisa los scripts en HTML.');
}

// Servicios de Firebase (con verificación de existencia)
const auth = typeof firebase !== 'undefined' && firebase.auth ? firebase.auth() : null;
const db = typeof firebase !== 'undefined' && firebase.firestore ? firebase.firestore() : null;
const storage = typeof firebase !== 'undefined' && firebase.storage ? firebase.storage() : null;

// Proveedores de autenticación
const googleProvider = auth ? new firebase.auth.GoogleAuthProvider() : null;

// Configurar Firestore para usar timestamps (opcional, ya es default)
if (db) {
    // Esta línea ya no es necesaria en versiones nuevas, pero no da error
    // db.settings({ timestampsInSnapshots: true });
}

// Exportar para usar en toda la app
if (typeof window !== 'undefined') {
    window.auth = auth;
    window.db = db;
    window.storage = storage;
    window.googleProvider = googleProvider;
}

// Helper para verificar autenticación (versión corregida)
function requireAuth() {
    return new Promise((resolve, reject) => {
        if (!auth) {
            reject(new Error('Firebase Auth no está disponible'));
            return;
        }
        
        const unsubscribe = auth.onAuthStateChanged(user => {
            unsubscribe();
            if (user) {
                resolve(user);
            } else {
                reject(new Error('No autenticado'));
            }
        });
    });
}

// Exportar función al window también
if (typeof window !== 'undefined') {
    window.requireAuth = requireAuth;
}