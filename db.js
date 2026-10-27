/* PorHacer · almacenamiento
   Se guarda todo en el propio navegador (IndexedDB), repartido en tres
   «archivos» (bases de datos) separados para que nada se mezcle ni se llene:
     · PorHacer-datos  → tareas, personas y configuración
     · PorHacer-fotos  → fotos aligeradas
     · PorHacer-videos → vídeos aligerados                                  */

const BASES = {
  datos:  { nombre:'PorHacer-datos',  almacenes:['tareas','personas','ajustes'] },
  fotos:  { nombre:'PorHacer-fotos',  almacenes:['fotos'] },
  videos: { nombre:'PorHacer-videos', almacenes:['videos'] }
};
const _abiertas = {};

function abrirBase(clave){
  if(_abiertas[clave]) return _abiertas[clave];
  const b = BASES[clave];
  _abiertas[clave] = new Promise((ok, mal) => {
    const req = indexedDB.open(b.nombre, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      for(const a of b.almacenes){
        if(!db.objectStoreNames.contains(a)){
          const st = db.createObjectStore(a, { keyPath:'id' });
          if(a==='fotos' || a==='videos') st.createIndex('tareaId','tareaId');
        }
      }
    };
    req.onsuccess = () => ok(req.result);
    req.onerror = () => mal(req.error);
  });
  return _abiertas[clave];
}
function baseDe(almacen){ return almacen==='fotos' ? 'fotos' : almacen==='videos' ? 'videos' : 'datos'; }
function _tx(almacen, modo, fn){
  return abrirBase(baseDe(almacen)).then(db => new Promise((ok, mal) => {
    const tx = db.transaction(almacen, modo);
    const st = tx.objectStore(almacen);
    let res;
    const r = fn(st);
    if(r && 'onsuccess' in r) r.onsuccess = () => { res = r.result; };
    tx.oncomplete = () => ok(res);
    tx.onerror = () => mal(tx.error);
    tx.onabort = () => mal(tx.error || new Error('abortado'));
  }));
}

const DB = {
  todos:  (a)      => _tx(a,'readonly', st => st.getAll()),
  uno:    (a,id)   => _tx(a,'readonly', st => st.get(id)),
  poner:  (a,obj)  => _tx(a,'readwrite', st => st.put(obj)),
  borrar: (a,id)   => _tx(a,'readwrite', st => st.delete(id)),
  vaciar: (a)      => _tx(a,'readwrite', st => st.clear()),
  ponerVarios: (a,lista) => _tx(a,'readwrite', st => { lista.forEach(o => st.put(o)); }),
  deTarea: (a,tareaId) => _tx(a,'readonly', st => st.index('tareaId').getAll(tareaId)),
  async borrarDeTarea(a, tareaId){
    const l = await DB.deTarea(a, tareaId);
    if(l.length) await _tx(a,'readwrite', st => { l.forEach(o => st.delete(o.id)); });
    return l.length;
  },
  // solo id, tamaño y tareaId (sin cargar los archivos) para contar
  async resumen(a){
    return abrirBase(baseDe(a)).then(db => new Promise((ok, mal) => {
      const out = [];
      const tx = db.transaction(a,'readonly');
      const cur = tx.objectStore(a).openCursor();
      cur.onsuccess = () => { const c = cur.result; if(c){ const v=c.value; out.push({id:v.id, tareaId:v.tareaId, size:v.size||0}); c.continue(); } };
      tx.oncomplete = () => ok(out);
      tx.onerror = () => mal(tx.error);
    }));
  }
};

function nuevoId(pref){ return (pref||'') + Date.now().toString(36) + Math.random().toString(36).slice(2,7); }

// Pide al navegador que no borre los datos aunque falte espacio
async function pedirPersistencia(){
  try{ if(navigator.storage && navigator.storage.persist){ return await navigator.storage.persist(); } }catch(e){}
  return false;
}
async function espacioUsado(){
  try{ if(navigator.storage && navigator.storage.estimate) return await navigator.storage.estimate(); }catch(e){}
  return null;
}
function tamTxt(b){
  if(!b && b!==0) return '—';
  if(b < 1024) return b + ' B';
  if(b < 1024*1024) return (b/1024).toFixed(0) + ' KB';
  if(b < 1024*1024*1024) return (b/1024/1024).toFixed(1).replace('.',',') + ' MB';
  return (b/1024/1024/1024).toFixed(2).replace('.',',') + ' GB';
}
