// reportes.js
//
// Genera el reporte de ventas para un rango de fechas: total vendido,
// costo de mercancía, utilidad bruta, margen, y desglose por producto.
// Incluye exportación a PDF (pdfmake) y a Excel (SheetJS / xlsx).

import { db } from './db.js';

// --- Atajos de rango de fechas ---
export function rangoHoy() {
  const hoy = new Date();
  const inicio = new Date(hoy.setHours(0, 0, 0, 0));
  const fin = new Date(hoy.setHours(23, 59, 59, 999));
  return { desde: inicio, hasta: fin };
}

export function rangoSemanaActual() {
  const hoy = new Date();
  const diaSemana = hoy.getDay(); // 0 = domingo
  const inicio = new Date(hoy);
  inicio.setDate(hoy.getDate() - diaSemana);
  inicio.setHours(0, 0, 0, 0);

  const fin = new Date(inicio);
  fin.setDate(inicio.getDate() + 6);
  fin.setHours(23, 59, 59, 999);

  return { desde: inicio, hasta: fin };
}

export function rangoMesActual() {
  const hoy = new Date();
  const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const fin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59, 999);
  return { desde: inicio, hasta: fin };
}

// --- Cálculo principal del reporte ---
// desde/hasta: objetos Date. Cubre también rangos "personalizados".
export async function generarReporte({ desde, hasta }) {
  const desdeISO = desde.toISOString();
  const hastaISO = hasta.toISOString();

  const ventasEnRango = await db.ventas
    .where('fecha')
    .between(desdeISO, hastaISO, true, true)
    .toArray();

  let totalVentas = 0;
  let costoTotalMercancia = 0;

  // Acumulador por producto para el desglose
  const porProducto = {}; // producto_id -> { nombre, cantidad, ventas, costo, utilidad }

  for (const venta of ventasEnRango) {
    totalVentas += venta.total;

    const items = await db.venta_items.where('venta_id').equals(venta.id).toArray();

    for (const item of items) {
      const ventaLinea = item.precio_unitario * item.cantidad;
      const costoLinea = item.costo_unitario * item.cantidad;
      costoTotalMercancia += costoLinea;

      if (!porProducto[item.producto_id]) {
        const producto = await db.productos.get(item.producto_id);
        porProducto[item.producto_id] = {
          producto_id: item.producto_id,
          nombre: producto?.nombre ?? '(producto eliminado)',
          cantidad: 0,
          ventas: 0,
          costo: 0,
        };
      }

      porProducto[item.producto_id].cantidad += item.cantidad;
      porProducto[item.producto_id].ventas += ventaLinea;
      porProducto[item.producto_id].costo += costoLinea;
    }
  }

  const utilidadBruta = totalVentas - costoTotalMercancia;
  const margen = totalVentas > 0 ? (utilidadBruta / totalVentas) * 100 : 0;

  const desglosePorProducto = Object.values(porProducto)
    .map((p) => ({
      ...p,
      utilidad: p.ventas - p.costo,
      margen: p.ventas > 0 ? ((p.ventas - p.costo) / p.ventas) * 100 : 0,
    }))
    .sort((a, b) => b.ventas - a.ventas); // Mayor a menor venta

  return {
    rango: { desde, hasta },
    totalVentas,
    costoTotalMercancia,
    utilidadBruta,
    margen,
    numeroVentas: ventasEnRango.length,
    desglosePorProducto,
  };
}

// --- Exportar a Excel (usa la librería xlsx / SheetJS) ---
// Instalación: npm install xlsx
export function exportarReporteExcel(reporte) {
  // Import dinámico para no cargar la librería si no se usa esta función
  return import('xlsx').then((XLSX) => {
    const resumen = [
      ['Reporte de ventas'],
      [
        `Del ${reporte.rango.desde.toLocaleDateString('es-CO')} al ${reporte.rango.hasta.toLocaleDateString('es-CO')}`,
      ],
      [],
      ['Total ventas', reporte.totalVentas],
      ['Costo de mercancía', reporte.costoTotalMercancia],
      ['Utilidad bruta', reporte.utilidadBruta],
      ['Margen (%)', reporte.margen.toFixed(1)],
      ['Número de ventas', reporte.numeroVentas],
    ];

    const encabezadoDesglose = ['Producto', 'Cantidad', 'Ventas', 'Costo', 'Utilidad', 'Margen (%)'];
    const filasDesglose = reporte.desglosePorProducto.map((p) => [
      p.nombre,
      p.cantidad,
      p.ventas,
      p.costo,
      p.utilidad,
      p.margen.toFixed(1),
    ]);

    const hoja = XLSX.utils.aoa_to_sheet([
      ...resumen,
      [],
      encabezadoDesglose,
      ...filasDesglose,
    ]);

    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, 'Reporte');

    XLSX.writeFile(libro, `reporte_${formatearNombreArchivo(reporte.rango)}.xlsx`);
  });
}

// --- Exportar a PDF (usa pdfmake, igual que facturacion.js) ---
export async function exportarReportePDF(reporte) {
  const pdfMake = (await import('pdfmake/build/pdfmake')).default;
  const pdfFonts = await import('pdfmake/build/vfs_fonts');

  pdfMake.vfs =
    pdfFonts.default?.pdfMake?.vfs ??
    pdfFonts.pdfMake?.vfs ??
    pdfFonts.vfs ??
    pdfFonts.default?.vfs;

  const filasDesglose = reporte.desglosePorProducto.map((p) => [
    p.nombre,
    p.cantidad.toString(),
    formatearMoneda(p.ventas),
    formatearMoneda(p.costo),
    formatearMoneda(p.utilidad),
    `${p.margen.toFixed(1)}%`,
  ]);

  const docDefinition = {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 40],
    content: [
      { text: 'Reporte de ventas', style: 'titulo' },
      {
        text: `Del ${reporte.rango.desde.toLocaleDateString('es-CO')} al ${reporte.rango.hasta.toLocaleDateString('es-CO')}`,
        style: 'subtitulo',
      },
      { text: ' ', margin: [0, 10] },

      {
        columns: [
          { text: [{ text: 'Total ventas: ', bold: true }, formatearMoneda(reporte.totalVentas)] },
          { text: [{ text: 'N° de ventas: ', bold: true }, reporte.numeroVentas.toString()] },
        ],
      },
      {
        columns: [
          { text: [{ text: 'Costo mercancía: ', bold: true }, formatearMoneda(reporte.costoTotalMercancia)] },
          { text: [{ text: 'Margen: ', bold: true }, `${reporte.margen.toFixed(1)}%`] },
        ],
      },
      {
        text: [{ text: 'Utilidad bruta: ', bold: true }, formatearMoneda(reporte.utilidadBruta)],
        margin: [0, 5, 0, 15],
      },

      { text: 'Desglose por producto', style: 'subtitulo' },
      {
        table: {
          headerRows: 1,
          widths: ['*', 'auto', 'auto', 'auto', 'auto', 'auto'],
          body: [
            [
              { text: 'Producto', bold: true },
              { text: 'Cant.', bold: true },
              { text: 'Ventas', bold: true },
              { text: 'Costo', bold: true },
              { text: 'Utilidad', bold: true },
              { text: 'Margen', bold: true },
            ],
            ...filasDesglose,
          ],
        },
      },
    ],
    styles: {
      titulo: { fontSize: 16, bold: true },
      subtitulo: { fontSize: 11, bold: true, margin: [0, 5, 0, 8], color: '#555' },
    },
  };

  pdfMake.createPdf(docDefinition).download(`reporte_${formatearNombreArchivo(reporte.rango)}.pdf`);
}

function formatearMoneda(valor) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(valor);
}

function formatearNombreArchivo({ desde, hasta }) {
  const f = (d) => d.toISOString().slice(0, 10);
  return `${f(desde)}_a_${f(hasta)}`;
}
