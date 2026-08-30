// PantallaReportes.jsx

import { useState, useEffect, useCallback } from 'react';
import {
  rangoHoy,
  rangoSemanaActual,
  rangoMesActual,
  generarReporte,
  exportarReporteExcel,
  exportarReportePDF,
} from '../reportes.js';
import { CATEGORIAS_GASTO, crearGasto, eliminarGasto, listarGastosPorRango } from '../gastos.js';

const RANGOS_PREDEFINIDOS = [
  { id: 'hoy', etiqueta: 'Hoy' },
  { id: 'semana', etiqueta: 'Esta semana' },
  { id: 'mes', etiqueta: 'Este mes' },
  { id: 'personalizado', etiqueta: 'Personalizado' },
];

export function PantallaReportes() {
  const [rangoActivo, setRangoActivo] = useState('mes');
  const [desdeCustom, setDesdeCustom] = useState('');
  const [hastaCustom, setHastaCustom] = useState('');
  const [reporte, setReporte] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [exportando, setExportando] = useState(null); // 'pdf' | 'excel' | null
  const [gastos, setGastos] = useState([]);
  const [mostrarFormGasto, setMostrarFormGasto] = useState(false);

  const obtenerRango = useCallback(() => {
    if (rangoActivo === 'hoy') return rangoHoy();
    if (rangoActivo === 'semana') return rangoSemanaActual();
    if (rangoActivo === 'mes') return rangoMesActual();

    // Personalizado: si aún no hay ambas fechas, usar el mes actual
    // como valor de respaldo mientras el usuario completa el formulario.
    if (!desdeCustom || !hastaCustom) return rangoMesActual();

    return {
      desde: new Date(`${desdeCustom}T00:00:00`),
      hasta: new Date(`${hastaCustom}T23:59:59`),
    };
  }, [rangoActivo, desdeCustom, hastaCustom]);

  const cargarReporte = useCallback(async () => {
    setCargando(true);
    const rango = obtenerRango();
    const [resultado, gastosDelRango] = await Promise.all([
      generarReporte(rango),
      listarGastosPorRango(rango),
    ]);
    setReporte(resultado);
    setGastos(gastosDelRango);
    setCargando(false);
  }, [obtenerRango]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- cargarReporte es async: los setState ocurren después del await, no de forma síncrona en el efecto.
    cargarReporte();
  }, [cargarReporte]);

  async function manejarExportar(formato) {
    if (!reporte) return;
    setExportando(formato);
    try {
      if (formato === 'pdf') await exportarReportePDF(reporte);
      else await exportarReporteExcel(reporte);
    } finally {
      setExportando(null);
    }
  }

  async function manejarCrearGasto(datosGasto) {
    await crearGasto(datosGasto);
    setMostrarFormGasto(false);
    cargarReporte();
  }

  async function manejarEliminarGasto(id) {
    await eliminarGasto(id);
    cargarReporte();
  }

  const totalGastos = gastos.reduce((sum, g) => sum + g.monto, 0);
  const utilidadNeta = reporte ? reporte.utilidadBruta - totalGastos : 0;

  return (
    <div style={estilos.contenedor}>
      <h1 style={estilos.titulo}>Reportes</h1>

      <div style={estilos.filtros}>
        {RANGOS_PREDEFINIDOS.map((r) => (
          <button
            key={r.id}
            onClick={() => setRangoActivo(r.id)}
            style={{
              ...estilos.botonFiltro,
              ...(rangoActivo === r.id ? estilos.botonFiltroActivo : {}),
            }}
          >
            {r.etiqueta}
          </button>
        ))}
      </div>

      {rangoActivo === 'personalizado' && (
        <div style={estilos.filaFechas}>
          <label style={estilos.campoFecha}>
            <span style={estilos.etiquetaFecha}>Desde</span>
            <input
              type="date"
              value={desdeCustom}
              onChange={(e) => setDesdeCustom(e.target.value)}
              style={estilos.inputFecha}
            />
          </label>
          <label style={estilos.campoFecha}>
            <span style={estilos.etiquetaFecha}>Hasta</span>
            <input
              type="date"
              value={hastaCustom}
              onChange={(e) => setHastaCustom(e.target.value)}
              style={estilos.inputFecha}
            />
          </label>
        </div>
      )}

      {cargando || !reporte ? (
        <p>Calculando reporte...</p>
      ) : (
        <>
          {/* --- Tarjetas de totales --- */}
          <div style={estilos.gridTotales}>
            <TarjetaTotal
              etiqueta="Total vendido"
              valor={reporte.totalVentas}
              destacado
            />
            <TarjetaTotal etiqueta="Costo de mercancía" valor={reporte.costoTotalMercancia} />
            <TarjetaTotal etiqueta="Utilidad bruta" valor={reporte.utilidadBruta} positivo />
            <TarjetaTotal
              etiqueta="Margen"
              valor={`${reporte.margen.toFixed(1)}%`}
              esPorcentaje
            />
          </div>

          <div style={estilos.gridTotalesSecundario}>
            <TarjetaTotal etiqueta="Gastos del período" valor={totalGastos} />
            <TarjetaTotal
              etiqueta="Utilidad neta"
              valor={utilidadNeta}
              positivo={utilidadNeta >= 0}
            />
          </div>

          <p style={estilos.numeroVentas} className="numero">
            {reporte.numeroVentas} venta{reporte.numeroVentas !== 1 ? 's' : ''} en el período
          </p>

          {/* --- Botones de exportación --- */}
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

          {/* --- Desglose por producto --- */}
          <h2 style={estilos.subtitulo}>Desglose por producto</h2>
          {reporte.desglosePorProducto.length === 0 ? (
            <p style={estilos.estadoVacio}>No hay ventas registradas en este período.</p>
          ) : (
            <ul style={estilos.listaDesglose}>
              {reporte.desglosePorProducto.map((p) => (
                <li key={p.producto_id} style={estilos.filaDesglose}>
                  <div>
                    <p style={estilos.nombreProductoDesglose}>{p.nombre}</p>
                    <p style={estilos.cantidadDesglose} className="numero">
                      {p.cantidad} unidades vendidas
                    </p>
                  </div>
                  <div style={estilos.montosDesglose}>
                    <span className="dinero" style={estilos.ventaDesglose}>
                      ${p.ventas.toLocaleString('es-CO')}
                    </span>
                    <span style={estilos.margenDesglose}>{p.margen.toFixed(0)}% margen</span>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* --- Gastos de caja menor --- */}
          <div style={estilos.filaSubtituloGastos}>
            <h2 style={estilos.subtitulo}>Gastos de caja menor</h2>
            <button style={estilos.botonAgregarGasto} onClick={() => setMostrarFormGasto(true)}>
              + Gasto
            </button>
          </div>

          {mostrarFormGasto && (
            <FormularioGasto
              onCancelar={() => setMostrarFormGasto(false)}
              onGuardado={manejarCrearGasto}
            />
          )}

          {gastos.length === 0 ? (
            <p style={estilos.estadoVacio}>No hay gastos registrados en este período.</p>
          ) : (
            <ul style={estilos.listaDesglose}>
              {gastos.map((g) => (
                <li key={g.id} style={estilos.filaGasto}>
                  <div>
                    <p style={estilos.nombreProductoDesglose}>{g.descripcion}</p>
                    <p style={estilos.cantidadDesglose}>
                      {ETIQUETAS_CATEGORIA[g.categoria]} ·{' '}
                      {new Date(g.fecha).toLocaleDateString('es-CO')}
                    </p>
                  </div>
                  <div style={estilos.montosDesglose}>
                    <span className="dinero" style={estilos.ventaDesglose}>
                      ${g.monto.toLocaleString('es-CO')}
                    </span>
                    <button style={estilos.botonEliminarGasto} onClick={() => manejarEliminarGasto(g.id)}>
                      Eliminar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

const ETIQUETAS_CATEGORIA = {
  arriendo: 'Arriendo',
  aseo: 'Aseo',
  servicios: 'Servicios',
  transporte: 'Transporte',
  otros: 'Otros',
};

function FormularioGasto({ onCancelar, onGuardado }) {
  const [descripcion, setDescripcion] = useState('');
  const [monto, setMonto] = useState('');
  const [categoria, setCategoria] = useState(CATEGORIAS_GASTO[0]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  async function manejarGuardar(e) {
    e.preventDefault();
    if (!descripcion.trim() || !Number(monto)) {
      setError('Completa la descripción y un monto válido.');
      return;
    }
    setGuardando(true);
    await onGuardado({ descripcion: descripcion.trim(), monto: Number(monto), categoria });
    setGuardando(false);
  }

  return (
    <form style={estilos.formGasto} onSubmit={manejarGuardar}>
      <input
        placeholder="Descripción (ej. Pago arriendo agosto)"
        value={descripcion}
        onChange={(e) => setDescripcion(e.target.value)}
        style={estilos.inputFecha}
        autoFocus
      />
      <div style={estilos.filaFormGasto}>
        <select
          value={categoria}
          onChange={(e) => setCategoria(e.target.value)}
          style={estilos.inputFecha}
        >
          {CATEGORIAS_GASTO.map((c) => (
            <option key={c} value={c}>
              {ETIQUETAS_CATEGORIA[c]}
            </option>
          ))}
        </select>
        <input
          type="number"
          min="1"
          placeholder="Monto"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          style={estilos.inputFecha}
        />
      </div>

      {error && <p style={estilos.errorGasto}>{error}</p>}

      <div style={estilos.filaExportar}>
        <button type="button" onClick={onCancelar} style={estilos.botonExportar}>
          Cancelar
        </button>
        <button type="submit" disabled={guardando} style={estilos.botonExportar}>
          {guardando ? 'Guardando...' : 'Guardar gasto'}
        </button>
      </div>
    </form>
  );
}

function TarjetaTotal({ etiqueta, valor, destacado, positivo, esPorcentaje }) {
  const texto = esPorcentaje ? valor : `$${Number(valor).toLocaleString('es-CO')}`;
  return (
    <div
      style={{
        ...estilos.tarjetaTotal,
        ...(destacado ? estilos.tarjetaTotalDestacada : {}),
      }}
    >
      <span style={{ ...estilos.etiquetaTotal, color: destacado ? 'var(--color-paper-alt)' : 'var(--color-ink-suave)' }}>
        {etiqueta}
      </span>
      <span
        className={esPorcentaje ? undefined : 'dinero'}
        style={{
          ...estilos.valorTotal,
          color: destacado ? 'white' : positivo ? 'var(--color-exito)' : 'var(--color-navy)',
        }}
      >
        {texto}
      </span>
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
  filtros: {
    display: 'flex',
    gap: '6px',
    marginBottom: 'var(--espacio-sm)',
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
  filaFechas: {
    display: 'flex',
    gap: 'var(--espacio-sm)',
    marginBottom: 'var(--espacio-md)',
  },
  campoFecha: {
    flex: 1,
  },
  etiquetaFecha: {
    display: 'block',
    fontSize: '0.8rem',
    color: 'var(--color-ink-suave)',
    marginBottom: '2px',
  },
  inputFecha: {
    width: '100%',
    padding: '0.5rem',
    borderRadius: 'var(--radio-sm)',
    border: '1px solid var(--color-border)',
  },

  gridTotales: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 'var(--espacio-sm)',
    marginTop: 'var(--espacio-md)',
    marginBottom: 'var(--espacio-sm)',
  },
  tarjetaTotal: {
    background: 'white',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radio-md)',
    padding: 'var(--espacio-md)',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  tarjetaTotalDestacada: {
    background: 'var(--color-navy)',
    border: '1px solid var(--color-navy)',
  },
  etiquetaTotal: {
    fontSize: '0.8rem',
  },
  valorTotal: {
    fontSize: '1.3rem',
    fontWeight: 700,
  },
  numeroVentas: {
    textAlign: 'center',
    color: 'var(--color-ink-suave)',
    fontSize: '0.85rem',
    marginBottom: 'var(--espacio-md)',
  },

  filaExportar: {
    display: 'flex',
    gap: 'var(--espacio-sm)',
    marginBottom: 'var(--espacio-lg)',
  },
  botonExportar: {
    flex: 1,
    padding: '0.7rem',
    background: 'var(--color-paper-alt)',
    color: 'var(--color-navy)',
    border: 'none',
    borderRadius: 'var(--radio-sm)',
    fontWeight: 600,
    fontSize: '0.9rem',
  },

  subtitulo: {
    fontSize: '1.1rem',
    color: 'var(--color-navy)',
    marginBottom: 'var(--espacio-sm)',
  },
  estadoVacio: {
    textAlign: 'center',
    color: 'var(--color-ink-suave)',
    padding: 'var(--espacio-lg) 0',
  },
  listaDesglose: {
    listStyle: 'none',
    padding: 0,
    margin: '0 0 var(--altura-nav-inferior)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--espacio-sm)',
  },
  filaDesglose: {
    background: 'white',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radio-md)',
    padding: 'var(--espacio-sm) var(--espacio-md)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nombreProductoDesglose: {
    margin: 0,
    fontWeight: 600,
    fontSize: '0.95rem',
  },
  cantidadDesglose: {
    margin: '2px 0 0',
    fontSize: '0.8rem',
    color: 'var(--color-ink-suave)',
  },
  montosDesglose: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  ventaDesglose: {
    fontWeight: 700,
    color: 'var(--color-navy)',
  },
  margenDesglose: {
    fontSize: '0.75rem',
    color: 'var(--color-exito)',
  },

  /* --- Gastos de caja menor --- */
  gridTotalesSecundario: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 'var(--espacio-sm)',
    marginBottom: 'var(--espacio-md)',
  },
  filaSubtituloGastos: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 'var(--espacio-sm)',
  },
  botonAgregarGasto: {
    padding: '0.4rem 0.9rem',
    background: 'var(--color-teal)',
    color: 'white',
    border: 'none',
    borderRadius: 'var(--radio-sm)',
    fontWeight: 600,
    fontSize: '0.85rem',
  },
  formGasto: {
    background: 'white',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radio-md)',
    padding: 'var(--espacio-md)',
    marginBottom: 'var(--espacio-sm)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  filaFormGasto: {
    display: 'flex',
    gap: '8px',
  },
  errorGasto: {
    color: 'var(--color-peligro)',
    fontSize: '0.85rem',
    margin: 0,
  },
  filaGasto: {
    background: 'white',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radio-md)',
    padding: 'var(--espacio-sm) var(--espacio-md)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  botonEliminarGasto: {
    background: 'none',
    border: 'none',
    color: 'var(--color-peligro)',
    fontSize: '0.75rem',
  },
};
