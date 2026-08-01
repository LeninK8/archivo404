// ════════════════════════════════════════════════════════════
//  ARCHIVO 404 — CHAT · Configuración de Firebase
// ════════════════════════════════════════════════════════════
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  onAuthStateChanged, signOut, updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc, getDocs, updateDoc, collection,
  query, where, orderBy, onSnapshot, serverTimestamp, addDoc, limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getStorage, ref, uploadBytesResumable, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// ⚠️  REEMPLAZA estos valores con los de TU proyecto Firebase
// (Configuración del proyecto → Tus apps → objeto firebaseConfig)
const firebaseConfig = {
  apiKey:            "AIzaSyBMRggkr4F3hCshprZx8tBU-gtRw6ZEZTE",
  authDomain:        "archivo404.firebaseapp.com",
  projectId:         "archivo404",
  storageBucket:     "archivo404.firebasestorage.app",
  messagingSenderId: "325717064494",
  appId:             "1:325717064494:web:088dc7851a5be86dc5d8bf"
};

const app     = initializeApp(firebaseConfig);
export const auth    = getAuth(app);
export const db      = getFirestore(app);
export const storage = getStorage(app);

export {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged,
  signOut, updateProfile, doc, setDoc, getDoc, getDocs, updateDoc, collection,
  query, where, orderBy, onSnapshot, serverTimestamp, addDoc, limit,
  ref, uploadBytesResumable, getDownloadURL
};

// Firebase Auth exige un correo — lo generamos internamente a partir del apodo
// para que el usuario solo tenga que recordar su APODO + CONTRASEÑA.
export function apodoToEmail(apodo) {
  const clean = apodo.toLowerCase().trim().replace(/[^a-z0-9_.-]/g, "");
  if (!clean) throw new Error("Apodo inválido. Usa letras, números, ., _ o -.");
  return `${clean}@archivo404.chat`;
}

// ID determinístico y único para el chat entre dos usuarios
export function chatIdFor(uidA, uidB) {
  return [uidA, uidB].sort().join("_");
}
