// eventos.js
// Toda escritura de negocio (crear venta, editar producto, abonar
// fiado...) pasa por aquí para quedar en la cola de sincronización.

import { db } from './db.js';
import { generarId, obtenerDeviceId } from './utils.js';

export async function registrarEvento({ entidad, accion, payload }) {
  const evento = {
    id: generarId(),
    device_id: obtenerDeviceId(),
    timestamp: new Date().toISOString(),
    entidad, // 'producto' | 'movimiento_inventario' | 'cliente' | 'venta' | 'pago_fiado'
    accion, // 'crear' | 'editar' | 'desactivar'
    payload,
    sincronizado: 0, // 0 = pendiente, 1 = ya subido a Drive
  };

  await db.eventos_pendientes.add(evento);
  return evento;
}

// Los eventos que faltan por subir en la próxima sincronización.
export async function obtenerEventosPendientes() {
  return db.eventos_pendientes.where('sincronizado').equals(0).toArray();
}

// Marca eventos como ya sincronizados después de subirlos a Drive.
export async function marcarComoSincronizados(idsEventos) {
  await db.eventos_pendientes
    .where('id')
    .anyOf(idsEventos)
    .modify({ sincronizado: 1 });
}
