# Notas de Elisabeth para la app PorHacer

Aquí se apunta lo que Elisabeth pide sobre la app, para no perder el hilo. Leer este archivo antes de cambiar nada.

## 2026-10-27 · V1

- App de **tareas** al estilo de la app HOME, en `iCloud Drive/Antigravity/PorHacer`. Se llama **PorHacer**.
- Colores de las imágenes que adjuntó (gris, negro y rojo). Icono de la app: el **portapapeles 3D** (la 3.ª imagen).
- Tareas agrupadas en **columnas una al lado de otra**: Nueva tarea, En curso, En pausa, Acabada, Archivada.
  - Las columnas se **muestran/ocultan** desde las etiquetas de arriba (👁).
  - **Columnas nuevas** solo desde Configuración → Columnas (no en pantalla).
- Cada tarea con su **color**. El **borde** de la tarea toma el **color de su columna** (configurable): Nueva = rojo, En curso = azul, En pausa = naranja, Acabada = verde, Archivada = gris.
- **Temas** en Configuración: grises (como los botones), marrones claros, rosa, verde lima, verde, azul celeste, naranja, amarillo, naranja·amarillo·marrón, lima·verde·marrón, rosa·marrón·amarillo. Además, cada color se puede cambiar uno a uno.
- **Fecha inicio y fecha fin** opcionales. **Botón de calendario** (al estilo de los iconos) con vista **día, mes y año**; la tarea se ve con su color ocupando todos sus días.
- Al editar, pestañas **Fotos** y **Vídeos**; se **aligeran** antes de guardarse. Fotos y vídeos se guardan en **bases de datos separadas** (PorHacer-datos, PorHacer-fotos, PorHacer-videos).
- **Exportar e importar** (Configuración → Copias).
- **Personas** (nombre, apellidos, email). Al asignar una tarea, casilla «Enviar por email»: se **abre el correo ya rellenado** y solo hay que pulsar Enviar (elegido por ella).
- **Micrófono** en el título y en la nota para dictar (castellano, català o inglés).
- Extras añadidos: buscador, filtros (hoy, semana, vencidas, prioridad alta, sin fecha, por persona), prioridad, pasos con barra de progreso, aviso de vencidas, cuadradito para marcar acabada, duplicar, borrar con «Deshacer», añadir al calendario del móvil (.ics), funciona sin internet.

### Ideas propuestas (pendientes de que diga sí o no)
- Tareas que se **repiten** (cada semana, cada mes…).
- **Avisos** a una hora (como en la agenda de HOME).
- **Etiquetas** (cole, casa, labores…) para filtrar.
- **Código PIN** para abrir la app.

## Archivos
- `index.html` · `css/estilos.css` · `js/` (app, calendario, ajustes, copias, fotos, videos, voz, temas, iconos, db, nube, firebase-config) · `firebase/` (reglas para pegar en Firebase) · `GUIA-FIREBASE.md` · `img/` (iconos) · `manifest.json` · `sw.js`
- Para publicarla (GitHub Pages) hay que subir **todo**, con las carpetas `css`, `js` e `img`.

## 2026-10-27 · V2 · Nube compartida
- Pensaba que todo se quedaba en el móvil, pero necesita que se vea **en todos los sitios**: si asigna una tarea a su marido, él tiene que ver la tarea **con sus fotos y vídeos**.
- Eligió **Firebase (Google)**. Pueden entrar **las personas de su lista de Personas** (nombre, apellidos, email).
- Hecho:
  - Entrar con **email y contraseña** (hay que confirmar el email la primera vez).
  - Ella crea el **tablero compartido**; se suben sus tareas, personas, fotos y vídeos.
  - Pueden entrar las personas de **Personas con email** (si se le quita el email o se borra, pierde el acceso).
  - Tareas, personas y columnas se sincronizan al momento; fotos y vídeos se guardan en Firebase Storage.
  - Copia en el dispositivo: funciona sin internet y se sincroniza al volver.
  - El **tema de colores** es de cada uno.
  - Indicador ☁︎ debajo de la versión (verde = sincronizado). Pestaña **☁️ Nube** en Configuración.
  - El email de la tarea lleva el enlace de la app.
- Falta: que ella cree el proyecto de Firebase siguiendo **GUIA-FIREBASE.md** y me envíe los datos para ponerlos en `js/firebase-config.js`.
