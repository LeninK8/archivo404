# ARCHIVO 404 — CHAT

Chat privado estilo WhatsApp (texto, audio, imágenes, videos, respuestas citadas,
estado en línea/última vez, perfiles) construido sobre Firebase para que
funcione en tiempo real entre tu laptop y tu celular.

## 1. Estructura

```
archivo404-chat/
├── index.html
├── css/style.css
└── js/
    ├── firebase.js   ← AQUÍ VAN TUS CREDENCIALES
    └── app.js
```

## 2. Configurar Firebase (5-10 min)

1. Ve a https://console.firebase.google.com/ → **Agregar proyecto**.
2. **Authentication** → pestaña *Sign-in method* → habilita **Correo electrónico/contraseña**.
3. **Firestore Database** → *Crear base de datos* → modo producción → elige región.
4. **Storage** → *Comenzar* → modo producción → misma región.
5. ⚙ **Configuración del proyecto** → baja a *Tus apps* → `</>` (Web) → registra la app.
6. Copia el objeto `firebaseConfig` que te muestra y pégalo en `js/firebase.js`,
   reemplazando los valores `"REEMPLAZA..."`.

## 3. Reglas de seguridad (IMPORTANTE — protege las cuentas)

A diferencia de reglas abiertas (`allow read, write: if true`), estas exigen que
el usuario haya iniciado sesión, y que solo pueda escribir en su propio perfil
o en chats donde él participa. Así nadie puede leer o modificar la cuenta de otro.

**Firestore → pestaña Reglas:**
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Perfiles de usuario: cualquiera autenticado puede LEER (para la lista de
    // contactos), pero solo el dueño puede escribir el suyo.
    match /users/{uid} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == uid;
    }

    // Chats: solo los dos participantes pueden leer/escribir el chat y sus mensajes.
    match /chats/{chatId} {
      allow read, write: if request.auth != null &&
        request.auth.uid in resource.data.participants;
      allow create: if request.auth != null &&
        request.auth.uid in request.resource.data.participants;

      match /messages/{msgId} {
        allow read: if request.auth != null &&
          request.auth.uid in get(/databases/$(database)/documents/chats/$(chatId)).data.participants;
        allow create: if request.auth != null &&
          request.auth.uid == request.resource.data.senderId &&
          request.auth.uid in get(/databases/$(database)/documents/chats/$(chatId)).data.participants;
      }
    }
  }
}
```

**Storage → pestaña Reglas:**
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Fotos de perfil: cualquiera autenticado puede ver, solo el dueño sube la suya.
    match /users/{uid}/{fileName} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == uid;
    }
    // Archivos de chat: solo usuarios autenticados (validado además por Firestore).
    match /chats/{chatId}/{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## 4. Publicar (para usarlo desde laptop y celular)

**Opción rápida — GitHub Pages:**
1. Sube la carpeta a un repositorio de GitHub.
2. Settings → Pages → Source: rama `main` / raíz.
3. Tu chat estará en `https://TUUSUARIO.github.io/TUREPOSITORIO/`.
4. Abre ese mismo link en tu laptop y en tu celular — cada dispositivo mantiene
   su propia sesión, y los mensajes se sincronizan en tiempo real vía Firebase.

**Opción alterna:** Netlify, Vercel o Firebase Hosting (arrastra la carpeta).

## 5. Uso

- **Crear cuenta**: nombre completo, apodo único, contraseña, foto opcional.
- **Iniciar sesión**: con tu apodo + contraseña (cada cuenta es privada e independiente).
- **Lista de contactos**: todos los usuarios registrados, con punto verde si están
  en línea o "últ. vez hace X" si no.
- **Chat**: texto, 📎 para foto/video, 🎤 para grabar audio (mantén, detén, envía).
- **Responder**: pasa el mouse/toca un mensaje → ↩ para citarlo en tu respuesta.
- **Perfil**: toca tu avatar (arriba a la izquierda) para ver/cambiar tu foto,
  o el avatar del contacto en el chat para ver el suyo.

## Notas

- El estado "en línea" se calcula por actividad reciente (heartbeat cada 15s).
- Los mensajes, fotos, videos y audios se guardan en Firestore + Storage, por lo
  que persisten y se sincronizan entre todos tus dispositivos.
- La capa gratuita (Spark) de Firebase es más que suficiente para uso personal.

