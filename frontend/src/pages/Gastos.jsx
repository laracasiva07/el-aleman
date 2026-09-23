import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/apiClient';

const formatCurrency = (val) => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(val || 0);
};

const formatFecha = (fechaIso) => {
  if (!fechaIso) return '—';
  const d = new Date(fechaIso);
  return d.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatFechaSinHora = (fechaIso) => {
  if (!fechaIso) return '—';
  const d = new Date(fechaIso);
  return d.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

export default function Gastos() {
  const navigate = useNavigate();

  // Pestaña activa ('balance' | 'diarios' | 'fijos')
  const [tabActiva, setTabActiva] = useState('balance');

  // Filtros de fecha (YYYY-MM-DD). Si están vacíos, el backend toma por defecto el mes en curso
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  // Estados de datos desde Backend
  const [gastosFijos, setGastosFijos] = useState([]);
  const [gastosDiarios, setGastosDiarios] = useState([]);
  const [totalGastosDiarios, setTotalGastosDiarios] = useState(0);
  const [balanceData, setBalanceData] = useState(null);

  // Estados de UI (Carga, Errores y Toast)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // Modal para Gasto Fijo (Nuevo / Editar)
  const [isModalFijoOpen, setIsModalFijoOpen] = useState(false);
  const [gastoFijoEditando, setGastoFijoEditando] = useState(null);
  const [fijoNombre, setFijoNombre] = useState('');
  const [fijoMonto, setFijoMonto] = useState('');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Carga de datos desde los endpoints reales
  const cargarGastos = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {};
      if (fechaDesde) params.desde = fechaDesde;
      if (fechaHasta) params.hasta = fechaHasta;

      const [resFijos, resDiarios, resBalance] = await Promise.all([
        apiClient.get('/gastos/fijos'),
        apiClient.get('/gastos/diarios', { params }),
        apiClient.get('/gastos/balance', { params }),
      ]);

      setGastosFijos(resFijos.data.gastosFijos || []);
      setGastosDiarios(resDiarios.data.gastosDiarios || []);
      setTotalGastosDiarios(resDiarios.data.total || 0);
      setBalanceData(resBalance.data || null);
    } catch (err) {
      console.error('Error al cargar datos de gastos:', err);
      setError(
        err.response?.data?.mensaje ||
          'Error de conexión al cargar la información de gastos.'
      );
    } finally {
      setLoading(false);
    }
  }, [fechaDesde, fechaHasta]);

  useEffect(() => {
    cargarGastos();
  }, [cargarGastos]);

  // Presets de fecha
  const handlePresetMesActual = () => {
    setFechaDesde('');
    setFechaHasta('');
  };

  const handlePresetHoy = () => {
    const hoyStr = new Date().toISOString().split('T')[0];
    setFechaDesde(hoyStr);
    setFechaHasta(hoyStr);
  };

  const handlePreset7Dias = () => {
    const hoy = new Date();
    const hace7Dias = new Date();
    hace7Dias.setDate(hoy.getDate() - 6);

    setFechaDesde(hace7Dias.toISOString().split('T')[0]);
    setFechaHasta(hoy.toISOString().split('T')[0]);
  };

  // =========================================================
  // ACCIONES GASTOS FIJOS
  // =========================================================

  const handleOpenNuevoGastoFijoModal = () => {
    setGastoFijoEditando(null);
    setFijoNombre('');
    setFijoMonto('');
    setIsModalFijoOpen(true);
  };

  const handleOpenEditarGastoFijoModal = (gasto) => {
    setGastoFijoEditando(gasto);
    setFijoNombre(gasto.nombre);
    setFijoMonto(gasto.montoMensual);
    setIsModalFijoOpen(true);
  };

  const handleGuardarGastoFijo = async (e) => {
    e.preventDefault();

    if (!fijoNombre.trim()) {
      alert('Por favor ingresá el nombre del gasto fijo.');
      return;
    }

    const montoNum = Number(fijoMonto);
    if (isNaN(montoNum) || montoNum <= 0) {
      alert('Por favor ingresá un monto mensual mayor a 0.');
      return;
    }

    try {
      if (gastoFijoEditando) {
        const id = gastoFijoEditando._id || gastoFijoEditando.id;
        await apiClient.put(`/gastos/fijos/${id}`, {
          nombre: fijoNombre.trim(),
          montoMensual: montoNum,
        });
        showToast(`🏢 Gasto fijo "${fijoNombre.trim()}" actualizado correctamente`);
      } else {
        await apiClient.post('/gastos/fijos', {
          nombre: fijoNombre.trim(),
          montoMensual: montoNum,
        });
        showToast(`🏢 Gasto fijo "${fijoNombre.trim()}" creado con éxito`);
      }

      setIsModalFijoOpen(false);
      cargarGastos();
    } catch (err) {
      alert(
        err.response?.data?.mensaje ||
          'Ocurrió un error al guardar el gasto fijo.'
      );
    }
  };

  const handleToggleActivoGastoFijo = async (gasto) => {
    const id = gasto._id || gasto.id;
    const nuevoEstado = !gasto.activo;

    try {
      await apiClient.patch(`/gastos/fijos/${id}/activo`, {
        activo: nuevoEstado,
      });

      showToast(
        `🏢 Gasto fijo "${gasto.nombre}" ${
          nuevoEstado ? 'reactivado' : 'dado de baja'
        }`
      );
      cargarGastos();
    } catch (err) {
      alert(
        err.response?.data?.mensaje ||
          'Ocurrió un error al cambiar el estado del gasto fijo.'
      );
    }
  };

  return (
    <div className="space-y-6 font-body text-aleman-negro">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-aleman-verde text-aleman-hueso text-sm font-semibold px-4 py-2.5 rounded-sm shadow-md flex items-center gap-2 border-2 border-aleman-dorado animate-bounce">
          <span>📊</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ENCABEZADO PRINCIPAL Y ACCIONES */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-aleman-negro">
            Módulo de Gastos & Balance
          </h1>
          <p className="text-base text-aleman-negro/70">
            Control de gastos fijos mensuales, egresos diarios y balance prorrateado (Exclusivo Dueño)
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {tabActiva === 'fijos' && (
            <button
              onClick={handleOpenNuevoGastoFijoModal}
              className="px-4 py-2.5 bg-aleman-rojo hover:bg-aleman-rojo-dark text-aleman-hueso font-bold text-sm uppercase tracking-wider rounded-sm border border-aleman-negro/40 shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span>+</span> Nuevo Gasto Fijo
            </button>
          )}

          {tabActiva === 'diarios' && (
            <button
              onClick={() => navigate('/caja')}
              className="px-4 py-2.5 bg-aleman-verde hover:bg-emerald-800 text-aleman-hueso font-bold text-sm uppercase tracking-wider rounded-sm border border-aleman-negro/40 shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span>🏦</span> Ir a Caja a Cargar Egreso
            </button>
          )}
        </div>
      </div>

      {/* SELECTOR DE RANGO DE FECHAS (GLOBAL) */}
      <div className="bg-aleman-hueso rounded-sm border-2 border-aleman-negro/20 p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <span className="text-sm font-bold text-aleman-negro uppercase tracking-wider flex items-center gap-1.5">
            <span>📅</span> Período de Consulta:
          </span>

          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-aleman-negro/70">Desde:</label>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="px-3 py-1.5 bg-white border-2 border-aleman-negro/25 rounded-sm text-sm font-bold text-aleman-negro focus:border-aleman-verde focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-aleman-negro/70">Hasta:</label>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="px-3 py-1.5 bg-white border-2 border-aleman-negro/25 rounded-sm text-sm font-bold text-aleman-negro focus:border-aleman-verde focus:outline-none"
            />
          </div>
        </div>

        {/* Botones rápidos de preset */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <button
            type="button"
            onClick={handlePresetMesActual}
            className={`px-3 py-1.5 text-xs font-bold rounded-sm border transition-colors cursor-pointer ${
              !fechaDesde && !fechaHasta
                ? 'bg-aleman-dorado text-aleman-negro border-aleman-negro/40 shadow-2xs'
                : 'bg-aleman-crema hover:bg-aleman-hueso text-aleman-negro border-aleman-negro/20'
            }`}
          >
            Mes Actual (Default)
          </button>
          <button
            type="button"
            onClick={handlePreset7Dias}
            className="px-3 py-1.5 text-xs font-bold bg-aleman-crema hover:bg-aleman-hueso text-aleman-negro rounded-sm border border-aleman-negro/20 transition-colors cursor-pointer"
          >
            Últimos 7 días
          </button>
          <button
            type="button"
            onClick={handlePresetHoy}
            className="px-3 py-1.5 text-xs font-bold bg-aleman-crema hover:bg-aleman-hueso text-aleman-negro rounded-sm border border-aleman-negro/20 transition-colors cursor-pointer"
          >
            Hoy
          </button>
        </div>
      </div>

      {/* INFORMACIÓN DEL RANGO CONSULTADO */}
      {balanceData && balanceData.rango && (
        <div className="text-xs font-bold text-aleman-negro/60 flex items-center gap-2 px-1">
          <span>ℹ️</span>
          <span>
            Mostrando datos del{' '}
            <strong className="text-aleman-negro">
              {formatFechaSinHora(balanceData.rango.desde)}
            </strong>{' '}
            al{' '}
            <strong className="text-aleman-negro">
              {formatFechaSinHora(balanceData.rango.hasta)}
            </strong>{' '}
            ({balanceData.rango.diasTotales} {balanceData.rango.diasTotales === 1 ? 'día' : 'días'})
          </span>
        </div>
      )}

      {/* TABS DE NAVEGACIÓN */}
      <div className="flex bg-aleman-crema p-1 rounded-sm border border-aleman-negro/15 max-w-lg">
        <button
          onClick={() => setTabActiva('balance')}
          className={`flex-1 py-2 text-sm font-bold rounded-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
            tabActiva === 'balance'
              ? 'bg-aleman-dorado text-aleman-negro shadow-2xs'
              : 'text-aleman-negro/70 hover:text-aleman-negro'
          }`}
        >
          <span>📊</span> Balance General
        </button>

        <button
          onClick={() => setTabActiva('diarios')}
          className={`flex-1 py-2 text-sm font-bold rounded-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
            tabActiva === 'diarios'
              ? 'bg-aleman-dorado text-aleman-negro shadow-2xs'
              : 'text-aleman-negro/70 hover:text-aleman-negro'
          }`}
        >
          <span>📌</span> Gastos Diarios ({gastosDiarios.length})
        </button>

        <button
          onClick={() => setTabActiva('fijos')}
          className={`flex-1 py-2 text-sm font-bold rounded-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${
            tabActiva === 'fijos'
              ? 'bg-aleman-dorado text-aleman-negro shadow-2xs'
              : 'text-aleman-negro/70 hover:text-aleman-negro'
          }`}
        >
          <span>🏢</span> Gastos Fijos ({gastosFijos.length})
        </button>
      </div>

      {/* MENSAJE DE ERROR / CARGA */}
      {loading && (
        <div className="bg-aleman-hueso rounded-sm border-2 border-aleman-negro/20 p-8 text-center text-aleman-negro/60 font-bold">
          <div className="animate-spin text-3xl mb-2">⏳</div>
          Cargando datos del módulo de gastos...
        </div>
      )}

      {error && !loading && (
        <div className="bg-rose-50 border-2 border-rose-300 text-rose-900 rounded-sm p-4 font-semibold text-sm flex items-center justify-between">
          <span>⚠️ {error}</span>
          <button
            onClick={cargarGastos}
            className="px-3 py-1 bg-rose-200 hover:bg-rose-300 text-rose-900 font-bold rounded text-xs transition-colors cursor-pointer"
          >
            Reintentar
          </button>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* ========================================================= */}
          {/* PESTAÑA 1: BALANCE GENERAL */}
          {/* ========================================================= */}
          {tabActiva === 'balance' && balanceData && (
            <div className="space-y-6">
              {/* Tarjetas de Resumen Financiero */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Ingresos Totales */}
                <div className="bg-aleman-hueso rounded-sm p-4 border-2 border-emerald-600/50 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                      Ventas (Ingresos)
                    </span>
                    <span className="text-lg">💵</span>
                  </div>
                  <div className="text-2xl font-display font-bold text-emerald-800 mt-2">
                    {formatCurrency(balanceData.ingresos)}
                  </div>
                  <span className="text-xs text-aleman-negro/60 font-medium mt-1">
                    Cobros de pedidos y caja
                  </span>
                </div>

                {/* 2. Gastos Diarios Reales */}
                <div className="bg-aleman-hueso rounded-sm p-4 border-2 border-amber-600/50 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-900">
                      Gastos Diarios Reales
                    </span>
                    <span className="text-lg">🧾</span>
                  </div>
                  <div className="text-2xl font-display font-bold text-amber-900 mt-2">
                    {formatCurrency(balanceData.gastosDiarios)}
                  </div>
                  <span className="text-xs text-aleman-negro/60 font-medium mt-1">
                    Egresos operativos de caja
                  </span>
                </div>

                {/* 3. Gastos Fijos Prorrateados */}
                <div className="bg-aleman-hueso rounded-sm p-4 border-2 border-aleman-rojo/50 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-aleman-rojo">
                      Gastos Fijos Prorrateados
                    </span>
                    <span className="text-lg">🏢</span>
                  </div>
                  <div className="text-2xl font-display font-bold text-aleman-rojo mt-2">
                    {formatCurrency(balanceData.gastosFijosProrrateados)}
                  </div>
                  <span className="text-xs text-aleman-negro/60 font-medium mt-1">
                    {balanceData.gastosFijosActivosCount} gasto(s) activo(s)
                  </span>
                </div>

                {/* 4. Total Gastos Consolidados */}
                <div className="bg-aleman-hueso rounded-sm p-4 border-2 border-aleman-negro/30 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-aleman-negro/70">
                      Total de Gastos
                    </span>
                    <span className="text-lg">📉</span>
                  </div>
                  <div className="text-2xl font-display font-bold text-aleman-negro mt-2">
                    {formatCurrency(balanceData.totalGastos)}
                  </div>
                  <span className="text-xs text-aleman-negro/60 font-medium mt-1">
                    Diarios + Fijos prorrateados
                  </span>
                </div>
              </div>

              {/* CARD BALANCE NETO DESTACADA */}
              <div
                className={`rounded-sm p-6 border-2 shadow-md flex flex-col md:flex-row items-center justify-between gap-4 ${
                  balanceData.balanceNeto >= 0
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-950'
                    : 'bg-rose-50 border-rose-400 text-rose-950'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">
                      {balanceData.balanceNeto >= 0 ? '🟢' : '🔴'}
                    </span>
                    <h3 className="text-lg font-display font-bold uppercase tracking-wider">
                      Balance Neto del Período
                    </h3>
                  </div>
                  <p className="text-xs font-semibold opacity-80 mt-1">
                    Fórmula: Ingresos ({formatCurrency(balanceData.ingresos)}) − Gastos Totales ({formatCurrency(balanceData.totalGastos)})
                  </p>
                </div>

                <div className="text-right">
                  <div
                    className={`text-4xl font-display font-bold ${
                      balanceData.balanceNeto >= 0
                        ? 'text-emerald-800'
                        : 'text-rose-700'
                    }`}
                  >
                    {formatCurrency(balanceData.balanceNeto)}
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider opacity-70">
                    {balanceData.balanceNeto >= 0 ? 'Superávit Financiero' : 'Déficit Financiero'}
                  </span>
                </div>
              </div>

              {/* DESGLOSE EXPLICATIVO */}
              <div className="bg-aleman-hueso rounded-sm border-2 border-aleman-negro/20 p-5 space-y-4">
                <h3 className="text-sm font-display font-bold text-aleman-negro uppercase tracking-wider border-b border-aleman-negro/10 pb-2">
                  Desglose del Cálculo del Balance
                </h3>

                <div className="space-y-3 text-sm font-semibold text-aleman-negro">
                  <div className="flex justify-between items-center py-2 border-b border-aleman-negro/10">
                    <span className="flex items-center gap-2 text-emerald-800">
                      <span>➕</span> Total Ventas e Ingresos Registrados
                    </span>
                    <span className="font-bold font-display text-base text-emerald-800">
                      {formatCurrency(balanceData.ingresos)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-2 border-b border-aleman-negro/10">
                    <span className="flex items-center gap-2 text-amber-900">
                      <span>➖</span> Total Gastos Diarios Reales (Caja)
                    </span>
                    <span className="font-bold font-display text-base text-amber-900">
                      −{formatCurrency(balanceData.gastosDiarios)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-2 border-b border-aleman-negro/10">
                    <div>
                      <span className="flex items-center gap-2 text-aleman-rojo">
                        <span>➖</span> Total Gastos Fijos Prorrateados
                      </span>
                      <span className="text-xs text-aleman-negro/50 font-normal block pl-6">
                        Calculado por cada día del período sobre {balanceData.gastosFijosActivosCount} gasto(s) fijo(s) activo(s)
                      </span>
                    </div>
                    <span className="font-bold font-display text-base text-aleman-rojo">
                      −{formatCurrency(balanceData.gastosFijosProrrateados)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pt-2 font-bold text-base">
                    <span>Final Balance Neto:</span>
                    <span
                      className={`font-display text-xl ${
                        balanceData.balanceNeto >= 0
                          ? 'text-emerald-800'
                          : 'text-rose-700'
                      }`}
                    >
                      {formatCurrency(balanceData.balanceNeto)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* PESTAÑA 2: GASTOS DIARIOS OPERATIVOS */}
          {/* ========================================================= */}
          {tabActiva === 'diarios' && (
            <div className="bg-aleman-hueso rounded-sm border-2 border-aleman-negro/20 p-5 space-y-4">
              {/* CARTEL INFORMATIVO DEL ORIGEN EN CAJA */}
              <div className="bg-amber-50 border-2 border-amber-300 text-amber-950 rounded-sm p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">💡</span>
                  <div>
                    <h4 className="font-bold text-sm uppercase tracking-wider">
                      Origen de los Gastos Diarios
                    </h4>
                    <p className="text-xs font-semibold opacity-80">
                      Los gastos diarios se cargan desde la pantalla de **Caja** realizando un egreso manual y marcando el casillero **"Gasto diario"**.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => navigate('/caja')}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs uppercase tracking-wider rounded-sm shadow-xs transition-colors whitespace-nowrap cursor-pointer"
                >
                  🏦 Ir a Caja a Registrar Egreso
                </button>
              </div>

              {/* ENCABEZADO TABLA GASTOS DIARIOS */}
              <div className="flex items-center justify-between border-b-2 border-aleman-negro/10 pb-3">
                <h3 className="text-sm font-display font-bold text-aleman-negro uppercase tracking-wider">
                  Listado de Egresos Marcados como Gastos Diarios
                </h3>
                <div className="text-sm font-bold text-aleman-negro">
                  Total del Período: <span className="text-aleman-rojo font-display text-base">{formatCurrency(totalGastosDiarios)}</span>
                </div>
              </div>

              {/* TABLA DE GASTOS DIARIOS */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-base text-aleman-negro">
                  <thead className="bg-aleman-crema text-sm uppercase font-bold text-aleman-negro border-b-2 border-aleman-negro/20">
                    <tr>
                      <th className="py-3 px-4">Fecha / Hora</th>
                      <th className="py-3 px-4">Motivo / Descripción</th>
                      <th className="py-3 px-4 text-center">Categoría</th>
                      <th className="py-3 px-4 text-center">Registrado por</th>
                      <th className="py-3 px-4 text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-aleman-negro/10 text-sm">
                    {gastosDiarios.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-aleman-negro/50 font-semibold">
                          <div className="text-3xl mb-2">🧾</div>
                          <p className="font-bold text-aleman-negro">
                            No se encontraron gastos diarios registrados para el período seleccionado.
                          </p>
                          <p className="text-xs text-aleman-negro/60 mt-1">
                            Podés cargar uno nuevo en la pantalla de Caja marcándolo como "gasto diario".
                          </p>
                        </td>
                      </tr>
                    ) : (
                      gastosDiarios.map((g) => {
                        const usuarioNombre = g.usuarioId?.nombre || 'Usuario';
                        const usuarioRol = g.usuarioId?.rol || '';

                        return (
                          <tr key={g._id || g.id} className="hover:bg-aleman-crema/50 transition-colors">
                            {/* 1. Fecha / Hora */}
                            <td className="py-3.5 px-4 font-mono text-aleman-negro/80 font-semibold whitespace-nowrap">
                              {formatFecha(g.fecha)}
                            </td>

                            {/* 2. Motivo */}
                            <td className="py-3.5 px-4">
                              <span className="font-bold text-aleman-negro block">
                                {g.motivo || 'Gasto diario'}
                              </span>
                            </td>

                            {/* 3. Categoría */}
                            <td className="py-3.5 px-4 text-center">
                              {g.categoria ? (
                                <span className="inline-block px-2.5 py-0.5 bg-aleman-crema text-aleman-negro rounded-sm border border-aleman-negro/20 font-semibold text-xs capitalize">
                                  {g.categoria}
                                </span>
                              ) : (
                                <span className="text-xs text-aleman-negro/40">—</span>
                              )}
                            </td>

                            {/* 4. Usuario */}
                            <td className="py-3.5 px-4 text-center font-semibold text-xs text-aleman-negro/70">
                              {usuarioNombre} {usuarioRol ? `(${usuarioRol})` : ''}
                            </td>

                            {/* 5. Monto */}
                            <td className="py-3.5 px-4 text-right font-display font-bold text-aleman-rojo text-base">
                              -{formatCurrency(g.monto)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* PESTAÑA 3: GASTOS FIJOS MENSUALES */}
          {/* ========================================================= */}
          {tabActiva === 'fijos' && (
            <div className="bg-aleman-hueso rounded-sm border-2 border-aleman-negro/20 p-5 space-y-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b-2 border-aleman-negro/10 pb-3">
                <div>
                  <h3 className="text-sm font-display font-bold text-aleman-negro uppercase tracking-wider">
                    Estructura de Gastos Fijos Mensuales
                  </h3>
                  <p className="text-xs text-aleman-negro/60 font-medium">
                    Costos operativos fijos. Los gastos inactivos/dados de baja no se computan en el prorrateo del balance pero permanecen visibles.
                  </p>
                </div>
              </div>

              {/* TABLA DE GASTOS FIJOS */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-base text-aleman-negro">
                  <thead className="bg-aleman-crema text-sm uppercase font-bold text-aleman-negro border-b-2 border-aleman-negro/20">
                    <tr>
                      <th className="py-3 px-4">Nombre del Gasto Fijo</th>
                      <th className="py-3 px-4 text-right">Monto Mensual</th>
                      <th className="py-3 px-4 text-center">Estado</th>
                      <th className="py-3 px-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-aleman-negro/10 text-sm">
                    {gastosFijos.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-10 text-center text-aleman-negro/50 font-semibold">
                          No hay gastos fijos registrados. Hacé clic en "+ Nuevo Gasto Fijo" para agregar uno.
                        </td>
                      </tr>
                    ) : (
                      gastosFijos.map((g) => {
                        const estaActivo = g.activo !== false;
                        const id = g._id || g.id;

                        return (
                          <tr
                            key={id}
                            className={`transition-colors ${
                              estaActivo
                                ? 'hover:bg-aleman-crema/50'
                                : 'bg-gray-100/70 opacity-60'
                            }`}
                          >
                            {/* 1. Nombre */}
                            <td className="py-3.5 px-4 font-bold text-aleman-negro">
                              <span className={estaActivo ? '' : 'line-through text-aleman-negro/60'}>
                                {g.nombre}
                              </span>
                            </td>

                            {/* 2. Monto Mensual */}
                            <td className="py-3.5 px-4 text-right font-display font-bold text-aleman-negro text-base">
                              {formatCurrency(g.montoMensual)}
                            </td>

                            {/* 3. Estado (Badge) */}
                            <td className="py-3.5 px-4 text-center">
                              {estaActivo ? (
                                <span className="inline-block px-2.5 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold text-xs rounded-sm">
                                  🟢 Activo
                                </span>
                              ) : (
                                <span className="inline-block px-2.5 py-0.5 bg-gray-200 text-gray-700 border border-gray-300 font-bold text-xs rounded-sm">
                                  ⚪ Dado de Baja (Inactivo)
                                </span>
                              )}
                            </td>

                            {/* 4. Acciones */}
                            <td className="py-3.5 px-4 text-right space-x-2 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => handleOpenEditarGastoFijoModal(g)}
                                className="px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-aleman-negro bg-aleman-crema hover:bg-aleman-hueso rounded-sm border border-aleman-negro/25 transition-colors cursor-pointer"
                              >
                                ✏️ Editar
                              </button>

                              <button
                                type="button"
                                onClick={() => handleToggleActivoGastoFijo(g)}
                                className={`px-2.5 py-1 text-xs font-bold uppercase tracking-wider rounded-sm border transition-colors cursor-pointer ${
                                  estaActivo
                                    ? 'bg-rose-100 hover:bg-rose-200 text-rose-900 border-rose-300'
                                    : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border-emerald-300'
                                }`}
                              >
                                {estaActivo ? '🚫 Dar de Baja' : '🟢 Reactivar'}
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  <tfoot className="bg-aleman-crema font-bold text-aleman-negro border-t-2 border-aleman-negro/20 text-sm">
                    <tr>
                      <td className="py-3 px-4 uppercase tracking-wider">
                        Total Mensual de Gastos Fijos Activos:
                      </td>
                      <td className="py-3 px-4 text-right text-lg font-display font-bold text-aleman-rojo">
                        {formatCurrency(
                          gastosFijos
                            .filter((g) => g.activo !== false)
                            .reduce((sum, g) => sum + (Number(g.montoMensual) || 0), 0)
                        )}
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ========================================================= */}
      {/* MODAL: NUEVO / EDITAR GASTO FIJO MENSUAL */}
      {/* ========================================================= */}
      {isModalFijoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-aleman-negro/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-aleman-hueso rounded-sm border-2 border-aleman-negro w-full max-w-md overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 bg-aleman-verde text-aleman-hueso border-b-2 border-aleman-dorado flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🏢</span>
                <div>
                  <h3 className="text-lg font-display font-bold uppercase tracking-wider">
                    {gastoFijoEditando ? 'Editar Gasto Fijo' : 'Nuevo Gasto Fijo Mensual'}
                  </h3>
                  <p className="text-xs text-aleman-dorado font-bold">
                    Costo operativo fijo recurrente
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalFijoOpen(false)}
                className="text-aleman-hueso/70 hover:text-aleman-hueso text-lg font-bold p-1 rounded cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleGuardarGastoFijo} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-aleman-negro uppercase tracking-wider mb-1.5">
                  Nombre del Concepto *
                </label>
                <input
                  type="text"
                  value={fijoNombre}
                  onChange={(e) => setFijoNombre(e.target.value)}
                  placeholder="Ej: Alquiler, Luz, Internet..."
                  required
                  className="w-full px-3.5 py-2.5 bg-white border-2 border-aleman-negro/25 rounded-sm text-base text-aleman-negro focus:border-aleman-verde focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-aleman-negro uppercase tracking-wider mb-1.5">
                  Monto Mensual ($) *
                </label>
                <input
                  type="number"
                  min="1"
                  step="1000"
                  value={fijoMonto}
                  onChange={(e) => setFijoMonto(e.target.value)}
                  placeholder="Ej: 300000"
                  required
                  className="w-full px-3.5 py-2.5 bg-white border-2 border-aleman-negro/25 rounded-sm text-base font-bold text-aleman-negro focus:border-aleman-verde focus:outline-none"
                />
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t-2 border-aleman-negro/10">
                <button
                  type="button"
                  onClick={() => setIsModalFijoOpen(false)}
                  className="px-4 py-2 text-sm font-bold uppercase tracking-wider text-aleman-negro hover:bg-aleman-crema rounded-sm border border-aleman-negro/25 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-bold uppercase tracking-wider text-aleman-hueso bg-aleman-rojo hover:bg-aleman-rojo-dark rounded-sm border border-aleman-negro/40 shadow-sm transition-colors cursor-pointer"
                >
                  {gastoFijoEditando ? 'Guardar Cambios' : 'Crear Gasto Fijo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
