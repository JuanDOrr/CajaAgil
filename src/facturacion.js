// facturacion.js
//
// Genera la factura en PDF directamente en el navegador (funciona
// offline, no depende de un servidor). Usa pdfmake, que construye el
// PDF a partir de un objeto de definición de documento en JS.
//
// Instalación: npm install pdfmake

import pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';
import { db } from './db.js';

// Distintas versiones de pdfmake exportan las fuentes en formas
// distintas — esto cubre ambos casos sin romper según la versión
// instalada.
pdfMake.vfs =
  pdfFonts.default?.pdfMake?.vfs ??
  pdfFonts.pdfMake?.vfs ??
  pdfFonts.vfs ??
  pdfFonts.default?.vfs;

// Arma y descarga el PDF de una factura ya existente (venta_id).
export async function generarFacturaPDF(ventaId) {
  const venta = await db.ventas.get(ventaId);
  if (!venta) throw new Error('Venta no encontrada.');

  const items = await db.venta_items.where('venta_id').equals(ventaId).toArray();
  const config = await db.negocio_config.get('config');

  const cliente = venta.cliente_id
    ? await db.clientes.get(venta.cliente_id)
    : null;

  // Resolver nombre de cada producto para mostrarlo en la tabla
  const filasProductos = [];
  for (const item of items) {
    const producto = await db.productos.get(item.producto_id);
    filasProductos.push([
      producto?.nombre ?? '(producto eliminado)',
      item.cantidad.toString(),
      formatearMoneda(item.precio_unitario),
      formatearMoneda(item.precio_unitario * item.cantidad),
    ]);
  }

  const docDefinition = {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 40],
    content: [
      // --- Encabezado: logo + datos del negocio ---
      {
        columns: [
          config?.logo_base64
            ? { image: config.logo_base64, width: 90 }
            : { text: '' },
          {
            width: '*',
            stack: [
              { text: config?.nombre_negocio ?? 'Mi Negocio', style: 'nombreNegocio' },
              { text: config?.direccion ?? '', style: 'textoChico' },
              { text: config?.telefono ?? '', style: 'textoChico' },
            ],
            alignment: 'right',
          },
        ],
      },
      { text: ' ', margin: [0, 10] },

      // --- Datos de la factura ---
      {
        columns: [
          {
            text: [
              { text: 'Factura N°: ', bold: true },
              venta.numero_factura,
            ],
          },
          {
            text: [
              { text: 'Fecha: ', bold: true },
              new Date(venta.fecha).toLocaleDateString('es-CO'),
            ],
            alignment: 'right',
          },
        ],
      },

      // --- Datos del cliente (solo si es fiado) ---
      ...(cliente
        ? [
            { text: ' ', margin: [0, 5] },
            { text: 'Cliente', style: 'subtitulo' },
            { text: `${cliente.nombre} — C.C. ${cliente.cedula}` },
            cliente.telefono ? { text: `Tel: ${cliente.telefono}` } : {},
          ]
        : []),

      { text: ' ', margin: [0, 10] },

      // --- Tabla de productos ---
      {
        table: {
          headerRows: 1,
          widths: ['*', 'auto', 'auto', 'auto'],
          body: [
            [
              { text: 'Producto', bold: true },
              { text: 'Cant.', bold: true },
              { text: 'Precio unit.', bold: true },
              { text: 'Subtotal', bold: true },
            ],
            ...filasProductos,
          ],
        },
      },

      { text: ' ', margin: [0, 10] },

      // --- Totales ---
      {
        columns: [
          { text: '', width: '*' },
          {
            width: 'auto',
            table: {
              body: [
                ['Subtotal', formatearMoneda(venta.subtotal)],
                ['Descuento', formatearMoneda(venta.descuento)],
                [
                  { text: 'Total', bold: true },
                  { text: formatearMoneda(venta.total), bold: true },
                ],
              ],
            },
            layout: 'noBorders',
          },
        ],
      },

      // --- Nota de fiado ---
      ...(venta.modalidad === 'fiado'
        ? [
            { text: ' ', margin: [0, 10] },
            {
              text: `Venta a crédito — vence el ${new Date(
                venta.fecha_vencimiento
              ).toLocaleDateString('es-CO')}`,
              style: 'notaFiado',
            },
          ]
        : []),
    ],

    styles: {
      nombreNegocio: { fontSize: 16, bold: true },
      textoChico: { fontSize: 9, color: '#555' },
      subtitulo: { fontSize: 11, bold: true, margin: [0, 5, 0, 2] },
      notaFiado: { italics: true, color: '#a15c00' },
    },
  };

  const pdf = pdfMake.createPdf(docDefinition);

  // download() funciona offline porque todo el trabajo ocurre en el
  // navegador; no requiere conexión a internet.
  pdf.download(`factura_${venta.numero_factura}.pdf`);
}

function formatearMoneda(valor) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(valor);
}
