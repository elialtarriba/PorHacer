/* PorHacer · fotos
   Cada foto se reduce de tamaño y se recomprime (JPEG) antes de guardarse,
   y se hace una miniatura pequeña para que la galería vaya rápida. */

const CALIDAD_FOTO = {
  ligera: { lado:1280, q:.72 },
  normal: { lado:1700, q:.78 },
  alta:   { lado:2400, q:.85 }
};

function _cargarImagen(file){
  return new Promise((ok, mal) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { ok(img); setTimeout(()=>URL.revokeObjectURL(url), 1000); };
    img.onerror = () => { URL.revokeObjectURL(url); mal(new Error('No se pudo leer la imagen')); };
    img.src = url;
  });
}
function _canvasABlob(cv, tipo, q){
  return new Promise(ok => cv.toBlob(b => ok(b), tipo, q));
}
async function _redimensionar(img, lado, q){
  const w0 = img.naturalWidth || img.width, h0 = img.naturalHeight || img.height;
  const k = Math.min(1, lado / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0*k)), h = Math.max(1, Math.round(h0*k));
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const cx = cv.getContext('2d');
  cx.fillStyle = '#fff'; cx.fillRect(0,0,w,h);           // por si es PNG con transparencia
  cx.imageSmoothingQuality = 'high';
  cx.drawImage(img, 0, 0, w, h);
  return { blob: await _canvasABlob(cv, 'image/jpeg', q), w, h };
}

// Devuelve el objeto foto listo para guardar
async function aligerarFoto(file, tareaId, nivel){
  const cfg = CALIDAD_FOTO[nivel] || CALIDAD_FOTO.normal;
  const img = await _cargarImagen(file);
  const grande = await _redimensionar(img, cfg.lado, cfg.q);
  const mini = await _redimensionar(img, 360, .7);
  let blob = grande.blob;
  if(file.type === 'image/jpeg' && file.size < blob.size) blob = file;   // ya era más ligera
  return {
    id: nuevoId('f'), tareaId, blob, mini: mini.blob,
    w: grande.w, h: grande.h, size: blob.size, original: file.size,
    nombre: file.name || 'foto.jpg', fecha: Date.now()
  };
}

async function guardarFotos(files, tareaId, nivel, alProgreso){
  let antes = 0, despues = 0, n = 0;
  for(const f of files){
    if(!f.type.startsWith('image/')) continue;
    alProgreso && alProgreso(++n, files.length);
    try{
      const foto = await aligerarFoto(f, tareaId, nivel);
      await DB.poner('fotos', foto);
      antes += foto.original; despues += foto.size;
    }catch(e){ console.warn(e); toast('No se pudo guardar una foto 😕'); }
  }
  return { antes, despues, n };
}
