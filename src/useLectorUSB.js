// useLectorUSB.js
//
// Los lectores de código de barras USB funcionan como un teclado: al
// escanear, "escriben" el código muy rápido y terminan con Enter.
// Este hook detecta ese patrón (velocidad de tecleo) para diferenciarlo
// de alguien escribiendo a mano, y no necesita ninguna librería externa.

import { useEffect, useRef } from 'react';

const UMBRAL_MS_ENTRE_TECLAS = 50; // un humano tipeando es más lento que esto

export function useLectorUSB(onCodigoEscaneado) {
  const bufferRef = useRef('');
  const ultimoTecleoRef = useRef(0);

  useEffect(() => {
    function manejarTecla(evento) {
      const ahora = Date.now();
      const tiempoDesdeUltimaTecla = ahora - ultimoTecleoRef.current;
      ultimoTecleoRef.current = ahora;

      // Si pasó mucho tiempo desde la última tecla, es un tecleo nuevo
      // (probablemente humano), reiniciamos el buffer.
      if (tiempoDesdeUltimaTecla > UMBRAL_MS_ENTRE_TECLAS * 4) {
        bufferRef.current = '';
      }

      if (evento.key === 'Enter') {
        // Si el buffer se armó muy rápido (típico de un lector), lo
        // tratamos como código escaneado.
        if (bufferRef.current.length >= 4) {
          onCodigoEscaneado(bufferRef.current);
        }
        bufferRef.current = '';
        return;
      }

      // Solo acumulamos caracteres normales (evita teclas como Shift,
      // Control, flechas, etc.)
      if (evento.key.length === 1) {
        bufferRef.current += evento.key;
      }
    }

    window.addEventListener('keydown', manejarTecla);
    return () => window.removeEventListener('keydown', manejarTecla);
  }, [onCodigoEscaneado]);
}
