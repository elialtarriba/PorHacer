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
- **Todos los archivos sueltos en la misma carpeta, sin subcarpetas** (como HOME), porque así se suben a GitHub.
- `index.html` · `estilos.css` · `.js` (app, calendario, ajustes, copias, fotos, videos, voz, temas, iconos, db, nube, firebase-config) · `firestore.rules` y `storage.rules` (reglas para pegar en Firebase) · `GUIA-FIREBASE.md` · iconos `.png` · `manifest.json` · `sw.js`

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
- Falta: que ella cree el proyecto de Firebase siguiendo **GUIA-FIREBASE.md** y me envíe los datos para ponerlos en `firebase-config.js`.


### 2026-10-27 · V2 · archivos sin carpetas
- Subió todo a GitHub (repo `elialtarriba/PorHacer`, GitHub Pages activado) pero los archivos quedaron sueltos, sin las carpetas. → Pasada la app a **archivos sueltos** (sin css/, js/, img/). Hay que volver a subir `index.html`, `sw.js`, `manifest.json` y `nube.js`.
- Ya tiene cuenta de Firebase de antes.
- Proyecto Firebase creado: **porhacer-36f11** (plan Spark de momento). Datos puestos en `firebase-config.js`.
- **No quiere poner tarjeta** → nada de plan Blaze ni Storage. Fotos y vídeos se guardan **dentro de Firestore** (plan gratis Spark), partidos en trozos de 900 KB. Límite: **1 GB** en total; se ve lo gastado en Configuración → Nube y avisa si se llena.
- Firebase hecho: proyecto, Authentication (email/contraseña + dominio `elialtarriba.github.io`), Firestore (eur3) con reglas publicadas.

## 2026-10-27 · V3
- En el calendario quiere **pasar con el dedo de mes en mes** y que se vea **la hoja que pasa**, como en el calendario de HOME; también **día a día** y **año a año**. → Hecho: la misma hoja curvada de HOME (sigue el dedo, si se para se para, si sueltas a medias vuelve atrás). También con los botones ‹ ›.
- Preguntó si hay un solo tablero: sí, uno, el suyo, compartido con las personas de su lista.
- Se le hizo `PorHacer-Guia.pdf` (guía de uso con capturas). No hace falta subirla a GitHub.
- En la vista **Año**, al lado de cada mes sale el **año** (etiqueta roja) para no perderse.
- El **micro no paraba** al volver a pulsarlo (en el iPhone el dictado a veces no avisa de que ha terminado). → Arreglado: al pulsar, se para al momento y, si el navegador no acaba en 1,5 s, se corta.
- El micro tiene que estar **verde mientras graba** y con el **color del tema** cuando no. → Hecho.
- La **fecha de inicio y fin** no tiene que salir puesta por defecto. → Ahora una fecha vacía se ve como **«Sin fecha»** (el navegador enseñaba la de hoy en gris) y cada fecha tiene una **✕** para quitarla.
- Una **tarea nueva** tiene que ir por defecto a **En curso**. → Hecho (con el ＋ de una columna sigue yendo a esa columna).

## 2026-10-27 · V4
Probó la V3 con su marido (rbielsa@gmail.com). Ella le había puesto en Personas otro email (familiabielsa@gmail.com) y a él le salió «Todavía nadie ha compartido un tablero contigo… Crear mi tablero compartido», cosa que no quiere.
1. **Versión** visible pero discreta también en la pantalla de entrar. → Hecho («PorHacer V4» en gris abajo).
2. **Tableros**, como ella lo plantea. → Hecho:
   - Al crear la cuenta se pide **nombre y apellidos**; al entrar por primera vez se crea **su tablero** solo, sin preguntar.
   - Configuración → **📋 Tableros**: tu cuenta, invitaciones, *Mis tableros* y *Compartidos conmigo*. Cada uno puede **crear tantos tableros** como quiera.
   - **Compartir**: eliges el tablero, pones nombre, apellidos y email → se apunta solo en Personas de ese tablero y **se le envía una invitación por email** (con enlace que abre la app).
   - Al entrar, el invitado ve **«Te han invitado» → Aceptar / Rechazar / Ahora no**. Al aceptar, se apunta solo en Personas del tablero (con su nombre).
   - Quien comparte ve quién está dentro (✅) y a quién se ha invitado (⏳, con 📧 para reenviar) y **puede sacar** a quien quiera (✕). Solo el dueño. Los demás pueden **salir**.
   - En la cabecera, debajo de la fecha, el **tablero abierto** (📋 nombre ▾) para cambiar de tablero rápido.
   - Ya no existe «usar solo en este dispositivo»: hay que entrar.
   - **Reglas nuevas de Firestore** (archivo `firestore.rules`): hay que pegarlas y publicarlas en Firebase.
3. **Fechas vacías al crear una tarea**: revisado, una tarea nueva sale «Sin fecha». Solo «＋ Nueva tarea este día» del calendario pone la fecha de ese día (quizá así salió la de 2024, con el calendario en 2024).
4. **Email más bonito**: con diseño, colores del tema, botón para abrir la app y el enlace en una caja para copiarlo. Para que se envíe solo con diseño hace falta EmailJS (gratis, sin tarjeta): ver `GUIA-EMAILJS.md`. Sin EmailJS se abre el correo con el texto ordenado y con saltos de línea. Un botón «copiar» dentro de un email no es posible (los correos no lo permiten): se mantiene el dedo sobre el enlace.
5. Le encantan los detalles (pasos, historial al final de la tarea…). ¡Gracias!
6. Iconos de la tarjeta: 📧 = se le ha enviado por email (🔔 si también recordatorio); el círculo con letras = iniciales de la persona asignada.
7. Botón **🔔 Enviar un recordatorio por email**, amable y bonito. → Hecho.
8. Botón **☀️ Hoy** en la línea de las fechas (pone hoy en inicio y fin). → Hecho.
9. Pestaña **🎙️ Audio** en cada tarea: grabar nota de voz, escucharla y **Guardar / Repetir / Cancelar**. Se guarda como **.mp3** ligero (≈360 KB/min) en su propio almacén (PorHacer-audios). → Hecho (librería `lame.min.js`).
10. (Pedido a mitad) **Fiesta al acabar una tarea**: confeti por toda la pantalla durante 5 s (configurable), mensaje grande y de colores «¡Muy bien!» / «Molt bé!» / «Congratulations!» según el idioma (o el que se escriba), musiquita, y **email de enhorabuena** a las personas del tablero (Preguntar / Siempre / Nunca). Todo en Configuración → **🎉 Al acabar**, con botón «Probar ahora». → Hecho.
- **Redondas con iniciales**: si la tarea se comparte con más gente, sale la redonda de la persona asignada y un «+N». Al pulsarla sale una ventana con las redondas y la lista de personas del tablero; al pulsar una persona se despliega: email, tareas pendientes, «📌 Asignarle esta tarea», «👀 Ver sus tareas» y «🔔 Recordatorio». → Hecho.
- **Emails**: le va bien como hasta ahora (se abre el correo ya escrito y ella pulsa Enviar). EmailJS no hace falta; queda opcional.
- Su usuario de Firebase sirve: no hay que crearlo de nuevo (la V4 solo le pide nombre y apellidos una vez).

## 2026-10-27 · V4.1
- **V4.1** · Al final de cada tarea, después de «Al calendario del móvil / Duplicar / Borrar» y antes del historial, un **desplegable con los tableros** para mover la tarea a otro tablero (con sus fotos, vídeos y audios; la persona asignada se apunta sola en el otro tablero; si la columna no existe allí, va a su primera columna). Hecho en la V4 (carpeta PorHacer) y en la V5 (PorHacer2).
- Le encantan las notas de voz («¡eres un máquina!»).

## V4.2 · Recuperar contraseña
- Raimon no recibía el email de «He olvidado la contraseña». Ahora el email sale en español, vuelve a la app y el aviso explica: mirar Spam/Promociones, remitente noreply@porhacer-36f11.firebaseapp.com y que debe ser el mismo email de la cuenta (Firebase no avisa si el email no existe).

## V4.3 · Borrar, historial y nube
- Botón grande «🗑 Borrar esta tarea» al final de la tarea, con ventanita bonita: muestra la tarea, sus fotos/vídeos/audios/pasos y el espacio que se libera. Se puede deshacer unos segundos.
- Historial completo de cada tarea: creada, cambios de columna, fechas, título, notas, prioridad, color, persona, pasos, fotos/vídeos/audios añadidos o borrados, emails, recordatorios, cambio de tablero, duplicada… con fecha, hora y quién. En la tarea se ven los 3 últimos y «📜 Ver todo el historial» abre una ventana agrupada por días.
- El indicador verde de la nube ahora tiene icono (nube con ✓, nube tachada sin conexión, flecha al subir) y al tocarlo explica el estado.
- Cabecera: la versión y la nube pasan debajo de los botones de calendario y ajustes, para que la fecha y el nombre del tablero se vean enteros.

## V4.4 · Calendario con varios tableros
- En el calendario, botón «📋 Este tablero ▾» para elegir qué tableros ver: uno, varios o todos (se recuerda en el móvil).
- Con más de un tablero, cada tarea lleva una redonda de color con la inicial de su tablero; al tocarla sale el nombre completo.
- Al tocar una tarea de otro tablero, pregunta si quieres ir a ese tablero y la abre.

## V4.5 · Subir a la nube lo pendiente
- Al tocar la nube: si hay fotos, vídeos o audios en el móvil que no están en la nube, lo dice y hay un botón «⬆️ Subir a la nube» (también comprueba las tareas).
- Además lo pendiente se sube solo al abrir la app y al volver internet.

## V4.6 · Ratón y temas blancos
- Las barras de pestañas (Configuración, columnas…) se pueden arrastrar con el ratón y mover con la rueda.
- 11 temas nuevos con fondo blanco (Blanco y rojo, azul, celeste, verde, lima, rosa, lila, naranja, amarillo, marrón, negro). En Temas salen en dos grupos: «Con fondo blanco» y «Con fondo de color».

## V4.7 · Avisos con sonido
- Cada tarea puede tener 2 avisos (día y hora), con atajos «Dentro de 1 hora» y «Mañana a las 9». Son de quien los pone: a los demás del tablero no les suenan.
- A la hora suena una campanita y sale una ventana bonita: Cerrar, 😴 10 min (posponer) o Ir a la tarea. Si el navegador está en otra pestaña, también sale una notificación (si se da permiso).
- Suena mientras la app esté abierta; si se abre más tarde (hasta 12 h), avisa igualmente indicando «Era para…».
- La tarjeta muestra 🔔 con el próximo aviso; el historial apunta avisos puestos, quitados y pospuestos.
- V4.8: las tareas nuevas van por defecto a «Nueva tarea» (antes «En curso»).
- V4.9: «Al calendario del móvil» lleva los avisos con sonido como alarmas del calendario (suenan aunque la app esté cerrada). Si la tarea no tiene fechas pero sí aviso, el evento se pone ese día.

## V4.10 · Bloc de notas secreto
- Botón 📒 en el calendario. Contraseña en Configuración → 🔒 Bloc (solo puntos, sin copiar ni pegar).
- Notas solo en este aparato, cifradas (AES-GCM) con la contraseña. Exportar/importar copia cifrada. Si se olvida la contraseña no se recupera.
- Hojas con pestañas: añadir, borrar, nombre, color de hoja y color de pestaña. Negrita/normal, listas ☑ (se marcan), • y 1., subrayado en 7 colores pastel.
- V4.11: fotos en el bloc (📷, arrastrar o pegar). Se aligeran (máx. 1000 px, JPEG) y entran pequeñas (140 px); al tocarlas sale un tirador para hacerlas grandes o pequeñas y una 🗑. El bloc pasa a guardarse en IndexedDB (cabe mucho más); lo de antes se traspasa solo.
- V4.12: imprimir una hoja del bloc (menú ⋯ → 🖨): elegir hoja, con el color del papel o en blanco, y con o sin el nombre arriba.
- V4.13: PDF de una hoja del bloc (⋯ → Imprimir o PDF; con o sin color). Barra de 10 iconos (✅ ❤️ ❌ ❗️ ❓ 🔴 🟢 🔵 🟡 🟠) en el bloc y en las notas de la tarea; las notas de la tarea admiten negrita (se ve en la tarjeta). Librerías html2canvas.min.js y jspdf.min.js (MIT) incluidas.
