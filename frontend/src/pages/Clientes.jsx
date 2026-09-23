import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../context/useAuth';
import apiClient from '../services/apiClient';
import {
  mockClientes,
  registrarOActualizarCliente,
  editarClienteEnMockData,
  formatCurrency,
} from '../services/mockData';

export default function Clientes() {
  const { user } = useAuth();
  const esDueno = user?.rol === 'dueno';
  const esEncargado = user?.rol === 'encargado';

  const [clientes, setClientes] = useState([]);

  // Carga inicial de clientes desde backend
  const cargarClientes = async () => {
    try {
      const res = await apiClient.get('/clientes');
      const rawList = res.data?.clientes || [];
      const mapped = rawList.map((c) => ({
        id: c._id || c.id,
        _id: c._id || c.id,
        nombre: c.nombre,
        telefono: c.telefono,
        direccion: c.direccion || '',
        direccionesFrecuentes: c.direccion ? [c.direccion] : [],
        historialPedidos: [],
      }));
      setClientes(mapped);
    } catch {
      showToast('Error al cargar clientes desde el servidor');
    }
  };

  useEffect(() => {
    cargarClientes();
  }, []);

  // Filtro y búsqueda
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipoCliente, setFiltroTipoCliente] = useState('todos'); // 'todos' | 'con_pedidos' | 'frecuentes'

  // Modales
  const [isModalNuevoOpen, setIsModalNuevoOpen] = useState(false);
  const [clienteDetalleId, setClienteDetalleId] = useState(null);
  const [clienteEditando, setClienteEditando] = useState(null);

  // Formulario Nuevo Cliente
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoTelefono, setNuevoTelefono] = useState('');
  const [nuevaDireccion, setNuevaDireccion] = useState('');

  // Formulario Editar Cliente
  const [editNombre, setEditNombre] = useState('');
  const [editTelefono, setEditTelefono] = useState('');
  const [editDirecciones, setEditDirecciones] = useState([]);
  const [direccionNuevaInput, setDireccionNuevaInput] = useState('');

  // Toast
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Abrir detalle y cargar historial de pedidos real desde el backend
  const handleAbrirDetalleCliente = async (cliente) => {
    const targetId = cliente._id || cliente.id;
    setClienteDetalleId(targetId);

    try {
      const res = await apiClient.get(`/clientes/${targetId}/pedidos`);
      const rawPedidos = res.data?.pedidos || [];
      const historialMapped = rawPedidos.map((p) => {
        const itemsActivos = (p.items || []).filter((i) => !i.eliminado);
        const totalCalc = itemsActivos.reduce(
          (sum, i) => sum + (i.cantidad || 1) * (i.precioUnitario || 0),
          0
        );
        const itemsResumenText = itemsActivos
          .map((i) => `${i.cantidad}x ${i.nombreProducto || 'Producto'}`)
          .join(', ');

        return {
          id: p._id || p.id,
          tipo: p.tipo,
          fecha: new Date(p.createdAt).toLocaleDateString('es-AR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
          total: totalCalc,
          medioPago: p.medioPago || 'Efectivo',
          itemsResumen: itemsResumenText,
          items: itemsActivos.map((i) => ({
            id: i._id || i.id,
            nombre: i.nombreProducto || 'Producto',
            cantidad: i.cantidad,
            precioUnitario: i.precioUnitario,
            aclaracion: i.aclaraciones || '',
          })),
        };
      });

      setClientes((prev) =>
        prev.map((c) =>
          c.id === targetId || c._id === targetId
            ? { ...c, historialPedidos: historialMapped }
            : c
        )
      );
    } catch {
      showToast('Error al obtener el historial de pedidos del cliente');
    }
  };

  // Cliente activo en modal de detalle
  const clienteActual = useMemo(() => {
    return clientes.find((c) => c.id === clienteDetalleId || c._id === clienteDetalleId) || null;
  }, [clientes, clienteDetalleId]);

  // =========================================================
  // CREAR NUEVO CLIENTE MANUALMENTE
  // =========================================================

  const handleOpenNuevoModal = () => {
    setNuevoNombre('');
    setNuevoTelefono('');
    setNuevaDireccion('');
    setIsModalNuevoOpen(true);
  };

  const handleCrearCliente = async (e) => {
    e.preventDefault();

    if (!nuevoNombre.trim()) {
      alert('Por favor ingresá el nombre del cliente.');
      return;
    }

    if (!nuevoTelefono.trim()) {
      alert('Por favor ingresá el número de teléfono del cliente.');
      return;
    }

    try {
      await apiClient.post('/clientes', {
        nombre: nuevoNombre.trim(),
        telefono: nuevoTelefono.trim(),
        direccion: nuevaDireccion.trim(),
      });
      showToast(`👤 Cliente "${nuevoNombre.trim()}" guardado con éxito`);
      setIsModalNuevoOpen(false);
      cargarClientes();
    } catch (err) {
      alert(err.response?.data?.mensaje || 'Error al crear cliente');
    }
  };

  // =========================================================
  // EDITAR CLIENTE EXISTENTE
  // =========================================================

  const handleOpenEditarModal = (cliente) => {
    setClienteEditando(cliente);
    setEditNombre(cliente.nombre);
    setEditTelefono(cliente.telefono);
    setEditDirecciones([...(cliente.direccionesFrecuentes || [])]);
    setDireccionNuevaInput('');
  };

  const handleAddDireccionEdit = () => {
    if (!direccionNuevaInput.trim()) return;
    const dir = direccionNuevaInput.trim();
    if (!editDirecciones.includes(dir)) {
      setEditDirecciones([...editDirecciones, dir]);
    }
    setDireccionNuevaInput('');
  };

  const handleRemoveDireccionEdit = (index) => {
    setEditDirecciones(editDirecciones.filter((_, i) => i !== index));
  };

  const handleGuardarEdicionCliente = async (e) => {
    e.preventDefault();
    if (!clienteEditando) return;

    if (!editNombre.trim()) {
      alert('Por favor ingresá un nombre.');
      return;
    }

    if (!editTelefono.trim()) {
      alert('Por favor ingresá un teléfono.');
      return;
    }

    try {
      const ultDir = editDirecciones.length > 0 ? editDirecciones[editDirecciones.length - 1] : '';
      await apiClient.put(`/clientes/${clienteEditando._id || clienteEditando.id}`, {
        nombre: editNombre.trim(),
        telefono: editTelefono.trim(),
        direccion: ultDir,
      });
      showToast(`✏️ Datos de "${editNombre.trim()}" actualizados`);
      setClienteEditando(null);
      cargarClientes();
    } catch (err) {
      alert(err.response?.data?.mensaje || 'Error al actualizar datos del cliente');
    }
  };

  // =========================================================
  // CÁLCULOS Y FILTROS
  // =========================================================

  // Calcular total acumulado gastado por un cliente
  const calcularGastoTotal = (cliente) => {
    if (!cliente || !Array.isArray(cliente.historialPedidos)) return 0;
    return cliente.historialPedidos.reduce(
      (sum, p) => sum + (Number(p.total) || 0),
      0
    );
  };

  // Filtrado de clientes
  const clientesFiltrados = useMemo(() => {
    return clientes.filter((c) => {
      // Filtro por tipo
      const cantPedidos = c.historialPedidos?.length || 0;
      if (filtroTipoCliente === 'con_pedidos' && cantPedidos === 0) return false;
      if (filtroTipoCliente === 'frecuentes' && cantPedidos < 2) return false;

      // Filtro de búsqueda
      if (busqueda.trim()) {
        const term = busqueda.toLowerCase();
        const matchNombre = c.nombre.toLowerCase().includes(term);
        const matchTel = c.telefono.toLowerCase().includes(term);
        const matchDir = (c.direccionesFrecuentes || []).some((d) =>
          d.toLowerCase().includes(term)
        );
        if (!matchNombre && !matchTel && !matchDir) return false;
      }

      return true;
    });
  }, [clientes, filtroTipoCliente, busqueda]);

  // Estadísticas generales superiores
  const statsClientes = useMemo(() => {
    const total = clientes.length;
    let totalPedidosAcumulados = 0;
    let totalFacturado = 0;
    let clientesFrecuentes = 0;

    clientes.forEach((c) => {
      const cant = c.historialPedidos?.length || 0;
      totalPedidosAcumulados += cant;
      if (cant >= 2) clientesFrecuentes++;
      totalFacturado += calcularGastoTotal(c);
    });

    return {
      total,
      totalPedidosAcumulados,
      totalFacturado,
      clientesFrecuentes,
    };
  }, [clientes]);

  return (
    <div className="space-y-6 font-body text-aleman-negro">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-aleman-verde text-aleman-hueso text-sm font-semibold px-4 py-2.5 rounded-sm shadow-md flex items-center gap-2 border-2 border-aleman-dorado animate-bounce">
          <span>👥</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ========================================================= */}
      {/* ENCABEZADO Y ACCIÓN NUEVO CLIENTE */}
      {/* ========================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-aleman-negro">
            Directorio de Clientes
          </h1>
          <p className="text-base text-aleman-negro/70">
            Base centralizada de contactos, direcciones frecuentes e historial de pedidos
          </p>
        </div>

        <button
          onClick={handleOpenNuevoModal}
          className="px-4 py-2.5 bg-aleman-rojo hover:bg-aleman-rojo-dark text-aleman-hueso font-bold text-base rounded-sm border border-aleman-negro/40 shadow-sm transition-colors flex items-center justify-center gap-2 self-start sm:self-auto cursor-pointer uppercase tracking-wider"
        >
          <span className="text-lg leading-none font-bold">+</span> Nuevo Cliente
        </button>
      </div>

      {/* ========================================================= */}
      {/* TARJETAS KPI / MÉTRICAS DE CLIENTES */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Total Clientes */}
        <div className="bg-aleman-hueso rounded-sm p-5 border-2 border-aleman-negro/20 flex items-center justify-between">
          <div>
            <span className="text-sm font-bold uppercase tracking-wider text-aleman-negro/70 block">
              Clientes Registrados
            </span>
            <div className="text-2xl font-display font-bold text-aleman-negro mt-1">
              {statsClientes.total}
            </div>
            <span className="text-sm text-emerald-800 font-semibold block mt-1">
              ⭐ {statsClientes.clientesFrecuentes} clientes frecuentes (2+ pedidos)
            </span>
          </div>
          <div className="p-3 bg-aleman-crema border border-aleman-negro/15 text-aleman-dorado rounded-sm text-2xl">
            👥
          </div>
        </div>

        {/* Card 2: Pedidos Acumulados */}
        <div className="bg-aleman-hueso rounded-sm p-5 border-2 border-aleman-negro/20 flex items-center justify-between">
          <div>
            <span className="text-sm font-bold uppercase tracking-wider text-aleman-negro/70 block">
              Pedidos Totales Registrados
            </span>
            <div className="text-2xl font-display font-bold text-aleman-negro mt-1">
              {statsClientes.totalPedidosAcumulados}
            </div>
            <span className="text-sm text-aleman-negro/60 font-medium block mt-1">
              En Delivery y Take Away
            </span>
          </div>
          <div className="p-3 bg-aleman-crema border border-aleman-negro/15 text-blue-900 rounded-sm text-2xl">
            📦
          </div>
        </div>

        {/* Card 3: Facturación Clientes */}
        <div className="bg-aleman-hueso rounded-sm p-5 border-2 border-aleman-negro/20 flex items-center justify-between">
          <div>
            <span className="text-sm font-bold uppercase tracking-wider text-aleman-negro/70 block">
              Facturación Acumulada
            </span>
            <div className="text-2xl font-display font-bold text-emerald-800 mt-1">
              {formatCurrency(statsClientes.totalFacturado)}
            </div>
            <span className="text-sm text-aleman-negro/60 font-medium block mt-1">
              Ventas totales de clientes registrados
            </span>
          </div>
          <div className="p-3 bg-aleman-crema border border-aleman-negro/15 text-emerald-800 rounded-sm text-2xl">
            💰
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* BARRA DE BÚSQUEDA Y FILTROS */}
      {/* ========================================================= */}
      <div className="bg-aleman-hueso rounded-sm p-4 border-2 border-aleman-negro/20 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Input Buscador */}
          <div className="relative min-w-[260px]">
            <input
              type="text"
              placeholder="Buscar por nombre, teléfono o dirección..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full px-3.5 py-2 bg-white border-2 border-aleman-negro/25 rounded-sm text-base text-aleman-negro focus:border-aleman-verde focus:outline-none"
            />
            {busqueda && (
              <button
                onClick={() => setBusqueda('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-aleman-negro/40 hover:text-aleman-negro text-sm cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filtro Tipo Cliente */}
          <select
            value={filtroTipoCliente}
            onChange={(e) => setFiltroTipoCliente(e.target.value)}
            className="px-3.5 py-2 bg-white border-2 border-aleman-negro/25 rounded-sm text-base text-aleman-negro focus:border-aleman-verde focus:outline-none font-semibold"
          >
            <option value="todos">Todos los clientes ({clientes.length})</option>
            <option value="con_pedidos">Con pedidos registrados</option>
            <option value="frecuentes">⭐ Clientes Frecuentes (2+ pedidos)</option>
          </select>
        </div>

        <div className="text-sm text-aleman-negro/70 font-semibold self-end sm:self-center">
          Mostrando {clientesFiltrados.length} de {clientes.length} clientes
        </div>
      </div>

      {/* ========================================================= */}
      {/* TABLA PRINCIPAL DE CLIENTES (DESKTOP >= md) */}
      {/* ========================================================= */}
      <div className="hidden md:block bg-aleman-hueso rounded-sm border-2 border-aleman-negro/20 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-base text-aleman-negro">
            <thead className="bg-aleman-crema text-sm uppercase font-bold text-aleman-negro border-b-2 border-aleman-negro/20">
              <tr>
                <th className="py-3.5 px-6">Cliente</th>
                <th className="py-3.5 px-6">Teléfono</th>
                <th className="py-3.5 px-6 text-center">Pedidos</th>
                <th className="py-3.5 px-6">Última Dirección / Frecuentes</th>
                <th className="py-3.5 px-6 text-right">Gasto Acumulado</th>
                <th className="py-3.5 px-6 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-aleman-negro/10">
              {clientesFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-aleman-negro/50">
                    <div className="text-3xl mb-2">🔍</div>
                    <p className="font-bold text-aleman-negro text-lg">
                      No se encontraron clientes con los filtros seleccionados
                    </p>
                    <p className="text-sm text-aleman-negro/60 mt-1">
                      Probá cambiando el texto de búsqueda o agregá un nuevo cliente.
                    </p>
                  </td>
                </tr>
              ) : (
                clientesFiltrados.map((cliente) => {
                  const gastoTotal = calcularGastoTotal(cliente);
                  const cantPedidos = cliente.historialPedidos?.length || 0;
                  const ultDireccion =
                    cliente.direccionesFrecuentes &&
                    cliente.direccionesFrecuentes.length > 0
                      ? cliente.direccionesFrecuentes[
                          cliente.direccionesFrecuentes.length - 1
                        ]
                      : null;

                  return (
                    <tr
                      key={cliente.id}
                      className="hover:bg-aleman-crema/50 transition-colors"
                    >
                      {/* 1. Nombre */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-sm bg-aleman-dorado text-aleman-negro font-display font-bold text-base flex items-center justify-center border border-aleman-dorado-light shrink-0">
                            {cliente.nombre.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-aleman-negro text-base flex items-center gap-1.5">
                              {cliente.nombre}
                              {cantPedidos >= 2 && (
                                <span className="px-1.5 py-0.2 bg-aleman-dorado text-aleman-negro text-xs font-bold rounded-sm border border-aleman-negro/20">
                                  ⭐ Frecuente
                                </span>
                              )}
                            </div>
                            <span className="text-sm text-aleman-negro/50 font-mono">
                              ID: {cliente.id}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 2. Teléfono */}
                      <td className="py-4 px-6 font-semibold text-aleman-negro">
                        <span className="inline-flex items-center gap-1">
                          <span>📞</span> {cliente.telefono}
                        </span>
                      </td>

                      {/* 3. Cantidad de Pedidos */}
                      <td className="py-4 px-6 text-center">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-sm text-sm font-bold border ${
                            cantPedidos > 0
                              ? 'bg-aleman-crema text-aleman-negro border-aleman-negro/20'
                              : 'bg-aleman-hueso text-aleman-negro/40 border-aleman-negro/10'
                          }`}
                        >
                          {cantPedidos} pedido(s)
                        </span>
                      </td>

                      {/* 4. Direcciones frecuentes */}
                      <td className="py-4 px-6 max-w-xs">
                        {ultDireccion ? (
                          <div>
                            <div className="text-sm text-aleman-negro font-medium truncate" title={ultDireccion}>
                              📍 {ultDireccion}
                            </div>
                            {cliente.direccionesFrecuentes.length > 1 && (
                              <span className="text-xs text-aleman-negro/50 font-semibold">
                                +{cliente.direccionesFrecuentes.length - 1} dirección(es) más
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-aleman-negro/40 italic">
                            Sin dirección guardada (Take Away)
                          </span>
                        )}
                      </td>

                      {/* 5. Gasto Acumulado */}
                      <td className="py-4 px-6 text-right font-display font-bold text-aleman-negro text-lg">
                        {formatCurrency(gastoTotal)}
                      </td>

                      {/* 6. Acciones */}
                      <td className="py-4 px-6 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => handleAbrirDetalleCliente(cliente)}
                          className="px-3 py-1.5 bg-aleman-verde hover:bg-aleman-verde-dark text-aleman-hueso font-bold text-sm uppercase tracking-wider rounded-sm border border-aleman-dorado/40 transition-colors cursor-pointer"
                        >
                          📋 Ficha / Historial
                        </button>
                        <button
                          onClick={() => handleOpenEditarModal(cliente)}
                          className="px-2.5 py-1.5 text-aleman-negro bg-aleman-crema hover:bg-aleman-hueso font-bold text-sm uppercase tracking-wider rounded-sm border border-aleman-negro/25 transition-colors cursor-pointer"
                        >
                          ✏️ Editar
                        </button>
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
      {/* LISTADO DE CARDS DE CLIENTES (MOBILE < md) */}
      {/* ========================================================= */}
      <div className="md:hidden space-y-3">
        {clientesFiltrados.length === 0 ? (
          <div className="bg-aleman-hueso rounded-sm border-2 border-aleman-negro/20 p-8 text-center text-aleman-negro/50">
            <div className="text-3xl mb-2">🔍</div>
            <p className="font-bold text-aleman-negro text-base">
              No se encontraron clientes con los filtros seleccionados
            </p>
            <p className="text-xs text-aleman-negro/60 mt-1">
              Probá cambiando el texto de búsqueda o agregá un nuevo cliente.
            </p>
          </div>
        ) : (
          clientesFiltrados.map((cliente) => {
            const gastoTotal = calcularGastoTotal(cliente);
            const cantPedidos = cliente.historialPedidos?.length || 0;
            const ultDireccion =
              cliente.direccionesFrecuentes &&
              cliente.direccionesFrecuentes.length > 0
                ? cliente.direccionesFrecuentes[
                    cliente.direccionesFrecuentes.length - 1
                  ]
                : null;

            return (
              <div
                key={cliente.id}
                onClick={() => handleAbrirDetalleCliente(cliente)}
                className="bg-aleman-hueso rounded-sm p-4 border-2 border-aleman-negro/20 hover:border-aleman-dorado active:bg-aleman-crema/40 transition-colors cursor-pointer space-y-2.5 shadow-2xs"
              >
                {/* Arriba: avatar/inicial + nombre destacado + badge de frecuente */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-sm bg-aleman-dorado text-aleman-negro font-display font-bold text-base flex items-center justify-center border border-aleman-dorado-light shrink-0">
                      {cliente.nombre.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-aleman-negro text-base leading-tight">
                          {cliente.nombre}
                        </span>
                        {cantPedidos >= 2 && (
                          <span className="px-1.5 py-0.5 bg-aleman-dorado text-aleman-negro text-xs font-bold rounded-sm border border-aleman-negro/20 shrink-0">
                            ⭐ Frecuente
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-aleman-negro/50 font-mono block">
                        ID: {cliente.id}
                      </span>
                    </div>
                  </div>

                  <span className="text-xs font-bold text-aleman-verde uppercase tracking-wider shrink-0">
                    Ficha ➜
                  </span>
                </div>

                {/* Debajo: teléfono */}
                <div className="text-sm font-semibold text-aleman-negro flex items-center gap-1.5">
                  <span className="text-aleman-negro/60">📞</span>
                  <a
                    href={`tel:${cliente.telefono.replace(/\s+/g, '')}`}
                    onClick={(e) => e.stopPropagation()}
                    className="hover:underline hover:text-aleman-verde transition-colors"
                  >
                    {cliente.telefono}
                  </a>
                </div>

                {/* Debajo: última dirección usada (si tiene) */}
                {ultDireccion ? (
                  <div className="text-sm text-aleman-negro font-medium flex items-start gap-1.5">
                    <span className="shrink-0 text-aleman-negro/50">📍</span>
                    <span className="leading-snug">{ultDireccion}</span>
                    {cliente.direccionesFrecuentes.length > 1 && (
                      <span className="shrink-0 text-xs text-aleman-negro/50 font-semibold">
                        (+{cliente.direccionesFrecuentes.length - 1})
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-aleman-negro/40 italic flex items-center gap-1">
                    <span>📍</span> Sin dirección guardada (Take Away)
                  </div>
                )}

                {/* Al final: cantidad de pedidos realizados y gasto total acumulado en renglón secundario */}
                <div className="pt-2.5 border-t border-aleman-negro/10 flex items-center justify-between text-xs text-aleman-negro/70">
                  <span
                    className={`inline-block px-2 py-0.5 rounded-sm font-bold border ${
                      cantPedidos > 0
                        ? 'bg-aleman-crema text-aleman-negro border-aleman-negro/20'
                        : 'bg-aleman-hueso text-aleman-negro/40 border-aleman-negro/10'
                    }`}
                  >
                    📦 {cantPedidos} pedido(s)
                  </span>

                  <div className="text-right">
                    <span className="text-[11px] text-aleman-negro/50 uppercase tracking-wider font-semibold mr-1">
                      Total:
                    </span>
                    <span className="font-display font-bold text-aleman-negro text-base">
                      {formatCurrency(gastoTotal)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ========================================================= */}
      {/* MODAL 1: FICHA DE DETALLE DE CLIENTE E HISTORIAL */}
      {/* ========================================================= */}
      {clienteActual && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-aleman-negro/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-aleman-hueso rounded-sm border-2 border-aleman-negro w-full max-w-3xl my-4 overflow-hidden flex flex-col max-h-[92vh]">
            {/* Header Ficha */}
            <div className="px-6 py-4 border-b-2 border-aleman-dorado flex flex-wrap items-center justify-between gap-3 bg-aleman-verde text-aleman-hueso">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-sm bg-aleman-dorado text-aleman-negro font-display font-bold text-lg flex items-center justify-center">
                  {clienteActual.nombre.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-xl font-display font-bold uppercase tracking-wider flex items-center gap-2">
                    {clienteActual.nombre}
                    {clienteActual.historialPedidos?.length >= 2 && (
                      <span className="px-2 py-0.5 bg-aleman-dorado text-aleman-negro text-xs font-bold rounded-sm border border-aleman-negro/30">
                        CLIENTE FRECUENTE
                      </span>
                    )}
                  </h3>
                  <span className="text-sm text-aleman-hueso/70 font-semibold">
                    📞 Teléfono: {clienteActual.telefono}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    handleOpenEditarModal(clienteActual);
                  }}
                  className="px-3 py-1.5 bg-aleman-verde-dark hover:bg-aleman-verde text-aleman-hueso text-sm font-bold uppercase tracking-wider rounded-sm border border-aleman-dorado/40 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  ✏️ Editar Datos
                </button>
                <button
                  onClick={() => setClienteDetalleId(null)}
                  className="text-aleman-hueso/70 hover:text-aleman-hueso text-xl font-bold p-1 rounded transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Body Ficha */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Resumen Métricas Cliente */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-aleman-crema border-2 border-aleman-negro/15 rounded-sm text-center">
                <div className="bg-aleman-hueso p-3 rounded-sm border border-aleman-negro/20">
                  <span className="text-xs text-aleman-negro/70 uppercase tracking-wider font-bold block">
                    Pedidos Totales
                  </span>
                  <span className="text-2xl font-display font-bold text-aleman-negro mt-0.5 block">
                    {clienteActual.historialPedidos?.length || 0}
                  </span>
                </div>

                <div className="bg-aleman-hueso p-3 rounded-sm border border-aleman-negro/20">
                  <span className="text-xs text-aleman-negro/70 uppercase tracking-wider font-bold block">
                    Total Gastado
                  </span>
                  <span className="text-2xl font-display font-bold text-emerald-800 mt-0.5 block">
                    {formatCurrency(calcularGastoTotal(clienteActual))}
                  </span>
                </div>

                <div className="bg-aleman-hueso p-3 rounded-sm border border-aleman-negro/20">
                  <span className="text-xs text-aleman-negro/70 uppercase tracking-wider font-bold block">
                    Direcciones Guardadas
                  </span>
                  <span className="text-2xl font-display font-bold text-blue-900 mt-0.5 block">
                    {clienteActual.direccionesFrecuentes?.length || 0}
                  </span>
                </div>
              </div>

              {/* Direcciones Frecuentes */}
              <div className="space-y-2">
                <h4 className="text-sm font-display font-bold text-aleman-negro uppercase tracking-wider">
                  📍 Direcciones Frecuentes de Entrega
                </h4>

                {!clienteActual.direccionesFrecuentes ||
                clienteActual.direccionesFrecuentes.length === 0 ? (
                  <div className="p-3 bg-aleman-crema border border-dashed border-aleman-negro/20 rounded-sm text-sm text-aleman-negro/50 text-center font-semibold">
                    No tiene direcciones registradas. Se agregarán automáticamente al realizar pedidos de Delivery.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {clienteActual.direccionesFrecuentes.map((dir, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 bg-aleman-crema border border-aleman-negro/15 rounded-sm text-sm text-aleman-negro"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-base">🏡</span>
                          <span className="font-semibold">{dir}</span>
                        </div>
                        {idx === clienteActual.direccionesFrecuentes.length - 1 && (
                          <span className="text-xs bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-sm font-bold border border-emerald-300">
                            Última usada
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Historial de Pedidos Realizados */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-display font-bold text-aleman-negro uppercase tracking-wider">
                    🧾 Historial de Pedidos Realizados
                  </h4>
                  <span className="text-sm text-aleman-negro/60 font-semibold">
                    {clienteActual.historialPedidos?.length || 0} compras
                  </span>
                </div>

                {!clienteActual.historialPedidos ||
                clienteActual.historialPedidos.length === 0 ? (
                  <div className="p-6 bg-aleman-crema border border-dashed border-aleman-negro/20 rounded-sm text-center text-sm text-aleman-negro/50">
                    Aún no se registraron pedidos para este cliente.
                  </div>
                ) : (
                  <div className="overflow-x-auto border-2 border-aleman-negro/20 rounded-sm overflow-hidden">
                    <table className="w-full text-left text-sm text-aleman-negro">
                      <thead className="bg-aleman-crema font-bold uppercase text-xs text-aleman-negro border-b-2 border-aleman-negro/20">
                        <tr>
                          <th className="py-2.5 px-4">ID Pedido</th>
                          <th className="py-2.5 px-4">Canal</th>
                          <th className="py-2.5 px-4">Fecha / Hora</th>
                          <th className="py-2.5 px-4 text-right font-bold">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-aleman-negro/10 bg-aleman-hueso">
                        {clienteActual.historialPedidos.map((ped, idx) => (
                          <tr key={idx} className="hover:bg-aleman-crema/50">
                            <td className="py-3 px-4 font-bold text-aleman-negro">
                              #{ped.id}
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-sm text-xs font-bold border ${
                                  ped.tipo === 'delivery'
                                    ? 'bg-aleman-dorado text-aleman-negro border-aleman-dorado-light'
                                    : 'bg-aleman-crema text-aleman-negro border-aleman-negro/25'
                                }`}
                              >
                                {ped.tipo === 'delivery' ? '🛵 Delivery' : '🛍️ Take Away'}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-semibold text-sm text-aleman-negro/70">
                              {ped.fecha}
                            </td>
                            <td className="py-3 px-4 text-right font-display font-bold text-aleman-negro text-base">
                              {formatCurrency(ped.total)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Ficha */}
            <div className="px-6 py-3 bg-aleman-crema border-t-2 border-aleman-negro/10 flex justify-end">
              <button
                type="button"
                onClick={() => setClienteDetalleId(null)}
                className="px-5 py-2 text-sm font-bold uppercase tracking-wider text-aleman-negro bg-aleman-hueso border border-aleman-negro/25 hover:bg-aleman-crema rounded-sm transition-colors cursor-pointer"
              >
                Cerrar Ficha
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: NUEVO CLIENTE (MANUAL) */}
      {/* ========================================================= */}
      {isModalNuevoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-aleman-negro/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-aleman-hueso rounded-sm border-2 border-aleman-negro w-full max-w-lg my-8 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b-2 border-aleman-dorado flex items-center justify-between bg-aleman-verde text-aleman-hueso">
              <div className="flex items-center gap-2">
                <span className="text-2xl">👤</span>
                <div>
                  <h3 className="text-xl font-display font-bold uppercase tracking-wider">
                    Nuevo Cliente
                  </h3>
                  <p className="text-sm text-aleman-hueso/70">
                    Registrá los datos de contacto y dirección inicial
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalNuevoOpen(false)}
                className="text-aleman-hueso/70 hover:text-aleman-hueso text-xl font-bold p-1 rounded transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCrearCliente} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-aleman-negro uppercase tracking-wider mb-1.5">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  value={nuevoNombre}
                  onChange={(e) => setNuevoNombre(e.target.value)}
                  placeholder="Ej: Laura Santoro"
                  required
                  className="w-full px-3.5 py-2.5 bg-white border-2 border-aleman-negro/25 rounded-sm text-base text-aleman-negro focus:border-aleman-verde focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-aleman-negro uppercase tracking-wider mb-1.5">
                  Teléfono de Contacto (Identificador único) *
                </label>
                <input
                  type="text"
                  value={nuevoTelefono}
                  onChange={(e) => setNuevoTelefono(e.target.value)}
                  placeholder="Ej: 11-5566-7788"
                  required
                  className="w-full px-3.5 py-2.5 bg-white border-2 border-aleman-negro/25 rounded-sm text-base text-aleman-negro focus:border-aleman-verde focus:outline-none font-semibold"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-aleman-negro uppercase tracking-wider mb-1.5">
                  Dirección Inicial de Entrega (Opcional)
                </label>
                <input
                  type="text"
                  value={nuevaDireccion}
                  onChange={(e) => setNuevaDireccion(e.target.value)}
                  placeholder="Ej: Gurruchaga 1520, Piso 2 A"
                  className="w-full px-3.5 py-2.5 bg-white border-2 border-aleman-negro/25 rounded-sm text-base text-aleman-negro focus:border-aleman-verde focus:outline-none"
                />
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t-2 border-aleman-negro/10">
                <button
                  type="button"
                  onClick={() => setIsModalNuevoOpen(false)}
                  className="px-4 py-2 text-sm font-bold uppercase tracking-wider text-aleman-negro hover:bg-aleman-crema rounded-sm border border-aleman-negro/25 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-bold uppercase tracking-wider text-aleman-hueso bg-aleman-rojo hover:bg-aleman-rojo-dark rounded-sm border border-aleman-negro/40 shadow-sm transition-colors cursor-pointer"
                >
                  Guardar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: EDITAR CLIENTE EXISTENTE */}
      {/* ========================================================= */}
      {clienteEditando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-aleman-negro/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-aleman-hueso rounded-sm border-2 border-aleman-negro w-full max-w-lg my-8 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b-2 border-aleman-dorado flex items-center justify-between bg-aleman-verde text-aleman-hueso">
              <div className="flex items-center gap-2">
                <span className="text-2xl">✏️</span>
                <div>
                  <h3 className="text-xl font-display font-bold uppercase tracking-wider">
                    Editar Datos de Cliente
                  </h3>
                  <span className="text-sm text-aleman-dorado font-bold">
                    ID: {clienteEditando.id}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setClienteEditando(null)}
                className="text-aleman-hueso/70 hover:text-aleman-hueso text-xl font-bold p-1 rounded transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleGuardarEdicionCliente} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-aleman-negro uppercase tracking-wider mb-1.5">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  value={editNombre}
                  onChange={(e) => setEditNombre(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-white border-2 border-aleman-negro/25 rounded-sm text-base text-aleman-negro focus:border-aleman-verde focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-aleman-negro uppercase tracking-wider mb-1.5">
                  Teléfono de Contacto *
                </label>
                <input
                  type="text"
                  value={editTelefono}
                  onChange={(e) => setEditTelefono(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-white border-2 border-aleman-negro/25 rounded-sm text-base text-aleman-negro focus:border-aleman-verde focus:outline-none font-semibold"
                />
              </div>

              {/* Gestión de direcciones frecuentes */}
              <div className="space-y-2">
                <label className="block text-sm font-bold text-aleman-negro uppercase tracking-wider mb-1">
                  Direcciones Frecuentes
                </label>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Agregar nueva dirección..."
                    value={direccionNuevaInput}
                    onChange={(e) => setDireccionNuevaInput(e.target.value)}
                    className="flex-1 px-3 py-2 bg-white border-2 border-aleman-negro/25 rounded-sm text-sm text-aleman-negro focus:border-aleman-verde focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddDireccionEdit}
                    className="px-3 py-2 bg-aleman-verde hover:bg-aleman-verde-dark text-aleman-hueso text-sm font-bold uppercase tracking-wider rounded-sm border border-aleman-dorado/40 cursor-pointer transition-colors"
                  >
                    + Agregar
                  </button>
                </div>

                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {editDirecciones.map((dir, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 bg-aleman-crema border border-aleman-negro/15 rounded-sm text-sm"
                    >
                      <span className="truncate pr-2 font-medium text-aleman-negro">
                        📍 {dir}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveDireccionEdit(idx)}
                        className="text-aleman-negro/40 hover:text-aleman-rojo p-1 font-bold cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t-2 border-aleman-negro/10">
                <button
                  type="button"
                  onClick={() => setClienteEditando(null)}
                  className="px-4 py-2 text-sm font-bold uppercase tracking-wider text-aleman-negro hover:bg-aleman-crema rounded-sm border border-aleman-negro/25 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-bold uppercase tracking-wider text-aleman-hueso bg-aleman-rojo hover:bg-aleman-rojo-dark rounded-sm border border-aleman-negro/40 shadow-sm transition-colors cursor-pointer"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
