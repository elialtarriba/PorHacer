/* PorHacer · ¡fiesta al acabar una tarea!
   Confeti por toda la pantalla, un mensaje grande («¡Muy bien!», «Molt bé!»,
   «Congratulations!» o el que tú pongas), una musiquita y, si quieres,
   un email de enhorabuena a las personas del tablero.
   Todo se activa, desactiva y ajusta en Configuración → 🎉 Al acabar.      */

const Fiesta = {
  inicio(){ return { activa:true, segundos:5, musica:true, mensaje:'', email:'preguntar' }; },
  cfg(){ return Object.assign(this.inicio(), App.ajustes.fiesta || {}); },
  mensaje(){
    const c = this.cfg(); if(c.mensaje && c.mensaje.trim()) return c.mensaje.trim();
    const l = (App.ajustes.idiomaVoz || 'es-ES').slice(0, 2);
    return l === 'ca' ? 'Molt bé!' : l === 'en' ? 'Congratulations!' : '¡Muy bien!';
  },

  // El iPhone solo deja sonar si el sonido se «despierta» con un toque
  _ac: null,
  despertar(){
    try{
      if(!this._ac){ const AC = window.AudioContext || window.webkitAudioContext; if(AC) this._ac = new AC(); }
      if(this._ac && this._ac.state === 'suspended') this._ac.resume();
    }catch(e){}
  },
  musica(){
    this.despertar(); const ac = this._ac; if(!ac) return;
    const t0 = ac.currentTime + 0.05;
    const nota = (f, t, d, vol=0.18, tipo='triangle') => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = tipo; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0 + t);
      g.gain.exponentialRampToValueAtTime(vol, t0 + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + t + d);
      o.connect(g); g.connect(ac.destination); o.start(t0 + t); o.stop(t0 + t + d + 0.05);
    };
    // ta-ta-ta-tááán 🎺
    [[523.25,0,.16],[659.25,.15,.16],[783.99,.30,.16],[1046.5,.45,.5]].forEach(([f,t,d]) => nota(f, t, d));
    [523.25, 659.25, 783.99, 1046.5].forEach(f => nota(f, .95, 1.1, .09));
    [1318.5, 1568].forEach((f, i) => nota(f, 1.0 + i*0.08, .5, .05, 'sine'));
  },

  _vivo: false,
  celebrar(t){
    const c = this.cfg();
    if(c.activa && !this._vivo) this.confeti(c.segundos);
    if(c.activa && c.musica) this.musica();
    if(c.email !== 'nunca') setTimeout(() => this.emailEnhorabuena(t, c.email), c.activa ? Math.min(6, c.segundos) * 1000 + 300 : 300);
  },

  confeti(segundos){
    const cv = $('#confeti'), msg = $('#fiestaMsg');
    if(!cv || matchMedia('(prefers-reduced-motion: reduce)').matches){ this.soloMensaje(); return; }
    this._vivo = true;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = innerWidth, H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr; cv.style.opacity = 1; cv.classList.add('on');
    const cx = cv.getContext('2d'); cx.scale(dpr, dpr);
    const raiz = getComputedStyle(document.documentElement);
    const tema = ['--accent','--accent2','--dark'].map(v => raiz.getPropertyValue(v).trim()).filter(Boolean);
    const colores = [...tema, '#ff4d6d','#ffb703','#06d6a0','#3a86ff','#8338ec','#fb5607','#ffd60a','#2ec4b6','#f15bb5'];
    const dur = Math.max(2, Math.min(15, +segundos || 5)) * 1000;
    const P = [], MAX = Math.round(Math.min(1100, W * H / 650));
    const nuevo = () => ({ x: Math.random() * W, y: -20 - Math.random() * 60, w: 6 + Math.random() * 8, h: 8 + Math.random() * 12,
      vy: 1.6 + Math.random() * 2.8, vx: -1 + Math.random() * 2, giro: Math.random() * 6.28, vg: -0.15 + Math.random() * 0.3,
      osc: Math.random() * 6.28, forma: Math.random() < .2 ? 'c' : Math.random() < .25 ? 't' : 'r', col: colores[(Math.random() * colores.length) | 0], suelo: H - 4 - Math.random() * H * 0.35 });
    const t0 = performance.now();
    let mostrado = false, cerrar = false;
    const tocar = () => { cerrar = true; };
    cv.addEventListener('pointerdown', tocar, { once:true });
    const frame = now => {
      const t = now - t0;
      // cada vez cae más confeti, hasta llenar la pantalla
      if(t < dur * 0.85 && P.length < MAX){ const n = Math.ceil(6 + 30 * Math.min(1, t / (dur * 0.5))); for(let i = 0; i < n && P.length < MAX; i++) P.push(nuevo()); }
      cx.clearRect(0, 0, W, H);
      for(const p of P){
        if(p.y < p.suelo){ p.osc += 0.05; p.x += p.vx + Math.sin(p.osc) * 0.8; p.y += p.vy; p.giro += p.vg; }
        else { p.vg *= 0.9; }
        cx.save(); cx.translate(p.x, p.y); cx.rotate(p.giro); cx.fillStyle = p.col;
        const sx = Math.abs(Math.cos(p.osc * 1.3)) * 0.7 + 0.3;      // da la vuelta como un papelito
        if(p.forma === 'c'){ cx.beginPath(); cx.arc(0, 0, p.w * 0.45, 0, 6.28); cx.fill(); }
        else if(p.forma === 't'){ cx.beginPath(); cx.moveTo(0, -p.h/2); cx.lineTo(p.w/2, p.h/2); cx.lineTo(-p.w/2, p.h/2); cx.fill(); }
        else cx.fillRect(-p.w/2 * sx, -p.h/2, p.w * sx, p.h);
        cx.restore();
      }
      if(!mostrado && t > dur * 0.45){ mostrado = true; this.mostrarMensaje(); }
      if(t > dur || cerrar){
        cv.style.opacity = 0; msg.classList.remove('on'); msg.classList.add('fuera');
        setTimeout(() => { cv.classList.remove('on'); cx.clearRect(0, 0, W, H); msg.classList.remove('fuera'); this._vivo = false; }, 600);
        cv.removeEventListener('pointerdown', tocar);
        return;
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  },
  mostrarMensaje(){
    const msg = $('#fiestaMsg');
    const txt = this.mensaje();
    msg.innerHTML = `<div class="fm-caja"><div class="fm-emoji">🎉</div><div class="fm-txt">${[...txt].map((ch, i) => `<span style="animation-delay:${i * 45}ms">${ch === ' ' ? '&nbsp;' : esc(ch)}</span>`).join('')}</div><div class="fm-sub">✓ Tarea acabada</div></div>`;
    msg.classList.remove('fuera'); void msg.offsetWidth; msg.classList.add('on');
  },
  soloMensaje(){ this.mostrarMensaje(); setTimeout(() => $('#fiestaMsg').classList.remove('on'), 2500); },

  // Email de enhorabuena a las personas del tablero
  destinatarios(t){
    const yo = (typeof Nube !== 'undefined' && Nube.user) ? Nube.email() : '';
    let emails;
    if(typeof Nube !== 'undefined' && Nube.activa && Nube.tablero){
      const tb = Nube.tablero, dentro = new Set([tb.duenoEmail, ...Nube.aceptados(tb)].map(e => (e||'').toLowerCase()));
      emails = [...dentro];
    } else {
      const p = persona(t.personaId); emails = p && p.email ? [p.email.toLowerCase()] : [];
    }
    return emails.filter(e => e && e !== yo).map(e => App.personas.find(p => (p.email||'').toLowerCase() === e) || { nombre:e.split('@')[0], email:e });
  },
  async emailEnhorabuena(t, modo){
    const lista = this.destinatarios(t);
    if(!lista.length) return;
    if(modo === 'preguntar'){
      const v = await popup({ tit:'🎉 ¿Avisamos a los demás?',
        html:`<p>Puedo enviar un email de enhorabuena por <b>«${esc(t.titulo)}»</b> a:</p><p style="margin-top:6px">${lista.map(p => '👤 <b>' + esc(nombreP(p) || p.email) + '</b>').join('<br>')}</p>`,
        botones:[{ txt:'No, gracias', val:false }, { txt:'📧 Enviar', cls:'btn-pri', val:true }] });
      if(!v) return;
    }
    Correo.enhorabuena(t, lista);
  }
};
document.addEventListener('pointerdown', () => Fiesta.despertar(), { once:true, capture:true });
