/* PorHacer · nube compartida (Firebase) · V4
   - Cada persona entra con su email y contraseña (y su nombre y apellidos).
   - Al entrar por primera vez, se le crea su propio tablero.
   - Cada uno puede crear tantos tableros como quiera y compartirlos:
     invita a alguien (nombre, apellidos, email) → le llega un email →
     al entrar en la app ve la invitación y la acepta o la rechaza.
   - Quien comparte un tablero (su dueño/a) ve quién está dentro y puede
     sacar a quien quiera. Los demás pueden salir cuando quieran.
   - Al invitar y al aceptar, la persona se apunta sola en «Personas»
     de ese tablero, para poder asignarle tareas y enviarle emails.
   - Tareas, personas, columnas, fotos, vídeos y audios → Firestore
     (plan gratis, sin tarjeta). En el móvil queda una copia del tablero
     abierto, para que funcione sin internet.                               */

const SDK_FB = 'https://www.gstatic.com/firebasejs/10.14.1/';
const _orig = { poner:DB.poner, borrar:DB.borrar, ponerVarios:DB.ponerVarios, deTarea:DB.deTarea, uno:DB.uno, resumen:DB.resumen, borrarDeTarea:DB.borrarDeTarea };
const limpioFS = o => JSON.parse(JSON.stringify(o));   // Firestore no acepta «undefined»
const TIPOS_MEDIA = ['fotos','videos','audios'];
const lsGet = k => { try{ return localStorage.getItem(k); }catch(e){ return null; } };
const lsSet = (k, v) => { try{ v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); }catch(e){} };

function cargarScript(src){
  return new Promise((ok, mal) => {
    if(document.querySelector(`script[src="${src}"]`)) return ok();
    const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => mal(new Error('No se pudo cargar '+src));
    document.head.appendChild(s);
  });
}

const Nube = {
  activa:false, user:null, perfil:null, tid:null, tablero:null, media:[], subs:[], subsLista:[], subiendo:0, online:navigator.onLine,
  tableros:{}, listos:0, avisadas:{}, recienCreado:null,
  configurada(){ return typeof FIREBASE_CONFIG === 'object' && FIREBASE_CONFIG && !!FIREBASE_CONFIG.apiKey; },
  email(){ return (this.user && this.user.email || '').toLowerCase(); },
  esDueno(t){ t = t || this.tablero; return !!(t && this.user && t.dueno === this.user.uid); },
  esDuena(){ return this.esDueno(); },
  aceptados(t){ return (t && t.aceptados) || []; },
  dentro(t){ return this.esDueno(t) || ((t.miembros||[]).includes(this.email()) && this.aceptados(t).includes(this.email())); },
  nombreTablero(t){ return (t && t.nombre) || 'Mi tablero'; },
  col(n){ return this.db.collection('tableros').doc(this.tid).collection(n); },
  colDe(tid, n){ return this.db.collection('tableros').doc(tid).collection(n); },
  nombreYo(){ return this.perfil ? (this.perfil.nombre + (this.perfil.apellidos ? ' ' + this.perfil.apellidos : '')) : this.email(); },

  /* ---------- Arranque ---------- */
  async iniciar(){
    addEventListener('online', () => { this.online = true; this.pintarEstado(); });
    addEventListener('offline', () => { this.online = false; this.pintarEstado(); });
    // ¿Viene de un email de invitación? (…/PorHacer/?invitacion=XXXX)
    const q = new URLSearchParams(location.search);
    if(q.get('invitacion')) this.invitacionUrl = q.get('invitacion');
    if(!this.configurada()){ this.pintarEstado(); return; }
    try{
      for(const f of ['firebase-app-compat.js','firebase-auth-compat.js','firebase-firestore-compat.js']) await cargarScript(SDK_FB + f);
    }catch(e){ console.warn(e); this.pintarEstado('⚠️'); return; }
    firebase.initializeApp(FIREBASE_CONFIG);
    this.auth = firebase.auth();
    try{ this.auth.languageCode = 'es'; }catch(e){}
    this.db = firebase.firestore();
    try{ await this.db.enablePersistence({ synchronizeTabs:true }); }catch(e){}
    if(location.hostname === 'localhost' && location.search.includes('emu=1')){
      this.auth.useEmulator('http://127.0.0.1:9099'); this.db.useEmulator('127.0.0.1', 8080);
    }
    this.envolverDB();
    this.auth.onAuthStateChanged(u => this.alCambiarUsuario(u));
  },

  async alCambiarUsuario(u){
    this.user = u;
    if(!u){
      this.pararLista(); this.desconectar(); this.perfil = null;
      // sin sesión no se deja nada de nadie en el móvil
      for(const x of ['tareas','personas','fotos','videos','audios']) await DB.vaciar(x).catch(()=>{});
      App.tareas = []; App.personas = []; lsSet('ph-cache-tid', null);
      this.pintarEstado(); pintarTodo(); pintarCabecera(); this.pantallaEntrar(); return;
    }
    if(!u.emailVerified){ this.pantallaVerificar(); return; }
    this.leerPerfil();
    if(!this.perfil){ this.pantallaPerfil(); return; }
    cerrar('nube');
    this.escucharTableros();
  },
  leerPerfil(){
    const d = (this.user && this.user.displayName) || '';
    if(!d.trim()){ this.perfil = null; return; }
    const [nombre, apellidos] = d.split('|');
    this.perfil = { nombre:(nombre||'').trim(), apellidos:(apellidos||'').trim() };
    if(!this.perfil.nombre) this.perfil = null;
  },
  async guardarPerfil(nombre, apellidos){
    await this.user.updateProfile({ displayName: nombre.trim() + '|' + apellidos.trim() });
    this.perfil = { nombre:nombre.trim(), apellidos:apellidos.trim() };
    // ponerse al día en «Personas» del tablero abierto
    if(this.activa) await this.apuntarmeEn(this.tid);
  },

  /* ---------- Lista de tableros (los míos y los compartidos conmigo) ---------- */
  pararLista(){ this.subsLista.forEach(f => { try{ f(); }catch(e){} }); this.subsLista = []; this.tableros = {}; this.listos = 0; },
  escucharTableros(){
    this.pararLista();
    this.pintarEstado('…');
    const ref = this.db.collection('tableros');
    const partes = [{}, {}];
    const unir = () => { this.tableros = { ...partes[0], ...partes[1] }; };
    [ref.where('dueno','==',this.user.uid), ref.where('miembros','array-contains',this.email())].forEach((q, i) => {
      let primera = true;
      this.subsLista.push(q.onSnapshot(snap => {
        partes[i] = {}; snap.forEach(d => { partes[i][d.id] = { id:d.id, ...d.data() }; });
        unir();
        if(primera){ primera = false; this.listos++; if(this.listos === 2) this.alTenerLista(); }
        else this.alCambiarLista();
      }, e => { console.warn('lista', e); if(primera){ primera = false; this.listos++; if(this.listos === 2) this.alTenerLista(); } }));
    });
  },
  misTableros(){ return Object.values(this.tableros).filter(t => this.esDueno(t)).sort((a,b) => (a.creado||0)-(b.creado||0)); },
  compartidos(){ return Object.values(this.tableros).filter(t => !this.esDueno(t) && this.dentro(t)).sort((a,b) => (a.creado||0)-(b.creado||0)); },
  invitaciones(){ return Object.values(this.tableros).filter(t => !this.esDueno(t) && !this.dentro(t) && (t.miembros||[]).includes(this.email())); },

  async alTenerLista(){
    // Primera vez: se crea su propio tablero, sin preguntar
    if(!this.misTableros().length){
      try{ const id = await this.crearTablero('Tablero de ' + this.perfil.nombre, true); this.tableros[id] = this.tableros[id] || { id, dueno:this.user.uid, nombre:'Tablero de ' + this.perfil.nombre, miembros:[this.email()], aceptados:[this.email()] }; }
      catch(e){ console.warn(e); popAviso('No se pudo crear tu tablero', this.textoError(e)); return; }
    }
    const pref = lsGet('ph-tablero');
    const ok = id => id && this.tableros[id] && this.dentro(this.tableros[id]);
    const tid = ok(pref) ? pref : (this.misTableros()[0] || {}).id;
    if(tid && tid !== this.tid) await this.conectar(tid);
    this.mirarInvitaciones();
  },
  alCambiarLista(){
    // si me han sacado del tablero abierto
    if(this.tid && (!this.tableros[this.tid] || !this.dentro(this.tableros[this.tid]))){
      const nombre = this.nombreTablero(this.tablero);
      const otro = (this.misTableros()[0] || {}).id;
      if(otro) this.conectar(otro);
      popAviso('Tablero cerrado', 'Ya no tienes acceso a «' + nombre + '». Te he abierto tu tablero.');
    }
    this.mirarInvitaciones();
    pintarCabecera();
    if($('#ajustes').classList.contains('abierto') && $('#ajTabs .on')?.dataset.t === 'tableros') this.pintarTableros($('#ajNube'));
  },
  mirarInvitaciones(){
    const inv = this.invitaciones();
    // primero la del enlace del email, si la hay
    inv.sort((a,b) => (b.id === this.invitacionUrl) - (a.id === this.invitacionUrl));
    const t = inv.find(x => !this.avisadas[x.id]);
    if(!t || $('#popup').classList.contains('abierto')) return;
    this.avisadas[t.id] = true;
    if(this.invitacionUrl === t.id){ this.invitacionUrl = null; try{ history.replaceState(null, '', location.pathname); }catch(e){} }
    this.preguntarInvitacion(t);
  },
  async preguntarInvitacion(t){
    const v = await popup({ tit:'📬 Te han invitado',
      html:`<p><b>${esc(t.duenoNombre || t.duenoEmail)}</b> te invita a su tablero</p>
        <div class="inv-tab">📋 ${esc(this.nombreTablero(t))}</div>
        <p class="gris" style="font-size:13px">Si aceptas, verás sus tareas (con fotos, vídeos y audios) y podrás editarlas. Podrás salir cuando quieras.</p>`,
      botones:[{txt:'Ahora no', val:null}, {txt:'Rechazar', val:'no'}, {txt:'Aceptar', cls:'btn-pri', val:'si'}] });
    if(v === 'si') await this.aceptar(t.id);
    else if(v === 'no') await this.salir(t.id, true);
    setTimeout(() => this.mirarInvitaciones(), 400);
  },
  async aceptar(tid){
    try{
      await this.db.collection('tableros').doc(tid).update({ aceptados: firebase.firestore.FieldValue.arrayUnion(this.email()) });
      await this.apuntarmeEn(tid);
      toast('✅ ¡Ya estás dentro!');
      await this.conectar(tid);
    }catch(e){ console.warn(e); popAviso('No se pudo aceptar', this.textoError(e)); }
  },
  async salir(tid, rechazo){
    try{
      await this.db.collection('tableros').doc(tid).update({
        miembros: firebase.firestore.FieldValue.arrayRemove(this.email()),
        aceptados: firebase.firestore.FieldValue.arrayRemove(this.email()) });
      toast(rechazo ? 'Invitación rechazada' : '👋 Has salido del tablero');
    }catch(e){ console.warn(e); popAviso('No se pudo', this.textoError(e)); }
  },
  // me apunto (nombre, apellidos, email) en «Personas» de ese tablero
  async apuntarmeEn(tid){
    if(!this.perfil) return;
    try{
      const col = this.colDe(tid, 'personas');
      const ya = await col.where('email', '==', this.email()).get();
      const datos = { nombre:this.perfil.nombre, apellidos:this.perfil.apellidos, email:this.email(), uid:this.user.uid };
      if(ya.docs.length) await ya.docs[0].ref.update(datos);
      else { const id = nuevoId('p'); await col.doc(id).set({ id, ...datos, creada:Date.now() }); }
    }catch(e){ console.warn('apuntarme', e); }
  },

  async crearTablero(nombre, primero){
    const yo = this.email();
    const ref = await this.db.collection('tableros').add({ nombre, dueno:this.user.uid, duenoEmail:yo, duenoNombre:this.nombreYo(),
      miembros:[yo], aceptados:[yo], creado:Date.now() });
    await this.colDe(ref.id, 'config').doc('tablero').set(limpioFS({ columnas: COLUMNAS_INICIO.map(c => ({...c})), bordeColumna:true }));
    await this.apuntarmeEn(ref.id);
    if(primero) this.recienCreado = ref.id;
    return ref.id;
  },

  /* ---------- Abrir un tablero (conexión en directo) ---------- */
  async conectar(tid){
    this.desconectar();
    // La copia del móvil es del tablero abierto: si es otro, se vacía
    const cache = lsGet('ph-cache-tid');
    let subir = false;
    if(cache !== tid){
      if(!cache && this.recienCreado === tid && (App.tareas.length || App.personas.length)) subir = true;   // tareas de antes de entrar
      else {
        for(const a of ['tareas','personas','fotos','videos','audios']) await DB.vaciar(a).catch(()=>{});
        App.tareas = []; App.personas = [];
        App.ajustes.columnas = COLUMNAS_INICIO.map(c => ({...c}));
      }
      lsSet('ph-cache-tid', tid);
    }
    this.recienCreado = null;
    this.tid = tid; this.activa = true; this.tablero = this.tableros[tid] || null;
    lsSet('ph-tablero', tid);
    App.filtro = 'todas';
    pintarTodo(); pintarCabecera();
    const T = this.db.collection('tableros').doc(tid);
    this.subs.push(T.onSnapshot(d => { if(this.tid !== tid) return; this.tablero = d.exists ? { id:d.id, ...d.data() } : null; this.pintarEstado(); pintarCabecera(); }, e => this.errorSub(e)));
    if(subir) await this.subirTodo();

    this.subs.push(this.col('tareas').onSnapshot(async snap => {
      if(this.tid !== tid) return;
      for(const ch of snap.docChanges()){
        if(ch.type === 'removed') await _orig.borrar('tareas', ch.doc.id);
        else await _orig.poner('tareas', ch.doc.data());
      }
      App.tareas = snap.docs.map(d => d.data());
      await contarMedia(); pintarTodo();
      this.pintarEstado();
    }, e => this.errorSub(e)));

    this.subs.push(this.col('personas').onSnapshot(async snap => {
      if(this.tid !== tid) return;
      for(const ch of snap.docChanges()){
        if(ch.type === 'removed') await _orig.borrar('personas', ch.doc.id);
        else await _orig.poner('personas', ch.doc.data());
      }
      App.personas = snap.docs.map(d => d.data());
      pintarTodo();
    }, e => this.errorSub(e)));

    this.subs.push(this.col('config').doc('tablero').onSnapshot(async d => {
      if(this.tid !== tid) return;
      const c = d.data(); if(!c){ if(this.esDueno()) this.subirConfig(); return; }
      const a = App.ajustes;
      if(JSON.stringify(c.columnas) !== JSON.stringify(a.columnas) || c.bordeColumna !== a.bordeColumna){
        a.columnas = c.columnas; a.bordeColumna = c.bordeColumna;
        await _orig.poner('ajustes', a); pintarTodo();
      }
    }, e => this.errorSub(e)));

    this.subs.push(this.col('media').onSnapshot(async snap => {
      if(this.tid !== tid) return;
      this.media = snap.docs.map(d => d.data());
      await contarMedia(); pintarTodo();
      if(App.ed){ const p = $('#editor .tab-pan.on'); if(p && TIPOS_MEDIA.includes(p.dataset.p)) pintarMedia(p.dataset.p); }
    }, e => this.errorSub(e)));
    this.pintarEstado();
  },
  desconectar(){ this.subs.forEach(f => { try{ f(); }catch(e){} }); this.subs = []; this.activa = false; this.media = []; this.tablero = null; this.tid = null; this._minis = {}; },
  errorSub(e){
    console.warn('nube', e);
    if(e && e.code === 'permission-denied' && this.activa){
      this.desconectar(); this.pintarEstado();
      const otro = (this.misTableros()[0] || {}).id;
      if(otro) this.conectar(otro);
    }
  },
  subirConfig(){
    if(!this.activa) return;
    const a = App.ajustes;
    return this.col('config').doc('tablero').set(limpioFS({ columnas:a.columnas, bordeColumna:a.bordeColumna })).catch(e => console.warn(e));
  },
  // Primera vez: sube lo que ya había en este móvil a su tablero nuevo
  async subirTodo(){
    const [ts, ps, fs, vs, as] = await Promise.all(['tareas','personas','fotos','videos','audios'].map(a => DB.todos(a).catch(() => [])));
    toast('☁️ Subiendo tus tareas a la nube…', null, null, 8000);
    const lote = this.db.batch();
    ts.forEach(t => lote.set(this.col('tareas').doc(t.id), limpioFS(t)));
    ps.forEach(p => lote.set(this.col('personas').doc(p.id), limpioFS(p)));
    await lote.commit();
    await this.subirConfig();
    for(const f of fs) await this.subirMedia('fotos', f);
    for(const v of vs) await this.subirMedia('videos', v);
    for(const x of as) await this.subirMedia('audios', x);
    toast('✅ Todo subido a la nube');
  },

  /* ---------- Mover una tarea a otro tablero (con fotos, vídeos y audios) ---------- */
  async moverTarea(t, destino){
    if(!this.activa || destino === this.tid) return;
    const origen = this.tid, D = n => this.colDe(destino, n);
    toast('📋 Moviendo…', null, null, 15000);
    // 1. la columna: si en el otro tablero no existe, va a su primera columna sin acabar
    let cols = COLUMNAS_INICIO;
    try{ const c = await D('config').doc('tablero').get(); if(c.exists && c.data().columnas) cols = c.data().columnas; }catch(e){}
    const nueva = limpioFS(limpiaTarea(t));
    if(!cols.some(c => c.id === nueva.colId)) nueva.colId = (cols.find(c => !c.hecha) || cols[0]).id;
    delete nueva.colPrev;
    // 2. la persona asignada: se busca por email en el otro tablero (o se apunta)
    const p = persona(t.personaId);
    if(p){
      let pid = '';
      if(p.email){ const ya = await D('personas').where('email', '==', p.email.toLowerCase()).get(); if(ya.docs.length) pid = ya.docs[0].id; }
      if(!pid){ pid = nuevoId('p'); await D('personas').doc(pid).set(limpioFS({ ...p, id:pid, email:(p.email||'').toLowerCase() })); }
      nueva.personaId = pid;
    }
    // 3. fotos, vídeos y audios (con sus trozos)
    const medias = this.media.filter(m => m.tareaId === t.id);
    for(const m of medias){
      const trozos = await this.col('trozos').where('mid', '==', m.id).get();
      for(const d of trozos.docs) await D('trozos').doc(d.id).set(d.data());
      await D('media').doc(m.id).set(m);
    }
    // 4. la tarea en el tablero nuevo, y fuera del de ahora
    nueva.actualizada = Date.now(); nueva.orden = -Date.now();
    await D('tareas').doc(nueva.id).set(nueva);
    for(const m of medias){ await this.borrarMedia(m.id); for(const a of TIPOS_MEDIA) await _orig.borrar(a, m.id).catch(()=>{}); }
    await this.col('tareas').doc(t.id).delete();
    await _orig.borrar('tareas', t.id);
    $('#toast').classList.remove('ver');
  },

  /* ---------- Compartir un tablero ---------- */
  async invitar(tid, persona){
    const t = this.tableros[tid]; if(!t || !this.esDueno(t)) return;
    const email = persona.email.trim().toLowerCase();
    if(email === this.email()){ toast('Ese eres tú 😊'); return; }
    await this.db.collection('tableros').doc(tid).update({ miembros: firebase.firestore.FieldValue.arrayUnion(email) });
    // se apunta sola en «Personas» de ese tablero
    try{
      const col = this.colDe(tid, 'personas');
      const ya = await col.where('email', '==', email).get();
      const datos = { nombre:persona.nombre.trim(), apellidos:(persona.apellidos||'').trim(), email };
      if(ya.docs.length) await ya.docs[0].ref.update(datos);
      else { const id = nuevoId('p'); await col.doc(id).set({ id, ...datos, creada:Date.now() }); }
    }catch(e){ console.warn(e); }
    await Correo.invitacion({ ...persona, email }, t);
  },
  async sacar(tid, email){
    const t = this.tableros[tid]; if(!t || !this.esDueno(t)) return;
    if(!await popConfirmar('¿Sacar del tablero?', email + ' dejará de ver «' + this.nombreTablero(t) + '». Sus tareas se quedan.', 'Sacar')) return;
    await this.db.collection('tableros').doc(tid).update({
      miembros: firebase.firestore.FieldValue.arrayRemove(email),
      aceptados: firebase.firestore.FieldValue.arrayRemove(email) });
    toast('Hecho: ya no está en el tablero');
  },
  async renombrar(tid){
    const t = this.tableros[tid];
    const v = await popup({ tit:'Nombre del tablero', html:`<input id="tbNom" maxlength="40" value="${esc(this.nombreTablero(t))}">`,
      botones:[{txt:'Cancelar', val:null}, {txt:'Guardar', cls:'btn-pri', val:c => $('#tbNom',c).value.trim()}],
      alAbrir:c => setTimeout(() => $('#tbNom',c).select(), 200) });
    if(v) await this.db.collection('tableros').doc(tid).update({ nombre:v });
  },
  async nuevo(){
    const v = await popup({ tit:'Nuevo tablero', html:'<p class="gris" style="font-size:13px">Por ejemplo: Casa, Cole, Viaje, Labores…</p><input id="tbNom" maxlength="40" placeholder="Nombre del tablero">',
      botones:[{txt:'Cancelar', val:null}, {txt:'Crear', cls:'btn-pri', val:c => $('#tbNom',c).value.trim()}],
      alAbrir:c => setTimeout(() => $('#tbNom',c).focus(), 200) });
    if(!v) return;
    try{ const id = await this.crearTablero(v); this.tableros[id] = this.tableros[id] || { id, dueno:this.user.uid, nombre:v, miembros:[this.email()], aceptados:[this.email()] }; await this.conectar(id); toast('📋 Tablero «' + v + '» creado'); }
    catch(e){ popAviso('No se pudo crear', this.textoError(e)); }
  },
  async borrarTablero(tid){
    const t = this.tableros[tid];
    if(this.misTableros().length < 2){ popAviso('No se puede', 'Es tu único tablero. Crea otro antes de borrar este.'); return; }
    if(!await popConfirmar('¿Borrar «' + this.nombreTablero(t) + '»?', 'Se borrarán todas sus tareas, fotos, vídeos y audios, también para las personas con quien lo compartes. No se puede deshacer.', 'Borrar para siempre')) return;
    toast('🗑 Borrando…', null, null, 10000);
    try{
      if(this.tid === tid) await this.conectar(this.misTableros().find(x => x.id !== tid).id);
      for(const c of ['tareas','personas','config','media','trozos']){
        const snap = await this.colDe(tid, c).get();
        for(const d of snap.docs) await d.ref.delete();
      }
      await this.db.collection('tableros').doc(tid).delete();
      toast('Tablero borrado');
    }catch(e){ console.warn(e); popAviso('No se pudo borrar', this.textoError(e)); }
  },
  async elegirTablero(){
    if(!this.activa){ Ajustes.abrir(); Ajustes.tab('tableros'); return; }
    const lista = [...this.misTableros(), ...this.compartidos()];
    const v = await popup({ tit:'📋 Tableros',
      html: lista.map(t => `<button class="opcion ${t.id===this.tid?'on':''}" data-t="${t.id}">📋 ${esc(this.nombreTablero(t))}<small class="gris" style="margin-left:auto;font-size:12px">${this.esDueno(t) ? ((t.miembros||[]).length > 1 ? '👥 ' + (t.miembros.length) : 'tuyo') : 'de ' + esc((t.duenoNombre||t.duenoEmail||'').split(' ')[0])}</small></button>`).join('')
        + (this.invitaciones().length ? `<button class="opcion" data-t="__inv">📬 Tienes ${this.invitaciones().length} invitación(es)</button>` : '')
        + `<button class="opcion" data-t="__nuevo">＋ Nuevo tablero</button><button class="opcion" data-t="__gest">⚙️ Gestionar y compartir</button>`,
      botones:[{txt:'Cerrar', val:null}],
      alAbrir:(c, fin) => $$('.opcion', c).forEach(b => b.onclick = () => fin(b.dataset.t)) });
    if(!v) return;
    if(v === '__nuevo') return this.nuevo();
    if(v === '__gest'){ Ajustes.abrir(); Ajustes.tab('tableros'); return; }
    if(v === '__inv'){ this.avisadas = {}; return this.mirarInvitaciones(); }
    if(v !== this.tid) await this.conectar(v);
  },
  // Formulario para compartir: elegir tablero + nombre, apellidos, email
  async compartir(tidPre, personaPre){
    const mios = this.misTableros();
    const p = personaPre || {};
    const v = await popup({ tit:'👥 Compartir un tablero',
      html:`<label class="lbl" style="margin-top:0">Tablero que compartes</label>
        <select id="shTab">${mios.map(t => `<option value="${t.id}" ${t.id===(tidPre||this.tid)?'selected':''}>📋 ${esc(this.nombreTablero(t))}</option>`).join('')}</select>
        <label class="lbl">Con quién</label>
        <input id="shNom" placeholder="Nombre" value="${esc(p.nombre||'')}">
        <input id="shApe" placeholder="Apellidos" value="${esc(p.apellidos||'')}">
        <input id="shMail" type="email" inputmode="email" placeholder="Email" value="${esc(p.email||'')}">
        <p class="gris" style="font-size:12.5px;margin-top:8px">Le llegará un email con la invitación y el enlace de la app. Tiene que crear su cuenta con <b>este mismo email</b>.</p>`,
      botones:[{txt:'Cancelar', val:null}, {txt:'Invitar', cls:'btn-pri',
        validar:c => { const m = $('#shMail',c).value.trim(); if(!$('#shNom',c).value.trim()){ $('#shNom',c).focus(); return false; }
          if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m)){ $('#shMail',c).focus(); toast('✉️ Revisa el email'); return false; } return true; },
        val:c => ({ tid:$('#shTab',c).value, nombre:$('#shNom',c).value, apellidos:$('#shApe',c).value, email:$('#shMail',c).value })}],
      alAbrir:c => setTimeout(() => (p.nombre ? $('#shMail',c) : $('#shNom',c)).focus(), 200) });
    if(!v) return;
    try{ await this.invitar(v.tid, v); toast('📬 Invitación enviada'); }
    catch(e){ console.warn(e); popAviso('No se pudo compartir', this.textoError(e)); }
    if($('#ajustes').classList.contains('abierto')) Ajustes.tab($('#ajTabs .on').dataset.t);
  },

  /* ---------- Fotos, vídeos y audios ----------
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
    if(!o || !o.blob || !this.activa) return;
    if(this.media.some(m => m.id === o.id)) return;
    const nom = { fotos:'foto', videos:'vídeo', audios:'audio' }[tipo];
    const pequeña = tipo === 'fotos' ? o.mini : tipo === 'videos' ? o.poster : null;
    const tam = (o.blob.size||0) + (pequeña ? pequeña.size : 0);
    if(this.usadoNube() + tam > this.LIMITE * 0.97){
      popAviso('Nube llena', 'Ya casi no queda sitio gratis en la nube (1 GB). Este ' + nom + ' se queda solo en este móvil. Borra vídeos antiguos para hacer sitio.');
      return;
    }
    this.subiendo++; this.pintarEstado();
    try{
      const meta = { id:o.id, tareaId:o.tareaId, tipo, size:o.blob.size||0, original:o.original||0, w:o.w||0, h:o.h||0, dur:o.dur||0,
        nombre:o.nombre||'', fecha:o.fecha||Date.now(), mime:o.tipo||o.blob.type||'', autor:this.email(), autorNombre:this.nombreYo(), listo:false };
      meta.partes = await this._subirTrozos(o.id, o.id, o.blob);
      if(pequeña){ meta.partesMini = await this._subirTrozos(o.id, o.id + '_m', pequeña); meta.sizeMini = pequeña.size; }
      meta.listo = true;
      await this.col('media').doc(o.id).set(limpioFS(meta));
    }catch(e){ console.warn(e); toast('⚠️ No se pudo subir un ' + nom + ' a la nube'); }
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
      else if(TIPOS_MEDIA.includes(a)) N.subirMedia(a, o);
    };
    DB.poner = async (a, o) => { const r = await _orig.poner(a, o); subirDoc(a, o); return r; };
    DB.ponerVarios = async (a, l) => { const r = await _orig.ponerVarios(a, l); l.forEach(o => subirDoc(a, o)); return r; };
    DB.borrar = async (a, id) => {
      const r = await _orig.borrar(a, id);
      if(N.activa){
        if(a === 'tareas' || a === 'personas') N.col(a).doc(id).delete().catch(e => console.warn(e));
        else if(TIPOS_MEDIA.includes(a)) N.borrarMedia(id);
      }
      return r;
    };
    DB.borrarDeTarea = async (a, tareaId) => {
      const n = await _orig.borrarDeTarea(a, tareaId);
      if(N.activa) N.media.filter(m => m.tareaId === tareaId && m.tipo === a).forEach(m => N.borrarMedia(m.id));
      return n;
    };
    // Lo de una tarea: lo de este móvil + lo que subieron los demás
    DB.deTarea = async (a, tareaId) => {
      const loc = await _orig.deTarea(a, tareaId);
      if(!N.activa || !TIPOS_MEDIA.includes(a)) return loc;
      const idx = Object.fromEntries(loc.map(x => [x.id, x]));
      const out = N.media.filter(m => m.tareaId === tareaId && m.tipo === a).map(m => ({ ...m, ...(idx[m.id] || {}), tipo: (idx[m.id]||{}).tipo || m.mime }));
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
      if(loc || !N.activa || !TIPOS_MEDIA.includes(a)) return loc;
      const m = N.media.find(x => x.id === id); if(!m) return null;
      if(!m.listo) return { ...m };
      if(a === 'videos') toast('⬇️ Descargando el vídeo…', null, null, 15000);
      const blob = await N._bajarTrozos(m.id, m.partes, m.mime || ({fotos:'image/jpeg', videos:'video/mp4', audios:'audio/mpeg'})[a]).catch(e => { console.warn(e); return null; });
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

  /* ---------- Indicador y pantallas de entrada ---------- */
  pintarEstado(forzado){
    const el = $('#nubeEstado'); if(!el) return;
    if(!this.configurada()){ el.hidden = true; return; }
    el.hidden = false;
    let ico = '☁︎', tit = 'Sincronizado con la nube', off = false;
    if(forzado){ ico = forzado; tit = 'Conectando…'; }
    else if(!this.activa){ tit = 'Sin conectar (toca para entrar)'; off = true; }
    else if(!this.online){ tit = 'Sin internet: se guardará al volver'; off = true; }
    else if(this.subiendo){ ico = '⬆︎' + this.subiendo; tit = 'Subiendo fotos, vídeos o audios…'; }
    el.classList.toggle('off', off);
    el.textContent = ico; el.title = tit;
  },
  pantalla(html, alAbrir){
    $('#nubeCuerpo').innerHTML = html + `<div class="nube-ver">PorHacer ${VERSION}</div>`;
    abrir('nube');
    alAbrir && alAbrir($('#nubeCuerpo'));
  },
  pantallaEntrar(modo='entrar'){
    const reg = modo === 'registro';
    const inv = !!this.invitacionUrl;
    this.pantalla(`
      <img src="logo.png" class="nube-logo" alt="">
      <h2>${reg ? 'Crear cuenta' : 'Entrar en PorHacer'}</h2>
      <p class="nube-txt">${inv ? '📬 <b>Te han invitado a un tablero.</b> ' + (reg ? 'Crea tu cuenta con el email al que te ha llegado la invitación.' : 'Entra o, si es la primera vez, crea tu cuenta.') : reg ? 'Solo hace falta una vez. Después entrarás siempre con tu email.' : 'Tus tareas, en todos tus dispositivos.'}</p>
      ${reg ? '<div class="fila-nom"><input id="nbNom" autocomplete="given-name" placeholder="Nombre"><input id="nbApe" autocomplete="family-name" placeholder="Apellidos"></div>' : ''}
      <input id="nbMail" type="email" inputmode="email" autocomplete="email" placeholder="Email">
      <input id="nbPass" type="password" autocomplete="${reg?'new-password':'current-password'}" placeholder="Contraseña${reg?' (mínimo 6 letras o números)':''}">
      ${reg ? '<input id="nbPass2" type="password" autocomplete="new-password" placeholder="Repite la contraseña">' : ''}
      <div class="nube-error" id="nbErr"></div>
      <button class="btn-pri btn-ancho" id="nbOk">${reg ? 'Crear cuenta' : 'Entrar'}</button>
      <button class="nube-link" id="nbOtro">${reg ? '¿Ya tienes cuenta? <b>Entrar</b>' : '¿Primera vez? <b>Crear cuenta</b>'}</button>
      ${reg ? '' : '<button class="nube-link suave" id="nbOlvido">He olvidado la contraseña</button>'}`, c => {
      const err = t => $('#nbErr', c).textContent = t;
      $('#nbOtro', c).onclick = () => this.pantallaEntrar(reg ? 'entrar' : 'registro');
      if(!reg) $('#nbOlvido', c).onclick = async () => {
        const m = $('#nbMail', c).value.trim(); if(!m){ err('Escribe primero tu email.'); return; }
        const vuelta = { url: location.origin + location.pathname };
        try{
          try{ await this.auth.sendPasswordResetEmail(m, vuelta); }
          catch(e1){ if(/continue-uri|unauthorized-domain|invalid-continue/.test(e1.code||'')) await this.auth.sendPasswordResetEmail(m); else throw e1; }
          err('');
          popup({ tit:'📧 Revisa tu correo', html:`<p>Si hay una cuenta de PorHacer con <b>${esc(m)}</b>, te llegará un email para poner una contraseña nueva.</p>
            <p style="margin-top:8px">• Mira también en <b>Spam / Correo no deseado</b> y en <b>Promociones</b>.<br>• Lo envía <b>noreply@porhacer-36f11.firebaseapp.com</b>.<br>• Puede tardar unos minutos.</p>
            <p style="margin-top:8px">Si no llega, revisa que el email esté bien escrito: tiene que ser <b>el mismo con el que creaste la cuenta</b>.</p>`,
            botones:[{ txt:'Entendido', cls:'btn-pri', val:true }] });
        }catch(e){ err(this.textoError(e)); }
      };
      $('#nbPass', c).onkeydown = e => { if(e.key === 'Enter' && !reg) $('#nbOk', c).click(); };
      $('#nbOk', c).onclick = async () => {
        const m = $('#nbMail', c).value.trim(), p = $('#nbPass', c).value;
        if(reg && !$('#nbNom', c).value.trim()){ err('Escribe tu nombre.'); $('#nbNom', c).focus(); return; }
        if(!m || !p){ err('Escribe el email y la contraseña.'); return; }
        if(reg && p !== $('#nbPass2', c).value){ err('Las dos contraseñas no son iguales.'); return; }
        $('#nbOk', c).disabled = true; err('');
        try{
          if(reg){
            const nom = $('#nbNom', c).value.trim(), ape = $('#nbApe', c).value.trim();
            const r = await this.auth.createUserWithEmailAndPassword(m, p);
            await r.user.updateProfile({ displayName: nom + '|' + ape });
            await r.user.sendEmailVerification();
            this.user = r.user; this.pantallaVerificar();
          }
          else await this.auth.signInWithEmailAndPassword(m, p);
        }catch(e){ err(this.textoError(e)); }
        const b = $('#nbOk', c); if(b) b.disabled = false;
      };
      setTimeout(() => { const f = $('#nbNom', c) || $('#nbMail', c); f && f.focus(); }, 250);
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
        await this.auth.currentUser.reload();
        if(this.auth.currentUser.emailVerified){ await this.auth.currentUser.getIdToken(true); this.alCambiarUsuario(this.auth.currentUser); }
        else $('#nbErr', c).textContent = 'Todavía no consta como confirmado. Pulsa el enlace del correo y prueba otra vez.';
      };
      $('#nbReenviar', c).onclick = async () => { try{ await this.auth.currentUser.sendEmailVerification(); toast('✉️ Correo enviado otra vez'); }catch(e){ $('#nbErr', c).textContent = this.textoError(e); } };
      $('#nbSalir', c).onclick = () => this.auth.signOut();
    });
  },
  // Para quien ya tenía cuenta sin nombre
  pantallaPerfil(){
    this.pantalla(`
      <div class="nube-gran">👋</div>
      <h2>¿Cómo te llamas?</h2>
      <p class="nube-txt">Así los demás sabrán quién eres cuando compartáis tableros y tareas.</p>
      <div class="fila-nom"><input id="nbNom" autocomplete="given-name" placeholder="Nombre"><input id="nbApe" autocomplete="family-name" placeholder="Apellidos"></div>
      <div class="nube-error" id="nbErr"></div>
      <button class="btn-pri btn-ancho" id="nbOk">Continuar</button>
      <button class="nube-link suave" id="nbSalir">Cerrar sesión</button>`, c => {
      $('#nbOk', c).onclick = async () => {
        const n = $('#nbNom', c).value.trim(); if(!n){ $('#nbErr', c).textContent = 'Escribe tu nombre.'; return; }
        try{ await this.guardarPerfil(n, $('#nbApe', c).value); this.alCambiarUsuario(this.auth.currentUser); }
        catch(e){ $('#nbErr', c).textContent = this.textoError(e); }
      };
      $('#nbSalir', c).onclick = () => this.auth.signOut();
      setTimeout(() => $('#nbNom', c).focus(), 250);
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
      'permission-denied':'Firebase no da permiso. ¿Están pegadas las reglas nuevas de la V4? (mira NOTAS.md)'
    })[c] || ('Algo ha fallado: ' + (e && e.message || e));
  },

  /* ---------- Pestaña «Tableros» en Configuración ---------- */
  htmlMiembros(t){
    const dueno = this.esDueno(t);
    const pers = Object.fromEntries((this.tid === t.id ? App.personas : []).filter(p => p.email).map(p => [p.email.toLowerCase(), p]));
    const nombre = em => pers[em] ? nombreP(pers[em]) : em === t.duenoEmail && t.duenoNombre ? t.duenoNombre : em;
    return (t.miembros || []).map(em => {
      const esD = em === t.duenoEmail, ok = esD || this.aceptados(t).includes(em);
      return `<div class="miembro"><span class="avatar" style="background:${esD ? 'var(--accent)' : ok ? '#22a55a' : '#b0b0b8'}">${esc((nombre(em)[0]||'?').toUpperCase())}</span>
        <div><b>${esc(nombre(em))}${em === this.email() ? ' (tú)' : ''}</b><small>${esc(em)} · ${esD ? 'Dueño/a' : ok ? '✅ Dentro' : '⏳ Invitación enviada'}</small></div>
        ${dueno && !esD ? `${ok ? '' : `<button class="ico-b" data-acc="reenviar" data-t="${t.id}" data-em="${esc(em)}" title="Reenviar invitación">📧</button>`}<button class="ico-b peligro" data-acc="sacar" data-t="${t.id}" data-em="${esc(em)}" title="Sacar del tablero">✕</button>` : ''}</div>`;
    }).join('');
  },
  pintarTableros(cont){
    if(!this.configurada()){ cont.innerHTML = '<p class="aj-ayuda">La nube no está configurada.</p>'; return; }
    if(!this.user){
      cont.innerHTML = `<div class="aj-sec"><h4>Tableros</h4><p class="aj-ayuda">Entra con tu email para ver tus tableros.</p><button class="btn-pri btn-ancho" id="njEntrar">Entrar</button></div>`;
      $('#njEntrar').onclick = () => { cerrar('ajustes'); this.pantallaEntrar(); };
      return;
    }
    const mios = this.misTableros(), comp = this.compartidos(), inv = this.invitaciones();
    const tarjeta = t => {
      const dueno = this.esDueno(t), abierto = t.id === this.tid;
      return `<div class="tab-card ${abierto ? 'abierto' : ''}">
        <div class="tab-cab"><b>📋 ${esc(this.nombreTablero(t))}</b>${abierto ? '<span class="tab-on">Abierto</span>' : `<button class="mini-btn" data-acc="abrir" data-t="${t.id}">Abrir</button>`}</div>
        ${dueno ? '' : `<p class="aj-ayuda" style="margin:2px 0 6px">Compartido por ${esc(t.duenoNombre || t.duenoEmail)}</p>`}
        <div class="miembros">${this.htmlMiembros(t)}</div>
        <div class="tab-acc">${dueno ? `<button class="mini-btn pri" data-acc="compartir" data-t="${t.id}">👥 Compartir</button><button class="mini-btn" data-acc="renombrar" data-t="${t.id}">✏️ Nombre</button><button class="mini-btn peligro" data-acc="borrar" data-t="${t.id}">🗑</button>`
          : `<button class="mini-btn peligro" data-acc="salir" data-t="${t.id}">🚪 Salir del tablero</button>`}</div>
      </div>`;
    };
    cont.innerHTML = `
      <div class="aj-sec"><h4>Tu cuenta</h4>
        <div class="per-fila"><span class="avatar" style="background:var(--accent)">${esc((this.perfil?.nombre||'?')[0].toUpperCase())}</span><div><b>${esc(this.nombreYo())}</b><small>${esc(this.email())}</small></div>
        <button class="ico-b" id="njNombre" title="Cambiar nombre">✏️</button></div></div>
      ${inv.length ? `<div class="aj-sec"><h4>📬 Invitaciones</h4>${inv.map(t => `<div class="tab-card inv"><div class="tab-cab"><b>📋 ${esc(this.nombreTablero(t))}</b></div><p class="aj-ayuda" style="margin:2px 0 8px">${esc(t.duenoNombre || t.duenoEmail)} te invita</p><div class="tab-acc"><button class="mini-btn pri" data-acc="aceptar" data-t="${t.id}">✅ Aceptar</button><button class="mini-btn" data-acc="rechazar" data-t="${t.id}">Rechazar</button></div></div>`).join('')}</div>` : ''}
      <div class="aj-sec"><h4>Mis tableros</h4>${mios.map(tarjeta).join('')}
        <button class="btn-sec btn-ancho" id="njNuevo">＋ Nuevo tablero</button></div>
      ${comp.length ? `<div class="aj-sec"><h4>Compartidos conmigo</h4>${comp.map(tarjeta).join('')}</div>` : ''}
      <div class="aj-sec"><h4>Espacio</h4><div class="espacio">
        <p style="margin:0">📷🎬🎙️ Este tablero usa <b>${tamTxt(this.usadoNube())}</b> · gratis hasta 1 GB entre todos</p>
        <div class="barra-prog"><i style="width:${Math.max(1, Math.min(100, this.usadoNube()/this.LIMITE*100))}%"></i></div>
        <p>${this.online ? (this.subiendo ? '⬆️ Subiendo ' + this.subiendo + ' archivo(s)…' : '✅ Todo guardado en la nube') : '📴 Sin internet: se guardará al volver la conexión.'}</p></div></div>
      <button class="btn-sec btn-ancho" id="njSalir" style="margin-top:14px">Cerrar sesión</button>
      <div class="pie-copy">PorHacer ${VERSION}</div>`;
    const re = () => this.pintarTableros(cont);
    $('#njNuevo').onclick = async () => { await this.nuevo(); re(); };
    $('#njSalir').onclick = async () => { if(await popConfirmar('¿Cerrar sesión?', 'Para volver a ver tus tableros tendrás que entrar con tu email y contraseña.', 'Cerrar sesión')){ cerrar('ajustes'); lsSet('ph-cache-tid', null); await this.auth.signOut(); } };
    $('#njNombre').onclick = async () => {
      const v = await popup({ tit:'Tu nombre', html:`<input id="pfN" placeholder="Nombre" value="${esc(this.perfil?.nombre||'')}"><input id="pfA" placeholder="Apellidos" value="${esc(this.perfil?.apellidos||'')}">`,
        botones:[{txt:'Cancelar', val:null}, {txt:'Guardar', cls:'btn-pri', val:c => ({ n:$('#pfN',c).value.trim(), a:$('#pfA',c).value.trim() })}] });
      if(v && v.n){ await this.guardarPerfil(v.n, v.a); re(); }
    };
    $$('[data-acc]', cont).forEach(b => b.onclick = async () => {
      const tid = b.dataset.t, acc = b.dataset.acc;
      if(acc === 'abrir'){ await this.conectar(tid); cerrar('ajustes'); toast('📋 ' + this.nombreTablero(this.tableros[tid])); return; }
      if(acc === 'compartir') return this.compartir(tid);
      if(acc === 'renombrar') await this.renombrar(tid);
      if(acc === 'borrar') await this.borrarTablero(tid);
      if(acc === 'salir'){ if(!await popConfirmar('¿Salir del tablero?', 'Dejarás de ver «' + this.nombreTablero(this.tableros[tid]) + '». Te pueden volver a invitar.', 'Salir')) return; await this.salir(tid); }
      if(acc === 'aceptar'){ await this.aceptar(tid); cerrar('ajustes'); return; }
      if(acc === 'rechazar') await this.salir(tid, true);
      if(acc === 'sacar') await this.sacar(tid, b.dataset.em);
      if(acc === 'reenviar'){
        const t = this.tableros[tid], em = b.dataset.em;
        const p = (tid === this.tid ? App.personas : []).find(x => (x.email||'').toLowerCase() === em) || { nombre:em.split('@')[0], email:em };
        await Correo.invitacion(p, t); toast('📧 Invitación reenviada');
      }
      setTimeout(re, 300);
    });
  }
};
