/* PorHacer · datos de conexión con Firebase (la nube compartida)
   Se rellenan una sola vez con lo que da la consola de Firebase
   (Configuración del proyecto → Tus apps → SDK config).
   Mientras esté en null, la app funciona solo en este dispositivo.
   Estos datos NO son secretos: la seguridad la ponen las reglas de Firebase. */

const FIREBASE_CONFIG = null;

/* Ejemplo de cómo queda una vez rellenado:
const FIREBASE_CONFIG = {
  apiKey: "AIza...",
  authDomain: "porhacer-xxxx.firebaseapp.com",
  projectId: "porhacer-xxxx",
  storageBucket: "porhacer-xxxx.firebasestorage.app",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef"
};
*/

// Dirección pública de la app (se pone en los emails de las tareas)
const APP_URL = 'https://elialtarriba.github.io/PorHacer/';
