/* PorHacer · dictado por voz (micrófono)
   Pulsas el micro, hablas y se va escribiendo. Vuelves a pulsar para parar.
   Puedes decir «coma», «punto», «punto y aparte», «nueva línea»
   (en catalán: «coma», «punt», «punt i a part», «línia nova»). */

const Voz = {
  activo: null,
  soportado(){ return !!(window.SpeechRecognition || window.webkitSpeechRecognition); },

  _limpiar(t, idioma){
    const ca = idioma.startsWith('ca');
    const reglas = ca
      ? [[/\s*punt i a part\s*/gi, '.\n'], [/\s*l[ií]nia nova\s*/gi, '\n'], [/\s*coma\b/gi, ','], [/\s*\bpunt\b/gi, '.'], [/\s*interrogant\b/gi, '?']]
      : [[/\s*punto y aparte\s*/gi, '.\n'], [/\s*nueva l[ií]nea\s*/gi, '\n'], [/\s*\bcoma\b/gi, ','], [/\s*\bpunto\b/gi, '.'], [/\s*interrogaci[oó]n\b/gi, '?']];
    for(const [a,b] of reglas) t = t.replace(a, b);
    return t.replace(/([.?!]\s+|\n)([a-záéíóúàèòïüç])/g, (m,p,l) => p + l.toUpperCase());
  },

  // Para el micro. La pantalla se actualiza YA, sin esperar al navegador
  // (en el iPhone, a veces el reconocimiento tarda o no avisa al terminar).
  parar(){
    const ses = this.activo; if(!ses) return;
    this.activo = null;
    ses.parado = true;
    this._apagar(ses);
    try{ ses.rec.stop(); }catch(e){}
    // si en 1,5 s no ha terminado del todo, se corta
    ses.corte = setTimeout(() => { try{ ses.rec.abort(); }catch(e){} }, 1500);
  },
  _apagar(ses){
    ses.boton.classList.remove('oyendo');
    if(ses.estado && ses.estado.dataset.de === ses.id) ses.estado.textContent = '';
    const c = ses.campo; c.value = c.value.replace(/[ \t]+$/,'');
    c.dispatchEvent(new Event('input', { bubbles:true }));
  },

  empezar(campo, boton, estado){
    if(!this.soportado()){
      popAviso('Micrófono', 'Este navegador no permite dictar. En iPhone funciona en Safari; en Android, en Chrome.');
      return;
    }
    // Si ya está escuchando: se para (y si era otro campo, se empieza en el nuevo)
    if(this.activo){ const mismo = this.activo.campo === campo; this.parar(); if(mismo) return; }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const idioma = (App.ajustes && App.ajustes.idiomaVoz) || 'es-ES';
    const r = new SR();
    r.lang = idioma; r.continuous = true; r.interimResults = true;
    let base = campo.value; if(base && !/\s$/.test(base)) base += ' ';
    const ses = { id: String(Date.now()), rec:r, campo, boton, estado, base, final:'', parado:false };
    this.activo = ses;
    boton.classList.add('oyendo');
    if(estado){ estado.dataset.de = ses.id; estado.textContent = '🎙️ Te escucho… pulsa otra vez el micro para parar'; }

    r.onresult = ev => {
      let interino = '';
      for(let i = ev.resultIndex; i < ev.results.length; i++){
        const t = ev.results[i][0].transcript;
        if(ev.results[i].isFinal) ses.final += t + ' ';
        else interino += t;
      }
      // al parar, solo se guarda lo que ya es definitivo
      let texto = this._limpiar(ses.final + (ses.parado ? '' : interino), idioma).replace(/ +([,.?])/g,'$1');
      if(!ses.base.trim() && texto) texto = texto.charAt(0).toUpperCase() + texto.slice(1);
      campo.value = ses.base + texto;
      campo.dispatchEvent(new Event('input', { bubbles:true }));
      if(campo.tagName === 'TEXTAREA') campo.scrollTop = campo.scrollHeight;
    };
    r.onerror = ev => {
      if(ev.error === 'not-allowed' || ev.error === 'service-not-allowed')
        popAviso('Micrófono', 'Hay que dar permiso al micrófono en el navegador para poder dictar.');
    };
    r.onend = () => {
      clearTimeout(ses.corte);
      if(this.activo === ses) this.activo = null;     // terminó solo (silencio largo)
      this._apagar(ses);
    };
    try{ r.start(); }catch(e){ this.activo = null; this._apagar(ses); }
  }
};
