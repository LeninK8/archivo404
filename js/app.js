// ════════════════════════════════════════════════════════════
//  ARCHIVO 404 — CHAT · Lógica principal
//  Firestore: usuarios, chats, mensajes, estados, perfiles.
//  Cloudinary: TODO el almacenamiento de archivos multimedia.
//  (Firebase Storage fue eliminado por completo del proyecto.)
// ════════════════════════════════════════════════════════════
import {
  db, doc, setDoc, getDoc, updateDoc, collection,
  query, orderBy, onSnapshot, serverTimestamp, addDoc, limit,
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
let viewOnceMode = false;
let chatDocUnsub = null;
let otherIsTyping = false;
let typingDebounce = null;
let searchOpen = false;
let reactingMsg = null;
const REACTION_EMOJIS = ['👍','❤️','😂','😮','😢','🙏'];

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
  try{ if(me) await updateDoc(doc(db,'users',me.uid), { lastSeen: Date.now(), online:false }); }catch(e){}
  clearInterval(presenceInterval); clearInterval(statusRefreshInterval);
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
  setupPresence();
  listenUsers();
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
  activeChatUid = uid;
  activeChatId = chatIdFor(me.uid, uid);
  document.getElementById('chat-empty').classList.add('hidden');
  document.getElementById('chat-active').classList.remove('hidden');
  document.body.classList.add('chat-open');
  cancelReply();
  searchOpen = false;
  document.getElementById('search-bar')?.classList.add('hidden');
  otherIsTyping = false;
  updateActiveChatHeader();
  listenMessages();
  listenChatDoc();
  renderContacts();
}
function backToList(){ document.body.classList.remove('chat-open'); }

function listenChatDoc(){
  if(chatDocUnsub) chatDocUnsub();
  chatDocUnsub = onSnapshot(doc(db,'chats',activeChatId), (snap)=>{
    const data = snap.data();
    const typingMap = data?.typing || {};
    const ts = typingMap[activeChatUid];
    otherIsTyping = !!ts && (Date.now()-ts) < 4000;
    updateActiveChatHeader();
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

async function deleteMessage(id){
  if(!confirm('¿Eliminar este mensaje? Esta acción no se puede deshacer.')) return;
  try{
    await updateDoc(doc(db,'chats',activeChatId,'messages',id), {
      deleted:true, text:null, mediaUrl:null, viewOnce:false
    });
  }catch(e){ toast('Error al eliminar: '+e.message,'err'); }
}

function toggleViewOnceMode(){
  viewOnceMode = !viewOnceMode;
  document.getElementById('viewonce-btn').classList.toggle('act', viewOnceMode);
  toast(viewOnceMode ? '🔥 La próxima foto/video se enviará para verse una sola vez' : 'Modo "ver una vez" desactivado');
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
  const asViewOnce = viewOnceMode;
  if(viewOnceMode){ viewOnceMode=false; document.getElementById('viewonce-btn').classList.remove('act'); }
  toast('Subiendo '+(type==='image'?'imagen':'video')+' a Cloudinary...','ok');
  try{
    const toUpload = type==='image' ? await compressImage(file) : file;
    const mediaUrl = type==='image'
      ? await uploadToCloudinary(toUpload, 'foto_'+Date.now()+'.jpg')
      : await uploadToCloudinary(toUpload);
    const payload = { type, mediaUrl };
    if(asViewOnce){ payload.viewOnce = true; payload.opened = false; }
    await sendMessage(payload);
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
  toggleViewOnceMode, deleteMessage, openViewOnce,
  toggleSearch, filterMessages, editMessage, pickReaction
});
