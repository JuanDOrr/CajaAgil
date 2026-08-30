// PantallaInventario.jsx

import { useState, useEffect, useCallback } from 'react';
import { db } from '../db.js';
import { generarId } from '../utils.js';
import { registrarEvento } from '../eventos.js';
import {
  calcularStock,
  colorStock,
  registrarMovimientoInventario,
  buscarProductoPorCodigoBarras,
  exportarInventarioExcel,
  exportarInventarioPDF,
} from '../inventario.js';
import { EntradaCodigoBarras } from '../EntradaCodigoBarras.jsx';

export function PantallaInventario() {
  const [productos, setProductos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [productoEditando, setProductoEditando] = useState(null); // null = cerrado, {} = nuevo
  const [cargando, setCargando] = useState(true);
  const [exportando, setExportando] = useState(null); // 'pdf' | 'excel' | null

  const cargarProductos = useCallback(async () => {
    const todos = await db.productos.where('activo').equals(1).toArray();
    const conStock = await Promise.all(
      todos.map(async (p) => ({ ...p, stockActual: await calcularStock(p.id) }))
    );
    setProductos(conStock);
    setCargando(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- cargarProductos es async: los setState ocurren después del await, no de forma síncrona en el efecto.
    cargarProductos();
  }, [cargarProductos]);

  const productosFiltrados = productos.filter((p) =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  async function manejarCodigoEscaneado(codigo) {
    const producto = await buscarProductoPorCodigoBarras(codigo);
    if (producto) {
      setProductoEditando(producto);
    } else {
      // Código no encontrado: abrir formulario de producto nuevo con
      // el código ya pre-llenado, para agilizar el alta.
      setProductoEditando({ codigo_barras: codigo });
    }
  }

  async function manejarExportar(formato) {
    setExportando(formato);
    try {
      if (formato === 'pdf') await exportarInventarioPDF();
      else await exportarInventarioExcel();
    } finally {
      setExportando(null);
    }
  }

  return (
    <div style={estilos.contenedor}>
      <header style={estilos.encabezado}>
        <h1 style={estilos.titulo}>Inventario</h1>
        <button style={estilos.botonPrimario} onClick={() => setProductoEditando({})}>
          + Producto
        </button>
      </header>

      <input
        type="text"
        placeholder="Buscar producto..."
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        style={estilos.buscador}
      />

      <div style={estilos.filaExportar}>
        <button
          style={estilos.botonExportar}
          onClick={() => manejarExportar('pdf')}
          disabled={exportando !== null}
        >
          {exportando === 'pdf' ? 'Generando...' : '📄 Exportar PDF'}
        </button>
        <button
          style={estilos.botonExportar}
          onClick={() => manejarExportar('excel')}
          disabled={exportando !== null}
        >
          {exportando === 'excel' ? 'Generando...' : '📊 Exportar Excel'}
        </button>
      </div>

      <div style={estilos.seccionEscaner}>
        <EntradaCodigoBarras onCodigoDetectado={manejarCodigoEscaneado} />
      </div>

      {cargando ? (
        <p>Cargando productos...</p>
      ) : productosFiltrados.length === 0 ? (
        <EstadoVacio busqueda={busqueda} />
      ) : (
        <ul style={estilos.lista}>
          {productosFiltrados.map((producto) => (
            <FilaProducto
              key={producto.id}
              producto={producto}
              onClic={() => setProductoEditando(producto)}
            />
          ))}
        </ul>
      )}

      {productoEditando !== null && (
        <FormularioProducto
          producto={productoEditando}
          onCerrar={() => setProductoEditando(null)}
          onGuardado={() => {
            setProductoEditando(null);
            cargarProductos();
          }}
        />
      )}
    </div>
  );
}

function EstadoVacio({ busqueda }) {
  return (
    <div style={estilos.estadoVacio}>
      {busqueda ? (
        <p>No hay productos que coincidan con "{busqueda}".</p>
      ) : (
        <>
          <p>Todavía no hay productos en el inventario.</p>
          <p style={{ color: 'var(--color-ink-suave)', fontSize: '0.9rem' }}>
            Usa "+ Producto" o escanea un código para agregar el primero.
          </p>
        </>
      )}
    </div>
  );
}

function FilaProducto({ producto, onClic }) {
  const color = colorStock(producto.stockActual);
  const coloresFondo = {
    verde: 'var(--color-stock-verde-bg)',
    amarillo: 'var(--color-stock-amarillo-bg)',
    rojo: 'var(--color-stock-rojo-bg)',
  };
  const coloresTexto = {
    verde: 'var(--color-stock-verde)',
    amarillo: 'var(--color-stock-amarillo)',
    rojo: 'var(--color-stock-rojo)',
  };

  return (
    <li>
      <button style={estilos.filaProducto} onClick={onClic}>
        <div style={{ textAlign: 'left' }}>
          <p style={estilos.nombreProducto}>{producto.nombre}</p>
          <p className="dinero" style={estilos.precioProducto}>
            ${producto.precio_venta.toLocaleString('es-CO')}
          </p>
        </div>
        <span
          className="numero"
          style={{
            ...estilos.chipStock,
            background: coloresFondo[color],
            color: coloresTexto[color],
          }}
        >
          {producto.stockActual} und.
        </span>
      </button>
    </li>
  );
}

function FormularioProducto({ producto, onCerrar, onGuardado }) {
  const esNuevo = !producto.id;
  const [nombre, setNombre] = useState(producto.nombre ?? '');
  const [precioVenta, setPrecioVenta] = useState(producto.precio_venta ?? '');
  const [costoCompra, setCostoCompra] = useState(producto.costo_compra ?? '');
  const [stockInicial, setStockInicial] = useState('');
  const [codigoBarras, setCodigoBarras] = useState(producto.codigo_barras ?? '');
  const [notas, setNotas] = useState(producto.notas ?? '');
  const [guardando, setGuardando] = useState(false);

  async function manejarGuardar(e) {
    e.preventDefault();
    setGuardando(true);

    if (esNuevo) {
      const nuevoProducto = {
        id: generarId(),
        nombre,
        precio_venta: Number(precioVenta),
        costo_compra: Number(costoCompra),
        codigo_barras: codigoBarras || null,
        notas: notas || null,
        activo: 1,
        updated_at: new Date().toISOString(),
      };

      await db.productos.add(nuevoProducto);
      await registrarEvento({ entidad: 'producto', accion: 'crear', payload: nuevoProducto });

      // Si se indicó stock inicial, registrar el movimiento correspondiente
      if (Number(stockInicial) > 0) {
        await registrarMovimientoInventario({
          productoId: nuevoProducto.id,
          tipo: 'entrada_mercancia',
          cantidad: Number(stockInicial),
          costoUnitario: Number(costoCompra),
          notas: 'Stock inicial al crear el producto',
        });
      }
    } else {
      const actualizado = {
        ...producto,
        nombre,
        precio_venta: Number(precioVenta),
        costo_compra: Number(costoCompra),
        codigo_barras: codigoBarras || null,
        notas: notas || null,
        updated_at: new Date().toISOString(),
      };

      await db.productos.put(actualizado);
      await registrarEvento({ entidad: 'producto', accion: 'editar', payload: actualizado });
    }

    setGuardando(false);
    onGuardado();
  }

  async function manejarDesactivar() {
    if (!confirm(`¿Quitar "${nombre}" del inventario? No se borra el historial de ventas.`)) {
      return;
    }
    const desactivado = { ...producto, activo: 0, updated_at: new Date().toISOString() };
    await db.productos.put(desactivado);
    await registrarEvento({ entidad: 'producto', accion: 'desactivar', payload: desactivado });
    onGuardado();
  }

  return (
    <div style={estilos.overlay}>
      <form style={estilos.panelFormulario} onSubmit={manejarGuardar}>
        <h2 style={estilos.tituloFormulario}>
          {esNuevo ? 'Nuevo producto' : 'Editar producto'}
        </h2>

        <Campo etiqueta="Nombre">
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} required style={estilos.input} />
        </Campo>

        <Campo etiqueta="Precio de venta">
          <input
            type="number"
            value={precioVenta}
            onChange={(e) => setPrecioVenta(e.target.value)}
            required
            min="0"
            style={estilos.input}
          />
        </Campo>

        <Campo etiqueta="Costo de compra">
          <input
            type="number"
            value={costoCompra}
            onChange={(e) => setCostoCompra(e.target.value)}
            required
            min="0"
            style={estilos.input}
          />
        </Campo>

        {esNuevo && (
          <Campo etiqueta="Stock inicial (opcional)">
            <input
              type="number"
              value={stockInicial}
              onChange={(e) => setStockInicial(e.target.value)}
              min="0"
              style={estilos.input}
            />
          </Campo>
        )}

        <Campo etiqueta="Código de barras (opcional)">
          <input
            value={codigoBarras}
            onChange={(e) => setCodigoBarras(e.target.value)}
            style={estilos.input}
          />
        </Campo>

        <Campo etiqueta="Notas (opcional)">
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            style={{ ...estilos.input, minHeight: '60px' }}
          />
        </Campo>

        <div style={estilos.accionesFormulario}>
          <button type="button" onClick={onCerrar} style={estilos.botonSecundario}>
            Cancelar
          </button>
          <button type="submit" disabled={guardando} style={estilos.botonPrimario}>
            {guardando ? 'Guardando...' : 'Guardar'}
          </button>
        </div>

        {!esNuevo && (
          <button type="button" onClick={manejarDesactivar} style={estilos.botonEliminar}>
            Quitar del inventario
          </button>
        )}
      </form>
    </div>
  );
}

function Campo({ etiqueta, children }) {
  return (
    <label style={estilos.campo}>
      <span style={estilos.etiquetaCampo}>{etiqueta}</span>
      {children}
    </label>
  );
}

const estilos = {
  contenedor: {
    padding: 'var(--espacio-md)',
    maxWidth: '600px',
    margin: '0 auto',
  },
  encabezado: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 'var(--espacio-md)',
  },
  titulo: {
    fontSize: '1.5rem',
    color: 'var(--color-navy)',
  },
  buscador: {
    width: '100%',
    padding: '0.7rem',
    borderRadius: 'var(--radio-sm)',
    border: '1px solid var(--color-border)',
    fontSize: '1rem',
    marginBottom: 'var(--espacio-sm)',
  },
  seccionEscaner: {
    marginBottom: 'var(--espacio-md)',
  },
  filaExportar: {
    display: 'flex',
    gap: 'var(--espacio-sm)',
    marginBottom: 'var(--espacio-md)',
  },
  botonExportar: {
    flex: 1,
    padding: '0.6rem',
    background: 'var(--color-paper-alt)',
    color: 'var(--color-navy)',
    border: 'none',
    borderRadius: 'var(--radio-sm)',
    fontWeight: 600,
    fontSize: '0.85rem',
  },
  lista: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--espacio-sm)',
  },
  filaProducto: {
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: 'white',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radio-md)',
    padding: 'var(--espacio-md)',
    textAlign: 'left',
  },
  nombreProducto: {
    margin: 0,
    fontWeight: 600,
    color: 'var(--color-ink)',
  },
  precioProducto: {
    margin: '4px 0 0',
    color: 'var(--color-ink-suave)',
    fontSize: '0.9rem',
  },
  chipStock: {
    padding: '4px 10px',
    borderRadius: '999px',
    fontSize: '0.8rem',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  estadoVacio: {
    textAlign: 'center',
    padding: 'var(--espacio-xl)',
    color: 'var(--color-ink-suave)',
  },
  botonPrimario: {
    background: 'var(--color-teal)',
    color: 'white',
    border: 'none',
    borderRadius: 'var(--radio-sm)',
    padding: '0.6rem 1.2rem',
    fontWeight: 600,
  },
  botonSecundario: {
    background: 'var(--color-paper-alt)',
    color: 'var(--color-ink)',
    border: 'none',
    borderRadius: 'var(--radio-sm)',
    padding: '0.6rem 1.2rem',
    fontWeight: 600,
  },
  botonEliminar: {
    marginTop: 'var(--espacio-md)',
    background: 'none',
    border: 'none',
    color: 'var(--color-peligro)',
    fontSize: '0.9rem',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(26, 35, 50, 0.5)',
    display: 'flex',
    alignItems: 'flex-end',
    zIndex: 200,
  },
  panelFormulario: {
    background: 'white',
    width: '100%',
    maxHeight: '90vh',
    overflowY: 'auto',
    borderRadius: '16px 16px 0 0',
    padding: 'var(--espacio-lg)',
  },
  tituloFormulario: {
    fontSize: '1.2rem',
    marginBottom: 'var(--espacio-md)',
    color: 'var(--color-navy)',
  },
  campo: {
    display: 'block',
    marginBottom: 'var(--espacio-md)',
  },
  etiquetaCampo: {
    display: 'block',
    fontSize: '0.85rem',
    fontWeight: 600,
    marginBottom: '4px',
    color: 'var(--color-ink-suave)',
  },
  input: {
    width: '100%',
    padding: '0.6rem',
    borderRadius: 'var(--radio-sm)',
    border: '1px solid var(--color-border)',
    fontSize: '1rem',
    fontFamily: 'var(--fuente-texto)',
  },
  accionesFormulario: {
    display: 'flex',
    gap: 'var(--espacio-sm)',
    marginTop: 'var(--espacio-lg)',
  },
};
