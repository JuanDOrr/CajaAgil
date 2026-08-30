// clientes.js

import { db } from './db.js';
import { generarId } from './utils.js';
import { registrarEvento } from './eventos.js';

export async function crearCliente({ nombre, cedula, telefono = null, direccion = null }) {
  const cliente = {
    id: generarId(),
    nombre,
    cedula,
    telefono,
    direccion,
    activo: 1,
    updated_at: new Date().toISOString(),
  };

  await db.clientes.add(cliente);

  await registrarEvento({
    entidad: 'cliente',
    accion: 'crear',
    payload: cliente,
  });

  return cliente;
}

export async function editarCliente(id, cambios) {
  const actualizado = {
    ...cambios,
    updated_at: new Date().toISOString(),
  };

  await db.clientes.update(id, actualizado);
  const clienteCompleto = await db.clientes.get(id);

  await registrarEvento({
    entidad: 'cliente',
    accion: 'editar',
    payload: clienteCompleto,
  });

  return clienteCompleto;
}

export async function buscarClientes(texto) {
  if (!texto) return db.clientes.where('activo').equals(1).toArray();

  const textoLower = texto.toLowerCase();
  const todos = await db.clientes.where('activo').equals(1).toArray();

  return todos.filter(
    (c) =>
      c.nombre.toLowerCase().includes(textoLower) ||
      c.cedula.includes(texto)
  );
}

// Saldo pendiente total de un cliente, sumando todas sus ventas a
// fiado no pagadas por completo. Útil para mostrar "este cliente
// debe $X" antes de aprobar una nueva venta a crédito.
export async function saldoPendienteCliente(clienteId) {
  const ventasFiado = await db.ventas
    .where('cliente_id')
    .equals(clienteId)
    .and((v) => v.modalidad === 'fiado')
    .toArray();

  let saldoTotal = 0;

  for (const venta of ventasFiado) {
    const pagos = await db.pagos_fiado.where('venta_id').equals(venta.id).toArray();
    const totalPagado = pagos.reduce((sum, p) => sum + p.monto, 0);
    saldoTotal += venta.total - totalPagado;
  }

  return saldoTotal;
}
