/* PorHacer · app principal: tablero de columnas, tareas y editor */

const VERSION = 'V2';
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm = s => String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');

/* ---------- Fechas ---------- */
const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const DIAS = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const iso = d => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const deIso = s => { const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d); };
const hoyIso = () => iso(new Date());
const sumaDias = (s, n) => { const d = deIso(s); d.setDate(d.getDate()+n); return iso(d); };
const difDias = (a, b) => Math.round((deIso(b) - deIso(a)) / 86400000);
const fCorta = s => { if(!s) return ''; const d = deIso(s); return d.getDate()+' '+MESES[d.getMonth()].slice(0,3) + (d.getFullYear()!==new Date().getFullYear() ? ' '+String(d.getFullYear()).slice(2) : ''); };
const fLarga = s => { const d = deIso(s); return DIAS[d.getDay()]+', '+d.getDate()+' de '+MESES[d.getMonth()]+' de '+d.getFullYear(); };
function rango(t){ const a = t.ini || t.fin, b = t.fin || t.ini; if(!a) return null; return a <= b ? [a,b] : [b,a]; }

/* ---------- Estado ---------- */
const App = {
  ajustes: null, tareas: [], personas: [],
  filtro: 'todas', q: '',
  ed: null,                 // tarea que se está editando
  ignorarClick: false
};

function ajustesInicio(){
  return {
    id:'ajustes', tema:'grises', colores:{...TEMAS.grises.c},
    columnas: COLUMNAS_INICIO.map(c => ({...c})),
    bordeColumna:true, idiomaVoz:'es-ES', calidadFoto:'normal', calidadVideo:'normal',
    calModo:'mes', firma:''
  };
}
async function guardarAjustes(){ await DB.poner('ajustes', App.ajustes); }
const columnas = () => App.ajustes.columnas;
const colDe = id => columnas().find(c => c.id === id) || columnas()[0];
const persona = id => App.personas.find(p => p.id === id);
const nombreP = p => p ? (p.nombre + (p.apellidos ? ' '+p.apellidos : '')) : '';
const iniciales = p => p ? ((p.nombre||'?')[0] + ((p.apellidos||'')[0]||'')).toUpperCase() : '';
function colorPersona(p){ const cs=['#e5484d','#3b82f6','#22a55a','#f59e0b','#8b5cf6','#e0708f','#b9875a','#14b8a6']; let h=0; for(const ch of (p?.id||'')) h=(h*31+ch.charCodeAt(0))>>>0; return cs[h%cs.length]; }
function colHecha(){ return columnas().find(c => c.id==='acabada') || columnas().find(c => c.hecha) || columnas()[columnas().length-1]; }
function bordeDe(t){ return App.ajustes.bordeColumna ? colDe(t.colId).color : (t.color ? mezcla(t.color,'#000',.25) : 'var(--line)'); }

/* ---------- Popups y avisos ---------- */
function abrir(id){ $('#'+id).classList.add('abierto'); }
function cerrar(id){ $('#'+id).classList.remove('abierto'); }
let _toastT;
function toast(txt, accion, fn, ms=3200){
  const t = $('#toast');
  t.innerHTML = '<span>'+esc(txt)+'</span>' + (accion ? '<button>'+esc(accion)+'</button>' : '');
  if(accion) t.querySelector('button').onclick = () => { t.classList.remove('ver'); fn && fn(); };
  t.classList.add('ver'); clearTimeout(_toastT);
  _toastT = setTimeout(() => t.classList.remove('ver'), accion ? Math.max(ms, 6000) : ms);
}
function popup({ tit, html, botones, alAbrir }){
  return new Promise(ok => {
    $('#popTit').textContent = tit || '';
    $('#popCuerpo').innerHTML = html || '';
    const bx = $('#popBtns'); bx.innerHTML = '';
    (botones || [{txt:'Vale', cls:'btn-pri', val:true}]).forEach(b => {
      const el = document.createElement('button');
      el.className = b.cls || 'btn-sec'; el.textContent = b.txt;
      el.onclick = () => {
        if(b.validar && !b.validar($('#popCuerpo'))) return;
        const v = typeof b.val === 'function' ? b.val($('#popCuerpo')) : b.val;
        cerrar('popup'); ok(v);
      };
      bx.appendChild(el);
    });
    abrir('popup');
    alAbrir && alAbrir($('#popCuerpo'), v => { cerrar('popup'); ok(v); });
  });
}
const popAviso = (tit, txt) => popup({ tit, html:'<p>'+esc(txt)+'</p>' });
const popConfirmar = (tit, txt, si='Sí', peligro) => popup({ tit, html:'<p>'+esc(txt)+'</p>',
  botones:[{txt:'Cancelar', val:false}, {txt:si, cls:'btn-pri', val:true}] }).then(v => {
    return v; });

/* ---------- Selector de color desplegable ---------- */
function selColor(cont, valor, paleta, alCambiar, conPersonalizado=true){
  cont.classList.add('sel-color');
  let val = valor || '';
  const pinta = () => {
    cont.innerHTML = `<button type="button"><span class="muestra" style="background:${val||'#fff'}"></span><span>${esc(nombreColor(val))}</span></button>
      <div class="paleta">${paleta.map(p => `<button type="button" data-c="${p[0]?p[2]:''}" class="${(p[0]?p[2]:'').toLowerCase()===String(val).toLowerCase()?'on':''}"><span class="muestra" style="background:${p[2]}"></span>${esc(p[1])}</button>`).join('')}
      ${conPersonalizado ? `<label class="pers"><input type="color" value="${val && val.startsWith('#') && val.length===7 ? val : '#cccccc'}"> Otro color…</label>` : ''}</div>`;
    cont.firstElementChild.onclick = e => {
      e.stopPropagation();
      const ab = cont.classList.contains('abierto');
      $$('.sel-color.abierto').forEach(x => x.classList.remove('abierto'));
      if(!ab){ cont.classList.add('abierto'); const on = cont.querySelector('.paleta .on'); on && on.scrollIntoView({block:'nearest'}); }
    };
    $$('.paleta button', cont).forEach(b => b.onclick = e => { e.stopPropagation(); val = b.dataset.c; cont.classList.remove('abierto'); pinta(); alCambiar(val); });
    const ci = cont.querySelector('input[type=color]');
    if(ci){ ci.onclick = e => e.stopPropagation(); ci.onchange = () => { val = ci.value; cont.classList.remove('abierto'); pinta(); alCambiar(val); }; }
  };
  pinta();
  return { get valor(){ return val; }, poner(v){ val = v; pinta(); } };
}
document.addEventListener('click', () => $$('.sel-color.abierto').forEach(x => x.classList.remove('abierto')));

/* ---------- Filtros ---------- */
function semanaActual(){ const d = new Date(); const dow = (d.getDay()+6)%7; d.setDate(d.getDate()-dow); const a = iso(d); return [a, sumaDias(a,6)]; }
function vencida(t){ return t.fin && t.fin < hoyIso() && !colDe(t.colId).hecha; }
function pasaFiltro(t){
  const h = hoyIso(), r = rango(t);
  switch(App.filtro){
    case 'hoy': if(!(r && r[0] <= h && h <= r[1])) return false; break;
    case 'vencidas': if(!vencida(t)) return false; break;
    case 'semana': { const [a,b] = semanaActual(); if(!(r && r[0] <= b && r[1] >= a)) return false; break; }
    case 'sinfecha': if(r) return false; break;
    case 'alta': if(t.prio !== 3) return false; break;
    default: if(App.filtro.startsWith('p:') && t.personaId !== App.filtro.slice(2)) return false;
  }
  if(App.q){
    const p = persona(t.personaId);
    const txt = norm([t.titulo, t.notas, nombreP(p), p?.email, (t.subs||[]).map(s=>s.t).join(' '), colDe(t.colId).nombre].join(' '));
    if(!norm(App.q).split(/\s+/).every(w => txt.includes(w))) return false;
  }
  return true;
}
const FILTROS = [['todas','Todas','📋'],['hoy','Para hoy','☀️'],['semana','Esta semana','🗓️'],['vencidas','Vencidas','⏰'],['alta','Prioridad alta','🔥'],['sinfecha','Sin fecha','➖']];
function textoFiltro(){
  if(App.filtro.startsWith('p:')){ const p = persona(App.filtro.slice(2)); return p ? '👤 '+p.nombre : 'Todas'; }
  const f = FILTROS.find(x => x[0]===App.filtro); return f ? (f[0]==='todas' ? 'Todas' : f[2]+' '+f[1]) : 'Todas';
}
async function elegirFiltro(){
  const ops = FILTROS.map(f => `<button class="opcion ${App.filtro===f[0]?'on':''}" data-f="${f[0]}">${f[2]} ${f[1]}</button>`).join('')
    + (App.personas.length ? '<div class="lbl" style="margin-top:14px">Asignadas a</div>' + App.personas.map(p => `<button class="opcion ${App.filtro==='p:'+p.id?'on':''}" data-f="p:${p.id}"><span class="avatar" style="margin:0;background:${colorPersona(p)}">${esc(iniciales(p))}</span>${esc(nombreP(p))}</button>`).join('') : '');
  const v = await popup({ tit:'Ver tareas', html:ops, botones:[{txt:'Cerrar', val:null}],
    alAbrir:(c, fin) => $$('.opcion', c).forEach(b => b.onclick = () => fin(b.dataset.f)) });
  if(v){ App.filtro = v; pintarTodo(); }
}

/* ---------- Tablero ---------- */
function tareasDeCol(id){ return App.tareas.filter(t => t.colId === id && pasaFiltro(t)).sort((a,b) => (a.orden??0)-(b.orden??0) || a.creada-b.creada); }

function pintarChips(){
  $('#chipsCols').innerHTML = columnas().map(c => {
    const n = App.tareas.filter(t => t.colId===c.id && pasaFiltro(t)).length;
    return `<button class="chip ${c.visible?'':'oculta'}" data-c="${c.id}" title="${c.visible?'Ocultar':'Mostrar'} columna"><span class="bola" style="background:${c.color}"></span>${esc(c.nombre)}<span class="n">${n}</span><span class="ojo">${c.visible?'👁':'🙈'}</span></button>`;
  }).join('');
  $$('#chipsCols .chip').forEach(b => b.onclick = async () => {
    const c = colDe(b.dataset.c); c.visible = !c.visible;
    await guardarAjustes(); pintarTodo();
    if(c.visible){ const el = $(`.columna[data-c="${c.id}"]`); el && el.scrollIntoView({behavior:'smooth', inline:'start', block:'nearest'}); }
  });
  const fb = $('#btnFiltro'); $('#filtroTxt').textContent = textoFiltro(); fb.classList.toggle('activo', App.filtro !== 'todas');
}

function htmlTarjeta(t){
  const col = colDe(t.colId), p = persona(t.personaId), h = hoyIso(), r = rango(t);
  const subs = t.subs || [], hechos = subs.filter(s => s.ok).length;
  let meta = '';
  if(t.prio) meta += `<span class="tag prio${t.prio}">${['','Baja','Media','Alta'][t.prio]}</span>`;
  if(r){
    const txt = r[0]===r[1] ? fCorta(r[0]) : fCorta(r[0])+' → '+fCorta(r[1]);
    if(vencida(t)) meta += `<span class="tag vencida">⏰ ${txt}</span>`;
    else if(t.fin === h && !col.hecha) meta += `<span class="tag hoy">☀️ Hoy</span>`;
    else meta += `<span class="tag">📅 ${txt}</span>`;
  }
  if(subs.length) meta += `<span class="tag">☑️ ${hechos}/${subs.length}</span>`;
  if(t.nf) meta += `<span class="tag">📷 ${t.nf}</span>`;
  if(t.nv) meta += `<span class="tag">🎬 ${t.nv}</span>`;
  if(t.emailEnviado) meta += `<span class="tag" title="Email enviado">📧</span>`;
  if(p) meta += `<span class="avatar" style="background:${colorPersona(p)}" title="${esc(nombreP(p))}">${esc(iniciales(p))}</span>`;
  const fondo = fondoTarea(t.color);
  return `<article class="tarjeta ${col.hecha?'hecha':''}" data-id="${t.id}" style="${fondo?'--tc:'+fondo+';':''}--tb:${bordeDe(t)}">
    <button class="t-check" aria-label="Marcar como acabada">${col.hecha?'✓':''}</button>
    <div class="t-tit">${esc(t.titulo || 'Sin título')}</div>
    ${t.notas ? `<div class="t-nota">${esc(t.notas)}</div>` : ''}
    ${meta ? `<div class="t-meta">${meta}</div>` : ''}
    ${subs.length ? `<div class="t-prog"><i style="width:${Math.round(hechos/subs.length*100)}%"></i></div>` : ''}
  </article>`;
}

function pintarTablero(){
  const vis = columnas().filter(c => c.visible);
  const tab = $('#tablero');
  const scroll = tab.scrollLeft;
  if(!vis.length){
    tab.innerHTML = `<div class="col-vacia" style="margin:auto;max-width:300px">Todas las columnas están ocultas.<br>Toca una de las etiquetas de arriba para verla.</div>`;
    return;
  }
  tab.innerHTML = vis.map(c => {
    const ts = tareasDeCol(c.id);
    return `<section class="columna" data-c="${c.id}" style="--cc:${c.color}">
      <div class="col-cab"><span class="bola"></span><h3>${esc(c.nombre)}</h3><span class="n">${ts.length}</span>
        <button class="col-add" data-add="${c.id}" aria-label="Añadir tarea en ${esc(c.nombre)}">＋</button></div>
      <div class="col-lista">${ts.map(htmlTarjeta).join('') || `<div class="col-vacia">${App.q||App.filtro!=='todas' ? 'Nada con este filtro' : 'Sin tareas.<br>Arrastra aquí o pulsa ＋'}</div>`}</div>
    </section>`;
  }).join('');
  tab.scrollLeft = scroll;
}
function pintarTodo(){
  pintarChips(); pintarTablero();
  if($('#vCal').classList.contains('activa')) Cal.pintar();
}

async function contarMedia(){
  const [f, v] = await Promise.all([DB.resumen('fotos'), DB.resumen('videos')]);
  App.tareas.forEach(t => { t.nf = 0; t.nv = 0; });
  const idx = Object.fromEntries(App.tareas.map(t => [t.id, t]));
  f.forEach(x => { if(idx[x.tareaId]) idx[x.tareaId].nf++; });
  v.forEach(x => { if(idx[x.tareaId]) idx[x.tareaId].nv++; });
}
function limpiaTarea(t){ const c = {...t}; delete c.nf; delete c.nv; return c; }
async function guardarTarea(t){ t.actualizada = Date.now(); await DB.poner('tareas', limpiaTarea(t)); }

// Marcar como acabada con el cuadradito de la tarjeta (y deshacer)
async function alternarHecha(id){
  const t = App.tareas.find(x => x.id === id); if(!t) return;
  const col = colDe(t.colId);
  if(col.hecha){ t.colId = (t.colPrev && columnas().some(c=>c.id===t.colPrev && !c.hecha)) ? t.colPrev : columnas()[0].id; delete t.hechaEn; }
  else { t.colPrev = t.colId; t.colId = colHecha().id; t.hechaEn = Date.now(); }
  t.orden = -Date.now();
  await guardarTarea(t); pintarTodo();
  toast(colDe(t.colId).hecha ? '✅ ¡Tarea acabada!' : '↩️ Vuelve a «'+colDe(t.colId).nombre+'»');
}

/* ---------- Arrastrar tarjetas entre columnas ---------- */
function iniciarArrastre(){
  const tab = $('#tablero');
  let st = null, bucle = null;

  const empezar = (x, y) => {
    const card = st.card, r = card.getBoundingClientRect();
    st.activo = true; st.offX = x - r.left; st.offY = y - r.top; st.x = x; st.y = y;
    const g = card.cloneNode(true); g.classList.add('fantasma');
    g.style.width = r.width+'px'; g.style.left = r.left+'px'; g.style.top = r.top+'px';
    document.body.appendChild(g); st.ghost = g;
    st.hueco = document.createElement('div'); st.hueco.className = 'hueco'; st.hueco.style.height = r.height+'px';
    card.parentNode.insertBefore(st.hueco, card);
    card.style.display = 'none';
    tab.style.scrollSnapType = 'none';
    document.body.style.userSelect = 'none';
    if(navigator.vibrate) try{ navigator.vibrate(15); }catch(e){}
    bucle = requestAnimationFrame(autoScroll);
  };
  const autoScroll = () => {
    if(!st || !st.activo) return;
    const m = 50, W = innerWidth;
    if(st.x < m) tab.scrollLeft -= 14; else if(st.x > W - m) tab.scrollLeft += 14;
    const lista = st.lista;
    if(lista){ const r = lista.getBoundingClientRect(); if(st.y < r.top + 40) lista.scrollTop -= 10; else if(st.y > r.bottom - 40) lista.scrollTop += 10; }
    situar();
    bucle = requestAnimationFrame(autoScroll);
  };
  const situar = () => {
    const el = document.elementFromPoint(st.x, st.y);
    const col = el && el.closest('.columna');
    $$('.columna.encima').forEach(c => c !== col && c.classList.remove('encima'));
    if(!col) return;
    col.classList.add('encima');
    const lista = col.querySelector('.col-lista'); st.lista = lista;
    st.hueco.style.setProperty('--cc', col.style.getPropertyValue('--cc'));
    const cards = $$('.tarjeta', lista).filter(c => c.style.display !== 'none');
    let antes = null;
    for(const c of cards){ const r = c.getBoundingClientRect(); if(st.y < r.top + r.height/2){ antes = c; break; } }
    const vacia = lista.querySelector('.col-vacia'); if(vacia) vacia.style.display = 'none';
    if(antes){ if(st.hueco.nextSibling !== antes) lista.insertBefore(st.hueco, antes); }
    else if(st.hueco.parentNode !== lista || st.hueco.nextElementSibling && st.hueco.nextElementSibling.classList.contains('tarjeta')) lista.appendChild(st.hueco);
  };
  const mover = (x, y) => {
    st.x = x; st.y = y;
    st.ghost.style.left = (x - st.offX)+'px'; st.ghost.style.top = (y - st.offY)+'px';
  };
  const soltar = async () => {
    cancelAnimationFrame(bucle);
    const { card, hueco, ghost } = st;
    const lista = hueco.parentNode, col = lista.closest('.columna');
    const id = card.dataset.id, t = App.tareas.find(x => x.id === id);
    ghost.remove(); tab.style.scrollSnapType = ''; document.body.style.userSelect = '';
    $$('.columna.encima').forEach(c => c.classList.remove('encima'));
    if(t && col){
      const antes = t.colId, nueva = col.dataset.c;
      lista.insertBefore(card, hueco); card.style.display = ''; hueco.remove();
      const ids = $$('.tarjeta', lista).map(c => c.dataset.id);
      const cambiadas = [];
      ids.forEach((tid, i) => { const x = App.tareas.find(z => z.id === tid); if(x && (x.orden !== i || x.id === id)){ x.orden = i; cambiadas.push(x); } });
      if(antes !== nueva){
        if(!colDe(antes).hecha) t.colPrev = antes;
        t.colId = nueva;
        if(colDe(nueva).hecha && !colDe(antes).hecha) t.hechaEn = Date.now();
        toast('Movida a «'+colDe(nueva).nombre+'»');
      }
      for(const x of cambiadas) await guardarTarea(x);
    }
    App.ignorarClick = true; setTimeout(() => App.ignorarClick = false, 80);
    st = null; pintarTodo();
  };
  const cancelar = () => {
    if(!st) return; clearTimeout(st.timer);
    if(st.activo){ cancelAnimationFrame(bucle); st.ghost.remove(); st.hueco.remove(); st.card.style.display=''; tab.style.scrollSnapType=''; pintarTodo(); }
    st = null;
  };

  // Ratón (ordenador)
  tab.addEventListener('mousedown', e => {
    if(e.button !== 0) return;
    const c = e.target.closest('.tarjeta'); if(!c || e.target.closest('.t-check')) return;
    st = { card:c, x0:e.clientX, y0:e.clientY };
  });
  addEventListener('mousemove', e => {
    if(!st) return;
    if(!st.activo){ if(Math.hypot(e.clientX-st.x0, e.clientY-st.y0) < 7) return; empezar(st.x0, st.y0); }
    e.preventDefault(); mover(e.clientX, e.clientY);
  });
  addEventListener('mouseup', () => { if(!st) return; if(st.activo) soltar(); else st = null; });

  // Dedo (móvil): mantener pulsado un momento y arrastrar
  tab.addEventListener('touchstart', e => {
    const c = e.target.closest('.tarjeta'); if(!c || e.touches.length > 1 || e.target.closest('.t-check')) return;
    const t = e.touches[0];
    st = { card:c, x0:t.clientX, y0:t.clientY };
    st.timer = setTimeout(() => { if(st && !st.activo){ empezar(st.x0, st.y0); mover(st.x0, st.y0); } }, 380);
  }, { passive:true });
  tab.addEventListener('touchmove', e => {
    if(!st) return;
    const t = e.touches[0];
    if(!st.activo){ if(Math.hypot(t.clientX-st.x0, t.clientY-st.y0) > 8){ clearTimeout(st.timer); st = null; } return; }
    e.preventDefault(); mover(t.clientX, t.clientY);
  }, { passive:false });
  tab.addEventListener('touchend', e => {
    if(!st) return; clearTimeout(st.timer);
    if(st.activo){ e.preventDefault(); soltar(); } else st = null;
  });
  tab.addEventListener('touchcancel', cancelar);
  tab.addEventListener('contextmenu', e => { if(e.target.closest('.tarjeta')) e.preventDefault(); });

  // Clics
  tab.addEventListener('click', e => {
    if(App.ignorarClick) return;
    const chk = e.target.closest('.t-check'); if(chk){ e.stopPropagation(); alternarHecha(chk.closest('.tarjeta').dataset.id); return; }
    const add = e.target.closest('[data-add]'); if(add){ abrirEditor(null, add.dataset.add); return; }
    const c = e.target.closest('.tarjeta'); if(c) abrirEditor(c.dataset.id);
  });
}

/* ---------- Editor de tarea ---------- */
let selColorTarea = null;
function opcionesPersonas(sel){
  return '<option value="">— Nadie —</option>' + App.personas.slice().sort((a,b)=>nombreP(a).localeCompare(nombreP(b))).map(p => `<option value="${p.id}" ${p.id===sel?'selected':''}>${esc(nombreP(p))}${p.email?'':' (sin email)'}</option>`).join('');
}
function tabEditor(t){
  $$('#edTabs button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
  $$('#editor .tab-pan').forEach(p => p.classList.toggle('on', p.dataset.p === t));
  $('#editor .hoja-scroll').scrollTop = 0;
  if(t === 'fotos') pintarFotos();
  if(t === 'videos') pintarVideos();
}

async function abrirEditor(id, colId){
  let t;
  if(id){ t = structuredClone(limpiaTarea(App.tareas.find(x => x.id === id))); App.ed = { t, nueva:false, mediaNueva:false }; }
  else {
    const primera = (colId && colDe(colId)) || columnas().find(c => c.visible && !c.hecha) || columnas()[0];
    t = { id:nuevoId('t'), titulo:'', notas:'', colId:primera.id, color:'', prio:0, ini:'', fin:'', personaId:'', email:false, subs:[], creada:Date.now(), orden:-Date.now() };
    App.ed = { t, nueva:true, mediaNueva:false };
  }
  $('#edCab').textContent = App.ed.nueva ? 'Nueva tarea' : 'Editar tarea';
  $('#edTitulo').value = t.titulo; $('#edNotas').value = t.notas;
  $('#edCol').innerHTML = columnas().map(c => `<option value="${c.id}" ${c.id===t.colId?'selected':''}>${esc(c.nombre)}${c.visible?'':' (oculta)'}</option>`).join('');
  selColorTarea = selColor($('#edColor'), t.color, PALETA_TAREA, v => { App.ed.t.color = v; });
  $$('#edPrio button').forEach(b => b.classList.toggle('on', +b.dataset.p === (t.prio||0)));
  $('#edIni').value = t.ini || ''; $('#edFin').value = t.fin || '';
  $('#edPersona').innerHTML = opcionesPersonas(t.personaId);
  $('#edEmail').checked = false;
  pintarSubs(); pintarDur(); pintarEmail(); pintarPunto();
  const m = [];
  if(!App.ed.nueva){
    m.push('Creada: '+new Date(t.creada).toLocaleString('es-ES',{dateStyle:'medium',timeStyle:'short'}));
    if(t.actualizada) m.push('Cambiada: '+new Date(t.actualizada).toLocaleString('es-ES',{dateStyle:'medium',timeStyle:'short'}));
    if(t.emailEnviado) m.push('📧 Email enviado: '+new Date(t.emailEnviado).toLocaleString('es-ES',{dateStyle:'medium',timeStyle:'short'}));
  }
  $('#edMeta').innerHTML = m.join('<br>');
  $('#edBorrar').style.display = $('#edDup').style.display = App.ed.nueva ? 'none' : '';
  await contarEditor();
  tabEditor('tarea');
  abrir('editor');
  if(App.ed.nueva) setTimeout(() => $('#edTitulo').focus(), 300);
}
function pintarPunto(){ $('#edPunto').style.background = colDe($('#edCol').value).color; }
function pintarDur(){
  const a = $('#edIni').value, b = $('#edFin').value, el = $('#edDur');
  if(a && b){
    const n = difDias(a, b);
    el.textContent = n < 0 ? '⚠️ La fecha fin es anterior al inicio (se cambiarán de orden al guardar)' : '⏱ Ocupa '+(n+1)+' día'+(n?'s':'') + (n>=7 ? ' ('+Math.floor((n+1)/7)+' sem.)' : '');
  } else el.textContent = a ? 'Solo inicio: se verá en el calendario ese día' : b ? 'Solo fecha fin: se verá en el calendario ese día' : '';
}
function pintarEmail(){
  const p = persona($('#edPersona').value);
  const fila = $('#edEmailFila');
  fila.classList.toggle('desactivado', !(p && p.email));
  if(!(p && p.email)) $('#edEmail').checked = false;
  $('#edEmailInfo').textContent = p ? (p.email ? 'Se abrirá tu correo con todo listo para '+p.email : 'Esta persona no tiene email') : 'Elige antes a quién se asigna';
}
function pintarSubs(){
  const subs = App.ed.t.subs || [];
  const ok = subs.filter(s => s.ok).length;
  $('#edSubInfo').textContent = subs.length ? ok+' de '+subs.length+' hechos' : '(opcional) divide la tarea en pasos';
  $('#edProg').style.width = subs.length ? Math.round(ok/subs.length*100)+'%' : '0';
  $('#edProg').parentNode.style.display = subs.length ? '' : 'none';
  $('#edSubs').innerHTML = subs.map((s,i) => `<li class="${s.ok?'ok':''}" data-i="${i}"><button class="sc">${s.ok?'✓':''}</button><span>${esc(s.t)}</span><button class="sx" aria-label="Quitar">✕</button></li>`).join('');
}
function añadirSub(){
  const v = $('#edSubNuevo').value.trim(); if(!v) return;
  (App.ed.t.subs = App.ed.t.subs || []).push({ t:v, ok:false });
  $('#edSubNuevo').value = ''; pintarSubs(); $('#edSubNuevo').focus();
}
async function contarEditor(){
  const id = App.ed.t.id;
  const [f, v] = await Promise.all([DB.deTarea('fotos', id), DB.deTarea('videos', id)]);
  $('#nFotos').textContent = f.length || ''; $('#nVideos').textContent = v.length || '';
  return { f, v };
}

/* Fotos y vídeos en el editor */
const _urls = [];
function urlDe(blob){ const u = URL.createObjectURL(blob); _urls.push(u); return u; }
function soltarUrls(){ while(_urls.length) URL.revokeObjectURL(_urls.pop()); }
async function pintarFotos(){
  const l = (await DB.deTarea('fotos', App.ed.t.id)).sort((a,b) => a.fecha-b.fecha);
  $('#nFotos').textContent = l.length || '';
  const tot = l.reduce((s,x) => s+x.size, 0), ori = l.reduce((s,x) => s+(x.original||x.size), 0);
  $('#fotosInfo').textContent = l.length ? `${l.length} foto${l.length>1?'s':''} · ocupan ${tamTxt(tot)}${ori>tot ? ' (sin aligerar serían '+tamTxt(ori)+')' : ''}` : 'Las fotos se aligeran solas antes de guardarse.';
  $('#galFotos').innerHTML = l.length ? l.map(f => `<div class="mini" data-id="${f.id}"><img src="${(f.mini||f.blob) ? urlDe(f.mini||f.blob) : esc(f.urlMini||f.url)}" alt="" loading="lazy"><span class="pes">${tamTxt(f.size)}</span></div>`).join('') : '<div class="vacio">📷 Todavía no hay fotos en esta tarea</div>';
  $$('#galFotos .mini').forEach(m => m.onclick = () => verMedia('fotos', m.dataset.id));
}
async function pintarVideos(){
  const l = (await DB.deTarea('videos', App.ed.t.id)).sort((a,b) => a.fecha-b.fecha);
  $('#nVideos').textContent = l.length || '';
  const tot = l.reduce((s,x) => s+x.size, 0), ori = l.reduce((s,x) => s+(x.original||x.size), 0);
  $('#videosInfo').textContent = l.length ? `${l.length} vídeo${l.length>1?'s':''} · ocupan ${tamTxt(tot)}${ori>tot ? ' (sin aligerar serían '+tamTxt(ori)+')' : ''}` : 'Los vídeos se aligeran (tamaño y calidad) antes de guardarse. Tarda lo mismo que dura el vídeo.';
  $('#galVideos').innerHTML = l.length ? l.map(v => `<div class="mini" data-id="${v.id}">${v.poster ? `<img src="${urlDe(v.poster)}" alt="">` : v.urlPoster ? `<img src="${esc(v.urlPoster)}" alt="" loading="lazy">` : ''}<span class="play">▶</span><span class="pes">${durTxt(v.dur)} · ${tamTxt(v.size)}</span></div>`).join('') : '<div class="vacio">🎬 Todavía no hay vídeos en esta tarea</div>';
  $$('#galVideos .mini').forEach(m => m.onclick = () => verMedia('videos', m.dataset.id));
}
let _visor = null;
async function verMedia(tipo, id){
  const o = await DB.uno(tipo, id); if(!o) return;
  _visor = { tipo, id };
  const u = o.blob ? urlDe(o.blob) : o.url;
  if(!u){ toast('⏳ Aún se está subiendo, prueba en un momento'); return; }
  $('#visorCont').innerHTML = tipo === 'fotos' ? `<img src="${u}" alt="">` : `<video src="${u}" controls playsinline autoplay></video>`;
  $('#visorInfo').textContent = (o.w && o.h ? o.w+'×'+o.h+' · ' : '') + tamTxt(o.size) + (o.dur ? ' · '+durTxt(o.dur) : '');
  $('#visor').classList.add('abierto');
}
function cerrarVisor(){ const v = $('#visorCont video'); if(v) v.pause(); $('#visorCont').innerHTML = ''; $('#visor').classList.remove('abierto'); _visor = null; }

async function subirFotos(files){
  if(!files.length) return;
  App.ed.mediaNueva = true;
  $('#fotosInfo').textContent = 'Aligerando fotos…';
  const r = await guardarFotos(Array.from(files), App.ed.t.id, App.ajustes.calidadFoto, (i,n) => $('#fotosInfo').textContent = `Aligerando foto ${i} de ${n}…`);
  await pintarFotos();
  if(r.n) toast(`📷 ${r.n} foto${r.n>1?'s':''}: de ${tamTxt(r.antes)} a ${tamTxt(r.despues)}`);
}
async function subirVideo(file){
  if(!file) return;
  App.ed.mediaNueva = true;
  const caja = $('#vidProg'); caja.hidden = false;
  $('#vidProgTxt').textContent = `Aligerando vídeo (${tamTxt(file.size)})… no cierres la app`;
  $('#vidProgBar').style.width = '0';
  try{
    const r = await guardarVideo(file, App.ed.t.id, App.ajustes.calidadVideo, p => { $('#vidProgBar').style.width = Math.round(p*100)+'%'; });
    toast(r.aligerado ? `🎬 Vídeo: de ${tamTxt(r.original)} a ${tamTxt(r.size)}` : '🎬 Vídeo guardado (ya era ligero)');
  }catch(e){
    if(e.message !== 'cancelado'){
      console.warn(e);
      const si = await popConfirmar('No se pudo aligerar', 'Este navegador no ha podido aligerar el vídeo. ¿Lo guardo tal cual ('+tamTxt(file.size)+')?', 'Guardar tal cual');
      if(si){ await DB.poner('videos', { id:nuevoId('v'), tareaId:App.ed.t.id, blob:file, poster:null, size:file.size, original:file.size, tipo:file.type, nombre:file.name, fecha:Date.now() }); }
    } else toast('Vídeo cancelado');
  }
  caja.hidden = true;
  await pintarVideos();
}

function leerEditor(){
  const t = App.ed.t;
  t.titulo = $('#edTitulo').value.trim();
  t.notas = $('#edNotas').value.trim();
  if(!t.titulo && t.notas) t.titulo = t.notas.split('\n')[0].slice(0, 80);
  t.colId = $('#edCol').value;
  t.color = selColorTarea.valor;
  t.prio = +($('#edPrio .on')?.dataset.p || 0);
  t.ini = $('#edIni').value; t.fin = $('#edFin').value;
  if(t.ini && t.fin && t.fin < t.ini){ const x = t.ini; t.ini = t.fin; t.fin = x; }
  t.personaId = $('#edPersona').value;
  return t;
}

async function guardarEditor(){
  const t = leerEditor();
  if(!t.titulo){ $('#edTitulo').focus(); toast('✏️ Escribe qué hay que hacer'); return; }
  const previa = App.tareas.find(x => x.id === t.id);
  if(previa && previa.colId !== t.colId){
    if(!colDe(previa.colId).hecha) t.colPrev = previa.colId;
    if(colDe(t.colId).hecha && !colDe(previa.colId).hecha) t.hechaEn = Date.now();
    t.orden = -Date.now();
  }
  const enviar = $('#edEmail').checked;
  if(enviar) t.emailEnviado = Date.now();
  await guardarTarea(t);
  const i = App.tareas.findIndex(x => x.id === t.id);
  if(i >= 0) App.tareas[i] = t; else App.tareas.push(t);
  Voz.parar(); cerrar('editor'); soltarUrls();
  await contarMedia(); pintarTodo();
  toast(App.ed.nueva ? '✨ Tarea creada' : '💾 Guardada');
  if(enviar) enviarEmail(t);
  App.ed = null;
}
async function cancelarEditor(){
  Voz.parar();
  if(App.ed && App.ed.nueva && App.ed.mediaNueva){
    await DB.borrarDeTarea('fotos', App.ed.t.id); await DB.borrarDeTarea('videos', App.ed.t.id);
  }
  cerrar('editor'); soltarUrls(); App.ed = null;
  await contarMedia(); pintarTodo();
}

/* Borrar con «Deshacer» */
async function borrarTarea(id){
  const t = App.tareas.find(x => x.id === id); if(!t) return;
  const ok = await popConfirmar('¿Borrar la tarea?', '«'+(t.titulo||'Sin título')+'» se borrará'+(t.nf||t.nv ? ' con sus fotos y vídeos' : '')+'. Tendrás unos segundos para deshacerlo.', 'Borrar');
  if(!ok) return;
  App.tareas = App.tareas.filter(x => x.id !== id);
  await DB.borrar('tareas', id);
  cerrar('editor'); soltarUrls(); App.ed = null; pintarTodo();
  let deshecho = false;
  const tm = setTimeout(async () => { if(!deshecho){ await DB.borrarDeTarea('fotos', id); await DB.borrarDeTarea('videos', id); } }, 7000);
  toast('🗑 Tarea borrada', 'Deshacer', async () => {
    deshecho = true; clearTimeout(tm);
    App.tareas.push(t); await DB.poner('tareas', limpiaTarea(t)); pintarTodo(); toast('↩️ Recuperada');
  }, 7000);
}
async function duplicarTarea(){
  const o = leerEditor();
  const c = structuredClone(limpiaTarea(o));
  c.id = nuevoId('t'); c.titulo = o.titulo + ' (copia)'; c.creada = Date.now(); c.orden = -Date.now(); delete c.emailEnviado;
  for(const tipo of ['fotos','videos']){
    const l = await DB.deTarea(tipo, o.id);
    if(l.length) await DB.ponerVarios(tipo, l.map(x => ({...x, id:nuevoId(tipo[0]), tareaId:c.id})));
  }
  await guardarTarea(c); App.tareas.push(c);
  cerrar('editor'); soltarUrls(); App.ed = null;
  await contarMedia(); pintarTodo();
  toast('⧉ Duplicada', 'Abrir', () => abrirEditor(c.id));
}

/* Email (se abre tu app de correo con todo rellenado) */
function enviarEmail(t){
  const p = persona(t.personaId); if(!p || !p.email) return;
  const r = rango(t);
  const lin = [];
  lin.push('Hola ' + p.nombre + ',', '', 'Te he asignado esta tarea:', '', '• ' + t.titulo);
  lin.push('• Estado: ' + colDe(t.colId).nombre);
  if(r) lin.push('• Fechas: ' + (r[0]===r[1] ? fLarga(r[0]) : 'del ' + fLarga(r[0]) + ' al ' + fLarga(r[1])));
  if(t.prio) lin.push('• Prioridad: ' + ['','baja','media','alta'][t.prio]);
  if(t.notas) lin.push('', 'Notas:', t.notas);
  if(t.subs && t.subs.length) lin.push('', 'Pasos:', ...t.subs.map(s => (s.ok?'[x] ':'[ ] ') + s.t));
  if(typeof APP_URL !== 'undefined' && Nube.activa) lin.push('', 'La puedes ver (con sus fotos y vídeos) en PorHacer:', APP_URL, 'Entra con este email: ' + p.email);
  lin.push('', 'Gracias.' + (App.ajustes.firma ? '\n' + App.ajustes.firma : ''));
  const asunto = 'Tarea: ' + t.titulo;
  let cuerpo = lin.join('\n'); if(cuerpo.length > 1800) cuerpo = cuerpo.slice(0, 1790) + '…';
  location.href = 'mailto:' + encodeURIComponent(p.email) + '?subject=' + encodeURIComponent(asunto) + '&body=' + encodeURIComponent(cuerpo);
}

/* Añadir al calendario del móvil (.ics) */
function descargar(blob, nombre){
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nombre;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}
function exportarIcs(){
  const t = leerEditor(), r = rango(t);
  if(!r){ toast('📅 Pon antes una fecha'); return; }
  const f = s => s.replace(/-/g,'');
  const e = s => String(s||'').replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/[,;]/g, m => '\\'+m);
  const ics = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//PorHacer//ES','CALSCALE:GREGORIAN','BEGIN:VEVENT',
    'UID:'+t.id+'@porhacer','DTSTAMP:'+new Date().toISOString().replace(/[-:]/g,'').split('.')[0]+'Z',
    'DTSTART;VALUE=DATE:'+f(r[0]),'DTEND;VALUE=DATE:'+f(sumaDias(r[1],1)),
    'SUMMARY:'+e(t.titulo),'DESCRIPTION:'+e(t.notas),'END:VEVENT','END:VCALENDAR'].join('\r\n');
  descargar(new Blob([ics], { type:'text/calendar' }), (t.titulo||'tarea').replace(/[^\w\- áéíóúñç]/gi,'').slice(0,40)+'.ics');
}

/* Persona rápida desde el editor */
async function formPersona(p){
  const v = await popup({ tit: p ? 'Editar persona' : 'Nueva persona',
    html:`<input id="pNom" placeholder="Nombre" value="${esc(p?.nombre||'')}"><input id="pApe" placeholder="Apellidos" value="${esc(p?.apellidos||'')}"><input id="pMail" type="email" inputmode="email" placeholder="Email" value="${esc(p?.email||'')}">`,
    botones:[{txt:'Cancelar', val:null}, {txt:'Guardar', cls:'btn-pri',
      validar: c => { if(!$('#pNom',c).value.trim()){ $('#pNom',c).focus(); return false; } const m = $('#pMail',c).value.trim(); if(m && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m)){ $('#pMail',c).focus(); toast('✉️ Ese email no parece correcto'); return false; } return true; },
      val: c => ({ nombre:$('#pNom',c).value.trim(), apellidos:$('#pApe',c).value.trim(), email:$('#pMail',c).value.trim() }) }],
    alAbrir: c => setTimeout(() => $('#pNom',c).focus(), 200) });
  if(!v) return null;
  const obj = p ? Object.assign(p, v) : { id:nuevoId('p'), ...v, creada:Date.now() };
  await DB.poner('personas', obj);
  if(!p) App.personas.push(obj);
  return obj;
}

/* ---------- Arranque ---------- */
function fechaCabecera(){ const d = new Date(); const tx = DIAS[d.getDay()]+', '+d.getDate()+' de '+MESES[d.getMonth()]; $('#hoyTxt').textContent = tx.charAt(0).toUpperCase()+tx.slice(1); }
function eventos(){
  $('#btnCal').innerHTML = icono('calendario');
  $('#btnAjustes').innerHTML = icono('ajustes');
  $('#btnAjustes2').innerHTML = icono('ajustes');
  $('#btnVolver').innerHTML = icono('tablero');
  $('#icoBuscar').innerHTML = icono('buscar');
  $('#icoAjCab').innerHTML = icono('ajustes');
  $$('.mic').forEach(m => m.innerHTML = icono('mic'));
  $('#verTxt').textContent = VERSION;

  $('#fab').onclick = () => abrirEditor(null);
  $('#btnCal').onclick = () => Cal.abrir();
  $('#btnVolver').onclick = () => Cal.cerrar();
  $('#btnAjustes').onclick = $('#btnAjustes2').onclick = () => Ajustes.abrir();
  $('#btnFiltro').onclick = elegirFiltro;
  const q = $('#q');
  q.oninput = () => { App.q = q.value.trim(); $('.buscar').classList.toggle('con', !!q.value); pintarTodo(); };
  q.onkeydown = e => { if(e.key === 'Enter') q.blur(); };
  $('#qx').onclick = () => { q.value = ''; q.oninput(); };

  $$('[data-cerrar]').forEach(b => b.onclick = () => b.dataset.cerrar === 'editor' ? cancelarEditor() : (cerrar(b.dataset.cerrar), b.dataset.cerrar==='ajustes' && pintarTodo()));
  $$('.velo').forEach(v => v.addEventListener('click', e => { if(e.target === v && v.id !== 'editor' && v.id !== 'nube'){ v.id==='popup' ? null : cerrar(v.id); } }));

  // Editor
  $$('#edTabs button').forEach(b => b.onclick = () => tabEditor(b.dataset.t));
  $$('#edPrio button').forEach(b => b.onclick = () => { $$('#edPrio button').forEach(x => x.classList.remove('on')); b.classList.add('on'); });
  $('#edCol').onchange = pintarPunto;
  $('#edIni').onchange = $('#edFin').onchange = pintarDur;
  $('#edIni').addEventListener('change', () => { if($('#edIni').value && !$('#edFin').value) {} });
  $('#edPersona').onchange = pintarEmail;
  $('#edNuevaPersona').onclick = async () => { const p = await formPersona(); if(p){ $('#edPersona').innerHTML = opcionesPersonas(p.id); pintarEmail(); if(p.email) $('#edEmail').checked = true; } };
  $('#edSubAdd').onclick = añadirSub;
  $('#edSubNuevo').onkeydown = e => { if(e.key === 'Enter'){ e.preventDefault(); añadirSub(); } };
  $('#edSubs').onclick = e => {
    const li = e.target.closest('li'); if(!li) return; const i = +li.dataset.i, s = App.ed.t.subs;
    if(e.target.closest('.sx')) s.splice(i, 1); else if(e.target.closest('.sc')) s[i].ok = !s[i].ok; else return;
    pintarSubs();
  };
  $('#edGuardar').onclick = guardarEditor;
  $('#edBorrar').onclick = () => borrarTarea(App.ed.t.id);
  $('#edDup').onclick = duplicarTarea;
  $('#edIcs').onclick = exportarIcs;
  $('#edTitulo').onkeydown = e => { if(e.key === 'Enter'){ e.preventDefault(); $('#edNotas').focus(); } };
  $$('.mic').forEach(m => m.onclick = () => Voz.empezar($('#'+m.dataset.mic), m, $('#vozEstado')));

  $('#inCam').onchange = e => { subirFotos(e.target.files); e.target.value = ''; };
  $('#inFotos').onchange = e => { subirFotos(e.target.files); e.target.value = ''; };
  $('#inGrabar').onchange = e => { subirVideo(e.target.files[0]); e.target.value = ''; };
  $('#inVideos').onchange = e => { subirVideo(e.target.files[0]); e.target.value = ''; };
  $('#vidCancelar').onclick = cancelarVideo;

  $('#visorX').onclick = cerrarVisor;
  $('#visorBorrar').onclick = async () => {
    if(!_visor) return; const { tipo, id } = _visor;
    if(!await popConfirmar(tipo==='fotos' ? '¿Borrar la foto?' : '¿Borrar el vídeo?', 'No se podrá recuperar.', 'Borrar')) return;
    await DB.borrar(tipo, id); cerrarVisor();
    tipo === 'fotos' ? pintarFotos() : pintarVideos();
    contarMedia().then(pintarTodo);
  };
  addEventListener('keydown', e => {
    if(e.key !== 'Escape') return;
    if($('#visor').classList.contains('abierto')) cerrarVisor();
    else if($('#popup').classList.contains('abierto')) cerrar('popup');
    else if($('#editor').classList.contains('abierto')) cancelarEditor();
    else if($('#ajustes').classList.contains('abierto')){ cerrar('ajustes'); pintarTodo(); }
  });
  // Evitar el zoom con doble toque en iPhone
  let ult = 0; document.addEventListener('touchend', e => { const n = Date.now(); if(n - ult < 300 && !e.target.closest('input,textarea,select')) e.preventDefault(); ult = n; }, { passive:false });
  document.addEventListener('visibilitychange', () => { if(!document.hidden){ fechaCabecera(); pintarTodo(); } });
}

async function iniciar(){
  try{
    App.ajustes = await DB.uno('ajustes', 'ajustes');
    if(!App.ajustes){ App.ajustes = ajustesInicio(); await guardarAjustes(); }
    App.ajustes = Object.assign(ajustesInicio(), App.ajustes);
    aplicarTema(App.ajustes.colores);
    [App.tareas, App.personas] = await Promise.all([DB.todos('tareas'), DB.todos('personas')]);
    await contarMedia();
  }catch(e){
    console.error(e);
    App.ajustes = App.ajustes || ajustesInicio(); aplicarTema(App.ajustes.colores);
    setTimeout(() => popAviso('Atención', 'No se pudo abrir el almacén de datos del navegador. Si estás en modo privado, abre la app en una ventana normal.'), 900);
  }
  eventos(); iniciarArrastre(); fechaCabecera();
  Cal.iniciar();
  pintarTodo();
  setTimeout(() => $('#splash').classList.add('fuera'), 900);
  setTimeout(() => document.body.classList.add('ya'), 1800);
  pedirPersistencia();
  Nube.iniciar();
  $('#nubeEstado').onclick = () => { if(Nube.user && Nube.user.emailVerified && !Nube.activa) Nube.buscarTablero(); else if(!Nube.user){ try{ sessionStorage.removeItem('ph-sin-nube'); }catch(e){} Nube.pantallaEntrar(); } else { Ajustes.abrir(); Ajustes.tab('nube'); } };
  if('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(()=>{});
}
document.addEventListener('DOMContentLoaded', iniciar);
