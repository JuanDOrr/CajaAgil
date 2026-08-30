// EntradaCodigoBarras.jsx
//
// Componente listo para usar en cualquier pantalla (inventario, venta).
// Detecta automáticamente el lector USB (sin acción del usuario) y
// además ofrece un botón para activar la cámara cuando se necesite.

import { useState } from 'react';
import { useLectorUSB } from './useLectorUSB.js';
import { EscanerCamara } from './EscanerCamara.jsx';

export function EntradaCodigoBarras({ onCodigoDetectado }) {
  const [mostrarCamara, setMostrarCamara] = useState(false);

  // El lector USB siempre está "escuchando" en segundo plano, sin
  // necesidad de que el usuario haga clic en nada — así funciona un
  // lector físico en un mostrador real.
  useLectorUSB(onCodigoDetectado);

  function manejarCodigoDeCamara(codigo) {
    setMostrarCamara(false);
    onCodigoDetectado(codigo);
  }

  return (
    <div>
      <button onClick={() => setMostrarCamara(true)}>
        📷 Escanear con cámara
      </button>
      <p style={{ fontSize: '0.85rem', color: '#666' }}>
        O usa el lector USB — detecta el código automáticamente.
      </p>

      {mostrarCamara && (
        <EscanerCamara
          onCodigoEscaneado={manejarCodigoDeCamara}
          onCerrar={() => setMostrarCamara(false)}
        />
      )}
    </div>
  );
}
