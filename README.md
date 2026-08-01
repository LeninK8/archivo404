# ARCHIVO 404 — CHAT (Firestore + Cloudinary, sin Firebase Storage)

Chat privado estilo WhatsApp: texto, audio, imágenes, videos, respuestas
citadas, estado en línea/última vez, perfiles.

## Arquitectura

- **Cloud Firestore** → usuarios, perfiles, contactos, chats, mensajes,
  respuestas, estado en línea, última conexión. (Gratis, sin tarjeta.)
- **Cloudinary** → TODO el almacenamiento de archivos (fotos de perfil,
  imágenes, videos, audios del chat). Reemplaza por completo a Firebase
  Storage, que desde el 3 de febrero de 2026 exige el plan de pago Blaze.
  Cloudinary tiene un plan gratuito permanente sin necesidad de tarjeta.
- **Login/registro**: verificación propia con hash SHA-256 de la
  contraseña, comparado en Firestore. La sesión se guarda en el
  `localStorage` de cada dispositivo.

Firebase Storage **ya no se usa en absoluto** — no hace falta activarlo
ni pagar nada por él.

## 1. Ya tienes esto configurado

- `js/firebase.js` → tus credenciales del proyecto `archivo404` (solo
  Firestore).
- `js/cloudinary.js` → tu `cloud_name` (`djktyduiu`) y `upload_preset`
  (`archivo404`).

## 2. Lo único que falta activar

### Firestore (si no lo hiciste ya)
Firebase Console → **Firestore Database** → *Crear base de datos* → modo
producción → elige región.

**Reglas** (pestaña Reglas → pega y publica):
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

### Cloudinary — crear el Upload Preset "unsigned"

Esto es indispensable, si no lo creas las subidas van a fallar:

1. Ve a https://console.cloudinary.com/ e inicia sesión (o crea una
   cuenta gratis, no pide tarjeta).
2. Verifica que tu **Cloud Name** sea `djktyduiu` (aparece arriba en el
   dashboard). Si tu cuenta tiene otro Cloud Name, avísame para
   actualizarlo en `js/cloudinary.js`.
3. Ve a ⚙ **Settings** → pestaña **Upload**.
4. Baja hasta **Upload presets** → **Add upload preset**.
5. Configura:
   - **Preset name**: `archivo404` (debe ser exacto)
   - **Signing Mode**: **Unsigned** (muy importante — así el navegador
     puede subir archivos sin exponer tu API Secret)
   - Todo lo demás puedes dejarlo por defecto.
6. **Save**.

Con eso, las subidas desde la app funcionan directo a tu cuenta de
Cloudinary sin usar API Key ni API Secret en el código.

## 3. Publicar (para usarlo desde laptop y celular)

**GitHub Pages (recomendado):**
1. Sube la carpeta completa a un repositorio de GitHub.
2. Settings → Pages → Source: rama `main` / raíz.
3. Tu chat estará en `https://TUUSUARIO.github.io/TUREPOSITORIO/`.
4. Abre ese mismo link en tu laptop y en tu celular.

## 4. Uso

- **Crear cuenta**: nombre completo, apodo único, contraseña (mín. 6
  caracteres), foto opcional.
- **Iniciar sesión**: apodo + contraseña.
- **Contactos**: lista de todos los registrados, punto verde = en línea.
- **Chat**: texto, 📎 foto/video, 🎤 grabar audio.
- **Responder**: pasa el mouse/toca un mensaje → ↩ para citarlo.
- **Perfil**: toca tu avatar (arriba izquierda) para cambiar tu foto, o
  el avatar del contacto en el chat para ver el suyo.

## Esquema de datos (Firestore)

```
users/{apodo}
  ├─ uid, nombre, apodo, apodoLower
  ├─ passHash        (hash SHA-256, nunca texto plano)
  ├─ fotoURL          → URL de Cloudinary
  ├─ createdAt, lastSeen

chats/{uidA_uidB}
  ├─ participants: [uidA, uidB]
  ├─ lastMessage, lastMessageAt
  └─ messages/{msgId}
      ├─ senderId
      ├─ type: "text" | "image" | "video" | "audio"
      ├─ text        (solo si type === "text")
      ├─ mediaUrl    (solo si type !== "text" → URL de Cloudinary)
      ├─ timestamp
      └─ replyTo: { id, senderName, type, preview } | null
```

## Notas técnicas

- `uploadToCloudinary(file, filename?)` en `js/cloudinary.js` es la
  única función que sube archivos — a `https://api.cloudinary.com/v1_1/
  djktyduiu/auto/upload` con el preset unsigned `archivo404`.
- No se usa `API Key` ni `API Secret` de Cloudinary en el cliente.
- El estado "en línea" se calcula por actividad reciente (heartbeat cada
  15s), guardado en Firestore.

