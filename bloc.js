/* PorHacer · bloc de notas secreto
   Hojas con pestañas de colores, negrita, listas (☑ casillas, • puntos, 1. números)
   y subrayado de colores pastel. Se guarda SOLO en este aparato y CIFRADO con
   tu contraseña (AES-GCM): sin la contraseña nadie puede leerlo.
   Se puede exportar e importar una copia (también va cifrada).                */

const Bloc = {
  K: 'ph-bloc',
  clave: null, sal: null, datos: null, hoja: null, _t: null,

  COLORES_HOJA: [['#ffffff','Blanco'],['#fff8d6','Amarillo'],['#ffe4ec','Rosa'],['#e3f6e4','Verde'],['#e2f0fd','Azul'],['#efe7fb','Lila'],['#ffeadb','Melocotón'],['#f1f1f3','Gris']],
  COLORES_TAB:  [['#e5484d','Rojo'],['#f59e0b','Naranja'],['#e8b400','Amarillo'],['#22a55a','Verde'],['#14b8a6','Turquesa'],['#3b82f6','Azul'],['#8b5cf6','Lila'],['#ec4899','Rosa'],['#a16207','Marrón'],['#64748b','Gris']],
  SUBRAYA: [['#e6e6ea','Gris claro'],['#fff1a8','Amarillo'],['#ffd3e0','Rosa'],['#cdf1d0','Verde'],['#cfe6ff','Azul'],['#e5d8fb','Lila'],['#ffdcc2','Melocotón']],

  /* ---------- Dónde se guarda: IndexedDB del aparato (cabe mucho más que localStorage, para las fotos) ---------- */
  _hay: false,
  existe(){ return this._hay; },
  _db(){
    if(!this._dbp) this._dbp = new Promise((ok, mal) => { const r = indexedDB.open('PorHacer-bloc', 1); r.onupgradeneeded = () => r.result.createObjectStore('k'); r.onsuccess = () => ok(r.result); r.onerror = () => mal(r.error); });
    return this._dbp;
  },
  async _op(modo, fn){ const db = await this._db(); return new Promise((ok, mal) => { const tx = db.transaction('k', modo), q = fn(tx.objectStore('k')); tx.oncomplete = () => ok(q && q.result); tx.onerror = () => mal(tx.error); }); },
  async leerPaq(){
    let v = await this._op('readonly', st => st.get('paq')).catch(() => null);
    if(!v){ const ls = lsGet(this.K); if(ls){ await this.ponerPaq(ls); lsSet(this.K, null); v = ls; } }   // pasar lo de antes (localStorage)
    this._hay = !!v; return v;
  },
  async ponerPaq(str){ await this._op('readwrite', st => st.put(str, 'paq')); this._hay = true; try{ navigator.storage && navigator.storage.persist && navigator.storage.persist(); }catch(e){} },
  async borrarPaq(){ await this._op('readwrite', st => st.delete('paq')); this._hay = false; },

  /* ---------- Cifrado ---------- */
  b64(buf){ const u = new Uint8Array(buf); let s = ''; for(let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); },
  deb64(s){ const b = atob(s), u = new Uint8Array(b.length); for(let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; },
  async derivar(pass, sal){
    const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name:'PBKDF2', salt:sal, iterations:250000, hash:'SHA-256' }, k, { name:'AES-GCM', length:256 }, false, ['encrypt', 'decrypt']);
  },
  async cifrar(obj, clave, sal){
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name:'AES-GCM', iv }, clave, new TextEncoder().encode(JSON.stringify(obj)));
    return { app:'PorHacer-bloc', v:1, sal:this.b64(sal), iv:this.b64(iv), ct:this.b64(ct), fecha:Date.now() };
  },
  // Lanza un error si la contraseña no es la buena
  async descifrar(paq, pass){
    const sal = this.deb64(paq.sal), clave = await this.derivar(pass, sal);
    const pt = await crypto.subtle.decrypt({ name:'AES-GCM', iv:this.deb64(paq.iv) }, clave, this.deb64(paq.ct));
    return { obj: JSON.parse(new TextDecoder().decode(pt)), clave, sal };
  },
  async guardar(){
    if(!this.clave) return;
    this.leerHoja();
    try{ await this.ponerPaq(JSON.stringify(await this.cifrar(this.datos, this.clave, this.sal))); }
    catch(e){ console.warn(e); const x = $('#blocEstado'); if(x){ x.textContent = '⚠️ No se pudo guardar'; x.classList.remove('ok'); } toast('⚠️ No se ha podido guardar el bloc (¿aparato lleno?)'); return; }
    const e = $('#blocEstado'); if(e){ e.textContent = '✓ Guardado'; e.classList.add('ok'); }
  },
  guardarLuego(){
    const e = $('#blocEstado'); if(e){ e.textContent = 'Guardando…'; e.classList.remove('ok'); }
    clearTimeout(this._t); this._t = setTimeout(() => this.guardar(), 700);
  },
  nuevo(){ return { hojas:[{ id:nuevoId('h'), nombre:'Hoja 1', color:'#fff8d6', tab:'#f59e0b', html:'' }], activa:null }; },

  /* ---------- Contraseña: solo puntos, sin copiar ni pegar ---------- */
  campo(id, ph){ return `<input type="password" id="${id}" class="bloc-pass" placeholder="${esc(ph)}" autocomplete="new-password" autocapitalize="off" autocorrect="off" spellcheck="false">`; },
  blindar(c){
    $$('.bloc-pass', c).forEach(i => {
      ['paste','copy','cut','drop','dragstart','contextmenu'].forEach(ev => i.addEventListener(ev, e => { e.preventDefault(); toast('🔒 Aquí no se puede copiar ni pegar'); }));
      i.addEventListener('keydown', e => { if((e.ctrlKey || e.metaKey) && /^[cvx]$/i.test(e.key)){ e.preventDefault(); toast('🔒 Aquí no se puede copiar ni pegar'); } });
    });
  },
  async pedir(tit, texto, campos, comprobar){
    // campos: [[id, placeholder]] · comprobar(valores) → '' si va bien, o el error
    for(;;){
      const v = await popup({ tit, html:`<p class="aj-ayuda" style="margin:0 0 4px">${texto}</p>${campos.map(([id, ph]) => this.campo(id, ph)).join('')}<div class="bloc-err" id="blocErr"></div>`,
        botones:[{ txt:'Cancelar', val:null }, { txt:'Aceptar', cls:'btn-pri', val:c => campos.map(([id]) => $('#' + id, c).value) }],
        alAbrir:c => { this.blindar(c); const i = $('.bloc-pass', c); setTimeout(() => i && i.focus(), 250); $$('.bloc-pass', c).forEach(x => x.addEventListener('keydown', e => { if(e.key === 'Enter') $('#popBtns .btn-pri').click(); })); } });
      if(!v) return null;
      const err = await comprobar(v);
      if(!err) return v;
      toast('⚠️ ' + err);
    }
  },

  /* ---------- Abrir y cerrar ---------- */
  async abrir(){
    if(!window.crypto || !crypto.subtle){ popAviso('Bloc de notas', 'Este navegador no permite cifrar. Ábrelo desde la dirección https de la app.'); return; }
    await this.leerPaq();
    if(!this.existe()){
      const v = await popup({ tit:'🔒 Bloc de notas', html:'<p>Primero pon una contraseña para tu bloc en <b>Configuración → 🔒 Bloc</b>. Tus notas se guardarán cifradas en este aparato.</p>',
        botones:[{ txt:'Ahora no', val:false }, { txt:'Ir a Configuración', cls:'btn-pri', val:true }] });
      if(v){ Ajustes.abrir(); Ajustes.tab('bloc'); }
      return;
    }
    if(this.clave){ this.mostrar(); return; }
    const paq = JSON.parse(await this.leerPaq());
    let r = null;
    const ok = await this.pedir('🔒 Bloc de notas', 'Escribe tu contraseña del bloc.', [['bpPass', 'Contraseña']], async ([p]) => {
      if(!p) return 'Escribe la contraseña';
      try{ r = await this.descifrar(paq, p); return ''; }catch(e){ return 'Contraseña incorrecta'; }
    });
    if(!ok || !r) return;
    this.clave = r.clave; this.sal = r.sal; this.datos = r.obj;
    if(!this.datos.hojas || !this.datos.hojas.length) this.datos = this.nuevo();
    this.mostrar();
  },
  mostrar(){
    this.hoja = this.datos.activa && this.datos.hojas.some(h => h.id === this.datos.activa) ? this.datos.activa : this.datos.hojas[0].id;
    this.pintarTabs(); this.pintarHoja();
    $('#blocEstado').textContent = '🔓 Abierto'; $('#blocEstado').classList.remove('ok');
    abrir('bloc');
  },
  async cerrarBloc(){
    clearTimeout(this._t); this.soltarFoto(); await this.guardar();
    cerrar('bloc');
    this.clave = null; this.datos = null; this.sal = null;     // se vuelve a cerrar con candado
    $('#blocHoja').innerHTML = '';
    toast('🔒 Bloc cerrado con candado');
  },

  /* ---------- Hojas y pestañas ---------- */
  actual(){ return this.datos.hojas.find(h => h.id === this.hoja); },
  leerHoja(){ const h = this.datos && this.actual(); if(h) h.html = $('#blocHoja').innerHTML; if(this.datos) this.datos.activa = this.hoja; },
  pintarTabs(){
    $('#blocTabs').innerHTML = this.datos.hojas.map(h => `<button class="bloc-tab ${h.id === this.hoja ? 'on' : ''}" data-h="${h.id}" style="--t:${h.tab};--c:${h.color}"><span>${esc(h.nombre)}</span></button>`).join('')
      + '<button class="bloc-tab mas" data-h="+" title="Nueva hoja">＋</button>';
  },
  pintarHoja(){
    const h = this.actual(), el = $('#blocHoja');
    el.innerHTML = h.html || '';
    $('#blocPapel').style.setProperty('--c', h.color); $('#blocPapel').style.setProperty('--t', h.tab);
    el.scrollTop = 0;
  },
  cambiar(id){ this.soltarFoto(); this.leerHoja(); this.hoja = id; this.pintarTabs(); this.pintarHoja(); this.guardarLuego(); },
  async nuevaHoja(){
    this.leerHoja();
    const n = this.datos.hojas.length, h = { id:nuevoId('h'), nombre:'Hoja ' + (n + 1), color:this.COLORES_HOJA[(n + 1) % this.COLORES_HOJA.length][0], tab:this.COLORES_TAB[(n * 3 + 1) % this.COLORES_TAB.length][0], html:'' };
    this.datos.hojas.push(h); this.hoja = h.id; this.pintarTabs(); this.pintarHoja(); this.guardarLuego();
    const t = $(`.bloc-tab[data-h="${h.id}"]`); t && t.scrollIntoView({ inline:'nearest', block:'nearest' });
    this.opcionesHoja();
  },
  async opcionesHoja(){
    this.leerHoja();
    const h = this.actual(), muchas = this.datos.hojas.length > 1;
    const muestras = (lista, sel, k) => `<div class="bloc-muestras">${lista.map(([c, n]) => `<button type="button" class="bloc-m ${c === sel ? 'on' : ''}" data-${k}="${c}" title="${n}" style="background:${c}"></button>`).join('')}</div>`;
    const v = await popup({ tit:'📄 Esta hoja',
      html:`<label class="lbl">Nombre<input id="bhNom" value="${esc(h.nombre)}" maxlength="30"></label>
        <div class="lbl" style="margin-top:12px">Color de la hoja ${muestras(this.COLORES_HOJA, h.color, 'c')}</div>
        <div class="lbl" style="margin-top:10px">Color de la pestaña ${muestras(this.COLORES_TAB, h.tab, 't')}</div>
        <div class="bloc-prev" id="bhPrev"><i></i><span></span></div>
        ${muchas ? '<button type="button" class="btn-borrar-tarea" id="bhBorrar" style="margin-top:14px">🗑 Borrar esta hoja</button>' : ''}`,
      botones:[{ txt:'Cancelar', val:null }, { txt:'Guardar', cls:'btn-pri', val:c => ({ nombre:$('#bhNom', c).value.trim() || h.nombre, color:$('[data-c].on', c).dataset.c, tab:$('[data-t].on', c).dataset.t }) }],
      alAbrir:(c, fin) => {
        const prev = () => { const p = $('#bhPrev', c); p.style.setProperty('--c', $('[data-c].on', c).dataset.c); p.style.setProperty('--t', $('[data-t].on', c).dataset.t); $('span', p).textContent = $('#bhNom', c).value || h.nombre; };
        $$('[data-c]', c).forEach(b => b.onclick = () => { $$('[data-c]', c).forEach(x => x.classList.toggle('on', x === b)); prev(); });
        $$('[data-t]', c).forEach(b => b.onclick = () => { $$('[data-t]', c).forEach(x => x.classList.toggle('on', x === b)); prev(); });
        $('#bhNom', c).oninput = prev; prev();
        const bb = $('#bhBorrar', c); if(bb) bb.onclick = () => fin('borrar');
      } });
    if(v === 'borrar'){
      const ok = await popConfirmar('¿Borrar la hoja «' + h.nombre + '»?', 'Se borrará todo lo que hay escrito en ella. No se puede deshacer.', 'Borrar');
      if(!ok) return;
      const i = this.datos.hojas.findIndex(x => x.id === h.id);
      this.datos.hojas.splice(i, 1); this.hoja = this.datos.hojas[Math.max(0, i - 1)].id;
      this.pintarTabs(); this.pintarHoja(); this.guardarLuego(); toast('🗑 Hoja borrada'); return;
    }
    if(!v) return;
    Object.assign(h, v); this.pintarTabs(); this.pintarHoja(); this.guardarLuego();
  },

  /* ---------- Formato ---------- */
  cmd(c, v){ $('#blocHoja').focus(); try{ document.execCommand('styleWithCSS', false, c === 'hiliteColor'); }catch(e){} document.execCommand(c, false, v); this.guardarLuego(); this.marcarBarra(); },
  lista(tipo){
    const el = $('#blocHoja'); el.focus();
    const sel = getSelection(), nodo = sel.anchorNode && (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentNode);
    const l = nodo && nodo.closest && nodo.closest('#blocHoja ul, #blocHoja ol');
    const actual = !l ? '' : l.tagName === 'OL' ? 'num' : l.classList.contains('casillas') ? 'check' : 'punto';
    if(actual === tipo){ document.execCommand(tipo === 'num' ? 'insertOrderedList' : 'insertUnorderedList'); }   // quitar la lista
    else {
      if(actual && (actual === 'num') !== (tipo === 'num')) document.execCommand(actual === 'num' ? 'insertOrderedList' : 'insertUnorderedList');
      if(!actual || (actual === 'num') !== (tipo === 'num')) document.execCommand(tipo === 'num' ? 'insertOrderedList' : 'insertUnorderedList');
      const s2 = getSelection(), n2 = s2.anchorNode && (s2.anchorNode.nodeType === 1 ? s2.anchorNode : s2.anchorNode.parentNode);
      const l2 = n2 && n2.closest && n2.closest('#blocHoja ul, #blocHoja ol');
      if(l2 && l2.tagName === 'UL') l2.classList.toggle('casillas', tipo === 'check');
    }
    this.guardarLuego(); this.marcarBarra();
  },
  marcarBarra(){
    let b = false; try{ b = document.queryCommandState('bold'); }catch(e){}
    $('#blocB') && $('#blocB').classList.toggle('on', b);
  },

  /* ---------- Fotos dentro de la hoja ---------- */
  _rango: null,
  guardarRango(){ const s = getSelection(); if(s.rangeCount && $('#blocHoja').contains(s.anchorNode)) this._rango = s.getRangeAt(0).cloneRange(); },
  // Aligera la foto: lado largo máx. 1000 px, JPEG ~72 % (suele quedar en 60-150 KB)
  aligerar(file){
    return new Promise((ok, mal) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        const M = 1000, k = Math.min(1, M / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        const cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, h); cx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url); ok(cv.toDataURL('image/jpeg', 0.72));
      };
      img.onerror = () => { URL.revokeObjectURL(url); mal(new Error('foto')); };
      img.src = url;
    });
  },
  async ponerFotos(files){
    files = [...files].filter(f => /^image\//.test(f.type)); if(!files.length) return;
    const el = $('#blocHoja');
    let r = this._rango && el.contains(this._rango.startContainer) ? this._rango : null;
    if(!r){ r = document.createRange(); r.selectNodeContents(el); r.collapse(false); }
    toast('📷 Aligerando ' + (files.length > 1 ? files.length + ' fotos' : 'la foto') + '…');
    let peso = 0;
    for(const f of files){
      try{
        const src = await this.aligerar(f); peso += src.length * 0.75;
        const im = document.createElement('img'); im.className = 'bloc-img'; im.src = src; im.style.width = '140px'; im.alt = '';
        r.deleteContents(); r.insertNode(im); r.setStartAfter(im); r.collapse(true);
        const sp = document.createTextNode(' '); r.insertNode(sp); r.setStartAfter(sp); r.collapse(true);
      }catch(e){ toast('⚠️ No se pudo leer una foto'); }
    }
    const s = getSelection(); s.removeAllRanges(); s.addRange(r); this._rango = r.cloneRange();
    this.guardarLuego();
    toast('📷 ' + (files.length > 1 ? files.length + ' fotos puestas' : 'Foto puesta') + ' (' + tamTxt(peso) + '). Tócala para cambiar el tamaño');
  },
  // Al tocar una foto: marco con un tirador para hacerla grande o pequeña
  _sel: null,
  elegirFoto(im){
    this._sel = im;
    let m = $('#blocMarco');
    if(!m){
      m = document.createElement('div'); m.id = 'blocMarco';
      m.innerHTML = '<span class="bm-tam"></span><button type="button" class="bm-quitar" title="Quitar la foto">🗑</button><span class="bm-asa" title="Arrastra para cambiar el tamaño"></span>';
      $('#blocPapel').appendChild(m);
      const asa = $('.bm-asa', m); let D = null;
      asa.addEventListener('pointerdown', e => { if(!this._sel) return; e.preventDefault(); e.stopPropagation(); try{ asa.setPointerCapture(e.pointerId); }catch(_){} D = { x:e.clientX, w:this._sel.getBoundingClientRect().width, max:$('#blocHoja').clientWidth - 34 }; });
      asa.addEventListener('pointermove', e => { if(!D || !this._sel) return; const w = Math.round(Math.max(50, Math.min(D.max, D.w + e.clientX - D.x))); this._sel.style.width = w + 'px'; this.colocarMarco(); });
      const fin = () => { if(!D) return; D = null; this.guardarLuego(); };
      asa.addEventListener('pointerup', fin); asa.addEventListener('pointercancel', fin);
      $('.bm-quitar', m).addEventListener('mousedown', e => e.preventDefault());
      $('.bm-quitar', m).onclick = () => { if(this._sel){ this._sel.remove(); this.soltarFoto(); this.guardarLuego(); toast('🗑 Foto quitada'); } };
    }
    m.classList.add('on'); this.colocarMarco();
  },
  colocarMarco(){
    const m = $('#blocMarco'), im = this._sel; if(!m || !im || !im.isConnected){ this.soltarFoto(); return; }
    const a = im.getBoundingClientRect(), b = $('#blocPapel').getBoundingClientRect(), h = $('#blocHoja').getBoundingClientRect();
    if(a.bottom < h.top || a.top > h.bottom){ m.style.visibility = 'hidden'; return; }
    m.style.visibility = '';
    Object.assign(m.style, { left:(a.left - b.left) + 'px', top:(a.top - b.top) + 'px', width:a.width + 'px', height:a.height + 'px' });
    $('.bm-tam', m).textContent = Math.round(a.width) + ' px';
  },
  soltarFoto(){ this._sel = null; const m = $('#blocMarco'); if(m) m.classList.remove('on'); },

  /* ---------- Copias ---------- */
  exportar(){
    this.guardar().then(() => {
      const d = new Date(), f = iso(d);
      this.leerPaq().then(v => descargar(new Blob([v], { type:'application/json' }), 'bloc-porhacer-' + f + '.json'));
      toast('💾 Copia del bloc guardada (va cifrada con tu contraseña)');
    });
  },
  elegirArchivo(){
    return new Promise(ok => {
      const i = document.createElement('input'); i.type = 'file'; i.accept = '.json,application/json';
      i.onchange = () => { const f = i.files[0]; if(!f) return ok(null); f.text().then(t => { try{ const p = JSON.parse(t); ok(p && p.app === 'PorHacer-bloc' ? p : 'mal'); }catch(e){ ok('mal'); } }); };
      i.click();
    });
  },
  async importar(){
    const paq = await this.elegirArchivo(); if(!paq) return;
    if(paq === 'mal'){ popAviso('Importar', 'Ese archivo no es una copia del bloc de PorHacer.'); return; }
    let r = null;
    const ok = await this.pedir('📥 Importar copia', 'Escribe la contraseña <b>con la que se hizo esa copia</b>.', [['bpImp', 'Contraseña de la copia']], async ([p]) => {
      if(!p) return 'Escribe la contraseña';
      try{ r = await this.descifrar(paq, p); return ''; }catch(e){ return 'Contraseña incorrecta'; }
    });
    if(!ok || !r) return;
    const hojas = (r.obj.hojas || []);
    if(this.clave){        // bloc abierto: se añaden o se sustituyen las hojas (y se guardan con TU contraseña)
      const v = await popup({ tit:'📥 Importar ' + hojas.length + (hojas.length === 1 ? ' hoja' : ' hojas'), html:'<p>¿Qué quieres hacer con las hojas de la copia?</p>',
        botones:[{ txt:'Añadirlas', val:'add' }, { txt:'Sustituir todo', cls:'btn-pri', val:'sus' }] });
      if(!v) return;
      if(v === 'sus' && !await popConfirmar('¿Sustituir todo?', 'Se borrarán las hojas que tienes ahora en este aparato y se pondrán las de la copia.', 'Sustituir')) return;
      this.leerHoja();
      const nuevas = hojas.map(h => ({ ...h, id:nuevoId('h') }));
      this.datos.hojas = v === 'sus' ? nuevas : this.datos.hojas.concat(nuevas);
      if(!this.datos.hojas.length) this.datos = this.nuevo();
      this.hoja = this.datos.hojas[v === 'sus' ? 0 : this.datos.hojas.length - nuevas.length].id;
      this.pintarTabs(); this.pintarHoja(); await this.guardar(); toast('📥 Copia importada');
    } else {               // sin bloc en este aparato: se queda la copia con su contraseña
      await this.leerPaq();
      if(this.existe() && !await popConfirmar('¿Sustituir el bloc?', 'Ya hay un bloc en este aparato. Se sustituirá por el de la copia (y su contraseña).', 'Sustituir')) return;
      this.clave = r.clave; this.sal = r.sal; this.datos = r.obj.hojas && r.obj.hojas.length ? r.obj : this.nuevo();
      await this.guardar(); this.clave = null; this.datos = null;
      toast('📥 Bloc importado. Su contraseña es la de la copia.');
      Ajustes.tab('bloc');
    }
  },
  /* ---------- Imprimir una hoja (con o sin el color del papel) ---------- */
  async imprimir(){
    this.soltarFoto(); this.leerHoja();
    const hs = this.datos.hojas;
    const v = await popup({ tit:'🖨 Imprimir',
      html:`<label class="lbl">¿Qué hoja?<select id="biHoja">${hs.map(h => `<option value="${h.id}" ${h.id === this.hoja ? 'selected' : ''}>${esc(h.nombre)}</option>`).join('')}</select></label>
        <div class="lbl" style="margin-top:12px">Color del papel</div>
        <div class="bi-ops">
          <button type="button" class="opcion on" data-col="1"><i class="bi-m" id="biM1"></i>Con el color de la hoja</button>
          <button type="button" class="opcion" data-col="0"><i class="bi-m" style="background:#fff"></i>Sin color (papel blanco)</button>
        </div>
        <label class="check" style="margin-top:12px"><input type="checkbox" id="biTit" checked><span class="caja"></span><span>Poner el nombre de la hoja arriba</span></label>
        <p class="aj-ayuda" style="margin-top:8px">Los subrayados de colores y las fotos salen siempre.</p>`,
      botones:[{ txt:'Cancelar', val:null }, { txt:'📄 PDF', cls:'btn-sec', val:c => ({ pdf:true, id:$('#biHoja', c).value, color:$('.bi-ops .on', c).dataset.col === '1', tit:$('#biTit', c).checked }) }, { txt:'🖨 Imprimir', cls:'btn-pri', val:c => ({ id:$('#biHoja', c).value, color:$('.bi-ops .on', c).dataset.col === '1', tit:$('#biTit', c).checked }) }],
      alAbrir:c => {
        const m = () => { const h = hs.find(x => x.id === $('#biHoja', c).value); $('#biM1', c).style.background = h.color; };
        $('#biHoja', c).onchange = m; m();
        $$('.bi-ops .opcion', c).forEach(b => b.onclick = () => $$('.bi-ops .opcion', c).forEach(x => x.classList.toggle('on', x === b)));
      } });
    if(!v) return;
    const h = hs.find(x => x.id === v.id);
    if(v.pdf) return this.pdf(h, v.color, v.tit);
    let z = $('#blocPrint'); if(!z){ z = document.createElement('div'); z.id = 'blocPrint'; document.body.appendChild(z); }
    z.innerHTML = (v.tit ? `<h1 class="bp-tit" style="border-color:${h.tab}">${esc(h.nombre)}</h1>` : '') + `<div class="bloc-hoja">${h.html || ''}</div>`;
    z.style.setProperty('--papel', v.color ? h.color : '#ffffff');
    document.body.classList.add('imprimiendo-bloc');
    const fin = () => { document.body.classList.remove('imprimiendo-bloc'); z.innerHTML = ''; removeEventListener('afterprint', fin); };
    addEventListener('afterprint', fin);
    // esperar a que se carguen las fotos antes de imprimir
    await Promise.all([...z.querySelectorAll('img')].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
    setTimeout(() => { window.print(); setTimeout(() => { if(!matchMedia('print').matches) fin(); }, 1500); }, 150);
  },
  /* ---------- Guardar una hoja como PDF (A4) ---------- */
  async pdf(h, color, tit){
    toast('📄 Preparando el PDF…', null, null, 20000);
    try{
      if(!window.html2canvas) await cargarScript('html2canvas.min.js');
      if(!window.jspdf) await cargarScript('jspdf.min.js');
    }catch(e){ toast('⚠️ No se pudo preparar el PDF (¿sin internet la primera vez?)'); return; }
    const papel = color ? h.color : '#ffffff';
    const W = 794, M = 56;                                          // A4 a 96 ppp, márgenes ~15 mm
    const z = document.createElement('div'); z.className = 'bloc-pdf';
    z.style.cssText = `position:fixed;left:-10000px;top:0;width:${W}px;background:${papel};padding:${M}px;box-sizing:border-box`;
    z.innerHTML = (tit ? `<h1 class="bp-tit" style="border-color:${h.tab}">${esc(h.nombre)}</h1>` : '') + `<div class="bloc-hoja">${h.html || ''}</div>`;
    document.body.appendChild(z);
    try{
      await Promise.all([...z.querySelectorAll('img')].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
      const cv = await html2canvas(z, { scale:2, backgroundColor:papel, useCORS:true, logging:false });
      const { jsPDF } = window.jspdf, doc = new jsPDF({ unit:'mm', format:'a4', compress:true });
      const pw = 210, ph = 297, altoPag = Math.floor(cv.width * ph / pw);   // alto de una página en px del dibujo
      const bg = papel.match(/[0-9a-f]{2}/gi).map(x => parseInt(x, 16));
      for(let y = 0, n = 0; y < cv.height; y += altoPag, n++){
        if(n) doc.addPage();
        doc.setFillColor(bg[0], bg[1], bg[2]); doc.rect(0, 0, pw, ph, 'F');
        const trozo = document.createElement('canvas'); trozo.width = cv.width; trozo.height = Math.min(altoPag, cv.height - y);
        const tx = trozo.getContext('2d'); tx.fillStyle = papel; tx.fillRect(0, 0, trozo.width, trozo.height); tx.drawImage(cv, 0, -y);
        doc.addImage(trozo.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, pw, trozo.height * pw / cv.width);
      }
      const blob = doc.output('blob'), nombre = (h.nombre || 'hoja').replace(/[^\w\- áéíóúñç]/gi, '').trim().slice(0, 40) + '.pdf';
      const file = new File([blob], nombre, { type:'application/pdf' });
      if(matchMedia('(pointer:coarse)').matches && navigator.canShare && navigator.canShare({ files:[file] })){
        try{ await navigator.share({ files:[file], title:nombre }); }catch(e){ if(e.name !== 'AbortError') descargar(blob, nombre); }
      } else descargar(blob, nombre);
      toast('📄 PDF «' + nombre + '» listo (' + tamTxt(blob.size) + ')');
    }catch(e){ console.warn(e); toast('⚠️ No se pudo hacer el PDF'); }
    finally{ z.remove(); }
  },
  async menu(){
    const v = await popup({ tit:'🔒 Bloc de notas', html:`<button class="opcion" data-v="hoja">📄 Nombre y colores de esta hoja</button>
        <button class="opcion" data-v="imp-hoja">🖨 Imprimir o 📄 guardar en PDF</button>
        <button class="opcion" data-v="exp">💾 Exportar una copia</button><button class="opcion" data-v="imp">📥 Importar una copia</button>
        <button class="opcion" data-v="cerrar">🔒 Cerrar con candado</button>
        <p class="aj-ayuda" style="margin-top:10px">Las notas se guardan solo en este aparato, cifradas con tu contraseña. Para pasarlas a otro aparato: exporta aquí e importa allí.</p>`,
      botones:[{ txt:'Cerrar', val:null }], alAbrir:(c, fin) => $$('[data-v]', c).forEach(b => b.onclick = () => fin(b.dataset.v)) });
    if(v === 'hoja') this.opcionesHoja();
    if(v === 'imp-hoja') this.imprimir();
    if(v === 'exp') this.exportar();
    if(v === 'imp') this.importar();
    if(v === 'cerrar') this.cerrarBloc();
  },

  /* ---------- Configuración → 🔒 Bloc ---------- */
  async pintarAjustes(el){
    await this.leerPaq();
    const hay = this.existe();
    el.innerHTML = `<div class="aj-caja">
      <h4>🔒 Bloc de notas secreto</h4>
      <p class="aj-ayuda">Se abre desde el calendario con el botón 📒. Las notas se guardan <b>solo en este aparato</b> y <b>cifradas</b>: sin la contraseña nadie las puede leer.</p>
      <p class="aj-ayuda" style="color:#c4170f"><b>Importante:</b> si olvidas la contraseña, las notas no se pueden recuperar.</p>
      ${hay ? `<button class="btn-pri btn-ancho" id="bjCambiar" style="margin-top:12px">🔑 Cambiar la contraseña</button>
        <button class="btn-sec btn-ancho" id="bjExp" style="margin-top:8px">💾 Exportar una copia</button>
        <button class="btn-sec btn-ancho" id="bjImp" style="margin-top:8px">📥 Importar una copia</button>
        <button class="btn-borrar-tarea" id="bjBorrar" style="margin-top:18px">🗑 Borrar el bloc de este aparato</button>`
      : `<button class="btn-pri btn-ancho" id="bjCrear" style="margin-top:12px">🔑 Poner contraseña y crear el bloc</button>
        <button class="btn-sec btn-ancho" id="bjImp" style="margin-top:8px">📥 Importar una copia de otro aparato</button>`}
    </div>`;
    const r = () => this.pintarAjustes(el);
    const ok = (a, b) => !a ? 'Escribe la contraseña' : a.length < 4 ? 'Pon al menos 4 caracteres' : a !== b ? 'Las dos contraseñas no son iguales' : '';
    if($('#bjCrear', el)) $('#bjCrear', el).onclick = async () => {
      const v = await this.pedir('🔑 Contraseña del bloc', 'Elige una contraseña y escríbela dos veces. Solo verás puntos.', [['bjN1', 'Contraseña nueva'], ['bjN2', 'Repítela']], async ([a, b]) => ok(a, b));
      if(!v) return;
      this.sal = crypto.getRandomValues(new Uint8Array(16)); this.clave = await this.derivar(v[0], this.sal); this.datos = this.nuevo();
      await this.guardar(); this.clave = null; this.datos = null; this.sal = null;
      toast('🔒 Bloc creado. Ábrelo desde el calendario (📒)'); r();
    };
    if($('#bjCambiar', el)) $('#bjCambiar', el).onclick = async () => {
      const paq = JSON.parse(await this.leerPaq()); let datos = null;
      const v = await this.pedir('🔑 Cambiar la contraseña', 'Escribe la contraseña de ahora y la nueva (dos veces).', [['bjA', 'Contraseña de ahora'], ['bjN1', 'Contraseña nueva'], ['bjN2', 'Repite la nueva']], async ([a, n1, n2]) => {
        try{ datos = (await this.descifrar(paq, a)).obj; }catch(e){ return 'La contraseña de ahora no es correcta'; }
        return ok(n1, n2);
      });
      if(!v || !datos) return;
      if(this.clave){ this.leerHoja(); datos = this.datos; }
      this.sal = crypto.getRandomValues(new Uint8Array(16)); const clave = await this.derivar(v[1], this.sal);
      const abierto = !!this.clave; this.clave = clave; this.datos = datos; await this.guardar();
      if(!abierto){ this.clave = null; this.datos = null; this.sal = null; }
      toast('🔑 Contraseña cambiada');
    };
    if($('#bjExp', el)) $('#bjExp', el).onclick = async () => { descargar(new Blob([await this.leerPaq()], { type:'application/json' }), 'bloc-porhacer-' + iso(new Date()) + '.json'); toast('💾 Copia guardada (va cifrada)'); };
    $('#bjImp', el).onclick = () => this.importar();
    if($('#bjBorrar', el)) $('#bjBorrar', el).onclick = async () => {
      if(!await popConfirmar('¿Borrar el bloc?', 'Se borrarán todas las hojas de este aparato. Si no tienes una copia exportada, no se podrán recuperar.', 'Borrar')) return;
      const v = await popup({ tit:'¿Seguro del todo?', html:'<p>Esto no se puede deshacer.</p>', botones:[{ txt:'No', val:false }, { txt:'Sí, borrar', cls:'btn-borrar', val:true }] });
      if(!v) return;
      await this.borrarPaq(); lsSet(this.K, null); this.clave = null; this.datos = null; cerrar('bloc'); toast('🗑 Bloc borrado'); r();
    };
  },

  /* ---------- Tamaño de la letra ---------- */
  TAMS: [[2, 'Pequeña'], [3, 'Normal'], [4, 'Mediana'], [5, 'Grande'], [6, 'Muy grande'], [7, 'Enorme']],
  menuTam(b){
    let m = $('#blocTamMenu');
    if(m && m.classList.contains('on')){ this.cerrarMenuTam(); return; }
    if(!m){ m = document.createElement('div'); m.id = 'blocTamMenu'; $('#blocBarra').appendChild(m); }
    const act = this.tamActual();
    m.innerHTML = this.TAMS.map(([n, t]) => `<button type="button" data-a="tam" data-t="${n}" class="${n === act ? 'on' : ''}"><font size="${n}">Aa</font><span>${t}</span></button>`).join('')
      + '<button type="button" data-a="limpio" class="limpio">🧽 <span>Quitar el formato</span></button>';
    const r = b.getBoundingClientRect(), rb = $('#blocBarra').getBoundingClientRect();
    m.style.left = Math.max(4, r.left - rb.left) + 'px'; m.style.top = (r.bottom - rb.top + 4) + 'px';
    m.classList.add('on');
  },
  cerrarMenuTam(){ const m = $('#blocTamMenu'); if(m) m.classList.remove('on'); },
  tamActual(){ let n = 3; try{ const v = document.queryCommandValue('fontSize'); if(v && /^\d$/.test(v)) n = +v; }catch(e){} return n; },
  tamano(n){
    this.cerrarMenuTam();
    const el = $('#blocHoja'); el.focus();
    const s = getSelection();
    if(this._rango && el.contains(this._rango.startContainer) && !(s.rangeCount && el.contains(s.anchorNode))){ s.removeAllRanges(); s.addRange(this._rango); }
    try{ document.execCommand('styleWithCSS', false, false); }catch(e){}
    document.execCommand('fontSize', false, String(n));
    this.tam = n; this.pintarTam(); this.guardarLuego();
  },
  pintarTam(){ const b = $('#blocBarra [data-a=n]'); if(b){ const t = (this.TAMS.find(x => x[0] === this.tamActual()) || this.TAMS[1])[1]; b.innerHTML = 'Aa <small>▾</small>'; b.title = 'Tamaño de la letra: ' + t; } },

  /* ---------- Arranque ---------- */
  iniciar(){
    const el = $('#blocHoja');
    $('#btnBloc').innerHTML = icono('bloc');
    $('#btnBloc').onclick = () => this.abrir();
    $('#blocX').onclick = () => this.cerrarBloc();
    $('#blocMenu').onclick = () => this.menu();
    $('#blocTabs').addEventListener('click', e => {
      const b = e.target.closest('[data-h]'); if(!b) return;
      if(b.dataset.h === '+') this.nuevaHoja();
      else if(b.dataset.h === this.hoja) this.opcionesHoja();      // tocar la pestaña activa = sus opciones
      else this.cambiar(b.dataset.h);
    });
    // la barra: que no se pierda lo seleccionado al pulsar
    $('#blocBarra').addEventListener('mousedown', e => { if(e.target.closest('button')) e.preventDefault(); });
    document.addEventListener('pointerdown', e => { if(!e.target.closest('#blocTamMenu, #blocBarra [data-a=n]')) this.cerrarMenuTam(); });
    this.pintarTam();
    $('#blocGuardar').onclick = async () => { clearTimeout(this._t); await this.guardar(); toast('💾 Bloc guardado'); };
    // pasar de hoja deslizando el dedo
    deslizarPaginas($('#blocHoja'), { soloDedo:true,
      ignorar: t => !!t.closest('img'),
      puede: dir => { if(!this.datos) return false; const i = this.datos.hojas.findIndex(h => h.id === this.hoja); return this.datos.hojas[i + dir] !== undefined; },
      cont: () => $('#blocHoja'),
      fondo: () => (this.actual() || {}).color || '#fff',
      cambio: dir => { const i = this.datos.hojas.findIndex(h => h.id === this.hoja), h = this.datos.hojas[i + dir]; if(!h) return; this.cambiar(h.id); const t = $(`.bloc-tab[data-h="${h.id}"]`); t && t.scrollIntoView({ inline:'nearest', block:'nearest' }); } });
    $('#blocBarra').addEventListener('click', e => {
      const b = e.target.closest('button'); if(!b) return;
      const a = b.dataset.a;
      if(a === 'b') this.cmd('bold');
      else if(a === 'n') this.menuTam(b);
      else if(a === 'tam'){ this.tamano(+b.dataset.t); }
      else if(a === 'limpio'){ this.cerrarMenuTam(); this.cmd('removeFormat'); try{ if(document.queryCommandState('bold')) this.cmd('bold'); }catch(_){} }
      else if(a === 'check' || a === 'punto' || a === 'num') this.lista(a);
      else if(a === 'sub') this.cmd('hiliteColor', b.dataset.c);
      else if(a === 'nosub') this.cmd('hiliteColor', 'transparent');
      else if(a === 'hoja') this.opcionesHoja();
      else if(a === 'ico'){ document.execCommand('insertText', false, b.dataset.i); this.guardarLuego(); }
      else if(a === 'foto'){ this.guardarRango(); $('#blocFotoIn').click(); }
    });
    $('#blocIconos').innerHTML = ICONOS_NOTA.map(i => `<button type="button" data-a="ico" data-i="${i}">${i}</button>`).join('');
    // pintar las muestras de subrayado
    $('#blocSubs').innerHTML = this.SUBRAYA.map(([c, n]) => `<button type="button" data-a="sub" data-c="${c}" title="Subrayar: ${n}" style="--s:${c}"></button>`).join('') + '<button type="button" data-a="nosub" class="nosub" title="Quitar el subrayado">✕</button>';
    el.addEventListener('input', () => { this.guardarLuego(); if(this._sel) this.colocarMarco(); });
    el.addEventListener('scroll', () => { if(this._sel) this.colocarMarco(); });
    addEventListener('resize', () => { if(this._sel) this.colocarMarco(); });
    el.addEventListener('click', e => { if(e.target.tagName === 'IMG') this.elegirFoto(e.target); else this.soltarFoto(); });
    el.addEventListener('keyup', () => this.guardarRango()); el.addEventListener('mouseup', () => this.guardarRango()); el.addEventListener('touchend', () => setTimeout(() => this.guardarRango(), 10));
    el.addEventListener('dragover', e => { if(e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
    el.addEventListener('drop', e => { const fs = e.dataTransfer && e.dataTransfer.files; if(fs && fs.length){ e.preventDefault(); const r = document.caretRangeFromPoint ? document.caretRangeFromPoint(e.clientX, e.clientY) : null; if(r) this._rango = r; this.ponerFotos(fs); } });
    $('#blocFotoIn').onchange = e => { this.ponerFotos(e.target.files); e.target.value = ''; };
    document.addEventListener('selectionchange', () => { if($('#bloc').classList.contains('abierto')){ this.marcarBarra(); this.pintarTam(); } });
    // tocar la casilla de una lista ☑
    el.addEventListener('click', e => {
      const li = e.target.closest("ul.casillas > li"); if(!li) return;
      const r = li.getBoundingClientRect();
      if(e.clientX - r.left < 28){ li.classList.toggle('hecho'); this.guardarLuego(); }
    });
    // pegar: solo el texto, sin formatos raros
    el.addEventListener('paste', e => { e.preventDefault(); const cd = e.clipboardData || window.clipboardData; const fs = cd.files && cd.files.length ? cd.files : null; if(fs){ this.guardarRango(); this.ponerFotos(fs); return; } document.execCommand('insertText', false, cd.getData('text/plain')); });
    // al salir de la app con el bloc abierto, se guarda
    document.addEventListener('visibilitychange', () => { if(document.hidden && this.clave) this.guardar(); });
  }
};
