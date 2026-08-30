// EscanerCamara.jsx
//
// Componente que activa la cámara del dispositivo y detecta códigos
// de barras/QR en tiempo real usando @zxing/library.
//
// Instalación: npm install @zxing/library

import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/library';

export function EscanerCamara({ onCodigoEscaneado, onCerrar }) {
  const videoRef = useRef(null);
  const lectorRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const lector = new BrowserMultiFormatReader();
    lectorRef.current = lector;

    lector
      .decodeFromVideoDevice(
        null, // null = usa la cámara trasera por defecto en móviles
        videoRef.current,
        (resultado, err) => {
          if (resultado) {
            onCodigoEscaneado(resultado.getText());
          }
          // 'err' se dispara constantemente mientras no detecta nada
          // (es normal, no es un error real) — solo lo ignoramos.
        }
      )
      .catch((err) => {
        setError(
          'No se pudo acceder a la cámara. Revisa los permisos del navegador.'
        );
        console.error('Error al iniciar cámara:', err);
      });

    return () => {
      // Importante: liberar la cámara al cerrar el componente, o
      // quedará "encendida" consumiendo batería.
      lector.reset();
    };
  }, [onCodigoEscaneado]);

  return (
    <div style={estilos.contenedor}>
      {error ? (
        <p style={estilos.error}>{error}</p>
      ) : (
        <video ref={videoRef} style={estilos.video} />
      )}
      <button onClick={onCerrar} style={estilos.botonCerrar}>
        Cerrar escáner
      </button>
    </div>
  );
}

const estilos = {
  contenedor: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.9)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  video: {
    width: '100%',
    maxWidth: '400px',
    borderRadius: '8px',
  },
  error: {
    color: 'white',
    padding: '1rem',
    textAlign: 'center',
  },
  botonCerrar: {
    marginTop: '1rem',
    padding: '0.5rem 1.5rem',
  },
};
