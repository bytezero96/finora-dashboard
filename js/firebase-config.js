// =========================================
// FINORA — CONFIGURAÇÃO DO FIREBASE
// =========================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-firestore.js";

// Configuração do aplicativo
const firebaseConfig = {
    apiKey: "AIzaSyDiIEr7fSroWT-aId-hb9hNydSUFzKQfsM",
    authDomain: "finora-76dba.firebaseapp.com",
    projectId: "finora-76dba",
    storageBucket: "finora-76dba.firebasestorage.app",
    messagingSenderId: "272958680407",
    appId: "1:272958680407:web:e189955168957deb922212",
    measurementId: "G-474KWBXZRB"
};

// Inicialização
const app = initializeApp(firebaseConfig);

// Autenticação
const auth = getAuth(app);

// Banco de dados
const db = getFirestore(app);

// Exportação
export { app, auth, db };