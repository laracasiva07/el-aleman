import { useState, useEffect, useCallback } from 'react';
import apiClient from '../services/apiClient';

const formatCurrency = (amount) => {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(num);
};

export default function Reportes() {
  const [presetSeleccionado, setPresetSeleccionado] = useState('mes');
  const [agrupacion, setAgrupacion] = useState('dia');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Data states
  const [datosVentas, setDatosVentas] = useState(null);
  const [datosProductos, setDatosProductos] = useState([]);
  const [datosPromociones, setDatosPromociones] = useState(null);
  const [datosStock, setDatosStock] = useState([]);
  const [datosAuditoria, setDatosAuditoria] = useState(null);
  const [datosFinanciero, setDatosFinanciero] = useState(null);

  // Helper para construir el rango de fechas en formato YYYY-MM-DD
  const calcularFechasPreset = useCallback((preset) => {
    const ahora = new Date();
    const anio = ahora.getFullYear();
    const mes = ahora.getMonth();
    const dia = ahora.getDate();

    let dInicio;
    let dFin = new Date(ahora);

    if (preset === 'hoy') {
      dInicio = new Date(anio, mes, dia, 0, 0, 0);
    } else if (preset === 'semana') {
      dInicio = new Date(anio, mes, dia - 6, 0, 0, 0);
    } else if (preset === 'mes') {
      dInicio = new Date(anio, mes, 1, 0, 0, 0);
    } else if (preset === 'ano') {
      dInicio = new Date(anio, 0, 1, 0, 0, 0);
    } else {
      dInicio = new Date(anio, mes, 1, 0, 0, 0);
    }

    const formatISO = (d) => {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    };

    return {
      desde: formatISO(dInicio),
      hasta: formatISO(dFin)
    };
  }, []);

  // Inicializar fechas al montar o al cambiar preset
  useEffect(() => {
    if (presetSeleccionado !== 'personalizado') {
      const { desde, hasta } = calcularFechasPreset(presetSeleccionado);
      setFechaDesde(desde);
      setFechaHasta(hasta);
    }
  }, [presetSeleccionado, calcularFechasPreset]);

  // Cargar todos los reportes cuando cambian fechaDesde, fechaHasta o agrupacion
  const cargarReportes = useCallback(async () => {
    if (!fechaDesde || !fechaHasta) return;

    setLoading(true);
    setErrorMsg('');

    try {
      const paramsRango = { desde: fechaDesde, hasta: fechaHasta };

      const [
        resVentas,
        resProds,
        resPromos,
        resStock,
        resAuditoria,
        resFinanciero
      ] = await Promise.all([
        apiClient.get('/reportes/ventas', { params: { ...paramsRango, agrupacion } }),
        apiClient.get('/reportes/productos-mas-vendidos', { params: { ...paramsRango, limit: 10 } }),
        apiClient.get('/reportes/promociones', { params: paramsRango }),
        apiClient.get('/reportes/stock-alertas'),
        apiClient.get('/reportes/auditoria', { params: paramsRango }),
        apiClient.get('/reportes/resumen-financiero', { params: paramsRango })
      ]);

      setDatosVentas(resVentas.data || null);
      setDatosProductos(resProds.data?.productos || []);
      setDatosPromociones(resPromos.data || null);
      setDatosStock(resStock.data?.alertas || []);
      setDatosAuditoria(resAuditoria.data || null);
      setDatosFinanciero(resFinanciero.data || null);
    } catch (err) {
      console.error('Error al cargar reportes:', err);
      setErrorMsg(err.response?.data?.mensaje || 'Error al obtener datos de los reportes');
    } finally {
      setLoading(false);
    }
  }, [fechaDesde, fechaHasta, agrupacion]);

  useEffect(() => {
    cargarReportes();
  }, [cargarReportes]);

  // Max value helper for time-series bar chart scaling
  const maxMontoGrafico = Math.max(
    ...(datosVentas?.serieTemporal || []).map((b) => b.total || 0),
    1000
  );

  return (
    <div className="space-y-6 pb-12 font-body text-aleman-negro">
      {/* ========================================================= */}
      {/* ENCABEZADO Y CONTROLES DE FILTRADO */}
      {/* ========================================================= */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-aleman-hueso p-6 rounded-sm border-2 border-aleman-negro/20 shadow-2xs">
        <div>
          <h1 className="text-3xl font-display font-bold text-aleman-negro flex items-center gap-2">
            <span>📊</span> Módulo de Reportes & Analítica
          </h1>
          <p className="text-base text-aleman-negro/70">
            Inteligencia comercial, balance financiero, rendimiento de productos y auditoría en tiempo real
          </p>
        </div>

        {/* Presets & Controles de fecha */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Botones Presets */}
          <div className="flex bg-aleman-crema p-1 rounded-sm border border-aleman-negro/20">
            {[
              { id: 'hoy', label: 'Hoy' },
              { id: 'semana', label: '7 Días' },
              { id: 'mes', label: 'Mes Actual' },
              { id: 'ano', label: 'Año' },
              { id: 'personalizado', label: 'Personalizado' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setPresetSeleccionado(p.id)}
                className={`px-3 py-1.5 text-xs md:text-sm font-bold rounded-sm transition-all cursor-pointer ${
                  presetSeleccionado === p.id
                    ? 'bg-aleman-dorado text-aleman-negro shadow-2xs border border-aleman-negro/30'
                    : 'text-aleman-negro/70 hover:text-aleman-negro'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Selector de Agrupación Temporal */}
          <div className="flex items-center gap-1.5 bg-aleman-crema px-2.5 py-1.5 rounded-sm border border-aleman-negro/20 text-xs font-bold">
            <span className="text-aleman-negro/70">Agrupar por:</span>
            <select
              value={agrupacion}
              onChange={(e) => setAgrupacion(e.target.value)}
              className="bg-aleman-hueso text-aleman-negro border border-aleman-negro/20 rounded px-2 py-0.5 font-bold cursor-pointer outline-none focus:border-aleman-dorado"
            >
              <option value="dia">Día</option>
              <option value="semana">Semana</option>
              <option value="mes">Mes</option>
              <option value="anio">Año</option>
            </select>
          </div>
        </div>
      </div>

      {/* Controles de fecha si es personalizado */}
      {presetSeleccionado === 'personalizado' && (
        <div className="flex flex-wrap items-center gap-4 bg-aleman-crema p-4 rounded-sm border border-aleman-negro/20 text-sm font-semibold">
          <div className="flex items-center gap-2">
            <label className="text-aleman-negro/80 font-bold">Desde:</label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="bg-aleman-hueso border border-aleman-negro/30 px-3 py-1.5 rounded-sm font-bold text-aleman-negro outline-none focus:border-aleman-dorado"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-aleman-negro/80 font-bold">Hasta:</label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="bg-aleman-hueso border border-aleman-negro/30 px-3 py-1.5 rounded-sm font-bold text-aleman-negro outline-none focus:border-aleman-dorado"
            />
          </div>
        </div>
      )}

      {/* Error Banner */}
      {errorMsg && (
        <div className="p-4 bg-rose-100 text-aleman-rojo border-2 border-aleman-rojo/30 rounded-sm font-bold text-sm">
          ⚠️ {errorMsg}
        </div>
      )}

      {/* Spinner Loading */}
      {loading ? (
        <div className="p-12 text-center bg-aleman-hueso border-2 border-aleman-negro/20 rounded-sm space-y-3">
          <div className="w-10 h-10 border-4 border-aleman-dorado border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-base font-bold text-aleman-negro">Cargando métricas del backend...</p>
        </div>
      ) : (
        <>
          {/* ========================================================= */}
          {/* SECCIÓN 1: TARJETAS DE RESUMEN FINANCIERO */}
          {/* ========================================================= */}
          <div className="bg-aleman-hueso rounded-sm border-2 border-aleman-negro/20 p-6 space-y-4">
            <div className="flex items-center justify-between border-b-2 border-aleman-negro/10 pb-3">
              <div>
                <h2 className="text-lg font-display font-bold text-aleman-negro uppercase tracking-wider flex items-center gap-2">
                  <span>⚖️</span> Resumen Financiero & Consolidado
                </h2>
                <p className="text-sm text-aleman-negro/60 font-semibold">
                  Facturación comercial vs Cobros de caja, gastos operativos y fijos prorrateados
                </p>
              </div>

              <span className="px-3.5 py-1 rounded-sm text-sm font-bold border bg-aleman-dorado text-aleman-negro border-aleman-negro/30">
                Período: {fechaDesde} al {fechaHasta}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {/* Ventas Comerciales */}
              <div className="p-4 bg-aleman-crema border border-aleman-negro/15 rounded-sm flex flex-col justify-between">
                <span className="text-xs font-bold text-aleman-negro/70 uppercase tracking-wider block">
                  1. Ventas (Pedido)
                </span>
                <div className="text-2xl font-display font-bold text-emerald-800 mt-2">
                  {formatCurrency(datosFinanciero?.ventasComerciales)}
                </div>
                <span className="text-xs text-aleman-negro/60 block mt-1 font-semibold">
                  Monto comercial total
                </span>
              </div>

              {/* Cobros Caja */}
              <div className="p-4 bg-aleman-crema border border-aleman-negro/15 rounded-sm flex flex-col justify-between">
                <span className="text-xs font-bold text-blue-900 uppercase tracking-wider block">
                  2. Cobros (Caja)
                </span>
                <div className="text-2xl font-display font-bold text-blue-800 mt-2">
                  {formatCurrency(datosFinanciero?.cobrosCaja)}
                </div>
                <span className="text-xs text-blue-900/70 block mt-1 font-semibold">
                  Ingresos cobrados
                </span>
              </div>

              {/* Gastos Diarios */}
              <div className="p-4 bg-aleman-crema border border-aleman-negro/15 rounded-sm flex flex-col justify-between">
                <span className="text-xs font-bold text-aleman-rojo uppercase tracking-wider block">
                  3. Gastos Diarios
                </span>
                <div className="text-2xl font-display font-bold text-aleman-rojo mt-2">
                  -{formatCurrency(datosFinanciero?.gastosDiarios)}
                </div>
                <span className="text-xs text-aleman-rojo/70 block mt-1 font-semibold">
                  Egresos operativos
                </span>
              </div>

              {/* Gastos Fijos Prorrateados */}
              <div className="p-4 bg-aleman-crema border border-aleman-negro/15 rounded-sm flex flex-col justify-between">
                <span className="text-xs font-bold text-amber-900 uppercase tracking-wider block">
                  4. Fijos Prorrateados
                </span>
                <div className="text-2xl font-display font-bold text-amber-800 mt-2">
                  -{formatCurrency(datosFinanciero?.gastosFijosProrrateados)}
                </div>
                <span className="text-xs text-amber-900/70 block mt-1 font-semibold">
                  Devengado del período
                </span>
              </div>

              {/* Balance Comercial / Resultado Neto (Destacado) */}
              <div className="p-4 rounded-sm border-2 border-aleman-negro flex flex-col justify-between shadow-2xs bg-aleman-verde text-aleman-hueso md:col-span-2 lg:col-span-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-aleman-dorado">
                    5. Balance Comercial
                  </span>
                  <span>{(datosFinanciero?.balanceComercial || 0) >= 0 ? '💰' : '⚠️'}</span>
                </div>
                <div className="text-2xl font-display font-bold mt-2 text-aleman-hueso">
                  {(datosFinanciero?.balanceComercial || 0) >= 0 ? '+' : ''}
                  {formatCurrency(datosFinanciero?.balanceComercial)}
                </div>
                <span className="text-xs font-semibold block mt-1 text-aleman-dorado">
                  {(datosFinanciero?.balanceComercial || 0) >= 0 ? 'Resultado Positivo' : 'Déficit'}
                </span>
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* SECCIÓN 2: VENTAS & EVOLUCIÓN TEMPORAL */}
          {/* ========================================================= */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Evolución y Gráfico (7 cols) */}
            <div className="lg:col-span-7 bg-aleman-hueso rounded-sm border-2 border-aleman-negro/20 p-6 space-y-6">
              <div>
                <h2 className="text-lg font-display font-bold uppercase tracking-wider text-aleman-negro flex items-center gap-2">
                  <span>📈</span> Serie Temporal de Ventas ({agrupacion})
                </h2>
                <p className="text-sm text-aleman-negro/60 font-semibold">
                  Distribución temporal de la facturación en pedidos pagados
                </p>
              </div>

              {/* Desglose Comida vs Bebida */}
              <div className="p-4 bg-aleman-crema border border-aleman-negro/15 rounded-sm space-y-3">
                <div className="flex items-center justify-between text-sm font-bold text-aleman-negro">
                  <span className="flex items-center gap-1.5 text-amber-950 font-bold">
                    <span>🍕</span> Comida: {formatCurrency(datosVentas?.comida)}{' '}
                    <span className="text-aleman-negro/50 font-normal">
                      ({datosVentas?.porcentajeComida || 0}%)
                    </span>
                  </span>

                  <span className="flex items-center gap-1.5 text-blue-950 font-bold">
                    <span>🥤</span> Bebida: {formatCurrency(datosVentas?.bebida)}{' '}
                    <span className="text-aleman-negro/50 font-normal">
                      ({datosVentas?.porcentajeBebida || 0}%)
                    </span>
                  </span>
                </div>

                {/* Visual Proportion Bar */}
                <div className="w-full bg-aleman-hueso h-3 rounded-sm border border-aleman-negro/20 overflow-hidden flex">
                  <div
                    className="bg-aleman-dorado h-full transition-all"
                    style={{ width: `${datosVentas?.porcentajeComida || 50}%` }}
                    title="Comida"
                  ></div>
                  <div
                    className="bg-blue-700 h-full transition-all"
                    style={{ width: `${datosVentas?.porcentajeBebida || 50}%` }}
                    title="Bebida"
                  ></div>
                </div>
              </div>

              {/* Gráfico de Barras Tailwind */}
              <div className="space-y-2">
                <span className="text-sm font-display font-bold text-aleman-negro uppercase tracking-wider block">
                  Ventas en el Período
                </span>

                {(!datosVentas?.serieTemporal || datosVentas.serieTemporal.length === 0) ? (
                  <div className="h-44 bg-aleman-crema border border-aleman-negro/15 rounded-sm flex items-center justify-center text-aleman-negro/50 font-semibold text-sm">
                    Sin ventas registradas en el período seleccionado.
                  </div>
                ) : (
                  <div className="h-48 bg-aleman-crema border border-aleman-negro/15 rounded-sm p-4 flex items-end justify-between gap-3 pt-8 overflow-x-auto">
                    {datosVentas.serieTemporal.map((barra, idx) => {
                      const alturaPorcentaje = Math.max(
                        10,
                        Math.round((barra.total / maxMontoGrafico) * 100)
                      );

                      return (
                        <div
                          key={idx}
                          className="flex-1 flex flex-col items-center h-full justify-end group relative min-w-[36px]"
                        >
                          {/* Tooltip */}
                          <div className="absolute -top-8 opacity-0 group-hover:opacity-100 transition-opacity bg-aleman-negro text-aleman-hueso text-[10px] font-bold px-2 py-1 rounded-sm border border-aleman-dorado shadow-md whitespace-nowrap pointer-events-none z-10">
                            {barra.etiqueta}: {formatCurrency(barra.total)}
                          </div>

                          <div
                            className="w-full max-w-[48px] bg-aleman-dorado hover:bg-aleman-dorado-light border border-aleman-negro/30 rounded-t-sm transition-all shadow-xs"
                            style={{ height: `${alturaPorcentaje}%` }}
                          ></div>

                          <span className="text-[10px] font-bold text-aleman-negro mt-2 truncate w-full text-center">
                            {barra.etiqueta}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Promociones & Resumen de Combos (5 cols) */}
            <div className="lg:col-span-5 bg-aleman-hueso rounded-sm border-2 border-aleman-negro/20 p-6 space-y-4 flex flex-col justify-between">
              <div>
                <h2 className="text-lg font-display font-bold uppercase tracking-wider text-aleman-negro flex items-center gap-2">
                  <span>🏷️</span> Promociones & Combos
                </h2>
                <p className="text-sm text-aleman-negro/60 font-semibold">
                  Conteo de combos vendidos y facturación de promos vs lista normal
                </p>
              </div>

              {/* Facturación Promos vs Normal */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-aleman-crema border border-aleman-negro/15 rounded-sm">
                  <span className="text-xs font-semibold text-aleman-negro/70 block">
                    Ventas en Promoción
                  </span>
                  <span className="text-lg font-display font-bold text-amber-900 block">
                    {formatCurrency(datosPromociones?.facturacionPromociones)}
                  </span>
                  <span className="text-xs font-bold text-amber-800">
                    {datosPromociones?.porcentajePromociones || 0}% del total
                  </span>
                </div>
                <div className="p-3 bg-aleman-crema border border-aleman-negro/15 rounded-sm">
                  <span className="text-xs font-semibold text-aleman-negro/70 block">
                    Ventas Lista Normal
                  </span>
                  <span className="text-lg font-display font-bold text-emerald-900 block">
                    {formatCurrency(datosPromociones?.facturacionNormal)}
                  </span>
                  <span className="text-xs font-bold text-emerald-800">
                    {datosPromociones?.porcentajeNormal || 0}% del total
                  </span>
                </div>
              </div>

              {/* Lista de Combos por nombre */}
              <div className="space-y-2 flex-1">
                <span className="text-xs font-bold text-aleman-negro/70 uppercase tracking-wider block">
                  Detalle de Promociones Vendidas:
                </span>
                {(!datosPromociones?.promociones || datosPromociones.promociones.length === 0) ? (
                  <div className="p-4 bg-aleman-crema rounded-sm border border-aleman-negro/15 text-center text-xs text-aleman-negro/50 font-semibold">
                    No se registraron combos vendidos en este período.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {datosPromociones.promociones.map((p, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2.5 bg-aleman-crema rounded-sm border border-aleman-negro/15 text-xs font-bold"
                      >
                        <div>
                          <span className="text-aleman-negro block text-sm">{p.nombre}</span>
                          <span className="text-aleman-negro/60 font-semibold">
                            {p.cantidadCombosVendidos} combo(s) vendidos
                          </span>
                        </div>
                        <span className="font-display text-sm font-bold text-amber-950">
                          {formatCurrency(p.facturacionTotal)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* SECCIÓN 3: RANKING DE PRODUCTOS MÁS VENDIDOS */}
          {/* ========================================================= */}
          <div className="bg-aleman-hueso rounded-sm border-2 border-aleman-negro/20 p-6 space-y-4">
            <div className="flex items-center justify-between border-b-2 border-aleman-negro/10 pb-3">
              <div>
                <h2 className="text-lg font-display font-bold uppercase tracking-wider text-aleman-negro flex items-center gap-2">
                  <span>🏆</span> Productos Más Vendidos (Top Ranking)
                </h2>
                <p className="text-sm text-aleman-negro/60 font-semibold">
                  Ranking consolidado por volumen y facturación (incluye unidades vendidas en promociones)
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-base text-aleman-negro">
                <thead className="bg-aleman-crema text-sm uppercase font-bold text-aleman-negro border-b-2 border-aleman-negro/20">
                  <tr>
                    <th className="py-2.5 px-3 text-center">Posición</th>
                    <th className="py-2.5 px-3">Producto</th>
                    <th className="py-2.5 px-3 text-center">Unidades Vendidas</th>
                    <th className="py-2.5 px-3 text-right">Facturación Generada</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-aleman-negro/10 text-sm">
                  {datosProductos.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-aleman-negro/50 font-semibold">
                        Sin datos de ventas en este período.
                      </td>
                    </tr>
                  ) : (
                    datosProductos.map((p, idx) => {
                      let badge = `#${idx + 1}`;
                      if (idx === 0) badge = '🥇 #1';
                      if (idx === 1) badge = '🥈 #2';
                      if (idx === 2) badge = '🥉 #3';

                      return (
                        <tr key={idx} className="hover:bg-aleman-crema/50 transition-colors">
                          <td className="py-3 px-3 text-center font-bold text-aleman-negro">
                            {badge}
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-bold text-aleman-negro block">
                              {p.nombre}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center font-bold text-aleman-negro/80">
                            {p.cantidadVendida} u.
                          </td>
                          <td className="py-3 px-3 text-right font-display font-bold text-aleman-negro text-base">
                            {formatCurrency(p.facturacionTotal)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ========================================================= */}
          {/* SECCIÓN 4: ALERTAS DE STOCK DE INSUMOS */}
          {/* ========================================================= */}
          <div className="bg-aleman-hueso rounded-sm border-2 border-aleman-negro/20 p-6 space-y-4">
            <div className="flex items-center justify-between border-b-2 border-aleman-negro/10 pb-3">
              <div>
                <h2 className="text-lg font-display font-bold uppercase tracking-wider text-aleman-negro flex items-center gap-2">
                  <span>⚠️</span> Alertas de Stock de Insumos
                </h2>
                <p className="text-sm text-aleman-negro/60 font-semibold">
                  Ingredientes que alcanzaron o superaron umbrales de stock crítico o bajo
                </p>
              </div>

              <span className="px-3 py-1 bg-aleman-rojo text-aleman-hueso border border-aleman-negro/40 text-sm font-bold rounded-sm uppercase tracking-wider">
                {datosStock.length} insumos en alerta
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-base text-aleman-negro">
                <thead className="bg-aleman-crema text-sm uppercase font-bold text-aleman-negro border-b-2 border-aleman-negro/20">
                  <tr>
                    <th className="py-3 px-4">Ingrediente / Insumo</th>
                    <th className="py-3 px-4 text-center">Estado</th>
                    <th className="py-3 px-4 text-right">Stock Actual</th>
                    <th className="py-3 px-4 text-right">Umbral Crítico</th>
                    <th className="py-3 px-4 text-right">Umbral Bajo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-aleman-negro/10 text-sm">
                  {datosStock.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-emerald-800 font-bold">
                        ✅ Todos los ingredientes cuentan con niveles de stock óptimos.
                      </td>
                    </tr>
                  ) : (
                    datosStock.map((ing) => {
                      const esCritico = ing.estadoStock === 'critico' || ing.stockActual <= ing.umbralCritico;

                      return (
                        <tr key={ing._id || ing.nombre} className="hover:bg-aleman-crema/50 transition-colors">
                          <td className="py-3 px-4 font-bold text-aleman-negro">
                            {ing.nombre}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`px-2.5 py-1 text-xs font-bold rounded-sm border uppercase tracking-wider ${
                                esCritico
                                  ? 'bg-aleman-rojo text-aleman-hueso border-aleman-negro'
                                  : 'bg-amber-300 text-aleman-negro border-amber-600'
                              }`}
                            >
                              {esCritico ? 'Crítico' : 'Stock Bajo'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-aleman-negro">
                            {ing.stockActual} {ing.unidadMedida}
                          </td>
                          <td className="py-3 px-4 text-right text-aleman-negro/70 font-semibold">
                            {ing.umbralCritico} {ing.unidadMedida}
                          </td>
                          <td className="py-3 px-4 text-right text-aleman-negro/70 font-semibold">
                            {ing.umbralBajo} {ing.unidadMedida}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ========================================================= */}
          {/* SECCIÓN 5: REGISTRO DE AUDITORÍA Y AJUSTES (INFORMATIVO) */}
          {/* ========================================================= */}
          <div className="bg-aleman-hueso rounded-sm border-2 border-aleman-negro/20 p-6 space-y-4">
            <div className="flex items-center justify-between border-b-2 border-aleman-negro/10 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-display font-bold uppercase tracking-wider text-aleman-negro">
                    🔍 Auditoría de Ventas vs Cobros
                  </h2>
                  <span className="px-2.5 py-0.5 bg-blue-100 text-blue-900 border border-blue-300 text-xs font-bold rounded-sm uppercase tracking-wider">
                    Informativo / Solo Lectura
                  </span>
                </div>
                <p className="text-sm text-aleman-negro/60 font-semibold mt-0.5">
                  Muestra ajustes registrados post-pago y diferencias entre la facturación comercial actual y el cobro original en caja
                </p>
              </div>

              <span className="px-3 py-1 bg-aleman-crema text-aleman-negro border border-aleman-negro/30 text-sm font-bold rounded-sm">
                {datosAuditoria?.totalAjustesRegistrados || 0} ajustes en el período
              </span>
            </div>

            {(!datosAuditoria?.pedidosAuditoria || datosAuditoria.pedidosAuditoria.length === 0) ? (
              <div className="p-8 text-center bg-aleman-crema rounded-sm border border-aleman-negro/15 text-aleman-negro/60 font-semibold text-sm">
                ✅ No se registraron diferencias ni ediciones en pedidos cobrados durante este período.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-base text-aleman-negro">
                  <thead className="bg-aleman-crema text-sm uppercase font-bold text-aleman-negro border-b-2 border-aleman-negro/20">
                    <tr>
                      <th className="py-2.5 px-3">Pedido</th>
                      <th className="py-2.5 px-3 text-center">Tipo</th>
                      <th className="py-2.5 px-3 text-right">Monto Cobrado (Caja)</th>
                      <th className="py-2.5 px-3 text-right">Monto Actual (Pedido)</th>
                      <th className="py-2.5 px-3 text-right">Diferencia</th>
                      <th className="py-2.5 px-3">Historial de Auditoría</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-aleman-negro/10 text-sm">
                    {datosAuditoria.pedidosAuditoria.map((aud) => (
                      <tr key={aud.pedidoId} className="hover:bg-aleman-crema/50 transition-colors">
                        <td className="py-3 px-3 font-mono font-bold text-xs text-aleman-negro">
                          #{aud.pedidoId.substring(aud.pedidoId.length - 6)}
                        </td>
                        <td className="py-3 px-3 text-center font-bold uppercase text-xs">
                          {aud.tipo}
                        </td>
                        <td className="py-3 px-3 text-right font-display font-bold text-blue-900">
                          {aud.montoOriginalCobrado !== null ? formatCurrency(aud.montoOriginalCobrado) : 'N/A'}
                        </td>
                        <td className="py-3 px-3 text-right font-display font-bold text-aleman-negro">
                          {formatCurrency(aud.totalComercialActual)}
                        </td>
                        <td className={`py-3 px-3 text-right font-display font-bold ${
                          aud.diferencia < 0 ? 'text-aleman-rojo' : aud.diferencia > 0 ? 'text-emerald-800' : 'text-aleman-negro/60'
                        }`}>
                          {aud.diferencia > 0 ? '+' : ''}{formatCurrency(aud.diferencia)}
                        </td>
                        <td className="py-3 px-3 text-xs">
                          <div className="space-y-1 max-h-20 overflow-y-auto">
                            {(aud.historialAuditoria || []).map((h, i) => (
                              <div key={i} className="text-aleman-negro/80">
                                <span className="font-bold uppercase text-[10px] bg-aleman-crema px-1.5 py-0.5 rounded border border-aleman-negro/20 mr-1">
                                  {h.accion}
                                </span>
                                <span>{h.motivo}</span>
                                <span className="text-aleman-negro/50 font-semibold block text-[10px]">
                                  Por: {h.usuarioNombre} ({new Date(h.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })})
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
