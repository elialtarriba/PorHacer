/* PorHacer · configuración: temas, colores, columnas, personas y más */

const Ajustes = {
  abrir(){
    $$('#ajTabs button').forEach(b => b.onclick = () => this.tab(b.dataset.t));
    this.tab('temas');
    abrir('ajustes');
  },
  tab(t){
    $$('#ajTabs button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
    $$('#ajustes .tab-pan').forEach(p => p.classList.toggle('on', p.dataset.p === t));
    $('#ajustes .hoja-scroll').scrollTop = 0;
    ({ temas:()=>this.temas(), colores:()=>this.colores(), columnas:()=>this.columnas(), personas:()=>this.personas(), copias:()=>Copias.pintar(), tableros:()=>Nube.pintarTableros($('#ajNube')), fiesta:()=>this.fiesta(), bloc:()=>Bloc.pintarAjustes($('#ajBloc')), mas:()=>this.mas() })[t]();
  },
  async guardar(){ await guardarAjustes(); },

  /* Temas rápidos */
  temas(){
    const a = App.ajustes;
    const titulo = g => `<h4 class="temas-grupo">${g === 'blanco' ? '⚪ Con fondo blanco' : '🎨 Con fondo de color'}</h4>`;
    let grupoAnt = null;
    $('#ajTemas').innerHTML = Object.entries(TEMAS).map(([k, t]) => {
      const c = t.c, g = t.grupo || 'color', cab = g !== grupoAnt ? titulo(g) : ''; grupoAnt = g;
      return cab + `<button class="tema ${a.tema===k?'on':''}" data-k="${k}">
        <div class="prev" style="background:linear-gradient(180deg,${c.bg},${c.bg2})">
          <i style="background:${c.card};border-color:#e5484d"></i><i style="background:${c.card};border-color:#3b82f6"></i><i style="background:${c.card};border-color:#22a55a"></i>
          <em style="background:linear-gradient(180deg,${c.accent2},${c.accent});box-shadow:0 0 0 3px ${c.dark}"></em>
        </div><b>${esc(t.nombre)}</b></button>`;
    }).join('') + (a.tema === 'propio' ? '<p class="aj-ayuda" style="grid-column:1/-1">Ahora usas tus propios colores (cambiados en «Colores»). Elige un tema para volver a empezar desde él.</p>' : '')
      + '<p class="aj-ayuda" style="grid-column:1/-1">Después puedes cambiar cada color por separado en la pestaña 🖌️ Colores.</p>';
    $$('#ajTemas .tema').forEach(b => b.onclick = async () => {
      a.tema = b.dataset.k; a.colores = { ...TEMAS[a.tema].c };
      aplicarTema(a.colores); await this.guardar(); this.temas(); pintarTodo();
      toast('🎨 Tema «' + TEMAS[a.tema].nombre + '»');
    });
  },

  /* Colores uno a uno */
  colores(){
    const a = App.ajustes, cont = $('#ajColores');
    cont.innerHTML = '<div class="aj-sec"><h4>Cambia cada color</h4><p class="aj-ayuda">Los cambios se ven al momento. «Otro color…» abre el selector libre.</p><div id="ajListaCol"></div></div>'
      + '<button class="btn-sec btn-ancho" id="ajResetCol">↺ Volver a los colores del tema</button>';
    const l = $('#ajListaCol');
    PARTES_COLOR.forEach(([k, nombre]) => {
      const f = document.createElement('div'); f.className = 'aj-fila';
      f.innerHTML = `<span>${esc(nombre)}</span><div></div>`;
      l.appendChild(f);
      selColor(f.lastElementChild, a.colores[k], PALETA.filter(p => p[0]).concat([['blanco','Blanco','#ffffff']]), async v => {
        a.colores[k] = v || '#ffffff'; a.tema = 'propio'; aplicarTema(a.colores); await this.guardar(); pintarTodo();
      });
    });
    $('#ajResetCol').onclick = async () => {
      const base = TEMAS[a.tema] ? a.tema : 'grises';
      a.tema = base; a.colores = { ...TEMAS[base].c }; aplicarTema(a.colores); await this.guardar(); this.colores(); pintarTodo();
    };
  },

  /* Columnas: mostrar/ocultar, nombre, color del borde, orden, nuevas */
  columnas(){
    const a = App.ajustes, cont = $('#ajColumnas');
    cont.innerHTML = `<div class="aj-sec"><h4>Borde de las tareas</h4>
        <label class="check" style="margin-top:0"><input type="checkbox" id="ajBorde" ${a.bordeColumna?'checked':''}><span class="caja"></span><span>El borde de cada tarea toma el color de su columna<small>Ej.: Nueva = rojo, En curso = azul, En pausa = naranja, Acabada = verde</small></span></label></div>
      <div class="aj-sec"><h4>Columnas</h4><p class="aj-ayuda">👁 muestra u oculta · ↑↓ cambia el orden · ✓ = las tareas de esa columna cuentan como «acabadas» (se tachan y no salen como vencidas).</p><div id="ajListaCols"></div>
      <button class="btn-pri btn-ancho" id="ajNuevaCol">＋ Nueva columna</button></div>`;
    $('#ajBorde').onchange = async e => { a.bordeColumna = e.target.checked; await this.guardar(); pintarTodo(); };
    const l = $('#ajListaCols');
    a.columnas.forEach((c, i) => {
      const n = App.tareas.filter(t => t.colId === c.id).length;
      const f = document.createElement('div'); f.className = 'col-fila'; f.style.setProperty('--cc', c.color);
      f.innerHTML = `<div class="r1"><input class="nom" value="${esc(c.nombre)}" maxlength="30"><button class="ico-b ${c.visible?'':'off'}" data-a="ver" title="Mostrar / ocultar">${c.visible?'👁':'🙈'}</button></div>
        <div class="r2"><div class="selc"></div><button class="ico-b ${c.hecha?'':'off'}" data-a="hecha" title="Cuenta como acabada">✓</button><button class="ico-b" data-a="sube" ${i===0?'disabled':''}>↑</button><button class="ico-b" data-a="baja" ${i===a.columnas.length-1?'disabled':''}>↓</button><button class="ico-b peligro" data-a="borrar" title="Borrar columna" ${a.columnas.length<2?'disabled':''}>🗑</button></div>
        <p class="aj-ayuda" style="margin:6px 2px 0">${n} tarea${n===1?'':'s'}</p>`;
      l.appendChild(f);
      selColor(f.querySelector('.selc'), c.color, PALETA.filter(p => p[0]), async v => { c.color = v; f.style.setProperty('--cc', v); await this.guardar(); pintarTodo(); }, true);
      f.querySelector('.nom').onchange = async e => { c.nombre = e.target.value.trim() || c.nombre; await this.guardar(); pintarTodo(); };
      f.querySelectorAll('[data-a]').forEach(b => b.onclick = async () => {
        const ac = b.dataset.a;
        if(ac === 'ver') c.visible = !c.visible;
        if(ac === 'hecha') c.hecha = !c.hecha;
        if(ac === 'sube' && i > 0) [a.columnas[i-1], a.columnas[i]] = [a.columnas[i], a.columnas[i-1]];
        if(ac === 'baja' && i < a.columnas.length-1) [a.columnas[i+1], a.columnas[i]] = [a.columnas[i], a.columnas[i+1]];
        if(ac === 'borrar'){
          const otras = a.columnas.filter(x => x.id !== c.id);
          let destino = otras[0].id;
          if(n){
            destino = await popup({ tit:'Borrar «'+c.nombre+'»', html:`<p>Tiene ${n} tarea${n>1?'s':''}. ¿A qué columna las paso?</p><select id="dest">${otras.map(o=>`<option value="${o.id}">${esc(o.nombre)}</option>`).join('')}</select>`,
              botones:[{txt:'Cancelar', val:null}, {txt:'Borrar', cls:'btn-pri', val:cx => $('#dest',cx).value}] });
            if(!destino) return;
          } else if(!await popConfirmar('Borrar «'+c.nombre+'»', 'La columna está vacía. ¿La borro?', 'Borrar')) return;
          for(const t of App.tareas.filter(t => t.colId === c.id)){ t.colId = destino; await guardarTarea(t); }
          a.columnas = otras;
        }
        await this.guardar(); this.columnas(); pintarTodo();
      });
    });
    $('#ajNuevaCol').onclick = async () => {
      const v = await popup({ tit:'Nueva columna', html:'<input id="ncNom" placeholder="Nombre (p. ej. Esperando respuesta)" maxlength="30">',
        botones:[{txt:'Cancelar', val:null}, {txt:'Crear', cls:'btn-pri', val:cx => $('#ncNom',cx).value.trim()}],
        alAbrir: cx => setTimeout(() => $('#ncNom',cx).focus(), 200) });
      if(!v) return;
      const usados = a.columnas.map(c => c.color);
      const libre = ['#8b5cf6','#14b8a6','#e0708f','#b9875a','#0ea5e9','#84cc16','#d4cc9e'].find(c => !usados.includes(c)) || '#8b5cf6';
      a.columnas.push({ id:nuevoId('c'), nombre:v, color:libre, visible:true, hecha:false });
      await this.guardar(); this.columnas(); pintarTodo(); toast('🗂️ Columna «'+v+'» creada');
    };
  },

  /* Personas (nombre, apellidos, email) */
  personas(){
    const cont = $('#ajPersonas');
    const l = App.personas.slice().sort((a,b) => nombreP(a).localeCompare(nombreP(b)));
    const tb = (typeof Nube !== 'undefined' && Nube.activa) ? Nube.tablero : null;
    const acceso = p => { if(!tb || !p.email) return ''; const em = p.email.toLowerCase();
      if(em === tb.duenoEmail || Nube.aceptados(tb).includes(em)) return ' · ✅ en el tablero';
      if((tb.miembros||[]).includes(em)) return ' · ⏳ invitada'; return ' · sin acceso'; };
    const puedeInvitar = p => tb && Nube.esDueno(tb) && p.email && !(tb.miembros||[]).includes(p.email.toLowerCase());
    cont.innerHTML = `<div class="aj-sec"><h4>Personas ${tb ? 'de «' + esc(Nube.nombreTablero(tb)) + '»' : 'para asignar tareas'}</h4><p class="aj-ayuda">${tb ? 'Se apuntan solas cuando compartes el tablero o alguien acepta tu invitación. También puedes añadir a alguien solo para asignarle tareas y enviarle emails.' : 'Al asignar una tarea a alguien con email, puedes enviársela por email.'}</p>
      ${l.map(p => { const n = App.tareas.filter(t => t.personaId === p.id).length;
        return `<div class="per-fila" data-id="${p.id}"><span class="avatar" style="background:${colorPersona(p)}">${esc(iniciales(p))}</span><div><b>${esc(nombreP(p))}</b><small>${esc(p.email||'sin email')} · ${n} tarea${n===1?'':'s'}${acceso(p)}</small></div>${puedeInvitar(p) ? '<button class="ico-b" data-a="inv" title="Invitar al tablero">📬</button>' : ''}<button class="ico-b" data-a="edit">✏️</button><button class="ico-b peligro" data-a="del">🗑</button></div>`; }).join('') || '<div class="vacio" style="margin-bottom:10px">Aún no hay nadie. Añade a las personas con las que repartes tareas.</div>'}
      <button class="btn-pri btn-ancho" id="ajNuevaP">＋ Añadir persona</button>
      ${tb && Nube.esDueno(tb) ? '<button class="btn-sec btn-ancho" id="ajCompartir">👥 Compartir un tablero con alguien</button>' : ''}</div>`;
    const bc = $('#ajCompartir'); if(bc) bc.onclick = () => Nube.compartir();
    $('#ajNuevaP').onclick = async () => { if(await formPersona()){ this.personas(); pintarTodo(); } };
    $$('.per-fila', cont).forEach(f => f.querySelectorAll('[data-a]').forEach(b => b.onclick = async () => {
      const p = persona(f.dataset.id);
      if(b.dataset.a === 'edit'){ if(await formPersona(p)){ this.personas(); pintarTodo(); } return; }
      if(b.dataset.a === 'inv'){ await Nube.compartir(Nube.tid, p); this.personas(); return; }
      if(!await popConfirmar('¿Quitar a '+p.nombre+'?', 'Sus tareas se quedarán sin asignar.', 'Quitar')) return;
      App.personas = App.personas.filter(x => x.id !== p.id); await DB.borrar('personas', p.id);
      for(const t of App.tareas.filter(t => t.personaId === p.id)){ t.personaId = ''; await guardarTarea(t); }
      if(App.filtro === 'p:'+p.id) App.filtro = 'todas';
      this.personas(); pintarTodo();
    }));
  },

  /* 🎉 Al acabar una tarea */
  fiesta(){
    const a = App.ajustes; a.fiesta = Fiesta.cfg(); const f = a.fiesta, cont = $('#ajFiesta');
    const seg = (id, ops, val) => `<div class="seg" id="${id}">${ops.map(([v,t]) => `<button data-v="${v}" class="${String(v)===String(val)?'on':''}">${t}</button>`).join('')}</div>`;
    const chk = (id, on, txt, sub) => `<label class="check" style="margin-top:0"><input type="checkbox" id="${id}" ${on?'checked':''}><span class="caja"></span><span>${txt}${sub ? '<small>' + sub + '</small>' : ''}</span></label>`;
    const auto = { 'es':'¡Muy bien!', 'ca':'Molt bé!', 'en':'Congratulations!' }[(a.idiomaVoz||'es').slice(0,2)];
    cont.innerHTML = `
      <div class="aj-sec"><h4>Fiesta al acabar una tarea</h4><div class="aj-fila">${chk('fsOn', f.activa, '🎉 Confeti y mensaje', 'Cuando una tarea pasa a «Acabada»')}</div></div>
      <div class="aj-sec"><h4>Cuánto dura el confeti</h4>${seg('fsSeg', [[3,'3 s'],[5,'5 s'],[8,'8 s'],[12,'12 s']], f.segundos)}</div>
      <div class="aj-sec"><h4>Mensaje</h4>
        <input id="fsMsg" class="nom" style="width:100%;height:46px;border-radius:13px;border:2px solid var(--line);background:var(--colbg);padding:0 12px;font-size:16px;font-weight:800" maxlength="30" placeholder="Automático: ${esc(auto)}" value="${esc(f.mensaje||'')}">
        <p class="aj-ayuda" style="margin-top:6px">Vacío = según el idioma (Configuración → Más): «¡Muy bien!», «Molt bé!» o «Congratulations!».</p></div>
      <div class="aj-sec"><div class="aj-fila">${chk('fsMus', f.musica, '🎺 Musiquita de enhorabuena', 'Suena con el confeti (si el móvil no está en silencio)')}</div></div>
      <div class="aj-sec"><h4>📧 Email de enhorabuena</h4>${seg('fsMail', [['preguntar','Preguntar'],['siempre','Siempre'],['nunca','Nunca']], f.email)}
        <p class="aj-ayuda" style="margin-top:6px">Se envía a las personas del tablero (menos a ti) diciendo que la tarea ya está acabada.</p></div>
      <button class="btn-pri btn-ancho" id="fsProbar">🎉 Probar ahora</button>`;
    const g = async () => { await this.guardar(); };
    $('#fsOn').onchange = e => { f.activa = e.target.checked; g(); };
    $('#fsMus').onchange = e => { f.musica = e.target.checked; g(); };
    $('#fsMsg').onchange = e => { f.mensaje = e.target.value.trim(); g(); };
    $$('#fsSeg button').forEach(b => b.onclick = () => { f.segundos = +b.dataset.v; g(); this.fiesta(); });
    $$('#fsMail button').forEach(b => b.onclick = () => { f.email = b.dataset.v; g(); this.fiesta(); });
    $('#fsProbar').onclick = () => { f.mensaje = $('#fsMsg').value.trim(); g(); cerrar('ajustes'); Fiesta.despertar(); if(f.activa) Fiesta.confeti(f.segundos); else Fiesta.soloMensaje(); if(f.musica) Fiesta.musica(); };
  },

  /* Más opciones */
  mas(){
    const a = App.ajustes, cont = $('#ajMas');
    const seg = (id, ops, val) => `<div class="seg" id="${id}">${ops.map(([v,t]) => `<button data-v="${v}" class="${v===val?'on':''}">${t}</button>`).join('')}</div>`;
    cont.innerHTML = `
      <div class="aj-sec"><h4>Idioma del micrófono</h4>${seg('ajVoz', [['es-ES','Castellano'],['ca-ES','Català'],['en-GB','English']], a.idiomaVoz)}
        <p class="aj-ayuda">Puedes decir «coma», «punto», «punto y aparte», «nueva línea».</p></div>
      <div class="aj-sec"><h4>Calidad de las fotos</h4>${seg('ajFoto', [['ligera','Ligera'],['normal','Normal'],['alta','Alta']], a.calidadFoto)}
        <p class="aj-ayuda">Ligera ≈ 150 KB · Normal ≈ 300 KB · Alta ≈ 700 KB por foto (una foto del móvil sin aligerar suele pesar 3-5 MB).</p></div>
      <div class="aj-sec"><h4>Calidad de los vídeos</h4>${seg('ajVid', [['ligera','Ligera'],['normal','Normal'],['alta','Alta']], a.calidadVideo)}
        <p class="aj-ayuda">Ligera ≈ 5 MB/min · Normal ≈ 10 MB/min · Alta ≈ 19 MB/min (un vídeo del iPhone sin aligerar pesa 60-170 MB/min).</p></div>
      <div class="aj-sec"><h4>Firma de los emails</h4><input id="ajFirma" class="nom" style="width:100%;height:46px;border-radius:13px;border:2px solid var(--line);background:var(--colbg);padding:0 12px;font-size:16px;font-weight:700" placeholder="Por ejemplo: Elisabeth" value="${esc(a.firma||'')}"></div>
      <div class="pie-copy">PorHacer ${VERSION} · © Copy</div>`;
    const enlazar = (id, k) => $$('#'+id+' button').forEach(b => b.onclick = async () => { a[k] = b.dataset.v; await this.guardar(); this.mas(); });
    enlazar('ajVoz','idiomaVoz'); enlazar('ajFoto','calidadFoto'); enlazar('ajVid','calidadVideo');
    $('#ajFirma').onchange = async e => { a.firma = e.target.value.trim(); await this.guardar(); };
  }
};
