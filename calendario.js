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
    // Deslizar el dedo para pasar de hoja
    const c = $('#calCuerpo'); let x0 = null, y0 = 0;
    c.addEventListener('touchstart', e => { if(e.touches.length===1){ x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; } }, { passive:true });
    c.addEventListener('touchend', e => {
      if(x0 === null) return; const t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0; x0 = null;
      if(Math.abs(dx) > 60 && Math.abs(dy) < 60) this.mover(dx < 0 ? 1 : -1);
    }, { passive:true });
    c.addEventListener('click', e => {
      const b = e.target.closest('[data-t]'); if(b){ e.stopPropagation(); abrirEditor(b.dataset.t); return; }
      const nueva = e.target.closest('[data-nueva]'); if(nueva){ this.nuevaEn(nueva.dataset.nueva); return; }
      const d = e.target.closest('[data-d]'); if(d){ this.fecha = deIso(d.dataset.d); this.cambiarModo('dia'); return; }
      const m = e.target.closest('[data-m]'); if(m){ const [y,mm] = m.dataset.m.split('-').map(Number); this.fecha = new Date(y, mm, 1); this.cambiarModo('mes'); }
    });
  },
  abrir(){ $('#vTablero').classList.remove('activa'); $('#vCal').classList.add('activa'); $('#fab').style.display='none'; this.pintar(); },
  cerrar(){ $('#vCal').classList.remove('activa'); $('#vTablero').classList.add('activa'); $('#fab').style.display=''; pintarTodo(); },
  async cambiarModo(m){ this.modo = m; App.ajustes.calModo = m; guardarAjustes(); this.pintar(); },
  mover(n){
    const f = this.fecha;
    if(this.modo === 'dia') f.setDate(f.getDate()+n);
    else if(this.modo === 'mes') this.fecha = new Date(f.getFullYear(), f.getMonth()+n, 1);
    else this.fecha = new Date(f.getFullYear()+n, 0, 1);
    const c = $('#calCuerpo'); c.classList.remove('pasa-izq','pasa-der'); void c.offsetWidth;
    c.classList.add(n > 0 ? 'pasa-izq' : 'pasa-der');
    this.pintar();
  },
  async nuevaEn(dia){
    await abrirEditor(null);
    $('#edIni').value = dia; $('#edFin').value = dia; pintarDur();
  },
  // tareas con fecha que se ven (columnas visibles + filtro del tablero)
  tareas(){
    return App.tareas.filter(t => rango(t) && colDe(t.colId).visible && pasaFiltro(t))
      .map(t => ({ t, r: rango(t) }))
      .sort((a,b) => a.r[0].localeCompare(b.r[0]) || difDias(b.r[0],b.r[1]) - difDias(a.r[0],a.r[1]));
  },
  pintar(){
    $$('#calModo button').forEach(b => b.classList.toggle('on', b.dataset.m === this.modo));
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
        const t = z.t, fondo = fondoTarea(t.color) || '#ffffff';
        const cls = ['barra-t', z.r[0] < a ? 'cont-izq' : '', z.r[1] > b ? 'cont-der' : ''].join(' ');
        return `<div class="${cls}" data-t="${t.id}" title="${esc(t.titulo)}" style="left:calc(${z.s/7*100}% + 2px);width:calc(${(z.e-z.s+1)/7*100}% - 4px);top:${z.k*22}px;background:${fondo};border-color:${bordeDe(t)}">${esc(t.titulo)}</div>`;
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
          const cs = ts.map(x => fondoTarea(x.t.color) || mezcla(colDe(x.t.colId).color,'#ffffff',.6));
          st = cs.length === 1 ? `background:${cs[0]}` : `background:linear-gradient(135deg,${cs.map((c,i)=>`${c} ${i/cs.length*100}% ${(i+1)/cs.length*100}%`).join(',')})`;
        }
        celdas += `<span class="${ts.length?'c':''} ${s===hoy?'hoy':''}" style="${st}">${di}${ts.length ? `<i style="background:${bordeDe(ts[0].t)}"></i>` : ''}</span>`;
      }
      const act = ahora.getFullYear()===y && ahora.getMonth()===m;
      html += `<div class="mmes ${act?'actual':''}" data-m="${y}-${m}"><h5>${MESES[m]} <small>${delMes.length ? delMes.length+' 📋' : ''}</small></h5><div class="mgrid">${celdas}</div></div>`;
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
    html += lista.map(({t, r}) => {
      const n = difDias(r[0], r[1]) + 1, i = difDias(r[0], s) + 1, col = colDe(t.colId), p = persona(t.personaId);
      return `<div class="dia-t" data-t="${t.id}" style="--tc:${fondoTarea(t.color)||'#fff'};--tb:${bordeDe(t)}">
        <b>${esc(t.titulo)}</b>
        <div class="lin"><span class="tag" style="border-color:${col.color}">● ${esc(col.nombre)}</span>${t.prio?`<span class="tag prio${t.prio}">${['','Baja','Media','Alta'][t.prio]}</span>`:''}${p?`<span class="tag">👤 ${esc(nombreP(p))}</span>`:''}${vencida(t)?'<span class="tag vencida">Vencida</span>':''}</div>
        ${n > 1 ? `<div class="tramo"><i style="left:0;width:${i/n*100}%"></i></div><div class="tramo-txt">Día ${i} de ${n} · del ${fCorta(r[0])} al ${fCorta(r[1])}</div>` : '<div class="tramo-txt">Solo este día</div>'}
      </div>`;
    }).join('');
    html += `<button class="btn-sec" data-nueva="${s}" style="height:50px;margin-top:4px">＋ Nueva tarea este día</button></div>`;
    return html;
  }
};
