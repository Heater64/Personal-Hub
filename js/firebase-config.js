// js/firebase-config.js
// Configuración completa de Firebase (Auth, Firestore, Storage)

const firebaseConfig = {
  apiKey: "AIzaSyCYQOZzxIJZ6CPRtoJSJTpJdzyfKQBvAtI",
  authDomain: "formularios-biblicos.firebaseapp.com",
  projectId: "formularios-biblicos",
  storageBucket: "formularios-biblicos.firebasestorage.app",
  messagingSenderId: "1026544180674",
  appId: "1:1026544180674:web:ebae954649b80989e70a5b",
  measurementId: "G-4BPHW9GS96"
};

// Inicializar Firebase solo una vez
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Servicios de Firebase
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Proveedores de autenticación
const googleProvider = new firebase.auth.GoogleAuthProvider();

// Configurar Firestore para usar timestamps
db.settings({ timestampsInSnapshots: true });

// Exportar para usar en toda la app
window.auth = auth;
window.db = db;
window.storage = storage;
window.googleProvider = googleProvider;

// Helper para verificar autenticación
function requireAuth() {
    return new Promise((resolve, reject) => {
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