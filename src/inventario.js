// inventario.js
// Ejemplo de cómo el stock se calcula (nunca se edita directamente)
// y cómo cada cambio genera también un evento para sincronización.

import { db } from './db.js';
import { generarId, obtenerDeviceId } from './utils.js';
import { registrarEvento } from './eventos.js';

// Calcula el stock actual de un producto sumando todos sus movimientos.
export async function calcularStock(productoId) {
  const movimientos = await db.movimientos_inventario
    .where('producto_id')
    .equals(productoId)
    .toArray();

  return movimientos.reduce((total, m) => total + m.cantidad, 0);
}

// Registra un movimiento de inventario (entrada, ajuste, devolución...)
// y crea el evento correspondiente para que se sincronice después.
export async function registrarMovimientoInventario({
  productoId,
  tipo, // 'venta' | 'entrada_mercancia' | 'ajuste_manual' | 'devolucion'
  cantidad, // negativo = sale stock, positivo = entra stock
  costoUnitario,
  ventaId = null,
  notas = null,
}) {
  const movimiento = {
    id: generarId(),
    producto_id: productoId,
    tipo,
    cantidad,
    costo_unitario: costoUnitario,
    venta_id: ventaId,
    fecha: new Date().toISOString(),
    notas,
  };

  await db.movimientos_inventario.add(movimiento);

  await registrarEvento({
    entidad: 'movimiento_inventario',
    accion: 'crear',
    payload: movimiento,
  });

  return movimiento;
}

// Colores de stock según las reglas del negocio:
// verde >= 5, amarillo 1-4, rojo 0
export function colorStock(stock) {
  if (stock >= 5) return 'verde';
  if (stock >= 1) return 'amarillo';
  return 'rojo';
}

// Busca un producto activo por su código de barras. Se usa tanto en
// inventario (para editar/consultar) como en ventas (para agregarlo
// directo al carrito al escanear).
export async function buscarProductoPorCodigoBarras(codigo) {
  const producto = await db.productos
    .where('codigo_barras')
    .equals(codigo)
    .and((p) => p.activo === 1)
    .first();

  return producto ?? null;
}

// --- Exportación del inventario completo ---

async function obtenerInventarioParaExportar() {
  const productos = await db.productos.where('activo').equals(1).toArray();
  const conStock = await Promise.all(
    productos.map(async (p) => ({ ...p, stockActual: await calcularStock(p.id) }))
  );
  conStock.sort((a, b) => a.nombre.localeCompare(b.nombre));
  return conStock;
}

export async function exportarInventarioExcel() {
  const productos = await obtenerInventarioParaExportar();
  const XLSX = await import('xlsx');

  const encabezado = ['Producto', 'Precio venta', 'Costo compra', 'Stock', 'Código de barras'];
  const filas = productos.map((p) => [
    p.nombre,
    p.precio_venta,
    p.costo_compra,
    p.stockActual,
    p.codigo_barras ?? '',
  ]);

  const hoja = XLSX.utils.aoa_to_sheet([['Inventario'], [], encabezado, ...filas]);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, 'Inventario');

  const fecha = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(libro, `inventario_${fecha}.xlsx`);
}

export async function exportarInventarioPDF() {
  const productos = await obtenerInventarioParaExportar();

  const pdfMake = (await import('pdfmake/build/pdfmake')).default;
  const pdfFonts = await import('pdfmake/build/vfs_fonts');
  pdfMake.vfs =
    pdfFonts.default?.pdfMake?.vfs ??
    pdfFonts.pdfMake?.vfs ??
    pdfFonts.vfs ??
    pdfFonts.default?.vfs;

  const formatearMoneda = (valor) =>
    new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(valor);

  const filas = productos.map((p) => [
    p.nombre,
    formatearMoneda(p.precio_venta),
    formatearMoneda(p.costo_compra),
    p.stockActual.toString(),
    p.codigo_barras ?? '—',
  ]);

  const docDefinition = {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 40],
    content: [
      { text: 'Inventario', style: 'titulo' },
      { text: new Date().toLocaleDateString('es-CO'), style: 'subtitulo' },
      { text: ' ', margin: [0, 10] },
      {
        table: {
          headerRows: 1,
          widths: ['*', 'auto', 'auto', 'auto', 'auto'],
          body: [
            [
              { text: 'Producto', bold: true },
              { text: 'Precio', bold: true },
              { text: 'Costo', bold: true },
              { text: 'Stock', bold: true },
              { text: 'Código', bold: true },
            ],
            ...filas,
          ],
        },
      },
    ],
    styles: {
      titulo: { fontSize: 16, bold: true },
      subtitulo: { fontSize: 10, color: '#555', margin: [0, 2, 0, 0] },
    },
  };

  const fecha = new Date().toISOString().slice(0, 10);
  pdfMake.createPdf(docDefinition).download(`inventario_${fecha}.pdf`);
}
