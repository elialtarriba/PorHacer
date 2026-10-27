# Guía: conectar PorHacer a la nube (Firebase)

Se hace **una sola vez**, en el ordenador, y se tarda unos 15 minutos.
Al acabar, me envías el bloque de datos del paso 2 y yo lo pongo en la app.

> En la consola de Firebase los menús pueden salir en castellano o en inglés. Pongo los dos nombres.

---

## 1. Crear el proyecto
1. Entra en **https://console.firebase.google.com** con tu cuenta de Google.
2. Pulsa **Crear un proyecto** (*Create a project*).
3. Nombre: **PorHacer** → Continuar.
4. **Google Analytics**: desactívalo (no hace falta) → **Crear proyecto**.

## 2. Registrar la app web (los datos que me tienes que enviar)
1. En la página del proyecto, pulsa el icono **`</>`** (Web).
2. Apodo de la app: **PorHacer**. **No** marques «Firebase Hosting». → **Registrar app**.
3. Saldrá un bloque de código con `const firebaseConfig = { apiKey: ..., authDomain: ..., projectId: ..., storageBucket: ..., messagingSenderId: ..., appId: ... }`.
4. **Cópialo y envíamelo.** (No es secreto: la seguridad la ponen las reglas del paso 4 y 6.)
5. Pulsa **Ir a la consola**.

## 3. Activar «Entrar con email y contraseña»
1. Menú izquierdo: **Compilación → Authentication** (*Build → Authentication*) → **Comenzar**.
2. Pestaña **Método de acceso** (*Sign-in method*) → **Correo electrónico/contraseña** → activa el **primer** interruptor → **Guardar**.
3. Pestaña **Configuración** (*Settings*) → **Dominios autorizados** (*Authorized domains*) → **Agregar dominio** → escribe `elialtarriba.github.io` → Agregar.
4. (Opcional, bonito) Pestaña **Plantillas** (*Templates*): puedes poner el idioma de los correos en **español**.

## 4. Base de datos de las tareas (Firestore)
1. Menú: **Compilación → Firestore Database** → **Crear base de datos**.
2. Ubicación: **eur3 (Europa)** o **europe-southwest1 (Madrid)**. → Siguiente.
3. Elige **Modo de producción** → **Crear**.
4. Pestaña **Reglas** (*Rules*): borra todo lo que hay y **pega el contenido del archivo `firebase/firestore.rules`** (está en la carpeta de la app) → **Publicar**.

## 5. Pasar al plan Blaze (necesario para las fotos y vídeos)
Google pide una tarjeta para poder guardar archivos, **pero mientras no pases de lo gratuito no cobra nada**: 5 GB de fotos y vídeos y miles de lecturas al día gratis.
1. Abajo a la izquierda, donde pone **Spark**, pulsa **Actualizar** (*Upgrade*) → **Blaze** → añade la tarjeta.
2. Cuando te pregunte por un **presupuesto** (*budget*), pon **1 €**: si algún día se acercara, te llega un email de aviso.

## 6. Almacén de fotos y vídeos (Storage)
1. Menú: **Compilación → Storage** → **Comenzar**.
2. Ubicación: elige **US-CENTRAL1** (o US-EAST1 / US-WEST1). ⚠️ Solo esas ubicaciones tienen los 5 GB **gratis**.
3. **Modo de producción** → **Crear**.
4. Pestaña **Reglas** (*Rules*): borra todo y **pega el contenido de `firebase/storage.rules`** → **Publicar**.
5. Si sale un aviso pidiendo permiso para que Storage **consulte Firestore**, pulsa **Permitir** (las reglas lo necesitan para saber quién está en tu lista).

## 7. Envíame los datos
Envíame el bloque del paso 2. Yo lo pongo en `js/firebase-config.js` y te digo qué archivos subir a GitHub.

---

## Cómo se usa después
1. **Tú** abres PorHacer → **Crear cuenta** con tu email → confirmas el email (te llega un correo) → **Crear mi tablero compartido**. Se suben tus tareas, fotos y vídeos.
2. En **Configuración → Personas** pones a cada persona **con su email** (por ejemplo, tu marido). Solo las personas con email de esa lista pueden entrar.
3. Él abre **https://elialtarriba.github.io/PorHacer/** en su móvil → **Crear cuenta** con **ese mismo email** → lo confirma → ya ve todas las tareas, con sus fotos y vídeos, y puede editarlas.
4. Al asignarle una tarea con «Enviar por email», el correo ya lleva el enlace de la app.
5. Para quitarle el acceso a alguien: bórralo de Personas o quítale el email.

Cada uno puede tener **su propio tema de colores**; las columnas sí son las mismas para todos.
