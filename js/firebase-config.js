const firebaseConfig = {
  apiKey: "AIzaSyCYQOZzxIJZ6CPRtoJSJTpJdzyfKQBvAtI",
  authDomain: "formularios-biblicos.firebaseapp.com",
  projectId: "formularios-biblicos",
  storageBucket: "formularios-biblicos.firebasestorage.app",
  messagingSenderId: "1026544180674",
  appId: "1:1026544180674:web:ebae954649b80989e70a5b",
  measurementId: "G-4BPHW9GS96"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const db = firebase.firestore();
window.db = db;
