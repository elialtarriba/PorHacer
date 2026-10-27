/* PorHacer · copias de seguridad (exportar / importar) y espacio usado */

function blobADatos(b){ return new Promise((ok, mal) => { if(!b) return ok(null); const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => mal(r.error); r.readAsDataURL(b); }); }
function datosABlob(d){
  if(!d) return null;
  const [cab, b64] = d.split(','); const tipo = (cab.match(/data:([^;]+)/)||[])[1] || 'application/octet-stream';
  const bin = atob(b64), u = new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) u[i] = bin.charCodeAt(i);
  return new Blob([u], { type:tipo });
}

const Copias = {
  async pintar(){
    const cont = $('#ajCopias');
    const [rf, rv] = await Promise.all([DB.resumen('fotos'), DB.resumen('videos')]);
    const tf = rf.reduce((s,x)=>s+x.size,0), tv = rv.reduce((s,x)=>s+x.size,0);
    const est = await espacioUsado();
    let persist = false; try{ persist = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : false; }catch(e){}
    const pct = est && est.quota ? Math.min(100, est.usage/est.quota*100) : 0;
    cont.innerHTML = `
      <div class="aj-sec"><h4>Espacio</h4><div class="espacio">
        <div style="font-size:14.5px;font-weight:800">📋 ${App.tareas.length} tareas · 👥 ${App.personas.length} persona${App.personas.length===1?'':'s'}</div>
        <div style="font-size:14.5px;font-weight:800;margin-top:4px">📷 ${rf.length} fotos (${tamTxt(tf)}) · 🎬 ${rv.length} vídeos (${tamTxt(tv)})</div>
        ${est && est.quota ? `<div class="barra-prog"><i style="width:${Math.max(2,pct)}%"></i></div><p>Usado ${tamTxt(est.usage)} de ${tamTxt(est.quota)} disponibles en este navegador</p>` : ''}
        <p>${persist ? '🔒 Datos protegidos: el navegador no los borrará para hacer sitio.' : '⚠️ El navegador podría borrar datos si se queda sin espacio: haz copias de vez en cuando.'}</p>
      </div></div>
      <div class="aj-sec"><h4>Exportar copia</h4>
        <label class="check" style="margin-top:0"><input type="checkbox" id="cpFotos" checked><span class="caja"></span><span>Incluir fotos <small>${tamTxt(tf)}</small></span></label>
        <label class="check"><input type="checkbox" id="cpVideos" ${tv < 80*1024*1024 ? 'checked' : ''}><span class="caja"></span><span>Incluir vídeos <small>${tamTxt(tv)}</small></span></label>
        <button class="btn-pri btn-ancho" id="cpExportar" style="margin-top:12px">⬇️ Exportar copia</button>
        <p class="aj-ayuda" style="margin-top:8px">Se descarga un archivo <b>porhacer-copia-fecha.json</b>. Guárdalo en iCloud Drive o donde quieras.${Nube.activa ? ' Con la nube activa, solo incluye las fotos y vídeos guardados en este dispositivo.' : ''}</p></div>
      <div class="aj-sec"><h4>Importar copia</h4>
        <label class="btn-sec btn-ancho" style="display:grid;place-items:center;cursor:pointer">⬆️ Elegir archivo de copia<input type="file" id="cpImportar" accept=".json,application/json" hidden></label>
        <p class="aj-ayuda" style="margin-top:8px">Podrás elegir entre <b>sustituir</b> todo lo que hay o <b>añadirlo</b> a lo que ya tienes.</p></div>
      <div class="aj-sec"><h4>Aviso importante (iPhone)</h4><p class="aj-ayuda">Si borras el icono de PorHacer de la pantalla de inicio, el iPhone puede borrar también sus datos. Antes, haz <b>Exportar</b>; después de volver a añadirla, <b>Importar</b>.</p></div>`;
    $('#cpExportar').onclick = () => this.exportar($('#cpFotos').checked, $('#cpVideos').checked);
    $('#cpImportar').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if(f) this.importar(f); };
  },

  async exportar(conFotos, conVideos){
    const b = $('#cpExportar'); b.disabled = true; b.textContent = 'Preparando copia…';
    try{
      const copia = { app:'PorHacer', version:VERSION, fecha:new Date().toISOString(),
        ajustes:App.ajustes, tareas:App.tareas.map(limpiaTarea), personas:App.personas, fotos:[], videos:[] };
      if(conFotos) for(const f of await DB.todos('fotos')) copia.fotos.push({ ...f, blob:await blobADatos(f.blob), mini:await blobADatos(f.mini) });
      if(conVideos) for(const v of await DB.todos('videos')) copia.videos.push({ ...v, blob:await blobADatos(v.blob), poster:await blobADatos(v.poster) });
      const blob = new Blob([JSON.stringify(copia)], { type:'application/json' });
      descargar(blob, 'porhacer-copia-' + hoyIso() + '.json');
      toast('💾 Copia exportada (' + tamTxt(blob.size) + ')');
    }catch(e){ console.error(e); popAviso('No se pudo exportar', 'Prueba sin los vídeos, que son lo que más ocupa.'); }
    b.disabled = false; b.textContent = '⬇️ Exportar copia';
  },

  async importar(file){
    let c;
    try{ c = JSON.parse(await file.text()); }catch(e){ popAviso('Archivo no válido', 'Ese archivo no es una copia de PorHacer.'); return; }
    if(!c || c.app !== 'PorHacer' || !Array.isArray(c.tareas)){ popAviso('Archivo no válido', 'Ese archivo no es una copia de PorHacer.'); return; }
    const modo = await popup({ tit:'Importar copia',
      html:`<p>La copia del <b>${new Date(c.fecha).toLocaleDateString('es-ES',{dateStyle:'long'})}</b> tiene ${c.tareas.length} tareas, ${(c.personas||[]).length} personas, ${(c.fotos||[]).length} fotos y ${(c.videos||[]).length} vídeos.</p>
        ${Nube.activa ? '<p class="aj-ayuda" style="margin-top:8px">Estás en el tablero compartido: la copia se <b>añadirá</b> (no se borra nada de lo compartido).</p>' : '<button class="opcion" data-v="sustituir">🔁 Sustituir todo lo que hay por la copia</button>'}
        <button class="opcion" data-v="anadir">➕ Añadirla a lo que ya tengo</button>`,
      botones:[{txt:'Cancelar', val:null}],
      alAbrir:(cx, fin) => $$('.opcion', cx).forEach(o => o.onclick = () => fin(o.dataset.v)) });
    if(!modo) return;
    try{
      if(modo === 'sustituir'){ for(const a of ['tareas','personas','fotos','videos']) await DB.vaciar(a); }
      await DB.ponerVarios('tareas', c.tareas);
      await DB.ponerVarios('personas', c.personas || []);
      for(const f of c.fotos || []) await DB.poner('fotos', { ...f, blob:datosABlob(f.blob), mini:datosABlob(f.mini) });
      for(const v of c.videos || []) await DB.poner('videos', { ...v, blob:datosABlob(v.blob), poster:datosABlob(v.poster) });
      if(c.ajustes && (modo === 'sustituir' || await popConfirmar('Configuración', '¿Quieres usar también los colores y columnas de la copia?', 'Sí, usarlos'))){
        App.ajustes = Object.assign(ajustesInicio(), c.ajustes, { id:'ajustes' });
      } else if(c.ajustes){
        // añadir columnas que falten para que ninguna tarea quede perdida
        for(const col of c.ajustes.columnas || []) if(!App.ajustes.columnas.some(x => x.id === col.id)) App.ajustes.columnas.push(col);
      }
      await guardarAjustes(); aplicarTema(App.ajustes.colores);
      [App.tareas, App.personas] = await Promise.all([DB.todos('tareas'), DB.todos('personas')]);
      await contarMedia(); pintarTodo(); this.pintar();
      toast('✅ Copia importada');
    }catch(e){ console.error(e); popAviso('Error al importar', 'No se pudo importar del todo: ' + e.message); }
  }
};
