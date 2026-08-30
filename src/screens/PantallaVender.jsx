// PantallaVender.jsx

import { useState, useEffect } from 'react';
import { db } from '../db.js';
import { buscarProductoPorCodigoBarras, calcularStock } from '../inventario.js';
import { buscarClientes, saldoPendienteCliente, crearCliente } from '../clientes.js';
import { finalizarVenta, obtenerVentasRecientes, buscarVentaPorFactura } from '../ventas.js';
import { generarFacturaPDF } from '../facturacion.js';
import { EntradaCodigoBarras } from '../EntradaCodigoBarras.jsx';

export function PantallaVender() {
  const [carrito, setCarrito] = useState([]); // [{producto_id, nombre, cantidad, precio_unitario, costo_unitario}]
  const [busquedaProducto, setBusquedaProducto] = useState('');
  const [resultadosBusqueda, setResultadosBusqueda] = useState([]);
  const [modalidad, setModalidad] = useState('contado'); // 'contado' | 'fiado'
  const [descuento, setDescuento] = useState('');
  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);
  const [diasCredito, setDiasCredito] = useState(15);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState(null);
  const [mostrarPreview, setMostrarPreview] = useState(false);
  const [fechaVencimientoPreview, setFechaVencimientoPreview] = useState(null);
  const [ventaFinalizada, setVentaFinalizada] = useState(null);

  const subtotal = carrito.reduce((sum, item) => sum + item.precio_unitario * item.cantidad, 0);
  const total = Math.max(0, subtotal - (Number(descuento) || 0));

  async function manejarBusquedaProducto(texto) {
    setBusquedaProducto(texto);
    if (texto.length < 2) {
      setResultadosBusqueda([]);
      return;
    }
    const todos = await db.productos.where('activo').equals(1).toArray();
    const filtrados = todos.filter((p) => p.nombre.toLowerCase().includes(texto.toLowerCase()));
    setResultadosBusqueda(filtrados.slice(0, 6));
  }

  async function agregarAlCarrito(producto) {
    const stockDisponible = await calcularStock(producto.id);

    setCarrito((actual) => {
      const yaEsta = actual.find((item) => item.producto_id === producto.id);
      const cantidadActual = yaEsta ? yaEsta.cantidad : 0;

      if (cantidadActual + 1 > stockDisponible) {
        setError(`Solo hay ${stockDisponible} unidades disponibles de "${producto.nombre}".`);
        return actual;
      }

      setError(null);

      if (yaEsta) {
        return actual.map((item) =>
          item.producto_id === producto.id ? { ...item, cantidad: item.cantidad + 1 } : item
        );
      }

      return [
        ...actual,
        {
          producto_id: producto.id,
          nombre: producto.nombre,
          cantidad: 1,
          precio_unitario: producto.precio_venta,
          costo_unitario: producto.costo_compra,
          stockDisponible,
        },
      ];
    });

    setBusquedaProducto('');
    setResultadosBusqueda([]);
  }

  async function manejarCodigoEscaneado(codigo) {
    const producto = await buscarProductoPorCodigoBarras(codigo);
    if (producto) {
      agregarAlCarrito(producto);
    } else {
      setError(`No se encontró ningún producto con el código "${codigo}".`);
    }
  }

  function cambiarCantidad(productoId, nuevaCantidad) {
    setCarrito((actual) =>
      actual
        .map((item) => {
          if (item.producto_id !== productoId) return item;
          if (nuevaCantidad > item.stockDisponible) {
            setError(`Solo hay ${item.stockDisponible} unidades disponibles de "${item.nombre}".`);
            return item;
          }
          setError(null);
          return { ...item, cantidad: nuevaCantidad };
        })
        .filter((item) => item.cantidad > 0)
    );
  }

  function quitarDelCarrito(productoId) {
    setCarrito((actual) => actual.filter((item) => item.producto_id !== productoId));
  }

  function reiniciarVenta() {
    setCarrito([]);
    setDescuento('');
    setModalidad('contado');
    setClienteSeleccionado(null);
    setVentaFinalizada(null);
    setError(null);
  }

  function manejarAbrirPreview() {
    if (carrito.length === 0) {
      setError('Agrega al menos un producto antes de finalizar.');
      return;
    }
    if (modalidad === 'fiado' && !clienteSeleccionado) {
      setError('Selecciona un cliente para una venta a fiado.');
      return;
    }
    setError(null);
    setFechaVencimientoPreview(
      modalidad === 'fiado'
        ? new Date(Date.now() + Number(diasCredito) * 24 * 60 * 60 * 1000)
        : null
    );
    setMostrarPreview(true);
  }

  async function manejarConfirmarVenta() {
    setProcesando(true);
    setError(null);

    try {
      const resultado = await finalizarVenta({
        items: carrito.map((item) => ({
          producto_id: item.producto_id,
          cantidad: item.cantidad,
          precio_unitario: item.precio_unitario,
          costo_unitario: item.costo_unitario,
        })),
        modalidad,
        clienteId: clienteSeleccionado?.id ?? null,
        descuento: Number(descuento) || 0,
        diasCredito: Number(diasCredito),
      });

      setMostrarPreview(false);
      setVentaFinalizada(resultado.venta);
    } catch (err) {
      setMostrarPreview(false);
      setError(err.message);
    } finally {
      setProcesando(false);
    }
  }

  // --- Pantalla de confirmación tras finalizar ---
  if (ventaFinalizada) {
    return (
      <div style={estilos.contenedor}>
        <div style={estilos.confirmacion}>
          <p style={estilos.confirmacionIcono}>✓</p>
          <h2 style={estilos.confirmacionTitulo}>Venta registrada</h2>
          <p className="dinero" style={estilos.confirmacionTotal}>
            ${ventaFinalizada.total.toLocaleString('es-CO')}
          </p>
          <p style={estilos.confirmacionFactura}>Factura {ventaFinalizada.numero_factura}</p>

          <button
            style={estilos.botonPrimario}
            onClick={() => generarFacturaPDF(ventaFinalizada.id)}
          >
            Descargar factura PDF
          </button>
          <button style={estilos.botonSecundario} onClick={reiniciarVenta}>
            Nueva venta
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={estilos.contenedor}>
      <h1 style={estilos.titulo}>Vender</h1>

      {error && <div style={estilos.avisoError}>{error}</div>}

      {/* --- Búsqueda y escaneo de productos --- */}
      <div style={estilos.seccionBusqueda}>
        <input
          type="text"
          placeholder="Buscar producto por nombre..."
          value={busquedaProducto}
          onChange={(e) => manejarBusquedaProducto(e.target.value)}
          style={estilos.buscador}
        />
        {resultadosBusqueda.length > 0 && (
          <ul style={estilos.resultadosBusqueda}>
            {resultadosBusqueda.map((producto) => (
              <li key={producto.id}>
                <button style={estilos.resultadoItem} onClick={() => agregarAlCarrito(producto)}>
                  <span>{producto.nombre}</span>
                  <span className="dinero">${producto.precio_venta.toLocaleString('es-CO')}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <EntradaCodigoBarras onCodigoDetectado={manejarCodigoEscaneado} />
      </div>

      {/* --- Carrito estilo tiquete --- */}
      <div style={estilos.tiquete}>
        {carrito.length === 0 ? (
          <p style={estilos.tiqueteVacio}>El carrito está vacío. Busca o escanea un producto.</p>
        ) : (
          <ul style={estilos.listaCarrito}>
            {carrito.map((item) => (
              <li key={item.producto_id} style={estilos.itemCarrito}>
                <div style={{ flex: 1 }}>
                  <p style={estilos.nombreItem}>{item.nombre}</p>
                  <p className="dinero" style={estilos.precioItem}>
                    ${item.precio_unitario.toLocaleString('es-CO')} c/u
                  </p>
                </div>
                <div style={estilos.controlCantidad}>
                  <button
                    style={estilos.botonCantidad}
                    onClick={() => cambiarCantidad(item.producto_id, item.cantidad - 1)}
                  >
                    −
                  </button>
                  <span className="numero" style={estilos.cantidadTexto}>{item.cantidad}</span>
                  <button
                    style={estilos.botonCantidad}
                    onClick={() => cambiarCantidad(item.producto_id, item.cantidad + 1)}
                  >
                    +
                  </button>
                </div>
                <button style={estilos.botonQuitar} onClick={() => quitarDelCarrito(item.producto_id)}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}

        {carrito.length > 0 && (
          <>
            <div style={estilos.lineaDivisoria} />

            <label style={estilos.filaDescuento}>
              <span>Descuento</span>
              <input
                type="number"
                min="0"
                value={descuento}
                onChange={(e) => setDescuento(e.target.value)}
                placeholder="0"
                style={estilos.inputDescuento}
                className="dinero"
              />
            </label>

            <div style={estilos.filaTotal}>
              <span>Total</span>
              <span className="dinero">${total.toLocaleString('es-CO')}</span>
            </div>
          </>
        )}
      </div>

      {carrito.length === 0 && <HistorialVentas />}

      {/* --- Modalidad de pago --- */}
      {carrito.length > 0 && (
        <>
          <div style={estilos.selectorModalidad}>
            <button
              style={{
                ...estilos.botonModalidad,
                ...(modalidad === 'contado' ? estilos.botonModalidadActivo : {}),
              }}
              onClick={() => setModalidad('contado')}
            >
              Contado
            </button>
            <button
              style={{
                ...estilos.botonModalidad,
                ...(modalidad === 'fiado' ? estilos.botonModalidadActivo : {}),
              }}
              onClick={() => setModalidad('fiado')}
            >
              Fiado
            </button>
          </div>

          <SelectorCliente
            modalidad={modalidad}
            clienteSeleccionado={clienteSeleccionado}
            onSeleccionar={setClienteSeleccionado}
            diasCredito={diasCredito}
            onCambiarDias={setDiasCredito}
          />

          <button
            style={estilos.botonFinalizar}
            onClick={manejarAbrirPreview}
          >
            Revisar venta — ${total.toLocaleString('es-CO')}
          </button>
        </>
      )}

      {mostrarPreview && (
        <ModalPreviewVenta
          carrito={carrito}
          subtotal={subtotal}
          descuento={Number(descuento) || 0}
          total={total}
          modalidad={modalidad}
          clienteSeleccionado={clienteSeleccionado}
          fechaVencimiento={fechaVencimientoPreview}
          procesando={procesando}
          onEditar={() => setMostrarPreview(false)}
          onConfirmar={manejarConfirmarVenta}
        />
      )}
    </div>
  );
}

function HistorialVentas() {
  const [ventas, setVentas] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    obtenerVentasRecientes().then((datos) => {
      setVentas(datos);
      setCargando(false);
    });
  }, []);

  async function manejarBusqueda(texto) {
    setBusqueda(texto);
    if (texto.trim().length === 0) {
      const recientes = await obtenerVentasRecientes();
      setVentas(recientes);
      return;
    }
    const encontradas = await buscarVentaPorFactura(texto);
    setVentas(encontradas);
  }

  return (
    <div style={estilos.historial}>
      <p style={estilos.tituloHistorial}>Ventas recientes</p>
      <input
        type="text"
        placeholder="Buscar por número de factura..."
        value={busqueda}
        onChange={(e) => manejarBusqueda(e.target.value)}
        style={estilos.buscador}
      />

      {cargando ? (
        <p style={estilos.textoSecundarioHistorial}>Cargando...</p>
      ) : ventas.length === 0 ? (
        <p style={estilos.textoSecundarioHistorial}>Aún no hay ventas registradas.</p>
      ) : (
        <ul style={estilos.listaHistorial}>
          {ventas.map((venta) => (
            <li key={venta.id} style={estilos.filaHistorial}>
              <div>
                <p style={estilos.facturaHistorial}>{venta.numero_factura}</p>
                <p style={estilos.detalleHistorial}>
                  {venta.cliente_nombre ?? 'Sin cliente'} ·{' '}
                  {new Date(venta.fecha).toLocaleDateString('es-CO')}
                </p>
              </div>
              <div style={estilos.derechaHistorial}>
                <span className="dinero" style={estilos.montoHistorial}>
                  ${venta.total.toLocaleString('es-CO')}
                </span>
                <button
                  style={estilos.botonReimprimir}
                  onClick={() => generarFacturaPDF(venta.id)}
                >
                  Reimprimir
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SelectorCliente({ modalidad, clienteSeleccionado, onSeleccionar, diasCredito, onCambiarDias }) {
  const [busqueda, setBusqueda] = useState('');
  const [resultados, setResultados] = useState([]);
  const [saldoActual, setSaldoActual] = useState(null);
  const [mostrarFormularioNuevo, setMostrarFormularioNuevo] = useState(false);

  async function manejarBusqueda(texto) {
    setBusqueda(texto);
    if (texto.length < 2) {
      setResultados([]);
      return;
    }
    const encontrados = await buscarClientes(texto);
    setResultados(encontrados.slice(0, 5));
  }

  async function seleccionar(cliente) {
    onSeleccionar(cliente);
    setBusqueda('');
    setResultados([]);
    const saldo = await saldoPendienteCliente(cliente.id);
    setSaldoActual(saldo);
  }

  async function manejarClienteCreado(clienteNuevo) {
    setMostrarFormularioNuevo(false);
    await seleccionar(clienteNuevo);
  }

  return (
    <div style={estilos.seccionCliente}>
      <p style={estilos.etiquetaSeccionCliente}>
        Cliente {modalidad === 'contado' ? '(opcional)' : ''}
      </p>

      {clienteSeleccionado ? (
        <div style={estilos.clienteElegido}>
          <div>
            <p style={estilos.clienteNombre}>{clienteSeleccionado.nombre}</p>
            {saldoActual > 0 && (
              <p style={estilos.clienteSaldo} className="dinero">
                Ya debe ${saldoActual.toLocaleString('es-CO')}
              </p>
            )}
          </div>
          <button style={estilos.botonCambiarCliente} onClick={() => onSeleccionar(null)}>
            Cambiar
          </button>
        </div>
      ) : mostrarFormularioNuevo ? (
        <FormularioClienteNuevo
          nombreInicial={busqueda}
          onCancelar={() => setMostrarFormularioNuevo(false)}
          onCreado={manejarClienteCreado}
        />
      ) : (
        <>
          <input
            type="text"
            placeholder="Buscar cliente por nombre o cédula..."
            value={busqueda}
            onChange={(e) => manejarBusqueda(e.target.value)}
            style={estilos.buscador}
          />
          {resultados.length > 0 && (
            <ul style={estilos.resultadosBusqueda}>
              {resultados.map((cliente) => (
                <li key={cliente.id}>
                  <button style={estilos.resultadoItem} onClick={() => seleccionar(cliente)}>
                    <span>{cliente.nombre}</span>
                    <span style={{ color: 'var(--color-ink-suave)', fontSize: '0.85rem' }}>
                      {cliente.cedula}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            style={estilos.botonNuevoCliente}
            onClick={() => setMostrarFormularioNuevo(true)}
          >
            + Nuevo cliente
          </button>
        </>
      )}

      {modalidad === 'fiado' && (
        <label style={estilos.filaDias}>
          <span>Días de crédito</span>
          <input
            type="number"
            min="1"
            value={diasCredito}
            onChange={(e) => onCambiarDias(e.target.value)}
            style={estilos.inputDias}
            className="numero"
          />
        </label>
      )}
    </div>
  );
}

function ModalPreviewVenta({
  carrito,
  subtotal,
  descuento,
  total,
  modalidad,
  clienteSeleccionado,
  fechaVencimiento,
  procesando,
  onEditar,
  onConfirmar,
}) {
  return (
    <div style={estilos.overlay}>
      <div style={estilos.panelPreview}>
        <h2 style={estilos.tituloPreview}>Confirmar venta</h2>

        <ul style={estilos.listaPreview}>
          {carrito.map((item) => (
            <li key={item.producto_id} style={estilos.filaPreview}>
              <span>
                {item.cantidad} × {item.nombre}
              </span>
              <span className="dinero">
                ${(item.precio_unitario * item.cantidad).toLocaleString('es-CO')}
              </span>
            </li>
          ))}
        </ul>

        <div style={estilos.lineaDivisoria} />

        <div style={estilos.filaPreviewSecundaria}>
          <span>Subtotal</span>
          <span className="dinero">${subtotal.toLocaleString('es-CO')}</span>
        </div>
        {descuento > 0 && (
          <div style={estilos.filaPreviewSecundaria}>
            <span>Descuento</span>
            <span className="dinero">−${descuento.toLocaleString('es-CO')}</span>
          </div>
        )}
        <div style={estilos.filaTotal}>
          <span>Total</span>
          <span className="dinero">${total.toLocaleString('es-CO')}</span>
        </div>

        <div style={estilos.lineaDivisoria} />

        <div style={estilos.filaPreviewSecundaria}>
          <span>Modalidad</span>
          <span style={{ fontWeight: 600 }}>
            {modalidad === 'contado' ? 'Contado' : 'Fiado'}
          </span>
        </div>

        {modalidad === 'fiado' && (
          <>
            <div style={estilos.filaPreviewSecundaria}>
              <span>Cliente</span>
              <span style={{ fontWeight: 600 }}>{clienteSeleccionado?.nombre}</span>
            </div>
            <div style={estilos.filaPreviewSecundaria}>
              <span>Vence</span>
              <span>{fechaVencimiento.toLocaleDateString('es-CO')}</span>
            </div>
          </>
        )}

        <div style={estilos.accionesPreview}>
          <button type="button" onClick={onEditar} style={estilos.botonSecundario} disabled={procesando}>
            Seguir editando
          </button>
          <button type="button" onClick={onConfirmar} style={estilos.botonPrimario} disabled={procesando}>
            {procesando ? 'Registrando...' : 'Confirmar venta'}
          </button>
        </div>
      </div>
    </div>
  );
}

function FormularioClienteNuevo({ nombreInicial, onCancelar, onCreado }) {
  const [nombre, setNombre] = useState(nombreInicial ?? '');
  const [cedula, setCedula] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  async function manejarGuardar(e) {
    e.preventDefault();
    if (!nombre.trim() || !cedula.trim()) {
      setError('Nombre y cédula son obligatorios.');
      return;
    }

    setGuardando(true);
    const clienteNuevo = await crearCliente({
      nombre: nombre.trim(),
      cedula: cedula.trim(),
      telefono: telefono.trim() || null,
      direccion: direccion.trim() || null,
    });
    setGuardando(false);
    onCreado(clienteNuevo);
  }

  return (
    <form style={estilos.formularioClienteNuevo} onSubmit={manejarGuardar}>
      <p style={estilos.tituloFormClienteNuevo}>Nuevo cliente</p>

      <input
        placeholder="Nombre completo"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        style={estilos.buscador}
        autoFocus
      />
      <input
        placeholder="Cédula"
        value={cedula}
        onChange={(e) => setCedula(e.target.value)}
        style={estilos.buscador}
      />
      <input
        placeholder="Teléfono (opcional)"
        value={telefono}
        onChange={(e) => setTelefono(e.target.value)}
        style={estilos.buscador}
      />
      <input
        placeholder="Dirección (opcional)"
        value={direccion}
        onChange={(e) => setDireccion(e.target.value)}
        style={estilos.buscador}
      />

      {error && <p style={estilos.errorFormClienteNuevo}>{error}</p>}

      <div style={estilos.accionesFormClienteNuevo}>
        <button type="button" onClick={onCancelar} style={estilos.botonModalidad}>
          Cancelar
        </button>
        <button type="submit" disabled={guardando} style={estilos.botonModalidadActivo}>
          {guardando ? 'Guardando...' : 'Crear y seleccionar'}
        </button>
      </div>
    </form>
  );
}

const estilos = {
  contenedor: {
    padding: 'var(--espacio-md)',
    maxWidth: '600px',
    margin: '0 auto',
  },
  titulo: {
    fontSize: '1.5rem',
    color: 'var(--color-navy)',
    marginBottom: 'var(--espacio-md)',
  },
  avisoError: {
    background: 'var(--color-stock-rojo-bg)',
    color: 'var(--color-stock-rojo)',
    padding: 'var(--espacio-sm) var(--espacio-md)',
    borderRadius: 'var(--radio-sm)',
    marginBottom: 'var(--espacio-md)',
    fontSize: '0.9rem',
  },
  seccionBusqueda: {
    marginBottom: 'var(--espacio-md)',
    position: 'relative',
  },
  buscador: {
    width: '100%',
    padding: '0.7rem',
    borderRadius: 'var(--radio-sm)',
    border: '1px solid var(--color-border)',
    fontSize: '1rem',
    marginBottom: 'var(--espacio-sm)',
  },
  resultadosBusqueda: {
    listStyle: 'none',
    margin: '-4px 0 var(--espacio-sm)',
    padding: 0,
    background: 'white',
    borderRadius: 'var(--radio-sm)',
    border: '1px solid var(--color-border)',
    overflow: 'hidden',
  },
  resultadoItem: {
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    padding: '0.6rem 0.8rem',
    background: 'white',
    border: 'none',
    borderBottom: '1px solid var(--color-border)',
    textAlign: 'left',
  },

  /* --- Estilo "tiquete de venta": borde perforado, como recibo físico --- */
  tiquete: {
    background: 'white',
    borderRadius: 'var(--radio-md)',
    padding: 'var(--espacio-md)',
    marginBottom: 'var(--espacio-md)',
    border: '1px dashed var(--color-border)',
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.06)',
  },
  tiqueteVacio: {
    textAlign: 'center',
    color: 'var(--color-ink-suave)',
    padding: 'var(--espacio-lg) 0',
    margin: 0,
  },
  listaCarrito: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  itemCarrito: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--espacio-sm)',
    padding: '0.6rem 0',
    borderBottom: '1px dashed var(--color-border)',
  },
  nombreItem: {
    margin: 0,
    fontWeight: 600,
    fontSize: '0.95rem',
  },
  precioItem: {
    margin: '2px 0 0',
    fontSize: '0.8rem',
    color: 'var(--color-ink-suave)',
  },
  controlCantidad: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  botonCantidad: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    border: '1px solid var(--color-border)',
    background: 'var(--color-paper)',
    fontSize: '1rem',
    lineHeight: 1,
  },
  cantidadTexto: {
    minWidth: '20px',
    textAlign: 'center',
  },
  botonQuitar: {
    background: 'none',
    border: 'none',
    color: 'var(--color-ink-suave)',
    fontSize: '1rem',
    padding: '4px',
  },
  lineaDivisoria: {
    borderTop: '1px dashed var(--color-border)',
    margin: 'var(--espacio-sm) 0',
  },
  filaDescuento: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 'var(--espacio-sm)',
    fontSize: '0.9rem',
  },
  inputDescuento: {
    width: '100px',
    padding: '0.4rem',
    borderRadius: 'var(--radio-sm)',
    border: '1px solid var(--color-border)',
    textAlign: 'right',
  },
  filaTotal: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '1.2rem',
    fontWeight: 700,
    color: 'var(--color-navy)',
  },

  selectorModalidad: {
    display: 'flex',
    gap: 'var(--espacio-sm)',
    marginBottom: 'var(--espacio-md)',
  },
  botonModalidad: {
    flex: 1,
    padding: '0.6rem',
    borderRadius: 'var(--radio-sm)',
    border: '1px solid var(--color-border)',
    background: 'white',
    fontWeight: 600,
    color: 'var(--color-ink-suave)',
  },
  botonModalidadActivo: {
    background: 'var(--color-teal)',
    color: 'white',
    border: '1px solid var(--color-teal)',
  },

  seccionCliente: {
    marginBottom: 'var(--espacio-md)',
  },
  etiquetaSeccionCliente: {
    fontSize: '0.85rem',
    fontWeight: 600,
    color: 'var(--color-ink-suave)',
    margin: '0 0 6px',
  },
  clienteElegido: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: 'var(--color-paper-alt)',
    padding: 'var(--espacio-sm) var(--espacio-md)',
    borderRadius: 'var(--radio-sm)',
    marginBottom: 'var(--espacio-sm)',
  },
  clienteNombre: {
    margin: 0,
    fontWeight: 600,
  },
  clienteSaldo: {
    margin: '2px 0 0',
    fontSize: '0.85rem',
    color: 'var(--color-advertencia)',
  },
  botonCambiarCliente: {
    background: 'none',
    border: 'none',
    color: 'var(--color-teal-dark)',
    fontWeight: 600,
    fontSize: '0.85rem',
  },
  botonNuevoCliente: {
    width: '100%',
    padding: '0.6rem',
    background: 'none',
    border: '1px dashed var(--color-teal)',
    color: 'var(--color-teal-dark)',
    borderRadius: 'var(--radio-sm)',
    fontWeight: 600,
    fontSize: '0.9rem',
    marginBottom: 'var(--espacio-sm)',
  },
  formularioClienteNuevo: {
    background: 'var(--color-paper-alt)',
    padding: 'var(--espacio-md)',
    borderRadius: 'var(--radio-md)',
    marginBottom: 'var(--espacio-sm)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  tituloFormClienteNuevo: {
    margin: '0 0 4px',
    fontWeight: 700,
    color: 'var(--color-navy)',
    fontSize: '0.95rem',
  },
  errorFormClienteNuevo: {
    color: 'var(--color-peligro)',
    fontSize: '0.85rem',
    margin: 0,
  },
  accionesFormClienteNuevo: {
    display: 'flex',
    gap: 'var(--espacio-sm)',
    marginTop: '4px',
  },
  filaDias: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '0.9rem',
  },
  inputDias: {
    width: '70px',
    padding: '0.4rem',
    borderRadius: 'var(--radio-sm)',
    border: '1px solid var(--color-border)',
    textAlign: 'center',
  },

  botonFinalizar: {
    width: '100%',
    padding: '0.9rem',
    background: 'var(--color-teal)',
    color: 'white',
    border: 'none',
    borderRadius: 'var(--radio-md)',
    fontSize: '1.05rem',
    fontWeight: 700,
    marginBottom: 'var(--espacio-lg)',
  },

  /* --- Confirmación --- */
  confirmacion: {
    textAlign: 'center',
    paddingTop: '3rem',
  },
  confirmacionIcono: {
    fontSize: '3rem',
    color: 'var(--color-exito)',
    margin: 0,
  },
  confirmacionTitulo: {
    color: 'var(--color-navy)',
    marginTop: 'var(--espacio-sm)',
  },
  confirmacionTotal: {
    fontSize: '2rem',
    fontWeight: 700,
    margin: 'var(--espacio-md) 0 4px',
  },
  confirmacionFactura: {
    color: 'var(--color-ink-suave)',
    marginBottom: 'var(--espacio-lg)',
  },
  botonPrimario: {
    display: 'block',
    width: '100%',
    padding: '0.8rem',
    background: 'var(--color-teal)',
    color: 'white',
    border: 'none',
    borderRadius: 'var(--radio-md)',
    fontWeight: 700,
    marginBottom: 'var(--espacio-sm)',
  },
  botonSecundario: {
    display: 'block',
    width: '100%',
    padding: '0.8rem',
    background: 'var(--color-paper-alt)',
    color: 'var(--color-navy)',
    border: 'none',
    borderRadius: 'var(--radio-md)',
    fontWeight: 600,
  },

  /* --- Previsualización de venta --- */
  panelPreview: {
    background: 'white',
    width: '100%',
    maxHeight: '85vh',
    overflowY: 'auto',
    borderRadius: '16px 16px 0 0',
    padding: 'var(--espacio-lg)',
  },
  tituloPreview: {
    fontSize: '1.2rem',
    color: 'var(--color-navy)',
    marginBottom: 'var(--espacio-md)',
  },
  listaPreview: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  filaPreview: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.9rem',
  },
  filaPreviewSecundaria: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.9rem',
    color: 'var(--color-ink-suave)',
    marginBottom: '4px',
  },
  accionesPreview: {
    display: 'flex',
    gap: 'var(--espacio-sm)',
    marginTop: 'var(--espacio-lg)',
  },

  /* --- Historial de ventas / reimpresión --- */
  historial: {
    marginTop: 'var(--espacio-lg)',
  },
  tituloHistorial: {
    fontWeight: 700,
    color: 'var(--color-navy)',
    marginBottom: 'var(--espacio-sm)',
  },
  textoSecundarioHistorial: {
    color: 'var(--color-ink-suave)',
    fontSize: '0.9rem',
    textAlign: 'center',
    padding: 'var(--espacio-md) 0',
  },
  listaHistorial: {
    listStyle: 'none',
    padding: 0,
    margin: 'var(--espacio-sm) 0 0',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  filaHistorial: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: 'white',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radio-sm)',
    padding: '0.6rem 0.8rem',
  },
  facturaHistorial: {
    margin: 0,
    fontWeight: 600,
    fontSize: '0.9rem',
  },
  detalleHistorial: {
    margin: '2px 0 0',
    fontSize: '0.78rem',
    color: 'var(--color-ink-suave)',
  },
  derechaHistorial: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '4px',
  },
  montoHistorial: {
    fontWeight: 700,
    fontSize: '0.9rem',
  },
  botonReimprimir: {
    background: 'none',
    border: 'none',
    color: 'var(--color-teal-dark)',
    fontSize: '0.78rem',
    fontWeight: 600,
    textDecoration: 'underline',
  },
};
