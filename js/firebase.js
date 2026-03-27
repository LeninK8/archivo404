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
const firebaseConfig = {
    apiKey:            "REEMPLAZA_CON_TU_API_KEY",
    authDomain:        "REEMPLAZA.firebaseapp.com",
    projectId:         "REEMPLAZA_CON_TU_PROJECT_ID",
    storageBucket:     "REEMPLAZA.appspot.com",
    messagingSenderId: "REEMPLAZA",
    appId:             "REEMPLAZA"
};
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
