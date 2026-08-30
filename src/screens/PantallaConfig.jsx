// PantallaConfig.jsx

import { useState, useEffect, useCallback } from 'react';
import { db } from '../db.js';
import { obtenerDeviceId } from '../utils.js';
import { sincronizar } from '../sincronizacion.js';
import { cerrarSesionGoogle } from '../googleAuth.js';

export function PantallaConfig() {
  const [config, setConfig] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [guardadoOk, setGuardadoOk] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [resultadoSync, setResultadoSync] = useState(null);

  const cargarConfig = useCallback(async () => {
    const datos = await db.negocio_config.get('config');
    setConfig(datos);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- cargarConfig es async: los setState ocurren después del await, no de forma síncrona en el efecto.
    cargarConfig();
  }, [cargarConfig]);

  function actualizarCampo(campo, valor) {
    setConfig((actual) => ({ ...actual, [campo]: valor }));
    setGuardadoOk(false);
  }

  async function manejarSubidaLogo(evento) {
    const archivo = evento.target.files?.[0];
    if (!archivo) return;

    const lector = new FileReader();
    lector.onload = () => {
      actualizarCampo('logo_base64', lector.result);
    };
    lector.readAsDataURL(archivo);
  }

  async function manejarGuardar() {
    setGuardando(true);
    await db.negocio_config.put(config);
    setGuardando(false);
    setGuardadoOk(true);
  }

  async function manejarSincronizar() {
    setSincronizando(true);
    const resultado = await sincronizar();
    setResultadoSync(resultado);
    setSincronizando(false);
  }

  if (!config) return <p style={{ padding: 'var(--espacio-md)' }}>Cargando...</p>;

  return (
    <div style={estilos.contenedor}>
      <h1 style={estilos.titulo}>Ajustes</h1>

      {/* --- Datos del negocio --- */}
      <section style={estilos.seccion}>
        <h2 style={estilos.subtitulo}>Datos del negocio</h2>

        <Campo etiqueta="Nombre del negocio">
          <input
            value={config.nombre_negocio ?? ''}
            onChange={(e) => actualizarCampo('nombre_negocio', e.target.value)}
            style={estilos.input}
            placeholder="Ej. Papelería El Estudiante"
          />
        </Campo>

        <Campo etiqueta="Dirección">
          <input
            value={config.direccion ?? ''}
            onChange={(e) => actualizarCampo('direccion', e.target.value)}
            style={estilos.input}
          />
        </Campo>

        <Campo etiqueta="Teléfono">
          <input
            value={config.telefono ?? ''}
            onChange={(e) => actualizarCampo('telefono', e.target.value)}
            style={estilos.input}
          />
        </Campo>

        <Campo etiqueta="Logo (aparece en las facturas)">
          <div style={estilos.filaLogo}>
            {config.logo_base64 && (
              <img src={config.logo_base64} alt="Logo del negocio" style={estilos.previewLogo} />
            )}
            <label style={estilos.botonSubirLogo}>
              {config.logo_base64 ? 'Cambiar logo' : 'Subir logo'}
              <input type="file" accept="image/*" onChange={manejarSubidaLogo} style={{ display: 'none' }} />
            </label>
          </div>
        </Campo>

        <button style={estilos.botonGuardar} onClick={manejarGuardar} disabled={guardando}>
          {guardando ? 'Guardando...' : guardadoOk ? '✓ Guardado' : 'Guardar cambios'}
        </button>
      </section>

      {/* --- Sincronización --- */}
      <section style={estilos.seccion}>
        <h2 style={estilos.subtitulo}>Sincronización</h2>
        <p style={estilos.textoSecundario}>
          Este dispositivo: <span className="numero">{obtenerDeviceId()}</span>
        </p>

        <button style={estilos.botonSecundarioAncho} onClick={manejarSincronizar} disabled={sincronizando}>
          {sincronizando ? 'Sincronizando...' : '🔄 Sincronizar ahora'}
        </button>

        {resultadoSync && (
          <p
            style={{
              ...estilos.resultadoSync,
              color: resultadoSync.exito ? 'var(--color-exito)' : 'var(--color-peligro)',
            }}
          >
            {resultadoSync.exito
              ? `Listo. ${resultadoSync.eventosSubidos} cambios subidos, ${resultadoSync.eventosAplicados} recibidos.`
              : resultadoSync.mensaje}
          </p>
        )}

        <button
          style={estilos.botonTextoDiscreto}
          onClick={() => {
            cerrarSesionGoogle();
            setResultadoSync(null);
          }}
        >
          Cerrar sesión de Google
        </button>
      </section>
    </div>
  );
}

function Campo({ etiqueta, children }) {
  return (
    <label style={estilos.campo}>
      <span style={estilos.etiquetaCampo}>{etiqueta}</span>
      {children}
    </label>
  );
}

const estilos = {
  contenedor: {
    padding: 'var(--espacio-md)',
    maxWidth: '600px',
    margin: '0 auto',
  },
  titulo: {
    fontSize: '1.5rem',
    color: 'var(--color-navy)',
    marginBottom: 'var(--espacio-md)',
  },
  seccion: {
    background: 'white',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radio-md)',
    padding: 'var(--espacio-md)',
    marginBottom: 'var(--espacio-md)',
  },
  subtitulo: {
    fontSize: '1rem',
    color: 'var(--color-navy)',
    marginBottom: 'var(--espacio-md)',
  },
  campo: {
    display: 'block',
    marginBottom: 'var(--espacio-md)',
  },
  etiquetaCampo: {
    display: 'block',
    fontSize: '0.85rem',
    fontWeight: 600,
    marginBottom: '4px',
    color: 'var(--color-ink-suave)',
  },
  input: {
    width: '100%',
    padding: '0.6rem',
    borderRadius: 'var(--radio-sm)',
    border: '1px solid var(--color-border)',
    fontSize: '1rem',
  },
  filaLogo: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--espacio-md)',
  },
  previewLogo: {
    width: '60px',
    height: '60px',
    objectFit: 'contain',
    borderRadius: 'var(--radio-sm)',
    border: '1px solid var(--color-border)',
    background: 'var(--color-paper)',
  },
  botonSubirLogo: {
    padding: '0.5rem 1rem',
    background: 'var(--color-paper-alt)',
    color: 'var(--color-navy)',
    borderRadius: 'var(--radio-sm)',
    fontWeight: 600,
    fontSize: '0.85rem',
    cursor: 'pointer',
  },
  botonGuardar: {
    width: '100%',
    padding: '0.7rem',
    background: 'var(--color-teal)',
    color: 'white',
    border: 'none',
    borderRadius: 'var(--radio-sm)',
    fontWeight: 700,
  },
  textoSecundario: {
    fontSize: '0.9rem',
    color: 'var(--color-ink-suave)',
    marginBottom: 'var(--espacio-md)',
  },
  botonSecundarioAncho: {
    width: '100%',
    padding: '0.7rem',
    background: 'var(--color-paper-alt)',
    color: 'var(--color-navy)',
    border: 'none',
    borderRadius: 'var(--radio-sm)',
    fontWeight: 600,
    marginBottom: 'var(--espacio-sm)',
  },
  resultadoSync: {
    fontSize: '0.85rem',
    textAlign: 'center',
    marginBottom: 'var(--espacio-sm)',
  },
  botonTextoDiscreto: {
    display: 'block',
    margin: '0 auto',
    background: 'none',
    border: 'none',
    color: 'var(--color-ink-suave)',
    fontSize: '0.8rem',
    textDecoration: 'underline',
  },
};
