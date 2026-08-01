// ════════════════════════════════════════════════════════════
//  ARCHIVO 404 — CHAT · Cloudinary (almacenamiento de archivos)
//  Sustituye por completo a Firebase Storage. Usa un Upload
//  Preset "unsigned" — no se necesita API Key ni API Secret
//  en el cliente.
// ════════════════════════════════════════════════════════════
const CLOUDINARY_CLOUD_NAME    = "djktyduiu";
const CLOUDINARY_UPLOAD_PRESET = "archivo404";
const CLOUDINARY_UPLOAD_URL    = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`;

/**
 * Sube un archivo (File o Blob) a Cloudinary y devuelve su secure_url.
 * @param {File|Blob} file - archivo a subir
 * @param {string} [filename] - nombre a usar si `file` es un Blob sin nombre (ej. audios grabados)
 * @returns {Promise<string>} secure_url del archivo subido
 */
export async function uploadToCloudinary(file, filename) {
  const formData = new FormData();
  if (filename) formData.append("file", file, filename);
  else formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

  const res = await fetch(CLOUDINARY_UPLOAD_URL, { method: "POST", body: formData });
  if (!res.ok) {
    let msg = `Error de Cloudinary (${res.status})`;
    try { const err = await res.json(); if (err?.error?.message) msg = err.error.message; } catch (e) {}
    throw new Error(msg);
  }
  const data = await res.json();
  return data.secure_url;
}

