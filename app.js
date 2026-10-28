/* PorHacer · app principal: tablero de columnas, tareas y editor */

const VERSION = 'V4.15';
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
    calModo:'mes', firma:'',
    fiesta:{ activa:true, segundos:5, musica:true, mensaje:'', email:'preguntar' }
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
/* Con el ratón: arrastrar para mover las barras de pestañas y la rueda para ir de lado */
(function(){
  const SEL = '.tabs-scroll, .chips, .tabs';
  let D = null;
  document.addEventListener('pointerdown', e => {
    if(e.pointerType !== 'mouse' || e.button !== 0) return;
    const el = e.target.closest(SEL); if(!el || el.scrollWidth <= el.clientWidth + 2) return;
    D = { el, x:e.clientX, sl:el.scrollLeft, movido:false };
  });
  document.addEventListener('pointermove', e => {
    if(!D) return; const dx = e.clientX - D.x;
    if(!D.movido && Math.abs(dx) < 6) return;
    D.movido = true; D.el.classList.add('arrastrando'); D.el.scrollLeft = D.sl - dx;
  });
  const fin = () => { if(!D) return; const d = D; D = null; d.el.classList.remove('arrastrando'); if(d.movido){ const parar = ev => { ev.stopPropagation(); ev.preventDefault(); }; addEventListener('click', parar, { capture:true, once:true }); setTimeout(() => removeEventListener('click', parar, { capture:true }), 50); } };
  document.addEventListener('pointerup', fin); document.addEventListener('pointercancel', fin);
  document.addEventListener('wheel', e => {
    const el = e.target.closest(SEL); if(!el || el.scrollWidth <= el.clientWidth + 2 || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    el.scrollLeft += e.deltaY; e.preventDefault();
  }, { passive:false });
})();
function popup({ tit, html, botones, alAbrir }){
  return new Promise(ok => {
    $('#popTit').textContent = tit || ''; $('#popTit').hidden = !tit;
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
  const av = Avisos.proximo(t); if(av && !col.hecha) meta += `<span class="tag aviso" title="Aviso con sonido">🔔 ${Avisos.txt(av.f)}</span>`;
  if(subs.length) meta += `<span class="tag">☑️ ${hechos}/${subs.length}</span>`;
  if(t.nf) meta += `<span class="tag">📷 ${t.nf}</span>`;
  if(t.nv) meta += `<span class="tag">🎬 ${t.nv}</span>`;
  if(t.na) meta += `<span class="tag">🎙️ ${t.na}</span>`;
  if(t.emailEnviado || t.recordado) meta += `<span class="tag" title="Se le ha enviado por email">📧${t.recordado ? ' 🔔' : ''}</span>`;
  const comp = compartidaCon(t);
  if(p || comp.length > 1) meta += `<button class="avatares" data-gente="${t.id}" title="Con quién se comparte">${p ? `<span class="avatar" style="background:${colorPersona(p)}">${esc(iniciales(p))}</span>` : ''}${comp.length > 1 ? `<span class="avatar mas">+${comp.length - (p ? 1 : 0)}</span>` : ''}</button>`;
  const fondo = fondoTarea(t.color);
  return `<article class="tarjeta ${col.hecha?'hecha':''}" data-id="${t.id}" style="${fondo?'--tc:'+fondo+';':''}--tb:${bordeDe(t)}">
    <button class="t-check" aria-label="Marcar como acabada">${col.hecha?'✓':''}</button>
    <div class="t-tit">${esc(t.titulo || 'Sin título')}</div>
    ${t.notas ? `<div class="t-nota">${notaHtml(t)}</div>` : ''}
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
  const [f, v, a] = await Promise.all(['fotos','videos','audios'].map(x => DB.resumen(x).catch(() => [])));
  App.tareas.forEach(t => { t.nf = 0; t.nv = 0; t.na = 0; });
  const idx = Object.fromEntries(App.tareas.map(t => [t.id, t]));
  f.forEach(x => { if(idx[x.tareaId]) idx[x.tareaId].nf++; });
  v.forEach(x => { if(idx[x.tareaId]) idx[x.tareaId].nv++; });
  a.forEach(x => { if(idx[x.tareaId]) idx[x.tareaId].na++; });
}
function limpiaTarea(t){ const c = {...t}; delete c.nf; delete c.nv; delete c.na; return c; }
/* ---------- Notas con negrita e iconos ---------- */
const ICONOS_NOTA = ['✅','❤️','❌','❗️','❓','🔴','🟢','🔵','🟡','🟠'];
// Del cuadro de notas saca: el texto normal (para buscar, emails…) y un HTML limpio que solo tiene <b>
function ricoLimpio(raiz){
  let html = '', txt = '';
  const bloque = n => /^(DIV|P|LI|UL|OL|H[1-6])$/.test(n.nodeName);
  const salto = () => { if(txt && !txt.endsWith('\n')){ html += '\n'; txt += '\n'; } };
  const walk = (n, neg) => {
    for(const c of n.childNodes){
      if(c.nodeType === 3){ const v = c.data.replace(/\u00a0/g, ' '); if(!v) continue; html += neg ? '<b>' + esc(v) + '</b>' : esc(v); txt += v; }
      else if(c.nodeType === 1){
        if(c.nodeName === 'BR'){ html += '\n'; txt += '\n'; continue; }
        const fw = (c.style && c.style.fontWeight) || '';
        const b = neg || /^(B|STRONG)$/.test(c.nodeName) || fw === 'bold' || +fw >= 600;
        if(bloque(c)) salto(); walk(c, b); if(bloque(c)) salto();
      }
    }
  };
  walk(raiz, false);
  html = html.replace(/<\/b><b>/g, '').replace(/\s+$/, ''); txt = txt.replace(/\s+$/, '');
  return { html, txt };
}
function ricoDesde(guardado){ const d = new DOMParser().parseFromString('<div>' + guardado + '</div>', 'text/html'); return ricoLimpio(d.body.firstChild); }
function notaHtml(t){ return t.notasHtml ? ricoDesde(t.notasHtml).html : esc(t.notas || ''); }
let _rangoNota = null;
function iniciarNotasRicas(){
  const el = $('#edNotas'), barra = $('#edNotasBarra');
  barra.innerHTML = '<button type="button" data-n="b" title="Negrita"><b>B</b></button><span class="bloc-sep"></span>' + ICONOS_NOTA.map(i => `<button type="button" data-i="${i}">${i}</button>`).join('');
  document.addEventListener('selectionchange', () => { const s = getSelection(); if(s.rangeCount && el.contains(s.anchorNode)){ _rangoNota = s.getRangeAt(0).cloneRange(); try{ $('[data-n=b]', barra).classList.toggle('on', document.queryCommandState('bold')); }catch(e){} } });
  ['mousedown', 'pointerdown'].forEach(ev => barra.addEventListener(ev, e => { if(e.target.closest('button')) e.preventDefault(); }));
  barra.addEventListener('click', e => {
    const b = e.target.closest('button'); if(!b) return;
    el.focus();
    const s = getSelection();
    if(_rangoNota && el.contains(_rangoNota.startContainer)){ s.removeAllRanges(); s.addRange(_rangoNota); }
    else { const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); s.removeAllRanges(); s.addRange(r); }
    try{ document.execCommand('styleWithCSS', false, false); }catch(_){}
    if(b.dataset.n === 'b') document.execCommand('bold');
    else if(b.dataset.i) document.execCommand('insertText', false, b.dataset.i);
    try{ $('[data-n=b]', barra).classList.toggle('on', document.queryCommandState('bold')); }catch(_){}
  });
  // pegar: solo texto
  el.addEventListener('paste', e => { e.preventDefault(); document.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text/plain')); });
}
/* ---------- Historial: todo lo que le pasa a una tarea ---------- */
function quienSoy(){ return (typeof Nube !== 'undefined' && Nube.user) ? Nube.nombreYo() : ''; }
function anotar(t, x){ if(!t || !x) return; t.hist = (Array.isArray(t.hist) ? t.hist : []).concat({ f:Date.now(), q:quienSoy(), x }).slice(-300); }
const fechaCorta = v => v ? new Date(v + 'T12:00').toLocaleDateString('es-ES', { day:'numeric', month:'short', year:'numeric' }) : 'sin fecha';
function cambiosTarea(a, b){
  const c = [], nomCol = id => colDe(id).nombre, nomP = id => { const p = persona(id); return p ? nombreP(p) : 'nadie'; };
  const corta = x => { x = (x || '').trim(); return x.length > 40 ? x.slice(0, 40) + '…' : x; };
  if((a.titulo||'') !== (b.titulo||'')) c.push('✏️ Título: «' + corta(a.titulo) + '» → «' + corta(b.titulo) + '»');
  if((a.notas||'') !== (b.notas||'') || (a.notasHtml||'') !== (b.notasHtml||'')) c.push('📝 Notas cambiadas');
  if(a.colId !== b.colId) c.push((colDe(b.colId).hecha ? '✅ ' : '➡️ ') + 'De «' + nomCol(a.colId) + '» a «' + nomCol(b.colId) + '»');
  if((a.ini||'') !== (b.ini||'')) c.push('📅 Inicio: ' + fechaCorta(a.ini) + ' → ' + fechaCorta(b.ini));
  if((a.fin||'') !== (b.fin||'')) c.push('🏁 Fin: ' + fechaCorta(a.fin) + ' → ' + fechaCorta(b.fin));
  if((a.personaId||'') !== (b.personaId||'')) c.push('👤 ' + (b.personaId ? 'Asignada a ' + nomP(b.personaId) : 'Ya no está asignada') + (a.personaId ? ' (antes: ' + nomP(a.personaId) + ')' : ''));
  if((a.prio||0) !== (b.prio||0)) c.push('⚑ Prioridad: ' + ['sin','baja','media','alta'][a.prio||0] + ' → ' + ['sin','baja','media','alta'][b.prio||0]);
  if((a.color||'') !== (b.color||'')) c.push('🎨 Color cambiado');
  c.push(...Avisos.cambios(a, b));
  const sa = a.subs || [], sb = b.subs || [], txt = l => l.map(x => x.t);
  sb.filter(x => !txt(sa).includes(x.t)).forEach(x => c.push('➕ Paso nuevo: «' + corta(x.t) + '»'));
  sa.filter(x => !txt(sb).includes(x.t)).forEach(x => c.push('➖ Paso quitado: «' + corta(x.t) + '»'));
  sb.forEach(x => { const y = sa.find(z => z.t === x.t); if(y && !!y.ok !== !!x.ok) c.push((x.ok ? '☑️ Paso hecho: «' : '⬜ Paso por hacer otra vez: «') + corta(x.t) + '»'); });
  return c;
}
// Lo que se apunta mientras la tarea está abierta (fotos, audios, recordatorios…)
function apuntar(x){ if(App.ed) (App.ed.pend = App.ed.pend || []).push(x); }
function lineaHist(h){
  const d = new Date(h.f);
  return `<li><time>${d.toLocaleDateString('es-ES',{day:'numeric',month:'short',year:'numeric'})} · ${d.toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})}</time><span>${esc(h.x)}</span>${h.q ? `<small>${esc(h.q)}</small>` : ''}</li>`;
}
// Historial completo (las tareas antiguas, sin historial, muestran lo que se sabe)
function historialDe(t){
  const l = Array.isArray(t.hist) ? t.hist.slice() : [];
  if(!l.some(h => /^✨/.test(h.x)) && t.creada) l.unshift({ f:t.creada, x:'✨ Creada', q:'' });
  if(!l.length || l.length === 1){
    if(t.emailEnviado && !l.some(h => /^📧/.test(h.x))) l.push({ f:t.emailEnviado, x:'📧 Email enviado', q:'' });
    if(t.recordado && !l.some(h => /^🔔/.test(h.x))) l.push({ f:t.recordado, x:'🔔 Recordatorio enviado', q:'' });
    if(t.actualizada && t.actualizada - (t.creada||0) > 60000) l.push({ f:t.actualizada, x:'💾 Cambiada', q:'' });
  }
  return l.sort((a, b) => a.f - b.f);
}
function pintarHistorial(){
  const caja = $('#edMeta');
  if(!App.ed || App.ed.nueva){ caja.innerHTML = ''; caja.hidden = true; return; }
  const l = historialDe(App.ed.t).concat((App.ed.pend || []).map(x => ({ f:Date.now(), x, q:quienSoy(), nuevo:true })));
  caja.hidden = false;
  const ult = l.slice(-3).reverse();
  caja.innerHTML = `<div class="hist-cab"><b>📜 Historial</b><small>${l.length} ${l.length === 1 ? 'movimiento' : 'movimientos'}</small></div>
    <ul class="hist-lista">${ult.map(lineaHist).join('')}</ul>
    <button class="mini-btn hist-ver" id="edHistVer">📜 Ver todo el historial</button>`;
  $('#edHistVer').onclick = () => verHistorial(App.ed.t, l);
}
function verHistorial(t, l){
  l = l || historialDe(t);
  const dias = {};
  l.slice().reverse().forEach(h => { const k = new Date(h.f).toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long',year:'numeric'}); (dias[k] = dias[k] || []).push(h); });
  popup({ tit:'📜 Historial de la tarea',
    html:`<p class="hist-tarea"><i style="background:${esc(t.color || colDe(t.colId).color)}"></i>${esc(t.titulo || 'Sin título')}</p>
      <div class="hist-todo">${Object.entries(dias).map(([k, hs]) => `<div class="hist-dia">${esc(k)}</div><ul class="hist-lista">${hs.map(h => lineaHist(h).replace(/<time>[^·]*· /, '<time>')).join('')}</ul>`).join('')}</div>`,
    botones:[{ txt:'Cerrar', cls:'btn-pri', val:null }] });
}
async function guardarTarea(t){ t.actualizada = Date.now(); await DB.poner('tareas', limpiaTarea(t)); }

// Marcar como acabada con el cuadradito de la tarjeta (y deshacer)
async function alternarHecha(id){
  const t = App.tareas.find(x => x.id === id); if(!t) return;
  const col = colDe(t.colId);
  if(col.hecha){ t.colId = (t.colPrev && columnas().some(c=>c.id===t.colPrev && !c.hecha)) ? t.colPrev : columnas()[0].id; delete t.hechaEn; }
  else { t.colPrev = t.colId; t.colId = colHecha().id; t.hechaEn = Date.now(); Fiesta.celebrar(t); }
  anotar(t, colDe(t.colId).hecha ? '✅ Marcada como acabada' : '↩️ Vuelve a «' + colDe(t.colId).nombre + '»');
  t.orden = -Date.now();
  await guardarTarea(t); pintarTodo();
  if(!(colDe(t.colId).hecha && Fiesta.cfg().activa)) toast(colDe(t.colId).hecha ? '✅ ¡Tarea acabada!' : '↩️ Vuelve a «'+colDe(t.colId).nombre+'»');
}

/* ---------- Con quién se comparte una tarea (las redondas con iniciales) ---------- */
// Personas del tablero abierto (quien lo comparte y quien ha aceptado) + la asignada
function compartidaCon(t){
  const lista = [];
  const p = persona(t.personaId); if(p) lista.push(p);
  if(typeof Nube !== 'undefined' && Nube.activa && Nube.tablero){
    const tb = Nube.tablero;
    const dentro = [...new Set([tb.duenoEmail, ...Nube.aceptados(tb)].map(e => (e||'').toLowerCase()).filter(Boolean))];
    for(const em of dentro){
      if(lista.some(x => (x.email||'').toLowerCase() === em)) continue;
      lista.push(App.personas.find(x => (x.email||'').toLowerCase() === em) || { id:'', nombre:em.split('@')[0], apellidos:'', email:em });
    }
  }
  return lista;
}
async function verGente(tid){
  const t = App.tareas.find(x => x.id === tid); if(!t) return;
  const gente = compartidaCon(t), yo = (typeof Nube !== 'undefined' && Nube.user) ? Nube.email() : '';
  const fila = (q, i) => {
    const asig = q.id && q.id === t.personaId, soy = (q.email||'').toLowerCase() === yo;
    const n = App.tareas.filter(x => q.id && x.personaId === q.id && !colDe(x.colId).hecha).length;
    return `<div class="gente-fila" data-i="${i}">
      <button class="gente-cab"><span class="avatar grande" style="background:${colorPersona(q)}">${esc(iniciales(q))}</span>
        <span class="gente-txt"><b>${esc(nombreP(q) || q.email)}${soy ? ' (tú)' : ''}</b><small>${asig ? '📌 Tiene asignada esta tarea' : q.email ? esc(q.email) : 'sin email'}</small></span><span class="gente-flecha">▾</span></button>
      <div class="gente-mas">
        ${q.email ? `<p>✉️ ${esc(q.email)}</p>` : ''}<p>📋 ${n} tarea${n === 1 ? '' : 's'} pendiente${n === 1 ? '' : 's'} en este tablero</p>
        <div class="gente-acc">
          ${!asig && q.id ? `<button class="mini-btn pri" data-acc="asignar">📌 Asignarle esta tarea</button>` : ''}
          ${q.id ? `<button class="mini-btn" data-acc="filtrar">👀 Ver sus tareas</button>` : ''}
          ${asig && q.email && !soy ? `<button class="mini-btn" data-acc="recordar">🔔 Recordatorio</button>` : ''}
        </div>
      </div></div>`;
  };
  const otros = gente.length - 1;
  await popup({ tit:'👥 ' + (otros > 0 ? 'Compartida con ' + gente.length + ' personas' : 'Asignada'),
    html:`<p class="gris" style="font-size:13.5px;margin-bottom:8px">«${esc(t.titulo)}»</p>
      <div class="gente-redondas">${gente.map((q, i) => `<button class="avatar grande" data-r="${i}" style="background:${colorPersona(q)}" title="${esc(nombreP(q))}">${esc(iniciales(q))}</button>`).join('')}</div>
      <div class="gente-lista">${gente.map(fila).join('')}</div>`,
    botones:[{ txt:'Cerrar', val:null }],
    alAbrir:(c, fin) => {
      const abrirFila = i => $$('.gente-fila', c).forEach(f => f.classList.toggle('abierta', f.dataset.i == i && !f.classList.contains('abierta')));
      $$('.gente-cab', c).forEach(b => b.onclick = () => abrirFila(b.closest('.gente-fila').dataset.i));
      $$('[data-r]', c).forEach(b => b.onclick = () => { abrirFila(b.dataset.r); const f = $(`.gente-fila[data-i="${b.dataset.r}"]`, c); f && f.scrollIntoView({ block:'nearest', behavior:'smooth' }); });
      $$('[data-acc]', c).forEach(b => b.onclick = async () => {
        const q = gente[+b.closest('.gente-fila').dataset.i];
        if(b.dataset.acc === 'asignar'){ t.personaId = q.id; anotar(t, '👤 Asignada a ' + q.nombre); await guardarTarea(t); pintarTodo(); fin(null); toast('📌 Asignada a ' + q.nombre); }
        if(b.dataset.acc === 'filtrar'){ App.filtro = 'p:' + q.id; pintarTodo(); fin(null); }
        if(b.dataset.acc === 'recordar'){ fin(null); await contarMedia(); Correo.recordatorio(t); t.recordado = Date.now(); anotar(t, '🔔 Recordatorio enviado a ' + q.nombre); await guardarTarea(t); pintarTodo(); }
      });
      if(gente.length === 1) abrirFila(0);
    } });
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
        anotar(t, (colDe(nueva).hecha ? '✅ ' : '➡️ ') + 'De «' + colDe(antes).nombre + '» a «' + colDe(nueva).nombre + '»');
        if(colDe(nueva).hecha && !colDe(antes).hecha){ t.hechaEn = Date.now(); Fiesta.celebrar(t); }
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
    const gen = e.target.closest('[data-gente]'); if(gen){ e.stopPropagation(); verGente(gen.dataset.gente); return; }
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
  if(t === 'audios') pintarAudios();
}

async function abrirEditor(id, colId){
  let t;
  if(id){ t = structuredClone(limpiaTarea(App.tareas.find(x => x.id === id))); App.ed = { t, nueva:false, mediaNueva:false }; }
  else {
    const primera = (colId && colDe(colId)) || columnas().find(c => c.id === 'nueva') || columnas().find(c => c.visible && !c.hecha) || columnas()[0];
    t = { id:nuevoId('t'), titulo:'', notas:'', colId:primera.id, color:'', prio:0, ini:'', fin:'', personaId:'', email:false, subs:[], creada:Date.now(), orden:-Date.now() };
    App.ed = { t, nueva:true, mediaNueva:false };
  }
  $('#edCab').textContent = App.ed.nueva ? 'Nueva tarea' : 'Editar tarea';
  $('#edTitulo').value = t.titulo; $('#edNotas').innerHTML = notaHtml(t); _rangoNota = null;
  $('#edCol').innerHTML = columnas().map(c => `<option value="${c.id}" ${c.id===t.colId?'selected':''}>${esc(c.nombre)}${c.visible?'':' (oculta)'}</option>`).join('');
  selColorTarea = selColor($('#edColor'), t.color, PALETA_TAREA, v => { App.ed.t.color = v; });
  $$('#edPrio button').forEach(b => b.classList.toggle('on', +b.dataset.p === (t.prio||0)));
  $('#edIni').value = t.ini || ''; $('#edFin').value = t.fin || '';
  Avisos.pintarEditor(t);
  $('#edPersona').innerHTML = opcionesPersonas(t.personaId);
  $('#edEmail').checked = false;
  pintarSubs(); pintarDur(); pintarEmail(); pintarPunto();
  App.ed.pend = [];
  pintarHistorial();
  pintarTableroTarea();
  $('#edBorrarFila').hidden = App.ed.nueva; $('#edDup').style.display = App.ed.nueva ? 'none' : '';
  await contarEditor();
  tabEditor('tarea');
  abrir('editor');
  if(App.ed.nueva) setTimeout(() => $('#edTitulo').focus(), 300);
}
function pintarPunto(){ $('#edPunto').style.background = colDe($('#edCol').value).color; }
// Las fechas vacías se ven como «Sin fecha» (Safari, si no, enseña la de hoy en gris)
function marcarFechas(){ for(const id of ['edIni','edFin']){ const i = $('#'+id); i.parentNode.classList.toggle('vacia', !i.value); } Avisos.marcar(); }
function pintarDur(){
  marcarFechas();
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
  $('#edEmailInfo').textContent = p ? (p.email ? (Correo.hayEmailJS() ? 'Se le enviará solo a ' : 'Se abrirá tu correo con todo listo para ') + p.email : 'Esta persona no tiene email') : 'Elige antes a quién se asigna';
  $('#edRecordar').disabled = !(p && p.email);
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
  const [f, v, a] = await Promise.all(['fotos','videos','audios'].map(x => DB.deTarea(x, id)));
  $('#nFotos').textContent = f.length || ''; $('#nVideos').textContent = v.length || ''; $('#nAudios').textContent = a.length || '';
  return { f, v, a };
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
  $('#galFotos').innerHTML = l.length ? l.map(f => `<div class="mini" data-id="${f.id}">${(f.mini||f.blob) ? `<img src="${urlDe(f.mini||f.blob)}" alt="">` : '<span class="play">⏳</span>'}<span class="pes">${tamTxt(f.size)}</span></div>`).join('') : '<div class="vacio">📷 Todavía no hay fotos en esta tarea</div>';
  $$('#galFotos .mini').forEach(m => m.onclick = () => verMedia('fotos', m.dataset.id));
}
async function pintarVideos(){
  const l = (await DB.deTarea('videos', App.ed.t.id)).sort((a,b) => a.fecha-b.fecha);
  $('#nVideos').textContent = l.length || '';
  const tot = l.reduce((s,x) => s+x.size, 0), ori = l.reduce((s,x) => s+(x.original||x.size), 0);
  $('#videosInfo').textContent = l.length ? `${l.length} vídeo${l.length>1?'s':''} · ocupan ${tamTxt(tot)}${ori>tot ? ' (sin aligerar serían '+tamTxt(ori)+')' : ''}` : 'Los vídeos se aligeran (tamaño y calidad) antes de guardarse. Tarda lo mismo que dura el vídeo.';
  $('#galVideos').innerHTML = l.length ? l.map(v => `<div class="mini" data-id="${v.id}">${v.poster ? `<img src="${urlDe(v.poster)}" alt="">` : ''}<span class="play">▶</span><span class="pes">${durTxt(v.dur)} · ${tamTxt(v.size)}</span></div>`).join('') : '<div class="vacio">🎬 Todavía no hay vídeos en esta tarea</div>';
  $$('#galVideos .mini').forEach(m => m.onclick = () => verMedia('videos', m.dataset.id));
}
async function pintarAudios(){
  const l = (await DB.deTarea('audios', App.ed.t.id)).sort((a,b) => a.fecha-b.fecha);
  $('#nAudios').textContent = l.length || '';
  const tot = l.reduce((s,x) => s+(x.size||0), 0);
  $('#audiosInfo').textContent = l.length ? `${l.length} nota${l.length>1?'s':''} de audio · ocupan ${tamTxt(tot)}` : 'Graba una nota de voz: la escuchas y decides si la guardas.';
  $('#listaAudios').innerHTML = l.length ? l.map(a => `<div class="audio-fila" data-id="${a.id}">
      <div class="audio-cab"><b>🎙️ ${new Date(a.fecha).toLocaleDateString('es-ES',{day:'numeric',month:'short'})} · ${new Date(a.fecha).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})}</b>
      <small>${durTxt(a.dur)} · ${tamTxt(a.size)}${a.autorNombre ? ' · ' + esc(a.autorNombre.split(' ')[0]) : ''}</small>
      <button class="ico-b peligro" data-borrar="${a.id}" aria-label="Borrar">🗑</button></div>
      ${a.blob ? `<audio controls preload="metadata" src="${urlDe(a.blob)}"></audio>` : `<button class="mini-btn" data-cargar="${a.id}">▶ Escuchar</button>`}
    </div>`).join('') : '<div class="vacio">🎙️ Todavía no hay notas de audio en esta tarea</div>';
  $$('#listaAudios [data-cargar]').forEach(b => b.onclick = async () => { b.textContent = '⏳ Cargando…'; const o = await DB.uno('audios', b.dataset.cargar); if(o && o.blob){ const au = document.createElement('audio'); au.controls = true; au.src = urlDe(o.blob); b.replaceWith(au); au.play().catch(()=>{}); } else b.textContent = '⚠️ No se pudo cargar'; });
  $$('#listaAudios [data-borrar]').forEach(b => b.onclick = async () => {
    if(!await popConfirmar('¿Borrar la nota de audio?', 'No se podrá recuperar.', 'Borrar')) return;
    await DB.borrar('audios', b.dataset.borrar); apuntar('🗑 Nota de audio borrada'); pintarHistorial(); pintarAudios(); contarMedia().then(pintarTodo);
  });
}
function pintarMedia(tipo){ ({ fotos:pintarFotos, videos:pintarVideos, audios:pintarAudios })[tipo](); }
let _visor = null;
async function verMedia(tipo, id){
  const o = await DB.uno(tipo, id); if(!o) return;
  _visor = { tipo, id };
  const u = o.blob ? urlDe(o.blob) : null;
  if(!u){ toast('⏳ Aún se está subiendo o no hay conexión. Prueba en un momento.'); return; }
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
  if(r.n){ apuntar('📷 ' + r.n + (r.n > 1 ? ' fotos añadidas' : ' foto añadida')); pintarHistorial(); }
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
    apuntar('🎬 Vídeo añadido'); pintarHistorial();
    toast(r.aligerado ? `🎬 Vídeo: de ${tamTxt(r.original)} a ${tamTxt(r.size)}` : '🎬 Vídeo guardado (ya era ligero)');
  }catch(e){
    if(e.message !== 'cancelado'){
      console.warn(e);
      const si = await popConfirmar('No se pudo aligerar', 'Este navegador no ha podido aligerar el vídeo. ¿Lo guardo tal cual ('+tamTxt(file.size)+')?', 'Guardar tal cual');
      if(si){ apuntar('🎬 Vídeo añadido'); pintarHistorial(); await DB.poner('videos', { id:nuevoId('v'), tareaId:App.ed.t.id, blob:file, poster:null, size:file.size, original:file.size, tipo:file.type, nombre:file.name, fecha:Date.now() }); }
    } else toast('Vídeo cancelado');
  }
  caja.hidden = true;
  await pintarVideos();
}

function leerEditor(){
  const t = App.ed.t;
  t.titulo = $('#edTitulo').value.trim();
  const rn = ricoLimpio($('#edNotas')); t.notas = rn.txt.trim();
  if(/<b>/.test(rn.html)) t.notasHtml = rn.html.trim(); else delete t.notasHtml;
  if(!t.titulo && t.notas) t.titulo = t.notas.split('\n')[0].slice(0, 80);
  t.colId = $('#edCol').value;
  t.color = selColorTarea.valor;
  t.prio = +($('#edPrio .on')?.dataset.p || 0);
  t.ini = $('#edIni').value; t.fin = $('#edFin').value;
  if(t.ini && t.fin && t.fin < t.ini){ const x = t.ini; t.ini = t.fin; t.fin = x; }
  t.personaId = $('#edPersona').value;
  Avisos.leerEditor(t, App.tareas.find(x => x.id === t.id));
  return t;
}

async function guardarEditor(){
  const t = leerEditor();
  if(!t.titulo){ $('#edTitulo').focus(); toast('✏️ Escribe qué hay que hacer'); return; }
  const previa = App.tareas.find(x => x.id === t.id);
  if(previa && previa.colId !== t.colId){
    if(!colDe(previa.colId).hecha) t.colPrev = previa.colId;
    if(colDe(t.colId).hecha && !colDe(previa.colId).hecha){ t.hechaEn = Date.now(); setTimeout(() => Fiesta.celebrar(t), 350); }
    t.orden = -Date.now();
  }
  const enviar = $('#edEmail').checked;
  if(App.ed.nueva){ anotar(t, '✨ Creada en «' + colDe(t.colId).nombre + '»'); Avisos.cambios({}, t).forEach(x => anotar(t, x)); }
  else if(previa) cambiosTarea(previa, t).forEach(x => anotar(t, x));
  (App.ed.pend || []).forEach(x => anotar(t, x));
  if(enviar){ const p = persona(t.personaId); anotar(t, '📧 Email enviado' + (p ? ' a ' + nombreP(p) : '')); }
  if(enviar) t.emailEnviado = Date.now();
  if(App.ed.recordado) t.recordado = App.ed.recordado;
  await guardarTarea(t);
  const i = App.tareas.findIndex(x => x.id === t.id);
  if(i >= 0) App.tareas[i] = t; else App.tareas.push(t);
  Voz.parar(); cerrar('editor'); soltarUrls();
  await contarMedia(); pintarTodo();
  toast(App.ed.nueva ? '✨ Tarea creada' : '💾 Guardada');
  if(enviar) Correo.tarea(t);
  App.ed = null;
}
async function cancelarEditor(){
  Voz.parar();
  if(App.ed && !App.ed.nueva && (App.ed.pend || []).length){
    const o = App.tareas.find(x => x.id === App.ed.t.id);
    if(o){ App.ed.pend.forEach(x => anotar(o, x)); await guardarTarea(o); }
  }
  if(App.ed && App.ed.nueva && App.ed.mediaNueva){
    for(const x of ['fotos','videos','audios']) await DB.borrarDeTarea(x, App.ed.t.id);
  }
  cerrar('editor'); soltarUrls(); App.ed = null;
  await contarMedia(); pintarTodo();
}

/* Borrar (con una ventanita para confirmar y «Deshacer» unos segundos) */
async function borrarTarea(id){
  const t = (App.ed && App.ed.t && App.ed.t.id === id && !App.ed.nueva) ? App.tareas.find(x => x.id === id) : App.tareas.find(x => x.id === id);
  if(!t) return;
  const n = { fotos:0, videos:0, audios:0 }; let bytes = 0;
  for(const x of Object.keys(n)){ try{ const l = await DB.deTarea(x, id); n[x] = l.length; bytes += l.reduce((s, m) => s + (m.size || 0), 0); }catch(e){} }
  const col = colDe(t.colId), color = t.color || col.color;
  const trozos = [n.fotos && `📷 ${n.fotos} foto${n.fotos > 1 ? 's' : ''}`, n.videos && `🎬 ${n.videos} vídeo${n.videos > 1 ? 's' : ''}`, n.audios && `🎙️ ${n.audios} audio${n.audios > 1 ? 's' : ''}`].filter(Boolean);
  const subs = (t.subs || []).length;
  const ok = await popup({ tit:'',
    html:`<div class="borrar-pop">
      <div class="bp-ico"><svg viewBox="0 0 24 24" aria-hidden="true"><path class="bp-tapa" d="M4 6.5h16M9.5 6.5V4.8c0-.7.6-1.3 1.3-1.3h2.4c.7 0 1.3.6 1.3 1.3v1.7"/><path d="M6 6.5l.9 12.6c.1 1 .9 1.9 2 1.9h6.2c1.1 0 1.9-.9 2-1.9L18 6.5M10 10.5v6.5M14 10.5v6.5"/></svg></div>
      <div class="bp-tit">¿Borrar esta tarea?</div>
      <div class="bp-tarjeta" style="--c:${esc(color)};--b:${esc(col.color)}">
        <b>${esc(t.titulo || 'Sin título')}</b>
        <span class="bp-col"><i></i>${esc(col.nombre)}</span>
      </div>
      <ul class="bp-lista">
        ${trozos.length ? `<li>Se borrarán también ${trozos.join(', ')}</li>` : ''}
        ${subs ? `<li>☑️ ${trozos.length ? 'y' : 'Se borrará con'} ${subs > 1 ? 'sus ' + subs + ' pasos' : 'su paso'}</li>` : ''}
        ${bytes ? `<li class="bp-libre">✨ Liberarás <b>${tamTxt(bytes)}</b> de espacio</li>` : ''}
        <li class="bp-nota">Tendrás unos segundos para deshacerlo.</li>
      </ul>
    </div>`,
    botones:[{ txt:'Cancelar', val:false }, { txt:'🗑 Sí, borrar', cls:'btn-borrar', val:true }] });
  if(!ok) return;
  App.tareas = App.tareas.filter(x => x.id !== id);
  await DB.borrar('tareas', id);
  if(App.ed && App.ed.t && App.ed.t.id === id){ Voz.parar(); cerrar('editor'); soltarUrls(); App.ed = null; }
  pintarTodo();
  let deshecho = false;
  const tm = setTimeout(async () => { if(!deshecho){ for(const x of ['fotos','videos','audios']) await DB.borrarDeTarea(x, id); contarMedia().then(pintarTodo); } }, 7000);
  toast('🗑 Tarea borrada' + (bytes ? ' · ' + tamTxt(bytes) + ' liberados' : ''), 'Deshacer', async () => {
    deshecho = true; clearTimeout(tm);
    anotar(t, '↩️ Recuperada después de borrarla');
    App.tareas.push(t); await DB.poner('tareas', limpiaTarea(t)); pintarTodo(); toast('↩️ Recuperada');
  }, 7000);
}
async function duplicarTarea(){
  const o = leerEditor();
  const c = structuredClone(limpiaTarea(o));
  c.id = nuevoId('t'); c.titulo = o.titulo + ' (copia)'; c.creada = Date.now(); c.orden = -Date.now(); delete c.emailEnviado; delete c.recordado; delete c.avisos; c.hist = []; anotar(c, '⧉ Creada como copia de «' + o.titulo + '»');
  for(const tipo of ['fotos','videos','audios']){
    const l = (await DB.deTarea(tipo, o.id)).filter(x => x.blob);
    if(l.length) await DB.ponerVarios(tipo, l.map(x => ({...x, id:nuevoId(tipo[0]), tareaId:c.id})));
  }
  await guardarTarea(c); App.tareas.push(c);
  cerrar('editor'); soltarUrls(); App.ed = null;
  await contarMedia(); pintarTodo();
  toast('⧉ Duplicada', 'Abrir', () => abrirEditor(c.id));
}

/* Mover la tarea a otro tablero (desplegable al final de la tarea) */
function pintarTableroTarea(){
  const fila = $('#edTabFila'), sel = $('#edTablero');
  const lista = (typeof Nube !== 'undefined' && Nube.activa) ? [...Nube.misTableros(), ...Nube.compartidos()] : [];
  fila.hidden = !App.ed || App.ed.nueva || lista.length < 2;
  if(fila.hidden) return;
  sel.innerHTML = lista.map(t => `<option value="${t.id}" ${t.id === Nube.tid ? 'selected' : ''}>📋 ${esc(Nube.nombreTablero(t))}${Nube.esDueno(t) ? '' : ' (de ' + esc((t.duenoNombre || t.duenoEmail || '').split(' ')[0]) + ')'}</option>`).join('');
}
async function cambiarTableroTarea(){
  const sel = $('#edTablero'), destino = sel.value;
  if(!App.ed || destino === Nube.tid) return;
  const t = leerEditor(), nom = Nube.nombreTablero(Nube.tableros[destino]);
  if(!t.titulo){ sel.value = Nube.tid; $('#edTitulo').focus(); toast('✏️ Escribe antes qué hay que hacer'); return; }
  const ok = await popConfirmar('¿Mover al tablero «' + nom + '»?', '«' + t.titulo + '» se moverá con sus fotos, vídeos y audios. Dejará de estar en este tablero y la verán las personas de «' + nom + '».', 'Mover');
  if(!ok){ sel.value = Nube.tid; return; }
  sel.disabled = true;
  try{
    const previa = App.tareas.find(x => x.id === t.id);
    if(previa) cambiosTarea(previa, t).forEach(x => anotar(t, x));
    (App.ed.pend || []).forEach(x => anotar(t, x)); App.ed.pend = [];
    anotar(t, '📋 Movida del tablero «' + Nube.nombreTablero(Nube.tablero) + '» a «' + nom + '»');
    await Nube.moverTarea(t, destino);
    Voz.parar(); cerrar('editor'); soltarUrls(); App.ed = null;
    App.tareas = App.tareas.filter(x => x.id !== t.id);
    await contarMedia(); pintarTodo();
    toast('📋 Movida a «' + nom + '»', 'Ir', () => Nube.conectar(destino), 6000);
  }catch(e){ console.warn(e); popAviso('No se pudo mover', Nube.textoError(e)); sel.value = Nube.tid; }
  sel.disabled = false;
}

/* Recordatorio por email (se puede enviar las veces que haga falta) */
async function enviarRecordatorio(){
  const t = leerEditor(), p = persona(t.personaId);
  if(!p || !p.email){ toast('👤 Asigna antes la tarea a alguien con email'); return; }
  App.ed.recordado = Date.now();
  apuntar('🔔 Recordatorio enviado a ' + nombreP(p)); pintarHistorial();
  if(!App.ed.nueva){
    const o = App.tareas.find(x => x.id === t.id);
    if(o){ o.recordado = App.ed.recordado; await guardarTarea(o); pintarTodo(); }
  }
  await contarMedia();
  Correo.recordatorio({ ...t, nf:(App.tareas.find(x => x.id === t.id)||{}).nf, nv:(App.tareas.find(x => x.id === t.id)||{}).nv, na:(App.tareas.find(x => x.id === t.id)||{}).na });
}

/* Añadir al calendario del móvil (.ics) */
function descargar(blob, nombre){
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nombre;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}
function exportarIcs(){
  const t = leerEditor();
  // los avisos con sonido van como alarmas del calendario del móvil (suenan aunque la app esté cerrada)
  const avs = Avisos.mios(t).filter(a => a.f && !a.sonado && new Date(a.f).getTime() > Date.now()).sort((a, b) => a.f.localeCompare(b.f));
  const r = rango(t) || (avs.length ? [avs[0].f.slice(0, 10), avs[0].f.slice(0, 10)] : null);
  if(!r){ toast('📅 Pon antes una fecha o un aviso'); return; }
  const utc = f => new Date(f).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const alarmas = avs.flatMap(a => ['BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + String(t.titulo || 'PorHacer').replace(/[,;\\]/g, ' ').replace(/\n/g, ' '), 'TRIGGER;VALUE=DATE-TIME:' + utc(a.f), 'END:VALARM']);
  const f = s => s.replace(/-/g,'');
  const e = s => String(s||'').replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/[,;]/g, m => '\\'+m);
  const ics = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//PorHacer//ES','CALSCALE:GREGORIAN','BEGIN:VEVENT',
    'UID:'+t.id+'@porhacer','DTSTAMP:'+new Date().toISOString().replace(/[-:]/g,'').split('.')[0]+'Z',
    'DTSTART;VALUE=DATE:'+f(r[0]),'DTEND;VALUE=DATE:'+f(sumaDias(r[1],1)),
    'SUMMARY:'+e(t.titulo),'DESCRIPTION:'+e(t.notas),...alarmas,'END:VEVENT','END:VCALENDAR'].join('\r\n');
  if(avs.length) toast('📅 Con ' + avs.length + (avs.length > 1 ? ' avisos' : ' aviso') + ' que sonarán en el calendario del móvil');
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
function pintarCabecera(){
  const b = $('#btnTablero'); if(!b) return;
  const on = typeof Nube !== 'undefined' && Nube.activa;
  b.hidden = !on; $('#hoyTxt').hidden = on;
  if(on){ const n = Nube.invitaciones().length; b.innerHTML = '📋 ' + esc(Nube.nombreTablero(Nube.tablero || Nube.tableros[Nube.tid])) + ' <span>▾</span>' + (n ? ' <i>' + n + '</i>' : ''); }
}
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
  $$('#edAviso1, #edAviso2').forEach(i => { i.addEventListener('input', () => Avisos.marcar()); i.addEventListener('change', () => { Avisos.marcar(); if(i.value){ Avisos.pedirPermiso(); Fiesta.despertar(); } $('#edAvisoInfo' + i.id.slice(-1)).textContent = ''; }); });
  $$('.aviso-rapido [data-av]').forEach(b => b.onclick = e => { e.preventDefault();
    const i = !$('#edAviso1').value ? $('#edAviso1') : !$('#edAviso2').value ? $('#edAviso2') : null;
    if(!i){ toast('Ya tienes los 2 avisos. Quita uno con ✕'); return; }
    const d = new Date(); if(b.dataset.av === '1h'){ d.setMinutes(d.getMinutes() + 60); } else { d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); }
    i.value = iso(d) + 'T' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0'); i.dispatchEvent(new Event('change')); });
  $$('#edIni, #edFin').forEach(i => i.addEventListener('input', pintarDur));
  $$('.fecha-x').forEach(b => b.onclick = e => { e.preventDefault(); $('#'+b.dataset.x).value = ''; pintarDur(); });
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
  $('#edRecordar').onclick = enviarRecordatorio;
  $('#edTablero').onchange = cambiarTableroTarea;
  $('#edHoy').onclick = () => { const h = hoyIso(); $('#edIni').value = h; $('#edFin').value = h; pintarDur(); toast('☀️ Fecha: hoy'); };
  $('#btnGrabarAudio').onclick = async () => { if(await Audios.grabar(App.ed.t.id)){ App.ed.mediaNueva = true; apuntar('🎙️ Nota de audio añadida'); pintarHistorial(); pintarAudios(); contarMedia().then(pintarTodo); } };
  $('#btnTablero').onclick = () => Nube.elegirTablero();
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
    await DB.borrar(tipo, id); apuntar(tipo === 'fotos' ? '🗑 Foto borrada' : '🗑 Vídeo borrado'); pintarHistorial(); cerrarVisor();
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
  Avisos.iniciar();
  Bloc.iniciar();
  Listas.iniciar();
  iniciarNotasRicas();
  pintarTodo();
  setTimeout(() => $('#splash').classList.add('fuera'), 900);
  setTimeout(() => document.body.classList.add('ya'), 1800);
  pedirPersistencia();
  Nube.iniciar();
  if(App.ajustes.inicio === 'listas') Listas.abrir(); else if(App.ajustes.inicio === 'cal') Cal.abrir();
  $('#nubeEstado').onclick = () => { if(!Nube.user) Nube.pantallaEntrar(); else Nube.explicarEstado(); };
  if('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(()=>{});
}
document.addEventListener('DOMContentLoaded', iniciar);
