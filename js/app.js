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
      fotoURL = await uploadToCloudinary(regPhotoFile);
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
  updateActiveChatHeader();
  listenMessages();
  renderContacts();
}
function backToList(){ document.body.classList.remove('chat-open'); }

function updateActiveChatHeader(){
  if(!activeChatUid) return;
  const u = allUsers[activeChatUid]; if(!u) return;
  document.getElementById('ch-avatar').src = avatarSrc(u);
  document.getElementById('ch-name').textContent = u.nombre;
  const online = isOnline(u.lastSeen);
  const st = document.getElementById('ch-status');
  st.textContent = online ? 'en línea' : 'últ. vez ' + fmtLastSeen(u.lastSeen);
  st.classList.toggle('online', online);
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
    snap.forEach(d=>{
      const m = d.data(); m.id = d.id; msgById[d.id]=m;
      box.appendChild(renderMessageEl(m));
    });
    if(wasNearBottom) box.scrollTop = box.scrollHeight;
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
  if(m.replyTo){
    inner += `<div class="quote" data-jump="${m.replyTo.id}">
      <div class="quote-name">${escapeHtml(m.replyTo.senderName)}</div>
      <div class="quote-text">${escapeHtml(m.replyTo.preview||'')}</div>
    </div>`;
  }
  if(m.type==='text'){
    inner += `<div>${escapeHtml(m.text||'')}</div>`;
  }else if(m.type==='image'){
    inner += `<img class="msg-img" src="${m.mediaUrl}" data-view="${m.mediaUrl}" data-vtype="image">`;
  }else if(m.type==='video'){
    inner += `<video class="msg-vid" src="${m.mediaUrl}" controls></video>`;
  }else if(m.type==='audio'){
    inner += `<audio class="msg-aud" src="${m.mediaUrl}" controls></audio>`;
  }

  const time = m.timestamp && m.timestamp.toDate ? m.timestamp.toDate() : (m.timestamp ? new Date(m.timestamp) : new Date());
  const timeStr = time.toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'});

  wrap.innerHTML = `
    <div class="msg-row-inline">
      <div class="bubble">${inner}</div>
    </div>
    <div style="display:flex;align-items:center;gap:6px;">
      <span class="msg-time">${timeStr}</span>
      <span class="msg-reply-actions"><button class="msg-reply-btn" title="Responder">↩</button></span>
    </div>`;

  wrap.querySelector('.msg-reply-btn').onclick = ()=> setReply(m.id, mine?'Tú':(allUsers[m.senderId]?.nombre||'Operador'), m.type, previewForType(m));
  const img = wrap.querySelector('[data-view]');
  if(img) img.onclick = ()=> openLightboxUrl(img.dataset.view, img.dataset.vtype);
  const quote = wrap.querySelector('.quote');
  if(quote) quote.onclick = ()=> scrollToMessage(quote.dataset.jump);

  return wrap;
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
    replyTo: replyingTo ? { ...replyingTo } : null
  };
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
    const mediaUrl = await uploadToCloudinary(file);
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
    const url = await uploadToCloudinary(file);
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
  document.addEventListener('click', (e)=>{
    const menu = document.getElementById('attach-menu');
    if(menu && !menu.classList.contains('hidden')){
      if(!menu.contains(e.target) && !e.target.closest('.input-row button[onclick*="toggleAttachMenu"]')){
        menu.classList.add('hidden');
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
  openLightboxUrl, closeLightbox, cancelReply, renderContacts
});

