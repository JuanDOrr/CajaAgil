// gastos.js
//
// Gastos de caja menor: arriendo, aseo, servicios, transporte, etc.
// Siguen el mismo patrón del resto de la app — soft delete (activo)
// y cada cambio genera un evento para sincronización.

import { db } from './db.js';
import { generarId } from './utils.js';
import { registrarEvento } from './eventos.js';

export const CATEGORIAS_GASTO = ['arriendo', 'aseo', 'servicios', 'transporte', 'otros'];

export async function crearGasto({ descripcion, monto, categoria, fecha }) {
  const gasto = {
    id: generarId(),
    descripcion,
    monto: Number(monto),
    categoria,
    fecha: fecha ?? new Date().toISOString(),
    activo: 1,
    updated_at: new Date().toISOString(),
  };

  await db.gastos.add(gasto);
  await registrarEvento({ entidad: 'gasto', accion: 'crear', payload: gasto });

  return gasto;
}

export async function eliminarGasto(id) {
  const gasto = await db.gastos.get(id);
  if (!gasto) return;

  const desactivado = { ...gasto, activo: 0, updated_at: new Date().toISOString() };
  await db.gastos.put(desactivado);
  await registrarEvento({ entidad: 'gasto', accion: 'desactivar', payload: desactivado });
}

export async function listarGastosPorRango({ desde, hasta }) {
  const desdeISO = desde.toISOString();
  const hastaISO = hasta.toISOString();

  const todos = await db.gastos.where('activo').equals(1).toArray();
  const enRango = todos.filter((g) => g.fecha >= desdeISO && g.fecha <= hastaISO);
  enRango.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  return enRango;
}

export async function totalGastosPorRango(rango) {
  const gastos = await listarGastosPorRango(rango);
  return gastos.reduce((sum, g) => sum + g.monto, 0);
}
