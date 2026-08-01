// ════════════════════════════════════════════════════════════
//  ARCHIVO 404 — CHAT · Configuración de Firebase
//  Solo usa Cloud Firestore. El almacenamiento de archivos
//  multimedia se maneja aparte, en js/cloudinary.js.
//  La verificación de apodo y contraseña se hace con código
//  propio (hash SHA-256), sin usar el módulo de Authentication.
// ════════════════════════════════════════════════════════════
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, doc, setDoc, getDoc, getDocs, updateDoc, collection,
  query, where, orderBy, onSnapshot, serverTimestamp, addDoc, limit
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyBMRggkr4F3hCshprZx8tBU-gtRw6ZEZTE",
  authDomain:        "archivo404.firebaseapp.com",
  projectId:         "archivo404",
  storageBucket:     "archivo404.firebasestorage.app",
  messagingSenderId: "325717064494",
  appId:             "1:325717064494:web:088dc7851a5be86dc5d8bf"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

export {
  doc, setDoc, getDoc, getDocs, updateDoc, collection,
  query, where, orderBy, onSnapshot, serverTimestamp, addDoc, limit
};

// Convierte apodo en un ID de documento limpio y único
export function apodoToUid(apodo) {
  const clean = apodo.toLowerCase().trim().replace(/[^a-z0-9_.-]/g, "");
  if (!clean) throw new Error("Apodo inválido. Usa letras, números, ., _ o -.");
  return clean;
}

// ID determinístico y único para el chat entre dos usuarios
export function chatIdFor(uidA, uidB) {
  return [uidA, uidB].sort().join("_");
}

// Hash SHA-256 de la contraseña (no se guarda en texto plano)
export async function hashPassword(pass) {
  const enc = new TextEncoder().encode(pass);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}
