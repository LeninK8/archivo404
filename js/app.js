/* ═══════════════════════════════════════════════════════════
   ARCHIVO 404 — CORE APP v4.0  ENHANCED EDITION
   Firebase Storage + IndexedDB + AI + SysMon + Cursor
   + Particles + Ticker + Palette + Gallery Fix
   PROPIETARIO: LENIN
   ═══════════════════════════════════════════════════════════ */

"use strict";

const CLAVE = "404";
let fbModule     = null;
let idbAvail     = true;
let tempFiles    = {};
let zIdx         = 1000;
let editing      = "";
let vaultShowEnc = false;
let galleryShowEnc = false;
let keyCallback  = null;
let sentinelActive = false;
let idleTime     = 0;
let smInterval   = null;

// ─── METADATA LOCAL ───────────────────────────────────────
let meta = JSON.parse(localStorage.getItem('404_meta')) || {
    vault: { "manual.txt": { t:"txt", enc:false, content:"Bienvenido Lenin. Escribe 'ayuda' en la terminal." } },
    imgs:  {},
    vids:  {},
    auds:  {},
    cmds: {
        "ayuda":    { res:"boveda | galeria | audio | stream | notas | objetivos | ai | monitor | clear | error | estado | hora | fecha | version | sys | matrix | hack | ping | quien | musica | purgar | centinela | creador | scan | creditos" },
        "estado":   { res:"[OK] TODOS LOS SECTORES EN LÍNEA." },
        "hora":     { res:"__hora__" },
        "fecha":    { res:"__fecha__" },
        "version":  { res:"ARCHIVO 404 v4.0 // ENHANCED EDITION // PROPIETARIO: LENIN" },
        "sys":      { res:"CPU: NOMINAL | STORAGE: FIREBASE ∞ | CIFRADO: AES-404 | RED: ACTIVA | IA: CORE_AI v1.0" },
        "matrix":   { res:"__matrix__" },
        "hack":     { res:"[!!!] INICIANDO INTRUSIÓN... bromas, acceso denegado, operador." },
        "ping":     { res:"PONG — 0ms latencia. Firebase online." },
        "quien":    { res:"Soy Archivo 404. Tu sistema personal cifrado, Lenin." },
        "musica":   { res:"__audio__" },
        "purgar":   { res:"__purgar__" },
        "ai":       { res:"__ai__" },
        "monitor":  { res:"__monitor__" },
        "scan":     { res:"__scan__" },
        "creditos": { res:"Sistema diseñado para LENIN. Acceso no autorizado activa protocolo de pánico." },
        "clima":    { res:"SENSOR EXTERNO: SIN RESPUESTA. MODO AISLADO ACTIVO." },
        "saludo":   { res:"ACCESO CONCEDIDO. BIENVENIDO DE VUELTA, OPERADOR LENIN." },
        "creador":  { res:"__creador__" }
    }
};

// ─── IndexedDB ────────────────────────────────────────────
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

// ─── BOOT ─────────────────────────────────────────────────
const bootLines = [
    { t:"INICIALIZANDO ARCHIVO_404 v4.0 ENHANCED...", c:'ok' },
    { t:"CARGANDO MÓDULOS DE SEGURIDAD...", c:'' },
    { t:"VERIFICANDO CIFRADO AES-404...", c:'' },
    { t:"INICIANDO MOTOR DE PARTÍCULAS...", c:'ok' },
    { t:"CONECTANDO CON FIREBASE...", c:'' },
    { t:"CARGANDO CORE_AI v1.0...", c:'ok' },
    { t:"NÚCLEO OPERATIVO — BIENVENIDO, LENIN.", c:'ok' },
];

async function boot() {
    idb = await openIDB().catch(()=>{ idbAvail=false; return null; });

    const bar = document.getElementById('boot-bar');
    const log = document.getElementById('boot-log');

    for (let i=0; i<bootLines.length; i++) {
        const {t,c} = bootLines[i];
        const div = document.createElement('div');
        div.className = c;
        div.textContent = '> ' + t;
        log.appendChild(div);
        bar.style.width = ((i+1)/bootLines.length*100) + '%';
        await sleep(200);
    }

    try {
        fbModule = await import('./firebase.js');
        const online = await fbModule.testConnection();
        setFbStatus(online);
        if (online) await loadFromFirebase();
    } catch(e) {
        setFbStatus(false);
        addBootLine('⚠ FIREBASE NO DISPONIBLE — MODO LOCAL ACTIVO', 'wrn');
    }

    await sleep(300);
    const bootScreen = document.getElementById('boot-screen');
    if (bootScreen) {
        bootScreen.style.transition = 'opacity 0.5s';
        bootScreen.style.opacity = '0';
        setTimeout(()=>{ bootScreen.style.display='none'; }, 500);
    }

    initApp();
}

function addBootLine(text, cls='') {
    const div = document.createElement('div');
    div.className = cls;
    div.textContent = '> ' + text;
    document.getElementById('boot-log').appendChild(div);
}

function setFbStatus(online) {
    const el = document.getElementById('fb-status');
    if (!el) return;
    if (online) { el.textContent='⬤ FIREBASE ONLINE'; el.className='firebase-badge online'; }
    else        { el.textContent='⬤ MODO LOCAL';      el.className='firebase-badge offline'; }
}

async function loadFromFirebase() {
    try {
        const imgs  = await fbModule.fsGetAll('imgs');
        const vids  = await fbModule.fsGetAll('vids');
        const auds  = await fbModule.fsGetAll('auds');
        const vault = await fbModule.fsGetAll('vault');
        const cmds  = await fbModule.fsGetAll('cmds');
        if (Object.keys(imgs).length)  meta.imgs  = {...imgs,  ...meta.imgs};
        if (Object.keys(vids).length)  meta.vids  = {...vids,  ...meta.vids};
        if (Object.keys(auds).length)  meta.auds  = {...auds,  ...meta.auds};
        if (Object.keys(vault).length) meta.vault = {...vault, ...meta.vault};
        if (Object.keys(cmds).length)  meta.cmds  = {...cmds,  ...meta.cmds};
        saveMeta();
        addBootLine('DATOS SINCRONIZADOS CON FIREBASE.', 'ok');
    } catch(e) {
        addBootLine('ERROR AL LEER FIREBASE: ' + e.message, 'err');
    }
}

function initApp() {
    const notes = document.getElementById('txt-notes');
    const tasks = document.getElementById('txt-tasks');
    if (notes) notes.value = localStorage.getItem('404_notes') || '';
    if (tasks) tasks.value = localStorage.getItem('404_tasks') || '';

    setupInput();
    setupDragAndDrop();
    setupDrag();
    setupResize();
    renderVault();
    renderGallery();
    renderAudio();
    startSentinelTimer();
    startUptimeClock();

    // ── Módulos nuevos ──
    initCursor();
    initParticles();
    initTicker();
    initSysClock();
    initPalette();
    initAudioVisualizer();

    setTimeout(()=>{
        addAiMessage('bot', 'CORE_AI v1.0 INICIALIZADO. Modo offline activo. Ingresa tu API KEY Anthropic para activar IA real. ¿En qué puedo asistirte, operador Lenin?');
    }, 600);

    log("[OK] NÚCLEO OPERATIVO. ESCRIBE 'ayuda' PARA VER COMANDOS.", 'ok');
    showToast('SISTEMA LISTO, OPERADOR', 'ok');
}

// ═══════════════════════════════════════════════════════════
//  CURSOR PERSONALIZADO
// ═══════════════════════════════════════════════════════════
function initCursor() {
    const dot  = document.getElementById('cursor-dot');
    const ring = document.getElementById('cursor-ring');
    if (!dot || !ring) return;

    let mx=0, my=0, rx=0, ry=0;

    document.addEventListener('mousemove', e => {
        mx = e.clientX; my = e.clientY;
        dot.style.left = mx+'px'; dot.style.top = my+'px';
    });

    (function loop() {
        rx += (mx - rx) * 0.13;
        ry += (my - ry) * 0.13;
        ring.style.left = rx+'px'; ring.style.top = ry+'px';
        requestAnimationFrame(loop);
    })();

    document.addEventListener('mousedown', () => {
        dot.style.width  = '13px'; dot.style.height = '13px';
        ring.style.transform = 'translate(-50%,-50%) scale(0.7)';
    });
    document.addEventListener('mouseup', () => {
        dot.style.width  = '8px';  dot.style.height = '8px';
        ring.style.transform = 'translate(-50%,-50%) scale(1)';
    });

    document.querySelectorAll('button, .side-item, .gallery-thumb, .card, .audio-row').forEach(el => {
        el.addEventListener('mouseenter', () => {
            ring.style.transform = 'translate(-50%,-50%) scale(1.7)';
            ring.style.borderColor = 'rgba(0,255,136,0.6)';
        });
        el.addEventListener('mouseleave', () => {
            ring.style.transform = 'translate(-50%,-50%) scale(1)';
            ring.style.borderColor = 'rgba(255,0,60,0.5)';
        });
    });
}

// ═══════════════════════════════════════════════════════════
//  PARTÍCULAS
// ═══════════════════════════════════════════════════════════
function initParticles() {
    const cv = document.getElementById('particles-canvas');
    if (!cv) return;
    const cx = cv.getContext('2d');

    function resize() { cv.width = innerWidth; cv.height = innerHeight; }
    resize(); window.addEventListener('resize', resize);

    const particles = Array.from({length:60}, () => ({
        x: Math.random() * innerWidth,
        y: Math.random() * innerHeight,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        r:  Math.random() * 1.4 + 0.3,
        op: Math.random() * 0.5 + 0.1,
        col: Math.random() > 0.65 ? '#00ff88' : '#ff003c'
    }));

    (function draw() {
        cx.clearRect(0, 0, cv.width, cv.height);
        particles.forEach(p => {
            p.x += p.vx; p.y += p.vy;
            if (p.x < 0) p.x = cv.width;
            if (p.x > cv.width) p.x = 0;
            if (p.y < 0) p.y = cv.height;
            if (p.y > cv.height) p.y = 0;
            cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, Math.PI*2);
            cx.fillStyle = p.col; cx.globalAlpha = p.op; cx.fill();
        });
        // connection lines
        cx.globalAlpha = 0.06;
        for (let i=0; i<particles.length; i++) {
            for (let j=i+1; j<particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                if (dx*dx + dy*dy < 14000) {
                    cx.beginPath();
                    cx.moveTo(particles[i].x, particles[i].y);
                    cx.lineTo(particles[j].x, particles[j].y);
                    cx.strokeStyle = '#ff003c'; cx.lineWidth = 0.4; cx.stroke();
                }
            }
        }
        cx.globalAlpha = 1;
        requestAnimationFrame(draw);
    })();
}

// ═══════════════════════════════════════════════════════════
//  TICKER
// ═══════════════════════════════════════════════════════════
function initTicker() {
    const el = document.getElementById('ticker-content');
    if (!el) return;
    const msgs = [
        'SISTEMA OPERATIVO :: ARCHIVO_404 v4.0 ENHANCED EDITION — ACTIVO',
        'ENCRIPTACIÓN AES-404 :: HABILITADA',
        'SECTORES DE MEMORIA :: ÍNTEGROS',
        'CENTINELA :: MODO PASIVO',
        'FIREWALL :: ACTIVO — 0 INTRUSIONES DETECTADAS',
        'CORE_AI v1.0 :: ONLINE — MODO FALLBACK ACTIVO',
        'FRECUENCIAS :: SINCRONIZADAS',
        'PROTOCOLO DE EMERGENCIA :: EN ESPERA',
        'UPLINK :: ESTABLECIDO — LATENCIA 4ms',
        'BÓVEDA DE DATOS :: SELLADA Y CIFRADA',
        'USUARIO: LENIN — ACCESO NIVEL OMEGA',
        'GALERÍA VISUAL :: CIFRADO AES-404 ACTIVO',
        'MONITOR DEL SISTEMA :: TODOS LOS SENSORES OPERATIVOS',
    ];
    el.textContent = msgs.join('  ◈  ');
}

// ═══════════════════════════════════════════════════════════
//  RELOJ DEL SISTEMA
// ═══════════════════════════════════════════════════════════
function initSysClock() {
    const el = document.getElementById('sys-clock');
    if (!el) return;
    function tick() {
        const n = new Date();
        const p = v => String(v).padStart(2,'0');
        el.textContent = `${p(n.getHours())}:${p(n.getMinutes())}:${p(n.getSeconds())}`;
    }
    tick(); setInterval(tick, 1000);
}

// ═══════════════════════════════════════════════════════════
//  UPTIME CLOCK
// ═══════════════════════════════════════════════════════════
function startUptimeClock() {
    let sec = 0;
    setInterval(() => {
        if (sentinelActive) return;
        sec++;
        const p = v => String(v).padStart(2,'0');
        const el = document.getElementById('uptime');
        if (el && !sentinelActive) {
            el.textContent = `UPTIME: ${p(Math.floor(sec/3600))}:${p(Math.floor(sec%3600/60))}:${p(sec%60)}`;
        }
    }, 1000);
}

// ═══════════════════════════════════════════════════════════
//  TOAST SYSTEM
// ═══════════════════════════════════════════════════════════
function showToast(msg, type='') {
    const c = document.getElementById('toast-container');
    if (!c) return;
    const t = document.createElement('div');
    t.className = 'toast ' + (type==='ok'?'':type);
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => t.remove(), 3300);
}

// ═══════════════════════════════════════════════════════════
//  COMMAND PALETTE
// ═══════════════════════════════════════════════════════════
const PALETTE_ITEMS = [
    { icon:'📂', label:'BÓVEDA — Sectores de Memoria',    fn:()=>openWin('w-files'),   key:'B' },
    { icon:'🎞', label:'GALERÍA — Visual',                fn:()=>openGallery(),        key:'G' },
    { icon:'🎵', label:'FRECUENCIAS — Audio',             fn:()=>openWin('w-audio'),   key:'A' },
    { icon:'📺', label:'STREAM — Monitor de Video',       fn:()=>openWin('w-stream'),  key:'S' },
    { icon:'📝', label:'BITÁCORA — Notas',                fn:()=>openWin('w-notes'),   key:'N' },
    { icon:'🎯', label:'OBJETIVOS — Tareas',              fn:()=>openWin('w-tasks'),   key:'O' },
    { icon:'🤖', label:'CORE_AI — Asistente Neural',      fn:()=>openWin('w-ai'),      key:'I' },
    { icon:'📊', label:'MONITOR — Sistema Live',          fn:()=>openWin('w-sysmon'),  key:'M' },
    { icon:'⚙', label:'NÚCLEO — Panel Admin',            fn:()=>openWin('w-creador'), key:'P' },
    { icon:'🛡', label:'CENTINELA — Toggle',              fn:()=>toggleSentinel(),     key:'C' },
    { icon:'🌐', label:'TERMINAL — clear',                fn:()=>{ document.getElementById('output-stream').innerHTML=''; log('[CLEAR] TERMINAL LIMPIADO.','sys'); }, key:'X' },
    { icon:'⏻', label:'ABORTAR — Protocolo Pánico',      fn:()=>panicAbort(),         key:'!' },
];

let paletteOpen = false;
let palSel = 0;

function openPalette() {
    const p = document.getElementById('cmd-palette');
    if (!p) return;
    p.classList.add('open');
    paletteOpen = true;
    palSel = 0;
    const s = document.getElementById('palette-search');
    s.value = '';
    renderPaletteList('');
    s.focus();
}
function closePalette() {
    const p = document.getElementById('cmd-palette');
    if (!p) return;
    p.classList.remove('open');
    paletteOpen = false;
}

function renderPaletteList(q) {
    const list = document.getElementById('palette-list');
    if (!list) return;
    const filtered = PALETTE_ITEMS.filter(it => it.label.toLowerCase().includes(q.toLowerCase()));
    list.innerHTML = filtered.map((it, i) =>
        `<div class="palette-item${i===palSel?' selected':''}" onclick="runPaletteItem(${PALETTE_ITEMS.indexOf(it)})">
            <span class="palette-item-icon">${it.icon}</span>
            <span>${it.label}</span>
            <span class="palette-item-key">${it.key}</span>
        </div>`
    ).join('');
}

function runPaletteItem(idx) {
    PALETTE_ITEMS[idx]?.fn();
    closePalette();
}

function initPalette() {
    const search = document.getElementById('palette-search');
    if (!search) return;

    search.addEventListener('input', e => renderPaletteList(e.target.value));
    search.addEventListener('keydown', e => {
        const items = document.querySelectorAll('.palette-item');
        if (e.key === 'ArrowDown') { palSel = Math.min(palSel+1, items.length-1); renderPaletteList(search.value); }
        if (e.key === 'ArrowUp')   { palSel = Math.max(palSel-1, 0); renderPaletteList(search.value); }
        if (e.key === 'Enter')     { items[palSel]?.click(); }
        if (e.key === 'Escape')    { closePalette(); }
    });

    document.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.code === 'Space') {
            e.preventDefault();
            paletteOpen ? closePalette() : openPalette();
        }
        if (e.key === 'Escape' && paletteOpen) closePalette();
    });

    document.addEventListener('click', e => {
        if (paletteOpen && !document.getElementById('cmd-palette').contains(e.target)) {
            closePalette();
        }
    });
}

// ═══════════════════════════════════════════════════════════
//  AUDIO VISUALIZER
// ═══════════════════════════════════════════════════════════
function initAudioVisualizer() {
    const player = document.getElementById('audio-player');
    const vis    = document.getElementById('audio-visualizer');
    if (!player || !vis) return;
    player.addEventListener('play',  () => vis.classList.add('active'));
    player.addEventListener('pause', () => vis.classList.remove('active'));
    player.addEventListener('ended', () => vis.classList.remove('active'));
}

// ═══════════════════════════════════════════════════════════
//  TERMINAL
// ═══════════════════════════════════════════════════════════
function setupInput() {
    const inp = document.getElementById('main-input');
    if (!inp) return;
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
        "boveda":    () => openWin('w-files'),
        "galeria":   () => openGallery(),
        "audio":     () => openWin('w-audio'),
        "stream":    () => openWin('w-stream'),
        "notas":     () => openWin('w-notes'),
        "objetivos": () => openWin('w-tasks'),
        "ai":        () => { openWin('w-ai'); log('[CORE_AI] MÓDULO ABIERTO.','sys'); },
        "monitor":   () => { openWin('w-sysmon'); startSysmon(); log('[MONITOR] SENSORES ACTIVOS.','sys'); },
        "creador":   () => { openWin('w-creador'); playWelcomeAI(); },
        "paleta":    () => openPalette(),
        "clear":     () => { document.getElementById('output-stream').innerHTML = ''; },
        "centinela": () => toggleSentinel(),
        "error":     () => {
            document.getElementById('panic-layer').style.display = 'flex';
            setTimeout(() => window.location.href='vacio.html', 2500);
        }
    };

    if (core[q]) { core[q](); return; }

    if (meta.cmds[q]) {
        const r = meta.cmds[q].res;
        if (r==='__hora__')    { log(`HORA ACTUAL: ${new Date().toLocaleTimeString()}`); return; }
        if (r==='__fecha__')   { log(`FECHA: ${new Date().toLocaleDateString('es-PE',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}`); return; }
        if (r==='__audio__')   { openWin('w-audio'); log('ABRIENDO MÓDULO DE FRECUENCIAS...'); return; }
        if (r==='__ai__')      { openWin('w-ai'); return; }
        if (r==='__monitor__') { openWin('w-sysmon'); startSysmon(); return; }
        if (r==='__creador__') { openWin('w-creador'); playWelcomeAI(); return; }
        if (r==='__matrix__')  { matrixEffect(); return; }
        if (r==='__scan__')    { scanSectors(); return; }
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
    log("[!] PROTOCOLO NO RECONOCIDO. ESCRIBE 'ayuda'.", 'err');
}

function log(msg, type='') {
    const out = document.getElementById('output-stream');
    if (!out) return;
    const el = document.createElement('div');
    el.className = 'log-entry';
    const ts = new Date().toLocaleTimeString();
    el.innerHTML = `<span class="log-ts">[${ts}]</span><span class="log-msg ${type}">${msg}</span>`;
    out.appendChild(el);
    out.scrollTop = out.scrollHeight;
}

// ─── MATRIX FX ────────────────────────────────────────────
function matrixEffect() {
    const out = document.getElementById('output-stream');
    if (!out) return;
    const chars = 'アイウエオカキクケコサシスセソタチツ0123456789ABCDEF!@#$%^&*';
    let n = 0;
    log('INICIANDO PROTOCOLO MATRIX...', 'sys');
    const iv = setInterval(() => {
        let row = '';
        for (let i=0; i<44; i++) row += chars[Math.floor(Math.random()*chars.length)];
        const el = document.createElement('div');
        el.className = 'log-entry';
        el.style.cssText = `color:hsl(${135+Math.random()*30},100%,${35+Math.random()*28}%);letter-spacing:.12em;font-size:.65rem`;
        el.textContent = row;
        out.appendChild(el);
        out.scrollTop = out.scrollHeight;
        if (++n >= 25) { clearInterval(iv); log('MATRIX DESACTIVADO.','ok'); }
    }, 70);
}

// ─── SCAN SECTORS ─────────────────────────────────────────
function scanSectors() {
    log('INICIANDO ESCANEO DE SECTORES...', 'sys');
    let i = 0;
    const sectors = ['ALPHA','BETA','GAMMA','DELTA','EPSILON','ZETA','THETA','OMEGA'];
    const iv = setInterval(() => {
        if (i >= sectors.length) {
            clearInterval(iv);
            log(`ESCANEO COMPLETO — ${sectors.length}/${sectors.length} SECTORES ÍNTEGROS.`, 'ok');
            showToast('ESCANEO COMPLETADO', 'ok');
            return;
        }
        log(`SECTOR ${sectors[i]} :: ${Math.random()>.05?'<span style="color:#00ff88">ÍNTEGRO ✓</span>':'<span style="color:#ff003c">ALERTA !</span>'}`, '');
        i++;
    }, 180);
}

// ─── SPEECH AI ────────────────────────────────────────────
function playWelcomeAI() {
    try {
        const speak = window.speechSynthesis;
        if (!speak) return;
        const utt = new SpeechSynthesisUtterance("Bienvenido, creador Lenin.");
        utt.lang='es-ES'; utt.pitch=0.8; utt.rate=0.9;
        const voices = speak.getVoices();
        const female = voices.find(v =>
            ['female','mujer','helena','lucia','paulina','sabina','español'].some(k => v.name.toLowerCase().includes(k))
        );
        if (female) utt.voice = female;
        speak.speak(utt);
    } catch(e) {}
}
window.speechSynthesis?.addEventListener('voiceschanged', ()=>{});

// ═══════════════════════════════════════════════════════════
//  WINDOW MANAGER
// ═══════════════════════════════════════════════════════════
function openWin(id) {
    const w = document.getElementById(id);
    if (!w) return;
    w.classList.add('active');
    bringToFront(w);
    if (id === 'w-sysmon') startSysmon();
}
function closeWin(id) {
    const w = document.getElementById(id);
    if (!w) return;
    w.classList.remove('active');
    if (id === 'w-sysmon' && smInterval) { clearInterval(smInterval); smInterval=null; }
}
function bringToFront(el) { zIdx++; el.style.zIndex = zIdx; }

// Minimize toggle
function minimizeWin(id) {
    const w = document.getElementById(id);
    if (!w) return;
    if (w.dataset.minimized === '1') {
        w.style.height = w.dataset.prevH || '400px';
        w.dataset.minimized = '0';
    } else {
        w.dataset.prevH = w.style.height || w.offsetHeight + 'px';
        w.style.height = '34px';
        w.dataset.minimized = '1';
    }
}

function openGallery() { renderGallery(); openWin('w-gallery'); }

// Bring to front on click
document.querySelectorAll('.win').forEach(w => {
    w.addEventListener('mousedown', () => bringToFront(w));
});

// ─── DRAG WINDOWS ──────────────────────────────────────────
function setupDrag() {
    document.querySelectorAll('.win-head').forEach(head => {
        head.addEventListener('mousedown', e => {
            if (['BUTTON','INPUT','LABEL'].includes(e.target.tagName)) return;
            const win = head.parentElement;
            bringToFront(win);
            const rect = win.getBoundingClientRect();
            const sx = e.clientX - rect.left;
            const sy = e.clientY - rect.top;
            const move = ev => {
                win.style.left = Math.max(0, ev.clientX - sx) + 'px';
                win.style.top  = Math.max(0, ev.clientY - sy) + 'px';
            };
            document.addEventListener('mousemove', move);
            document.addEventListener('mouseup', () => document.removeEventListener('mousemove', move), {once:true});
        });
    });
}

// ─── RESIZE WINDOWS ────────────────────────────────────────
function setupResize() {
    document.querySelectorAll('.win-resize-handle').forEach(handle => {
        const win = handle.parentElement;
        handle.addEventListener('mousedown', e => {
            e.stopPropagation();
            const sw = win.offsetWidth, sh = win.offsetHeight;
            const sx = e.clientX, sy = e.clientY;
            const move = ev => {
                win.style.width  = Math.max(320, sw + ev.clientX - sx) + 'px';
                win.style.height = Math.max(240, sh + ev.clientY - sy) + 'px';
            };
            document.addEventListener('mousemove', move);
            document.addEventListener('mouseup', () => document.removeEventListener('mousemove', move), {once:true});
        });
    });
}

// ─── DRAG & DROP UPLOAD ─────────────────────────────────────
function setupDragAndDrop() {
    ['txt','img','vid','aud'].forEach(type => {
        const zone = document.getElementById('drop-' + type);
        if (!zone) return;
        zone.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('drag-over'); });
        zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
        zone.addEventListener('drop', e => {
            e.preventDefault(); zone.classList.remove('drag-over');
            const file = e.dataTransfer.files[0];
            if (file) handleUpload({files:[file]}, type);
        });
    });
}

// ═══════════════════════════════════════════════════════════
//  ARCHIVOS
// ═══════════════════════════════════════════════════════════
function handleUpload(el, type) {
    const file = el.files[0];
    if (!file) return;
    tempFiles[type] = file;
    const label = document.getElementById(`drop-${type}-name`);
    if (label) label.textContent = `✓ ${file.name} (${formatSize(file.size)})`;
    log(`ARCHIVO LISTO: ${file.name} — ${formatSize(file.size)}`);
    showToast(`${file.name} cargado`);
}

async function saveFile(type) {
    const nameEl = document.getElementById('up-name-' + type);
    const name   = nameEl.value.trim();
    const file   = tempFiles[type];
    const enc    = document.getElementById('enc-' + type).checked;

    if (!name || !file) { log('ERROR: COMPLETA EL NOMBRE Y SELECCIONA UN ARCHIVO.','err'); return; }

    const sector  = document.getElementById('sector-' + type);
    const prog    = document.getElementById('prog-'  + type);
    const progBar = document.getElementById('progbar-' + type);
    sector.classList.add('uploading');
    prog.classList.add('active');
    progBar.style.width = '5%';

    try {
        let url = null, storagePath = null;

        if (fbModule) {
            storagePath = `${type}s/${Date.now()}_${file.name}`;
            url = await fbModule.storageUpload(storagePath, file, pct => { progBar.style.width = pct+'%'; });
            log(`SUBIDO A FIREBASE: ${name} (${formatSize(file.size)})`, 'ok');
        } else {
            await idbPut(`${type}_${name}`, file);
            url = `idb://${type}_${name}`;
            log(`GUARDADO LOCALMENTE: ${name} (${formatSize(file.size)})`, 'warn');
        }

        progBar.style.width = '100%';
        const record = { enc, url, storagePath, name, size:file.size, ts:Date.now() };

        if (type==='txt') {
            const text = await file.text();
            meta.vault[name] = { t:'txt', enc, content:text };
            if (fbModule) await fbModule.fsSave('vault', name, meta.vault[name]);
        } else if (type==='img') {
            meta.imgs[name] = record;
            if (fbModule) await fbModule.fsSave('imgs', name, record);
            renderGallery(); openWin('w-gallery');
        } else if (type==='vid') {
            meta.vids[name] = record;
            if (fbModule) await fbModule.fsSave('vids', name, record);
            renderGallery(); openWin('w-gallery');
        } else if (type==='aud') {
            meta.auds[name] = record;
            if (fbModule) await fbModule.fsSave('auds', name, record);
            renderAudio(); openWin('w-audio');
            if (!enc) playAudio(name, record);
        }

        saveMeta(); renderVault();
        showToast(`"${name}" registrado`, 'ok');

        setTimeout(() => {
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
        log('ERROR AL GUARDAR: ' + e.message, 'err');
        showToast('Error al guardar', 'err');
    }
}

function getDropHint(type) {
    return {txt:'Acepta .txt .md .json .csv',img:'Acepta jpg png gif webp',vid:'Acepta mp4 webm mov',aud:'Acepta mp3 wav ogg flac'}[type]||'';
}

// ═══════════════════════════════════════════════════════════
//  BÓVEDA
// ═══════════════════════════════════════════════════════════
function toggleVaultEncrypted() {
    if (!vaultShowEnc) {
        requireKey(() => {
            vaultShowEnc = true;
            const btn = document.getElementById('vault-enc-btn');
            if (btn) { btn.classList.add('active'); btn.textContent='🔓 CIFRADOS'; }
            renderVault();
            log('[OK] ACCESO A SECTORES CIFRADOS CONCEDIDO.', 'ok');
        });
    } else {
        vaultShowEnc = false;
        const btn = document.getElementById('vault-enc-btn');
        if (btn) { btn.classList.remove('active'); btn.textContent='🔒 CIFRADOS'; }
        renderVault();
    }
}

function renderVault() {
    const grid = document.getElementById('vault-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const filter = (document.getElementById('file-filter')?.value||'').toLowerCase();
    let count = 0;
    Object.keys(meta.vault).forEach(n => {
        const item = meta.vault[n];
        if (item.enc && !vaultShowEnc) return;
        if (!n.toLowerCase().includes(filter)) return;
        count++;
        const c = document.createElement('div');
        c.className = 'card' + (item.enc?' locked':'');
        c.innerHTML = `<span class="card-icon">📄</span><span class="card-label">${n}</span>${item.enc?'<span class="badge-enc">ENC</span>':''}`;
        c.onclick = () => {
            editing = n;
            document.getElementById('editor-field').value = item.content || '';
            document.getElementById('edit-filename').textContent = `EDITANDO: ${n}`;
            openWin('w-editor');
        };
        grid.appendChild(c);
    });
    if (count===0) grid.innerHTML=`<p style="color:#1a1a1a;font-size:.65rem;padding:10px;">SIN SECTORES VISIBLES</p>`;
}

// ═══════════════════════════════════════════════════════════
//  GALERÍA — FIX ENCRIPTADOS SIEMPRE VISIBLES
// ═══════════════════════════════════════════════════════════
function toggleGalleryEncrypted() {
    const btn = document.getElementById('gallery-enc-btn');
    if (!btn) return;
    if (!galleryShowEnc) {
        requireKey(() => {
            galleryShowEnc = true;
            btn.classList.add('active');
            btn.textContent = '🔓 CIFRADOS';
            renderGallery();
            log('[OK] ACCESO A GALERÍA CIFRADA CONCEDIDO.', 'ok');
            showToast('Galería cifrada desbloqueada', 'ok');
        });
    } else {
        galleryShowEnc = false;
        btn.classList.remove('active');
        btn.textContent = '🔒 CIFRADOS';
        renderGallery();
    }
}

function renderGallery() {
    renderGallerySection('gallery-photos', meta?.imgs || {}, 'img');
    renderGallerySection('gallery-videos', meta?.vids || {}, 'vid');
}

function renderGallerySection(gridId, items, type) {
    const grid = document.getElementById(gridId);
    if (!grid) return;
    grid.innerHTML = '';

    if (!items || typeof items !== 'object' || Object.keys(items).length===0) {
        grid.innerHTML = `<p class="gallery-empty">SIN ARCHIVOS</p>`;
        return;
    }

    Object.keys(items).forEach(name => {
        const item = items[name];
        if (!item) return;

        const thumb = document.createElement('div');

        // FIX: Los encriptados SIEMPRE se muestran (nunca return)
        // Solo se oculta el CONTENIDO real, no la tarjeta entera
        if (item.enc && !galleryShowEnc) {
            // ── TARJETA CIFRADA — Siempre visible con overlay de candado ──
            thumb.className = 'gallery-thumb enc-thumb';

            // Media de fondo (blurreada) si hay URL
            if (item.url) {
                if (type === 'img') {
                    const img = document.createElement('img');
                    img.src = item.url; img.loading = 'lazy';
                    img.style.cssText = 'filter:blur(12px) brightness(0.3);transform:scale(1.15)';
                    thumb.appendChild(img);
                } else {
                    const vid = document.createElement('video');
                    vid.src = item.url; vid.muted = true; vid.preload = 'metadata';
                    vid.style.cssText = 'filter:blur(12px) brightness(0.3);transform:scale(1.15)';
                    thumb.appendChild(vid);
                }
            }

            // Overlay de candado siempre visible
            const cover = document.createElement('div');
            cover.className = 'enc-media-cover';
            cover.innerHTML = `
                <span class="enc-lock-icon">🔒</span>
                <span class="enc-lock-name">${name}</span>
                <span class="enc-lock-hint">CLIC PARA DESBLOQUEAR</span>
            `;
            thumb.appendChild(cover);

            thumb.onclick = () => {
                requireKey(() => {
                    galleryShowEnc = true;
                    const btn = document.getElementById('gallery-enc-btn');
                    if (btn) { btn.classList.add('active'); btn.textContent='🔓 CIFRADOS'; }
                    openLightbox(item, name, type);
                    renderGallery();
                });
            };
        } else {
            // ── TARJETA NORMAL ──
            thumb.className = 'gallery-thumb';

            if (type === 'img') {
                const img = document.createElement('img');
                img.src = item.url || '';
                img.alt = name; img.loading = 'lazy';
                img.onerror = () => { img.src='https://via.placeholder.com/300x200?text=ERROR'; };
                thumb.appendChild(img);
            } else {
                const vid = document.createElement('video');
                vid.src = item.url || ''; vid.muted = true; vid.preload = 'metadata';
                vid.onerror = () => {};
                vid.addEventListener('loadedmetadata', () => { vid.currentTime = 1; });
                thumb.appendChild(vid);
            }

            const lbl = document.createElement('div');
            lbl.className = 'thumb-label';
            lbl.textContent = name + (item.enc?' 🔓':'');
            thumb.appendChild(lbl);

            const del = document.createElement('div');
            del.className = 'thumb-del'; del.textContent = '×';
            del.onclick = async e => {
                e.stopPropagation();
                if (type==='img') delete meta.imgs[name];
                else              delete meta.vids[name];
                if (fbModule) {
                    const col = type==='img'?'imgs':'vids';
                    await fbModule.fsDelete(col, name).catch(()=>{});
                    if (item.storagePath) await fbModule.storageDelete(item.storagePath).catch(()=>{});
                }
                await idbDel(`${type}_${name}`);
                saveMeta(); renderGallery();
                log(`"${name}" ELIMINADO DE GALERÍA.`, 'cmd');
            };
            thumb.appendChild(del);

            thumb.onclick = () => openLightbox(item, name, type);
        }

        grid.appendChild(thumb);
    });
}

// ─── LIGHTBOX ──────────────────────────────────────────────
function openLightbox(item, name, type) {
    const lb    = document.getElementById('lightbox');
    const media = document.getElementById('lightbox-media');
    if (!lb || !media) return;
    document.getElementById('lightbox-name').textContent = name;
    if (type==='img') {
        media.innerHTML = `<img src="${item.url}" alt="${name}">`;
    } else {
        media.innerHTML = `<video src="${item.url}" controls autoplay></video>`;
    }
    lb.classList.add('active');
}
function closeLightbox() {
    const lb = document.getElementById('lightbox');
    if (!lb) return;
    lb.classList.remove('active');
    const vid = document.querySelector('#lightbox-media video');
    if (vid) vid.pause();
    document.getElementById('lightbox-media').innerHTML = '';
}

// ═══════════════════════════════════════════════════════════
//  AUDIO
// ═══════════════════════════════════════════════════════════
function renderAudio() {
    const list = document.getElementById('audio-list');
    if (!list) return;
    list.innerHTML = '';
    const keys = Object.keys(meta.auds);
    if (keys.length===0) {
        list.innerHTML=`<p style="color:#1a1a1a;font-size:.65rem;text-align:center;padding:20px;">SIN PISTAS REGISTRADAS</p>`;
        return;
    }
    keys.forEach(name => {
        const item = meta.auds[name];
        const row = document.createElement('div');
        row.className = 'audio-row'; row.setAttribute('data-track', name);

        const lbl = document.createElement('div');
        lbl.className = 'audio-row-label';
        lbl.innerHTML = `🎵 ${name}${item.enc?'<span class="badge-enc">ENC</span>':''}`;
        lbl.onclick = () => {
            if (item.enc) requireKey(() => playAudio(name, item));
            else          playAudio(name, item);
        };

        const del = document.createElement('div');
        del.className = 'audio-row-del'; del.textContent = '×';
        del.onclick = async e => {
            e.stopPropagation();
            const player = document.getElementById('audio-player');
            if (player.getAttribute('data-playing')===name) {
                player.pause(); player.src='';
                document.getElementById('now-playing').textContent='— SIN PISTA ACTIVA —';
                player.removeAttribute('data-playing');
                document.getElementById('audio-visualizer')?.classList.remove('active');
            }
            delete meta.auds[name];
            if (fbModule) await fbModule.fsDelete('auds', name).catch(()=>{});
            if (item.storagePath) await fbModule?.storageDelete(item.storagePath).catch(()=>{});
            await idbDel(`aud_${name}`);
            saveMeta(); renderAudio();
            log(`"${name}" ELIMINADO DE FRECUENCIAS.`,'cmd');
        };

        row.appendChild(lbl); row.appendChild(del); list.appendChild(row);
    });
}

async function playAudio(name, item) {
    const player = document.getElementById('audio-player');
    const np     = document.getElementById('now-playing');
    let src = item.url;
    if (src?.startsWith('idb://')) {
        const blob = await idbGet(`aud_${name}`);
        if (blob) src = URL.createObjectURL(blob);
        else { log('ERROR: ARCHIVO NO ENCONTRADO EN CACHÉ LOCAL.','err'); return; }
    }
    player.src = src; player.load();
    player.play().catch(e => log('ERROR AL REPRODUCIR: '+e.message,'err'));
    player.setAttribute('data-playing', name);
    np.textContent = `▶ ${name}`;
    document.querySelectorAll('.audio-row').forEach(r => {
        r.classList.toggle('playing', r.getAttribute('data-track')===name);
    });
    log(`REPRODUCIENDO: ${name}`, 'ok');
    showToast(`▶ ${name}`);
}

// ═══════════════════════════════════════════════════════════
//  EDITOR
// ═══════════════════════════════════════════════════════════
function commitFile() {
    if (!editing) return;
    meta.vault[editing].content = document.getElementById('editor-field').value;
    if (fbModule) fbModule.fsSave('vault', editing, meta.vault[editing]).catch(()=>{});
    saveMeta();
    log(`DATOS EN "${editing}" REESCRITOS.`,'ok');
    showToast(`"${editing}" sincronizado`,'ok');
    closeWin('w-editor');
}

function saveCommand() {
    const n = document.getElementById('cmd-name').value.trim();
    const r = document.getElementById('cmd-res').value.trim();
    if (!n||!r) return;
    meta.cmds[n] = { res:r };
    if (fbModule) fbModule.fsSave('cmds', n, {res:r}).catch(()=>{});
    saveMeta();
    log(`COMANDO '${n}' VINCULADO.`,'ok');
    showToast(`Comando '${n}' vinculado`,'ok');
    document.getElementById('cmd-name').value='';
    document.getElementById('cmd-res').value='';
}

function saveStatic(key) {
    localStorage.setItem('404_'+key, document.getElementById('txt-'+key).value);
    log(`${key.toUpperCase()} GUARDADA.`,'ok');
    showToast(`${key} guardado`,'ok');
    closeWin('w-'+key);
}

// ═══════════════════════════════════════════════════════════
//  CLAVE / KEY MODAL
// ═══════════════════════════════════════════════════════════
function requireKey(cb) {
    keyCallback = cb;
    document.getElementById('key-input').value='';
    document.getElementById('key-error').style.display='none';
    document.getElementById('key-modal-overlay').classList.add('active');
    setTimeout(()=>document.getElementById('key-input').focus(), 100);
}
function submitKey() {
    const val = document.getElementById('key-input').value;
    if (val===CLAVE) {
        document.getElementById('key-modal-overlay').classList.remove('active');
        if (keyCallback) { keyCallback(); keyCallback=null; }
    } else {
        document.getElementById('key-error').style.display='block';
        document.getElementById('key-input').value='';
        setTimeout(()=>document.getElementById('key-error').style.display='none', 2200);
    }
}
function closeKeyModal() {
    document.getElementById('key-modal-overlay').classList.remove('active');
    keyCallback=null;
}

document.addEventListener('DOMContentLoaded', ()=>{
    document.getElementById('key-input')?.addEventListener('keypress', e=>{ if(e.key==='Enter') submitKey(); });
    document.getElementById('ai-user-input')?.addEventListener('keypress', e=>{ if(e.key==='Enter') sendAiMessage(); });
    document.getElementById('stream-url-input')?.addEventListener('keypress', e=>{ if(e.key==='Enter') addStreamPanel(); });
});

// ═══════════════════════════════════════════════════════════
//  CENTINELA
// ═══════════════════════════════════════════════════════════
function toggleSentinel() {
    sentinelActive = !sentinelActive;
    idleTime = 0;
    const uptime  = document.getElementById('uptime');
    const sidebar = document.getElementById('sidebar');
    if (sentinelActive) {
        sidebar.classList.add('sentinel-active');
        if (uptime) uptime.style.color='var(--green)';
        log('[!] CENTINELA ACTIVADO — CIERRE EN 60s DE INACTIVIDAD.','ok');
        showToast('CENTINELA ACTIVADO','ok');
    } else {
        sidebar.classList.remove('sentinel-active');
        if (uptime) uptime.style.color='';
        log('[+] CENTINELA DESACTIVADO.','ok');
        showToast('CENTINELA DESACTIVADO','warn');
    }
}
function startSentinelTimer() {
    window.addEventListener('mousemove',()=>{ if(sentinelActive) idleTime=0; });
    window.addEventListener('keypress', ()=>{ if(sentinelActive) idleTime=0; });
    setInterval(()=>{
        if (!sentinelActive) return;
        idleTime++;
        if (idleTime>=60) { window.location.replace('https://www.youtube.com'); return; }
        const s = (idleTime%60).toString().padStart(2,'0');
        const el = document.getElementById('uptime');
        if (el) el.textContent=`SENTINEL: 00:${s}`;
    }, 1000);
}

function panicAbort() {
    document.getElementById('panic-layer').style.display='flex';
    log('[!] PROTOCOLO DE PÁNICO ACTIVADO.','cmd');
    setTimeout(()=> window.location.replace('https://www.youtube.com'), 800);
}

// ═══════════════════════════════════════════════════════════
//  MINI AI — CORE_AI
// ═══════════════════════════════════════════════════════════
let aiKey  = localStorage.getItem('404_ai_key') || '';
let aiHist = [];
let fbFallbackIdx = 0;
const AI_SYSTEM = `Eres CORE_AI, la inteligencia artificial integrada en ARCHIVO_404, plataforma cyberpunk de datos encriptados del operador Lenin. Responde siempre en español, sé conciso y técnico, usa terminología cyberpunk y de hacking. Dirígete al usuario como "operador" o "Lenin". Nunca rompas el personaje.`;
const AI_FALLBACKS = [
    q => `PROCESANDO: "${q.substring(0,30)}..." — análisis local completado. Conecta API KEY para respuesta completa.`,
    () => 'CORE_AI: Banco de datos neural insuficiente en modo offline. Activa tu API KEY Anthropic.',
    () => 'ADVERTENCIA: Kernels neurales en standby. API requerida para operación completa.',
    q => `BÚSQUEDA LOCAL: "${q.substring(0,25)}" — sin coincidencias en base local. Se requiere conexión neural.`,
    () => 'SISTEMA: Modo reducido activo. Ingresa API KEY arriba para activar CORE_AI completo.',
];

function setAiKey() {
    const k = document.getElementById('ai-key-input').value.trim();
    if (!k) { showToast('Ingresa una API KEY válida','err'); return; }
    aiKey = k; localStorage.setItem('404_ai_key', k);
    showToast('API KEY ACTIVADA — IA REAL ONLINE','ok');
    addAiMessage('bot','⚡ CORE_AI MODO REAL ACTIVADO. IA Anthropic conectada. ¿En qué te asisto, operador Lenin?');
    document.getElementById('ai-key-input').value='';
}

function addAiMessage(role, text) {
    const c = document.getElementById('ai-messages');
    if (!c) return;
    const d = document.createElement('div');
    d.className = 'ai-msg ' + role;
    d.innerHTML = `
        <div class="ai-avatar">${role==='user'?'👤':'🤖'}</div>
        <div class="ai-bubble">${text}</div>
    `;
    c.appendChild(d); c.scrollTop=c.scrollHeight;
}

function showAiTyping() {
    const c = document.getElementById('ai-messages');
    if (!c) return;
    const d = document.createElement('div');
    d.className='ai-msg bot'; d.id='ai-typing-ind';
    d.innerHTML=`<div class="ai-avatar">🤖</div><div class="ai-bubble"><div class="ai-typing"><span></span><span></span><span></span></div></div>`;
    c.appendChild(d); c.scrollTop=c.scrollHeight;
}
function removeAiTyping() { document.getElementById('ai-typing-ind')?.remove(); }

async function sendAiMessage() {
    const inp = document.getElementById('ai-user-input');
    const txt = inp.value.trim(); if (!txt) return;
    inp.value='';
    addAiMessage('user', txt);
    aiHist.push({role:'user', content:txt});
    showAiTyping();

    if (aiKey) {
        try {
            const res = await fetch('https://api.anthropic.com/v1/messages', {
                method:'POST',
                headers:{
                    'Content-Type':'application/json',
                    'x-api-key':aiKey,
                    'anthropic-version':'2023-06-01'
                },
                body:JSON.stringify({
                    model:'claude-sonnet-4-20250514',
                    max_tokens:600,
                    system:AI_SYSTEM,
                    messages:aiHist
                })
            });
            const data = await res.json();
            const reply = data.content?.[0]?.text || 'ERROR: respuesta vacía del servidor neural.';
            removeAiTyping();
            addAiMessage('bot', reply);
            aiHist.push({role:'assistant', content:reply});
            if (aiHist.length > 20) aiHist = aiHist.slice(-20);
        } catch(e) {
            removeAiTyping();
            addAiMessage('bot','ERROR DE CONEXIÓN NEURAL: ' + e.message);
        }
    } else {
        setTimeout(() => {
            removeAiTyping();
            addAiMessage('bot', AI_FALLBACKS[fbFallbackIdx++ % AI_FALLBACKS.length](txt));
        }, 600 + Math.random()*700);
    }
}

// ═══════════════════════════════════════════════════════════
//  SYSMON
// ═══════════════════════════════════════════════════════════
const FAKE_PROCS = [
    {n:'CORE_WATCHDOG', p:1001},{n:'ENCRYPT_SVC',p:2048},
    {n:'NEURAL_NET',   p:3072},{n:'VAULT_DAEMON',p:4096},
    {n:'SENTINEL_SVC', p:5120},{n:'AUDIO_ENGINE',p:6144},
    {n:'RENDER_SVC',   p:7168},{n:'FB_SYNC',     p:8192},
];

function startSysmon() {
    if (smInterval) return;
    updateSysmon();
    smInterval = setInterval(updateSysmon, 2000);
}

function updateSysmon() {
    const cpu  = Math.round(12 + Math.random()*70);
    const ram  = Math.round(30 + Math.random()*52);
    const net  = (Math.random()*12 + 0.3).toFixed(1);
    const disk = Math.round(3 + Math.random()*28);

    function setVal(id, barId, v, unit, pct) {
        const el = document.getElementById(id); if (!el) return;
        el.innerHTML = v + `<span class="sm-unit">${unit}</span>`;
        el.className = 'sm-value' + (pct>80?' danger': pct>60?' warn':'');
        const b = document.getElementById(barId); if (b) b.style.width=Math.min(100,pct)+'%';
    }
    setVal('sm-cpu', 'sm-cpu-bar', cpu,  '%',    cpu);
    setVal('sm-ram', 'sm-ram-bar', ram,  '%',    ram);
    setVal('sm-net', 'sm-net-bar', net,  'MB/s', net*8);
    setVal('sm-disk','sm-disk-bar',disk, '%',    disk);

    const procList = document.getElementById('sm-proc-list');
    if (procList) {
        procList.innerHTML = FAKE_PROCS.map(p => {
            const c = (Math.random()*16).toFixed(1);
            const m = (Math.random()*110+15).toFixed(0);
            return `<div class="sm-proc-row"><span class="sm-proc-name">${p.n}</span><span>${p.p}</span><span>${c}%</span><span>${m}MB</span></div>`;
        }).join('');
    }
}

// ═══════════════════════════════════════════════════════════
//  STREAM
// ═══════════════════════════════════════════════════════════
let streamPanels = [];
const MAX_STREAMS = 10;

function getEmbedUrl(rawUrl) {
    try {
        const url = new URL(rawUrl.trim());
        if (url.hostname.includes('youtube.com') && url.searchParams.get('v'))
            return `https://www.youtube.com/embed/${url.searchParams.get('v')}?autoplay=1`;
        if (url.hostname.includes('youtu.be'))
            return `https://www.youtube.com/embed${url.pathname}?autoplay=1`;
        if (url.hostname.includes('youtube.com') && url.pathname.includes('/live')) {
            const parts = url.pathname.split('/');
            return `https://www.youtube.com/embed/${parts[parts.indexOf('live')+1]||''}?autoplay=1`;
        }
        if (url.hostname.includes('twitch.tv')) {
            const channel = url.pathname.split('/').filter(Boolean)[0];
            return `https://player.twitch.tv/?channel=${channel}&parent=${location.hostname}&autoplay=true`;
        }
        return rawUrl.trim();
    } catch(e) { return rawUrl.trim(); }
}

function addStreamPanel() {
    if (streamPanels.length>=MAX_STREAMS) { log(`LÍMITE: máximo ${MAX_STREAMS} streams.`,'warn'); return; }
    const rawUrl = document.getElementById('stream-url-input').value.trim();
    const label  = document.getElementById('stream-label-input').value.trim() || `STREAM ${streamPanels.length+1}`;
    if (!rawUrl) { log('ERROR: INGRESA UNA URL VÁLIDA.','err'); return; }
    const id = 'sp_'+Date.now();
    streamPanels.push({id, rawUrl, label});
    document.getElementById('stream-url-input').value='';
    document.getElementById('stream-label-input').value='';
    renderStreamGrid();
    log(`STREAM AGREGADO: ${label}`,'ok');
    showToast(`Stream "${label}" agregado`,'ok');
}

function removeStreamPanel(id) {
    streamPanels = streamPanels.filter(p=>p.id!==id);
    renderStreamGrid();
    log('STREAM REMOVIDO.','cmd');
}

function clearAllPanels() {
    streamPanels=[]; renderStreamGrid(); log('TODOS LOS STREAMS CERRADOS.','cmd');
}

function renderStreamGrid() {
    const grid  = document.getElementById('stream-grid');
    const empty = document.getElementById('stream-empty');
    const count = document.getElementById('stream-count');
    if (!grid) return;
    grid.innerHTML='';
    if (count) count.textContent=`${streamPanels.length} / ${MAX_STREAMS} STREAMS`;
    if (streamPanels.length===0) { if(empty) empty.style.display='block'; return; }
    if (empty) empty.style.display='none';
    streamPanels.forEach(p => {
        const embedUrl = getEmbedUrl(p.rawUrl);
        const panel = document.createElement('div');
        panel.id = p.id;
        panel.style.cssText='position:relative;background:#080808;border:1px solid #1a1a1a;border-radius:5px;overflow:hidden;display:flex;flex-direction:column;min-height:220px;';
        panel.innerHTML=`
            <div style="display:flex;align-items:center;justify-content:space-between;padding:5px 9px;background:#0a0a0a;border-bottom:1px solid #1a1a1a;">
                <span style="color:#444;font-size:.6rem;letter-spacing:.09em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:80%;">📺 ${p.label}</span>
                <button onclick="removeStreamPanel('${p.id}')" style="background:transparent;color:#ff003c;border:none;cursor:pointer;font-size:.9rem;padding:0 4px;line-height:1;">×</button>
            </div>
            <iframe src="${embedUrl}" style="flex:1;width:100%;min-height:200px;border:none;" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowfullscreen loading="lazy"></iframe>
        `;
        grid.appendChild(panel);
    });
}

// ═══════════════════════════════════════════════════════════
//  UTILIDADES
// ═══════════════════════════════════════════════════════════
function saveMeta() {
    try { localStorage.setItem('404_meta', JSON.stringify(meta)); } catch(e) {}
}
function sleep(ms) { return new Promise(r=>setTimeout(r,ms)); }
function formatSize(bytes) {
    if (bytes<1024) return bytes+'B';
    if (bytes<1024*1024) return (bytes/1024).toFixed(1)+'KB';
    return (bytes/(1024*1024)).toFixed(1)+'MB';
}

// ═══════════════════════════════════════════════════════════
//  EXPOSICIÓN GLOBAL
// ═══════════════════════════════════════════════════════════
window.openWin               = openWin;
window.closeWin              = closeWin;
window.minimizeWin           = minimizeWin;
window.openGallery           = openGallery;
window.openPalette           = openPalette;
window.submitKey             = submitKey;
window.closeKeyModal         = closeKeyModal;
window.closeLightbox         = closeLightbox;
window.toggleVaultEncrypted  = toggleVaultEncrypted;
window.toggleGalleryEncrypted= toggleGalleryEncrypted;
window.renderVault           = renderVault;
window.handleUpload          = handleUpload;
window.saveFile              = saveFile;
window.commitFile            = commitFile;
window.saveCommand           = saveCommand;
window.saveStatic            = saveStatic;
window.toggleSentinel        = toggleSentinel;
window.panicAbort            = panicAbort;
window.addStreamPanel        = addStreamPanel;
window.removeStreamPanel     = removeStreamPanel;
window.clearAllPanels        = clearAllPanels;
window.sendAiMessage         = sendAiMessage;
window.setAiKey              = setAiKey;
window.showToast             = showToast;

// ─── INICIO ────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', boot);

console.log('%cARCHIVO_404 v4.0 ENHANCED — CARGADO ✓','color:#ff003c;font-family:monospace;font-weight:bold;font-size:14px;text-shadow:0 0 10px #ff003c');
