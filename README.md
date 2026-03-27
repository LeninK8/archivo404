# ARCHIVO 404 — Setup Guide

## Estructura del proyecto
```
archivo404/
├── index.html
├── css/
│   ├── style.css
│   └── animations.css
└── js/
    ├── app.js
    └── firebase.js   ← AQUÍ VAN TUS CREDENCIALES
```

---

## Paso 1 — Crear tu proyecto Firebase

1. Ve a **https://console.firebase.google.com/**
2. Click en **"Agregar proyecto"** → ponle un nombre → continuar
3. Desactiva Google Analytics si no lo necesitas → crear proyecto

### Activar Firestore
4. En el menú izquierdo → **Firestore Database** → "Crear base de datos"
5. Elige **modo de producción** → selecciona tu región → listo

### Activar Storage
6. En el menú izquierdo → **Storage** → "Comenzar"
7. Modo producción → elige región → listo

### Obtener credenciales
8. Click en el ícono ⚙ (rueda) → **Configuración del proyecto**
9. Baja hasta "Tus apps" → click en **`</>`** (Web)
10. Registra la app con cualquier nombre
11. Copia el objeto `firebaseConfig` que aparece

---

## Paso 2 — Pegar credenciales en el código

Abre **`js/firebase.js`** y reemplaza esta sección:

```javascript
const firebaseConfig = {
    apiKey:            "REEMPLAZA_CON_TU_API_KEY",
    authDomain:        "REEMPLAZA.firebaseapp.com",
    projectId:         "REEMPLAZA_CON_TU_PROJECT_ID",
    storageBucket:     "REEMPLAZA.appspot.com",
    messagingSenderId: "REEMPLAZA",
    appId:             "REEMPLAZA"
};
```

con los valores reales que copiaste.

---

## Paso 3 — Configurar reglas de Firebase (IMPORTANTE)

### Firestore rules
En Firebase Console → Firestore → pestaña **Reglas** → pega esto:
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
*(Esto es para uso personal. Si quieres más seguridad, agrega autenticación.)*

### Storage rules
En Firebase Console → Storage → pestaña **Reglas** → pega esto:
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if true;
    }
  }
}
```

---

## Paso 4 — Subir a GitHub y activar GitHub Pages

1. Sube todos los archivos a tu repositorio
2. En GitHub → Settings → Pages → Source: **main branch / root**
3. Tu app estará en: `https://TUUSUARIO.github.io/TUREPOSITORIO/`

---

## Comandos disponibles en la terminal
| Comando    | Acción |
|------------|--------|
| `creador`  | Abre el panel de administración |
| `boveda`   | Archivos de texto |
| `galeria`  | Imágenes y videos |
| `audio`    | Reproductor de música |
| `notas`    | Bitácora personal |
| `objetivos`| Lista de objetivos |
| `hora`     | Hora actual |
| `fecha`    | Fecha actual |
| `version`  | Versión del sistema |
| `sys`      | Estado del sistema |
| `clear`    | Limpiar terminal |
| `centinela`| Activar/desactivar bloqueo por inactividad |
| `error`    | Protocolo de pánico |
| `ayuda`    | Lista completa |

---

## Clave de cifrado
La clave para acceder a archivos encriptados es: **404**
