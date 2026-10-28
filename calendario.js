/* PorHacer · calendario por día, mes y año
   Cada tarea con fechas se dibuja con su color y el borde de su columna,
   ocupando todos los días que dura. */

const Cal = {
  fecha: new Date(), modo: 'mes',

  iniciar(){
    this.modo = App.ajustes.calModo || 'mes';
    $$('#calModo button').forEach(b => b.onclick = () => this.cambiarModo(b.dataset.m));
    $('#calPrev').onclick = () => this.mover(-1);
    $('#calNext').onclick = () => this.mover(1);
    $('#calHoy').onclick = () => { this.fecha = new Date(); this.pintar(); if(this.modo==='anio') setTimeout(()=>{ const a=$('.mmes.actual'); a && a.scrollIntoView({behavior:'smooth',block:'center'}); },60); };
    // Deslizar el dedo: la hoja se curva y sigue al dedo (como en la agenda de HOME)
    const c = $('#calCuerpo'); let D = null;
    c.addEventListener('pointerdown', e => {
      if(this.pasando || e.button > 0) return;
      D = { x:e.clientX, y:e.clientY, id:e.pointerId, ctx:null, lx:e.clientX, lt:performance.now(), v:0 };
    });
    c.addEventListener('pointermove', e => {
      if(!D || e.pointerId !== D.id) return;
      const dx = e.clientX - D.x, dy = e.clientY - D.y;
      if(!D.ctx){
        if(Math.abs(dx) < 10) return;
        if(Math.abs(dy) > Math.abs(dx) * 0.8){ D = null; return; }     // es scroll hacia arriba/abajo
        const dir = dx < 0 ? 1 : -1;
        this.pasando = true; this.swipeAt = Date.now();
        D.ctx = this.hojaEmpieza(dir); if(!D.ctx){ this.pasando = false; D = null; return; }
        try{ c.setPointerCapture(e.pointerId); }catch(_){}
      }
      const now = performance.now(); D.v = (e.clientX - D.lx) / Math.max(1, now - D.lt); D.lx = e.clientX; D.lt = now;
      D.ctx.render(Math.max(0, Math.min(1, (D.ctx.dir > 0 ? -dx : dx) / (D.ctx.W * 0.85))));
    });
    const fin = () => {
      if(!D) return; const d = D; D = null; if(!d.ctx) return;
      this.swipeAt = Date.now();
      const golpe = (d.ctx.dir > 0 ? -d.v : d.v) > 0.6;
      this.hojaA(d.ctx, (d.ctx.p > 0.45 || (golpe && d.ctx.p > 0.08)) ? 1 : 0, 650, () => { this.pasando = false; this.swipeAt = Date.now(); });
    };
    $('#calTabs').onclick = () => this.elegirTableros();
    c.addEventListener('pointerup', fin); c.addEventListener('pointercancel', fin);
    c.addEventListener('click', e => {
      if(this.swipeAt && Date.now() - this.swipeAt < 400) return;     // venía de pasar la hoja
      const bola = e.target.closest('[data-tb]'); if(bola){ e.stopPropagation(); this.burbuja(bola); return; }
      const b = e.target.closest('[data-t]'); if(b){ e.stopPropagation(); if(b.dataset.tid && typeof Nube !== 'undefined' && b.dataset.tid !== Nube.tid) this.abrirDeOtro(b.dataset.tid, b.dataset.t); else abrirEditor(b.dataset.t); return; }
      const nueva = e.target.closest('[data-nueva]'); if(nueva){ this.nuevaEn(nueva.dataset.nueva); return; }
      const d = e.target.closest('[data-d]'); if(d){ this.fecha = deIso(d.dataset.d); this.cambiarModo('dia'); return; }
      const m = e.target.closest('[data-m]'); if(m){ const [y,mm] = m.dataset.m.split('-').map(Number); this.fecha = new Date(y, mm, 1); this.cambiarModo('mes'); }
    });
  },
  abrir(){ $('#vTablero').classList.remove('activa'); $('#vListas').classList.remove('activa'); $('#vCal').classList.add('activa'); $('#fab').style.display='none'; this.pintar(); this.cargarOtros(true); },
  cerrar(){ $('#vCal').classList.remove('activa'); $('#vTablero').classList.add('activa'); $('#fab').style.display=''; pintarTodo(); },
  async cambiarModo(m){ this.modo = m; App.ajustes.calModo = m; guardarAjustes(); this.pintar(); },
  cambio(n){
    const f = this.fecha;
    if(this.modo === 'dia') this.fecha = new Date(f.getFullYear(), f.getMonth(), f.getDate()+n);
    else if(this.modo === 'mes') this.fecha = new Date(f.getFullYear(), f.getMonth()+n, 1);
    else this.fecha = new Date(f.getFullYear()+n, 0, 1);
    this.pintar();
  },
  // Botones ‹ ›: la hoja pasa sola
  mover(n){
    if(this.pasando) return;
    if(matchMedia('(prefers-reduced-motion: reduce)').matches){ this.cambio(n); return; }
    const ctx = this.hojaEmpieza(n);
    if(ctx){ this.pasando = true; this.hojaA(ctx, 1, 850, () => { this.pasando = false; }); }
  },

  /* ---- Hoja que se curva al pasar (mismo efecto que el calendario de HOME) ---- */
  hojaEmpieza(dir){
    const cont = $('#calCuerpo');
    const r = cont.getBoundingClientRect(), W = r.width, H = r.height;
    if(W < 10 || H < 10){ this.cambio(dir); return null; }
    const viejo = cont.cloneNode(true); viejo.removeAttribute('id');
    const scroll = cont.scrollTop;
    this.cambio(dir);                                  // debajo ya está la hoja nueva
    const wrap = document.createElement('div'); wrap.className = 'curl-wrap';
    Object.assign(wrap.style, { left:r.left+'px', top:r.top+'px', width:W+'px', height:H+'px' });
    const old = document.createElement('div'); old.className = 'curl-old';
    const raiz = getComputedStyle(document.documentElement);
    old.style.background = `linear-gradient(180deg, ${raiz.getPropertyValue('--bg')}, ${raiz.getPropertyValue('--bg2')})`;
    viejo.classList.remove('pasa-izq','pasa-der');
    Object.assign(viejo.style, { position:'absolute', inset:'0', width:'100%', height:'100%', overflow:'hidden', margin:'0' });
    old.appendChild(viejo);
    const mk = cl => { const d = document.createElement('div'); d.className = cl; return d; };
    const cast = mk('curl-strip'), oldShade = mk('curl-strip'), flap = mk('curl-strip'), rim = mk('curl-strip');
    wrap.append(cast, old, oldShade, flap, rim); document.body.appendChild(wrap);
    viejo.scrollTop = scroll;
    const tone = raiz.getPropertyValue('--dark').trim() || '#3a3a3c';
    const paper = `color-mix(in srgb, ${tone}, #fff 88%)`;
    const X = x => dir > 0 ? x : W - x;
    const strip = (node, x0, x1, w, side, bg, clip) => {
      const sx0 = X(x0), sx1 = X(x1), sd = dir > 0 ? side : -side;
      node.style.left = (sd < 0 ? sx0 - w : sx0) + 'px'; node.style.width = Math.max(0, w) + 'px';
      node.style.transform = `skewX(${Math.atan((sx1 - sx0) / H) * 180 / Math.PI}deg)`;
      node.style.background = bg(sd < 0 ? '90deg' : '270deg'); node.style.clipPath = clip ? clip(sd) : 'none';
    };
    const ctx = { dir, W, H, p:0, wrap, revert: () => this.cambio(-dir) };
    ctx.render = p => {
      ctx.p = p;
      const tilt = Math.min(H, 700) * 0.24 * (0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, p * 1.05))) * (p < .02 ? p / .02 : 1);
      const fx = (W + tilt) * (1 - p) - tilt * p, top = fx + tilt, bot = fx - tilt;
      const wT = Math.max(0, W - top) * 0.62, wB = Math.max(0, W - bot) * 0.62, wA = (wT + wB) / 2;
      old.style.clipPath = `polygon(${X(0)}px 0,${X(top)}px 0,${X(bot)}px ${H}px,${X(0)}px ${H}px)`;
      strip(flap, top, bot, wA, -1, deg => `linear-gradient(${deg}, color-mix(in srgb, ${paper}, ${tone} 38%) 0%, color-mix(in srgb, ${paper}, ${tone} 14%) 7%, ${paper} 22%, #ffffff 44%, ${paper} 62%, color-mix(in srgb, ${paper}, ${tone} 16%) 84%, color-mix(in srgb, ${paper}, ${tone} 34%) 100%)`,
        sd => sd < 0 ? `polygon(${wA - wT}px 0,100% 0,100% 100%,${wA - wB}px 100%)` : `polygon(0 0,${wT}px 0,${wB}px 100%,0 100%)`);
      strip(rim, top, bot, 3, -1, deg => `linear-gradient(${deg}, rgba(0,0,0,0), color-mix(in srgb, ${tone}, #000 8%))`);
      strip(cast, top, bot, 46 * (0.4 + 0.6 * Math.sin(Math.PI * p)), 1, deg => `linear-gradient(${deg === '90deg' ? '270deg' : '90deg'}, rgba(0,0,0,0), rgba(30,30,40,.22))`);
      const oT = top - wT, oB = bot - wB;
      strip(oldShade, oT, oB, 22, -1, deg => `linear-gradient(${deg === '90deg' ? '270deg' : '90deg'}, rgba(30,30,40,.15), rgba(0,0,0,0))`);
      oldShade.style.opacity = (oT < W * 0.98 && p > 0.01) ? 1 : 0;
    };
    ctx.render(0); return ctx;
  },
  hojaA(ctx, target, dur, hecho){
    const from = ctx.p, t0 = performance.now(), d = Math.max(140, dur * Math.abs(target - from));
    const ease = t => 1 - Math.pow(1 - t, 3);
    const frame = now => {
      const q = Math.min(1, (now - t0) / d); ctx.render(from + (target - from) * ease(q));
      if(q < 1){ requestAnimationFrame(frame); return; }
      ctx.wrap.remove(); if(target < 1) ctx.revert(); if(hecho) hecho();
    };
    requestAnimationFrame(frame);
  },
  async nuevaEn(dia){
    await abrirEditor(null);
    $('#edIni').value = dia; $('#edFin').value = dia; pintarDur();
  },
  /* ----- Varios tableros a la vez ----- */
  otros: {},                       // tid → { tareas, cols, borde, cargado }
  todosTab(){ return (typeof Nube !== 'undefined' && Nube.activa) ? [...Nube.misTableros(), ...Nube.compartidos()] : []; },
  hayTableros(){ return this.todosTab().length > 1 && !(typeof Azure !== 'undefined' && Azure.activo); },
  elegidos(){
    if(!this.hayTableros()) return [null];
    const ids = this.todosTab().map(t => t.id);
    let l = []; try{ l = JSON.parse(lsGet('ph-cal-tabs') || '[]'); }catch(e){}
    l = l.filter(x => ids.includes(x));
    return l.length ? l : [Nube.tid];
  },
  colorTab(tid){
    const P = ['#e5484d','#3b82f6','#f59e0b','#22a55a','#8b5cf6','#ec4899','#14b8a6','#a16207','#0ea5e9','#64748b','#84cc16','#f97316'];
    const i = this.todosTab().findIndex(t => t.id === tid); return P[(i < 0 ? 0 : i) % P.length];
  },
  nombreTab(tid){ return Nube.nombreTablero(Nube.tableros[tid]); },
  inicialTab(tid){ const n = this.nombreTab(tid).replace(/^\s*tablero\s+(de|del|de la)\s+/i, '').trim(); return ([...n][0] || '?').toUpperCase(); },
  bola(x, varios){
    if(!varios || !x.tid) return '';
    return `<i class="tb-bola" data-tb="${x.tid}" style="background:${this.colorTab(x.tid)}" title="${esc(this.nombreTab(x.tid))}">${esc(this.inicialTab(x.tid))}</i>`;
  },
  burbuja(el){
    let b = $('#tbBurbuja'); if(!b){ b = document.createElement('div'); b.id = 'tbBurbuja'; document.body.appendChild(b); }
    const tid = el.dataset.tb, r = el.getBoundingClientRect();
    b.innerHTML = `<i style="background:${this.colorTab(tid)}">${esc(this.inicialTab(tid))}</i>📋 ${esc(this.nombreTab(tid))}`;
    b.className = 'on';
    const w = Math.min(innerWidth - 20, b.offsetWidth);
    b.style.left = Math.max(10, Math.min(innerWidth - w - 10, r.left + r.width / 2 - w / 2)) + 'px';
    b.style.top = (r.top > 70 ? r.top - 42 : r.bottom + 8) + 'px';
    clearTimeout(this._bT); this._bT = setTimeout(() => b.className = '', 2600);
  },
  // Lee las tareas de los otros tableros elegidos (las del abierto ya están en el móvil)
  async cargarOtros(forzar){
    if(!this.hayTableros()) return;
    const faltan = this.elegidos().filter(tid => tid !== Nube.tid && (forzar || !this.otros[tid]));
    if(!faltan.length) return;
    this.cargando = true; this.pintarTabs();
    await Promise.all(faltan.map(async tid => {
      try{
        const [ts, cf] = await Promise.all([Nube.colDe(tid, 'tareas').get(), Nube.colDe(tid, 'config').doc('tablero').get().catch(() => null)]);
        const c = cf && cf.exists ? cf.data() : {};
        this.otros[tid] = { tareas: ts.docs.map(x => x.data()), cols: c.columnas || COLUMNAS_INICIO, borde: c.bordeColumna !== undefined ? c.bordeColumna : App.ajustes.bordeColumna, cargado: Date.now() };
      }catch(e){ console.warn('calendario', tid, e); }
    }));
    this.cargando = false;
    if($('#vCal').classList.contains('activa')) this.pintar();
  },
  pintarTabs(){
    const el = $('#calTabs'); if(!el) return;
    el.hidden = !this.hayTableros(); if(el.hidden) return;
    const sel = this.elegidos(), n = sel.length, todos = this.todosTab().length;
    const txt = n === 1 ? (sel[0] === Nube.tid ? 'Este tablero' : this.nombreTab(sel[0])) : n === todos ? 'Todos los tableros' : n + ' tableros';
    el.innerHTML = `<span class="ct-lbl">📋 ${esc(txt)}</span><span class="ct-bolas">${sel.map(tid => `<i style="background:${this.colorTab(tid)}">${esc(this.inicialTab(tid))}</i>`).join('')}</span>${this.cargando ? '<span class="ct-carga">⏳</span>' : ''}<span class="ct-flecha">▾</span>`;
  },
  async elegirTableros(){
    const lista = this.todosTab(), sel = new Set(this.elegidos());
    const fila = t => `<label class="ct-op"><input type="checkbox" value="${t.id}" ${sel.has(t.id) ? 'checked' : ''}>
      <i style="background:${this.colorTab(t.id)}">${esc(this.inicialTab(t.id))}</i>
      <span><b>${esc(Nube.nombreTablero(t))}</b><small>${t.id === Nube.tid ? 'Abierto ahora' : Nube.esDueno(t) ? 'Tuyo' : 'Compartido contigo'}</small></span></label>`;
    const v = await popup({ tit:'📅 ¿Qué tableros quieres ver?',
      html:`<p class="aj-ayuda" style="margin:0 0 8px">Elige uno, varios o todos. Cada tarea llevará una redonda con la inicial de su tablero.</p>
        <div class="ct-rapido"><button class="mini-btn" data-r="todos">✓ Todos</button><button class="mini-btn" data-r="este">Solo este</button></div>
        <div class="ct-lista">${lista.map(fila).join('')}</div>`,
      botones:[{ txt:'Cancelar', val:null }, { txt:'Ver', cls:'btn-pri', val:c => $$('.ct-lista input:checked', c).map(i => i.value),
        validar:c => { if(!$$('.ct-lista input:checked', c).length){ toast('Elige al menos un tablero'); return false; } return true; } }],
      alAbrir:c => { $$('[data-r]', c).forEach(b => b.onclick = () => $$('.ct-lista input', c).forEach(i => i.checked = b.dataset.r === 'todos' || i.value === Nube.tid)); } });
    if(!v) return;
    lsSet('ph-cal-tabs', JSON.stringify(v));
    this.pintar(); this.cargarOtros(false);
  },
  async abrirDeOtro(tid, id){
    const nom = this.nombreTab(tid);
    const ok = await popConfirmar('📋 Tablero «' + nom + '»', 'Esta tarea es del tablero «' + nom + '». Para abrirla vamos a ese tablero.', 'Ir y abrirla');
    if(!ok) return;
    await Nube.conectar(tid);
    for(let i = 0; i < 40 && !App.tareas.some(t => t.id === id); i++) await new Promise(r => setTimeout(r, 150));
    if(App.tareas.some(t => t.id === id)) abrirEditor(id); else toast('No he encontrado la tarea');
  },
  borde(x){ if(!x.tid || x.tid === (typeof Nube !== 'undefined' && Nube.tid)) return bordeDe(x.t); const o = this.otros[x.tid]; return o && o.borde ? x.col.color : (x.t.color ? mezcla(x.t.color,'#000',.25) : 'var(--line)'); },
  // tareas con fecha que se ven (columnas visibles + filtro del tablero)
  tareas(){
    const out = [], sel = this.elegidos();
    for(const tid of sel){
      if(!tid || tid === Nube.tid){
        App.tareas.filter(t => rango(t) && colDe(t.colId).visible && pasaFiltro(t)).forEach(t => out.push({ t, r:rango(t), tid, col:colDe(t.colId) }));
      } else {
        const o = this.otros[tid]; if(!o) continue;
        o.tareas.forEach(t => { const r = rango(t); if(!r) return; const col = o.cols.find(c => c.id === t.colId) || o.cols[0]; if(!col || col.visible === false) return; out.push({ t, r, tid, col }); });
      }
    }
    this.varios = sel.length > 1;
    return out.sort((a,b) => a.r[0].localeCompare(b.r[0]) || difDias(b.r[0],b.r[1]) - difDias(a.r[0],a.r[1]));
  },
  pintar(){
    $$('#calModo button').forEach(b => b.classList.toggle('on', b.dataset.m === this.modo));
    this.pintarTabs(); const bb = $('#tbBurbuja'); if(bb) bb.className = '';
    const c = $('#calCuerpo');
    if(this.modo === 'dia') c.innerHTML = this.htmlDia();
    else if(this.modo === 'mes') c.innerHTML = this.htmlMes();
    else c.innerHTML = this.htmlAnio();
    const sin = App.tareas.filter(t => !rango(t) && colDe(t.colId).visible && !colDe(t.colId).hecha).length;
    $('#calSinFecha').innerHTML = sin ? `<div class="sinfecha-box"><b>${sin}</b> tarea${sin>1?'s':''} sin fecha no ${sin>1?'salen':'sale'} en el calendario. Ponles fecha de inicio o fin para verlas aquí.</div>` : '';
    if(this.modo !== 'anio') c.scrollTop = 0;
    else if(this.fecha.getFullYear() === new Date().getFullYear()) setTimeout(() => { const a = $('.mmes.actual'); if(a) c.scrollTop = Math.max(0, a.offsetTop - c.offsetTop - 70); }, 30);
  },

  /* ----- MES ----- */
  htmlMes(){
    const y = this.fecha.getFullYear(), m = this.fecha.getMonth(), hoy = hoyIso();
    $('#calTit').textContent = MESES[m] + ' ' + y;
    const prim = new Date(y, m, 1);
    const ini = new Date(prim); ini.setDate(1 - ((prim.getDay()+6)%7));
    const ult = new Date(y, m+1, 0);
    const lista = this.tareas();
    const mesA = iso(prim), mesB = iso(ult);
    $('#calSub').textContent = (n => n ? n+' tarea'+(n>1?'s':'')+' este mes' : 'Sin tareas este mes')(lista.filter(x => x.r[0] <= mesB && x.r[1] >= mesA).length);

    let html = '<div class="mes"><div class="dsem">' + ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d=>`<span>${d}</span>`).join('') + '</div>';
    const d = new Date(ini);
    while(d <= ult || (d.getDay()+6)%7 !== 0){
      const dias = []; for(let i=0;i<7;i++){ dias.push(iso(d)); d.setDate(d.getDate()+1); }
      const a = dias[0], b = dias[6];
      // carriles para que las barras no se pisen
      const segs = [], carriles = [];
      for(const x of lista){
        if(x.r[1] < a || x.r[0] > b) continue;
        const s = Math.max(0, difDias(a, x.r[0])), e = Math.min(6, difDias(a, x.r[1]));
        let k = carriles.findIndex(fin => fin < s); if(k < 0){ k = carriles.length; carriles.push(-1); }
        carriles[k] = e; segs.push({ ...x, s, e, k });
      }
      const MAX = 6, vis = Math.min(carriles.length, MAX);
      const extra = Array(7).fill(0); segs.filter(z => z.k >= MAX).forEach(z => { for(let i=z.s;i<=z.e;i++) extra[i]++; });
      const alto = Math.max(96, 32 + vis*22 + (extra.some(Boolean) ? 18 : 6));
      html += `<div class="semana">` + dias.map((di, i) => {
        const dd = deIso(di);
        const cls = ['dia', dd.getMonth()!==m?'fuera':'', di===hoy?'hoy':'', i>=5?'finde':''].join(' ');
        return `<div class="${cls}" data-d="${di}" style="min-height:${alto}px"><span class="num">${dd.getDate()}</span>${extra[i] ? `<span class="mas-n" style="left:4px;bottom:3px">+${extra[i]}</span>`:''}</div>`;
      }).join('') + '<div class="barras">' + segs.filter(z => z.k < MAX).map(z => {
        const t = z.t, fondo = fondoTarea(t.color) || '#ffffff', bola = this.bola(z, this.varios);
        const cls = ['barra-t', z.r[0] < a ? 'cont-izq' : '', z.r[1] > b ? 'cont-der' : '', bola ? 'con-tb' : ''].join(' ');
        return `<div class="${cls}" data-t="${t.id}" ${z.tid ? `data-tid="${z.tid}"` : ''} title="${esc(t.titulo)}" style="left:calc(${z.s/7*100}% + 2px);width:calc(${(z.e-z.s+1)/7*100}% - 4px);top:${z.k*22}px;background:${fondo};border-color:${this.borde(z)}">${esc(t.titulo)}${bola}</div>`;
      }).join('') + '</div></div>';
    }
    return html + '</div>';
  },

  /* ----- AÑO ----- */
  htmlAnio(){
    const y = this.fecha.getFullYear(), hoy = hoyIso(), ahora = new Date();
    $('#calTit').textContent = y;
    const lista = this.tareas();
    $('#calSub').textContent = (n => n ? n+' tarea'+(n>1?'s':'')+' este año' : 'Sin tareas este año')(lista.filter(x => x.r[0] <= y+'-12-31' && x.r[1] >= y+'-01-01').length);
    let html = '<div class="anio">';
    for(let m=0; m<12; m++){
      const prim = new Date(y, m, 1), n = new Date(y, m+1, 0).getDate(), hueco = (prim.getDay()+6)%7;
      const a = iso(prim), b = iso(new Date(y, m, n));
      const delMes = lista.filter(x => x.r[0] <= b && x.r[1] >= a);
      let celdas = '';
      for(let i=0;i<hueco;i++) celdas += '<span class="vacio-d"></span>';
      for(let di=1; di<=n; di++){
        const s = iso(new Date(y, m, di));
        const ts = delMes.filter(x => x.r[0] <= s && s <= x.r[1]).slice(0, 3);
        let st = '';
        if(ts.length){
          const cs = ts.map(x => fondoTarea(x.t.color) || mezcla(x.col.color,'#ffffff',.6));
          st = cs.length === 1 ? `background:${cs[0]}` : `background:linear-gradient(135deg,${cs.map((c,i)=>`${c} ${i/cs.length*100}% ${(i+1)/cs.length*100}%`).join(',')})`;
        }
        celdas += `<span class="${ts.length?'c':''} ${s===hoy?'hoy':''}" style="${st}">${di}${ts.length ? `<i style="background:${this.borde(ts[0])}"></i>` : ''}</span>`;
      }
      const act = ahora.getFullYear()===y && ahora.getMonth()===m;
      html += `<div class="mmes ${act?'actual':''}" data-m="${y}-${m}"><h5><span>${MESES[m]} <em class="anio-de">${y}</em></span> <small>${delMes.length ? delMes.length+' 📋' : ''}</small></h5><div class="mgrid">${celdas}</div></div>`;
    }
    return html + '</div>';
  },

  /* ----- DÍA ----- */
  htmlDia(){
    const s = iso(this.fecha), d = this.fecha, hoy = hoyIso();
    $('#calTit').textContent = DIAS[d.getDay()] + ' ' + d.getDate();
    const lista = this.tareas().filter(x => x.r[0] <= s && s <= x.r[1]);
    $('#calSub').textContent = MESES[d.getMonth()] + ' ' + d.getFullYear() + (s===hoy ? ' · hoy' : '');
    let html = `<div class="dia-vista"><div class="dia-cab"><div class="grande"><small>${MESES[d.getMonth()].slice(0,3)}</small><b>${d.getDate()}</b></div>
      <div class="txt">${(x=>x[0].toUpperCase()+x.slice(1))(fLarga(s))}<small>${lista.length ? lista.length+' tarea'+(lista.length>1?'s':'')+' este día' : 'Ninguna tarea este día'}</small></div></div>`;
    html += lista.map(x => {
      const { t, r, col } = x, otro = x.tid && x.tid !== (typeof Nube !== 'undefined' && Nube.tid);
      const n = difDias(r[0], r[1]) + 1, i = difDias(r[0], s) + 1, p = otro ? null : persona(t.personaId);
      return `<div class="dia-t ${this.varios ? 'con-tb' : ''}" data-t="${t.id}" ${x.tid ? `data-tid="${x.tid}"` : ''} style="--tc:${fondoTarea(t.color)||'#fff'};--tb:${this.borde(x)}">
        ${this.bola(x, this.varios)}<b>${esc(t.titulo)}</b>
        <div class="lin"><span class="tag" style="border-color:${col.color}">● ${esc(col.nombre)}</span>${t.prio?`<span class="tag prio${t.prio}">${['','Baja','Media','Alta'][t.prio]}</span>`:''}${p?`<span class="tag">👤 ${esc(nombreP(p))}</span>`:''}${vencida(t)?'<span class="tag vencida">Vencida</span>':''}</div>
        ${n > 1 ? `<div class="tramo"><i style="left:0;width:${i/n*100}%"></i></div><div class="tramo-txt">Día ${i} de ${n} · del ${fCorta(r[0])} al ${fCorta(r[1])}</div>` : '<div class="tramo-txt">Solo este día</div>'}
      </div>`;
    }).join('');
    html += `<button class="btn-sec" data-nueva="${s}" style="height:50px;margin-top:4px">＋ Nueva tarea este día</button></div>`;
    return html;
  }
};
