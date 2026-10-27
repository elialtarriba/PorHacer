/* PorHacer · dictado por voz (micrófono)
   Pulsas el micro, hablas y se va escribiendo. Vuelves a pulsar para parar.
   Puedes decir «coma», «punto», «punto y aparte», «nueva línea»
   (en catalán: «coma», «punt», «punt i a part», «línia nova»). */

const Voz = {
  rec: null, activo: null, base: '', final: '',
  soportado(){ return !!(window.SpeechRecognition || window.webkitSpeechRecognition); },

  _limpiar(t, idioma){
    const ca = idioma.startsWith('ca');
    const reglas = ca
      ? [[/\s*punt i a part\s*/gi, '.\n'], [/\s*l[ií]nia nova\s*/gi, '\n'], [/\s*coma\b/gi, ','], [/\s*\bpunt\b/gi, '.'], [/\s*interrogant\b/gi, '?']]
      : [[/\s*punto y aparte\s*/gi, '.\n'], [/\s*nueva l[ií]nea\s*/gi, '\n'], [/\s*\bcoma\b/gi, ','], [/\s*\bpunto\b/gi, '.'], [/\s*interrogaci[oó]n\b/gi, '?']];
    for(const [a,b] of reglas) t = t.replace(a, b);
    return t.replace(/([.?!]\s+|\n)([a-záéíóúàèòïüç])/g, (m,p,l) => p + l.toUpperCase());
  },

  parar(){
    if(this.rec){ try{ this.rec.stop(); }catch(e){} }
  },

  empezar(campo, boton, estado){
    if(!this.soportado()){
      popAviso('Micrófono', 'Este navegador no permite dictar. En iPhone funciona en Safari; en Android, en Chrome.');
      return;
    }
    if(this.activo){ const mismo = this.activo.campo === campo; this.parar(); if(mismo) return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const idioma = (App.ajustes && App.ajustes.idiomaVoz) || 'es-ES';
    const r = new SR();
    r.lang = idioma; r.continuous = true; r.interimResults = true;
    this.rec = r;
    this.activo = { campo, boton };
    this.base = campo.value;
    if(this.base && !/\s$/.test(this.base)) this.base += ' ';
    this.final = '';
    boton.classList.add('oyendo');
    if(estado) estado.textContent = '🎙️ Te escucho… pulsa otra vez el micro para parar';

    r.onresult = ev => {
      let interino = '';
      for(let i = ev.resultIndex; i < ev.results.length; i++){
        const t = ev.results[i][0].transcript;
        if(ev.results[i].isFinal) this.final += t + ' ';
        else interino += t;
      }
      let texto = this._limpiar(this.final + interino, idioma).replace(/ +([,.?])/g,'$1');
      if(!this.base.trim() && texto) texto = texto.charAt(0).toUpperCase() + texto.slice(1);
      campo.value = this.base + texto;
      campo.dispatchEvent(new Event('input', { bubbles:true }));
      if(campo.tagName === 'TEXTAREA') campo.scrollTop = campo.scrollHeight;
    };
    r.onerror = ev => {
      if(ev.error === 'not-allowed' || ev.error === 'service-not-allowed')
        popAviso('Micrófono', 'Hay que dar permiso al micrófono en el navegador para poder dictar.');
    };
    r.onend = () => {
      boton.classList.remove('oyendo');
      if(estado) estado.textContent = '';
      campo.value = campo.value.replace(/\s+$/,'');
      campo.dispatchEvent(new Event('input', { bubbles:true }));
      this.activo = null; this.rec = null;
    };
    try{ r.start(); }catch(e){ boton.classList.remove('oyendo'); }
  }
};
