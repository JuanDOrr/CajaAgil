// PantallaFiado.jsx

import { useState, useEffect, useCallback } from 'react';
import { obtenerCarteraFiado, registrarPagoFiado } from '../ventas.js';

const FILTROS = [
  { id: 'todos', etiqueta: 'Todos' },
  { id: 'vencida', etiqueta: 'Vencidos' },
  { id: 'pendiente', etiqueta: 'Al día' },
  { id: 'pagada', etiqueta: 'Pagados' },
];

export function PantallaFiado() {
  const [cartera, setCartera] = useState([]);
  const [filtro, setFiltro] = useState('todos');
  const [cargando, setCargando] = useState(true);
  const [ventaAbonando, setVentaAbonando] = useState(null);

  const cargarCartera = useCallback(async () => {
    const datos = await obtenerCarteraFiado();
    // Ordenar: vencidas primero, luego pendientes, luego pagadas
    const orden = { vencida: 0, pendiente: 1, pagada: 2 };
    datos.sort((a, b) => orden[a.estado_fiado] - orden[b.estado_fiado]);
    setCartera(datos);
    setCargando(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- cargarCartera es async: los setState ocurren después del await, no de forma síncrona en el efecto.
    cargarCartera();
  }, [cargarCartera]);

  const totalPendiente = cartera
    .filter((v) => v.estado_fiado !== 'pagada')
    .reduce((sum, v) => sum + v.saldo_pendiente, 0);

  const ventasFiltradas =
    filtro === 'todos' ? cartera : cartera.filter((v) => v.estado_fiado === filtro);

  return (
    <div style={estilos.contenedor}>
      <h1 style={estilos.titulo}>Fiado</h1>

      <div style={estilos.resumen}>
        <span style={estilos.resumenEtiqueta}>Total por cobrar</span>
        <span className="dinero" style={estilos.resumenMonto}>
          ${totalPendiente.toLocaleString('es-CO')}
        </span>
      </div>

      <div style={estilos.filtros}>
        {FILTROS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFiltro(f.id)}
            style={{
              ...estilos.botonFiltro,
              ...(filtro === f.id ? estilos.botonFiltroActivo : {}),
            }}
          >
            {f.etiqueta}
          </button>
        ))}
      </div>

      {cargando ? (
        <p>Cargando cartera...</p>
      ) : ventasFiltradas.length === 0 ? (
        <p style={estilos.estadoVacio}>No hay ventas a fiado en este filtro.</p>
      ) : (
        <ul style={estilos.lista}>
          {ventasFiltradas.map((venta) => (
            <FilaFiado key={venta.id} venta={venta} onAbonar={() => setVentaAbonando(venta)} />
          ))}
        </ul>
      )}

      {ventaAbonando && (
        <ModalAbono
          venta={ventaAbonando}
          onCerrar={() => setVentaAbonando(null)}
          onAbonado={() => {
            setVentaAbonando(null);
            cargarCartera();
          }}
        />
      )}
    </div>
  );
}

function FilaFiado({ venta, onAbonar }) {
  const estilosPorEstado = {
    vencida: { bg: 'var(--color-stock-rojo-bg)', color: 'var(--color-stock-rojo)', texto: 'Vencida' },
    pendiente: { bg: 'var(--color-stock-amarillo-bg)', color: 'var(--color-stock-amarillo)', texto: 'Al día' },
    pagada: { bg: 'var(--color-stock-verde-bg)', color: 'var(--color-stock-verde)', texto: 'Pagada' },
  };
  const estadoVisual = estilosPorEstado[venta.estado_fiado];

  return (
    <li style={estilos.filaFiado}>
      <div style={estilos.filaFiadoInfo}>
        <p style={estilos.nombreCliente}>{venta.cliente_nombre}</p>
        <p style={estilos.detalleFiado}>
          {venta.numero_factura} · vence{' '}
          {new Date(venta.fecha_vencimiento).toLocaleDateString('es-CO')}
        </p>
      </div>

      <div style={estilos.filaFiadoDerecha}>
        <span
          className="dinero"
          style={{
            ...estilos.montoSaldo,
            color: venta.saldo_pendiente > 0 ? 'var(--color-navy)' : 'var(--color-ink-suave)',
          }}
        >
          ${venta.saldo_pendiente.toLocaleString('es-CO')}
        </span>
        <span
          style={{
            ...estilos.chipEstado,
            background: estadoVisual.bg,
            color: estadoVisual.color,
          }}
        >
          {estadoVisual.texto}
        </span>
      </div>

      {venta.saldo_pendiente > 0 && (
        <button style={estilos.botonAbonar} onClick={onAbonar}>
          Registrar abono
        </button>
      )}
    </li>
  );
}

function ModalAbono({ venta, onCerrar, onAbonado }) {
  const [monto, setMonto] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  async function manejarGuardar(e) {
    e.preventDefault();
    const montoNumerico = Number(monto);

    if (!montoNumerico || montoNumerico <= 0) {
      setError('Ingresa un monto válido.');
      return;
    }
    if (montoNumerico > venta.saldo_pendiente) {
      setError(`El abono no puede superar el saldo pendiente ($${venta.saldo_pendiente.toLocaleString('es-CO')}).`);
      return;
    }

    setGuardando(true);
    await registrarPagoFiado({ ventaId: venta.id, monto: montoNumerico });
    setGuardando(false);
    onAbonado();
  }

  return (
    <div style={estilos.overlay}>
      <form style={estilos.panelModal} onSubmit={manejarGuardar}>
        <h2 style={estilos.tituloModal}>Registrar abono</h2>
        <p style={estilos.clienteModal}>{venta.cliente_nombre}</p>
        <p style={estilos.saldoModal} className="dinero">
          Saldo pendiente: ${venta.saldo_pendiente.toLocaleString('es-CO')}
        </p>

        <label style={estilos.campo}>
          <span style={estilos.etiquetaCampo}>Monto del abono</span>
          <input
            type="number"
            min="1"
            max={venta.saldo_pendiente}
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            autoFocus
            style={estilos.input}
          />
        </label>

        {error && <p style={estilos.errorTexto}>{error}</p>}

        <div style={estilos.accionesModal}>
          <button type="button" onClick={onCerrar} style={estilos.botonSecundario}>
            Cancelar
          </button>
          <button type="submit" disabled={guardando} style={estilos.botonPrimario}>
            {guardando ? 'Guardando...' : 'Confirmar abono'}
          </button>
        </div>
      </form>
    </div>
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
  resumen: {
    background: 'var(--color-navy)',
    borderRadius: 'var(--radio-md)',
    padding: 'var(--espacio-md)',
    marginBottom: 'var(--espacio-md)',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  resumenEtiqueta: {
    color: 'var(--color-paper-alt)',
    fontSize: '0.85rem',
  },
  resumenMonto: {
    color: 'white',
    fontSize: '1.8rem',
    fontWeight: 700,
  },
  filtros: {
    display: 'flex',
    gap: '6px',
    marginBottom: 'var(--espacio-md)',
    overflowX: 'auto',
  },
  botonFiltro: {
    padding: '0.4rem 0.9rem',
    borderRadius: '999px',
    border: '1px solid var(--color-border)',
    background: 'white',
    color: 'var(--color-ink-suave)',
    fontSize: '0.85rem',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  botonFiltroActivo: {
    background: 'var(--color-teal)',
    color: 'white',
    border: '1px solid var(--color-teal)',
  },
  estadoVacio: {
    textAlign: 'center',
    color: 'var(--color-ink-suave)',
    padding: 'var(--espacio-xl) 0',
  },
  lista: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--espacio-sm)',
  },
  filaFiado: {
    background: 'white',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radio-md)',
    padding: 'var(--espacio-md)',
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 'var(--espacio-sm)',
  },
  filaFiadoInfo: {
    flex: '1 1 auto',
  },
  nombreCliente: {
    margin: 0,
    fontWeight: 600,
  },
  detalleFiado: {
    margin: '2px 0 0',
    fontSize: '0.8rem',
    color: 'var(--color-ink-suave)',
  },
  filaFiadoDerecha: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '4px',
  },
  montoSaldo: {
    fontWeight: 700,
    fontSize: '1.05rem',
  },
  chipEstado: {
    padding: '2px 8px',
    borderRadius: '999px',
    fontSize: '0.7rem',
    fontWeight: 700,
  },
  botonAbonar: {
    width: '100%',
    marginTop: '4px',
    padding: '0.5rem',
    background: 'var(--color-paper-alt)',
    color: 'var(--color-navy)',
    border: 'none',
    borderRadius: 'var(--radio-sm)',
    fontWeight: 600,
    fontSize: '0.85rem',
  },

  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.5)',
    display: 'flex',
    alignItems: 'flex-end',
    zIndex: 200,
  },
  panelModal: {
    background: 'white',
    width: '100%',
    borderRadius: '16px 16px 0 0',
    padding: 'var(--espacio-lg)',
  },
  tituloModal: {
    fontSize: '1.2rem',
    color: 'var(--color-navy)',
    marginBottom: '4px',
  },
  clienteModal: {
    margin: '0 0 2px',
    color: 'var(--color-ink-suave)',
  },
  saldoModal: {
    margin: '0 0 var(--espacio-md)',
    fontWeight: 600,
  },
  campo: {
    display: 'block',
    marginBottom: 'var(--espacio-sm)',
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
  },
  errorTexto: {
    color: 'var(--color-peligro)',
    fontSize: '0.85rem',
    margin: '4px 0 0',
  },
  accionesModal: {
    display: 'flex',
    gap: 'var(--espacio-sm)',
    marginTop: 'var(--espacio-lg)',
  },
  botonPrimario: {
    flex: 1,
    padding: '0.7rem',
    background: 'var(--color-teal)',
    color: 'white',
    border: 'none',
    borderRadius: 'var(--radio-sm)',
    fontWeight: 700,
  },
  botonSecundario: {
    flex: 1,
    padding: '0.7rem',
    background: 'var(--color-paper-alt)',
    color: 'var(--color-navy)',
    border: 'none',
    borderRadius: 'var(--radio-sm)',
    fontWeight: 600,
  },
};
