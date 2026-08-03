// ════════════════════════════════════════════════════════════
//  ARCHIVO 404 — CHAT · Lógica principal
//  Firestore: usuarios, chats, mensajes, estados, perfiles.
//  Cloudinary: TODO el almacenamiento de archivos multimedia.
//  (Firebase Storage fue eliminado por completo del proyecto.)
// ════════════════════════════════════════════════════════════
import {
  db, doc, setDoc, getDoc, updateDoc, deleteDoc, collection,
  query, where, orderBy, onSnapshot, serverTimestamp, addDoc, limit, getDocs, increment,
  apodoToUid, chatIdFor, hashPassword
} from './firebase.js';
import { uploadToCloudinary } from './cloudinary.js';

const SESSION_KEY = 'a404_session';

// ─────────────────────────────────────────────
// ESTADO GLOBAL
// ─────────────────────────────────────────────
let me = null;                    // {uid, nombre, apodo, fotoURL, createdAt, lastSeen}
let allUsers = {};                // uid -> profile
let usersUnsub = null;
let messagesUnsub = null;
let activeChatUid = null;
let activeChatId = null;
let replyingTo = null;
let regPhotoFile = null;
let presenceInterval = null, statusRefreshInterval = null;
let mediaRecorder = null, recordedChunks = [], recStream = null, recTimer = null, recSeconds = 0;
let msgById = {};
let chatDocUnsub = null;
let otherIsTyping = false;
let typingDebounce = null;
let searchOpen = false;
let reactingMsg = null;
const REACTION_EMOJIS = ['👍','❤️','😂','😮','😢','🙏'];

// ─────────────────────────────────────────────
// ESTADO: CÁMARA RÁPIDA / VISTA PREVIA
// ─────────────────────────────────────────────
let camStream = null;
let camFacing = 'environment';
let camRecorder = null, camChunks = [], camRecording = false, camPressTimer = null;
let capturedBlob = null, capturedType = null, capturedUrl = null;
let previewMode = 'permanente';
let ghostExpireTimers = {};
let ghostTickInterval = null;

// ─────────────────────────────────────────────
// ESTADO: MODO FANTASMA (por chat activo)
// ─────────────────────────────────────────────
let currentGhostMode = { type:'permanente' };

// ─────────────────────────────────────────────
// APARIENCIA: TEMAS Y COLOR DE BURBUJAS
// ─────────────────────────────────────────────
const THEMES = {
  dorado: { '--bg':'#030201','--bg2':'#0a0805','--bg3':'#100c07','--bg4':'#171009','--acc':'#d4af37','--acc2':'#e8c874','--acc3':'#c9a227','--acc4':'#b08d57','--fg':'#ece4d3','--fg2':'#a89878','--fg3':'#4a4030','--border':'#241f16','--border2':'#362c1c','--bubble-me':'#1c1509','--bubble-them':'#100d08' },
  oscuro: { '--bg':'#0b0b0d','--bg2':'#141416','--bg3':'#1b1b1e','--bg4':'#232326','--acc':'#c7c9cf','--acc2':'#e6e7ea','--acc3':'#9a9ca3','--acc4':'#7a7c82','--fg':'#eceef2','--fg2':'#a2a4ab','--fg3':'#5a5c63','--border':'#232326','--border2':'#33343a','--bubble-me':'#1e2024','--bubble-them':'#18191c' },
  claro:  { '--bg':'#f4efe4','--bg2':'#ffffff','--bg3':'#eee7d7','--bg4':'#e4dcc7','--acc':'#a8792f','--acc2':'#c79b4e','--acc3':'#8f6420','--acc4':'#7a5719','--fg':'#241f16','--fg2':'#5a4f3c','--fg3':'#8a7f68','--border':'#ddd3ba','--border2':'#cabf9f','--bubble-me':'#f0e2bd','--bubble-them':'#ffffff' },
  azul:   { '--bg':'#040609','--bg2':'#0a0e15','--bg3':'#10151f','--bg4':'#161d2b','--acc':'#4d9bf5','--acc2':'#7fb8fa','--acc3':'#2f7ad1','--acc4':'#2a5f9e','--fg':'#e4ecf7','--fg2':'#8fa2bd','--fg3':'#3c4d63','--border':'#16202f','--border2':'#233247','--bubble-me':'#0e1c30','--bubble-them':'#0d121a' },
  verde:  { '--bg':'#050904','--bg2':'#0b120a','--bg3':'#111a0f','--bg4':'#182417','--acc':'#5fc76b','--acc2':'#8fdd97','--acc3':'#3fa84d','--acc4':'#328a3e','--fg':'#e6f2e5','--fg2':'#93b090','--fg3':'#3e5a3c','--border':'#17241a','--border2':'#243824','--bubble-me':'#122417','--bubble-them':'#0e1610' },
  morado: { '--bg':'#08050c','--bg2':'#110b18','--bg3':'#181022','--bg4':'#20172d','--acc':'#a675e0','--acc2':'#c39ded','--acc3':'#8850c9','--acc4':'#6c3fa1','--fg':'#ece4f7','--fg2':'#a591bf','--fg3':'#4c3d63','--border':'#20172d','--border2':'#30203f','--bubble-me':'#1e1329','--bubble-them':'#160f1f' },
  rojo:   { '--bg':'#0a0403','--bg2':'#160807','--bg3':'#1e0b09','--bg4':'#2a100d','--acc':'#e05d4d','--acc2':'#f18e78','--acc3':'#c33f2e','--acc4':'#9c3123','--fg':'#f5e5e1','--fg2':'#bf938a','--fg3':'#63382f','--border':'#2a100d','--border2':'#3d1712','--bubble-me':'#291310','--bubble-them':'#1c0d0a' }
};
const THEME_LABELS = { dorado:'Dorado', oscuro:'Oscuro', claro:'Claro', azul:'Azul', verde:'Verde', morado:'Morado', rojo:'Rojo' };
const BUBBLE_PRESETS = ['#1c1509','#100d08','#0e1c30','#122417','#1e1329','#291310','#2a2a2a','#ffffff'];

// ─────────────────────────────────────────────
// BOOT
// ─────────────────────────────────────────────
const BOOT_LINES = [
  "INICIALIZANDO ARCHIVO_404 CHAT...",
  "CONECTANDO A FIRESTORE...",
  "VERIFICANDO SESIÓN...",
  "LISTO."
];
async function boot(){
  const bar = document.getElementById('boot-bar'), log = document.getElementById('boot-log');
  for(let i=0;i<BOOT_LINES.length;i++){
    const d=document.createElement('div');d.className=i===BOOT_LINES.length-1?'ok':'';
    d.textContent='> '+BOOT_LINES[i];log.appendChild(d);
    bar.style.width=((i+1)/BOOT_LINES.length*100)+'%';
    await sleep(160);
  }
  await sleep(150);
  const bs=document.getElementById('boot');
  bs.style.transition='opacity .4s';bs.style.opacity='0';
  setTimeout(()=>bs.style.display='none',400);
  await tryRestoreSession();
}
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
boot();

// ─────────────────────────────────────────────
// SESIÓN (localStorage, por dispositivo)
// ─────────────────────────────────────────────
async function tryRestoreSession(){
  const uid = localStorage.getItem(SESSION_KEY);
  if(!uid) return showAuthScreen();
  try{
    const snap = await getDoc(doc(db,'users',uid));
    if(!snap.exists()){ localStorage.removeItem(SESSION_KEY); return showAuthScreen(); }
    me = snap.data();
    startApp();
  }catch(e){ showAuthScreen(); }
}
function showAuthScreen(){
  document.getElementById('screen-app').classList.add('hidden');
  document.getElementById('screen-auth').classList.remove('hidden');
}

// ─────────────────────────────────────────────
// AUTH — UI (tabs)
// ─────────────────────────────────────────────
function switchAuthTab(tab){
  document.getElementById('tab-login').classList.toggle('act', tab==='login');
  document.getElementById('tab-register').classList.toggle('act', tab==='register');
  document.getElementById('form-login').classList.toggle('hidden', tab!=='login');
  document.getElementById('form-register').classList.toggle('hidden', tab!=='register');
  document.getElementById('login-err').textContent='';
  document.getElementById('register-err').textContent='';
}

function previewRegAvatar(input){
  const file = input.files[0]; if(!file) return;
  regPhotoFile = file;
  const img = document.getElementById('reg-avatar-preview');
  img.src = URL.createObjectURL(file);
  img.classList.remove('hidden');
  document.getElementById('reg-avatar-icon').classList.add('hidden');
}

// ─────────────────────────────────────────────
// REGISTRO
// ─────────────────────────────────────────────
async function doRegister(){
  const nombre = document.getElementById('reg-nombre').value.trim();
  const apodo  = document.getElementById('reg-apodo').value.trim();
  const pass   = document.getElementById('reg-pass').value;
  const pass2  = document.getElementById('reg-pass2').value;
  const errEl  = document.getElementById('register-err'); errEl.textContent='';

  if(!nombre || !apodo || !pass){ errEl.textContent='Completa todos los campos.'; return; }
  if(pass.length<6){ errEl.textContent='La contraseña debe tener mínimo 6 caracteres.'; return; }
  if(pass!==pass2){ errEl.textContent='Las contraseñas no coinciden.'; return; }

  let uid;
  try{ uid = apodoToUid(apodo); }catch(e){ errEl.textContent = e.message; return; }

  try{
    const existing = await getDoc(doc(db,'users',uid));
    if(existing.exists()){ errEl.textContent = 'Ese apodo ya está registrado. Elige otro o inicia sesión.'; return; }

    let fotoURL = '';
    if(regPhotoFile){
      const compressed = await compressImage(regPhotoFile);
      fotoURL = await uploadToCloudinary(compressed, 'avatar_'+uid+'.jpg');
    }
    const passHash = await hashPassword(pass);

    const profile = {
      uid, nombre, apodo, apodoLower: uid,
      passHash, fotoURL: fotoURL || '', createdAt: Date.now(), lastSeen: Date.now()
    };
    await setDoc(doc(db,'users',uid), profile);
    me = profile;
    localStorage.setItem(SESSION_KEY, uid);
    toast('Cuenta creada. ¡Bienvenido, '+nombre+'!','ok');
    startApp();
  }catch(e){ errEl.textContent = 'Error: '+e.message; }
}

// ─────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────
async function doLogin(){
  const apodo = document.getElementById('login-apodo').value.trim();
  const pass  = document.getElementById('login-pass').value;
  const errEl = document.getElementById('login-err'); errEl.textContent='';
  if(!apodo || !pass){ errEl.textContent='Ingresa tu apodo y contraseña.'; return; }

  let uid;
  try{ uid = apodoToUid(apodo); }catch(e){ errEl.textContent = e.message; return; }

  try{
    const snap = await getDoc(doc(db,'users',uid));
    if(!snap.exists()){ errEl.textContent = 'Apodo o contraseña incorrectos.'; return; }
    const profile = snap.data();
    const hash = await hashPassword(pass);
    if(hash !== profile.passHash){ errEl.textContent = 'Apodo o contraseña incorrectos.'; return; }
    me = profile;
    localStorage.setItem(SESSION_KEY, uid);
    startApp();
  }catch(e){ errEl.textContent = 'Error: '+e.message; }
}

async function doLogout(){
  if(activeChatId && me) await markChatPresence(activeChatId, me.uid, false);
  try{ if(me) await updateDoc(doc(db,'users',me.uid), { lastSeen: Date.now(), online:false }); }catch(e){}
  clearInterval(presenceInterval); clearInterval(statusRefreshInterval);
  if(ghostTickInterval){ clearInterval(ghostTickInterval); ghostTickInterval=null; }
  if(usersUnsub) usersUnsub();
  if(messagesUnsub) messagesUnsub();
  if(chatDocUnsub) chatDocUnsub();
  localStorage.removeItem(SESSION_KEY);
  me = null; activeChatUid = null; activeChatId = null;
  document.body.classList.remove('chat-open');
  showAuthScreen();
}

// ─────────────────────────────────────────────
// ARRANQUE DE LA APP (post login/registro)
// ─────────────────────────────────────────────
function startApp(){
  document.getElementById('screen-auth').classList.add('hidden');
  document.getElementById('screen-app').classList.remove('hidden');
  document.getElementById('me-name').textContent = me.nombre;
  document.getElementById('me-apodo').textContent = '@'+me.apodo;
  document.getElementById('me-avatar').src = avatarSrc(me);
  applyAppearance(me);
  setupPresence();
  listenUsers();
  setupScreenshotDetection();
  if(!ghostTickInterval) ghostTickInterval = setInterval(tickGhostExpirations, 5000);
  window.addEventListener('beforeunload', ()=>{
    if(activeChatId) markChatPresence(activeChatId, me.uid, false);
  });
}

function setupPresence(){
  updateDoc(doc(db,'users',me.uid), { lastSeen: Date.now(), online:true }).catch(()=>{});
  presenceInterval = setInterval(()=>{
    if(document.visibilityState==='visible' && me){
      updateDoc(doc(db,'users',me.uid), { lastSeen: Date.now(), online:true }).catch(()=>{});
    }
  }, 15000);
  statusRefreshInterval = setInterval(()=>{ renderContacts(); updateActiveChatHeader(); }, 10000);
  window.addEventListener('beforeunload', ()=>{
    try{ updateDoc(doc(db,'users',me.uid), { lastSeen: Date.now(), online:false }); }catch(e){}
  });
}

// ─────────────────────────────────────────────
// USUARIOS / CONTACTOS
// ─────────────────────────────────────────────
function listenUsers(){
  if(usersUnsub) usersUnsub();
  usersUnsub = onSnapshot(collection(db,'users'), (snap)=>{
    allUsers = {};
    snap.forEach(d=>{ allUsers[d.id]=d.data(); });
    renderContacts();
    updateActiveChatHeader();
  });
}

function isOnline(lastSeen){ return !!lastSeen && (Date.now()-lastSeen) < 25000; }
function fmtLastSeen(ts){
  if(!ts) return 'sin conexión registrada';
  const diff = Date.now()-ts;
  if(diff<60000) return 'hace un momento';
  if(diff<3600000) return `hace ${Math.floor(diff/60000)} min`;
  if(diff<86400000) return `hace ${Math.floor(diff/3600000)} h`;
  return new Date(ts).toLocaleDateString('es-PE',{day:'2-digit',month:'short'});
}

function avatarSrc(u){
  if(u && u.fotoURL) return u.fotoURL;
  const initial = (u && u.nombre ? u.nombre.trim()[0] : '?').toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#171009"/><text x="50%" y="54%" font-family="Cinzel,serif" font-size="32" fill="#d4af37" text-anchor="middle">${initial}</text></svg>`;
  return 'data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(svg)));
}

function renderContacts(){
  const list = document.getElementById('contact-list');
  const q = (document.getElementById('contact-search')?.value||'').toLowerCase();
  if(!list) return;
  list.innerHTML='';
  const others = Object.values(allUsers)
    .filter(u=>u.uid!==me?.uid)
    .filter(u=> (u.nombre||'').toLowerCase().includes(q) || (u.apodo||'').toLowerCase().includes(q))
    .sort((a,b)=> (isOnline(b.lastSeen)-isOnline(a.lastSeen)) || (a.nombre||'').localeCompare(b.nombre||''));

  if(!others.length){ list.innerHTML = '<div class="sc-empty">SIN CONTACTOS REGISTRADOS AÚN</div>'; return; }

  others.forEach(u=>{
    const online = isOnline(u.lastSeen);
    const el = document.createElement('div');
    el.className = 'sc-item'+(u.uid===activeChatUid?' act':'');
    el.dataset.uid = u.uid;
    el.innerHTML = `
      <img class="sc-avatar" src="${avatarSrc(u)}">
      ${online?'<span class="sc-online-dot"></span>':''}
      <div class="sc-item-body">
        <div class="sc-item-top"><span class="sc-item-name">${escapeHtml(u.nombre)}</span></div>
        <div class="sc-item-preview">${online?'en línea':'últ. vez '+fmtLastSeen(u.lastSeen)}</div>
      </div>`;
    el.onclick = ()=> openChatWith(u.uid);
    list.appendChild(el);
  });
}

// ─────────────────────────────────────────────
// CHAT — abrir / navegar
// ─────────────────────────────────────────────
function openChatWith(uid){
  const prevChatId = activeChatId;
  if(prevChatId && prevChatId !== chatIdFor(me.uid, uid)){
    markChatPresence(prevChatId, me.uid, false);
  }
  activeChatUid = uid;
  activeChatId = chatIdFor(me.uid, uid);
  document.getElementById('chat-empty').classList.add('hidden');
  document.getElementById('chat-active').classList.remove('hidden');
  document.body.classList.add('chat-open');
  cancelReply();
  searchOpen = false;
  document.getElementById('search-bar')?.classList.add('hidden');
  document.getElementById('ghost-menu')?.classList.add('hidden');
  otherIsTyping = false;
  currentGhostMode = { type:'permanente' };
  updateActiveChatHeader();
  listenMessages();
  listenChatDoc();
  markChatPresence(activeChatId, me.uid, true);
  renderContacts();
}
function backToList(){
  document.body.classList.remove('chat-open');
  if(activeChatId) markChatPresence(activeChatId, me.uid, false);
}

function listenChatDoc(){
  if(chatDocUnsub) chatDocUnsub();
  chatDocUnsub = onSnapshot(doc(db,'chats',activeChatId), (snap)=>{
    const data = snap.data();
    const typingMap = data?.typing || {};
    const ts = typingMap[activeChatUid];
    otherIsTyping = !!ts && (Date.now()-ts) < 4000;
    updateActiveChatHeader();
    currentGhostMode = (data && data.ghostMode) ? data.ghostMode : { type:'permanente' };
    updateGhostUI();
  });
}

// ─────────────────────────────────────────────
// MODO FANTASMA
// ─────────────────────────────────────────────
const GHOST_LABELS = { permanente:'', salir:'Al salir del chat', '10m':'10 minutos', '1h':'1 hora', '2h':'2 horas' };
const GHOST_MS = { '10m':10*60*1000, '1h':60*60*1000, '2h':2*60*60*1000 };

function toggleGhostMenu(){
  document.getElementById('ghost-menu').classList.toggle('hidden');
}
async function setGhostMode(type){
  document.getElementById('ghost-menu').classList.add('hidden');
  if(!activeChatId) return;
  currentGhostMode = { type, setAt: Date.now() };
  try{
    await setDoc(doc(db,'chats',activeChatId), { ghostMode: currentGhostMode }, { merge:true });
  }catch(e){ toast('Error al activar modo fantasma: '+e.message,'err'); }
  updateGhostUI();
  toast(type==='permanente' ? 'Modo Fantasma desactivado' : '👻 Modo Fantasma activado: '+GHOST_LABELS[type]);
}
function updateGhostUI(){
  const btn = document.getElementById('ghost-btn');
  const on = currentGhostMode && currentGhostMode.type && currentGhostMode.type!=='permanente';
  btn?.classList.toggle('act', !!on);
  document.querySelectorAll('#ghost-menu button').forEach(b=>{
    b.classList.toggle('act', b.dataset.mode === (currentGhostMode?.type||'permanente'));
  });
  const ind = document.getElementById('ghost-indicator');
  if(!ind) return;
  ind.classList.toggle('hidden', !on);
  document.getElementById('ghost-indicator-detail').textContent = on ? '· '+GHOST_LABELS[currentGhostMode.type] : '';
}

async function markChatPresence(chatId, uid, present){
  try{
    await setDoc(doc(db,'chats',chatId), { presence:{ [uid]: present } }, { merge:true });
    if(!present) await maybeCleanupGhostOnExit(chatId);
  }catch(e){}
}
async function maybeCleanupGhostOnExit(chatId){
  try{
    const snap = await getDoc(doc(db,'chats',chatId));
    const data = snap.data(); if(!data) return;
    const presence = data.presence || {};
    const participants = data.participants || [];
    const anyoneInside = participants.some(uid=> presence[uid]===true);
    if(anyoneInside) return;
    const q = query(collection(db,'chats',chatId,'messages'), where('ghostType','==','salir'));
    const msnap = await getDocs(q);
    msnap.forEach(d=>{ deleteDoc(doc(db,'chats',chatId,'messages',d.id)).catch(()=>{}); });
  }catch(e){}
}
function tickGhostExpirations(){
  if(!activeChatId) return;
  const now = Date.now();
  Object.values(msgById).forEach(m=>{
    if(m.expireAt && m.expireAt <= now){
      deleteDoc(doc(db,'chats',activeChatId,'messages',m.id)).catch(()=>{});
    }
  });
}

function updateActiveChatHeader(){
  if(!activeChatUid) return;
  const u = allUsers[activeChatUid]; if(!u) return;
  document.getElementById('ch-avatar').src = avatarSrc(u);
  document.getElementById('ch-name').textContent = u.nombre;
  const st = document.getElementById('ch-status');
  if(otherIsTyping){
    st.textContent = 'escribiendo...';
    st.classList.add('online');
    return;
  }
  const online = isOnline(u.lastSeen);
  st.textContent = online ? 'en línea' : 'últ. vez ' + fmtLastSeen(u.lastSeen);
  st.classList.toggle('online', online);
}

function handleTypingInput(){
  if(!activeChatId) return;
  setDoc(doc(db,'chats',activeChatId), { [`typing.${me.uid}`]: Date.now() }, { merge:true }).catch(()=>{});
  clearTimeout(typingDebounce);
  typingDebounce = setTimeout(()=>{
    setDoc(doc(db,'chats',activeChatId), { [`typing.${me.uid}`]: 0 }, { merge:true }).catch(()=>{});
  }, 3000);
}

// ─────────────────────────────────────────────
// MENSAJES
// Esquema: { senderId, type, text|null, mediaUrl|null, timestamp, replyTo|null }
// ─────────────────────────────────────────────
function listenMessages(){
  if(messagesUnsub) messagesUnsub();
  const q = query(collection(db,'chats',activeChatId,'messages'), orderBy('timestamp','asc'), limit(300));
  messagesUnsub = onSnapshot(q, (snap)=>{
    msgById = {};
    const box = document.getElementById('messages');
    const wasNearBottom = (box.scrollHeight - box.scrollTop - box.clientHeight) < 120;
    box.innerHTML='';
    const toMarkRead = [];
    snap.forEach(d=>{
      const m = d.data(); m.id = d.id; msgById[d.id]=m;
      box.appendChild(renderMessageEl(m));
      if(m.senderId!==me.uid && !m.read && !m.deleted) toMarkRead.push(d.id);
    });
    if(wasNearBottom) box.scrollTop = box.scrollHeight;
    if(searchOpen) filterMessages();
    toMarkRead.forEach(id=>{
      updateDoc(doc(db,'chats',activeChatId,'messages',id), { read:true }).catch(()=>{});
    });
  });
}

function toggleSearch(){
  searchOpen = !searchOpen;
  document.getElementById('search-bar').classList.toggle('hidden', !searchOpen);
  const inp = document.getElementById('search-input');
  inp.value='';
  if(searchOpen) inp.focus();
  filterMessages();
}
function filterMessages(){
  const q = (document.getElementById('search-input')?.value||'').toLowerCase().trim();
  document.querySelectorAll('#messages .msg').forEach(el=>{
    if(!q){ el.style.display=''; return; }
    el.style.display = el.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
}

function previewForType(m){
  if(m.type==='text') return m.text;
  if(m.type==='image') return '📷 Foto';
  if(m.type==='video') return '🎬 Video';
  if(m.type==='audio') return '🎤 Audio';
  return '';
}

function renderMessageEl(m){
  const mine = m.senderId===me.uid;
  const wrap = document.createElement('div');
  wrap.className = 'msg '+(mine?'me':'them');
  wrap.dataset.msgid = m.id;

  let inner = '';

  if(m.deleted){
    inner = `<div class="msg-deleted">🚫 Mensaje eliminado</div>`;
  }else{
    if(m.replyTo){
      inner += `<div class="quote" data-jump="${m.replyTo.id}">
        <div class="quote-name">${escapeHtml(m.replyTo.senderName)}</div>
        <div class="quote-text">${escapeHtml(m.replyTo.preview||'')}</div>
      </div>`;
    }
    if(m.type==='text'){
      inner += `<div>${escapeHtml(m.text||'')}</div>`;
    }else if(m.type==='image' || m.type==='video'){
      if(m.viewOnce){
        if(m.opened){
          inner += `<div class="vo-seen">👁 ${m.type==='image'?'Foto':'Video'} vista${m.openedBy && m.openedBy!==me.uid ? '' : ''}</div>`;
        }else if(mine){
          inner += `<div class="vo-wrap"><span class="vo-badge">🔥 VER UNA VEZ</span>
            <div class="vo-lock"><span class="vo-lock-i">${m.type==='image'?'📷':'🎬'}</span><span class="vo-lock-t">Enviada — se verá una sola vez</span></div></div>`;
        }else{
          inner += `<div class="vo-lock" data-openonce="${m.id}"><span class="vo-lock-i">🔥</span><span class="vo-lock-t">Toca para ver — solo una vez</span></div>`;
        }
      }else if(m.viewTwice){
        const count = m.viewCount||0;
        if(count>=2){
          inner += `<div class="vt-seen">👁👁 ${m.type==='image'?'Foto':'Video'} expirada</div>`;
        }else if(mine){
          inner += `<div class="vo-wrap"><span class="vo-badge">👁👁 VER 2 VECES</span>
            <div class="vo-lock"><span class="vo-lock-i">${m.type==='image'?'📷':'🎬'}</span><span class="vo-lock-t">Enviada — se verá 2 veces (${count}/2)</span></div></div>`;
        }else{
          inner += `<div class="vo-lock" data-opentwice="${m.id}"><span class="vo-lock-i">👁👁</span><span class="vo-lock-t">Toca para ver — quedan ${2-count} vez(es)</span></div>`;
        }
      }else if(m.type==='image'){
        inner += `<img class="msg-img" src="${m.mediaUrl}" data-view="${m.mediaUrl}" data-vtype="image">`;
      }else{
        inner += `<video class="msg-vid" src="${m.mediaUrl}" controls></video>`;
      }
    }else if(m.type==='audio'){
      inner += `<audio class="msg-aud" src="${m.mediaUrl}" controls></audio>`;
    }
  }

  const time = m.timestamp && m.timestamp.toDate ? m.timestamp.toDate() : (m.timestamp ? new Date(m.timestamp) : new Date());
  const timeStr = time.toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'});
  const editedTag = (m.edited && !m.deleted) ? ' <span class="msg-edited">(editado)</span>' : '';
  const checks = (mine && !m.deleted) ? `<span class="msg-check ${m.read?'read':''}">${m.read?'✓✓':'✓'}</span>` : '';

  wrap.innerHTML = `
    <div class="msg-row-inline">
      <div class="bubble">${inner}</div>
    </div>
    ${renderReactionsHtml(m)}
    <div style="display:flex;align-items:center;gap:6px;">
      <span class="msg-time">${timeStr}${editedTag}</span>
      ${checks}
      <span class="msg-reply-actions">
        ${m.deleted?'':'<button class="msg-reply-btn" title="Responder">↩</button>'}
        ${(m.deleted)?'':'<button class="msg-react-btn" title="Reaccionar">😊</button>'}
        ${(mine && m.type==='text' && !m.deleted)?'<button class="msg-edit-btn" title="Editar">✏️</button>':''}
        ${(mine && !m.deleted)?'<button class="msg-del-btn" title="Eliminar">🗑</button>':''}
      </span>
    </div>`;

  const replyBtn = wrap.querySelector('.msg-reply-btn');
  if(replyBtn) replyBtn.onclick = ()=> setReply(m.id, mine?'Tú':(allUsers[m.senderId]?.nombre||'Operador'), m.type, previewForType(m));
  const delBtn = wrap.querySelector('.msg-del-btn');
  if(delBtn) delBtn.onclick = ()=> deleteMessage(m.id);
  const editBtn = wrap.querySelector('.msg-edit-btn');
  if(editBtn) editBtn.onclick = ()=> editMessage(m);
  const reactBtn = wrap.querySelector('.msg-react-btn');
  if(reactBtn) reactBtn.onclick = (ev)=> openReactionPicker(ev, m);
  const img = wrap.querySelector('[data-view]');
  if(img) img.onclick = ()=> openLightboxUrl(img.dataset.view, img.dataset.vtype);
  const quote = wrap.querySelector('.quote');
  if(quote) quote.onclick = ()=> scrollToMessage(quote.dataset.jump);
  const voLock = wrap.querySelector('[data-openonce]');
  if(voLock) voLock.onclick = ()=> openViewOnce(m);
  const vtLock = wrap.querySelector('[data-opentwice]');
  if(vtLock) vtLock.onclick = ()=> openViewTwice(m);
  wrap.querySelectorAll('.reaction-pill').forEach(p=>{
    p.onclick = ()=> toggleReaction(m, p.dataset.emoji);
  });

  return wrap;
}

function renderReactionsHtml(m){
  if(!m.reactions) return '';
  const counts = {};
  Object.values(m.reactions).forEach(e=>{ counts[e]=(counts[e]||0)+1; });
  const entries = Object.entries(counts);
  if(!entries.length) return '';
  return `<div class="reactions-row">${entries.map(([e,c])=>`<span class="reaction-pill" data-emoji="${e}">${e}${c>1?' '+c:''}</span>`).join('')}</div>`;
}

function openReactionPicker(ev, m){
  reactingMsg = m;
  const picker = document.getElementById('reaction-picker');
  const r = ev.currentTarget.getBoundingClientRect();
  picker.style.left = Math.max(8, Math.min(window.innerWidth-260, r.left-80))+'px';
  picker.style.top = Math.max(8, r.top-46)+'px';
  picker.classList.remove('hidden');
}
function pickReaction(emoji){
  if(reactingMsg) toggleReaction(reactingMsg, emoji);
  document.getElementById('reaction-picker').classList.add('hidden');
}
async function toggleReaction(m, emoji){
  const current = m.reactions ? m.reactions[me.uid] : null;
  const newReactions = { ...(m.reactions||{}) };
  if(current===emoji) delete newReactions[me.uid];
  else newReactions[me.uid] = emoji;
  try{
    await updateDoc(doc(db,'chats',activeChatId,'messages',m.id), { reactions:newReactions });
  }catch(e){ toast('Error al reaccionar: '+e.message,'err'); }
}

async function editMessage(m){
  const newText = prompt('Editar mensaje:', m.text||'');
  if(newText===null) return;
  const trimmed = newText.trim();
  if(!trimmed) return;
  try{
    await updateDoc(doc(db,'chats',activeChatId,'messages',m.id), { text: trimmed, edited: true });
  }catch(e){ toast('Error al editar: '+e.message,'err'); }
}

async function openViewOnce(m){
  openLightboxUrl(m.mediaUrl, m.type);
  try{
    await updateDoc(doc(db,'chats',activeChatId,'messages',m.id), { opened:true, openedBy: me.uid });
  }catch(e){ toast('Error al marcar como visto: '+e.message,'err'); }
}

async function openViewTwice(m){
  openLightboxUrl(m.mediaUrl, m.type);
  try{
    await updateDoc(doc(db,'chats',activeChatId,'messages',m.id), {
      viewCount: increment(1), openedBy: me.uid
    });
  }catch(e){ toast('Error al marcar como visto: '+e.message,'err'); }
}

async function deleteMessage(id){
  if(!confirm('¿Eliminar este mensaje? Esta acción no se puede deshacer.')) return;
  try{
    await updateDoc(doc(db,'chats',activeChatId,'messages',id), {
      deleted:true, text:null, mediaUrl:null, viewOnce:false, viewTwice:false
    });
  }catch(e){ toast('Error al eliminar: '+e.message,'err'); }
}

function scrollToMessage(id){
  const el = document.querySelector(`.msg[data-msgid="${id}"]`);
  if(!el) return;
  el.scrollIntoView({behavior:'smooth', block:'center'});
  el.style.transition='background .3s';
  el.style.background='rgba(212,175,55,.15)';
  setTimeout(()=>{ el.style.background=''; }, 700);
}

function setReply(id, senderName, type, previewText){
  replyingTo = { id, senderName, type, preview: (previewText||'').slice(0,80) };
  document.getElementById('reply-bar').classList.remove('hidden');
  document.getElementById('reply-bar-to').textContent = 'Respondiendo a '+senderName;
  document.getElementById('reply-bar-preview').textContent = replyingTo.preview;
}
function cancelReply(){
  replyingTo = null;
  document.getElementById('reply-bar').classList.add('hidden');
}

async function sendMessage(payload){
  if(!activeChatId) return;
  const data = {
    senderId: me.uid,
    type: payload.type,
    text: payload.type==='text' ? (payload.text||'') : null,
    mediaUrl: payload.mediaUrl || null,
    timestamp: serverTimestamp(),
    replyTo: replyingTo ? { ...replyingTo } : null,
    deleted: false
  };
  if(payload.viewOnce){ data.viewOnce = true; data.opened = false; }
  if(payload.viewTwice){ data.viewTwice = true; data.viewCount = 0; }
  if(currentGhostMode && currentGhostMode.type && currentGhostMode.type!=='permanente'){
    data.ghostType = currentGhostMode.type;
    if(GHOST_MS[currentGhostMode.type]) data.expireAt = Date.now() + GHOST_MS[currentGhostMode.type];
  }
  await addDoc(collection(db,'chats',activeChatId,'messages'), data);
  await setDoc(doc(db,'chats',activeChatId), {
    participants: [me.uid, activeChatUid],
    lastMessage: previewForType(data),
    lastMessageAt: Date.now()
  }, { merge:true });
  cancelReply();
}

function sendText(){
  const inp = document.getElementById('msg-input');
  const val = inp.value.trim();
  if(!val) return;
  inp.value='';
  sendMessage({ type:'text', text: val }).catch(e=>toast('Error al enviar: '+e.message,'err'));
}

// ─────────────────────────────────────────────
// COMPRESIÓN DE IMÁGENES (antes de subir a Cloudinary)
// ─────────────────────────────────────────────
function compressImage(file, maxDim=1600, quality=0.82){
  return new Promise((resolve)=>{
    if(!file || !file.type || !file.type.startsWith('image/') || file.type==='image/gif'){ resolve(file); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = ()=>{
      let { width, height } = img;
      if(width>maxDim || height>maxDim){
        const scale = maxDim/Math.max(width,height);
        width = Math.round(width*scale); height = Math.round(height*scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width=width; canvas.height=height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img,0,0,width,height);
      canvas.toBlob(blob=>{
        URL.revokeObjectURL(url);
        resolve(blob || file);
      }, 'image/jpeg', quality);
    };
    img.onerror = ()=>{ URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

// ─────────────────────────────────────────────
// ARCHIVOS: imagen / video (subidos a Cloudinary)
// ─────────────────────────────────────────────
function toggleAttachMenu(){ document.getElementById('attach-menu').classList.toggle('hidden'); }
function triggerFile(type){
  document.getElementById('attach-menu').classList.add('hidden');
  document.getElementById('file-'+type).click();
}
async function sendFile(input, type){
  const file = input.files[0]; if(!file || !activeChatId) return;
  input.value='';
  toast('Subiendo '+(type==='image'?'imagen':'video')+' a Cloudinary...','ok');
  try{
    const toUpload = type==='image' ? await compressImage(file) : file;
    const mediaUrl = type==='image'
      ? await uploadToCloudinary(toUpload, 'foto_'+Date.now()+'.jpg')
      : await uploadToCloudinary(toUpload);
    await sendMessage({ type, mediaUrl });
  }catch(e){ toast('Error al subir archivo: '+e.message,'err'); }
}

// ─────────────────────────────────────────────
// AUDIO — grabación (subida a Cloudinary)
// ─────────────────────────────────────────────
async function startRecording(){
  if(!activeChatId) return;
  try{
    recStream = await navigator.mediaDevices.getUserMedia({ audio:true });
  }catch(e){ toast('No se pudo acceder al micrófono','err'); return; }
  recordedChunks=[];
  mediaRecorder = new MediaRecorder(recStream);
  mediaRecorder.ondataavailable = e=>{ if(e.data.size>0) recordedChunks.push(e.data); };
  mediaRecorder.start();
  recSeconds=0;
  document.getElementById('rec-time').textContent='00:00';
  document.getElementById('rec-bar').classList.remove('hidden');
  document.getElementById('input-row').classList.add('hidden');
  recTimer = setInterval(()=>{
    recSeconds++;
    const m=String(Math.floor(recSeconds/60)).padStart(2,'0'), s=String(recSeconds%60).padStart(2,'0');
    document.getElementById('rec-time').textContent=`${m}:${s}`;
  },1000);
}
function stopRecordingUI(){
  clearInterval(recTimer);
  document.getElementById('rec-bar').classList.add('hidden');
  document.getElementById('input-row').classList.remove('hidden');
  if(recStream){ recStream.getTracks().forEach(t=>t.stop()); recStream=null; }
}
function cancelRecording(){
  if(mediaRecorder && mediaRecorder.state!=='inactive'){
    mediaRecorder.onstop = null;
    mediaRecorder.stop();
  }
  stopRecordingUI();
}
function stopAndSendRecording(){
  if(!mediaRecorder || mediaRecorder.state==='inactive') return;
  mediaRecorder.onstop = async ()=>{
    stopRecordingUI();
    if(!recordedChunks.length) return;
    const blob = new Blob(recordedChunks, { type:'audio/webm' });
    toast('Subiendo audio a Cloudinary...','ok');
    try{
      const mediaUrl = await uploadToCloudinary(blob, `audio_${Date.now()}.webm`);
      await sendMessage({ type:'audio', mediaUrl });
    }catch(e){ toast('Error al subir audio: '+e.message,'err'); }
  };
  mediaRecorder.stop();
}

// ─────────────────────────────────────────────
// CÁMARA RÁPIDA (captura directa, sin explorador de archivos)
// ─────────────────────────────────────────────
async function openQuickCamera(){
  if(!activeChatId) return;
  document.getElementById('camera-overlay').classList.remove('hidden');
  document.getElementById('camera-overlay').classList.add('on');
  await startCamStream();
  bindShutterEvents();
}
async function startCamStream(){
  stopCamStream();
  try{
    camStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: camFacing }, audio: true
    });
  }catch(e){
    try{ camStream = await navigator.mediaDevices.getUserMedia({ video:true, audio:true }); }
    catch(e2){ toast('No se pudo acceder a la cámara','err'); closeQuickCamera(); return; }
  }
  const video = document.getElementById('cam-video');
  video.srcObject = camStream;
}
function stopCamStream(){
  if(camStream){ camStream.getTracks().forEach(t=>t.stop()); camStream=null; }
}
async function flipCamera(){
  camFacing = camFacing==='environment' ? 'user' : 'environment';
  await startCamStream();
}
function closeQuickCamera(){
  if(camRecording) stopCamRecording(true);
  stopCamStream();
  document.getElementById('camera-overlay').classList.remove('on');
  document.getElementById('camera-overlay').classList.add('hidden');
  document.getElementById('cam-rec-time').classList.add('hidden');
}

let camRecSeconds = 0, camRecTimerInt = null;
function bindShutterEvents(){
  const btn = document.getElementById('cam-shutter');
  if(btn.dataset.bound) return;
  btn.dataset.bound = '1';
  const onDown = (e)=>{
    e.preventDefault();
    camPressTimer = setTimeout(()=> startCamRecording(), 350);
  };
  const onUp = (e)=>{
    e.preventDefault();
    if(camPressTimer){ clearTimeout(camPressTimer); camPressTimer=null; }
    if(camRecording) stopCamRecording(false);
    else if(!camRecording && !btn.dataset.justRecorded) takePhoto();
    btn.dataset.justRecorded = '';
  };
  btn.addEventListener('pointerdown', onDown);
  btn.addEventListener('pointerup', onUp);
  btn.addEventListener('pointerleave', ()=>{ if(camPressTimer){ clearTimeout(camPressTimer); camPressTimer=null; } });
}
function takePhoto(){
  const video = document.getElementById('cam-video');
  if(!video.videoWidth) return;
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth; canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video,0,0);
  canvas.toBlob(blob=>{
    if(!blob) return;
    showCapturePreview(blob, 'image');
  }, 'image/jpeg', .9);
}
function startCamRecording(){
  if(!camStream) return;
  camRecording = true;
  document.getElementById('cam-shutter').classList.add('recording');
  document.getElementById('cam-shutter').dataset.justRecorded = '1';
  camChunks = [];
  try{
    camRecorder = new MediaRecorder(camStream);
  }catch(e){ camRecording=false; return; }
  camRecorder.ondataavailable = e=>{ if(e.data.size>0) camChunks.push(e.data); };
  camRecorder.start();
  camRecSeconds = 0;
  const timeEl = document.getElementById('cam-rec-time');
  timeEl.classList.remove('hidden');
  timeEl.textContent = '● 00:00';
  camRecTimerInt = setInterval(()=>{
    camRecSeconds++;
    const m=String(Math.floor(camRecSeconds/60)).padStart(2,'0'), s=String(camRecSeconds%60).padStart(2,'0');
    timeEl.textContent = `● ${m}:${s}`;
  },1000);
}
function stopCamRecording(discard){
  if(!camRecorder || camRecorder.state==='inactive') return;
  clearInterval(camRecTimerInt);
  document.getElementById('cam-shutter').classList.remove('recording');
  document.getElementById('cam-rec-time').classList.add('hidden');
  camRecorder.onstop = ()=>{
    camRecording = false;
    if(discard || !camChunks.length) return;
    const blob = new Blob(camChunks, { type:'video/webm' });
    showCapturePreview(blob, 'video');
  };
  camRecorder.stop();
}

// ─────────────────────────────────────────────
// VISTA PREVIA ANTES DE ENVIAR (foto/video de cámara rápida)
// ─────────────────────────────────────────────
function showCapturePreview(blob, type){
  capturedBlob = blob; capturedType = type;
  if(capturedUrl) URL.revokeObjectURL(capturedUrl);
  capturedUrl = URL.createObjectURL(blob);
  const wrap = document.getElementById('preview-media-wrap');
  wrap.innerHTML = type==='image'
    ? `<img src="${capturedUrl}">`
    : `<video src="${capturedUrl}" controls autoplay loop></video>`;
  previewMode = 'permanente';
  document.querySelectorAll('input[name="preview-mode"]').forEach(r=>{ r.checked = r.value==='permanente'; });
  stopCamStream();
  document.getElementById('camera-overlay').classList.remove('on');
  document.getElementById('camera-overlay').classList.add('hidden');
  document.getElementById('preview-overlay').classList.remove('hidden');
  document.getElementById('preview-overlay').classList.add('on');
}
function setPreviewMode(mode){ previewMode = mode; }
function cancelCapturePreview(){
  capturedBlob = null; capturedType = null;
  if(capturedUrl){ URL.revokeObjectURL(capturedUrl); capturedUrl=null; }
  document.getElementById('preview-media-wrap').innerHTML='';
  document.getElementById('preview-overlay').classList.remove('on');
  document.getElementById('preview-overlay').classList.add('hidden');
}
async function sendCapturePreview(){
  if(!capturedBlob || !activeChatId) return;
  const blob = capturedBlob, type = capturedType, mode = previewMode;
  cancelCapturePreview();
  toast('Subiendo '+(type==='image'?'foto':'video')+' a Cloudinary...','ok');
  try{
    const toUpload = type==='image' ? await compressImage(blob) : blob;
    const mediaUrl = type==='image'
      ? await uploadToCloudinary(toUpload, 'foto_'+Date.now()+'.jpg')
      : await uploadToCloudinary(toUpload, 'video_'+Date.now()+'.webm');
    const payload = { type, mediaUrl };
    if(mode==='once'){ payload.viewOnce = true; }
    else if(mode==='twice'){ payload.viewTwice = true; }
    await sendMessage(payload);
  }catch(e){ toast('Error al subir archivo: '+e.message,'err'); }
}


// ─────────────────────────────────────────────
// PERFIL
// ─────────────────────────────────────────────
function openProfile(which){
  const u = which==='me' ? me : allUsers[activeChatUid];
  if(!u) return;
  document.getElementById('profile-avatar').src = avatarSrc(u);
  document.getElementById('profile-name').textContent = u.nombre;
  document.getElementById('profile-apodo').textContent = '@'+u.apodo;
  const online = isOnline(u.lastSeen);
  document.getElementById('profile-status').textContent = online ? '● en línea' : 'últ. vez '+fmtLastSeen(u.lastSeen);
  document.getElementById('profile-since').textContent = u.createdAt ? 'Miembro desde '+new Date(u.createdAt).toLocaleDateString('es-PE',{day:'2-digit',month:'long',year:'numeric'}) : '';
  const wrap = document.getElementById('profile-avatar-wrap');
  wrap.onclick = which==='me' ? ()=>document.getElementById('profile-photo-input').click() : null;
  wrap.style.cursor = which==='me' ? 'pointer' : 'default';
  document.getElementById('profile-overlay').classList.add('on');
}
function closeProfile(){ document.getElementById('profile-overlay').classList.remove('on'); }

async function uploadMyPhoto(input){
  const file = input.files[0]; if(!file) return;
  input.value='';
  toast('Subiendo foto a Cloudinary...','ok');
  try{
    const compressed = await compressImage(file);
    const url = await uploadToCloudinary(compressed, 'avatar_'+me.uid+'_'+Date.now()+'.jpg');
    await updateDoc(doc(db,'users',me.uid), { fotoURL:url });
    me.fotoURL = url;
    document.getElementById('me-avatar').src = url;
    document.getElementById('profile-avatar').src = url;
    toast('Foto de perfil actualizada','ok');
  }catch(e){ toast('Error al subir foto: '+e.message,'err'); }
}

// ─────────────────────────────────────────────
// LIGHTBOX
// ─────────────────────────────────────────────
function openLightboxUrl(url, type){
  const m = document.getElementById('lb-media');
  m.innerHTML = type==='video' ? `<video src="${url}" controls autoplay></video>` : `<img src="${url}">`;
  document.getElementById('lightbox').classList.add('on');
}
function closeLightbox(){
  document.getElementById('lightbox').classList.remove('on');
  const v = document.querySelector('#lb-media video'); if(v) v.pause();
  document.getElementById('lb-media').innerHTML='';
}

// ─────────────────────────────────────────────
// CAPTURA DE PANTALLA (mejor esfuerzo — la mayoría de navegadores
// no exponen una API para detectarla; se deja el código preparado
// para plataformas/apps nativas que sí lo permitan en el futuro).
// ─────────────────────────────────────────────
function setupScreenshotDetection(){
  // Atajo de teclado (Windows/Linux desktop) — mejor esfuerzo, no 100% fiable.
  document.addEventListener('keyup', (e)=>{
    if(e.key==='PrintScreen') notifyScreenshotTaken();
  });
  // Punto de extensión: si la plataforma (app nativa / wrapper) expone un
  // evento o API para detectar capturas, puede llamar a esta función:
  window.a404OnScreenshotDetected = notifyScreenshotTaken;
}
async function notifyScreenshotTaken(){
  if(!activeChatId || !me) return;
  try{
    await sendMessage({ type:'text', text: '⚠️ '+me.nombre+' realizó una captura de pantalla.' });
  }catch(e){}
}

// ─────────────────────────────────────────────
// APARIENCIA: TEMAS Y COLOR DE BURBUJAS
// (Solo visual, por usuario — no afecta a los demás participantes.)
// ─────────────────────────────────────────────
function applyAppearance(profile){
  const themeName = (profile && THEMES[profile.theme]) ? profile.theme : 'dorado';
  const vars = THEMES[themeName];
  const root = document.documentElement.style;
  Object.entries(vars).forEach(([k,v])=> root.setProperty(k, v));
  if(profile && profile.bubbleMe) root.setProperty('--bubble-me', profile.bubbleMe);
  if(profile && profile.bubbleThem) root.setProperty('--bubble-them', profile.bubbleThem);
}

function openSettings(){
  renderThemeGrid();
  renderBubbleRow('bubble-me-row', 'bubbleMe');
  renderBubbleRow('bubble-them-row', 'bubbleThem');
  document.getElementById('settings-overlay').classList.add('on');
}
function closeSettings(){ document.getElementById('settings-overlay').classList.remove('on'); }

function renderThemeGrid(){
  const grid = document.getElementById('theme-grid');
  const active = (me && me.theme) || 'dorado';
  grid.innerHTML = Object.keys(THEMES).map(name=>{
    const v = THEMES[name];
    return `<div class="theme-item">
      <div class="theme-swatch${name===active?' act':''}" data-theme="${name}"
        style="background:linear-gradient(135deg, ${v['--bg2']} 50%, ${v['--acc']} 50%)">
        ${name===active?'<span class="theme-swatch-check">✓</span>':''}
      </div>
      <span class="theme-swatch-label">${THEME_LABELS[name]}</span>
    </div>`;
  }).join('');
  grid.querySelectorAll('.theme-swatch').forEach(el=>{
    el.onclick = ()=> selectTheme(el.dataset.theme);
  });
}
async function selectTheme(name){
  if(!THEMES[name]) return;
  me.theme = name;
  applyAppearance(me);
  renderThemeGrid();
  try{ await updateDoc(doc(db,'users',me.uid), { theme: name }); }
  catch(e){ toast('Error al guardar el tema: '+e.message,'err'); }
}
function renderBubbleRow(containerId, field){
  const row = document.getElementById(containerId);
  const active = me ? me[field] : null;
  row.innerHTML = BUBBLE_PRESETS.map(c=>
    `<div class="bubble-swatch${active===c?' act':''}" data-color="${c}" style="background:${c}"></div>`
  ).join('') + `<input type="color" class="bubble-custom-input" title="Color personalizado" value="${active||'#1c1509'}">`;
  row.querySelectorAll('.bubble-swatch').forEach(el=>{
    el.onclick = ()=> selectBubbleColor(field, el.dataset.color);
  });
  const custom = row.querySelector('.bubble-custom-input');
  custom.oninput = ()=> selectBubbleColor(field, custom.value);
}
async function selectBubbleColor(field, color){
  me[field] = color;
  applyAppearance(me);
  renderBubbleRow(field==='bubbleMe' ? 'bubble-me-row' : 'bubble-them-row', field);
  try{ await updateDoc(doc(db,'users',me.uid), { [field]: color }); }
  catch(e){ toast('Error al guardar el color: '+e.message,'err'); }
}
async function resetAppearance(){
  me.theme = 'dorado'; me.bubbleMe = null; me.bubbleThem = null;
  applyAppearance(me);
  renderThemeGrid();
  renderBubbleRow('bubble-me-row','bubbleMe');
  renderBubbleRow('bubble-them-row','bubbleThem');
  try{ await updateDoc(doc(db,'users',me.uid), { theme:'dorado', bubbleMe:null, bubbleThem:null }); }
  catch(e){ toast('Error al restaurar: '+e.message,'err'); }
  toast('Apariencia restaurada a los valores originales','ok');
}

// ─────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────
function toast(msg,type=''){
  const c=document.getElementById('toasts'); if(!c) return;
  const t=document.createElement('div'); t.className='toast '+(type==='err'?'err':''); t.textContent=msg;
  c.appendChild(t); setTimeout(()=>t.remove(),3200);
}
function escapeHtml(s){
  return String(s||'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

// ─────────────────────────────────────────────
// EVENTOS ADICIONALES
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', ()=>{
  document.getElementById('login-pass')?.addEventListener('keypress', e=>{ if(e.key==='Enter') doLogin(); });
  document.getElementById('login-apodo')?.addEventListener('keypress', e=>{ if(e.key==='Enter') doLogin(); });
  document.getElementById('reg-pass2')?.addEventListener('keypress', e=>{ if(e.key==='Enter') doRegister(); });
  document.getElementById('msg-input')?.addEventListener('keypress', e=>{ if(e.key==='Enter') sendText(); });
  document.getElementById('msg-input')?.addEventListener('input', handleTypingInput);
  const picker = document.getElementById('reaction-picker');
  if(picker){
    picker.innerHTML = REACTION_EMOJIS.map(e=>`<button onclick="pickReaction('${e}')">${e}</button>`).join('');
  }
  document.addEventListener('click', (e)=>{
    const menu = document.getElementById('attach-menu');
    if(menu && !menu.classList.contains('hidden')){
      if(!menu.contains(e.target) && !e.target.closest('.input-row button[onclick*="toggleAttachMenu"]')){
        menu.classList.add('hidden');
      }
    }
    const picker = document.getElementById('reaction-picker');
    if(picker && !picker.classList.contains('hidden')){
      if(!picker.contains(e.target) && !e.target.closest('.msg-react-btn')){
        picker.classList.add('hidden');
      }
    }
    const ghostMenu = document.getElementById('ghost-menu');
    if(ghostMenu && !ghostMenu.classList.contains('hidden')){
      if(!ghostMenu.contains(e.target) && !e.target.closest('#ghost-btn')){
        ghostMenu.classList.add('hidden');
      }
    }
  });
});

// ─────────────────────────────────────────────
// EXPONER AL SCOPE GLOBAL (usado por onclick= en el HTML)
// ─────────────────────────────────────────────
Object.assign(window, {
  switchAuthTab, doLogin, doRegister, doLogout, previewRegAvatar,
  openChatWith, backToList, sendText, sendFile, triggerFile, toggleAttachMenu,
  startRecording, cancelRecording, stopAndSendRecording,
  openProfile, closeProfile, uploadMyPhoto,
  openLightboxUrl, closeLightbox, cancelReply, renderContacts,
  deleteMessage, openViewOnce, openViewTwice,
  toggleSearch, filterMessages, editMessage, pickReaction,
  openQuickCamera, closeQuickCamera, flipCamera,
  setPreviewMode, cancelCapturePreview, sendCapturePreview,
  toggleGhostMenu, setGhostMode,
  openSettings, closeSettings, selectTheme, selectBubbleColor, resetAppearance
});
