/* PorHacer · iconos dibujados al estilo de las imágenes de la app
   (marco oscuro redondeado + detalles en rojo). Usan los colores del tema. */
const ICO = {
  // Calendario: marco oscuro, anillas, cuadrícula con dos «hechos» y un punto rojo
  calendario: `<svg viewBox="0 0 64 64" aria-hidden="true">
    <rect x="8" y="12" width="48" height="45" rx="10" fill="#fff" stroke="var(--dark)" stroke-width="4.5"/>
    <path d="M8 22a10 10 0 0 1 10-10h28a10 10 0 0 1 10 10v4H8z" fill="var(--dark)"/>
    <rect x="18" y="5" width="7" height="14" rx="3.5" fill="var(--dark)" stroke="#fff" stroke-width="2"/>
    <rect x="39" y="5" width="7" height="14" rx="3.5" fill="var(--dark)" stroke="#fff" stroke-width="2"/>
    <g fill="none" stroke="var(--dark)" stroke-width="2.6">
      <rect x="14.5" y="31.5" width="9" height="8" rx="2.5"/><rect x="27.5" y="31.5" width="9" height="8" rx="2.5"/><rect x="40.5" y="31.5" width="9" height="8" rx="2.5"/>
      <rect x="14.5" y="43.5" width="9" height="8" rx="2.5"/><rect x="27.5" y="43.5" width="9" height="8" rx="2.5"/><rect x="40.5" y="43.5" width="9" height="8" rx="2.5"/>
    </g>
    <path d="M16.6 35.6l2 2 3.4-4" fill="none" stroke="var(--accent)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M29.6 35.6l2 2 3.4-4" fill="none" stroke="var(--accent)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="32" cy="47.5" r="2.6" fill="var(--accent)"/>
  </svg>`,

  // Engranaje de configuración con centro rojo
  ajustes: `<svg viewBox="0 0 64 64" aria-hidden="true">
    <path fill="var(--dark)" d="M28 6h8l1.6 7.2a19 19 0 0 1 5.3 2.2l6.2-4 5.7 5.7-4 6.2a19 19 0 0 1 2.2 5.3L60 30v8l-7.2 1.6a19 19 0 0 1-2.2 5.3l4 6.2-5.7 5.7-6.2-4a19 19 0 0 1-5.3 2.2L36 62h-8l-1.6-7.2a19 19 0 0 1-5.3-2.2l-6.2 4-5.7-5.7 4-6.2a19 19 0 0 1-2.2-5.3L4 38v-8l7.2-1.6a19 19 0 0 1 2.2-5.3l-4-6.2 5.7-5.7 6.2 4a19 19 0 0 1 5.3-2.2z"/>
    <circle cx="32" cy="34" r="13" fill="#fff"/>
    <circle cx="32" cy="34" r="6.5" fill="var(--accent)"/>
  </svg>`,

  // Portapapeles (volver al tablero de tareas)
  tablero: `<svg viewBox="0 0 64 64" aria-hidden="true">
    <rect x="10" y="10" width="44" height="49" rx="9" fill="#fff" stroke="var(--dark)" stroke-width="4.5"/>
    <path d="M22 8a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v8H22z" fill="var(--dark)"/>
    <circle cx="32" cy="9" r="2.4" fill="#fff"/>
    <g fill="none" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
      <rect x="16.5" y="22.5" width="9" height="9" rx="2.5" stroke="var(--dark)"/>
      <rect x="16.5" y="38.5" width="9" height="9" rx="2.5" stroke="var(--dark)"/>
      <path d="M18.5 27l2 2 3.4-4" stroke="var(--accent)"/>
    </g>
    <rect x="29" y="24" width="18" height="3.6" rx="1.8" fill="var(--dark)"/>
    <rect x="29" y="30" width="11" height="3.2" rx="1.6" fill="var(--accent)"/>
    <rect x="29" y="40" width="18" height="3.6" rx="1.8" fill="var(--dark)"/>
    <circle cx="21" cy="43" r="2.4" fill="var(--accent)"/>
  </svg>`,

  buscar: `<svg viewBox="0 0 64 64" aria-hidden="true">
    <circle cx="27" cy="27" r="16" fill="#fff" stroke="var(--dark)" stroke-width="6"/>
    <path d="M39 39l14 14" stroke="var(--accent)" stroke-width="8" stroke-linecap="round"/>
  </svg>`,

  mic: `<svg viewBox="0 0 64 64" aria-hidden="true">
    <rect x="22" y="6" width="20" height="34" rx="10" fill="var(--accent)" stroke="var(--dark)" stroke-width="4"/>
    <path d="M14 30a18 18 0 0 0 36 0" fill="none" stroke="var(--dark)" stroke-width="4.5" stroke-linecap="round"/>
    <path d="M32 48v9M23 58h18" stroke="var(--dark)" stroke-width="4.5" stroke-linecap="round"/>
  </svg>`
};
function icono(nombre){ return ICO[nombre] || ''; }
