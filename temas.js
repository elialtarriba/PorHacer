/* PorHacer · temas de color, paleta de colores y columnas de inicio */

// Nombres de cada color configurable (lo que se ve en Configuración → Colores)
const PARTES_COLOR = [
  ['bg',     'Fondo de la app'],
  ['bg2',    'Fondo (degradado abajo)'],
  ['card',   'Ventanas y tarjetas'],
  ['colbg',  'Fondo de las columnas'],
  ['ink',    'Letra'],
  ['ink2',   'Letra suave'],
  ['line',   'Bordes finos'],
  ['dark',   'Marcos e iconos'],
  ['accent', 'Botones principales'],
  ['accent2','Brillo de los botones'],
  ['accentInk','Letra de los botones'],
  ['tile1',  'Botones-icono (arriba)'],
  ['tile2',  'Botones-icono (abajo)']
];

const TEMAS = {
  grises: { nombre:'Grises y rojo (como los iconos)', c:{
    bg:'#eeeff1', bg2:'#e2e3e7', card:'#ffffff', colbg:'#f7f7f9', ink:'#2c2c2e', ink2:'#7c7c84', line:'#dcdde1',
    dark:'#3a3a3c', accent:'#e5201c', accent2:'#ff5a4e', accentInk:'#ffffff', tile1:'#ffffff', tile2:'#e6e6ea' }},
  marron: { nombre:'Marrones claros', c:{
    bg:'#f4ebdf', bg2:'#eadbc7', card:'#fffaf3', colbg:'#faf2e7', ink:'#4a3422', ink2:'#9a7d62', line:'#e7d6c0',
    dark:'#7a5a3e', accent:'#b9875a', accent2:'#d4a77a', accentInk:'#ffffff', tile1:'#fffaf3', tile2:'#f0e1cd' }},
  rosa: { nombre:'Rosa', c:{
    bg:'#fcecf1', bg2:'#f6dbe4', card:'#fffafc', colbg:'#fdf2f6', ink:'#5a2a3a', ink2:'#a8738a', line:'#f2d3de',
    dark:'#9c4c6a', accent:'#e0708f', accent2:'#f096ad', accentInk:'#ffffff', tile1:'#fffafc', tile2:'#f8e0e8' }},
  lima: { nombre:'Verde lima', c:{
    bg:'#f3f8df', bg2:'#e6f0c4', card:'#fdfff5', colbg:'#f7fbe8', ink:'#384712', ink2:'#7f8f52', line:'#dfe9bd',
    dark:'#5f7a12', accent:'#9cc22e', accent2:'#bddb5a', accentInk:'#ffffff', tile1:'#fdfff5', tile2:'#ebf3cf' }},
  verde: { nombre:'Verde', c:{
    bg:'#e6f2e8', bg2:'#d3e8d7', card:'#f9fdf9', colbg:'#eff8f0', ink:'#1f4a2c', ink2:'#5f8a6a', line:'#cfe3d3',
    dark:'#2f6b42', accent:'#47a066', accent2:'#6cc08a', accentInk:'#ffffff', tile1:'#f9fdf9', tile2:'#dcecdf' }},
  celeste: { nombre:'Azul celeste', c:{
    bg:'#e6f3fc', bg2:'#d2e8f7', card:'#f9fcff', colbg:'#eff7fd', ink:'#1d3f5a', ink2:'#5d86a6', line:'#cde2f2',
    dark:'#2f6690', accent:'#4aa3dc', accent2:'#75bdea', accentInk:'#ffffff', tile1:'#f9fcff', tile2:'#dcebf7' }},
  naranja: { nombre:'Naranja', c:{
    bg:'#fdeedf', bg2:'#f9dcc2', card:'#fffaf5', colbg:'#fef3e8', ink:'#5a3010', ink2:'#a8774f', line:'#f4d8bd',
    dark:'#a85618', accent:'#f0852e', accent2:'#f7a660', accentInk:'#ffffff', tile1:'#fffaf5', tile2:'#f8e2cc' }},
  amarillo: { nombre:'Amarillo', c:{
    bg:'#fdf7da', bg2:'#f8ecb6', card:'#fffdf3', colbg:'#fefae6', ink:'#4f420c', ink2:'#9a8a48', line:'#f0e2a8',
    dark:'#8a7210', accent:'#e2b81c', accent2:'#f0d052', accentInk:'#ffffff', tile1:'#fffdf3', tile2:'#f6ebbd' }},
  otono: { nombre:'Naranja · amarillo · marrón', c:{
    bg:'#fbf1df', bg2:'#f3dfc0', card:'#fffaf2', colbg:'#fdf4e3', ink:'#4e3418', ink2:'#a07e57', line:'#efdbb8',
    dark:'#8c6440', accent:'#ec8a2c', accent2:'#f2c23c', accentInk:'#ffffff', tile1:'#fffaf2', tile2:'#f4e2c4' }},
  campo: { nombre:'Lima · verde · marrón', c:{
    bg:'#f2f2e2', bg2:'#e4e3c8', card:'#fdfdf6', colbg:'#f6f6ea', ink:'#33401c', ink2:'#7c7a58', line:'#e1dfc4',
    dark:'#7a5f42', accent:'#4f9e5a', accent2:'#a6c93a', accentInk:'#ffffff', tile1:'#fdfdf6', tile2:'#e9e7cf' }},
  dulce: { nombre:'Rosa · marrón · amarillo', c:{
    bg:'#fbefe9', bg2:'#f4dfd3', card:'#fffaf7', colbg:'#fdf4ef', ink:'#4e2f2a', ink2:'#a37f72', line:'#f0dacf',
    dark:'#8e6650', accent:'#e0708f', accent2:'#efc44c', accentInk:'#ffffff', tile1:'#fffaf7', tile2:'#f6e3d8' }}
};

// Colores para tareas, columnas y ajustes (desplegable como en HOME)
const PALETA = [
  ['', 'Sin color (blanco)', '#ffffff'],
  ['celeste','Azul celeste','#c4e6f8'], ['azul','Azul','#a9c8f2'], ['azulosc','Azul oscuro','#3b82f6'],
  ['verdecl','Verde claro','#cdeec0'], ['lima','Verde lima','#e2f3a3'], ['verdeosc','Verde oscuro','#22a55a'], ['menta','Menta','#bfeadb'],
  ['amarillo','Amarillo','#fbe9a3'], ['naranjacl','Naranja claro','#fdd2ad'], ['naranja','Naranja','#f59e0b'],
  ['rosa','Rosa','#f9cad9'], ['rosafuerte','Rosa fuerte','#e0708f'], ['rojocl','Rojo claro','#f7b0ab'], ['rojo','Rojo','#e5484d'],
  ['lila','Lila','#dccdf3'], ['morado','Morado','#8b5cf6'],
  ['marroncl','Marrón claro','#e6d2b7'], ['marron','Marrón','#b9875a'], ['marronosc','Marrón oscuro','#7a5a3e'], ['caqui','Caqui','#d4cc9e'],
  ['grisclaro','Gris claro','#e4e4e8'], ['gris','Gris','#8e8e93'], ['grisosc','Gris oscuro','#3a3a3c'], ['negro','Negro','#1c1c1e']
];
const PALETA_TAREA = PALETA.filter(p => !['azulosc','verdeosc','naranja','rosafuerte','rojo','morado','marronosc','gris','grisosc','negro'].includes(p[0]));

function nombreColor(hex){
  if(!hex) return 'Sin color';
  const p = PALETA.find(x => x[2].toLowerCase() === String(hex).toLowerCase());
  return p ? p[1] : 'Personalizado';
}

// Columnas de inicio (el borde de cada tarea toma este color)
const COLUMNAS_INICIO = [
  { id:'nueva',     nombre:'Nueva tarea', color:'#e5484d', visible:true,  hecha:false, fija:true },
  { id:'curso',     nombre:'En curso',    color:'#3b82f6', visible:true,  hecha:false, fija:true },
  { id:'pausa',     nombre:'En pausa',    color:'#f59e0b', visible:true,  hecha:false, fija:true },
  { id:'acabada',   nombre:'Acabada',     color:'#22a55a', visible:true,  hecha:true,  fija:true },
  { id:'archivada', nombre:'Archivada',   color:'#8e8e93', visible:false, hecha:true,  fija:true }
];

// Utilidades de color
function hexRgb(h){ h=String(h||'#ffffff').replace('#',''); if(h.length===3) h=h.split('').map(x=>x+x).join(''); const n=parseInt(h,16); return [(n>>16)&255,(n>>8)&255,n&255]; }
function rgbHex(r,g,b){ return '#'+[r,g,b].map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join(''); }
function mezcla(a,b,t){ const x=hexRgb(a), y=hexRgb(b); return rgbHex(x[0]+(y[0]-x[0])*t, x[1]+(y[1]-x[1])*t, x[2]+(y[2]-x[2])*t); }
function luz(h){ const [r,g,b]=hexRgb(h); return (0.299*r+0.587*g+0.114*b)/255; }
// Para tareas con colores fuertes: aclararlos para que la letra se lea
function fondoTarea(hex){ if(!hex) return null; return luz(hex) < .62 ? mezcla(hex,'#ffffff',.62) : hex; }

function aplicarTema(colores){
  const r = document.documentElement.style;
  for(const [k] of PARTES_COLOR) if(colores[k]) r.setProperty('--'+k, colores[k]);
  r.setProperty('--sombra', 'rgba(' + hexRgb(colores.dark||'#333').join(',') + ',.16)');
  const m = document.querySelector('meta[name=theme-color]'); if(m) m.content = colores.bg;
}
