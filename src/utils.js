// utils.js

// Genera un identificador único por dispositivo, sin depender de un
// contador central (evita colisiones entre dispositivos offline).
export function generarId() {
  return crypto.randomUUID();
}

// device_id corto y estable para este dispositivo (se genera una vez
// y se guarda en localStorage). Se usa como prefijo de factura y para
// trazabilidad en el log de eventos.
export function obtenerDeviceId() {
  let deviceId = localStorage.getItem('device_id');
  if (!deviceId) {
    // Ej: "A3F9" — corto, legible, suficientemente único para un
    // negocio con pocos dispositivos (no busca ser globalmente único).
    deviceId = crypto.randomUUID().slice(0, 4).toUpperCase();
    localStorage.setItem('device_id', deviceId);
  }
  return deviceId;
}
