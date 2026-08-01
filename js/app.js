// ════════════════════════════════════════════════════════════
//  ARCHIVO 404 — CHAT · Lógica principal
// ════════════════════════════════════════════════════════════
import {
  auth, db, storage,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged,
  signOut, updateProfile, doc, setDoc, getDoc, updateDoc, collection,
  query, orderBy, onSnapshot, serverTimestamp, addDoc, limit,
  ref, uploadBytesResumable, getDownloadURL,
  apodoToEmail, chatIdFor
} from './firebase.js';

// ─────────────────────────────────────────────
// ESTADO GLOBAL
// ─────────────────────────────────────────────
let currentUser = null;
let myProfile = null;
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
  "CONECTANDO A FIREBASE...",
  "VERIFICANDO SESIÓN...",
  "LISTO."
];
async function boot(){
  const bar = document.getElementById('boot-bar'), log = document.getElementById('boot-log');
  for(let i=0;i<BOOT_LINES.length;i++){
    const d=document.createElement('div');d.className=i===BOOT_LINES.length-1?'ok':'';
    d.textContent='> '+BOOT_LINES[i];log.appendChild(d);
    bar.style.width=((i+1)/BOOT_LINES.length*100)+'%';
    await sleep(180);
  }
  await sleep(200);
  const bs=document.getElementById('boot');
  bs.style.transition='opacity .4s';bs.style.opacity='0';
  setTimeout(()=>bs.style.display='none',400);
}
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
boot();

// ─────────────────────────────────────────────
// AUTH — UI
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

function authErrorMsg(e){
  const c = e.code || '';
  if(c.includes('email-already-in-use')) return 'Ese apodo ya está registrado. Elige otro o inicia sesión.';
  if(c.includes('weak-password')) return 'La contraseña debe tener al menos 6 caracteres.';
  if(c.includes('user-not-found') || c.includes('invalid-credential') || c.includes('wrong-password')) return 'Apodo o contraseña incorrectos.';
  if(c.includes('invalid-email')) return 'Apodo inválido. Usa solo letras, números, ., _ o -.';
  if(c.includes('too-many-requests')) return 'Demasiados intentos. Espera un momento.';
  return e.message || 'Ocurrió un error. Intenta de nuevo.';
}

async function doRegister(){
  const nombre = document.getElementById('reg-nombre').value.trim();
  const apodo  = document.getElementById('reg-apodo').value.trim();
  const pass   = document.getElementById('reg-pass').value;
  const pass2  = document.getElementById('reg-pass2').value;
  const errEl  = document.getElementById('register-err'); errEl.textContent='';

  if(!nombre || !apodo || !pass){ errEl.textContent='Completa todos los campos.'; return; }
  if(pass.length<6){ errEl.textContent='La contraseña debe tener mínimo 6 caracteres.'; return; }
  if(pass!==pass2){ errEl.textContent='Las contraseñas no coinciden.'; return; }

  try{
    const email = apodoToEmail(apodo);
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    let fotoURL = '';
    if(regPhotoFile){
      fotoURL = await uploadToStorage(`users/${cred.user.uid}/avatar_${Date.now()}`, regPhotoFile);
    }
    await updateProfile(cred.user, { displayName: nombre, photoURL: fotoURL || null });
    await setDoc(doc(db,'users',cred.user.uid), {
      uid: cred.user.uid, nombre, apodo, apodoLower: apodo.toLowerCase(),
      fotoURL: fotoURL || '', createdAt: Date.now(), lastSeen: Date.now()
    });
    toast('Cuenta creada. ¡Bienvenido, '+nombre+'!','ok');
  }catch(e){ errEl.textContent = authErrorMsg(e); }
}

async function doLogin(){
  const apodo = document.getElementById('login-apodo').value.trim();
  const pass  = document.getElementById('login-pass').value;
  const errEl = document.getElementById('login-err'); errEl.textContent='';
  if(!apodo || !pass){ errEl.textContent='Ingresa tu apodo y contraseña.'; return; }
  try{
    const email = apodoToEmail(apodo);
    await signInWithEmailAndPassword(auth, email, pass);
  }catch(e){ errEl.textContent = authErrorMsg(e); }
}

async function doLogout(){
  try{ if(currentUser) await updateDoc(doc(db,'users',currentUser.uid), { lastSeen: Date.now(), online:false }); }catch(e){}
  clearInterval(presenceInterval); clearInterval(statusRefreshInterval);
  if(usersUnsub) usersUnsub();
  if(messagesUnsub) messagesUnsub();
  await signOut(auth);
}

// ─────────────────────────────────────────────
// AUTH — ESTADO
// ─────────────────────────────────────────────
onAuthStateChanged(auth, async (user)=>{
  if(user){
    currentUser = user;
    let snap = await getDoc(doc(db,'users',user.uid));
    if(!snap.exists()){
      // fallback por si el doc no se creó (no debería pasar)
      await setDoc(doc(db,'users',user.uid), {
        uid:user.uid, nombre:user.displayName||'Operador', apodo:user.email.split('@')[0],
        apodoLower:(user.email.split('@')[0]).toLowerCase(), fotoURL:user.photoURL||'', createdAt:Date.now(), lastSeen:Date.now()
      });
      snap = await getDoc(doc(db,'users',user.uid));
    }
    myProfile = snap.data();
    showApp();
    setupPresence();
    listenUsers();
  } else {
    currentUser = null; myProfile = null; activeChatUid = null; activeChatId = null;
    document.getElementById('screen-app').classList.add('hidden');
    document.getElementById('screen-auth').classList.remove('hidden');
    document.body.classList.remove('chat-open');
  }
});

function showApp(){
  document.getElementById('screen-auth').classList.add('hidden');
  document.getElementById('screen-app').classList.remove('hidden');
  document.getElementById('me-name').textContent = myProfile.nombre;
  document.getElementById('me-apodo').textContent = '@'+myProfile.apodo;
  document.getElementById('me-avatar').src = avatarSrc(myProfile);
}

function setupPresence(){
  updateDoc(doc(db,'users',currentUser.uid), { lastSeen: Date.now(), online:true }).catch(()=>{});
  presenceInterval = setInterval(()=>{
    if(document.visibilityState==='visible' && currentUser){
      updateDoc(doc(db,'users',currentUser.uid), { lastSeen: Date.now(), online:true }).catch(()=>{});
    }
  }, 15000);
  statusRefreshInterval = setInterval(()=>{ renderContacts(); updateActiveChatHeader(); }, 10000);
  window.addEventListener('beforeunload', ()=>{
    try{ updateDoc(doc(db,'users',currentUser.uid), { lastSeen: Date.now(), online:false }); }catch(e){}
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
    if(activeChatUid) { /* profile modal live update handled on open */ }
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
    .filter(u=>u.uid!==currentUser?.uid)
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
  activeChatId = chatIdFor(currentUser.uid, uid);
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
// ─────────────────────────────────────────────
function listenMessages(){
  if(messagesUnsub) messagesUnsub();
  const q = query(collection(db,'chats',activeChatId,'messages'), orderBy('createdAt','asc'), limit(300));
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
  const mine = m.senderId===currentUser.uid;
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
    inner += `<img class="msg-img" src="${m.url}" data-view="${m.url}" data-vtype="image">`;
  }else if(m.type==='video'){
    inner += `<video class="msg-vid" src="${m.url}" controls></video>`;
  }else if(m.type==='audio'){
    inner += `<audio class="msg-aud" src="${m.url}" controls></audio>`;
  }

  const time = m.createdAt && m.createdAt.toDate ? m.createdAt.toDate() : (m.createdAt ? new Date(m.createdAt) : new Date());
  const timeStr = time.toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'});

  wrap.innerHTML = `
    <div class="msg-row-inline">
      ${mine?'':''}
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
    senderId: currentUser.uid,
    type: payload.type,
    text: payload.text || null,
    url: payload.url || null,
    fileName: payload.fileName || null,
    createdAt: serverTimestamp(),
    replyTo: replyingTo ? { ...replyingTo } : null
  };
  await addDoc(collection(db,'chats',activeChatId,'messages'), data);
  await setDoc(doc(db,'chats',activeChatId), {
    participants: [currentUser.uid, activeChatUid],
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
// ARCHIVOS: imagen / video
// ─────────────────────────────────────────────
function toggleAttachMenu(){ document.getElementById('attach-menu').classList.toggle('hidden'); }
function triggerFile(type){
  document.getElementById('attach-menu').classList.add('hidden');
  document.getElementById('file-'+type).click();
}
async function sendFile(input, type){
  const file = input.files[0]; if(!file || !activeChatId) return;
  input.value='';
  toast('Subiendo '+(type==='image'?'imagen':'video')+'...','ok');
  try{
    const url = await uploadToStorage(`chats/${activeChatId}/${type}/${Date.now()}_${file.name}`, file);
    await sendMessage({ type, url, fileName:file.name });
  }catch(e){ toast('Error al subir archivo: '+e.message,'err'); }
}

function uploadToStorage(path, file){
  return new Promise((resolve,reject)=>{
    const r = ref(storage, path);
    const task = uploadBytesResumable(r, file);
    task.on('state_changed', null, reject, async ()=>{
      try{ const url = await getDownloadURL(task.snapshot.ref); resolve(url); }
      catch(e){ reject(e); }
    });
  });
}

// ─────────────────────────────────────────────
// AUDIO — grabación
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
    toast('Subiendo audio...','ok');
    try{
      const url = await uploadToStorage(`chats/${activeChatId}/audio/${Date.now()}.webm`, blob);
      await sendMessage({ type:'audio', url, fileName:'audio.webm' });
    }catch(e){ toast('Error al subir audio: '+e.message,'err'); }
  };
  mediaRecorder.stop();
}

// ─────────────────────────────────────────────
// PERFIL
// ─────────────────────────────────────────────
function openProfile(which){
  const u = which==='me' ? myProfile : allUsers[activeChatUid];
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
  toast('Actualizando foto de perfil...','ok');
  try{
    const url = await uploadToStorage(`users/${currentUser.uid}/avatar_${Date.now()}`, file);
    await updateDoc(doc(db,'users',currentUser.uid), { fotoURL:url });
    await updateProfile(currentUser, { photoURL:url });
    myProfile.fotoURL = url;
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
      if(!menu.contains(e.target) && e.target.id !== undefined && !e.target.closest('.input-row button[onclick*="toggleAttachMenu"]')){
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
