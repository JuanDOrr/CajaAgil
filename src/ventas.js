// ventas.js

import { db } from './db.js';
import { generarId, obtenerDeviceId } from './utils.js';
import { registrarEvento } from './eventos.js';
import { registrarMovimientoInventario, calcularStock } from './inventario.js';

// --- Numeración de factura ---
// Estrategia: prefijo por dispositivo + contador local.
// Ej: "A3F9-000001". Nunca choca entre dispositivos porque cada uno
// tiene su propio prefijo y su propio contador.
async function siguienteNumeroFactura() {
  const deviceId = obtenerDeviceId();
  const config = await db.negocio_config.get('config');

  const siguiente = (config?.siguiente_numero_factura ?? 0) + 1;

  await db.negocio_config.update('config', {
    siguiente_numero_factura: siguiente,
  });

  const numero = String(siguiente).padStart(6, '0');
  return `${deviceId}-${numero}`;
}

// --- Finalizar una venta (contado o fiado) ---
// items: [{ producto_id, cantidad, precio_unitario, costo_unitario }]
export async function finalizarVenta({
  items,
  modalidad, // 'contado' | 'fiado'
  clienteId = null,
  descuento = 0,
  diasCredito = 15, // solo aplica si modalidad === 'fiado'
}) {
  if (modalidad === 'fiado' && !clienteId) {
    throw new Error('Una venta a fiado requiere un cliente asociado.');
  }

  // 1. Validar que hay stock suficiente ANTES de descontar nada.
  //    Evita dejar stock negativo por una venta parcialmente aplicada.
  for (const item of items) {
    const stockActual = await calcularStock(item.producto_id);
    if (stockActual < item.cantidad) {
      const producto = await db.productos.get(item.producto_id);
      throw new Error(
        `Stock insuficiente de "${producto?.nombre ?? item.producto_id}". Disponible: ${stockActual}, solicitado: ${item.cantidad}`
      );
    }
  }

  // 2. Calcular totales
  const subtotal = items.reduce(
    (sum, item) => sum + item.precio_unitario * item.cantidad,
    0
  );
  const total = subtotal - descuento;

  const ventaId = generarId();
  const fecha = new Date().toISOString();
  const fechaVencimiento =
    modalidad === 'fiado'
      ? new Date(Date.now() + diasCredito * 24 * 60 * 60 * 1000).toISOString()
      : null;

  const venta = {
    id: ventaId,
    numero_factura: await siguienteNumeroFactura(),
    fecha,
    modalidad,
    cliente_id: clienteId,
    descuento,
    subtotal,
    total,
    fecha_vencimiento: fechaVencimiento,
    estado_fiado: modalidad === 'fiado' ? 'pendiente' : null,
    device_id: obtenerDeviceId(),
  };

  await db.ventas.add(venta);

  await registrarEvento({
    entidad: 'venta',
    accion: 'crear',
    payload: venta,
  });

  // 3. Guardar cada línea de la venta (precio y costo "congelados"
  //    al momento de la venta, para que reportes futuros sean exactos
  //    aunque el precio/costo del producto cambie después)
  const ventaItems = [];
  for (const item of items) {
    const ventaItem = {
      id: generarId(),
      venta_id: ventaId,
      producto_id: item.producto_id,
      cantidad: item.cantidad,
      precio_unitario: item.precio_unitario,
      costo_unitario: item.costo_unitario,
    };
    await db.venta_items.add(ventaItem);
    ventaItems.push(ventaItem);

    // 4. Descontar stock vía movimiento de inventario (no editando
    //    el campo stock directamente)
    await registrarMovimientoInventario({
      productoId: item.producto_id,
      tipo: 'venta',
      cantidad: -item.cantidad,
      costoUnitario: item.costo_unitario,
      ventaId,
    });
  }

  return { venta, items: ventaItems };
}

// --- Registrar un abono/pago a una venta fiado ---
export async function registrarPagoFiado({ ventaId, monto, notas = null }) {
  const pago = {
    id: generarId(),
    venta_id: ventaId,
    monto,
    fecha: new Date().toISOString(),
    notas,
  };

  await db.pagos_fiado.add(pago);

  await registrarEvento({
    entidad: 'pago_fiado',
    accion: 'crear',
    payload: pago,
  });

  // Recalcular y actualizar estado_fiado de la venta
  await actualizarEstadoFiado(ventaId);

  return pago;
}

// --- Saldo pendiente y estado de una venta a fiado ---
export async function saldoPendienteVenta(ventaId) {
  const venta = await db.ventas.get(ventaId);
  const pagos = await db.pagos_fiado.where('venta_id').equals(ventaId).toArray();
  const totalPagado = pagos.reduce((sum, p) => sum + p.monto, 0);
  return venta.total - totalPagado;
}

async function actualizarEstadoFiado(ventaId) {
  const venta = await db.ventas.get(ventaId);
  if (venta.modalidad !== 'fiado') return;

  const saldo = await saldoPendienteVenta(ventaId);
  const hoy = new Date();
  const vencimiento = new Date(venta.fecha_vencimiento);

  let estado;
  if (saldo <= 0) estado = 'pagada';
  else if (hoy > vencimiento) estado = 'vencida';
  else estado = 'pendiente';

  await db.ventas.update(ventaId, { estado_fiado: estado });
}

// --- Historial de ventas, para reimprimir facturas ---
export async function obtenerVentasRecientes(limite = 10) {
  const todas = await db.ventas.toArray();
  todas.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  const conCliente = await Promise.all(
    todas.slice(0, limite).map(async (venta) => {
      const cliente = venta.cliente_id ? await db.clientes.get(venta.cliente_id) : null;
      return { ...venta, cliente_nombre: cliente?.nombre ?? null };
    })
  );

  return conCliente;
}

export async function buscarVentaPorFactura(texto) {
  const todas = await db.ventas.toArray();
  const coincidencias = todas.filter((v) =>
    v.numero_factura.toLowerCase().includes(texto.toLowerCase())
  );
  coincidencias.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  const conCliente = await Promise.all(
    coincidencias.slice(0, 10).map(async (venta) => {
      const cliente = venta.cliente_id ? await db.clientes.get(venta.cliente_id) : null;
      return { ...venta, cliente_nombre: cliente?.nombre ?? null };
    })
  );

  return conCliente;
}
export async function obtenerCarteraFiado() {
  const ventasFiado = await db.ventas
    .where('modalidad')
    .equals('fiado')
    .toArray();

  const resultado = [];
  for (const venta of ventasFiado) {
    await actualizarEstadoFiado(venta.id);
    const ventaActualizada = await db.ventas.get(venta.id);
    const saldo = await saldoPendienteVenta(venta.id);
    const cliente = await db.clientes.get(venta.cliente_id);

    resultado.push({
      ...ventaActualizada,
      saldo_pendiente: saldo,
      cliente_nombre: cliente?.nombre ?? '(cliente no encontrado)',
    });
  }

  return resultado;
}
