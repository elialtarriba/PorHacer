/* PorHacer · nube compartida (Firebase)
   - Cada persona entra con su email y contraseña.
   - La dueña (quien crea el tablero) comparte con todas las personas de su
     lista «Personas» que tengan email: esas personas ven y editan lo mismo.
   - Tareas, personas y columnas → Firestore. Fotos y vídeos → Storage.
   - En el dispositivo queda una copia (funciona sin internet y se sincroniza
     al volver la conexión). El tema de colores es de cada uno.            */

const SDK_FB = 'https://www.gstatic.com/firebasejs/10.14.1/';
const _orig = { poner:DB.poner, borrar:DB.borrar, ponerVarios:DB.ponerVarios, deTarea:DB.deTarea, uno:DB.uno, resumen:DB.resumen, borrarDeTarea:DB.borrarDeTarea };
const limpioFS = o => JSON.parse(JSON.stringify(o));   // Firestore no acepta «undefined»

function cargarScript(src){
  return new Promise((ok, mal) => {
    if(document.querySelector(`script[src="${src}"]`)) return ok();
    const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => mal(new Error('No se pudo cargar '+src));
    document.head.appendChild(s);
  });
}

const Nube = {
  activa:false, user:null, tid:null, tablero:null, media:[], subs:[], subiendo:0, online:navigator.onLine,
  configurada(){ return typeof FIREBASE_CONFIG === 'object' && FIREBASE_CONFIG && !!FIREBASE_CONFIG.apiKey; },
  email(){ return (this.user && this.user.email || '').toLowerCase(); },
  esDuena(){ return !!(this.tablero && this.user && this.tablero.dueno === this.user.uid); },
  col(n){ return this.db.collection('tableros').doc(this.tid).collection(n); },

  /* ---------- Arranque ---------- */
  async iniciar(){
    addEventListener('online', () => { this.online = true; this.pintarEstado(); });
    addEventListener('offline', () => { this.online = false; this.pintarEstado(); });
    if(!this.configurada()){ this.pintarEstado(); return; }
    try{
      for(const f of ['firebase-app-compat.js','firebase-auth-compat.js','firebase-firestore-compat.js']) await cargarScript(SDK_FB + f);
    }catch(e){ console.warn(e); this.pintarEstado('⚠️'); return; }
    firebase.initializeApp(FIREBASE_CONFIG);
    this.auth = firebase.auth();
    this.db = firebase.firestore();
    try{ await this.db.enablePersistence({ synchronizeTabs:true }); }catch(e){}
    // Solo para pruebas en el ordenador (emuladores de Firebase)
    if(location.hostname === 'localhost' && location.search.includes('emu=1')){
      this.auth.useEmulator('http://127.0.0.1:9099'); this.db.useEmulator('127.0.0.1', 8080);
    }
    this.envolverDB();
    this.auth.onAuthStateChanged(u => this.alCambiarUsuario(u));
  },

  async alCambiarUsuario(u){
    this.user = u;
    if(!u){ this.desconectar(); this.pintarEstado(); if(!this.ahoraNo()) this.pantallaEntrar(); return; }
    if(!u.emailVerified){ this.pantallaVerificar(); return; }
    await this.buscarTablero();
  },
  ahoraNo(){ try{ return sessionStorage.getItem('ph-sin-nube') === '1'; }catch(e){ return false; } },

  async buscarTablero(){
    this.pintarEstado('…');
    const ref = this.db.collection('tableros');
    let docs = [];
    for(const q of [ref.where('dueno','==',this.user.uid), ref.where('miembros','array-contains',this.email())]){
      try{ (await q.get()).forEach(d => { if(!docs.some(x => x.id === d.id)) docs.push(d); }); }catch(e){ console.warn('buscar', e); }
    }
    if(docs.length){
      // si hay varios, se usa el último elegido o el propio
      let pref = null; try{ pref = localStorage.getItem('ph-tablero'); }catch(e){}
      const d = docs.find(x => x.id === pref) || docs.find(x => x.data().dueno === this.user.uid) || docs[0];
      cerrar('nube');
      return this.conectar(d.id);
    }
    this.pantallaSinTablero();
  },

  async crearTablero(){
    const nombre = (this.user.displayName || this.email().split('@')[0]);
    const miembros = [this.email(), ...App.personas.map(p => (p.email||'').toLowerCase()).filter(Boolean)];
    const ref = await this.db.collection('tableros').add({ dueno:this.user.uid, duenoEmail:this.email(), duenoNombre:nombre, miembros:[...new Set(miembros)], creado:Date.now() });
    await this.conectar(ref.id, true);
  },

  /* ---------- Conexión en directo ---------- */
  async conectar(tid, nuevo){
    this.desconectar();
    this.tid = tid; this.activa = true;
    try{ localStorage.setItem('ph-tablero', tid); }catch(e){}
    cerrar('nube');
    const T = this.db.collection('tableros').doc(tid);
    this.subs.push(T.onSnapshot(d => { this.tablero = d.data() || null; this.pintarEstado(); this.actualizarMiembros(); }, e => this.errorSub(e)));
    if(nuevo) await this.subirTodo();

    let primera = true;
    this.subs.push(this.col('tareas').onSnapshot(async snap => {
      for(const ch of snap.docChanges()){
        if(ch.type === 'removed') await _orig.borrar('tareas', ch.doc.id);
        else await _orig.poner('tareas', ch.doc.data());
      }
      App.tareas = snap.docs.map(d => d.data());
      await contarMedia(); pintarTodo();
      if(primera){ primera = false; this.pintarEstado(); }
    }, e => this.errorSub(e)));

    this.subs.push(this.col('personas').onSnapshot(async snap => {
      for(const ch of snap.docChanges()){
        if(ch.type === 'removed') await _orig.borrar('personas', ch.doc.id);
        else await _orig.poner('personas', ch.doc.data());
      }
      App.personas = snap.docs.map(d => d.data());
      this.actualizarMiembros(); pintarTodo();
    }, e => this.errorSub(e)));

    this.subs.push(this.col('config').doc('tablero').onSnapshot(async d => {
      const c = d.data(); if(!c) { if(this.esDuena()) this.subirConfig(); return; }
      const a = App.ajustes;
      if(JSON.stringify(c.columnas) !== JSON.stringify(a.columnas) || c.bordeColumna !== a.bordeColumna){
        a.columnas = c.columnas; a.bordeColumna = c.bordeColumna;
        await _orig.poner('ajustes', a); pintarTodo();
      }
    }, e => this.errorSub(e)));

    this.subs.push(this.col('media').onSnapshot(async snap => {
      this.media = snap.docs.map(d => d.data());
      await contarMedia(); pintarTodo();
      if(App.ed){ const p = $('#editor .tab-pan.on'); if(p && p.dataset.p === 'fotos') pintarFotos(); if(p && p.dataset.p === 'videos') pintarVideos(); }
    }, e => this.errorSub(e)));
    this.pintarEstado();
  },
  desconectar(){ this.subs.forEach(f => { try{ f(); }catch(e){} }); this.subs = []; this.activa = false; this.media = []; this.tablero = null; this.tid = null; },
  errorSub(e){
    console.warn('nube', e);
    if(e && e.code === 'permission-denied'){
      this.desconectar(); this.pintarEstado();
      popAviso('Sin permiso', 'Ya no tienes acceso a este tablero. Pide a la dueña que te añada en Personas con tu email ('+this.email()+').');
    }
  },

  // La dueña: los miembros son las personas con email de su lista
  async actualizarMiembros(){
    if(!this.activa || !this.esDuena()) return;
    const m = [...new Set([this.email(), ...App.personas.map(p => (p.email||'').trim().toLowerCase()).filter(Boolean)])].sort();
    const ya = [...(this.tablero.miembros || [])].sort();
    if(JSON.stringify(m) !== JSON.stringify(ya)){
      try{ await this.db.collection('tableros').doc(this.tid).update({ miembros:m }); }catch(e){ console.warn(e); }
    }
  },
  subirConfig(){
    if(!this.activa) return;
    const a = App.ajustes;
    return this.col('config').doc('tablero').set(limpioFS({ columnas:a.columnas, bordeColumna:a.bordeColumna })).catch(e => console.warn(e));
  },

  // Al crear el tablero: sube lo que ya había en este dispositivo
  async subirTodo(){
    const [ts, ps, fs, vs] = await Promise.all([DB.todos('tareas'), DB.todos('personas'), DB.todos('fotos'), DB.todos('videos')]);
    toast('☁️ Subiendo tus tareas a la nube…', null, null, 8000);
    const lote = this.db.batch();
    ts.forEach(t => lote.set(this.col('tareas').doc(t.id), limpioFS(t)));
    ps.forEach(p => lote.set(this.col('personas').doc(p.id), limpioFS(p)));
    await lote.commit();
    await this.subirConfig();
    for(const f of fs) await this.subirMedia('fotos', f);
    for(const v of vs) await this.subirMedia('videos', v);
    toast('✅ Todo subido a la nube');
  },

  /* ---------- Fotos y vídeos ----------
     Se guardan dentro de la base de datos (plan gratis, sin tarjeta), partidos
     en trozos de 900 KB. Límite gratuito de Firebase: 1 GB en total.        */
  TROZO: 900 * 1024,
  LIMITE: 1024 * 1024 * 1024,
  _minis: {},
  usadoNube(){ return this.media.reduce((s, m) => s + (m.size||0) + (m.sizeMini||0), 0); },
  async _subirTrozos(id, clave, blob){
    const buf = new Uint8Array(await blob.arrayBuffer());
    const n = Math.max(1, Math.ceil(buf.length / this.TROZO));
    for(let k = 0; k < n; k++){
      const parte = buf.subarray(k*this.TROZO, (k+1)*this.TROZO);
      await this.col('trozos').doc(clave + '_' + k).set({ mid:id, clave, k, b: firebase.firestore.Blob.fromUint8Array(parte) });
    }
    return n;
  },
  async _bajarTrozos(clave, n, mime){
    const snap = await this.col('trozos').where('clave', '==', clave).get();
    const partes = snap.docs.map(d => d.data()).sort((a,b) => a.k - b.k);
    if(!partes.length || (n && partes.length < n)) return null;
    return new Blob(partes.map(p => p.b.toUint8Array()), { type: mime || 'application/octet-stream' });
  },
  async subirMedia(tipo, o){
    if(!o || !o.blob) return;
    if(this.media.some(m => m.id === o.id)) return;
    const pequeña = tipo === 'fotos' ? o.mini : o.poster;
    const tam = (o.blob.size||0) + (pequeña ? pequeña.size : 0);
    if(this.usadoNube() + tam > this.LIMITE * 0.97){
      popAviso('Nube llena', 'Ya casi no queda sitio gratis en la nube (1 GB). Esta '+(tipo==='fotos'?'foto':'vídeo')+' se queda solo en este dispositivo. Borra vídeos antiguos para hacer sitio.');
      return;
    }
    this.subiendo++; this.pintarEstado();
    try{
      const meta = { id:o.id, tareaId:o.tareaId, tipo, size:o.blob.size||0, original:o.original||0, w:o.w||0, h:o.h||0, dur:o.dur||0,
        nombre:o.nombre||'', fecha:o.fecha||Date.now(), mime:o.tipo||o.blob.type||'', autor:this.email(), listo:false };
      meta.partes = await this._subirTrozos(o.id, o.id, o.blob);
      if(pequeña){ meta.partesMini = await this._subirTrozos(o.id, o.id + '_m', pequeña); meta.sizeMini = pequeña.size; }
      meta.listo = true;
      await this.col('media').doc(o.id).set(limpioFS(meta));
    }catch(e){ console.warn(e); toast('⚠️ No se pudo subir una '+(tipo==='fotos'?'foto':'vídeo')+' a la nube'); }
    this.subiendo--; this.pintarEstado();
  },
  async borrarMedia(id){
    try{ await this.col('media').doc(id).delete(); }catch(e){}
    try{ const snap = await this.col('trozos').where('mid', '==', id).get(); for(const d of snap.docs) await d.ref.delete(); }catch(e){ console.warn(e); }
  },

  /* Se «envuelve» el almacén local: lo que se guarda aquí también va a la nube */
  envolverDB(){
    const N = this;
    const subirDoc = (a, o) => {
      if(!N.activa) return;
      if(a === 'tareas' || a === 'personas') N.col(a).doc(o.id).set(limpioFS(limpiaTarea(o))).catch(e => console.warn(e));
      else if(a === 'ajustes') N.subirConfig();
      else if(a === 'fotos' || a === 'videos') N.subirMedia(a, o);
    };
    DB.poner = async (a, o) => { const r = await _orig.poner(a, o); subirDoc(a, o); return r; };
    DB.ponerVarios = async (a, l) => { const r = await _orig.ponerVarios(a, l); l.forEach(o => subirDoc(a, o)); return r; };
    DB.borrar = async (a, id) => {
      const r = await _orig.borrar(a, id);
      if(N.activa){
        if(a === 'tareas' || a === 'personas') N.col(a).doc(id).delete().catch(e => console.warn(e));
        else if(a === 'fotos' || a === 'videos') N.borrarMedia(id);
      }
      return r;
    };
    DB.borrarDeTarea = async (a, tareaId) => {
      const n = await _orig.borrarDeTarea(a, tareaId);
      if(N.activa) N.media.filter(m => m.tareaId === tareaId && m.tipo === a).forEach(m => N.borrarMedia(m.id));
      return n;
    };
    // Fotos/vídeos de una tarea: las de este dispositivo + las que subieron los demás
    DB.deTarea = async (a, tareaId) => {
      const loc = await _orig.deTarea(a, tareaId);
      if(!N.activa || (a !== 'fotos' && a !== 'videos')) return loc;
      const idx = Object.fromEntries(loc.map(x => [x.id, x]));
      const out = N.media.filter(m => m.tareaId === tareaId && m.tipo === a).map(m => ({ ...m, ...(idx[m.id] || {}), tipo: (idx[m.id]||{}).tipo || m.mime }));
      // miniaturas de lo que han subido otros (pequeñas, se guardan en memoria)
      for(const x of out){
        if(x.blob || x.mini || x.poster || !x.partesMini) continue;
        if(!N._minis[x.id]) N._minis[x.id] = await N._bajarTrozos(x.id + '_m', x.partesMini, 'image/jpeg').catch(() => null);
        if(N._minis[x.id]){ if(a === 'fotos') x.mini = N._minis[x.id]; else x.poster = N._minis[x.id]; }
      }
      loc.forEach(x => { if(!out.some(y => y.id === x.id)) out.push(x); });
      return out;
    };
    DB.uno = async (a, id) => {
      const loc = await _orig.uno(a, id);
      if(loc || !N.activa || (a !== 'fotos' && a !== 'videos')) return loc;
      const m = N.media.find(x => x.id === id); if(!m) return null;
      if(!m.listo) return { ...m };
      if(a === 'videos') toast('⬇️ Descargando el vídeo…', null, null, 15000);
      const blob = await N._bajarTrozos(m.id, m.partes, m.mime || (a==='fotos'?'image/jpeg':'video/mp4')).catch(e => { console.warn(e); return null; });
      $('#toast').classList.remove('ver');
      if(!blob) return { ...m };
      const local = { ...m, blob, tipo: m.mime, mini: a==='fotos' ? N._minis[m.id] : undefined, poster: a==='videos' ? N._minis[m.id] : undefined };
      await _orig.poner(a, local);          // se guarda aquí para la próxima vez
      return local;
    };
    DB.resumen = async (a) => {
      const loc = await _orig.resumen(a);
      if(!N.activa) return loc;
      const out = N.media.filter(m => m.tipo === a).map(m => ({ id:m.id, tareaId:m.tareaId, size:m.size }));
      loc.forEach(x => { if(!out.some(y => y.id === x.id)) out.push(x); });
      return out;
    };
  },

  /* ---------- Pantallas de entrada ---------- */
  pintarEstado(forzado){
    const el = $('#nubeEstado'); if(!el) return;
    let ico = '', tit = '';
    if(!this.configurada()){ el.hidden = true; return; }
    el.hidden = false;
    if(forzado){ ico = forzado; tit = 'Conectando…'; }
    else if(!this.activa){ ico = '☁︎'; tit = 'Sin conectar a la nube (toca para entrar)'; el.classList.add('off'); }
    else if(!this.online){ ico = '☁︎'; tit = 'Sin internet: se sincronizará al volver'; el.classList.add('off'); }
    else if(this.subiendo){ ico = '⬆︎'+this.subiendo; tit = 'Subiendo fotos o vídeos…'; el.classList.remove('off'); }
    else { ico = '☁︎'; tit = 'Sincronizado con la nube'; el.classList.remove('off'); }
    if(this.activa && this.online) el.classList.remove('off');
    el.textContent = ico; el.title = tit;
  },
  pantalla(html, alAbrir){
    $('#nubeCuerpo').innerHTML = html;
    abrir('nube');
    alAbrir && alAbrir($('#nubeCuerpo'));
  },
  pantallaEntrar(modo='entrar'){
    const reg = modo === 'registro';
    this.pantalla(`
      <img src="logo.png" class="nube-logo" alt="">
      <h2>${reg ? 'Crear cuenta' : 'Entrar en PorHacer'}</h2>
      <p class="nube-txt">${reg ? 'Usa el <b>mismo email</b> con el que te han apuntado en «Personas».' : 'Entra con tu email para ver las tareas compartidas, con sus fotos y vídeos.'}</p>
      <input id="nbMail" type="email" inputmode="email" autocomplete="email" placeholder="Email">
      <input id="nbPass" type="password" autocomplete="${reg?'new-password':'current-password'}" placeholder="Contraseña${reg?' (mínimo 6 letras o números)':''}">
      ${reg ? '<input id="nbPass2" type="password" autocomplete="new-password" placeholder="Repite la contraseña">' : ''}
      <div class="nube-error" id="nbErr"></div>
      <button class="btn-pri btn-ancho" id="nbOk">${reg ? 'Crear cuenta' : 'Entrar'}</button>
      <button class="nube-link" id="nbOtro">${reg ? '¿Ya tienes cuenta? <b>Entrar</b>' : '¿Primera vez? <b>Crear cuenta</b>'}</button>
      ${reg ? '' : '<button class="nube-link" id="nbOlvido">He olvidado la contraseña</button>'}
      <button class="nube-link suave" id="nbAhoraNo">Ahora no, usar solo en este dispositivo</button>`, c => {
      const err = t => $('#nbErr', c).textContent = t;
      $('#nbOtro', c).onclick = () => this.pantallaEntrar(reg ? 'entrar' : 'registro');
      $('#nbAhoraNo', c).onclick = () => { try{ sessionStorage.setItem('ph-sin-nube','1'); }catch(e){} cerrar('nube'); };
      if(!reg) $('#nbOlvido', c).onclick = async () => {
        const m = $('#nbMail', c).value.trim(); if(!m){ err('Escribe primero tu email.'); return; }
        try{ await this.auth.sendPasswordResetEmail(m); err(''); popAviso('Revisa tu correo', 'Te hemos enviado un email a '+m+' para poner una contraseña nueva.'); }catch(e){ err(this.textoError(e)); }
      };
      $('#nbPass', c).onkeydown = e => { if(e.key === 'Enter' && !reg) $('#nbOk', c).click(); };
      $('#nbOk', c).onclick = async () => {
        const m = $('#nbMail', c).value.trim(), p = $('#nbPass', c).value;
        if(!m || !p){ err('Escribe el email y la contraseña.'); return; }
        if(reg && p !== $('#nbPass2', c).value){ err('Las dos contraseñas no son iguales.'); return; }
        $('#nbOk', c).disabled = true; err('');
        try{
          if(reg){ const r = await this.auth.createUserWithEmailAndPassword(m, p); await r.user.sendEmailVerification(); }
          else await this.auth.signInWithEmailAndPassword(m, p);
        }catch(e){ err(this.textoError(e)); }
        const b = $('#nbOk', c); if(b) b.disabled = false;
      };
      setTimeout(() => { const m = $('#nbMail', c); m && m.focus(); }, 250);
    });
  },
  pantallaVerificar(){
    this.pantalla(`
      <div class="nube-gran">✉️</div>
      <h2>Confirma tu email</h2>
      <p class="nube-txt">Te hemos enviado un correo a <b>${esc(this.user.email)}</b>. Ábrelo y pulsa el enlace. Después vuelve aquí y pulsa el botón.</p>
      <p class="nube-txt suave">Si no lo ves, mira en «Correo no deseado».</p>
      <div class="nube-error" id="nbErr"></div>
      <button class="btn-pri btn-ancho" id="nbYa">Ya lo he confirmado</button>
      <button class="nube-link" id="nbReenviar">Enviar otra vez el correo</button>
      <button class="nube-link suave" id="nbSalir">Usar otro email</button>`, c => {
      $('#nbYa', c).onclick = async () => {
        await this.user.reload();
        if(this.auth.currentUser.emailVerified){ await this.auth.currentUser.getIdToken(true); this.user = this.auth.currentUser; this.buscarTablero(); }
        else $('#nbErr', c).textContent = 'Todavía no consta como confirmado. Pulsa el enlace del correo y prueba otra vez.';
      };
      $('#nbReenviar', c).onclick = async () => { try{ await this.user.sendEmailVerification(); toast('✉️ Correo enviado otra vez'); }catch(e){ $('#nbErr', c).textContent = this.textoError(e); } };
      $('#nbSalir', c).onclick = () => this.auth.signOut();
    });
  },
  pantallaSinTablero(){
    this.pantalla(`
      <div class="nube-gran">🗂️</div>
      <h2>Hola, ${esc(this.email())}</h2>
      <p class="nube-txt">Todavía nadie ha compartido un tablero contigo.</p>
      <div class="nube-caja"><b>¿Te han dicho que te apuntarían?</b><br>Pide que te añadan en <b>Configuración → Personas</b> con este mismo email y pulsa «Volver a mirar».</div>
      <button class="btn-sec btn-ancho" id="nbMirar">🔄 Volver a mirar</button>
      <div class="nube-caja"><b>¿Eres tú quien organiza las tareas?</b><br>Crea tu tablero. ${App.tareas.length ? `Se subirán las <b>${App.tareas.length} tareas</b> que tienes en este dispositivo, con sus fotos y vídeos.` : ''} Las personas de tu lista con email podrán verlo.</div>
      <button class="btn-pri btn-ancho" id="nbCrear">＋ Crear mi tablero compartido</button>
      <button class="nube-link suave" id="nbSalir">Cerrar sesión</button>`, c => {
      $('#nbMirar', c).onclick = () => this.buscarTablero();
      $('#nbCrear', c).onclick = async () => { $('#nbCrear', c).disabled = true; try{ await this.crearTablero(); }catch(e){ console.warn(e); popAviso('No se pudo crear', this.textoError(e)); $('#nbCrear', c).disabled = false; } };
      $('#nbSalir', c).onclick = () => this.auth.signOut();
    });
  },
  textoError(e){
    const c = e && e.code || '';
    return ({
      'auth/invalid-email':'Ese email no es correcto.',
      'auth/user-not-found':'No hay ninguna cuenta con ese email. Pulsa «Crear cuenta».',
      'auth/wrong-password':'La contraseña no es correcta.',
      'auth/invalid-credential':'El email o la contraseña no son correctos.',
      'auth/invalid-login-credentials':'El email o la contraseña no son correctos.',
      'auth/email-already-in-use':'Ya hay una cuenta con ese email. Pulsa «Entrar».',
      'auth/weak-password':'La contraseña tiene que tener al menos 6 letras o números.',
      'auth/too-many-requests':'Demasiados intentos. Espera un poco y vuelve a probar.',
      'auth/network-request-failed':'No hay conexión a internet.',
      'permission-denied':'Firebase no da permiso. Revisa que las reglas estén pegadas (mira la guía).'
    })[c] || ('Algo ha fallado: ' + (e && e.message || e));
  },

  /* ---------- Pestaña «Nube» en Configuración ---------- */
  pintarAjustes(cont){
    if(!this.configurada()){
      cont.innerHTML = `<div class="aj-sec"><h4>Nube compartida</h4><div class="espacio"><p style="margin:0;font-size:14px;color:var(--ink)">Todavía no está conectada. Ahora mismo las tareas, fotos y vídeos se guardan <b>solo en este dispositivo</b>.</p>
        <p>Para compartirlas, hay que crear el proyecto de Firebase (está explicado paso a paso en <b>GUIA-FIREBASE.md</b>, en la carpeta de la app).</p></div></div>`;
      return;
    }
    if(!this.user){
      cont.innerHTML = `<div class="aj-sec"><h4>Nube compartida</h4><p class="aj-ayuda">No has entrado. Entra con tu email para ver y compartir las tareas.</p><button class="btn-pri btn-ancho" id="njEntrar">Entrar</button></div>`;
      $('#njEntrar').onclick = () => { try{ sessionStorage.removeItem('ph-sin-nube'); }catch(e){} cerrar('ajustes'); this.pantallaEntrar(); };
      return;
    }
    const t = this.tablero, duena = this.esDuena();
    const miembros = t ? (t.miembros || []) : [];
    cont.innerHTML = `<div class="aj-sec"><h4>Nube compartida</h4><div class="espacio">
        <div style="font-size:14.5px;font-weight:800">${this.activa ? '☁️ Conectada' : '☁︎ Sin tablero'} · ${esc(this.user.email)}</div>
        ${t ? `<p>${duena ? 'Eres la <b>dueña</b> de este tablero.' : 'Tablero de <b>'+esc(t.duenoEmail)+'</b>.'}</p>` : ''}
        <p>📷🎬 Fotos y vídeos en la nube: <b>${tamTxt(this.usadoNube())}</b> de 1 GB gratis</p>
        <div class="barra-prog"><i style="width:${Math.max(1, Math.min(100, this.usadoNube()/this.LIMITE*100))}%"></i></div>
        <p>${this.online ? (this.subiendo ? '⬆️ Subiendo '+this.subiendo+' archivo(s)…' : '✅ Todo sincronizado') : '📴 Sin internet: los cambios se subirán al volver la conexión.'}</p>
      </div></div>
      ${t ? `<div class="aj-sec"><h4>Quién lo ve (${miembros.length})</h4>
        <p class="aj-ayuda">${duena ? 'Son las personas de tu lista con email (pestaña 👥 Personas). Para dar acceso a alguien, añádelo allí con su email; para quitarlo, bórralo o quítale el email.' : 'Lo decide la dueña del tablero desde su lista de Personas.'}</p>
        ${miembros.map(m => `<div class="per-fila"><span class="avatar" style="background:${m===t.duenoEmail?'var(--accent)':'var(--dark)'}">${esc(m[0].toUpperCase())}</span><div><b>${esc(m)}</b><small>${m===t.duenoEmail?'Dueña':'Puede ver y editar'}${m===this.email()?' · eres tú':''}</small></div></div>`).join('')}
        <div class="espacio" style="margin-top:6px"><p style="margin:0">Cada persona entra en <b>${esc(APP_URL)}</b>, pulsa «Crear cuenta» con su email y lo confirma. El tema de colores es de cada uno.</p></div></div>` : ''}
      <button class="btn-sec btn-ancho" id="njSalir" style="margin-top:14px">Cerrar sesión</button>
      <p class="aj-ayuda" style="margin-top:8px">Al cerrar sesión, lo que ya se ve en este dispositivo se queda guardado aquí, pero deja de sincronizarse.</p>`;
    $('#njSalir').onclick = async () => { if(await popConfirmar('¿Cerrar sesión?', 'Dejarás de ver los cambios de los demás hasta que vuelvas a entrar.', 'Cerrar sesión')){ await this.auth.signOut(); cerrar('ajustes'); } };
  }
};
