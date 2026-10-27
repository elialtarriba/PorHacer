/* PorHacer · vídeos
   Para que no pesen, el vídeo se vuelve a grabar dentro del navegador
   a menor tamaño y calidad (lienzo + MediaRecorder). Tarda lo mismo que
   dura el vídeo. Si el navegador no puede, se ofrece guardar el original. */

const CALIDAD_VIDEO = {
  ligera: { lado:640,  bps:  700000 },
  normal: { lado:960,  bps: 1300000 },
  alta:   { lado:1280, bps: 2500000 }
};
let _videoCancelado = false;
function cancelarVideo(){ _videoCancelado = true; }

function _tipoGrabacion(){
  if(typeof MediaRecorder === 'undefined') return null;
  const tipos = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/mp4;codecs=avc1','video/mp4',
                 'video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'];
  for(const t of tipos){ try{ if(MediaRecorder.isTypeSupported(t)) return t; }catch(e){} }
  return null;
}

function _esperar(el, ev){ return new Promise((ok, mal) => {
  const f = () => { el.removeEventListener(ev, f); el.removeEventListener('error', e2); ok(); };
  const e2 = () => { el.removeEventListener(ev, f); mal(new Error('No se pudo leer el vídeo')); };
  el.addEventListener(ev, f); el.addEventListener('error', e2);
});}

async function _portada(video, w, h){
  const cv = document.createElement('canvas');
  const k = Math.min(1, 480/Math.max(w,h));
  cv.width = Math.round(w*k); cv.height = Math.round(h*k);
  cv.getContext('2d').drawImage(video, 0, 0, cv.width, cv.height);
  return new Promise(ok => cv.toBlob(b => ok(b), 'image/jpeg', .72));
}

// Devuelve { blob, poster, w, h, dur, tipo, original, size, aligerado }
async function aligerarVideo(file, nivel, alProgreso){
  _videoCancelado = false;
  const cfg = CALIDAD_VIDEO[nivel] || CALIDAD_VIDEO.normal;
  const url = URL.createObjectURL(file);
  const v = document.createElement('video');
  v.playsInline = true; v.setAttribute('playsinline',''); v.preload = 'auto'; v.src = url;
  v.style.cssText = 'position:fixed;left:-9999px;top:0;width:2px;height:2px;opacity:0';
  document.body.appendChild(v);
  const limpiar = () => { try{ v.pause(); }catch(e){} v.remove(); URL.revokeObjectURL(url); };

  try{
    await _esperar(v, 'loadedmetadata');
    const w0 = v.videoWidth || 640, h0 = v.videoHeight || 360;
    let dur = isFinite(v.duration) ? v.duration : 0;
    const k = Math.min(1, cfg.lado / Math.max(w0, h0));
    const w = Math.round(w0*k/2)*2, h = Math.round(h0*k/2)*2;

    // portada
    try{ v.currentTime = Math.min(.5, (dur||1)/3); await _esperar(v,'seeked'); }catch(e){}
    const poster = await _portada(v, w0, h0);

    const tipo = _tipoGrabacion();
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    if(!tipo || !cv.captureStream){
      limpiar();
      return { blob:file, poster, w:w0, h:h0, dur, tipo:file.type, original:file.size, size:file.size, aligerado:false };
    }
    const cx = cv.getContext('2d');
    const stream = cv.captureStream(30);

    // sonido: se lleva al grabador (no a los altavoces)
    let actx = null;
    try{
      const AC = window.AudioContext || window.webkitAudioContext;
      actx = new AC();
      const src = actx.createMediaElementSource(v);
      const dest = actx.createMediaStreamDestination();
      src.connect(dest);
      dest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
      if(actx.state === 'suspended') await actx.resume();
    }catch(e){ console.warn('sin audio', e); v.muted = true; }

    const rec = new MediaRecorder(stream, { mimeType:tipo, videoBitsPerSecond:cfg.bps, audioBitsPerSecond:64000 });
    const trozos = [];
    rec.ondataavailable = e => { if(e.data && e.data.size) trozos.push(e.data); };
    const parado = new Promise(ok => rec.onstop = ok);

    v.currentTime = 0;
    await _esperar(v, 'seeked').catch(()=>{});
    let vivo = true;
    const pintar = () => {
      if(!vivo) return;
      cx.drawImage(v, 0, 0, w, h);
      if(v.duration && isFinite(v.duration)) dur = v.duration;
      alProgreso && alProgreso(dur ? Math.min(1, v.currentTime/dur) : 0);
      if(_videoCancelado){ vivo = false; v.pause(); if(rec.state!=='inactive') rec.stop(); return; }
      if(v.requestVideoFrameCallback) v.requestVideoFrameCallback(pintar); else requestAnimationFrame(pintar);
    };
    rec.start(1000);
    try{ await v.play(); }catch(e){ v.muted = true; await v.play(); }
    pintar();
    await new Promise(ok => { v.onended = ok; const t = setInterval(()=>{ if(_videoCancelado){ clearInterval(t); ok(); } }, 300); v.addEventListener('ended', ()=>clearInterval(t), {once:true}); });
    vivo = false;
    cx.drawImage(v, 0, 0, w, h);
    if(rec.state !== 'inactive') rec.stop();
    await parado;
    stream.getTracks().forEach(t => t.stop());
    if(actx) actx.close().catch(()=>{});
    limpiar();
    if(_videoCancelado) throw new Error('cancelado');

    const blob = new Blob(trozos, { type: tipo.split(';')[0] });
    if(!blob.size || blob.size >= file.size){
      return { blob:file, poster, w:w0, h:h0, dur, tipo:file.type, original:file.size, size:file.size, aligerado:false };
    }
    return { blob, poster, w, h, dur, tipo:blob.type, original:file.size, size:blob.size, aligerado:true };
  }catch(e){
    limpiar();
    throw e;
  }
}

async function guardarVideo(file, tareaId, nivel, alProgreso){
  const r = await aligerarVideo(file, nivel, alProgreso);
  const obj = { id:nuevoId('v'), tareaId, blob:r.blob, poster:r.poster, w:r.w, h:r.h, dur:r.dur,
                tipo:r.tipo, size:r.size, original:r.original, nombre:file.name||'video', fecha:Date.now() };
  await DB.poner('videos', obj);
  return r;
}
function durTxt(s){ if(!s||!isFinite(s)) return ''; s=Math.round(s); return Math.floor(s/60)+':'+String(s%60).padStart(2,'0'); }
