import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../context/useAuth';
import apiClient from '../services/apiClient';
import { formatCurrency } from '../services/mockData';

export default function Caja() {
  const { user } = useAuth();
  const esDueno = user?.rol === 'dueno';
  const esEncargado = user?.rol === 'encargado';

  // Pestañas (Solo dueño ve historial y desglose)
  const [activeTab, setActiveTab] = useState('actual'); // 'actual' | 'historial' | 'desglose'

  // Estado del Turno Actual
  const [loading, setLoading] = useState(true);
  const [cajaEstado, setCajaEstado] = useState('cerrada'); // 'abierta' | 'cerrada'
  const [turnoActual, setTurnoActual] = useState(null);
  const [totalesActuales, setTotalesActuales] = useState(null);
  const [movimientos, setMovimientos] = useState([]);

  // Modales
  const [isModalEgresoOpen, setIsModalEgresoOpen] = useState(false);
  const [isModalArqueoOpen, setIsModalArqueoOpen] = useState(false);
  const [isModalDetalleTurnoOpen, setIsModalDetalleTurnoOpen] = useState(false);
  const [turnoDetalleSeleccionado, setTurnoDetalleSeleccionado] = useState(null);

  // Formulario Apertura de Caja
  const [inputAperturaMonto, setInputAperturaMonto] = useState(50000);

  // Formulario Egreso Manual
  const [movDescripcion, setMovDescripcion] = useState('');
  const [movMonto, setMovMonto] = useState('');
  const [movCategoria, setMovCategoria] = useState('');

  // Formulario de Arqueo y Cierre
  const [efectivoContado, setEfectivoContado] = useState('');

  // Historial de Turnos (Solo Dueño)
  const [historialTurnos, setHistorialTurnos] = useState([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  const [filtroFechaHistorial, setFiltroFechaHistorial] = useState('');

  // Desglose Comida / Bebida (Solo Dueño)
  const [desgloseData, setDesgloseData] = useState(null);
  const [loadingDesglose, setLoadingDesglose] = useState(false);

  // Filtros de la tabla de movimientos del turno actual
  const [filtroTipo, setFiltroTipo] = useState('todos'); // 'todos' | 'ingreso' | 'egreso' | 'ajuste'
  const [filtroMedioPago, setFiltroMedioPago] = useState('todos'); // 'todos' | 'efectivo' | 'debito_credito' | 'transferencia'
  const [busqueda, setBusqueda] = useState('');

  // Toast
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Cargar Turno Actual al montar o refrescar
  const cargarTurnoActual = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/caja/turnos/actual');
      if (!res.data.turno) {
        setTurnoActual(null);
        setTotalesActuales(null);
        setMovimientos([]);
        setCajaEstado('cerrada');
      } else {
        setTurnoActual(res.data.turno);
        setTotalesActuales(res.data.totales);
        setMovimientos(res.data.movimientos || []);
        setCajaEstado('abierta');
      }
    } catch (err) {
      console.error('Error al cargar turno actual:', err);
      showToast('❌ Error al conectar con la API de Caja');
    } finally {
      setLoading(false);
    }
  };

  // Cargar Historial de Turnos (Solo Dueño)
  const cargarHistorialTurnos = async (fechaFiltro = '') => {
    if (!esDueno) return;
    try {
      setLoadingHistorial(true);
      const params = {};
      if (fechaFiltro) params.fecha = fechaFiltro;
      const res = await apiClient.get('/caja/turnos', { params });
      setHistorialTurnos(res.data.turnos || []);
    } catch (err) {
      console.error('Error al cargar historial de turnos:', err);
    } finally {
      setLoadingHistorial(false);
    }
  };

  // Cargar Desglose (Solo Dueño)
  const cargarDesglose = async () => {
    if (!esDueno) return;
    try {
      setLoadingDesglose(true);
      const res = await apiClient.get('/caja/desglose');
      setDesgloseData(res.data);
    } catch (err) {
      console.error('Error al cargar desglose de ventas:', err);
    } finally {
      setLoadingDesglose(false);
    }
  };

  useEffect(() => {
    cargarTurnoActual();
  }, []);

  useEffect(() => {
    if (activeTab === 'historial') {
      cargarHistorialTurnos(filtroFechaHistorial);
    } else if (activeTab === 'desglose') {
      cargarDesglose();
    }
  }, [activeTab]);

  // =========================================================
  // ACCIONES DE APERTURA, CIERRE Y MOVIMIENTOS
  // =========================================================

  const handleAbrirCaja = async (e) => {
    e.preventDefault();
    const monto = Math.max(0, Number(inputAperturaMonto) || 0);

    try {
      await apiClient.post('/caja/turnos/abrir', { montoInicial: monto });
      await cargarTurnoActual();
      if (esDueno) cargarDesglose();
      showToast(`🔓 Turno de caja abierto con un fondo de ${formatCurrency(monto)}`);
    } catch (err) {
      const msg = err.response?.data?.mensaje || 'Error al abrir el turno de caja';
      alert(msg);
    }
  };

  const handleOpenEgresoModal = () => {
    setMovDescripcion('');
    setMovMonto('');
    setMovCategoria('');
    setIsModalEgresoOpen(true);
  };

  const handleRegistrarEgresoManual = async (e) => {
    e.preventDefault();

    if (esEncargado && !movDescripcion.trim()) {
      alert('Por favor ingresá el motivo o descripción del egreso (obligatorio para encargados).');
      return;
    }

    const montoNum = Number(movMonto);
    if (!montoNum || montoNum <= 0) {
      alert('Por favor ingresá un monto válido mayor a 0.');
      return;
    }

    try {
      await apiClient.post('/caja/movimientos', {
        monto: montoNum,
        motivo: movDescripcion.trim(),
        categoria: movCategoria || undefined,
      });

      await cargarTurnoActual();
      setIsModalEgresoOpen(false);
      showToast(`💸 Egreso manual de ${formatCurrency(montoNum)} registrado`);
    } catch (err) {
      if (err.response?.status === 409) {
        alert('⚠️ No hay un turno de caja abierto.');
      } else {
        alert(err.response?.data?.mensaje || 'Error al registrar egreso manual');
      }
    }
  };

  const handleOpenArqueoModal = () => {
    const efectivoEsperado = totalesActuales?.montoCalculadoEfectivo || turnoActual?.montoInicial || 0;
    setEfectivoContado(efectivoEsperado);
    setIsModalArqueoOpen(true);
  };

  const handleConfirmarCierreCaja = async (e) => {
    e.preventDefault();

    if (!turnoActual) return;

    const contadoNum = Number(efectivoContado);
    if (isNaN(contadoNum) || contadoNum < 0) {
      alert('Por favor ingresá un monto contado válido mayor o igual a 0.');
      return;
    }

    try {
      const res = await apiClient.patch(`/caja/turnos/${turnoActual._id}/cerrar`, {
        montoContadoEfectivo: contadoNum,
      });

      const diff = res.data.turno?.diferencia || 0;
      setIsModalArqueoOpen(false);

      let mensajeDiferencia = 'Caja cerrada cuadrada ($0)';
      if (diff > 0) {
        mensajeDiferencia = `Caja cerrada con sobrante de ${formatCurrency(diff)}`;
      } else if (diff < 0) {
        mensajeDiferencia = `Caja cerrada con faltante de ${formatCurrency(Math.abs(diff))}`;
      }

      showToast(`🔒 ${mensajeDiferencia}`);
      await cargarTurnoActual();
      if (esDueno) {
        cargarHistorialTurnos();
        cargarDesglose();
      }
    } catch (err) {
      alert(err.response?.data?.mensaje || 'Error al cerrar el turno de caja');
    }
  };

  const handleVerDetalleTurno = async (id) => {
    try {
      const res = await apiClient.get(`/caja/turnos/${id}`);
      setTurnoDetalleSeleccionado(res.data);
      setIsModalDetalleTurnoOpen(true);
    } catch (err) {
      alert(err.response?.data?.mensaje || 'Error al obtener detalle del turno');
    }
  };

  // =========================================================
  // FILTRADO DE MOVIMIENTOS DEL TURNO ACTUAL
  // =========================================================

  const movimientosFiltrados = useMemo(() => {
    return movimientos.filter((m) => {
      if (filtroTipo !== 'todos' && m.tipo !== filtroTipo) return false;
      if (filtroMedioPago !== 'todos' && m.medioPago !== filtroMedioPago) return false;

      if (busqueda.trim()) {
        const term = busqueda.toLowerCase();
        const matchMotivo = m.motivo?.toLowerCase().includes(term);
        const matchUsuario = m.usuarioId?.nombre?.toLowerCase().includes(term);
        const matchMonto = m.monto !== undefined && String(m.monto).includes(term);
        if (!matchMotivo && !matchUsuario && !matchMonto) return false;
      }

      return true;
    });
  }, [movimientos, filtroTipo, filtroMedioPago, busqueda]);

  const formatearFechaHora = (fechaIso) => {
    if (!fechaIso) return '—';
    const date = new Date(fechaIso);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatearFechaCompleta = (fechaIso) => {
    if (!fechaIso) return '—';
    const date = new Date(fechaIso);
    return `${date.toLocaleDateString('es-AR')} a las ${date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-aleman-negro font-bold">
        <div className="animate-spin inline-block w-8 h-8 border-4 border-aleman-verde border-t-transparent rounded-full mb-3"></div>
        <p>Cargando información de caja en tiempo real...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-body text-aleman-negro">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-aleman-verde text-aleman-hueso text-sm font-semibold px-4 py-2.5 rounded-sm shadow-md flex items-center gap-2 border-2 border-aleman-dorado animate-bounce">
          <span>💵</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ENCABEZADO PRINCIPAL */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 pb-2">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-aleman-negro tracking-tight">
              Control de Caja & Arqueo
            </h1>
            <span
              className={`px-3 py-1 rounded-sm text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 border ${
                cajaEstado === 'abierta'
                  ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                  : 'bg-aleman-rojo text-aleman-hueso border-aleman-negro/40'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  cajaEstado === 'abierta' ? 'bg-emerald-500 animate-ping' : 'bg-white'
                }`}
              ></span>
              {cajaEstado === 'abierta' ? 'Caja Abierta' : 'Caja Cerrada'}
            </span>
          </div>
          <p className="text-sm sm:text-base text-aleman-negro/70">
            {cajaEstado === 'abierta' && turnoActual
              ? `Turno iniciado por ${turnoActual.usuarioAperturaId?.nombre || 'Usuario'} el ${formatearFechaCompleta(
                  turnoActual.fechaApertura
                )}`
              : 'La caja se encuentra cerrada. Abrí un turno para registrar ingresos y egresos.'}
          </p>
        </div>

        {/* Pestañas de Navegación (Solo para dueño) */}
        {esDueno && (
          <div className="flex items-center gap-2 bg-aleman-crema p-1 rounded-sm border border-aleman-negro/20">
            <button
              onClick={() => setActiveTab('actual')}
              className={`px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider rounded-sm transition-colors cursor-pointer ${
                activeTab === 'actual'
                  ? 'bg-aleman-verde text-aleman-hueso shadow-xs'
                  : 'text-aleman-negro/70 hover:text-aleman-negro'
              }`}
            >
              📊 Turno Actual
            </button>
            <button
              onClick={() => setActiveTab('historial')}
              className={`px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider rounded-sm transition-colors cursor-pointer ${
                activeTab === 'historial'
                  ? 'bg-aleman-verde text-aleman-hueso shadow-xs'
                  : 'text-aleman-negro/70 hover:text-aleman-negro'
              }`}
            >
              📜 Historial Turnos
            </button>
            <button
              onClick={() => setActiveTab('desglose')}
              className={`px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider rounded-sm transition-colors cursor-pointer ${
                activeTab === 'desglose'
                  ? 'bg-aleman-verde text-aleman-hueso shadow-xs'
                  : 'text-aleman-negro/70 hover:text-aleman-negro'
              }`}
            >
              🍕 Desglose Comida/Bebida
            </button>
          </div>
        )}

        {/* Botones de acción si la caja está abierta */}
        {cajaEstado === 'abierta' && activeTab === 'actual' && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleOpenEgresoModal}
              className="px-3.5 py-2 bg-aleman-rojo hover:bg-aleman-rojo-dark text-aleman-hueso font-bold text-sm uppercase tracking-wider rounded-sm border border-aleman-negro/40 shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span>-</span> Egreso Manual
            </button>

            <button
              onClick={handleOpenArqueoModal}
              className="px-4 py-2 bg-aleman-verde hover:bg-aleman-verde-dark text-aleman-hueso font-bold text-sm uppercase tracking-wider rounded-sm border border-aleman-dorado/40 shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span>🔒</span> Cerrar Caja (Arqueo)
            </button>
          </div>
        )}
      </div>

      {/* PESTAÑA 1: TURNO ACTUAL */}
      {activeTab === 'actual' && (
        <>
          {/* SI LA CAJA ESTÁ CERRADA: FORMULARIO DE APERTURA */}
          {cajaEstado === 'cerrada' && (
            <div className="bg-aleman-hueso rounded-sm border-2 border-aleman-negro p-8 max-w-xl mx-auto text-center space-y-6">
              <div className="w-16 h-16 rounded-sm bg-aleman-dorado text-aleman-negro text-3xl flex items-center justify-center mx-auto border border-aleman-dorado-light shadow-inner">
                🔒
              </div>

              <div>
                <h2 className="text-2xl font-display font-bold text-aleman-negro">
                  Apertura de Caja & Inicio de Turno
                </h2>
                <p className="text-sm text-aleman-negro/70 max-w-md mx-auto mt-1">
                  Ingresá el fondo inicial de caja para habilitar el control financiero y registrar los cobros del turno.
                </p>
              </div>

              <form onSubmit={handleAbrirCaja} className="space-y-5 text-left">
                <div>
                  <label className="block text-sm font-bold text-aleman-negro uppercase tracking-wider mb-2">
                    Fondo Inicial de Caja ($) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-aleman-negro/40 font-bold text-base">
                      $
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={inputAperturaMonto}
                      onChange={(e) => setInputAperturaMonto(e.target.value)}
                      placeholder="50000"
                      required
                      className="w-full pl-9 pr-4 py-3 bg-white border-2 border-aleman-negro/25 rounded-sm text-lg font-bold text-aleman-negro focus:border-aleman-verde focus:outline-none"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2 mt-2.5">
                    {[20000, 30000, 50000, 80000, 100000].map((montoSugerido) => (
                      <button
                        key={montoSugerido}
                        type="button"
                        onClick={() => setInputAperturaMonto(montoSugerido)}
                        className="px-2.5 py-1 bg-aleman-crema hover:bg-aleman-hueso text-aleman-negro text-sm font-bold rounded-sm border border-aleman-negro/20 transition-colors cursor-pointer"
                      >
                        {formatCurrency(montoSugerido)}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 bg-aleman-rojo hover:bg-aleman-rojo-dark text-aleman-hueso font-bold text-base uppercase tracking-wider rounded-sm border border-aleman-negro/40 shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>🔓</span> Abrir Caja e Iniciar Turno
                </button>
              </form>
            </div>
          )}

          {/* SI LA CAJA ESTÁ ABIERTA: DASHBOARD REAL */}
          {cajaEstado === 'abierta' && (
            <div className="space-y-6">
              {/* TARJETAS KPI DE SALDOS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-aleman-hueso rounded-sm p-4 border-2 border-aleman-negro/20 flex flex-col justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-aleman-negro/70 block">
                    Fondo Inicial
                  </span>
                  <div className="text-xl font-display font-bold text-aleman-negro mt-1">
                    {formatCurrency(turnoActual?.montoInicial || 0)}
                  </div>
                  <span className="text-xs text-aleman-negro/50 font-semibold block mt-1">
                    🕒 {formatearFechaHora(turnoActual?.fechaApertura)}
                  </span>
                </div>

                <div className="bg-aleman-hueso rounded-sm p-4 border-2 border-aleman-negro/20 flex flex-col justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 block">
                    Total Ingresos (+)
                  </span>
                  <div className="text-xl font-display font-bold text-emerald-800 mt-1">
                    +{formatCurrency(totalesActuales?.ingresosPorMedioPago?.total || 0)}
                  </div>
                  <span className="text-xs text-aleman-negro/50 font-semibold block mt-1">
                    {movimientos.filter((m) => m.tipo === 'ingreso').length} ingresos
                  </span>
                </div>

                <div className="bg-aleman-hueso rounded-sm p-4 border-2 border-aleman-negro/20 flex flex-col justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-aleman-rojo block">
                    Total Egresos (-)
                  </span>
                  <div className="text-xl font-display font-bold text-aleman-rojo mt-1">
                    -{formatCurrency(totalesActuales?.totalEgresos || 0)}
                  </div>
                  <span className="text-xs text-aleman-negro/50 font-semibold block mt-1">
                    {movimientos.filter((m) => m.tipo === 'egreso').length} retiros
                  </span>
                </div>

                <div className="bg-aleman-hueso rounded-sm p-4 border-2 border-aleman-negro/20 flex flex-col justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-900 block">
                    Total Ajustes
                  </span>
                  <div className="text-xl font-display font-bold text-blue-950 mt-1">
                    {totalesActuales?.totalAjustes || 0}
                  </div>
                  <span className="text-xs text-aleman-negro/50 font-semibold block mt-1">
                    Auditoría comandas
                  </span>
                </div>

                <div className="bg-aleman-hueso rounded-sm p-4 border-2 border-emerald-600/70 flex flex-col justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-950 block">
                    💵 Efectivo en Cajón
                  </span>
                  <div className="text-xl font-display font-bold text-emerald-900 mt-1">
                    {formatCurrency(totalesActuales?.montoCalculadoEfectivo || 0)}
                  </div>
                  <span className="text-xs text-emerald-800 font-semibold block mt-1">
                    Billetes para conteo
                  </span>
                </div>
              </div>

              {/* DESGLOSE POR MEDIO DE PAGO */}
              <div className="bg-aleman-hueso rounded-sm p-5 border-2 border-aleman-negro/20 space-y-4">
                <div className="flex items-center justify-between border-b-2 border-aleman-negro/10 pb-2.5">
                  <h3 className="text-sm font-display font-bold text-aleman-negro uppercase tracking-wider flex items-center gap-1.5">
                    <span>💳</span> Ingresos por Medio de Pago (Turno Actual)
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-sm">
                    <span className="text-xs font-bold text-emerald-900 uppercase">💵 Efectivo</span>
                    <div className="text-lg font-display font-bold text-emerald-900 mt-1">
                      {formatCurrency(totalesActuales?.ingresosPorMedioPago?.efectivo || 0)}
                    </div>
                  </div>

                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-sm">
                    <span className="text-xs font-bold text-blue-900 uppercase">💳 Tarjeta (Débito/Crédito)</span>
                    <div className="text-lg font-display font-bold text-blue-900 mt-1">
                      {formatCurrency(totalesActuales?.ingresosPorMedioPago?.debito_credito || 0)}
                    </div>
                  </div>

                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-sm">
                    <span className="text-xs font-bold text-amber-900 uppercase">📱 Transferencia</span>
                    <div className="text-lg font-display font-bold text-amber-900 mt-1">
                      {formatCurrency(totalesActuales?.ingresosPorMedioPago?.transferencia || 0)}
                    </div>
                  </div>
                </div>
              </div>

              {/* TABLA DE MOVIMIENTOS Y MOBILE CARDS */}
              <div className="bg-aleman-hueso rounded-sm border-2 border-aleman-negro/20 overflow-hidden space-y-3 p-5">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b-2 border-aleman-negro/10 pb-4">
                  <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                    <h3 className="text-sm font-display font-bold text-aleman-negro uppercase tracking-wider mr-2">
                      Movimientos del Turno
                    </h3>

                    <select
                      value={filtroTipo}
                      onChange={(e) => setFiltroTipo(e.target.value)}
                      className="px-3 py-1.5 bg-white border-2 border-aleman-negro/25 rounded-sm text-sm text-aleman-negro focus:border-aleman-verde font-semibold"
                    >
                      <option value="todos">Todos los tipos ({movimientos.length})</option>
                      <option value="ingreso">🟢 Ingresos</option>
                      <option value="egreso">🔴 Egresos</option>
                      <option value="ajuste">📝 Ajustes</option>
                    </select>

                    <select
                      value={filtroMedioPago}
                      onChange={(e) => setFiltroMedioPago(e.target.value)}
                      className="px-3 py-1.5 bg-white border-2 border-aleman-negro/25 rounded-sm text-sm text-aleman-negro focus:border-aleman-verde font-semibold"
                    >
                      <option value="todos">Todos los medios</option>
                      <option value="efectivo">💵 Efectivo</option>
                      <option value="debito_credito">💳 Tarjeta</option>
                      <option value="transferencia">📱 Transferencia</option>
                    </select>

                    <input
                      type="text"
                      placeholder="Buscar motivo, monto o usuario..."
                      value={busqueda}
                      onChange={(e) => setBusqueda(e.target.value)}
                      className="px-3 py-1.5 bg-white border-2 border-aleman-negro/25 rounded-sm text-sm text-aleman-negro focus:border-aleman-verde min-w-[180px]"
                    />
                  </div>

                  <span className="text-sm text-aleman-negro/60 font-semibold self-end sm:self-center">
                    {movimientosFiltrados.length} registros
                  </span>
                </div>

                {/* TABLA DESKTOP */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left text-base text-aleman-negro">
                    <thead className="bg-aleman-crema text-sm uppercase font-bold text-aleman-negro border-b-2 border-aleman-negro/20">
                      <tr>
                        <th className="py-3 px-4">Hora</th>
                        <th className="py-3 px-4 text-center">Tipo</th>
                        <th className="py-3 px-4">Motivo / Descripción</th>
                        <th className="py-3 px-4 text-center">Medio de Pago</th>
                        <th className="py-3 px-4">Usuario</th>
                        <th className="py-3 px-4 text-right">Monto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-aleman-negro/10 text-sm">
                      {movimientosFiltrados.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-10 text-center text-aleman-negro/50 font-semibold">
                            No hay movimientos registrados en este turno.
                          </td>
                        </tr>
                      ) : (
                        movimientosFiltrados.map((m) => {
                          const esIngreso = m.tipo === 'ingreso';
                          const esAjuste = m.tipo === 'ajuste';

                          let medioLabel = '—';
                          if (m.medioPago === 'efectivo') medioLabel = '💵 Efectivo';
                          else if (m.medioPago === 'debito_credito') medioLabel = '💳 Tarjeta';
                          else if (m.medioPago === 'transferencia') medioLabel = '📱 Transferencia';

                          return (
                            <tr key={m._id} className="hover:bg-aleman-crema/50 transition-colors">
                              <td className="py-3.5 px-4 font-mono text-aleman-negro/70 font-semibold">
                                {formatearFechaHora(m.fecha || m.createdAt)}
                              </td>

                              <td className="py-3.5 px-4 text-center">
                                <span
                                  className={`inline-block px-2.5 py-0.5 rounded-sm font-bold text-xs border ${
                                    esAjuste
                                      ? 'bg-aleman-crema text-aleman-negro border-aleman-dorado'
                                      : esIngreso
                                      ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                      : 'bg-aleman-rojo text-aleman-hueso border-aleman-negro/40'
                                  }`}
                                >
                                  {esAjuste ? '📝 Ajuste' : esIngreso ? '🟢 Ingreso' : '🔴 Egreso'}
                                </span>
                              </td>

                              <td className="py-3.5 px-4 font-bold text-aleman-negro">
                                {m.motivo || (esIngreso ? 'Ingreso automático por venta' : 'Egreso manual')}
                              </td>

                              <td className="py-3.5 px-4 text-center">
                                <span className="inline-block px-2 py-0.5 bg-aleman-crema text-aleman-negro border border-aleman-negro/20 rounded-sm font-semibold text-xs">
                                  {medioLabel}
                                </span>
                              </td>

                              <td className="py-3.5 px-4 font-semibold text-aleman-negro/80">
                                {m.usuarioId?.nombre || 'Sistema'}
                              </td>

                              <td
                                className={`py-3.5 px-4 text-right font-display font-bold text-base ${
                                  esAjuste ? 'text-aleman-negro/50' : esIngreso ? 'text-emerald-800' : 'text-aleman-rojo'
                                }`}
                              >
                                {esIngreso ? '+' : m.tipo === 'egreso' ? '-' : ''}
                                {formatCurrency(m.monto)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* MOBILE CARDS */}
                <div className="md:hidden space-y-3">
                  {movimientosFiltrados.length === 0 ? (
                    <div className="py-8 text-center text-aleman-negro/50 font-semibold text-sm">
                      No hay movimientos registrados.
                    </div>
                  ) : (
                    movimientosFiltrados.map((m) => {
                      const esIngreso = m.tipo === 'ingreso';
                      const esAjuste = m.tipo === 'ajuste';

                      let medioLabel = '—';
                      if (m.medioPago === 'efectivo') medioLabel = '💵 Efectivo';
                      else if (m.medioPago === 'debito_credito') medioLabel = '💳 Tarjeta';
                      else if (m.medioPago === 'transferencia') medioLabel = '📱 Transferencia';

                      return (
                        <div
                          key={m._id}
                          className="bg-white rounded-sm p-4 border-2 border-aleman-negro/15 space-y-3 shadow-2xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-xs text-aleman-negro/70 font-semibold">
                              🕒 {formatearFechaHora(m.fecha || m.createdAt)}
                            </span>
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-sm font-bold text-xs border ${
                                esAjuste
                                  ? 'bg-aleman-crema text-aleman-negro border-aleman-dorado'
                                  : esIngreso
                                  ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                  : 'bg-aleman-rojo text-aleman-hueso border-aleman-negro/40'
                              }`}
                            >
                              {esAjuste ? '📝 Ajuste' : esIngreso ? '🟢 Ingreso' : '🔴 Egreso'}
                            </span>
                          </div>

                          <div>
                            <div className="font-bold text-sm text-aleman-negro">
                              {m.motivo || (esIngreso ? 'Ingreso automático por venta' : 'Egreso manual')}
                            </div>
                            <div className="text-xs text-aleman-negro/60 font-medium mt-1">
                              Usuario: {m.usuarioId?.nombre || 'Sistema'}
                            </div>
                          </div>

                          <div className="pt-2 border-t border-aleman-negro/10 flex items-center justify-between">
                            <span className="inline-block px-2 py-0.5 bg-aleman-crema text-aleman-negro border border-aleman-negro/20 rounded-sm font-semibold text-xs">
                              {medioLabel}
                            </span>
                            <span
                              className={`font-display font-bold text-base ${
                                esAjuste ? 'text-aleman-negro/50' : esIngreso ? 'text-emerald-800' : 'text-aleman-rojo'
                              }`}
                            >
                              {esIngreso ? '+' : m.tipo === 'egreso' ? '-' : ''}
                              {formatCurrency(m.monto)}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* PESTAÑA 2: HISTORIAL DE TURNOS (SOLO DUEÑO) */}
      {activeTab === 'historial' && esDueno && (
        <div className="bg-aleman-hueso rounded-sm border-2 border-aleman-negro p-6 space-y-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b-2 border-aleman-negro/10 pb-4">
            <h2 className="text-xl font-display font-bold text-aleman-negro">Historial de Turnos de Caja</h2>

            <div className="flex items-center gap-3">
              <label className="text-sm font-bold text-aleman-negro">Filtrar Fecha:</label>
              <input
                type="date"
                value={filtroFechaHistorial}
                onChange={(e) => {
                  setFiltroFechaHistorial(e.target.value);
                  cargarHistorialTurnos(e.target.value);
                }}
                className="px-3 py-1.5 bg-white border-2 border-aleman-negro/25 rounded-sm text-sm font-semibold text-aleman-negro focus:border-aleman-verde"
              />
              {filtroFechaHistorial && (
                <button
                  onClick={() => {
                    setFiltroFechaHistorial('');
                    cargarHistorialTurnos('');
                  }}
                  className="px-2.5 py-1 text-xs bg-aleman-crema hover:bg-aleman-hueso text-aleman-negro font-bold border border-aleman-negro/20 rounded-sm cursor-pointer"
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>

          {loadingHistorial ? (
            <div className="p-8 text-center text-aleman-negro font-bold">Cargando historial de turnos...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-aleman-negro">
                <thead className="bg-aleman-crema text-xs uppercase font-bold text-aleman-negro border-b-2 border-aleman-negro/20">
                  <tr>
                    <th className="py-3 px-4">Apertura</th>
                    <th className="py-3 px-4">Cierre</th>
                    <th className="py-3 px-4">Apertura por</th>
                    <th className="py-3 px-4 text-right">Inicial</th>
                    <th className="py-3 px-4 text-right">Calculado</th>
                    <th className="py-3 px-4 text-right">Contado</th>
                    <th className="py-3 px-4 text-right">Diferencia</th>
                    <th className="py-3 px-4 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-aleman-negro/10">
                  {historialTurnos.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-aleman-negro/50 font-semibold">
                        No hay turnos en el historial.
                      </td>
                    </tr>
                  ) : (
                    historialTurnos.map((t) => {
                      const diff = t.diferencia || 0;
                      return (
                        <tr key={t._id} className="hover:bg-aleman-crema/40 transition-colors">
                          <td className="py-3 px-4 font-semibold">{formatearFechaCompleta(t.fechaApertura)}</td>
                          <td className="py-3 px-4 font-semibold">
                            {t.estado === 'abierto' ? (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-sm font-bold text-xs">
                                En Curso
                              </span>
                            ) : (
                              formatearFechaCompleta(t.fechaCierre)
                            )}
                          </td>
                          <td className="py-3 px-4 font-semibold">{t.usuarioAperturaId?.nombre || 'Sistema'}</td>
                          <td className="py-3 px-4 text-right font-display font-bold">
                            {formatCurrency(t.montoInicial)}
                          </td>
                          <td className="py-3 px-4 text-right font-display font-bold text-blue-900">
                            {t.montoCalculadoEfectivo !== undefined ? formatCurrency(t.montoCalculadoEfectivo) : '—'}
                          </td>
                          <td className="py-3 px-4 text-right font-display font-bold text-emerald-900">
                            {t.montoContadoEfectivo !== undefined ? formatCurrency(t.montoContadoEfectivo) : '—'}
                          </td>
                          <td
                            className={`py-3 px-4 text-right font-display font-bold ${
                              diff === 0 ? 'text-aleman-negro/60' : diff > 0 ? 'text-amber-700' : 'text-aleman-rojo'
                            }`}
                          >
                            {t.estado === 'cerrado' ? formatCurrency(diff) : '—'}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => handleVerDetalleTurno(t._id)}
                              className="px-3 py-1 bg-aleman-verde hover:bg-aleman-verde-dark text-aleman-hueso text-xs font-bold rounded-sm border border-aleman-dorado/40 cursor-pointer"
                            >
                              Ver Detalle
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* PESTAÑA 3: DESGLOSE COMIDA / BEBIDA (SOLO DUEÑO) */}
      {activeTab === 'desglose' && esDueno && (
        <div className="bg-aleman-hueso rounded-sm border-2 border-aleman-negro p-6 space-y-6">
          <div className="border-b-2 border-aleman-negro/10 pb-4">
            <h2 className="text-xl font-display font-bold text-aleman-negro">
              Desglose de Ventas por Categoría (Comida vs Bebida)
            </h2>
            <p className="text-sm text-aleman-negro/70 mt-1">
              Reparto total de ventas acumuladas por tipo de producto.
            </p>
          </div>

          {loadingDesglose ? (
            <div className="p-8 text-center text-aleman-negro font-bold">Cargando reporte de desglose...</div>
          ) : !desgloseData ? (
            <div className="p-8 text-center text-aleman-negro/50 font-semibold">No se encontraron datos de ventas.</div>
          ) : (
            <div className="space-y-6">
              {/* CARDS COMPARATIVAS */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="bg-aleman-crema p-5 rounded-sm border-2 border-aleman-negro/20">
                  <span className="text-xs font-bold uppercase text-aleman-rojo block">🍕 Ventas Comida</span>
                  <div className="text-2xl font-display font-bold text-aleman-rojo mt-1">
                    {formatCurrency(desgloseData.comida)}
                  </div>
                  <span className="text-sm font-bold text-aleman-negro/70 block mt-1">
                    {desgloseData.porcentajeComida}% del total
                  </span>
                </div>

                <div className="bg-aleman-crema p-5 rounded-sm border-2 border-aleman-negro/20">
                  <span className="text-xs font-bold uppercase text-emerald-800 block">🥤 Ventas Bebida</span>
                  <div className="text-2xl font-display font-bold text-emerald-800 mt-1">
                    {formatCurrency(desgloseData.bebida)}
                  </div>
                  <span className="text-sm font-bold text-aleman-negro/70 block mt-1">
                    {desgloseData.porcentajeBebida}% del total
                  </span>
                </div>

                <div className="bg-aleman-crema p-5 rounded-sm border-2 border-aleman-negro/20">
                  <span className="text-xs font-bold uppercase text-aleman-negro block">📊 Total Ventas</span>
                  <div className="text-2xl font-display font-bold text-aleman-negro mt-1">
                    {formatCurrency(desgloseData.totalVentas)}
                  </div>
                  <span className="text-sm font-bold text-aleman-negro/70 block mt-1">
                    {desgloseData.cantidadPedidos} pedidos analizados
                  </span>
                </div>
              </div>

              {/* DETALLE POR CATEGORÍA DE PRODUCTO */}
              <div className="border-t-2 border-aleman-negro/10 pt-4">
                <h3 className="text-base font-display font-bold text-aleman-negro uppercase tracking-wider mb-3">
                  Detalle por Categoría Específica
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {(desgloseData.porCategoria || []).map((catItem, idx) => (
                    <div key={idx} className="p-4 bg-white border border-aleman-negro/20 rounded-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-aleman-negro">{catItem.categoria}</span>
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-sm uppercase ${
                            catItem.tipo === 'comida' ? 'bg-rose-100 text-rose-900' : 'bg-emerald-100 text-emerald-900'
                          }`}
                        >
                          {catItem.tipo}
                        </span>
                      </div>
                      <div className="text-lg font-display font-bold text-aleman-negro mt-2">
                        {formatCurrency(catItem.total)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: REGISTRAR EGRESO MANUAL */}
      {isModalEgresoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-aleman-negro/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-aleman-hueso rounded-sm border-2 border-aleman-negro w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 bg-aleman-rojo text-aleman-hueso border-b-2 border-aleman-rojo-dark flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl">💸</span>
                <div>
                  <h3 className="text-lg font-display font-bold uppercase tracking-wider">
                    Registrar Egreso Manual
                  </h3>
                  <p className="text-xs text-aleman-hueso/70">Pago a proveedores, insumos menores o retiros</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalEgresoOpen(false)}
                className="text-aleman-hueso/70 hover:text-aleman-hueso text-lg font-bold p-1 rounded cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRegistrarEgresoManual} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-aleman-negro uppercase tracking-wider mb-1.5">
                  Motivo / Descripción del Egreso {esEncargado ? '*' : '(Opcional para dueño)'}
                </label>
                <input
                  type="text"
                  value={movDescripcion}
                  onChange={(e) => setMovDescripcion(e.target.value)}
                  placeholder="Ej: Pago de hielo, bolsas, retiro de caja..."
                  required={esEncargado}
                  className="w-full px-3.5 py-2.5 bg-white border-2 border-aleman-negro/25 rounded-sm text-base text-aleman-negro focus:border-aleman-verde focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-aleman-negro uppercase tracking-wider mb-1.5">
                  Monto ($) *
                </label>
                <input
                  type="number"
                  min="1"
                  step="100"
                  value={movMonto}
                  onChange={(e) => setMovMonto(e.target.value)}
                  placeholder="Ej: 3500"
                  required
                  className="w-full px-3.5 py-2.5 bg-white border-2 border-aleman-negro/25 rounded-sm text-base font-bold text-aleman-negro focus:border-aleman-verde focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-aleman-negro uppercase tracking-wider mb-1.5">
                  Categoría Operativa (Opcional)
                </label>
                <select
                  value={movCategoria}
                  onChange={(e) => setMovCategoria(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border-2 border-aleman-negro/25 rounded-sm text-base text-aleman-negro focus:border-aleman-verde focus:outline-none font-semibold"
                >
                  <option value="">Sin categoría específica</option>
                  <option value="comida">🍕 Insumos Comida</option>
                  <option value="bebida">🥤 Insumos Bebida</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t-2 border-aleman-negro/10">
                <button
                  type="button"
                  onClick={() => setIsModalEgresoOpen(false)}
                  className="px-4 py-2 text-sm font-bold uppercase tracking-wider text-aleman-negro hover:bg-aleman-crema rounded-sm border border-aleman-negro/25 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-bold uppercase tracking-wider text-aleman-hueso bg-aleman-rojo hover:bg-aleman-rojo-dark rounded-sm border border-aleman-negro/40 shadow-sm transition-colors cursor-pointer"
                >
                  Confirmar Egreso
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ARQUEO DE CAJA Y CIERRE DE TURNO */}
      {isModalArqueoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-aleman-negro/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-aleman-hueso rounded-sm border-2 border-aleman-negro w-full max-w-lg my-8 overflow-hidden">
            <div className="px-6 py-4 bg-aleman-verde text-aleman-hueso border-b-2 border-aleman-dorado flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">🔒</span>
                <div>
                  <h3 className="text-lg font-display font-bold uppercase tracking-wider">
                    Arqueo & Cierre de Caja
                  </h3>
                  <p className="text-sm text-aleman-dorado font-bold">Conteo de billetes y balance del turno</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalArqueoOpen(false)}
                className="text-aleman-hueso/70 hover:text-aleman-hueso text-lg font-bold p-1 rounded cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmarCierreCaja} className="p-6 space-y-5">
              <div className="p-4 bg-aleman-crema border-2 border-aleman-negro/15 rounded-sm space-y-3">
                <div className="flex items-center justify-between text-sm text-aleman-negro/70 font-semibold">
                  <span>Fondo Inicial de Caja:</span>
                  <span className="font-display font-bold text-aleman-negro text-base">
                    {formatCurrency(turnoActual?.montoInicial || 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm text-emerald-800 font-bold">
                  <span>+ Ingresos en Efectivo:</span>
                  <span className="font-display font-bold">
                    +{formatCurrency(totalesActuales?.ingresosPorMedioPago?.efectivo || 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm text-aleman-rojo font-bold">
                  <span>- Egresos de Caja:</span>
                  <span className="font-display font-bold">
                    -{formatCurrency(totalesActuales?.totalEgresos || 0)}
                  </span>
                </div>

                <div className="pt-2 border-t border-aleman-negro/15 flex items-center justify-between">
                  <span className="text-sm font-bold text-aleman-negro uppercase tracking-wider">
                    Efectivo Esperado en Cajón:
                  </span>
                  <span className="text-2xl font-display font-bold text-aleman-negro">
                    {formatCurrency(totalesActuales?.montoCalculadoEfectivo || 0)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-aleman-negro uppercase tracking-wider mb-1.5">
                  Efectivo Real Contado en Billetes ($) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={efectivoContado}
                  onChange={(e) => setEfectivoContado(e.target.value)}
                  placeholder="Ingresá cuánto dinero contaste"
                  required
                  className="w-full px-3.5 py-2.5 bg-white border-2 border-aleman-negro/25 rounded-sm text-lg font-bold text-aleman-negro focus:border-aleman-verde focus:outline-none"
                />
              </div>

              {/* Cálculo en vivo de la diferencia de arqueo */}
              {(() => {
                const contado = Number(efectivoContado);
                const esperado = totalesActuales?.montoCalculadoEfectivo || 0;
                if (isNaN(contado)) return null;

                const diff = contado - esperado;

                if (diff === 0) {
                  return (
                    <div className="p-3 bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-sm text-sm font-bold flex items-center gap-2">
                      <span>✅</span>
                      <span>¡Arqueo perfecto! La caja cuadra exactamente ($0 de diferencia).</span>
                    </div>
                  );
                }
                if (diff > 0) {
                  return (
                    <div className="p-3 bg-amber-100 border border-amber-300 text-amber-900 rounded-sm text-sm font-bold flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span>⚠️</span>
                        <span>Sobrante de caja en efectivo:</span>
                      </span>
                      <span className="text-base font-display font-bold text-amber-950">
                        +{formatCurrency(diff)}
                      </span>
                    </div>
                  );
                }
                return (
                  <div className="p-3 bg-rose-100 border border-rose-300 text-rose-900 rounded-sm text-sm font-bold flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <span>❌</span>
                      <span>Faltante de caja en efectivo:</span>
                    </span>
                    <span className="text-base font-display font-bold text-rose-950">
                      -{formatCurrency(Math.abs(diff))}
                    </span>
                  </div>
                );
              })()}

              <div className="flex items-center justify-end gap-3 pt-3 border-t-2 border-aleman-negro/10">
                <button
                  type="button"
                  onClick={() => setIsModalArqueoOpen(false)}
                  className="px-4 py-2 text-sm font-bold uppercase tracking-wider text-aleman-negro hover:bg-aleman-crema rounded-sm border border-aleman-negro/25 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-bold uppercase tracking-wider text-aleman-hueso bg-aleman-rojo hover:bg-aleman-rojo-dark rounded-sm border border-aleman-negro/40 shadow-sm transition-colors cursor-pointer"
                >
                  Confirmar y Cerrar Turno
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: DETALLE DE TURNO SELECCIONADO EN HISTORIAL */}
      {isModalDetalleTurnoOpen && turnoDetalleSeleccionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-aleman-negro/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-aleman-hueso rounded-sm border-2 border-aleman-negro w-full max-w-2xl my-8 overflow-hidden">
            <div className="px-6 py-4 bg-aleman-verde text-aleman-hueso border-b-2 border-aleman-dorado flex items-center justify-between">
              <div>
                <h3 className="text-lg font-display font-bold uppercase tracking-wider">
                  Detalle del Turno #{turnoDetalleSeleccionado.turno._id.substring(18)}
                </h3>
                <p className="text-xs text-aleman-dorado font-semibold">
                  Apertura: {formatearFechaCompleta(turnoDetalleSeleccionado.turno.fechaApertura)}
                </p>
              </div>
              <button
                onClick={() => setIsModalDetalleTurnoOpen(false)}
                className="text-aleman-hueso/70 hover:text-aleman-hueso text-lg font-bold p-1 rounded cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-aleman-crema border border-aleman-negro/15 rounded-sm text-xs">
                <div>
                  <span className="font-bold block text-aleman-negro/60">Fondo Inicial:</span>
                  <span className="font-display font-bold text-sm">
                    {formatCurrency(turnoDetalleSeleccionado.turno.montoInicial)}
                  </span>
                </div>
                <div>
                  <span className="font-bold block text-blue-900">Efectivo Calculado:</span>
                  <span className="font-display font-bold text-sm text-blue-950">
                    {formatCurrency(turnoDetalleSeleccionado.turno.montoCalculadoEfectivo || 0)}
                  </span>
                </div>
                <div>
                  <span className="font-bold block text-emerald-900">Efectivo Contado:</span>
                  <span className="font-display font-bold text-sm text-emerald-950">
                    {formatCurrency(turnoDetalleSeleccionado.turno.montoContadoEfectivo || 0)}
                  </span>
                </div>
                <div>
                  <span className="font-bold block text-aleman-negro/60">Diferencia:</span>
                  <span className="font-display font-bold text-sm">
                    {formatCurrency(turnoDetalleSeleccionado.turno.diferencia || 0)}
                  </span>
                </div>
              </div>

              <h4 className="font-display font-bold text-sm uppercase tracking-wider text-aleman-negro">
                Movimientos del Turno ({turnoDetalleSeleccionado.movimientos?.length || 0})
              </h4>

              <div className="divide-y divide-aleman-negro/10 border border-aleman-negro/15 rounded-sm bg-white">
                {(turnoDetalleSeleccionado.movimientos || []).map((m) => (
                  <div key={m._id} className="p-3 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-mono text-aleman-negro/60 mr-2">
                        {formatearFechaHora(m.fecha || m.createdAt)}
                      </span>
                      <span className="font-bold text-aleman-negro">
                        {m.motivo || (m.tipo === 'ingreso' ? 'Ingreso por venta' : 'Egreso manual')}
                      </span>
                      <span className="text-aleman-negro/50 ml-2">({m.usuarioId?.nombre || 'Sistema'})</span>
                    </div>
                    <span
                      className={`font-display font-bold text-sm ${
                        m.tipo === 'ingreso' ? 'text-emerald-800' : m.tipo === 'egreso' ? 'text-aleman-rojo' : 'text-aleman-negro/50'
                      }`}
                    >
                      {m.tipo === 'ingreso' ? '+' : m.tipo === 'egreso' ? '-' : ''}
                      {formatCurrency(m.monto)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-6 py-3 bg-aleman-crema border-t border-aleman-negro/15 flex justify-end">
              <button
                onClick={() => setIsModalDetalleTurnoOpen(false)}
                className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-aleman-negro bg-white border border-aleman-negro/25 rounded-sm cursor-pointer"
              >
                Cerrar Detalle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
