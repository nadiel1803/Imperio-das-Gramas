// firebase.js — inicializa Firebase e exporta apenas o Firestore (db)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

/* Sua configuração — mantenha os valores que você já tinha */
const firebaseConfig = {
  apiKey: "AIzaSyC0g9Kxu-KbfFxGm1wpNR-KurnU_1arpAk",
  authDomain: "imperio-das-gramas.firebaseapp.com",
  projectId: "imperio-das-gramas",
  storageBucket: "imperio-das-gramas.firebasestorage.app",
  messagingSenderId: "750713878247",
  appId: "1:750713878247:web:0c623fa465fef44be35442",
  measurementId: "G-56KTD162TD"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);