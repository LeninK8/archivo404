/* ═══════════════════════════════════════════════════════════
   ARCHIVO 404 — CORE APP v4.0
   Firebase Storage + IndexedDB fallback + Animaciones
   ═══════════════════════════════════════════════════════════ */

"use strict";

const CLAVE = "404";
let fbModule = null;       // Firebase functions (cargadas async)
let idbAvail = true;       // IndexedDB disponible
let tempFiles = {};        // archivos seleccionados por tipo
let zIdx = 1000;
let editing = "";
let vaultShowEnc = false;
let galleryShowEnc = false;
let keyCallback = null;
let sentinelActive = false;
let idleTime = 0;

// ─── METADATA LOCAL (comandos, nombres, flags enc) ──────────
let meta = JSON.parse(localStorage.getItem('404_meta')) || {
    vault: { "manual.txt": { t:"txt", enc:false, content:"Bienvenido Lenin." } },
    imgs:  {},   // { nombre: { enc, url, storagePath } }
    vids:  {},
    auds:  {},
    cmds: {
        "ayuda":    { res: "creador | boveda | galeria | audio | stream | notas | objetivos | clear | error | estado | hora | fecha | version | sys | matrix | hack | ping | quien | musica | purgar | centinela" },
        "estado":   { res: "[OK] TODOS LOS SECTORES EN LÍNEA." },
        "hora":     { res: "__hora__" },
        "fecha":    { res: "__fecha__" },
        "version":  { res: "ARCHIVO 404 v4.0 // FIREBASE EDITION // PROPIETARIO: LENIN" },
        "sys":      { res: "CPU: NOMINAL | STORAGE: FIREBASE ∞ | CIFRADO: AES-404 | RED: ACTIVA" },
        "matrix":   { res: "Wake up, Neo... The Matrix has you." },
        "hack":     { res: "[!!!] INICIANDO INTRUSIÓN... bromas, acceso denegado, operador." },
        "ping":     { res: "PONG — 0ms latencia. Firebase online." },
        "quien":    { res: "Soy Archivo 404. Tu sistema personal cifrado, Lenin." },
        "musica":   { res: "__audio__" },
        "purgar":   { res: "__purgar__" },
        "creditos": { res: "Sistema diseñado para LENIN. Acceso no autorizado activa protocolo de pánico." },
        "clima":    { res: "SENSOR EXTERNO: SIN RESPUESTA. MODO AISLADO ACTIVO." },
        "saludo":   { res: "ACCESO CONCEDIDO. BIENVENIDO DE VUELTA, OPERADOR." }
    }
};

// ─── IndexedDB para archivos grandes (fallback/local cache) ──
let idb;
function openIDB() {
    return new Promise((res, rej) => {
        const req = indexedDB.open("archivo404", 2);
        req.onupgradeneeded = e => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains("files")) db.createObjectStore("files");
        };
        req.onsuccess = e => res(e.target.result);
        req.onerror   = e => rej(e.target.error);
    });
}
async function idbPut(key, blob) {
    if (!idb) return;
    const tx = idb.transaction("files","readwrite");
    tx.objectStore("files").put(blob, key);
    return new Promise((res,rej)=>{ tx.oncomplete=res; tx.onerror=rej; });
}
async function idbGet(key) {
    if (!idb) return null;
    const tx = idb.transaction("files","readonly");
    const req = tx.objectStore("files").get(key);
    return new Promise((res,rej)=>{ req.onsuccess=()=>res(req.result); req.onerror=rej; });
}
async function idbDel(key) {
    if (!idb) return;
    const tx = idb.transaction("files","readwrite");
    tx.objectStore("files").delete(key);
}

// ─── BOOT SEQUENCE ───────────────────────────────────────────
const bootLines = [
    "INICIALIZANDO ARCHIVO_404 v4.0...",
    "CARGANDO MÓDULOS DE SEGURIDAD...",
    "VERIFICANDO CIFRADO AES-404...",
    "CONECTANDO CON FIREBASE...",
    "CARGANDO BASE DE DATOS...",
    "NÚCLEO OPERATIVO.",
];

async function boot() {
    idb = await openIDB().catch(()=>{ idbAvail=false; return null; });

    const bar   = document.getElementById('boot-bar');
    const log   = document.getElementById('boot-log');

    for (let i = 0; i < bootLines.length; i++) {
        const div = document.createElement('div');
        div.style.color = i === bootLines.length-1 ? 'var(--green)' : '#1a1a1a';
        div.textContent = '> ' + bootLines[i];
        log.appendChild(div);
        bar.style.width = ((i+1)/bootLines.length*100) + '%';
        await sleep(220);
    }

    // intentar cargar Firebase
    try {
        fbModule = await import('./firebase.js');
        const online = await fbModule.testConnection();
        setFbStatus(online);
        if (online) await loadFromFirebase();
    } catch(e) {
        setFbStatus(false);
        addBootLine('⚠ FIREBASE NO DISPONIBLE — MODO LOCAL ACTIVO', 'var(--gold)');
    }

    await sleep(300);
    document.getElementById('boot-screen').style.transition = 'opacity 0.5s';
    document.getElementById('boot-screen').style.opacity = '0';
    setTimeout(()=>{ document.getElementById('boot-screen').style.display='none'; }, 500);

    initApp();
}

function addBootLine(text, color='#1a1a1a') {
    const div = document.createElement('div');
    div.style.color = color;
    div.textContent = '> ' + text;
    document.getElementById('boot-log').appendChild(div);
}

function setFbStatus(online) {
    const el = document.getElementById('fb-status');
    if (online) {
        el.textContent = '⬤ FIREBASE ONLINE';
        el.className = 'firebase-badge online';
    } else {
        el.textContent = '⬤ MODO LOCAL';
        el.className = 'firebase-badge offline';
    }
}

async function loadFromFirebase() {
    try {
        const imgs = await fbModule.fsGetAll('imgs');
        const vids = await fbModule.fsGetAll('vids');
        const auds = await fbModule.fsGetAll('auds');
        const vault = await fbModule.fsGetAll('vault');
        const cmds  = await fbModule.fsGetAll('cmds');

        if (Object.keys(imgs).length)  meta.imgs  = { ...imgs,  ...meta.imgs  };
        if (Object.keys(vids).length)  meta.vids  = { ...vids,  ...meta.vids  };
        if (Object.keys(auds).length)  meta.auds  = { ...auds,  ...meta.auds  };
        if (Object.keys(vault).length) meta.vault = { ...vault, ...meta.vault };
        if (Object.keys(cmds).length)  meta.cmds  = { ...cmds,  ...meta.cmds  };

        saveMeta();
        addBootLine('DATOS SINCRONIZADOS CON FIREBASE.', 'var(--green)');
    } catch(e) {
        addBootLine('ERROR AL LEER FIREBASE: ' + e.message, 'var(--accent)');
    }
}

function initApp() {
    document.getElementById('txt-notes').value = localStorage.getItem('404_notes') || '';
    document.getElementById('txt-tasks').value = localStorage.getItem('404_tasks') || '';
    setupInput();
    setupDragAndDrop();
    setupDrag();
    renderVault();
    renderGallery();
    renderAudio();
    startSentinelTimer();
    log("[OK] NÚCLEO OPERATIVO. ESCRIBE 'ayuda' PARA VER COMANDOS.", 'ok');
}

// ─── TERMINAL ────────────────────────────────────────────────
function setupInput() {
    const inp = document.getElementById('main-input');
    inp.addEventListener('keypress', e => {
        if (e.key === 'Enter') {
            execCmd(inp.value.toLowerCase().trim());
            inp.value = '';
        }
    });
}

function execCmd(q) {
    if (!q) return;
    log(`> ${q}`, 'cmd');

    const core = {
        "creador":   () => { openWin('w-creador'); playWelcomeAI(); },
        "boveda":    () => openWin('w-files'),
        "galeria":   () => openGallery(),
        "audio":     () => openWin('w-audio'),
        "stream":    () => openWin('w-stream'),
        "notas":     () => openWin('w-notes'),
        "objetivos": () => openWin('w-tasks'),
        "clear":     () => { document.getElementById('output-stream').innerHTML=''; },
        "centinela": () => toggleSentinel(),
        "error":     () => {
            document.getElementById('panic-layer').style.display='flex';
            setTimeout(()=> window.location.href='vacio.html', 2500);
        }
    };

    if (core[q]) { core[q](); return; }

    if (meta.cmds[q]) {
        let r = meta.cmds[q].res;
        if (r==='__hora__')   { log(`HORA ACTUAL: ${new Date().toLocaleTimeString()}`); return; }
        if (r==='__fecha__')  { log(`FECHA: ${new Date().toLocaleDateString('es-PE',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}`); return; }
        if (r==='__audio__')  { openWin('w-audio'); log('ABRIENDO MÓDULO DE FRECUENCIAS...'); return; }
        if (r==='__purgar__') {
            if (confirm('¿PURGAR TODA LA BASE DE DATOS LOCAL?')) {
                localStorage.clear();
                indexedDB.deleteDatabase('archivo404');
                location.reload();
            }
            return;
        }
        log(r);
        return;
    }
    log("[!] PROTOCOLO NO RECONOCIDO. ESCRIBE 'ayuda'.");
}

function log(msg, type='') {
    const out = document.getElementById('output-stream');
    const el  = document.createElement('div');
    el.className = 'log-entry';
    const ts = new Date().toLocaleTimeString();
    el.innerHTML = `<span class="log-ts">[${ts}]</span><span class="log-msg ${type}">${msg}</span>`;
    out.prepend(el);
}

// ─── AUDIO BIENVENIDA IA ─────────────────────────────────────
function playWelcomeAI() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const speak = window.speechSynthesis;
        if (!speak) return;
        const utt = new SpeechSynthesisUtterance("Bienvenido, creador Lenin.");
        utt.lang = 'es-ES';
        utt.pitch = 0.8;
        utt.rate  = 0.9;
        // Buscar voz femenina
        const voices = speak.getVoices();
        const female = voices.find(v =>
            (v.name.toLowerCase().includes('female') ||
             v.name.toLowerCase().includes('mujer')  ||
             v.name.toLowerCase().includes('helena') ||
             v.name.toLowerCase().includes('lucia')  ||
             v.name.toLowerCase().includes('paulina')||
             v.name.toLowerCase().includes('sabina') ||
             v.name.includes('Google español'))
        );
        if (female) utt.voice = female;
        speak.speak(utt);
    } catch(e) { /* silencioso */ }
}

// Esperar voces a que carguen antes de usar
window.speechSynthesis?.addEventListener('voiceschanged', ()=>{});

// ─── WINDOW MANAGER ──────────────────────────────────────────
function openWin(id) {
    const w = document.getElementById(id);
    w.classList.add('active');
    w.style.display = 'flex';
    bringToFront(w);
}
function closeWin(id) {
    const w = document.getElementById(id);
    w.style.display = 'none';
    w.classList.remove('active');
}
function toggleWinState(id) {
    const w = document.getElementById(id);
    w.style.display === 'flex' ? closeWin(id) : openWin(id);
}
function bringToFront(el) { zIdx++; el.style.zIndex = zIdx; }

function openGallery() {
    renderGallery();
    openWin('w-gallery');
}

// ─── DRAG WINDOWS ────────────────────────────────────────────
function setupDrag() {
    document.querySelectorAll('.win-head').forEach(head => {
        head.addEventListener('mousedown', e => {
            if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
            const win = head.parentElement;
            bringToFront(win);
            const sx = e.clientX - win.getBoundingClientRect().left;
            const sy = e.clientY - win.getBoundingClientRect().top;
            const move = ev => {
                win.style.left = (ev.clientX - sx) + 'px';
                win.style.top  = (ev.clientY - sy) + 'px';
            };
            document.addEventListener('mousemove', move);
            document.addEventListener('mouseup', () => document.removeEventListener('mousemove', move), {once:true});
        });
    });
}

// ─── DRAG & DROP UPLOAD ──────────────────────────────────────
function setupDragAndDrop() {
    ['txt','img','vid','aud'].forEach(type => {
        const zone = document.getElementById('drop-' + type);
        if (!zone) return;
        zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
        zone.addEventListener('dragleave',()=> zone.classList.remove('drag-over'));
        zone.addEventListener('drop', e => {
            e.preventDefault();
            zone.classList.remove('drag-over');
            const file = e.dataTransfer.files[0];
            if (file) {
                const fakeInput = { files:[file] };
                handleUpload(fakeInput, type);
            }
        });
    });
}

// ─── MANEJO DE ARCHIVOS ──────────────────────────────────────
function handleUpload(el, type) {
    const file = el.files[0];
    if (!file) return;
    tempFiles[type] = file;
    const label = document.getElementById(`drop-${type}-name`);
    if (label) label.textContent = `✓ ${file.name} (${formatSize(file.size)})`;
    log(`ARCHIVO LISTO: ${file.name} — ${formatSize(file.size)}`);
}

async function saveFile(type) {
    const nameEl = document.getElementById('up-name-' + type);
    const name   = nameEl.value.trim();
    const file   = tempFiles[type];
    const enc    = document.getElementById('enc-' + type).checked;

    if (!name || !file) return log('ERROR: COMPLETA EL NOMBRE Y SELECCIONA UN ARCHIVO.', 'warn');

    const sector = document.getElementById('sector-' + type);
    const prog   = document.getElementById('prog-'  + type);
    const progBar= document.getElementById('progbar-'+ type);
    sector.classList.add('uploading');
    prog.classList.add('active');
    progBar.style.width = '5%';

    try {
        let url = null;
        let storagePath = null;

        if (fbModule) {
            // ── Subir a Firebase Storage ──
            storagePath = `${type}s/${Date.now()}_${file.name}`;
            url = await fbModule.storageUpload(storagePath, file, pct => {
                progBar.style.width = pct + '%';
            });
            log(`SUBIDO A FIREBASE: ${name} (${formatSize(file.size)})`, 'ok');
        } else {
            // ── Guardar en IndexedDB ──
            await idbPut(`${type}_${name}`, file);
            url = `idb://${type}_${name}`;
            log(`GUARDADO LOCALMENTE: ${name} (${formatSize(file.size)})`, 'warn');
        }

        progBar.style.width = '100%';

        // Metadata
        const record = { enc, url, storagePath, name, size: file.size, ts: Date.now() };

        if (type === 'txt') {
            const text = await file.text();
            meta.vault[name] = { t:'txt', enc, content: text };
            if (fbModule) await fbModule.fsSave('vault', name, meta.vault[name]);
        } else if (type === 'img') {
            meta.imgs[name] = record;
            if (fbModule) await fbModule.fsSave('imgs', name, record);
            renderGallery();
            openWin('w-gallery');
        } else if (type === 'vid') {
            meta.vids[name] = record;
            if (fbModule) await fbModule.fsSave('vids', name, record);
            renderGallery();
            openWin('w-gallery');
        } else if (type === 'aud') {
            meta.auds[name] = record;
            if (fbModule) await fbModule.fsSave('auds', name, record);
            renderAudio();
            openWin('w-audio');
            if (!enc) playAudio(name, record);
        }

        saveMeta();
        renderVault();

        // Reset UI
        setTimeout(()=>{
            sector.classList.remove('uploading');
            prog.classList.remove('active');
            progBar.style.width = '0';
        }, 800);

        nameEl.value = '';
        tempFiles[type] = null;
        document.getElementById('enc-' + type).checked = false;
        document.getElementById(`drop-${type}-name`).textContent = getDropHint(type);

    } catch(e) {
        sector.classList.remove('uploading');
        prog.classList.remove('active');
        log('ERROR AL GUARDAR: ' + e.message, 'warn');
    }
}

function getDropHint(type) {
    const hints = { txt:'Acepta .txt .md .json .csv', img:'Acepta jpg png gif webp', vid:'Acepta mp4 webm mov', aud:'Acepta mp3 wav ogg flac' };
    return hints[type] || '';
}

// ─── BÓVEDA ──────────────────────────────────────────────────
function toggleVaultEncrypted() {
    if (!vaultShowEnc) {
        requireKey(()=>{
            vaultShowEnc = true;
            document.getElementById('vault-enc-btn').classList.add('active');
            document.getElementById('vault-enc-btn').textContent = '🔓 CIFRADOS';
            renderVault();
            log('[OK] ACCESO A SECTORES CIFRADOS CONCEDIDO.', 'ok');
        });
    } else {
        vaultShowEnc = false;
        document.getElementById('vault-enc-btn').classList.remove('active');
        document.getElementById('vault-enc-btn').textContent = '🔒 CIFRADOS';
        renderVault();
    }
}

function renderVault() {
    const grid = document.getElementById('vault-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const filter = (document.getElementById('file-filter')?.value || '').toLowerCase();

    let count = 0;
    Object.keys(meta.vault).forEach(n => {
        const item = meta.vault[n];
        if (item.enc && !vaultShowEnc) return;
        if (!n.toLowerCase().includes(filter)) return;
        count++;
        const c = document.createElement('div');
        c.className = 'card' + (item.enc?' locked':'');
        c.innerHTML = `<span class="card-icon">📄</span><span class="card-label">${n}</span>${item.enc?'<span class="badge-enc">ENC</span>':''}`;
        c.onclick = ()=>{
            editing = n;
            document.getElementById('editor-field').value = item.content || '';
            document.getElementById('edit-filename').textContent = `EDITANDO: ${n}`;
            openWin('w-editor');
        };
        grid.appendChild(c);
    });
    if (count === 0) grid.innerHTML = `<p style="color:#1a1a1a;font-size:0.65rem;padding:10px;">SIN SECTORES VISIBLES</p>`;
}

// ─── GALERÍA ─────────────────────────────────────────────────
function toggleGalleryEncrypted() {
    if (!galleryShowEnc) {
        requireKey(()=>{
            galleryShowEnc = true;
            document.getElementById('gallery-enc-btn').classList.add('active');
            document.getElementById('gallery-enc-btn').textContent = '🔓 CIFRADOS';
            renderGallery();
            log('[OK] ACCESO A GALERÍA CIFRADA CONCEDIDO.', 'ok');
        });
    } else {
        galleryShowEnc = false;
        document.getElementById('gallery-enc-btn').classList.remove('active');
        document.getElementById('gallery-enc-btn').textContent = '🔒 CIFRADOS';
        renderGallery();
    }
}

function renderGallery() {
    renderGallerySection('gallery-photos', meta.imgs, 'img');
    renderGallerySection('gallery-videos', meta.vids, 'vid');
}

function renderGallerySection(gridId, items, type) {
    const grid = document.getElementById(gridId);
    if (!grid) return;
    grid.innerHTML = '';
    const keys = Object.keys(items);

    if (keys.length === 0) {
        grid.innerHTML = `<p class="gallery-empty">SIN ARCHIVOS</p>`;
        return;
    }

    keys.forEach(name => {
        const item = items[name];
        if (item.enc && !galleryShowEnc) return;

        const thumb = document.createElement('div');
        thumb.className = 'gallery-thumb' + (item.enc ? ' enc-thumb' : '');

        // Preview
        if (type === 'img') {
            const img = document.createElement('img');
            img.src = item.url;
            img.alt = name;
            img.loading = 'lazy';
            thumb.appendChild(img);
        } else {
            const vid = document.createElement('video');
            vid.src = item.url;
            vid.muted = true;
            vid.preload = 'metadata';
            vid.addEventListener('loadedmetadata', () => { vid.currentTime = 1; });
            thumb.appendChild(vid);
        }

        // Label
        const lbl = document.createElement('div');
        lbl.className = 'thumb-label';
        lbl.textContent = name + (item.enc ? ' 🔒' : '');
        thumb.appendChild(lbl);

        // Botón eliminar
        const del = document.createElement('div');
        del.className = 'thumb-del';
        del.textContent = '×';
        del.onclick = async (e) => {
            e.stopPropagation();
            delete items[name];
            if (fbModule) await fbModule.fsDelete(type+'s', name).catch(()=>{});
            if (item.storagePath) await fbModule?.storageDelete(item.storagePath).catch(()=>{});
            await idbDel(`${type}_${name}`);
            saveMeta();
            renderGallery();
            log(`"${name}" ELIMINADO.`, 'cmd');
        };
        thumb.appendChild(del);

        // Click para abrir lightbox
        thumb.onclick = () => {
            if (item.enc && !galleryShowEnc) {
                requireKey(() => openLightbox(item, name, type));
            } else {
                openLightbox(item, name, type);
            }
        };

        grid.appendChild(thumb);
    });
}

// ─── LIGHTBOX ────────────────────────────────────────────────
function openLightbox(item, name, type) {
    const lb = document.getElementById('lightbox');
    const media = document.getElementById('lightbox-media');
    document.getElementById('lightbox-name').textContent = name;

    if (type === 'img') {
        media.innerHTML = `<img src="${item.url}" alt="${name}">`;
    } else {
        media.innerHTML = `<video src="${item.url}" controls autoplay></video>`;
    }

    lb.classList.add('active');
}
function closeLightbox() {
    const lb = document.getElementById('lightbox');
    lb.classList.remove('active');
    document.getElementById('lightbox-media').innerHTML = '';
    const vid = document.querySelector('#lightbox-media video');
    if (vid) vid.pause();
}

// ─── AUDIO ───────────────────────────────────────────────────
function renderAudio() {
    const list = document.getElementById('audio-list');
    if (!list) return;
    list.innerHTML = '';
    const keys = Object.keys(meta.auds);

    if (keys.length === 0) {
        list.innerHTML = `<p style="color:#1a1a1a;font-size:0.65rem;text-align:center;padding:20px;">SIN PISTAS REGISTRADAS</p>`;
        return;
    }

    keys.forEach(name => {
        const item = meta.auds[name];
        const row = document.createElement('div');
        row.className = 'audio-row';
        row.setAttribute('data-track', name);

        const lbl = document.createElement('div');
        lbl.className = 'audio-row-label';
        lbl.innerHTML = `🎵 ${name}${item.enc?' <span class="badge-enc">ENC</span>':''}`;
        lbl.onclick = () => {
            if (item.enc) {
                requireKey(()=>{ playAudio(name, item); });
            } else {
                playAudio(name, item);
            }
        };

        const del = document.createElement('div');
        del.className = 'audio-row-del';
        del.textContent = '×';
        del.onclick = async (e) => {
            e.stopPropagation();
            const player = document.getElementById('audio-player');
            if (player.getAttribute('data-playing') === name) {
                player.pause(); player.src='';
                document.getElementById('now-playing').textContent = '— SIN PISTA ACTIVA —';
                player.removeAttribute('data-playing');
            }
            delete meta.auds[name];
            if (fbModule) await fbModule.fsDelete('auds', name).catch(()=>{});
            if (item.storagePath) await fbModule?.storageDelete(item.storagePath).catch(()=>{});
            await idbDel(`aud_${name}`);
            saveMeta();
            renderAudio();
            log(`"${name}" ELIMINADO DE FRECUENCIAS.`, 'cmd');
        };

        row.appendChild(lbl);
        row.appendChild(del);
        list.appendChild(row);
    });
}

async function playAudio(name, item) {
    const player = document.getElementById('audio-player');
    const np     = document.getElementById('now-playing');

    let src = item.url;

    // Si es IDB, recuperar blob
    if (src && src.startsWith('idb://')) {
        const blob = await idbGet(`aud_${name}`);
        if (blob) src = URL.createObjectURL(blob);
        else { log('ERROR: ARCHIVO NO ENCONTRADO EN CACHÉ LOCAL.', 'warn'); return; }
    }

    player.src = src;
    player.load();
    player.play().catch(e => log('ERROR AL REPRODUCIR: ' + e.message, 'warn'));
    player.setAttribute('data-playing', name);

    np.innerHTML = `▶ ${name} <span class="eq-bars"><span class="eq-bar"></span><span class="eq-bar"></span><span class="eq-bar"></span></span>`;

    // Resaltar fila activa
    document.querySelectorAll('.audio-row').forEach(r => {
        r.classList.toggle('playing', r.getAttribute('data-track') === name);
    });

    log(`REPRODUCIENDO: ${name}`, 'ok');
}

// ─── EDITOR ──────────────────────────────────────────────────
function commitFile() {
    if (!editing) return;
    meta.vault[editing].content = document.getElementById('editor-field').value;
    if (fbModule) fbModule.fsSave('vault', editing, meta.vault[editing]).catch(()=>{});
    saveMeta();
    log(`DATOS EN "${editing}" REESCRITOS.`, 'ok');
    closeWin('w-editor');
}

function saveCommand() {
    const n = document.getElementById('cmd-name').value.trim();
    const r = document.getElementById('cmd-res').value.trim();
    if (!n || !r) return;
    meta.cmds[n] = { res: r };
    if (fbModule) fbModule.fsSave('cmds', n, { res: r }).catch(()=>{});
    saveMeta();
    log(`COMANDO '${n}' VINCULADO.`, 'ok');
}

function saveStatic(key) {
    localStorage.setItem('404_'+key, document.getElementById('txt-'+key).value);
    log(`${key.toUpperCase()} GUARDADA.`, 'ok');
    closeWin('w-'+key);
}

// ─── CIFRADO / CLAVE ─────────────────────────────────────────
function requireKey(cb) {
    keyCallback = cb;
    document.getElementById('key-input').value = '';
    document.getElementById('key-error').style.display = 'none';
    document.getElementById('key-modal-overlay').classList.add('active');
    setTimeout(()=> document.getElementById('key-input').focus(), 100);
}
function submitKey() {
    const val = document.getElementById('key-input').value;
    if (val === CLAVE) {
        document.getElementById('key-modal-overlay').classList.remove('active');
        if (keyCallback) { keyCallback(); keyCallback = null; }
    } else {
        document.getElementById('key-error').style.display = 'block';
        document.getElementById('key-input').value = '';
    }
}
function closeKeyModal() {
    document.getElementById('key-modal-overlay').classList.remove('active');
    keyCallback = null;
}
document.addEventListener('DOMContentLoaded', ()=>{
    document.getElementById('key-input')?.addEventListener('keypress', e=>{ if(e.key==='Enter') submitKey(); });
});

// ─── CENTINELA ───────────────────────────────────────────────
function toggleSentinel() {
    sentinelActive = !sentinelActive;
    idleTime = 0;
    const uptime = document.getElementById('uptime');
    const sidebar = document.getElementById('sidebar');
    if (sentinelActive) {
        sidebar.classList.add('sentinel-active');
        uptime.style.color = 'var(--green)';
        log('[!] CENTINELA ACTIVADO — CIERRE EN 60s DE INACTIVIDAD.', 'ok');
    } else {
        sidebar.classList.remove('sentinel-active');
        uptime.style.color = '';
        uptime.textContent = 'UPTIME: 00:00:00';
        log('[+] CENTINELA DESACTIVADO.', 'ok');
    }
}
function startSentinelTimer() {
    window.addEventListener('mousemove', ()=>{ if(sentinelActive) idleTime=0; });
    window.addEventListener('keypress',  ()=>{ if(sentinelActive) idleTime=0; });
    setInterval(()=>{
        if (!sentinelActive) return;
        idleTime++;
        if (idleTime >= 60) { window.location.replace('https://www.youtube.com'); return; }
        const s = (idleTime%60).toString().padStart(2,'0');
        document.getElementById('uptime').textContent = `SENTINEL: 00:${s}`;
    }, 1000);
}

function panicAbort() {
    document.getElementById('panic-layer').style.display = 'flex';
    log('[!] PROTOCOLO DE PÁNICO ACTIVADO.', 'cmd');
    setTimeout(()=> window.location.replace('https://www.youtube.com'), 800);
}

// ─── UTILIDADES ──────────────────────────────────────────────
function saveMeta() {
    try { localStorage.setItem('404_meta', JSON.stringify(meta)); } catch(e) { /* grande */ }
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function formatSize(bytes) {
    if (bytes < 1024) return bytes+'B';
    if (bytes < 1024*1024) return (bytes/1024).toFixed(1)+'KB';
    return (bytes/(1024*1024)).toFixed(1)+'MB';
}

// ─── EXPOSICIÓN GLOBAL (para onclick en HTML) ────────────────
window.openWin          = openWin;
window.closeWin         = closeWin;
window.openGallery      = openGallery;
window.submitKey        = submitKey;
window.closeKeyModal    = closeKeyModal;
window.closeLightbox    = closeLightbox;
window.toggleVaultEncrypted   = toggleVaultEncrypted;
window.toggleGalleryEncrypted = toggleGalleryEncrypted;
window.renderVault      = renderVault;
window.handleUpload     = handleUpload;
window.saveFile         = saveFile;
window.commitFile       = commitFile;
window.saveCommand      = saveCommand;
window.saveStatic       = saveStatic;
window.toggleSentinel   = toggleSentinel;
window.panicAbort       = panicAbort;

// ─── INICIO ──────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', boot);

// ═══════════════════════════════════════════════════════════
//  STREAM — PANEL DE VIDEO URL (agregado)
// ═══════════════════════════════════════════════════════════

let streamPanels = [];
const MAX_STREAMS = 10;

function getEmbedUrl(rawUrl) {
    try {
        const url = new URL(rawUrl.trim());

        // YouTube watch
        if (url.hostname.includes('youtube.com') && url.searchParams.get('v')) {
            return `https://www.youtube.com/embed/${url.searchParams.get('v')}?autoplay=1`;
        }
        // YouTube short
        if (url.hostname.includes('youtu.be')) {
            return `https://www.youtube.com/embed${url.pathname}?autoplay=1`;
        }
        // YouTube live / channel → redirige a watch directo
        if (url.hostname.includes('youtube.com') && url.pathname.includes('/live')) {
            const parts = url.pathname.split('/');
            const id = parts[parts.indexOf('live') + 1] || '';
            return `https://www.youtube.com/embed/${id}?autoplay=1`;
        }
        // Twitch
        if (url.hostname.includes('twitch.tv')) {
            const parts = url.pathname.split('/').filter(Boolean);
            const channel = parts[0];
            return `https://player.twitch.tv/?channel=${channel}&parent=${location.hostname}&autoplay=true`;
        }
        // Cualquier otra URL — intentar embed directo con iframe
        return rawUrl.trim();
    } catch(e) {
        return rawUrl.trim();
    }
}

function addStreamPanel() {
    if (streamPanels.length >= MAX_STREAMS) {
        log(`LÍMITE ALCANZADO: máximo ${MAX_STREAMS} streams simultáneos.`, 'warn');
        return;
    }

    const rawUrl = document.getElementById('stream-url-input').value.trim();
    const label  = document.getElementById('stream-label-input').value.trim() || `STREAM ${streamPanels.length + 1}`;

    if (!rawUrl) {
        log('ERROR: INGRESA UNA URL VÁLIDA.', 'warn');
        return;
    }

    const id = 'sp_' + Date.now();
    streamPanels.push({ id, rawUrl, label });

    document.getElementById('stream-url-input').value = '';
    document.getElementById('stream-label-input').value = '';

    renderStreamGrid();
    log(`STREAM AGREGADO: ${label}`, 'ok');
}

function removeStreamPanel(id) {
    streamPanels = streamPanels.filter(p => p.id !== id);
    renderStreamGrid();
    log('STREAM REMOVIDO.', 'cmd');
}

function clearAllPanels() {
    streamPanels = [];
    renderStreamGrid();
    log('TODOS LOS STREAMS CERRADOS.', 'cmd');
}

function renderStreamGrid() {
    const grid  = document.getElementById('stream-grid');
    const empty = document.getElementById('stream-empty');
    const count = document.getElementById('stream-count');
    if (!grid) return;

    grid.innerHTML = '';
    count.textContent = `${streamPanels.length} / ${MAX_STREAMS} STREAMS`;

    if (streamPanels.length === 0) {
        empty.style.display = 'block';
        return;
    }
    empty.style.display = 'none';

    streamPanels.forEach(p => {
        const embedUrl = getEmbedUrl(p.rawUrl);
        const panel = document.createElement('div');
        panel.id = p.id;
        panel.style.cssText = `
            position:relative;
            background:#0a0a0a;
            border:1px solid #222;
            border-radius:6px;
            overflow:hidden;
            display:flex;
            flex-direction:column;
            min-height:220px;
        `;

        panel.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:5px 8px;background:#111;border-bottom:1px solid #222;">
                <span style="color:#555;font-size:0.6rem;letter-spacing:0.1em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:80%;">📺 ${p.label}</span>
                <button onclick="removeStreamPanel('${p.id}')" style="background:transparent;color:#ff003c;border:none;cursor:pointer;font-size:0.9rem;padding:0 4px;line-height:1;">×</button>
            </div>
            <iframe
                src="${embedUrl}"
                style="flex:1;width:100%;min-height:200px;border:none;"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowfullscreen
                loading="lazy">
            </iframe>
        `;

        grid.appendChild(panel);
    });
}

// ── Comando stream en terminal ──
const _origExecCmd = window.execCmd || null;

// Parchamos execCmd para agregar los nuevos comandos
const _oldExecCmd = execCmd;
window.execCmd = function(q) { _oldExecCmd(q); };

// Exponemos funciones del stream
window.addStreamPanel   = addStreamPanel;
window.removeStreamPanel = removeStreamPanel;
window.clearAllPanels   = clearAllPanels;

// Enter en input de URL
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('stream-url-input')?.addEventListener('keypress', e => {
        if (e.key === 'Enter') addStreamPanel();
    });
});
