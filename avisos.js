/* PorHacer · avisos con sonido
   Cada tarea puede tener 2 avisos tuyos (día y hora). Cuando llega la hora
   suena una campanita y sale una ventana: Cerrar, Posponer 10 min o Ir a la tarea.
   Suena mientras la app esté abierta (en el ordenador, aunque esté en otra pestaña).
   Los avisos son de quien los pone: si compartes la tarea, a los demás no les suena. */

const Avisos = {
  yo(){ return (typeof Nube !== 'undefined' && Nube.user) ? Nube.email() : ''; },
  mio(a){ return !a.de || a.de === this.yo(); },
  mios(t){ return (t.avisos || []).filter(a => this.mio(a)); },
  // el próximo aviso pendiente (para la etiqueta de la tarjeta)
  proximo(t){ return this.mios(t).filter(a => !a.sonado && a.f).sort((a, b) => a.f.localeCompare(b.f))[0] || null; },
  txt(f){
    const d = new Date(f), hoy = new Date(), man = new Date(); man.setDate(man.getDate() + 1);
    const h = d.toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' });
    if(d.toDateString() === hoy.toDateString()) return 'hoy ' + h;
    if(d.toDateString() === man.toDateString()) return 'mañana ' + h;
    return d.toLocaleDateString('es-ES', { day:'numeric', month:'short' }) + ' ' + h;
  },
  largo(f){ const d = new Date(f); return d.toLocaleDateString('es-ES', { weekday:'long', day:'numeric', month:'long' }) + ' a las ' + d.toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' }); },

  /* ---------- En el editor ---------- */
  pintarEditor(t){
    const l = this.mios(t).slice(0, 2);
    [1, 2].forEach(n => {
      const a = l[n - 1], i = $('#edAviso' + n);
      i.value = a ? a.f : ''; i.dataset.id = a ? a.id : '';
      $('#edAvisoInfo' + n).textContent = a && a.sonado ? '✓ Ya sonó' : '';
    });
    this.marcar();
  },
  marcar(){ [1, 2].forEach(n => { const i = $('#edAviso' + n); i.parentNode.classList.toggle('vacia', !i.value); }); },
  leerEditor(t, previa){
    const antes = (previa && previa.avisos) || t.avisos || [];
    const otros = (t.avisos || []).filter(a => !this.mio(a));
    const mios = [];
    [1, 2].forEach(n => {
      const i = $('#edAviso' + n), f = i.value; if(!f) return;
      const ya = antes.find(a => a.id === i.dataset.id && a.f === f);
      mios.push(ya ? { ...ya } : { id:nuevoId('av'), f, de:this.yo() });
    });
    t.avisos = otros.concat(mios);
    if(!t.avisos.length) delete t.avisos;
  },
  cambios(a, b){
    const c = [], fa = this.mios(a).map(x => x.f), fb = this.mios(b).map(x => x.f);
    fb.filter(f => !fa.includes(f)).forEach(f => c.push('⏰ Aviso con sonido: ' + this.txt(f)));
    fa.filter(f => !fb.includes(f)).forEach(f => c.push('🔕 Aviso quitado: ' + this.txt(f)));
    return c;
  },
  pedirPermiso(){
    try{ if('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); }catch(e){}
  },

  /* ---------- Vigilar la hora ---------- */
  cola: [], abierto: false,
  sonados(){ try{ return JSON.parse(lsGet('ph-avisos-sonados') || '[]'); }catch(e){ return []; } },
  apuntarSonado(id){ const l = this.sonados(); if(!l.includes(id)){ l.push(id); lsSet('ph-avisos-sonados', JSON.stringify(l.slice(-300))); } },
  iniciar(){
    setInterval(() => this.mirar(), 15000);
    document.addEventListener('visibilitychange', () => { if(!document.hidden) this.mirar(); });
    setTimeout(() => this.mirar(), 4000);
  },
  async mirar(){
    const ahora = Date.now(), ya = this.sonados();
    for(const t of App.tareas){
      for(const a of this.mios(t)){
        if(a.sonado || !a.f || ya.includes(a.id)) continue;
        const cuando = new Date(a.f).getTime(); if(isNaN(cuando) || cuando > ahora) continue;
        this.apuntarSonado(a.id);
        a.sonado = ahora; await guardarTarea(t).catch(() => {});
        if(ahora - cuando < 12 * 3600e3) this.cola.push({ tid:t.id, aviso:{ ...a }, tarde: ahora - cuando > 120e3 });
      }
    }
    this.siguiente();
  },
  siguiente(){
    if(this.abierto || !this.cola.length) return;
    const x = this.cola.shift(), t = App.tareas.find(z => z.id === x.tid);
    if(!t){ this.siguiente(); return; }
    this.mostrar(t, x.aviso, x.tarde);
  },

  /* ---------- Sonido ---------- */
  campana(){
    try{
      Fiesta.despertar(); const ac = Fiesta._ac; if(!ac) return;
      const t0 = ac.currentTime + 0.05;
      const nota = (f, t, d, vol) => {
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t0 + t); g.gain.exponentialRampToValueAtTime(vol, t0 + t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + t + d);
        o.connect(g); g.connect(ac.destination); o.start(t0 + t); o.stop(t0 + t + d + 0.05);
      };
      // din-don, din-don, din-don
      for(let r = 0; r < 3; r++){ const b = r * 1.4; nota(1318.5, b, 1.1, .22); nota(2637, b, .5, .05); nota(1046.5, b + .42, 1.3, .22); nota(2093, b + .42, .5, .05); }
    }catch(e){}
    try{ navigator.vibrate && navigator.vibrate([300, 150, 300, 150, 300]); }catch(e){}
  },
  notificar(t, a){
    if(!document.hidden || !('Notification' in window) || Notification.permission !== 'granted') return;
    const op = { body:(t.titulo || 'Tarea') + ' · ' + this.txt(a.f), icon:'icon-192.png', tag:'aviso-' + a.id, requireInteraction:true };
    try{
      if(navigator.serviceWorker && navigator.serviceWorker.controller) navigator.serviceWorker.ready.then(r => r.showNotification('⏰ PorHacer', op)).catch(() => { new Notification('⏰ PorHacer', op); });
      else { const n = new Notification('⏰ PorHacer', op); n.onclick = () => { window.focus(); n.close(); }; }
    }catch(e){}
  },

  /* ---------- La ventana ---------- */
  mostrar(t, a, tarde){
    this.abierto = true;
    this.campana(); this.notificar(t, a);
    let caja = $('#avisoPop');
    if(!caja){ caja = document.createElement('div'); caja.id = 'avisoPop'; document.body.appendChild(caja); }
    const col = colDe(t.colId), notas = (t.notas || '').trim();
    const tb = (typeof Nube !== 'undefined' && Nube.activa && Nube.tablero) ? Nube.nombreTablero(Nube.tablero) : '';
    caja.innerHTML = `<div class="ap-fondo"></div><div class="ap-caja" role="alertdialog" aria-label="Recordatorio">
      <div class="ap-campana"><span>🔔</span></div>
      <div class="ap-tit">¡Recordatorio!</div>
      <div class="ap-hora">${tarde ? 'Era para ' : ''}${esc(this.largo(a.f))}</div>
      <div class="ap-tarea" style="--c:${esc(t.color || '#ffffff')};--b:${esc(col.color)}">
        <b>${esc(t.titulo || 'Sin título')}</b>
        ${notas ? `<p>${notas.length > 160 ? esc(notas.slice(0, 160)) + '…' : notaHtml(t)}</p>` : ''}
        <span class="ap-col"><i></i>${esc(col.nombre)}${tb ? ' · 📋 ' + esc(tb) : ''}</span>
      </div>
      <div class="ap-btns">
        <button class="btn-sec" data-a="cerrar">Cerrar</button>
        <button class="btn-sec" data-a="pos">😴 10 min</button>
        <button class="btn-pri" data-a="ir">Ir a la tarea</button>
      </div></div>`;
    requestAnimationFrame(() => caja.classList.add('on'));
    const fin = () => { caja.classList.remove('on'); this.abierto = false; setTimeout(() => this.siguiente(), 400); };
    caja.querySelector('[data-a=cerrar]').onclick = fin;
    caja.querySelector('.ap-fondo').onclick = () => {};
    caja.querySelector('[data-a=pos]').onclick = async () => {
      const d = new Date(Date.now() + 10 * 60e3), f = iso(d) + 'T' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
      const o = App.tareas.find(z => z.id === t.id);
      if(o){ o.avisos = (o.avisos || []).filter(z => z.id !== a.id); o.avisos.push({ id:nuevoId('av'), f, de:this.yo() }); anotar(o, '😴 Aviso pospuesto 10 minutos'); await guardarTarea(o); pintarTodo(); }
      toast('😴 Te lo recuerdo a las ' + d.toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' }));
      fin();
    };
    caja.querySelector('[data-a=ir]').onclick = () => {
      fin();
      if(App.ed && App.ed.t && App.ed.t.id !== t.id){ toast('✏️ Cierra antes la tarea que tienes abierta'); return; }
      if(!App.ed) abrirEditor(t.id);
    };
  }
};
