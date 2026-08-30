// db.js
// Configuración de la base de datos local (IndexedDB) usando Dexie.
// Cada tabla corresponde 1:1 con el modelo de datos definido en
// modelo-datos-sistema-gestion.md

import Dexie from 'dexie';

export const db = new Dexie('sistema_gestion_negocio');

// La definición de Dexie NO lista todos los campos, solo los que
// necesitas indexar para hacer búsquedas/filtros rápidos.
// Los demás campos (nombre, notas, etc.) igual se guardan, solo no
// hace falta declararlos aquí.
db.version(1).stores({

  // --- Inventario ---
  productos: 'id, nombre, codigo_barras, activo, updated_at',
  movimientos_inventario: 'id, producto_id, tipo, fecha, venta_id',

  // --- Clientes ---
  clientes: 'id, nombre, cedula, activo',

  // --- Ventas ---
  ventas: 'id, numero_factura, fecha, modalidad, cliente_id, estado_fiado, device_id',
  venta_items: 'id, venta_id, producto_id',
  pagos_fiado: 'id, venta_id, fecha',

  // --- Configuración del negocio (una sola fila) ---
  negocio_config: 'id',

  // --- Gastos de caja menor (arriendo, aseo, servicios, etc.) ---
  gastos: 'id, categoria, fecha, activo',

  // --- Sincronización ---
  // Cola local de eventos que faltan por subir a Google Drive.
  eventos_pendientes: 'id, timestamp, entidad, accion, sincronizado',
});

// Crea la fila de configuración del negocio si aún no existe
// (se usa un id fijo "config" porque solo hay una fila).
export async function inicializarConfigNegocio() {
  const existente = await db.negocio_config.get('config');
  if (existente) return existente;

  const config = {
    id: 'config',
    nombre_negocio: '',
    logo_base64: '',
    direccion: '',
    telefono: '',
    prefijo_factura: '',
    siguiente_numero_factura: 0,
  };

  await db.negocio_config.add(config);
  return config;
}

/*
  Notas de uso:

  - Los "id" son siempre UUID generados en el dispositivo (usa la función
    generarId() de utils.js), nunca autoincrementales — esto evita que dos
    dispositivos offline generen el mismo id.

  - "stock" de un producto NUNCA se escribe directamente: se calcula
    sumando movimientos_inventario (ver calcularStock() en inventario.js).

  - Cada vez que creas o editas un registro en cualquier tabla de negocio,
    debes también insertar un evento correspondiente en
    eventos_pendientes (ver eventos.js) — así queda listo para sincronizar.
*/
