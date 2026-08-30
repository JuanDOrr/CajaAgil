// NavegacionPrincipal.jsx
//
// Navegación entre las secciones de la app. Se muestra como barra
// inferior en móvil (fácil de alcanzar con el pulgar en un mostrador)
// y como panel lateral en pantallas anchas.

const SECCIONES = [
  { id: 'inventario', etiqueta: 'Inventario', icono: '📦' },
  { id: 'vender', etiqueta: 'Vender', icono: '🛒' },
  { id: 'fiado', etiqueta: 'Fiado', icono: '📋' },
  { id: 'reportes', etiqueta: 'Reportes', icono: '📊' },
  { id: 'config', etiqueta: 'Ajustes', icono: '⚙️' },
];

export function NavegacionPrincipal({ seccionActiva, onCambiarSeccion }) {
  return (
    <nav style={estilos.nav} aria-label="Navegación principal">
      {SECCIONES.map((seccion) => {
        const activa = seccion.id === seccionActiva;
        return (
          <button
            key={seccion.id}
            onClick={() => onCambiarSeccion(seccion.id)}
            style={{
              ...estilos.boton,
              color: activa ? 'var(--color-teal)' : 'var(--color-ink-suave)',
              fontWeight: activa ? 600 : 500,
            }}
            aria-current={activa ? 'page' : undefined}
          >
            <span style={estilos.icono}>{seccion.icono}</span>
            <span style={estilos.etiqueta}>{seccion.etiqueta}</span>
          </button>
        );
      })}
    </nav>
  );
}

const estilos = {
  nav: {
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    height: 'var(--altura-nav-inferior)',
    background: 'white',
    borderTop: '1px solid var(--color-border)',
    zIndex: 100,
  },
  boton: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '2px',
    background: 'none',
    border: 'none',
    padding: '4px 8px',
    fontSize: '0.7rem',
  },
  icono: {
    fontSize: '1.3rem',
  },
  etiqueta: {
    fontFamily: 'var(--fuente-texto)',
  },
};
