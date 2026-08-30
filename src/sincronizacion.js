// sincronizacion.js
//
// Coordina todo el proceso de sincronización:
// 1. Sube los eventos pendientes de este dispositivo a Drive.
// 2. Descarga los lotes de eventos de otros dispositivos que aún no
//    se han aplicado localmente.
// 3. Aplica esos eventos a las tablas locales (productos, ventas, etc).
//
// Se ejecuta cuando: (a) el usuario presiona "Sincronizar", (b) al
// recuperar conexión (evento 'online'), o (c) periódicamente si quieres
// agregar un intervalo más adelante.

import { db } from './db.js';
import { obtenerDeviceId } from './utils.js';
import { obtenerEventosPendientes, marcarComoSincronizados } from './eventos.js';
import {
  obtenerOCrearCarpetaEventos,
  subirLoteEventos,
  listarLotesEventos,
  descargarLoteEventos,
} from './driveApi.js';

// Guardamos en localStorage qué lotes (por id de archivo de Drive) ya
// aplicamos, para no volver a procesarlos en cada sincronización.
function obtenerLotesYaAplicados() {
  const guardado = localStorage.getItem('lotes_aplicados');
  return guardado ? JSON.parse(guardado) : [];
}

function marcarLoteComoAplicado(fileId) {
  const lotes = obtenerLotesYaAplicados();
  lotes.push(fileId);
  localStorage.setItem('lotes_aplicados', JSON.stringify(lotes));
}

export async function sincronizar() {
  if (!navigator.onLine) {
    return { exito: false, mensaje: 'Sin conexión a internet.' };
  }

  try {
    const carpetaId = await obtenerOCrearCarpetaEventos();

    // --- 1. Subir eventos pendientes de este dispositivo ---
    const pendientes = await obtenerEventosPendientes();

    if (pendientes.length > 0) {
      const deviceId = obtenerDeviceId();
      const nombreArchivo = `eventos_${deviceId}_${Date.now()}.json`;

      await subirLoteEventos(carpetaId, nombreArchivo, pendientes);
      await marcarComoSincronizados(pendientes.map((e) => e.id));
    }

    // --- 2. Descargar y aplicar lotes de otros dispositivos ---
    const lotes = await listarLotesEventos(carpetaId);
    const yaAplicados = obtenerLotesYaAplicados();
    const lotesNuevos = lotes.filter((lote) => !yaAplicados.includes(lote.id));

    let eventosAplicados = 0;

    for (const lote of lotesNuevos) {
      const eventos = await descargarLoteEventos(lote.id);
      for (const evento of eventos) {
        await aplicarEvento(evento);
        eventosAplicados++;
      }
      marcarLoteComoAplicado(lote.id);
    }

    return {
      exito: true,
      eventosSubidos: pendientes.length,
      eventosAplicados,
    };
  } catch (error) {
    console.error('Error de sincronización:', error);
    return { exito: false, mensaje: error.message };
  }
}

// Aplica un evento recibido de otro dispositivo a las tablas locales.
// Nota: si el evento ya existe localmente (por id), se ignora — esto
// puede pasar si un mismo lote se procesa dos veces por error.
async function aplicarEvento(evento) {
  const { entidad, accion, payload } = evento;

  const tabla = {
    producto: db.productos,
    movimiento_inventario: db.movimientos_inventario,
    cliente: db.clientes,
    venta: db.ventas,
    venta_item: db.venta_items,
    pago_fiado: db.pagos_fiado,
    gasto: db.gastos,
  }[entidad];

  if (!tabla) {
    console.warn(`Entidad desconocida en evento: ${entidad}`);
    return;
  }

  const existente = await tabla.get(payload.id);

  if (accion === 'crear') {
    if (!existente) {
      await tabla.add(payload);
    }
    // Si ya existe (evento duplicado), no hacemos nada.
    return;
  }

  if (accion === 'editar' || accion === 'desactivar') {
    if (!existente) {
      // El registro no existe aún localmente (llegó el evento de
      // edición antes que el de creación, por ejemplo) — lo creamos
      // directamente con los datos del payload.
      await tabla.add(payload);
      return;
    }

    // Resolución de conflicto: last-write-wins por timestamp.
    // Solo aplicamos si el evento entrante es más reciente que lo
    // que ya tenemos localmente.
    const timestampLocal = existente.updated_at ?? existente.fecha;
    const timestampEvento = payload.updated_at ?? payload.fecha;

    if (!timestampLocal || timestampEvento > timestampLocal) {
      await tabla.put(payload);
    }
    // Si el registro local es más reciente, se conserva tal cual
    // (el evento queda en el log de todas formas, para historial).
  }
}

let intervaloSincronizacion = null;
let sincronizacionEnCurso = false;

// Evita que dos sincronizaciones corran al mismo tiempo (por ejemplo,
// si el intervalo automático y un clic manual coinciden).
async function sincronizarSiNoEstaEnCurso() {
  if (sincronizacionEnCurso) return;
  sincronizacionEnCurso = true;
  try {
    await sincronizar();
  } finally {
    sincronizacionEnCurso = false;
  }
}

// Llamar esto una vez al iniciar la app: sincroniza automáticamente
// (a) apenas se recupera conexión, y (b) cada cierto intervalo mientras
// la app esté abierta — así el dueño del negocio no depende de acordarse
// de sincronizar manualmente. El botón manual en Ajustes sigue disponible
// para forzarlo en cualquier momento.
export function activarSincronizacionAutomatica({ intervaloMinutos = 5 } = {}) {
  window.addEventListener('online', () => {
    sincronizarSiNoEstaEnCurso();
  });

  if (intervaloSincronizacion) clearInterval(intervaloSincronizacion);
  intervaloSincronizacion = setInterval(() => {
    if (navigator.onLine) sincronizarSiNoEstaEnCurso();
  }, intervaloMinutos * 60 * 1000);
}
