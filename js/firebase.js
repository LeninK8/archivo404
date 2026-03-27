// ═══════════════════════════════════════════════════════
//  ARCHIVO 404 — MÓDULO DE ALMACENAMIENTO
//  Firestore  → metadatos (gratis)
//  Cloudinary → archivos reales: fotos, videos, música
// ═══════════════════════════════════════════════════════

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
    getFirestore, doc, setDoc, getDoc, deleteDoc, collection, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ─── CREDENCIALES FIREBASE (solo Firestore, sin Storage) ──
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
// ──────────────────────────────────────────────────────────

// ─── CREDENCIALES CLOUDINARY ──────────────────────────────
const CLOUD_NAME    = "djktyduiu";
const UPLOAD_PRESET = "archivo404";
// ──────────────────────────────────────────────────────────

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// ══════════════════════════════════════════════════════════
//  FIRESTORE — metadatos
// ══════════════════════════════════════════════════════════

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

// ══════════════════════════════════════════════════════════
//  CLOUDINARY — subir archivos con progreso
// ══════════════════════════════════════════════════════════

export function storageUpload(path, file, onProgress) {
    return new Promise((resolve, reject) => {
        let resourceType = "auto";
        if (file.type.startsWith("image/")) resourceType = "image";
        if (file.type.startsWith("video/")) resourceType = "video";
        if (file.type.startsWith("audio/")) resourceType = "video"; // Cloudinary trata audio como video

        const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`;

        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", UPLOAD_PRESET);
        formData.append("public_id", path.replace(/[^a-zA-Z0-9_\-\/]/g, "_"));

        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener("progress", e => {
            if (e.lengthComputable && onProgress) {
                onProgress((e.loaded / e.total) * 100);
            }
        });

        xhr.addEventListener("load", () => {
            if (xhr.status === 200) {
                const res = JSON.parse(xhr.responseText);
                resolve(res.secure_url);
            } else {
                reject(new Error("Cloudinary error: " + xhr.responseText));
            }
        });

        xhr.addEventListener("error", () => reject(new Error("Error de red al subir")));

        xhr.open("POST", url);
        xhr.send(formData);
    });
}

// ══════════════════════════════════════════════════════════
//  CLOUDINARY — eliminar (se hace desde el dashboard)
// ══════════════════════════════════════════════════════════

export async function storageDelete(path) {
    console.info("Elimina archivos desde console.cloudinary.com →", path);
}

// ══════════════════════════════════════════════════════════
//  TEST DE CONEXIÓN
// ══════════════════════════════════════════════════════════

export async function testConnection() {
    try {
        await getDoc(doc(db, "_ping", "test"));
        return true;
    } catch(e) {
        return false;
    }
}

export { db };

export { db, storage };
