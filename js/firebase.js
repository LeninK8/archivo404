// ═══════════════════════════════════════════════════════
//  ARCHIVO 404 — FIREBASE MODULE
//  ⚠ REEMPLAZA LOS VALORES DE ABAJO CON LOS DE TU PROYECTO
// ═══════════════════════════════════════════════════════

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
    getFirestore, doc, setDoc, getDoc, deleteDoc, collection, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
    getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

// ─── TUS CREDENCIALES AQUÍ ───────────────────────────────
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBMRggkr4F3hCshprZx8tBU-gtRw6ZEZTE",
  authDomain: "archivo404.firebaseapp.com",
  projectId: "archivo404",
  storageBucket: "archivo404.firebasestorage.app",
  messagingSenderId: "325717064494",
  appId: "1:325717064494:web:088dc7851a5be86dc5d8bf"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
// ─────────────────────────────────────────────────────────

const app      = initializeApp(firebaseConfig);
const db       = getFirestore(app);
const storage  = getStorage(app);

// ── FIRESTORE: Guardar metadata ──────────────────────────
export async function fsSave(col, id, data) {
    await setDoc(doc(db, col, id), data);
}

export async function fsGet(col, id) {
    const snap = await getDoc(doc(db, col, id));
    return snap.exists() ? snap.data() : null;
}

export async function fsGetAll(col) {
    const snap = await getDocs(collection(db, col));
    const result = {};
    snap.forEach(d => result[d.id] = d.data());
    return result;
}

export async function fsDelete(col, id) {
    await deleteDoc(doc(db, col, id));
}

// ── STORAGE: Subir archivo con progreso ─────────────────
export function storageUpload(path, file, onProgress) {
    return new Promise((resolve, reject) => {
        const storageRef = ref(storage, path);
        const task = uploadBytesResumable(storageRef, file);
        task.on('state_changed',
            snap => {
                const pct = (snap.bytesTransferred / snap.totalBytes) * 100;
                if (onProgress) onProgress(pct);
            },
            reject,
            async () => {
                const url = await getDownloadURL(task.snapshot.ref);
                resolve(url);
            }
        );
    });
}

// ── STORAGE: Eliminar archivo ────────────────────────────
export async function storageDelete(path) {
    try {
        await deleteObject(ref(storage, path));
    } catch(e) {
        console.warn("storageDelete:", e.message);
    }
}

// ── TEST DE CONEXIÓN ─────────────────────────────────────
export async function testConnection() {
    try {
        await getDoc(doc(db, "_ping", "test"));
        return true;
    } catch(e) {
        return false;
    }
}

export { db, storage };
