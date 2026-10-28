/* PorHacer · Listas fáciles (al estilo de Microsoft To Do)
   Listas sencillas, tuyas, que no son de ningún tablero. Cada punto se puede
   marcar, poner como importante ⭐, deslizar a un lado para borrarlo o al otro
   para pasarlo como tarea al PorHacer (eligiendo el tablero).
   Se guardan en la nube, en tu cuenta (usuarios/{uid}/listas), y solo las ves tú.
   Si no hay sesión (o la nube no deja), se guardan en este aparato.            */

const Listas = {
  datos: [],            // [{ id, nombre, orden, creada, tema:{color}, modo, items:[{id,t,ok,imp,creado,hecho,env}] }]
  fondos: {},           // id → dataURL (imagen de fondo)
  actual: null,
  modo: 'local', uid: null, _subs: [], verHechos: true, reordenar: false,

  TEMAS: [
    ['app', 'Como la app', null],
    ['petroleo', 'Petróleo', 'linear-gradient(180deg,#2f6f73,#7fa9a6 60%,#d8c6bf)'],
    ['azul', 'Azul', 'linear-gradient(180deg,#2c5fa8,#76a7e0)'],
    ['lila', 'Lila', 'linear-gradient(180deg,#5b4a9e,#a593d8)'],
    ['rosa', 'Rosa', 'linear-gradient(180deg,#b04a74,#eaa1bd)'],
    ['rojo', 'Rojo', 'linear-gradient(180deg,#b3261e,#ef7a70)'],
    ['naranja', 'Naranja', 'linear-gradient(180deg,#c2581b,#f3a76b)'],
    ['verde', 'Verde', 'linear-gradient(180deg,#2c7a4b,#86c79b)'],
    ['oliva', 'Oliva', 'linear-gradient(180deg,#5d6b2d,#a8b56a)'],
    ['gris', 'Gris', 'linear-gradient(180deg,#3a3a3c,#8e8e93)'],
    ['noche', 'Noche', 'linear-gradient(180deg,#151a2e,#3c4a78)'],
  ],
  ORDEN: [['manual', 'Como yo las ponga'], ['imp', 'Importancia ⭐'], ['alfa', 'Alfabético'], ['fecha', 'Fecha de creación']],

  /* ---------------- Guardar y cargar ---------------- */
  lsGuardar(){ try{ localStorage.setItem('ph-listas', JSON.stringify({ datos:this.datos, fondos:this.fondos })); }catch(e){ toast('⚠️ No caben más imágenes de fondo en este aparato'); } },
  lsCargar(){ try{ const x = JSON.parse(localStorage.getItem('ph-listas') || 'null'); if(x){ this.datos = x.datos || []; this.fondos = x.fondos || {}; } }catch(e){} },
  ref(n){ return Nube.db.collection('usuarios').doc(this.uid).collection(n); },
  vigilar(){
    const u = (typeof Nube !== 'undefined' && Nube.user) ? Nube.user.uid : null;
    if(this._iniciado && u === this.uid) return;
    this._iniciado = true;
    this._subs.forEach(f => { try{ f(); }catch(e){} }); this._subs = [];
    this.uid = u;
    if(!u){ this.modo = 'local'; this.lsCargar(); this.asegurar(); this.pintar(); return; }
    this.modo = 'nube';
    const subir = JSON.parse(localStorage.getItem('ph-listas') || 'null');   // lo que hubiera en el aparato, se sube una vez
    let primera = true;
    this._subs.push(this.ref('listas').onSnapshot(async snap => {
      this.datos = snap.docs.map(d => d.data()).sort((a, b) => (a.orden || 0) - (b.orden || 0));
      if(primera){ primera = false;
        if(subir && subir.datos && subir.datos.length && !localStorage.getItem('ph-listas-subidas-' + u)){
          for(const l of subir.datos) if(!this.datos.some(x => x.id === l.id)) await this.ref('listas').doc(l.id).set(limpioFS(l));
          for(const [id, img] of Object.entries(subir.fondos || {})) await this.ref('fondos').doc(id).set({ img });
          localStorage.setItem('ph-listas-subidas-' + u, '1'); return;
        }
        if(!this.datos.length){ await this.crear('Mis cosas', true); return; }
      }
      this.pintar();
    }, e => this.falloNube(e)));
    this._subs.push(this.ref('fondos').onSnapshot(snap => { snap.docChanges().forEach(c => { if(c.type === 'removed') delete this.fondos[c.doc.id]; else this.fondos[c.doc.id] = c.doc.data().img; }); this.pintarFondo(); }, () => {}));
  },
  falloNube(e){
    console.warn('listas', e);
    this.modo = 'local'; this._falloNube = true; this.lsCargar(); this.asegurar(); this.pintar();
    if(e && e.code === 'permission-denied' && !this._avisado){ this._avisado = true;
      popAviso('Listas en este aparato', 'Para que las listas se guarden en la nube (y las veas en todos tus aparatos) hay que añadir una regla nueva en Firebase. Mientras tanto, se guardan en este aparato.'); }
  },
  asegurar(){ if(!this.datos.length){ this.datos.push(this.nueva('Mis cosas')); this.lsGuardar(); } },
  nueva(nombre){ return { id:nuevoId('l'), nombre, orden:Date.now(), creada:Date.now(), tema:{ color:'app' }, modo:'manual', items:[] }; },
  async guardar(l){
    l.cambiada = Date.now();
    if(this.modo === 'nube'){ try{ await this.ref('listas').doc(l.id).set(limpioFS(JSON.parse(JSON.stringify(l)))); }catch(e){ this.falloNube(e); } }
    else this.lsGuardar();
    this.pintar();
  },
  async crear(nombre, silencio){
    const l = this.nueva(nombre);
    if(this.modo === 'nube'){ try{ await this.ref('listas').doc(l.id).set(limpioFS(l)); }catch(e){ this.falloNube(e); this.datos.push(l); this.lsGuardar(); } }
    else { this.datos.push(l); this.lsGuardar(); }
    this.actual = l.id; lsSet('ph-lista', l.id); this.pintar();
    if(!silencio) toast('📝 Lista «' + nombre + '» creada');
    return l;
  },
  async borrar(l){
    if(this.modo === 'nube'){ try{ await this.ref('listas').doc(l.id).delete(); await this.ref('fondos').doc(l.id).delete().catch(() => {}); }catch(e){ this.falloNube(e); } }
    this.datos = this.datos.filter(x => x.id !== l.id); delete this.fondos[l.id];
    if(this.modo !== 'nube'){ this.asegurar(); this.lsGuardar(); }
    this.actual = null; this.pintar();
  },
  async ponerFondo(l, img){
    if(img) this.fondos[l.id] = img; else delete this.fondos[l.id];
    if(this.modo === 'nube'){ try{ if(img) await this.ref('fondos').doc(l.id).set({ img }); else await this.ref('fondos').doc(l.id).delete(); }catch(e){ this.falloNube(e); } }
    else this.lsGuardar();
    this.pintarFondo();
  },
  // Al principio, los colores de la app (grises y rojo, como el icono); cambian si eliges otro tema
  colorDe(l){ return (l.tema && l.tema.elegido && l.tema.color) || 'app'; },
  lista(){ let l = this.datos.find(x => x.id === (this.actual || lsGet('ph-lista'))); if(!l) l = this.datos[0]; if(l) this.actual = l.id; return l; },

  /* ---------------- Pantalla ---------------- */
  abrir(){
    ['vTablero', 'vCal'].forEach(v => $('#' + v).classList.remove('activa'));
    $('#vListas').classList.add('activa'); $('#fab').style.display = 'none';
    this.vigilar(); this.pintar();
  },
  cerrar(a){ $('#vListas').classList.remove('activa'); $('#lsNuevo').blur(); if(a === 'cal') Cal.abrir(); else { $('#vTablero').classList.add('activa'); $('#fab').style.display = ''; pintarTodo(); } },
  pintarFondo(){
    const l = this.lista(), v = $('#vListas'); if(!l) return;
    const t = this.TEMAS.find(x => x[0] === this.colorDe(l)) || this.TEMAS[0], img = this.fondos[l.id];
    v.style.backgroundImage = img ? `url(${img})` : (t[2] || ''); v.classList.toggle('ls-app', !img && !t[2]);
  },
  ordenados(l, hechos){
    const it = l.items.filter(x => !!x.ok === hechos);
    if(hechos) return it.sort((a, b) => (b.hecho || 0) - (a.hecho || 0));
    const m = l.modo || 'manual';
    if(m === 'imp') return it.sort((a, b) => (b.imp ? 1 : 0) - (a.imp ? 1 : 0) || (a.pos || 0) - (b.pos || 0));
    if(m === 'alfa') return it.sort((a, b) => a.t.localeCompare(b.t, 'es'));
    if(m === 'fecha') return it.sort((a, b) => (b.creado || 0) - (a.creado || 0));
    return it.sort((a, b) => (a.pos || 0) - (b.pos || 0));
  },
  pintar(){
    if(!$('#vListas') || !$('#vListas').classList.contains('activa')) return;
    const l = this.lista(); if(!l) return;
    const d = new Date(), f = DIAS[d.getDay()] + ', ' + d.getDate() + ' de ' + MESES[d.getMonth()];
    $('#lsTitulo').innerHTML = `<b>${esc(l.nombre)}</b><span class="ls-flecha">▾</span>`;
    $('#lsFecha').textContent = f.charAt(0).toUpperCase() + f.slice(1) + (this.modo === 'local' ? ' · en este aparato' : '');
    this.pintarFondo();
    const pend = this.ordenados(l, false), hechos = this.ordenados(l, true);
    const fila = (x, i, n) => `<div class="ls-item ${x.ok ? 'ok' : ''}" data-id="${x.id}" tabindex="0">
        <div class="ls-acc izq"><span>📋 Al PorHacer</span></div><div class="ls-acc der"><span>🗑 Borrar</span></div>
        <div class="ls-cara">
          <button class="ls-check" aria-label="${x.ok ? 'Desmarcar' : 'Marcar como hecho'}">${x.ok ? '✓' : ''}</button>
          <div class="ls-txt"><span>${esc(x.t)}</span>${x.env ? `<small>📋 En «${esc(x.env)}»</small>` : x.nota ? `<small>${esc(x.nota)}</small>` : ''}</div>
          ${this.reordenar && !x.ok ? `<button class="ls-mov" data-m="-1" ${i === 0 ? 'disabled' : ''}>↑</button><button class="ls-mov" data-m="1" ${i === n - 1 ? 'disabled' : ''}>↓</button>`
            : `<span class="ls-pc"><button class="ls-pc-b" data-pc="enviar" title="Pasar al PorHacer">📋</button><button class="ls-pc-b" data-pc="borrar" title="Borrar">🗑</button></span>
               <button class="ls-estrella ${x.imp ? 'on' : ''}" aria-label="Importante">${x.imp ? '★' : '☆'}</button>`}
        </div></div>`;
    $('#lsCuerpo').innerHTML = (this.reordenar ? `<div class="ls-reord">↕ Ordena con las flechas <button class="mini-btn" id="lsReordOk">✓ Listo</button></div>` : '')
      + (pend.length ? pend.map((x, i) => fila(x, i, pend.length)).join('') : `<div class="ls-vacio">${hechos.length ? '🎉 ¡Todo hecho!' : 'Escribe arriba lo primero que quieras apuntar ✍️'}</div>`)
      + (hechos.length ? `<button class="ls-grupo" id="lsVerHechos">${this.verHechos ? '▾' : '▸'} Completado <i>${hechos.length}</i></button>` + (this.verHechos ? hechos.map((x, i) => fila(x, i, hechos.length)).join('') : '') : '');
    const r = $('#lsReordOk'); if(r) r.onclick = () => { this.reordenar = false; this.pintar(); };
    const vh = $('#lsVerHechos'); if(vh) vh.onclick = () => { this.verHechos = !this.verHechos; this.pintar(); };
  },
  item(id){ const l = this.lista(); return [l, l.items.find(x => x.id === id)]; },

  /* ---------------- Acciones con los puntos ---------------- */
  async anadir(txt){
    txt = txt.trim(); if(!txt) return;
    const l = this.lista(), min = Math.min(0, ...l.items.map(x => x.pos || 0));
    l.items.push({ id:nuevoId('i'), t:txt, ok:false, imp:false, creado:Date.now(), pos:min - 1 });
    await this.guardar(l);
  },
  async marcar(id){ const [l, x] = this.item(id); if(!x) return; x.ok = !x.ok; x.hecho = x.ok ? Date.now() : null; if(x.ok) this.sonido(); await this.guardar(l); },
  async estrella(id){ const [l, x] = this.item(id); if(!x) return; x.imp = !x.imp; await this.guardar(l); },
  async quitar(id){
    const [l, x] = this.item(id); if(!x) return;
    const i = l.items.indexOf(x); l.items.splice(i, 1); await this.guardar(l);
    toast('🗑 «' + x.t + '» borrado', 'Deshacer', async () => { const l2 = this.datos.find(z => z.id === l.id); if(l2){ l2.items.splice(i, 0, x); await this.guardar(l2); } }, 6000);
  },
  async mover(id, dir){
    const l = this.lista(), pend = this.ordenados(l, false), i = pend.findIndex(x => x.id === id), j = i + dir;
    if(j < 0 || j >= pend.length) return;
    pend.forEach((x, k) => x.pos = k); pend[i].pos = j; pend[j].pos = i; l.modo = 'manual'; await this.guardar(l);
  },
  sonido(){ try{ Fiesta.despertar(); const ac = Fiesta._ac; if(!ac) return; const t0 = ac.currentTime + .02;
    [[880, 0], [1318.5, .08]].forEach(([f, t]) => { const o = ac.createOscillator(), g = ac.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(.0001, t0 + t); g.gain.exponentialRampToValueAtTime(.12, t0 + t + .01); g.gain.exponentialRampToValueAtTime(.0001, t0 + t + .25); o.connect(g); g.connect(ac.destination); o.start(t0 + t); o.stop(t0 + t + .3); }); }catch(e){} },
  async editar(id){
    const [l, x] = this.item(id); if(!x) return;
    const v = await popup({ tit:'✏️ Punto de la lista', html:`<input id="lsEdT" value="${esc(x.t)}" maxlength="200"><input id="lsEdN" value="${esc(x.nota || '')}" placeholder="Nota (opcional)" maxlength="200">
      <label class="check" style="margin-top:10px"><input type="checkbox" id="lsEdI" ${x.imp ? 'checked' : ''}><span class="caja"></span><span>⭐ Importante</span></label>
      <div class="ls-ed-acc"><button class="mini-btn" data-v="enviar">📋 Pasar al PorHacer</button><button class="mini-btn peligro" data-v="borrar">🗑 Borrar</button></div>`,
      botones:[{ txt:'Cancelar', val:null }, { txt:'Guardar', cls:'btn-pri', val:c => ({ t:$('#lsEdT', c).value.trim(), nota:$('#lsEdN', c).value.trim(), imp:$('#lsEdI', c).checked }) }],
      alAbrir:(c, fin) => $$('[data-v]', c).forEach(b => b.onclick = () => fin(b.dataset.v)) });
    if(v === 'borrar') return this.quitar(id);
    if(v === 'enviar') return this.enviar(id);
    if(!v || !v.t) return;
    Object.assign(x, v); await this.guardar(l);
  },

  /* Pasar un punto como tarea al PorHacer, en el tablero que elijas */
  async enviar(id){
    const [l, x] = this.item(id); if(!x) return;
    const tabs = (typeof Nube !== 'undefined' && Nube.activa) ? [...Nube.misTableros(), ...Nube.compartidos()] : [];
    const v = await popup({ tit:'📋 Pasar al PorHacer', html:`<p class="ls-env-t">«${esc(x.t)}»</p>
      ${tabs.length ? `<label class="lbl">¿A qué tablero?<select id="lsEnvTab">${tabs.map(t => `<option value="${t.id}" ${t.id === Nube.tid ? 'selected' : ''}>📋 ${esc(Nube.nombreTablero(t))}</option>`).join('')}</select></label>` : '<p class="aj-ayuda">Irá al tablero que tienes abierto.</p>'}
      <p class="aj-ayuda" style="margin-top:8px">Se creará una tarea en la columna <b>«Nueva tarea»</b>${x.imp ? ' con prioridad <b>alta</b> ⭐' : ''}.</p>
      <label class="check" style="margin-top:10px"><input type="checkbox" id="lsEnvQuitar" checked><span class="caja"></span><span>Quitarlo de la lista</span></label>`,
      botones:[{ txt:'Cancelar', val:null }, { txt:'📋 Pasar', cls:'btn-pri', val:c => ({ tab:tabs.length ? $('#lsEnvTab', c).value : null, quitar:$('#lsEnvQuitar', c).checked }) }] });
    if(!v) return;
    const t = { id:nuevoId('t'), titulo:x.t, notas:x.nota || '', colId:'nueva', color:'', prio:x.imp ? 3 : 0, ini:'', fin:'', personaId:'', subs:[], creada:Date.now(), orden:-Date.now() };
    anotar(t, '✨ Creada desde la lista «' + l.nombre + '»');
    let nombreTab = 'este tablero';
    try{
      if(!v.tab || v.tab === Nube.tid){
        if(!columnas().some(c => c.id === 'nueva')) t.colId = (columnas().find(c => c.visible && !c.hecha) || columnas()[0]).id;
        await guardarTarea(t); App.tareas.push(t); pintarTodo();
        if(v.tab) nombreTab = Nube.nombreTablero(Nube.tablero);
      } else {
        let cols = COLUMNAS_INICIO;
        try{ const cf = await Nube.colDe(v.tab, 'config').doc('tablero').get(); if(cf.exists && cf.data().columnas) cols = cf.data().columnas; }catch(e){}
        if(!cols.some(c => c.id === 'nueva')) t.colId = (cols.find(c => !c.hecha) || cols[0]).id;
        t.actualizada = Date.now();
        await Nube.colDe(v.tab, 'tareas').doc(t.id).set(limpioFS(t));
        nombreTab = Nube.nombreTablero(Nube.tableros[v.tab]);
      }
    }catch(e){ console.warn(e); popAviso('No se pudo pasar', 'No se ha podido crear la tarea. Prueba otra vez.'); return; }
    if(v.quitar) l.items = l.items.filter(z => z.id !== x.id); else x.env = nombreTab;
    await this.guardar(l);
    toast('📋 «' + x.t + '» está en «' + nombreTab + '»', 'Ir', () => { this.cerrar(); if(v.tab && v.tab !== Nube.tid) Nube.conectar(v.tab); }, 6000);
  },

  /* ---------------- Deslizar (dedo o ratón) ---------------- */
  iniciarDeslizar(){
    const cuerpo = $('#lsCuerpo'); let D = null;
    const UMBRAL = 90;
    cuerpo.addEventListener('pointerdown', e => {
      if(this.reordenar || e.button > 0) return;
      const cara = e.target.closest('.ls-cara'); if(!cara || e.target.closest('button')) return;
      D = { cara, item:cara.parentNode, x:e.clientX, y:e.clientY, dx:0, mov:false, id:e.pointerId };
    });
    cuerpo.addEventListener('pointermove', e => {
      if(!D || e.pointerId !== D.id) return;
      const dx = e.clientX - D.x, dy = e.clientY - D.y;
      if(!D.mov){ if(Math.abs(dx) < 8) return; if(Math.abs(dy) > Math.abs(dx)){ D = null; return; } D.mov = true; try{ D.cara.setPointerCapture(e.pointerId); }catch(_){} D.item.classList.add('desliza'); }
      D.dx = dx; D.cara.style.transform = `translateX(${dx}px)`;
      D.item.classList.toggle('a-izq', dx > 0); D.item.classList.toggle('a-der', dx < 0);
      D.item.classList.toggle('listo', Math.abs(dx) > UMBRAL);
    });
    const fin = e => {
      if(!D) return; const d = D; D = null;
      if(!d.mov){ if(e.type === 'pointerup' && !e.target.closest('button')) this.editar(d.item.dataset.id); return; }
      this._sinClick = Date.now();
      const id = d.item.dataset.id;
      if(d.dx < -UMBRAL){ d.cara.style.transition = 'transform .2s'; d.cara.style.transform = 'translateX(-110%)'; setTimeout(() => this.quitar(id), 180); return; }
      d.cara.style.transition = 'transform .25s'; d.cara.style.transform = '';
      setTimeout(() => { d.item.classList.remove('desliza', 'a-izq', 'a-der', 'listo'); d.cara.style.transition = ''; }, 260);
      if(d.dx > UMBRAL) this.enviar(id);
    };
    cuerpo.addEventListener('pointerup', fin); cuerpo.addEventListener('pointercancel', fin);
    cuerpo.addEventListener('click', e => {
      const it = e.target.closest('.ls-item'); if(!it) return;
      const id = it.dataset.id;
      if(e.target.closest('.ls-check')) this.marcar(id);
      else if(e.target.closest('.ls-estrella')) this.estrella(id);
      else if(e.target.closest('.ls-mov')) this.mover(id, +e.target.closest('.ls-mov').dataset.m);
      else if(e.target.closest('[data-pc]')) e.target.closest('[data-pc]').dataset.pc === 'borrar' ? this.quitar(id) : this.enviar(id);
    });
    // teclado (ordenador): con un punto enfocado, Supr borra y → lo pasa al PorHacer
    cuerpo.addEventListener('keydown', e => { const it = e.target.closest('.ls-item'); if(!it || e.target.tagName === 'BUTTON' && e.key === 'Enter') return;
      if(e.key === 'Delete' || e.key === 'Backspace'){ e.preventDefault(); this.quitar(it.dataset.id); } });
  },

  /* ---------------- Opciones (⋯) ---------------- */
  async opciones(){
    const l = this.lista();
    const v = await popup({ tit:'Opciones de lista', html:`
      <button class="opcion" data-v="renombrar">✏️ Cambiar el nombre</button>
      <button class="opcion" data-v="ordenar">⇅ Ordenar <small class="ls-op-sub">${esc((this.ORDEN.find(o => o[0] === (l.modo || 'manual')) || this.ORDEN[0])[1])}</small></button>
      <button class="opcion" data-v="reordenar">↕ Reordenar los puntos</button>
      <button class="opcion" data-v="tema">🎨 Cambiar tema y fondo</button>
      <button class="opcion" data-v="imprimir">🖨 Imprimir esta lista</button>
      <button class="opcion" data-v="copia">📤 Enviar una copia</button>
      <button class="opcion" data-v="limpiar">🧹 Borrar los completados</button>
      <button class="opcion" data-v="nueva">＋ Nueva lista</button>
      <button class="opcion peligro-op" data-v="borrar">🗑 Borrar esta lista</button>`,
      botones:[{ txt:'Listo', cls:'btn-pri', val:null }], alAbrir:(c, fin) => $$('[data-v]', c).forEach(b => b.onclick = () => fin(b.dataset.v)) });
    if(v === 'renombrar'){ const n = await this.pedirNombre('✏️ Nombre de la lista', l.nombre); if(n){ l.nombre = n; await this.guardar(l); } }
    if(v === 'ordenar'){ const o = await popup({ tit:'⇅ Ordenar por', html:this.ORDEN.map(([k, t]) => `<button class="opcion ${k === (l.modo || 'manual') ? 'on' : ''}" data-o="${k}">${t}</button>`).join(''), botones:[{ txt:'Cerrar', val:null }], alAbrir:(c, fin) => $$('[data-o]', c).forEach(b => b.onclick = () => fin(b.dataset.o)) }); if(o){ l.modo = o; await this.guardar(l); } }
    if(v === 'reordenar'){ if(l.modo !== 'manual'){ this.ordenados(l, false).forEach((x, k) => x.pos = k); l.modo = 'manual'; await this.guardar(l); } this.reordenar = true; this.pintar(); }
    if(v === 'tema') this.tema();
    if(v === 'imprimir') this.imprimir();
    if(v === 'copia') this.copia();
    if(v === 'limpiar'){ const n = l.items.filter(x => x.ok).length; if(n && await popConfirmar('¿Borrar ' + n + ' completado' + (n > 1 ? 's' : '') + '?', 'Se quitarán de la lista los puntos ya hechos.', 'Borrar')){ l.items = l.items.filter(x => !x.ok); await this.guardar(l); } }
    if(v === 'nueva'){ const n = await this.pedirNombre('＋ Nueva lista', ''); if(n) await this.crear(n); }
    if(v === 'borrar'){
      if(await popConfirmar('¿Borrar la lista «' + l.nombre + '»?', 'Se borrarán sus ' + l.items.length + ' puntos. No se puede deshacer.', 'Borrar')){ await this.borrar(l); toast('🗑 Lista borrada'); }
    }
  },
  pedirNombre(tit, val){ return popup({ tit, html:`<input id="lsNom" value="${esc(val)}" placeholder="Por ejemplo: Compra, Ideas, Viaje…" maxlength="40">`, botones:[{ txt:'Cancelar', val:null }, { txt:'Guardar', cls:'btn-pri', val:c => $('#lsNom', c).value.trim() || null }], alAbrir:c => setTimeout(() => $('#lsNom', c).focus(), 250) }); },
  async elegirLista(){
    const v = await popup({ tit:'📝 Mis listas', html:this.datos.map(l => `<button class="opcion ${l.id === this.actual ? 'on' : ''}" data-l="${l.id}"><span class="ls-mini" style="background:${(this.TEMAS.find(t => t[0] === this.colorDe(l)) || this.TEMAS[0])[2] || 'linear-gradient(180deg,var(--tile1),var(--tile2))'}"></span>${esc(l.nombre)}<small class="ls-op-sub">${l.items.filter(x => !x.ok).length}</small></button>`).join('')
      + '<button class="opcion" data-l="+">＋ Nueva lista</button>', botones:[{ txt:'Cerrar', val:null }], alAbrir:(c, fin) => $$('[data-l]', c).forEach(b => b.onclick = () => fin(b.dataset.l)) });
    if(v === '+'){ const n = await this.pedirNombre('＋ Nueva lista', ''); if(n) await this.crear(n); }
    else if(v){ this.actual = v; lsSet('ph-lista', v); this.reordenar = false; this.pintar(); }
  },
  async tema(){
    const l = this.lista(), act = this.colorDe(l), tieneImg = !!this.fondos[l.id];
    const v = await popup({ tit:'🎨 Tema de la lista', html:`<div class="ls-temas">${this.TEMAS.map(([k, n, g]) => `<button class="ls-tema ${k === act && !tieneImg ? 'on' : ''}" data-t="${k}" style="background:${g || 'linear-gradient(180deg,var(--bg),var(--bg2))'}"><span>${n}</span></button>`).join('')}</div>
      <div class="lbl" style="margin-top:12px">Imagen de fondo</div>
      <div class="ls-img-btns"><button class="mini-btn" data-t="__img">🖼️ Elegir una imagen</button>${tieneImg ? '<button class="mini-btn peligro" data-t="__sin">Quitar la imagen</button>' : ''}</div>
      <p class="aj-ayuda" style="margin-top:6px">La imagen se aligera antes de guardarse.</p>`,
      botones:[{ txt:'Cerrar', val:null }], alAbrir:(c, fin) => $$('[data-t]', c).forEach(b => b.onclick = () => fin(b.dataset.t)) });
    if(!v) return;
    if(v === '__img'){ $('#lsFondoIn').click(); return; }
    if(v === '__sin'){ await this.ponerFondo(l, null); return; }
    l.tema = { color:v, elegido:true }; if(tieneImg) await this.ponerFondo(l, null); await this.guardar(l);
  },
  async fondoDeArchivo(file){
    if(!file) return; const l = this.lista();
    try{
      const img = await new Promise((ok, mal) => { const u = URL.createObjectURL(file), im = new Image(); im.onload = () => { const M = 1280, k = Math.min(1, M / Math.max(im.naturalWidth, im.naturalHeight)); const cv = document.createElement('canvas'); cv.width = Math.round(im.naturalWidth * k); cv.height = Math.round(im.naturalHeight * k); cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height); URL.revokeObjectURL(u); ok(cv.toDataURL('image/jpeg', .7)); }; im.onerror = mal; im.src = u; });
      await this.ponerFondo(l, img); toast('🖼️ Fondo puesto (' + tamTxt(img.length * .75) + ')');
    }catch(e){ toast('⚠️ No se pudo leer la imagen'); }
  },
  texto(l){ const p = this.ordenados(l, false), h = this.ordenados(l, true); return l.nombre + '\n\n' + p.map(x => '☐ ' + x.t + (x.imp ? ' ⭐' : '')).join('\n') + (h.length ? '\n\nCompletado:\n' + h.map(x => '☑ ' + x.t).join('\n') : ''); },
  async copia(){
    const l = this.lista(), txt = this.texto(l);
    if(navigator.share){ try{ await navigator.share({ title:l.nombre, text:txt }); return; }catch(e){ if(e.name === 'AbortError') return; } }
    const v = await popup({ tit:'📤 Enviar una copia', html:`<textarea class="ls-copia" readonly>${esc(txt)}</textarea>`, botones:[{ txt:'📋 Copiar', val:'copiar' }, { txt:'✉️ Por email', cls:'btn-pri', val:'mail' }] });
    if(v === 'copiar'){ try{ await navigator.clipboard.writeText(txt); toast('📋 Copiada'); }catch(e){ toast('No se pudo copiar'); } }
    if(v === 'mail') location.href = 'mailto:?subject=' + encodeURIComponent(l.nombre) + '&body=' + encodeURIComponent(txt.replace(/\n/g, '\r\n'));
  },
  imprimir(){
    const l = this.lista(), p = this.ordenados(l, false), h = this.ordenados(l, true);
    let z = $('#lsPrint'); if(!z){ z = document.createElement('div'); z.id = 'lsPrint'; document.body.appendChild(z); }
    z.innerHTML = `<h1>${esc(l.nombre)}</h1><ul>${p.map(x => `<li><i></i>${esc(x.t)}${x.imp ? ' ⭐' : ''}</li>`).join('')}</ul>${h.length ? `<h2>Completado</h2><ul class="hechos">${h.map(x => `<li><i>✓</i>${esc(x.t)}</li>`).join('')}</ul>` : ''}`;
    document.body.classList.add('imprimiendo-lista');
    const fin = () => { document.body.classList.remove('imprimiendo-lista'); removeEventListener('afterprint', fin); };
    addEventListener('afterprint', fin); setTimeout(() => { window.print(); setTimeout(() => { if(!matchMedia('print').matches) fin(); }, 1500); }, 100);
  },

  /* ---------------- Arranque ---------------- */
  iniciar(){
    $('#btnListas').innerHTML = $('#btnListas2').innerHTML = '<img src="listas.png" alt="">';
    $('#lsVolver').innerHTML = icono('tablero'); $('#lsCal').innerHTML = icono('calendario');
    $('#btnListas').onclick = $('#btnListas2').onclick = () => this.abrir();
    $('#lsVolver').onclick = () => this.cerrar(); $('#lsCal').onclick = () => this.cerrar('cal');
    $('#lsOpc').onclick = () => this.opciones(); $('#lsTitulo').onclick = () => this.elegirLista();
    $('#lsFondoIn').onchange = e => { this.fondoDeArchivo(e.target.files[0]); e.target.value = ''; };
    const inp = $('#lsNuevo');
    inp.onkeydown = e => { if(e.key === 'Enter'){ e.preventDefault(); const t = inp.value; inp.value = ''; this.anadir(t); } };
    $('#lsMas').onclick = () => { if(inp.value.trim()){ const t = inp.value; inp.value = ''; this.anadir(t); } inp.focus(); };
    // tocar fuera del recuadro: se esconde el teclado
    $('#vListas').addEventListener('pointerdown', e => { if(!e.target.closest('.ls-add') && document.activeElement === inp) inp.blur(); });
    this.iniciarDeslizar();
    this.lsCargar();
    setInterval(() => this.vigilar(), 1500);
  }
};
