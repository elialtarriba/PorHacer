/* PorHacer · notas de audio
   Pulsas «Grabar», hablas, pulsas «Parar», lo escuchas y decides:
   Guardar, Repetir o Cancelar. Se guarda como .mp3 ligero (voz, una sola
   pista), en su propio almacén («PorHacer-audios").                       */

const Audios = {
  _lame: null,
  async cargarLame(){
    if(window.lamejs) return true;
    try{ await cargarScript('lame.min.js'); return !!window.lamejs; }catch(e){ return false; }
  },
  // Convierte lo grabado a MP3 (mono, 22 kHz, 48 kbps ≈ 360 KB por minuto)
  async aMp3(blob){
    if(!await this.cargarLame()) return null;
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = new AC();
    const buf = await new Promise((ok, mal) => {
      blob.arrayBuffer().then(ab => { const p = ctx.decodeAudioData(ab, ok, mal); if(p && p.then) p.then(ok, mal); }, mal);
    });
    ctx.close && ctx.close();
    const SR = 22050;
    const off = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, Math.ceil(buf.duration * SR), SR);
    const src = off.createBufferSource(); src.buffer = buf; src.connect(off.destination); src.start(0);
    const ren = await new Promise((ok, mal) => { off.oncomplete = e => ok(e.renderedBuffer); const p = off.startRendering(); if(p && p.then) p.then(ok, mal); });
    const f = ren.getChannelData(0), n = f.length;
    const pcm = new Int16Array(n);
    for(let i = 0; i < n; i++){ const v = Math.max(-1, Math.min(1, f[i])); pcm[i] = v < 0 ? v * 0x8000 : v * 0x7FFF; }
    const enc = new lamejs.Mp3Encoder(1, SR, 48), trozos = [];
    for(let i = 0; i < n; i += 1152){ const b = enc.encodeBuffer(pcm.subarray(i, i + 1152)); if(b.length) trozos.push(new Uint8Array(b)); }
    const fin = enc.flush(); if(fin.length) trozos.push(new Uint8Array(fin));
    return { blob: new Blob(trozos, { type:'audio/mpeg' }), dur: buf.duration };
  },

  // Ventana de grabación. Devuelve true si se ha guardado un audio.
  async grabar(tareaId){
    if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === 'undefined'){
      popAviso('Grabar audio', 'Este navegador no permite grabar audio. En el iPhone, usa Safari actualizado.');
      return false;
    }
    let stream;
    try{ stream = await navigator.mediaDevices.getUserMedia({ audio:true }); }
    catch(e){ popAviso('Micrófono', 'Hay que dar permiso al micrófono para grabar notas de audio.'); return false; }

    let rec = null, trozos = [], t0 = 0, reloj = null, grabado = null, urlPrev = null, estado = 'listo';
    const tipos = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg'];
    const mime = tipos.find(t => { try{ return MediaRecorder.isTypeSupported(t); }catch(e){ return false; } }) || '';

    const resultado = await popup({ tit:'🎙️ Nota de audio',
      html:`<div class="grab">
        <div class="grab-tiempo" id="grT">0:00</div>
        <div class="grab-ondas" id="grO"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
        <button class="grab-btn" id="grB" aria-label="Grabar"><span></span></button>
        <div class="grab-txt" id="grX">Pulsa el botón rojo para empezar a grabar</div>
        <audio id="grA" controls hidden></audio>
        <button class="mini-btn" id="grR" hidden>🔁 Repetir</button>
      </div>`,
      botones:[{txt:'Cancelar', val:false}, {txt:'Guardar', cls:'btn-pri', val:'guardar', validar:() => { if(estado !== 'hecho'){ toast(estado === 'grabando' ? '⏹ Pulsa Parar antes de guardar' : '🎙️ Graba algo primero'); return false; } return true; }}],
      alAbrir:c => {
        const B = $('#grB', c), T = $('#grT', c), X = $('#grX', c), A = $('#grA', c), R = $('#grR', c), O = $('#grO', c);
        const pintar = () => {
          B.classList.toggle('rec', estado === 'grabando'); O.classList.toggle('on', estado === 'grabando');
          B.hidden = estado === 'hecho' || estado === 'pasando'; A.hidden = R.hidden = estado !== 'hecho';
          X.textContent = estado === 'grabando' ? 'Grabando… pulsa ⏹ para parar' : estado === 'pasando' ? 'Preparando el audio…' : estado === 'hecho' ? 'Escúchalo. Si te gusta, pulsa Guardar.' : 'Pulsa el botón rojo para empezar a grabar';
        };
        const empezar = () => {
          trozos = []; grabado = null;
          try{ rec = mime ? new MediaRecorder(stream, { mimeType:mime }) : new MediaRecorder(stream); }catch(e){ rec = new MediaRecorder(stream); }
          rec.ondataavailable = e => { if(e.data && e.data.size) trozos.push(e.data); };
          rec.onstop = async () => {
            clearInterval(reloj);
            estado = 'pasando'; pintar();
            const crudo = new Blob(trozos, { type: rec.mimeType || mime || 'audio/mp4' });
            const dur = (Date.now() - t0) / 1000;
            let r = null;
            try{ r = await this.aMp3(crudo); }catch(e){ console.warn('mp3', e); }
            grabado = r ? { blob:r.blob, dur:r.dur || dur, tipo:'audio/mpeg', ext:'mp3' } : { blob:crudo, dur, tipo:crudo.type, ext: crudo.type.includes('webm') ? 'webm' : 'm4a' };
            if(urlPrev) URL.revokeObjectURL(urlPrev);
            urlPrev = URL.createObjectURL(grabado.blob); A.src = urlPrev;
            T.textContent = durTxt(grabado.dur) + ' · ' + tamTxt(grabado.blob.size);
            estado = 'hecho'; pintar();
          };
          rec.start(500); t0 = Date.now(); estado = 'grabando'; pintar();
          reloj = setInterval(() => { T.textContent = durTxt((Date.now() - t0) / 1000) || '0:00'; }, 250);
        };
        B.onclick = () => { if(estado === 'grabando'){ try{ rec.stop(); }catch(e){} } else empezar(); };
        R.onclick = () => { A.pause(); T.textContent = '0:00'; estado = 'listo'; pintar(); empezar(); };
        pintar();
      } });

    try{ if(rec && rec.state !== 'inactive') rec.stop(); }catch(e){}
    clearInterval(reloj);
    stream.getTracks().forEach(t => t.stop());
    if(urlPrev) setTimeout(() => URL.revokeObjectURL(urlPrev), 1000);
    if(resultado !== 'guardar' || !grabado) return false;
    const d = new Date();
    await DB.poner('audios', { id:nuevoId('a'), tareaId, blob:grabado.blob, dur:grabado.dur, size:grabado.blob.size, original:grabado.blob.size,
      tipo:grabado.tipo, nombre:'nota-de-voz-' + iso(d) + '.' + grabado.ext, fecha:Date.now(),
      autorNombre: (typeof Nube !== 'undefined' && Nube.user) ? Nube.nombreYo() : '' });
    toast('🎙️ Nota de audio guardada (' + tamTxt(grabado.blob.size) + ')');
    return true;
  }
};
