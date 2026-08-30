// App.jsx
//
// Punto de entrada visual de la app. Usa navegación por estado simple
// (sin librería de routing) — suficiente para 5 secciones fijas y más
// fácil de entender sin experiencia previa en programación.

import { useState, useEffect } from 'react';
import { NavegacionPrincipal } from './NavegacionPrincipal.jsx';
import { PantallaInventario } from './screens/PantallaInventario.jsx';
import { PantallaVender } from './screens/PantallaVender.jsx';
import { PantallaFiado } from './screens/PantallaFiado.jsx';
import { PantallaReportes } from './screens/PantallaReportes.jsx';
import { PantallaConfig } from './screens/PantallaConfig.jsx';
import { db } from './db.js';
import { inicializarConfigNegocio } from './db.js';
import { sincronizar } from './sincronizacion.js';

function App() {
  const [seccionActiva, setSeccionActiva] = useState('inventario');
  const [listo, setListo] = useState(false);

  useEffect(() => {
    // Al arrancar: asegurar que exista la config del negocio, y hacer
    // un primer intento de sincronización silenciosa si hay conexión.
    inicializarConfigNegocio().then(() => setListo(true));

    if (navigator.onLine) {
      sincronizar();
    }
  }, []);

  if (!listo) {
    return (
      <div style={{ padding: 'var(--espacio-xl)', textAlign: 'center' }}>
        Cargando...
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 'var(--altura-nav-inferior)' }}>
      <header style={estilos.barraMarca}>
        <span style={estilos.nombreMarca}>CajaÁgil</span>
      </header>

      <main>
        {seccionActiva === 'inventario' && <PantallaInventario />}
        {seccionActiva === 'vender' && <PantallaVender />}
        {seccionActiva === 'fiado' && <PantallaFiado />}
        {seccionActiva === 'reportes' && <PantallaReportes />}
        {seccionActiva === 'config' && <PantallaConfig />}
      </main>

      <NavegacionPrincipal
        seccionActiva={seccionActiva}
        onCambiarSeccion={setSeccionActiva}
      />
    </div>
  );
}

const estilos = {
  barraMarca: {
    padding: '0.7rem var(--espacio-md)',
    background: 'var(--color-navy)',
  },
  nombreMarca: {
    fontFamily: 'var(--fuente-display)',
    fontWeight: 700,
    fontSize: '1.1rem',
    color: 'var(--color-teal)',
    letterSpacing: '0.02em',
  },
};

export default App;
