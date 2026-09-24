import { useState, useMemo, useRef, useEffect } from 'react';
import { useAuth } from '../context/useAuth';
import apiClient from '../services/apiClient';
import ModalPreviaImpresion from '../components/ModalPreviaImpresion';
import {
  mockProductos,
  mockPromociones,
  mockCategorias,
  formatCurrency,
} from '../services/mockData';

// Estados del semáforo de cocina para ítems enviados
const ESTADOS_COCINA = [
  {
    key: 'pendiente',
    label: 'Pendiente',
    icon: '🕐',
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
    dotClass: 'bg-amber-500',
  },
  {
    key: 'en_preparacion',
    label: 'En preparación',
    icon: '🍳',
    badgeClass: 'bg-blue-100 text-blue-900 border-blue-300',
    dotClass: 'bg-blue-500',
  },
  {
    key: 'listo',
    label: 'Listo',
    icon: '🍽️',
    badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300 animate-pulse',
    dotClass: 'bg-emerald-500',
  },
  {
    key: 'entregado',
    label: 'Entregado',
    icon: '✓',
    badgeClass: 'bg-aleman-crema text-aleman-negro/80 border-aleman-negro/20',
    dotClass: 'bg-aleman-verde',
  },
];

// Helper para agrupar ítems por grupoPromocionId visualmente
function agruparItemsParaRender(itemsList = []) {
  const grupos = [];
  const mapGrupo = new Map();

  itemsList.forEach((item) => {
    if (item.grupoPromocionId) {
      if (!mapGrupo.has(item.grupoPromocionId)) {
        const promoGroup = {
          esPromo: true,
          grupoPromocionId: item.grupoPromocionId,
          promocionNombre: item.promocionNombre || 'Promoción',
          items: [],
        };
        mapGrupo.set(item.grupoPromocionId, promoGroup);
        grupos.push(promoGroup);
      }
      mapGrupo.get(item.grupoPromocionId).items.push(item);
    } else {
      grupos.push({
        esPromo: false,
        item,
      });
    }
  });

  return grupos;
}

// Componente para transición suave de conteo numérico (count-up) y escala en importes
function AnimatedPrice({ value, className = '' }) {
  const [displayValue, setDisplayValue] = useState(value);
  const [isUpdating, setIsUpdating] = useState(false);
  const prevValueRef = useRef(value);

  useEffect(() => {
    if (prevValueRef.current === value) return;
    const startValue = prevValueRef.current;
    const endValue = value;
    prevValueRef.current = value;
    setIsUpdating(true);

    const duration = 300;
    const startTime = performance.now();

    const updateCounter = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Curva suave easeOutCubic
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const currentVal = Math.round(startValue + (endValue - startValue) * easeOut);
      setDisplayValue(currentVal);

      if (progress < 1) {
        requestAnimationFrame(updateCounter);
      } else {
        setDisplayValue(endValue);
        setIsUpdating(false);
      }
    };

    const rafId = requestAnimationFrame(updateCounter);
    return () => cancelAnimationFrame(rafId);
  }, [value]);

  return (
    <span
      className={`inline-block transition-transform duration-200 ${
        isUpdating ? 'scale-105' : 'scale-100'
      } ${className}`}
    >
      {formatCurrency(displayValue)}
    </span>
  );
}

// Coordenadas iniciales predeterminadas para distribución armónica del salón (en %)
const POSICIONES_INICIALES_PREDETERMINADAS = {
  1: { x: 16, y: 26 }, // Ventana
  2: { x: 40, y: 26 }, // Salón Principal
  3: { x: 62, y: 26 }, // Salón Principal
  4: { x: 84, y: 26 }, // Salón Principal
  5: { x: 16, y: 72 }, // Terraza
  6: { x: 40, y: 72 }, // Terraza
  7: { x: 62, y: 72 }, // Salón Principal
  8: { x: 84, y: 72 }, // Sector VIP
};


// Determinar si una mesa ocupada tiene TODOS sus ítems de comanda entregados (lista para cobrar)
const esMesaListaParaCobrar = (mesa) => {
  if (!mesa || mesa.estado !== 'ocupada') return false;
  if (mesa.estadoCalculado) return mesa.estadoCalculado === 'entregado';
  const items = mesa.pedido || [];
  return (
    items.length > 0 &&
    items.every((it) => it.enviadoACocina && it.estadoCocina?.toLowerCase() === 'entregado')
  );
};

export default function PedidosSalon() {
  const { user } = useAuth();
  const esDueno = user?.rol === 'dueno';
  const esEncargado = user?.rol === 'encargado';
  const puedeModificarComanda = esDueno || esEncargado;

  // Estado de las mesas (con posicionX y posicionY)
  const [mesas, setMesas] = useState([]);

  // Objetos y nombres de sectores del backend
  const [sectoresObjList, setSectoresObjList] = useState([]);
  const [sectoresLista, setSectoresLista] = useState([]);

  // Productos y Promociones cargados del backend
  const [productosApi, setProductosApi] = useState([]);
  const [promocionesApi, setPromocionesApi] = useState([]);

  // Pedido activo del backend para la mesa seleccionada
  const [pedidoActivo, setPedidoActivo] = useState(null);

  // Estados del modal de gestión de sectores (solo dueño)
  const [isModalGestionSectoresOpen, setIsModalGestionSectoresOpen] = useState(false);
  const [sectorEnEdicion, setSectorEnEdicion] = useState(null);
  const [nombreSectorEditado, setNombreSectorEditado] = useState('');
  const [sectorParaEliminar, setSectorParaEliminar] = useState(null);
  const [sectorDestinoReasignar, setSectorDestinoReasignar] = useState('');
  const [confirmarEliminarVacio, setConfirmarEliminarVacio] = useState(null);
  const [nombreNuevoSectorDirecto, setNombreNuevoSectorDirecto] = useState('');

  // Modo edición de distribución del plano POS (solo dueño)
  const [modoEdicion, setModoEdicion] = useState(false);
  const [arrastrandoMesaId, setArrastrandoMesaId] = useState(null);
  const canvasRef = useRef(null);

  // Estado del modal de previa de impresión de ticket
  const [modalImpresionData, setModalImpresionData] = useState(null);

  // Historial local de pedidos cerrados
  const [, setPedidosCerrados] = useState([]);

  // Filtro de mesas en el plano
  const [filtroEstadoMesa, setFiltroEstadoMesa] = useState('todas');
  const [filtroSector, setFiltroSector] = useState('todos');

  // Mesa actualmente abierta en el modal de comanda
  const [mesaSeleccionadaId, setMesaSeleccionadaId] = useState(null);
  const [vistaMobileMesa, setVistaMobileMesa] = useState('cargar');

  // Modal de cobro y captura de medio de pago para cierre de mesa
  const [modalCobroMesa, setModalCobroMesa] = useState(null);

  // Modal de alta de mesas por cantidad + sector
  const [isModalCrearMesasOpen, setIsModalCrearMesasOpen] = useState(false);
  const [crearCantidadMesas, setCrearCantidadMesas] = useState(1);
  const [crearSectorMesa, setCrearSectorMesa] = useState('Salón Principal');
  const [crearSectorNuevo, setCrearSectorNuevo] = useState('');
  const [crearCapacidadMesa, setCrearCapacidadMesa] = useState(4);

  // Modal de edición de mesa
  const [mesaAEditar, setMesaAEditar] = useState(null);
  const [editNumeroMesa, setEditNumeroMesa] = useState('');
  const [editSectorMesa, setEditSectorMesa] = useState('Salón Principal');
  const [editSectorNuevo, setEditSectorNuevo] = useState('');
  const [editCapacidadMesa, setEditCapacidadMesa] = useState(4);

  // Estado para agregar ítem dentro del modal de comanda
  const [tipoSeleccionItem, setTipoSeleccionItem] = useState('productos');
  const [categoriaFiltro, setCategoriaFiltro] = useState('todas');
  const [busquedaItem, setBusquedaItem] = useState('');
  const [itemIdSeleccionado, setItemIdSeleccionado] = useState('');
  const [cantidadItem, setCantidadItem] = useState('1');
  const [aclaracionItem, setAclaracionItem] = useState('');

  // Modales de modificación de ítems de comanda
  const [modalEditarItem, setModalEditarItem] = useState(null);
  const [modalEliminarItem, setModalEliminarItem] = useState(null);
  const [, setHistorialModificaciones] = useState([]);

  // Notificación tipo toast / feedback
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Carga inicial de backend (Sectores, Mesas, Productos, Pedidos de Salón Activos)
  const cargarDatosIniciales = async () => {
    try {
      const [resSectores, resMesas, resProductos, resPedidos, resPromos] = await Promise.all([
        apiClient.get('/sectores').catch(() => ({ data: { sectores: [] } })),
        apiClient.get('/mesas').catch(() => ({ data: { mesas: [] } })),
        apiClient.get('/productos').catch(() => ({ data: { productos: [] } })),
        apiClient.get('/pedidos-salon').catch(() => ({ data: { pedidos: [] } })),
        apiClient.get('/promociones').catch(() => ({ data: { promociones: [] } })),
      ]);

      const sectoresBackend = resSectores.data?.sectores || [];
      setSectoresObjList(sectoresBackend);
      setSectoresLista(sectoresBackend.map((s) => s.nombre));

      const promocionesBackend = resPromos.data?.promociones || [];
      setPromocionesApi(promocionesBackend);

      const productosBackend = resProductos.data?.productos || [];
      if (productosBackend.length > 0) {
        setProductosApi(productosBackend);
        if (!itemIdSeleccionado) {
          setItemIdSeleccionado(productosBackend[0]._id || productosBackend[0].id);
        }
      } else if (mockProductos.length > 0 && !itemIdSeleccionado) {
        setItemIdSeleccionado(mockProductos[0].id);
      }

      const pedidosActivos = resPedidos.data?.pedidos || [];
      const mesasBackend = resMesas.data?.mesas || [];

      const mesasFormateadas = mesasBackend.map((m, idx) => {
        const sectorNombre =
          typeof m.sectorId === 'object'
            ? m.sectorId?.nombre
            : m.sectorId || m.sector || 'Salón Principal';
        const sectorIdVal =
          typeof m.sectorId === 'object' ? m.sectorId?._id : m.sectorId;

        const tienePosicionValida =
          typeof m.posicionX === 'number' &&
          typeof m.posicionY === 'number' &&
          m.posicionX >= 5 &&
          m.posicionX <= 90 &&
          m.posicionY >= 5 &&
          m.posicionY <= 90;

        const defaultPos = POSICIONES_INICIALES_PREDETERMINADAS[m.numero] || {
          x: Math.min(84, 14 + (idx % 5) * 17),
          y: Math.min(80, 18 + Math.floor(idx / 5) * 18),
        };

        const pedidoAsociado = pedidosActivos.find((p) => {
          const idMesaPedido = typeof p.mesaId === 'object' ? p.mesaId?._id : p.mesaId;
          return String(idMesaPedido) === String(m._id);
        });

        const itemsMapeados = pedidoAsociado
          ? (pedidoAsociado.items || [])
              .filter((it) => !it.eliminado)
              .map((it) => ({
                id: it._id,
                _id: it._id,
                productoId: typeof it.productoId === 'object' ? it.productoId?._id : it.productoId,
                nombre: it.nombreProducto || (typeof it.productoId === 'object' ? it.productoId?.nombre : 'Producto'),
                precioUnitario: it.precioUnitario,
                cantidad: it.cantidad,
                aclaracion: it.aclaraciones || '',
                enviadoACocina: Boolean(it.enviadoComanda),
                estadoCocina: it.estado || 'pendiente',
                grupoPromocionId: it.grupoPromocionId || null,
                promocionNombre: it.promocionNombre || null,
              }))
          : [];

        return {
          _id: m._id,
          id: m._id,
          numero: m.numero,
          sector: sectorNombre,
          sectorId: sectorIdVal,
          capacidad: m.capacidad || 4,
          estado: m.estado || 'libre',
          posicionX: tienePosicionValida ? m.posicionX : defaultPos.x,
          posicionY: tienePosicionValida ? m.posicionY : defaultPos.y,
          pedido: itemsMapeados,
          estadoCalculado: pedidoAsociado ? pedidoAsociado.estado : 'pendiente',
          fechaApertura: m.createdAt || null,
        };
      });

      setMesas(mesasFormateadas);
    } catch {
      showToast('Error al cargar datos del salón desde el servidor');
    }
  };

  useEffect(() => {
    cargarDatosIniciales();
  }, []);

  // Handlers para arrastrar y posicionar libremente mesas en modo edición
  const handlePointerDownMesa = (e, mesa) => {
    if (!modoEdicion || !esDueno) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignorar si no soporta pointer capture
    }
    setArrastrandoMesaId(mesa.id);
  };

  const handlePointerUpMesa = async (e) => {
    if (arrastrandoMesaId) {
      try {
        if (e.currentTarget?.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Ignorar
      }

      const mesaMovida = mesas.find((m) => m.id === arrastrandoMesaId);
      if (mesaMovida && (mesaMovida._id || mesaMovida.id)) {
        try {
          await apiClient.patch(`/mesas/${mesaMovida._id || mesaMovida.id}/posicion`, {
            posicionX: mesaMovida.posicionX,
            posicionY: mesaMovida.posicionY,
          });
        } catch {
          // Ignorar error transitorio
        }
      }
      setArrastrandoMesaId(null);
    }
  };

  const handleCanvasPointerMove = (e) => {
    if (!modoEdicion || !arrastrandoMesaId || !canvasRef.current) return;
    e.preventDefault();
    const rect = canvasRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const rawX = ((e.clientX - rect.left) / rect.width) * 100;
    const rawY = ((e.clientY - rect.top) / rect.height) * 100;

    const posX = Math.max(6, Math.min(94, Math.round(rawX * 10) / 10));
    const posY = Math.max(7, Math.min(93, Math.round(rawY * 10) / 10));

    setMesas((prev) =>
      prev.map((m) =>
        m.id === arrastrandoMesaId
          ? {
              ...m,
              posicionX: posX,
              posicionY: posY,
            }
          : m
      )
    );
  };

  // Reacomodar automáticamente todas las mesas en el canvas en una grilla armónica
  const handleReacomodarMesas = async () => {
    if (!esDueno || mesas.length === 0) return;

    const COLS = 5;
    const mesasReacomodadas = mesas.map((m, idx) => {
      const col = idx % COLS;
      const row = Math.floor(idx / COLS);
      const posX = Math.min(84, 14 + col * 17);
      const posY = Math.min(80, 18 + row * 18);
      return {
        ...m,
        posicionX: posX,
        posicionY: posY,
      };
    });

    setMesas(mesasReacomodadas);

    try {
      await Promise.all(
        mesasReacomodadas.map((m) =>
          apiClient.patch(`/mesas/${m._id || m.id}/posicion`, {
            posicionX: m.posicionX,
            posicionY: m.posicionY,
          })
        )
      );
      showToast('🧹 Mesas reacomodadas y guardadas correctamente');
    } catch {
      showToast('Error al guardar el reacomodamiento en el servidor');
    }
  };

  const handleCanvasPointerUp = async () => {
    if (arrastrandoMesaId) {
      const mesaMovida = mesas.find((m) => m.id === arrastrandoMesaId);
      if (mesaMovida && (mesaMovida._id || mesaMovida.id)) {
        try {
          await apiClient.patch(`/mesas/${mesaMovida._id || mesaMovida.id}/posicion`, {
            posicionX: mesaMovida.posicionX,
            posicionY: mesaMovida.posicionY,
          });
        } catch {
          // Ignorar
        }
      }
      setArrastrandoMesaId(null);
    }
  };

  // Mesa seleccionada actual
  const mesaActual = useMemo(() => {
    return mesas.find((m) => m.id === mesaSeleccionadaId) || null;
  }, [mesas, mesaSeleccionadaId]);

  // Lista de sectores únicos para filtro y formularios
  const sectores = useMemo(() => {
    const set = new Set([
      ...sectoresLista,
      ...mesas.map((m) => m.sector).filter(Boolean),
    ]);
    return Array.from(set);
  }, [sectoresLista, mesas]);

  // =========================================================
  // GESTIÓN DE MESAS (PLAN DEL SALÓN)
  // =========================================================

  // Abrir mesa (hacer click en mesa libre u ocupada)
  const handleAbrirMesaDetalle = async (mesa) => {
    const mesaId = mesa._id || mesa.id;
    setMesaSeleccionadaId(mesa.id);
    setVistaMobileMesa('cargar');
    setAclaracionItem('');
    setCantidadItem(1);

    try {
      if (mesa.estado === 'libre') {
        const res = await apiClient.post('/pedidos-salon', { mesaId });
        const pedidoNuevo = res.data?.pedido;
        setPedidoActivo(pedidoNuevo);

        setMesas((prev) =>
          prev.map((m) =>
            m.id === mesa.id
              ? {
                  ...m,
                  estado: 'ocupada',
                  fechaApertura: new Date().toISOString(),
                  pedido: [],
                }
              : m
          )
        );
      } else {
        const res = await apiClient.get(`/pedidos-salon/mesa/${mesaId}`);
        const pedidoActual = res.data?.pedido;
        setPedidoActivo(pedidoActual);

        if (pedidoActual) {
          const itemsMapeados = (pedidoActual.items || [])
            .filter((it) => !it.eliminado)
            .map((it) => ({
              id: it._id,
              _id: it._id,
              productoId:
                typeof it.productoId === 'object'
                  ? it.productoId?._id
                  : it.productoId,
              nombre:
                it.nombreProducto ||
                (typeof it.productoId === 'object'
                  ? it.productoId?.nombre
                  : 'Producto'),
              precioUnitario: it.precioUnitario,
              cantidad: it.cantidad,
              aclaracion: it.aclaraciones || '',
              enviadoACocina: Boolean(it.enviadoComanda),
              estadoCocina: it.estado || 'pendiente',
            }));

          setMesas((prev) =>
            prev.map((m) =>
              m.id === mesa.id
                ? { ...m, pedido: itemsMapeados, estadoCalculado: pedidoActual.estado }
                : m
            )
          );
        }
      }
    } catch (err) {
      showToast(err.response?.data?.mensaje || 'Error al abrir o consultar mesa');
    }
  };

  // Abrir modal de alta de mesas por cantidad y sector (rol dueño)
  const handleOpenCrearMesasModal = () => {
    if (!esDueno) return;
    setCrearCantidadMesas(1);
    setCrearSectorMesa(sectores[0] || 'Salón Principal');
    setCrearSectorNuevo('');
    setCrearCapacidadMesa(4);
    setIsModalCrearMesasOpen(true);
  };

  // Confirmar creación masiva de mesas
  const handleConfirmarCrearMesas = async (e) => {
    e.preventDefault();
    if (!esDueno) return;

    let sectorIdEncontrado = null;
    if (crearSectorMesa === '__nuevo__') {
      const nombreLimpio = crearSectorNuevo.trim();
      if (!nombreLimpio) {
        alert('Por favor ingresá o seleccioná un sector para las mesas.');
        return;
      }
      try {
        const resSec = await apiClient.post('/sectores', { nombre: nombreLimpio });
        sectorIdEncontrado = resSec.data?.sector?._id;
      } catch (err) {
        alert(err.response?.data?.mensaje || 'Error al crear el nuevo sector');
        return;
      }
    } else {
      const secObj = sectoresObjList.find((s) => s.nombre === crearSectorMesa);
      sectorIdEncontrado = secObj?._id;
    }

    if (!sectorIdEncontrado) {
      alert('Por favor seleccioná un sector válido para las mesas.');
      return;
    }

    const cantidad = Math.max(1, Number(crearCantidadMesas) || 1);

    try {
      await apiClient.post('/mesas/lote', {
        cantidad,
        sectorId: sectorIdEncontrado,
      });
      setIsModalCrearMesasOpen(false);
      showToast(`Se crearon ${cantidad} mesas en el sector`);
      cargarDatosIniciales();
    } catch (err) {
      alert(err.response?.data?.mensaje || 'Error al crear mesas en lote');
    }
  };

  // Abrir modal de edición de mesa (solo dueño y solo si libre)
  const handleOpenEditarMesa = (mesa) => {
    if (!esDueno || mesa.estado !== 'libre') return;
    setMesaAEditar(mesa);
    setEditNumeroMesa(mesa.numero);
    setEditSectorMesa(mesa.sector || 'Salón Principal');
    setEditSectorNuevo('');
    setEditCapacidadMesa(mesa.capacidad || 4);
  };

  // Confirmar edición de mesa existente
  const handleConfirmarEditarMesa = async (e) => {
    e.preventDefault();
    if (!mesaAEditar || !esDueno) return;

    const nuevoNum = Number(editNumeroMesa);
    if (!nuevoNum || nuevoNum <= 0) {
      alert('Por favor ingresá un número de mesa válido mayor a 0.');
      return;
    }

    let sectorIdEncontrado = null;
    if (editSectorMesa === '__nuevo__') {
      const nombreLimpio = editSectorNuevo.trim();
      if (!nombreLimpio) {
        alert('Por favor ingresá o seleccioná un sector para la mesa.');
        return;
      }
      try {
        const resSec = await apiClient.post('/sectores', { nombre: nombreLimpio });
        sectorIdEncontrado = resSec.data?.sector?._id;
      } catch (err) {
        alert(err.response?.data?.mensaje || 'Error al crear sector');
        return;
      }
    } else {
      const secObj = sectoresObjList.find((s) => s.nombre === editSectorMesa);
      sectorIdEncontrado = secObj?._id || mesaAEditar.sectorId;
    }

    try {
      const mesaId = mesaAEditar._id || mesaAEditar.id;
      await apiClient.put(`/mesas/${mesaId}`, {
        numero: nuevoNum,
        sectorId: sectorIdEncontrado,
      });

      setMesaAEditar(null);
      showToast(`Mesa #${nuevoNum} actualizada con éxito`);
      cargarDatosIniciales();
    } catch (err) {
      alert(err.response?.data?.mensaje || 'Error al editar la mesa');
    }
  };

  // Eliminar mesa (solo 'dueño' y solo si está 'libre')
  const handleEliminarMesa = async (e, mesa) => {
    e.stopPropagation();
    if (!esDueno) return;

    if (mesa.estado !== 'libre') {
      alert(`No se puede eliminar la Mesa ${mesa.numero} porque está Ocupada.`);
      return;
    }

    if (
      window.confirm(
        `¿Seguro que deseas eliminar la Mesa ${mesa.numero}? Esta acción no se puede deshacer.`
      )
    ) {
      try {
        const mesaId = mesa._id || mesa.id;
        await apiClient.delete(`/mesas/${mesaId}`);
        if (mesaSeleccionadaId === mesa.id) {
          setMesaSeleccionadaId(null);
        }
        showToast(`Mesa ${mesa.numero} eliminada del salón`);
        cargarDatosIniciales();
      } catch (err) {
        alert(err.response?.data?.mensaje || `Error al eliminar la Mesa ${mesa.numero}`);
      }
    }
  };

  // =========================================================
  // GESTIÓN DE SECTORES (ROL DUEÑO)
  // =========================================================

  // Abrir modal de gestión de sectores
  const handleOpenGestionSectoresModal = () => {
    if (!esDueno) return;
    setSectorEnEdicion(null);
    setNombreSectorEditado('');
    setSectorParaEliminar(null);
    setSectorDestinoReasignar('');
    setConfirmarEliminarVacio(null);
    setNombreNuevoSectorDirecto('');
    setIsModalGestionSectoresOpen(true);
  };

  // Iniciar renombrado de un sector
  const handleIniciarRenombrarSector = (sector) => {
    setSectorParaEliminar(null);
    setConfirmarEliminarVacio(null);
    setSectorEnEdicion(sector);
    setNombreSectorEditado(sector);
  };

  // Cancelar renombrado
  const handleCancelarRenombrarSector = () => {
    setSectorEnEdicion(null);
    setNombreSectorEditado('');
  };

  // Confirmar renombrado de sector
  const handleConfirmarRenombrarSector = async (nombreViejo) => {
    const nombreLimpio = nombreSectorEditado.trim();
    if (!nombreLimpio || nombreLimpio.toLowerCase() === nombreViejo.toLowerCase()) {
      setSectorEnEdicion(null);
      return;
    }

    const secObj = sectoresObjList.find((s) => s.nombre === nombreViejo);
    if (!secObj) {
      setSectorEnEdicion(null);
      return;
    }

    try {
      await apiClient.put(`/sectores/${secObj._id}`, { nombre: nombreLimpio });
      setSectorEnEdicion(null);
      setNombreSectorEditado('');
      showToast(`Sector "${nombreViejo}" renombrado a "${nombreLimpio}"`);
      cargarDatosIniciales();
    } catch (err) {
      alert(err.response?.data?.mensaje || 'Error al renombrar el sector');
    }
  };

  // Iniciar eliminación de sector
  const handleIniciarEliminarSector = (sector) => {
    setSectorEnEdicion(null);
    setConfirmarEliminarVacio(null);

    const mesasEnSector = mesas.filter((m) => m.sector === sector);

    if (mesasEnSector.length > 0) {
      setSectorParaEliminar(sector);
      const otrosSectores = sectores.filter((s) => s !== sector);
      setSectorDestinoReasignar(otrosSectores[0] || '');
    } else {
      setConfirmarEliminarVacio(sector);
    }
  };

  // Confirmar eliminación de sector vacío (0 mesas)
  const handleConfirmarEliminarVacio = async (sector) => {
    const secObj = sectoresObjList.find((s) => s.nombre === sector);
    if (!secObj) return;

    try {
      await apiClient.delete(`/sectores/${secObj._id}`);
      setConfirmarEliminarVacio(null);
      showToast(`Sector "${sector}" eliminado con éxito`);
      cargarDatosIniciales();
    } catch (err) {
      alert(err.response?.data?.mensaje || `Error al eliminar el sector '${sector}'`);
    }
  };

  // Reasignar mesas de un sector a otro sector destino
  const handleSoloReasignarMesas = async (sectorOrigen, sectorDestino) => {
    if (!sectorDestino || sectorDestino === sectorOrigen) {
      alert('Por favor seleccioná un sector de destino válido.');
      return;
    }

    const secDestinoObj = sectoresObjList.find((s) => s.nombre === sectorDestino);
    if (!secDestinoObj) return;

    const mesasAMover = mesas.filter((m) => m.sector === sectorOrigen);
    try {
      await Promise.all(
        mesasAMover.map((m) =>
          apiClient.put(`/mesas/${m._id || m.id}`, { sectorId: secDestinoObj._id })
        )
      );
      setSectorParaEliminar(null);
      showToast(`Se reasignaron ${mesasAMover.length} mesa(s) a "${sectorDestino}".`);
      cargarDatosIniciales();
    } catch (err) {
      alert(err.response?.data?.mensaje || 'Error al reasignar mesas');
    }
  };

  // Reasignar mesas de un sector a otro sector destino Y eliminar el sector origen
  const handleReasignarYEliminarSector = async (sectorOrigen, sectorDestino) => {
    if (!sectorDestino || sectorDestino === sectorOrigen) {
      alert('Por favor seleccioná un sector de destino válido.');
      return;
    }

    const secOrigenObj = sectoresObjList.find((s) => s.nombre === sectorOrigen);
    const secDestinoObj = sectoresObjList.find((s) => s.nombre === sectorDestino);

    if (!secOrigenObj || !secDestinoObj) return;

    const mesasAMover = mesas.filter((m) => m.sector === sectorOrigen);

    try {
      await Promise.all(
        mesasAMover.map((m) =>
          apiClient.put(`/mesas/${m._id || m.id}`, { sectorId: secDestinoObj._id })
        )
      );
      await apiClient.delete(`/sectores/${secOrigenObj._id}`);

      setSectorParaEliminar(null);
      showToast(`Se reasignaron ${mesasAMover.length} mesa(s) a "${sectorDestino}" y se eliminó "${sectorOrigen}"`);
      cargarDatosIniciales();
    } catch (err) {
      alert(err.response?.data?.mensaje || 'Error al reasignar mesas y eliminar sector');
    }
  };

  // Crear nuevo sector directamente desde el modal de gestión
  const handleCrearSectorDirecto = async (e) => {
    e.preventDefault();
    const nombreLimpio = nombreNuevoSectorDirecto.trim();
    if (!nombreLimpio) return;

    try {
      await apiClient.post('/sectores', { nombre: nombreLimpio });
      setNombreNuevoSectorDirecto('');
      showToast(`Nuevo sector "${nombreLimpio}" creado`);
      cargarDatosIniciales();
    } catch (err) {
      alert(err.response?.data?.mensaje || 'Error al crear el sector');
    }
  };

  // =========================================================
  // CARGA DE ITEMS A LA COMANDA
  // =========================================================

  // Agregar ítem al pedido
  const handleAgregarItemComanda = async (e) => {
    e.preventDefault();
    if (!mesaActual) return;

    let pedidoActualId = pedidoActivo?._id;
    if (!pedidoActualId) {
      try {
        const resOpen = await apiClient.post('/pedidos-salon', {
          mesaId: mesaActual._id || mesaActual.id,
        });
        pedidoActualId = resOpen.data?.pedido?._id;
        setPedidoActivo(resOpen.data?.pedido);
      } catch (err) {
        showToast(err.response?.data?.mensaje || 'Error al abrir pedido de la mesa');
        return;
      }
    }

    const prodEncontrado =
      productosApi.find((p) => (p._id || p.id) === itemIdSeleccionado) ||
      mockProductos.find((p) => p.id === itemIdSeleccionado);

    if (!prodEncontrado) {
      alert('Por favor seleccioná un producto o promoción válido.');
      return;
    }

    const prodId = prodEncontrado._id || prodEncontrado.id;
    const cantNum = Math.min(99, Math.max(1, parseInt(cantidadItem, 10) || 1));

    try {
      const res = await apiClient.post(`/pedidos-salon/${pedidoActualId}/items`, {
        items: [
          {
            productoId: prodId,
            cantidad: cantNum,
            aclaraciones: aclaracionItem.trim(),
          },
        ],
      });

      const pedidoActualizado = res.data?.pedido;
      setPedidoActivo(pedidoActualizado);

      const itemsMapeados = (pedidoActualizado.items || [])
        .filter((it) => !it.eliminado)
        .map((it) => ({
          id: it._id,
          _id: it._id,
          productoId: typeof it.productoId === 'object' ? it.productoId?._id : it.productoId,
          nombre: it.nombreProducto || (typeof it.productoId === 'object' ? it.productoId?.nombre : 'Producto'),
          precioUnitario: it.precioUnitario,
          cantidad: it.cantidad,
          aclaracion: it.aclaraciones || '',
          enviadoACocina: Boolean(it.enviadoComanda),
          estadoCocina: it.estado || 'pendiente',
        }));

      setMesas((prev) =>
        prev.map((m) => (m.id === mesaActual.id ? { ...m, pedido: itemsMapeados, estadoCalculado: pedidoActualizado.estado } : m))
      );

      setAclaracionItem('');
      setCantidadItem('1');
      showToast(`+${cantNum} ${prodEncontrado.nombre} agregado al pedido`);
    } catch (err) {
      showToast(err.response?.data?.mensaje || 'Error al agregar ítem al pedido');
    }
  };

  // Quitar ítem que aún no fue enviado a cocina (local si no se sincronizó)
  const handleQuitarItemNoEnviado = (itemId) => {
    if (!mesaActual) return;
    setMesas((prev) =>
      prev.map((m) =>
        m.id === mesaActual.id
          ? {
              ...m,
              pedido: m.pedido.filter((it) => it.id !== itemId),
            }
          : m
      )
    );
  };

  // =========================================================
  // EDICIÓN Y ELIMINACIÓN DE ÍTEMS DE COMANDA (DUEÑO Y ENCARGADO)
  // =========================================================

  const handleAbrirModalEditar = (item) => {
    setModalEditarItem({
      item,
      nuevaCantidad: (item.cantidad || 1).toString(),
      nuevaAclaracion: item.aclaracion || '',
      motivo: '',
      errorMotivo: '',
      errorCantidad: '',
    });
  };

  const handleAbrirModalEliminar = (item) => {
    setModalEliminarItem({
      item,
      motivo: '',
      errorMotivo: '',
    });
  };

  const handleConfirmarEdicionItem = async (e) => {
    e?.preventDefault();
    if (!modalEditarItem || !mesaActual || !pedidoActivo) return;

    const { item, nuevaCantidad, nuevaAclaracion, motivo } = modalEditarItem;
    const cantNum = parseInt(nuevaCantidad, 10);

    if (isNaN(cantNum) || cantNum <= 0) {
      setModalEditarItem((prev) => ({
        ...prev,
        errorCantidad: 'La cantidad debe ser mayor a 0.',
      }));
      return;
    }

    if (esEncargado && (!motivo || !motivo.trim())) {
      setModalEditarItem((prev) => ({
        ...prev,
        errorMotivo: 'El motivo es obligatorio para el rol encargado.',
      }));
      return;
    }

    try {
      const itemId = item._id || item.id;
      const res = await apiClient.put(
        `/pedidos-salon/${pedidoActivo._id}/items/${itemId}`,
        {
          cantidad: cantNum,
          aclaraciones: nuevaAclaracion.trim(),
          motivo: motivo?.trim(),
        }
      );

      const pedidoActualizado = res.data?.pedido;
      setPedidoActivo(pedidoActualizado);

      const itemsMapeados = (pedidoActualizado.items || [])
        .filter((it) => !it.eliminado)
        .map((it) => ({
          id: it._id,
          _id: it._id,
          productoId: typeof it.productoId === 'object' ? it.productoId?._id : it.productoId,
          nombre: it.nombreProducto || (typeof it.productoId === 'object' ? it.productoId?.nombre : 'Producto'),
          precioUnitario: it.precioUnitario,
          cantidad: it.cantidad,
          aclaracion: it.aclaraciones || '',
          enviadoACocina: Boolean(it.enviadoComanda),
          estadoCocina: it.estado || 'pendiente',
        }));

      setMesas((prev) =>
        prev.map((m) => (m.id === mesaActual.id ? { ...m, pedido: itemsMapeados, estadoCalculado: pedidoActualizado.estado } : m))
      );

      setModalEditarItem(null);
      showToast(`✏️ Ítem "${item.nombre}" actualizado.`);
    } catch (err) {
      const mensajeError = err.response?.data?.mensaje || 'Error al editar ítem';
      setModalEditarItem((prev) => ({ ...prev, errorMotivo: mensajeError }));
      showToast(mensajeError);
    }
  };

  const handleConfirmarEliminacionItem = async (e) => {
    e?.preventDefault();
    if (!modalEliminarItem || !mesaActual || !pedidoActivo) return;

    const { item, motivo } = modalEliminarItem;

    if (esEncargado && (!motivo || !motivo.trim())) {
      setModalEliminarItem((prev) => ({
        ...prev,
        errorMotivo: 'El motivo es obligatorio para el rol encargado.',
      }));
      return;
    }

    try {
      const itemId = item._id || item.id;
      const res = await apiClient.delete(
        `/pedidos-salon/${pedidoActivo._id}/items/${itemId}`,
        {
          data: { motivo: motivo?.trim() },
        }
      );

      const pedidoActualizado = res.data?.pedido;
      setPedidoActivo(pedidoActualizado);

      const itemsMapeados = (pedidoActualizado.items || [])
        .filter((it) => !it.eliminado)
        .map((it) => ({
          id: it._id,
          _id: it._id,
          productoId: typeof it.productoId === 'object' ? it.productoId?._id : it.productoId,
          nombre: it.nombreProducto || (typeof it.productoId === 'object' ? it.productoId?.nombre : 'Producto'),
          precioUnitario: it.precioUnitario,
          cantidad: it.cantidad,
          aclaracion: it.aclaraciones || '',
          enviadoACocina: Boolean(it.enviadoComanda),
          estadoCocina: it.estado || 'pendiente',
        }));

      setMesas((prev) =>
        prev.map((m) => (m.id === mesaActual.id ? { ...m, pedido: itemsMapeados, estadoCalculado: pedidoActualizado.estado } : m))
      );

      setModalEliminarItem(null);
      showToast(`🗑️ Ítem "${item.nombre}" eliminado.`);
    } catch (err) {
      const mensajeError = err.response?.data?.mensaje || 'Error al eliminar ítem';
      setModalEliminarItem((prev) => ({ ...prev, errorMotivo: mensajeError }));
      showToast(mensajeError);
    }
  };

  // =========================================================
  // ENVÍO DE COMANDA INCREMENTAL
  // =========================================================

  const handleEnviarComandaCocina = async () => {
    if (!mesaActual || !pedidoActivo) return;

    const itemsPorEnviar = (mesaActual.pedido || []).filter((it) => !it.enviadoACocina);
    if (itemsPorEnviar.length === 0) {
      alert('No hay nuevos ítems pendientes de envío en esta mesa.');
      return;
    }

    try {
      const res = await apiClient.post(`/pedidos-salon/${pedidoActivo._id}/comanda`);
      const { itemsEnviados, itemsParaCocina, pedido: pedidoRes } = res.data;

      showToast(
        `👨‍🍳 Comanda enviada a cocina (${itemsEnviados?.length || itemsPorEnviar.length} ítems en total)`
      );

      const pedidoActual = pedidoRes || (await apiClient.get(`/pedidos-salon/mesa/${mesaActual._id || mesaActual.id}`)).data?.pedido;
      if (pedidoActual) {
        setPedidoActivo(pedidoActual);
        const itemsMapeados = (pedidoActual.items || [])
          .filter((it) => !it.eliminado)
          .map((it) => ({
            id: it._id,
            _id: it._id,
            productoId: typeof it.productoId === 'object' ? it.productoId?._id : it.productoId,
            nombre: it.nombreProducto || (typeof it.productoId === 'object' ? it.productoId?.nombre : 'Producto'),
            precioUnitario: it.precioUnitario,
            cantidad: it.cantidad,
            aclaracion: it.aclaraciones || '',
            enviadoACocina: Boolean(it.enviadoComanda),
            estadoCocina: it.estado || 'pendiente',
          }));

        setMesas((prev) =>
          prev.map((m) => (m.id === mesaActual.id ? { ...m, pedido: itemsMapeados, estadoCalculado: pedidoActual.estado } : m))
        );
      }

      // Si hay ítems para cocina (comida), abrir ticket de previa comanda de cocina
      if (itemsParaCocina && itemsParaCocina.length > 0) {
        handleImprimirComanda('cocina', itemsParaCocina);
      }
    } catch (err) {
      showToast(err.response?.data?.mensaje || 'Error al enviar comanda a cocina');
    }
  };

  // Avanzar estado de cocina de un ítem enviado
  const handleCambiarEstadoCocinaItem = async (itemId, nuevoEstado) => {
    if (!mesaActual || !pedidoActivo) return;
    try {
      const res = await apiClient.patch(
        `/pedidos-salon/${pedidoActivo._id}/items/${itemId}/estado`,
        {
          estado: nuevoEstado,
        }
      );
      const pedidoActualizado = res.data?.pedido;
      if (pedidoActualizado) {
        setPedidoActivo(pedidoActualizado);
        const itemsMapeados = (pedidoActualizado.items || [])
          .filter((it) => !it.eliminado)
          .map((it) => ({
            id: it._id,
            _id: it._id,
            productoId: typeof it.productoId === 'object' ? it.productoId?._id : it.productoId,
            nombre: it.nombreProducto || (typeof it.productoId === 'object' ? it.productoId?.nombre : 'Producto'),
            precioUnitario: it.precioUnitario,
            cantidad: it.cantidad,
            aclaracion: it.aclaraciones || '',
            enviadoACocina: Boolean(it.enviadoComanda),
            estadoCocina: it.estado || 'pendiente',
          }));

        setMesas((prev) =>
          prev.map((m) =>
            m.id === mesaActual.id
              ? {
                  ...m,
                  pedido: itemsMapeados,
                  estadoCalculado: pedidoActualizado.estado,
                }
              : m
          )
        );
      }
      showToast(`Estado del ítem actualizado a "${nuevoEstado}"`);
    } catch (err) {
      showToast(err.response?.data?.mensaje || 'Error al actualizar estado del semáforo');
    }
  };

  // =========================================================
  // CERRAR MESA Y COBRAR
  // =========================================================

  const handleCerrarMesa = () => {
    if (!mesaActual) return;

    const itemsTotales = mesaActual.pedido || [];
    const itemsSinEnviar = itemsTotales.filter((it) => !it.enviadoACocina);
    const itemsNoEntregados = itemsTotales.filter(
      (it) => it.enviadoACocina && it.estadoCocina !== 'entregado'
    );

    if (itemsSinEnviar.length > 0) {
      alert(
        'No podés cerrar la mesa porque hay ítems en el carrito sin enviar a cocina. Envialos o quitalos primero.'
      );
      return;
    }

    if (itemsNoEntregados.length > 0) {
      alert(
        'Todos los ítems enviados a cocina deben estar en estado "Entregado" antes de poder cerrar la mesa.'
      );
      return;
    }

    const totalCobrado = itemsTotales.reduce(
      (sum, it) => sum + (Number(it.precioUnitario) || 0) * (Number(it.cantidad) || 1),
      0
    );

    setModalCobroMesa({
      mesa: mesaActual,
      total: totalCobrado,
      medioPago: 'efectivo',
    });
  };

  const handleConfirmarCobroYCierreMesa = async (e) => {
    e?.preventDefault();
    if (!modalCobroMesa || !pedidoActivo) return;

    const { mesa, total, medioPago } = modalCobroMesa;
    const numMesa = mesa.numero;
    const itemsCierre = (mesa.pedido || []).map((it) => ({
      nombre: it.nombre,
      cantidad: it.cantidad,
      precioUnitario: it.precioUnitario ?? it.precio,
      aclaracion: it.aclaracion,
    }));

    let medioPagoBackend = 'efectivo';
    if (medioPago === 'tarjeta' || medioPago === 'debito_credito') {
      medioPagoBackend = 'debito_credito';
    } else if (medioPago === 'transferencia') {
      medioPagoBackend = 'transferencia';
    }

    let res;
    // 1. Petición principal al backend para cerrar y cobrar
    try {
      res = await apiClient.post(`/pedidos-salon/${pedidoActivo._id}/cerrar`, {
        medioPago: medioPagoBackend,
      });
    } catch (err) {
      if (err.response?.status === 409) {
        showToast('⚠️ No hay un turno de caja abierto');
        alert('⚠️ No hay un turno de caja abierto.\n\nPor favor, ingresá al módulo de Caja y abrí un turno antes de cobrar el pedido.');
      } else {
        showToast(err.response?.data?.mensaje || 'Error al cerrar y cobrar la mesa');
      }
      return;
    }

    // 2. Notificación de éxito inmediata al recibir respuesta 2xx del backend
    const montoTotalConfirmado = res.data?.montoTotal ?? total ?? 0;
    const medioPagoConfirmado = res.data?.medioPago || medioPago;

    showToast(`💰 Mesa ${numMesa} cobrada con ${medioPagoConfirmado} ($${montoTotalConfirmado}) y liberada con éxito`);

    // 3. Pasos secundarios (actualización de UI, vista previa e impresión) en try/catch independiente
    try {
      setModalCobroMesa(null);
      setMesaSeleccionadaId(null);
      setPedidoActivo(null);

      setMesas((prev) =>
        prev.map((m) =>
          m.id === mesa.id
            ? {
                ...m,
                estado: 'libre',
                pedido: [],
              }
            : m
        )
      );

      // Abrir vista previa de impresión de ticket cliente para la caja/mozo
      setModalImpresionData({
        canal: 'salon',
        mesaNumero: numMesa,
        mozo: user?.nombre || 'Mozo Salón',
        items: itemsCierre,
        total: montoTotalConfirmado,
        medioPago: medioPagoConfirmado,
        vistaInicial: 'cliente',
      });

      await cargarDatosIniciales();
    } catch (secErr) {
      console.error('Cobro registrado en backend, pero ocurrió un error al actualizar la vista:', secErr);
      showToast('Cobro registrado, no se pudo actualizar la vista');
    }
  };

  // Simulación de impresión de comanda (Modal Previa Impresión)
  const handleImprimirComanda = (vistaInicial = 'cocina') => {
    if (!mesaActual) return;
    const itemsEnviados = (mesaActual.pedido || []).filter((it) => it.enviadoACocina);
    const itemsAMostrar = itemsEnviados.length > 0 ? itemsEnviados : mesaActual.pedido || [];
    const total = itemsAMostrar.reduce(
      (acc, it) => acc + Number(it.precioUnitario ?? it.precio ?? 0) * (Number(it.cantidad) || 1),
      0
    );
    setModalImpresionData({
      canal: 'salon',
      mesaNumero: mesaActual.numero,
      mozo: user?.nombre || 'Mozo Salón',
      items: itemsAMostrar,
      total,
      medioPago: 'Pendiente',
      vistaInicial,
    });
  };

  // =========================================================
  // CÁLCULOS Y TOTALES DE MESA
  // =========================================================

  const calcularTotalMesa = (mesa) => {
    if (!mesa || !Array.isArray(mesa.pedido)) return 0;
    return mesa.pedido.reduce((acc, it) => {
      const precio = Number(it.precioUnitario ?? it.precio ?? it.precioCombo ?? 0);
      const cant = Number(it.cantidad) || 1;
      return acc + precio * cant;
    }, 0);
  };

  const totalMesaActual = useMemo(() => {
    return calcularTotalMesa(mesaActual);
  }, [mesaActual]);

  const resumenCocinaMesa = useMemo(() => {
    if (!mesaActual)
      return {
        sinEnviar: 0,
        pendientes: 0,
        enPrep: 0,
        listos: 0,
        entregados: 0,
        totalItems: 0,
        puedeCerrar: false,
      };

    const sinEnviar = (mesaActual.pedido || []).filter((it) => !it.enviadoACocina).length;
    const pendientes = (mesaActual.pedido || []).filter(
      (it) => it.enviadoACocina && it.estadoCocina === 'pendiente'
    ).length;
    const enPrep = (mesaActual.pedido || []).filter(
      (it) => it.enviadoACocina && it.estadoCocina === 'en_preparacion'
    ).length;
    const listos = (mesaActual.pedido || []).filter(
      (it) => it.enviadoACocina && it.estadoCocina === 'listo'
    ).length;
    const entregados = (mesaActual.pedido || []).filter(
      (it) => it.enviadoACocina && it.estadoCocina === 'entregado'
    ).length;

    return {
      sinEnviar,
      pendientes,
      enPrep,
      listos,
      entregados,
      totalItems: mesaActual.pedido.length,
      puedeCerrar:
        mesaActual.pedido.length > 0 &&
        sinEnviar === 0 &&
        pendientes === 0 &&
        enPrep === 0 &&
        listos === 0,
    };
  }, [mesaActual]);

  // Lista de productos filtrados para el selector
  const itemsDisponibles = useMemo(() => {
    const listaProductosBase = productosApi.length > 0 ? productosApi : mockProductos;
    if (tipoSeleccionItem === 'productos') {
      return listaProductosBase
        .map((p) => ({
          ...p,
          id: p._id || p.id,
          precioVenta: p.precioVenta ?? p.precio ?? 0,
        }))
        .filter((p) => {
          const matchCat =
            categoriaFiltro === 'todas' ||
            p.categoriaId === categoriaFiltro ||
            p.categoria === categoriaFiltro;
          const matchSearch =
            !busquedaItem.trim() ||
            p.nombre.toLowerCase().includes(busquedaItem.toLowerCase());
          return matchCat && matchSearch;
        });
    } else {
      return promocionesApi
        .filter((promo) => promo.activo !== false)
        .filter((promo) => {
          const matchSearch =
            !busquedaItem.trim() ||
            promo.nombre.toLowerCase().includes(busquedaItem.toLowerCase());
          return matchSearch;
        })
        .map((p) => ({
          ...p,
          id: p._id || p.id,
          precioVenta: p.precioFijo,
        }));
    }
  }, [tipoSeleccionItem, categoriaFiltro, busquedaItem, productosApi, promocionesApi]);

  // Filtrado de mesas para el plano
  const mesasFiltradas = useMemo(() => {
    return mesas.filter((m) => {
      if (filtroEstadoMesa === 'libres' && m.estado !== 'libre') return false;
      if (filtroEstadoMesa === 'ocupadas' && m.estado !== 'ocupada') return false;
      if (filtroSector !== 'todos' && m.sector !== filtroSector) return false;
      return true;
    });
  }, [mesas, filtroEstadoMesa, filtroSector]);


  // Estadísticas globales superiores
  const statsSalon = useMemo(() => {
    const total = mesas.length;
    const ocupadas = mesas.filter((m) => m.estado === 'ocupada').length;
    const libres = total - ocupadas;
    const porcentajeOcupacion = total > 0 ? Math.round((ocupadas / total) * 100) : 0;

    const totalVentaActiva = mesas.reduce((sum, m) => {
      return m.estado === 'ocupada' ? sum + calcularTotalMesa(m) : sum;
    }, 0);

    let itemsEnCocina = 0;
    let itemsListos = 0;
    mesas.forEach((m) => {
      if (m.estado === 'ocupada') {
        m.pedido.forEach((it) => {
          if (it.enviadoACocina && it.estadoCocina === 'en_preparacion')
            itemsEnCocina++;
          if (it.enviadoACocina && it.estadoCocina === 'listo') itemsListos++;
        });
      }
    });

    return {
      total,
      ocupadas,
      libres,
      porcentajeOcupacion,
      totalVentaActiva,
      itemsEnCocina,
      itemsListos,
    };
  }, [mesas]);

  // Estadísticas filtradas según el sector seleccionado
  const statsFiltroSector = useMemo(() => {
    const mesasDelSector = filtroSector === 'todos' ? mesas : mesas.filter((m) => m.sector === filtroSector);
    const total = mesasDelSector.length;
    const ocupadas = mesasDelSector.filter((m) => m.estado === 'ocupada').length;
    const libres = total - ocupadas;
    return { total, libres, ocupadas };
  }, [mesas, filtroSector]);

  return (
    <div className="space-y-4 font-body text-aleman-negro">
      {/* Toast de notificación rápida */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-aleman-verde text-aleman-hueso text-sm font-semibold px-4 py-2.5 rounded-sm shadow-md flex items-center gap-2 border-2 border-aleman-dorado animate-bounce">
          <span>✨</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ========================================================= */}
      {/* ENCABEZADO Y ACCIONES PRINCIPALES */}
      {/* ========================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-display font-bold text-aleman-negro">
              Gestión de Salón y Mesas
            </h1>
            <span className="text-sm font-bold px-2.5 py-0.5 rounded-sm uppercase tracking-wider bg-aleman-verde text-aleman-hueso border border-aleman-dorado">
              Rol:{' '}
              {user?.rol === 'encargado'
                ? 'Encargado'
                : user?.rol === 'dueno'
                ? 'Dueño'
                : user?.rol === 'mozo' || user?.rol?.toLowerCase() === 'mozo'
                ? 'Mozo'
                : user?.rol
                ? user.rol.charAt(0).toUpperCase() + user.rol.slice(1)
                : 'Mozo'}
            </span>
          </div>
          <p className="hidden md:block text-sm sm:text-base text-aleman-negro/70">
            Plano interactivo en tiempo real, comanda incremental y avance de cocina
          </p>
        </div>

        {/* Acciones principales de administración visibles SOLO para rol Dueño */}
        {esDueno && (
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={handleOpenGestionSectoresModal}
              className="px-3.5 py-2 bg-aleman-dorado hover:bg-aleman-dorado-light text-aleman-negro font-bold text-sm sm:text-base rounded-sm border border-aleman-negro/40 shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider hover:scale-[1.01] active:scale-[0.99]"
              title="Gestionar, renombrar o eliminar sectores del salón"
            >
              <span>⚙️</span> Gestionar Sectores
            </button>
            <button
              type="button"
              onClick={handleOpenCrearMesasModal}
              className="px-3.5 py-2 bg-aleman-rojo hover:bg-aleman-rojo-dark text-aleman-hueso font-bold text-sm sm:text-base rounded-sm border border-aleman-negro/40 shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider hover:scale-[1.01] active:scale-[0.99]"
            >
              <span className="text-lg leading-none font-bold">+</span> Agregar Mesas
            </button>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* KPI CARDS / MÉTRICAS DEL SALÓN */}
      {/* ========================================================= */}
      <div className="hidden md:grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {/* Card 1: Ocupación */}
        <div className="bg-aleman-hueso rounded-sm p-4 border-2 border-aleman-negro/20 flex items-center justify-between shadow-2xs">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-aleman-negro/70 block">
              Ocupación de Mesas
            </span>
            <div className="text-2xl font-display font-bold text-aleman-negro mt-0.5">
              {statsSalon.ocupadas} / {statsSalon.total}{' '}
              <span className="text-sm text-aleman-negro/50 font-normal">
                ({statsSalon.porcentajeOcupacion}%)
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs font-semibold">
              <span className="text-emerald-800">🟢 {statsSalon.libres} libres</span>
              <span className="text-aleman-negro/30">•</span>
              <span className="text-aleman-rojo">🔴 {statsSalon.ocupadas} ocupadas</span>
            </div>
          </div>
          <div
            className="w-12 h-12 rounded-full bg-aleman-verde/15 border border-aleman-verde/30 flex items-center justify-center text-2xl shrink-0 shadow-2xs"
            title="Ocupación actual del salón"
          >
            🍽️
          </div>
        </div>

        {/* Card 2: Ventas activas en salón */}
        <div className="bg-aleman-hueso rounded-sm p-4 border-2 border-aleman-negro/20 flex items-center justify-between shadow-2xs">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-aleman-negro/70 block">
              Ventas en Curso (Salón)
            </span>
            <div className="text-2xl font-display font-bold text-aleman-negro mt-0.5">
              {formatCurrency(statsSalon.totalVentaActiva)}
            </div>
            <span className="text-xs text-aleman-negro/60 font-medium block mt-1">
              Suma de comandas abiertas en salón
            </span>
          </div>
          <div
            className="w-12 h-12 rounded-full bg-aleman-dorado/25 border border-aleman-dorado/40 flex items-center justify-center text-2xl shrink-0 shadow-2xs"
            title="Ventas activas acumuladas"
          >
            💰
          </div>
        </div>

        {/* Card 3: Estado Cocina Salón */}
        <div className="bg-aleman-hueso rounded-sm p-4 border-2 border-aleman-negro/20 flex items-center justify-between shadow-2xs">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-aleman-negro/70 block">
              Cocina Salón en Vivo
            </span>
            <div className="text-2xl font-display font-bold text-blue-900 mt-0.5">
              {statsSalon.itemsEnCocina} en prep.
            </div>
            <span className="text-xs text-emerald-800 font-bold block mt-1">
              🍽️ {statsSalon.itemsListos} platos listos para servir
            </span>
          </div>
          <div
            className="w-12 h-12 rounded-full bg-aleman-rojo/15 border border-aleman-rojo/30 flex items-center justify-center text-2xl shrink-0 shadow-2xs"
            title="Estado de preparación en cocina"
          >
            👨‍🍳
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* BARRA DE FILTROS Y CONTROLES DEL PLANO POS (UNIFICADA) */}
      {/* ========================================================= */}
      <div className="bg-aleman-hueso rounded-sm px-3.5 py-2 border-2 border-aleman-negro/20 flex flex-wrap items-center justify-between gap-2.5 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Selector de Sector */}
          {sectores.length > 3 ? (
            <div className="flex items-center gap-1.5">
              <label
                htmlFor="filtro-sector-select"
                className="text-xs font-bold uppercase tracking-wider text-aleman-negro/70 hidden sm:inline"
              >
                Sector:
              </label>
              <select
                id="filtro-sector-select"
                value={filtroSector}
                onChange={(e) => setFiltroSector(e.target.value)}
                className="px-2.5 py-1 bg-aleman-crema border border-aleman-negro/25 rounded-sm text-xs font-bold text-aleman-negro focus:border-aleman-verde focus:outline-none cursor-pointer shadow-2xs hover:border-aleman-negro/40 transition-colors"
                title="Filtrar mesas por sector"
              >
                <option value="todos">📍 Todos los sectores ({mesas.length})</option>
                {sectores.map((s) => (
                  <option key={s} value={s}>
                    📍 {s} ({mesas.filter((m) => m.sector === s).length})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex items-center bg-aleman-crema p-0.5 rounded-sm border border-aleman-negro/15 gap-0.5">
              <button
                type="button"
                onClick={() => setFiltroSector('todos')}
                className={`px-2.5 py-1 rounded-sm text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  filtroSector === 'todos'
                    ? 'bg-aleman-verde text-aleman-hueso shadow-2xs'
                    : 'text-aleman-negro/70 hover:text-aleman-negro hover:bg-aleman-hueso/50'
                }`}
              >
                Todos ({mesas.length})
              </button>
              {sectores.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFiltroSector(s)}
                  className={`px-2 py-1 rounded-sm text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    filtroSector === s
                      ? 'bg-aleman-verde text-aleman-hueso shadow-2xs'
                      : 'text-aleman-negro/70 hover:text-aleman-negro hover:bg-aleman-hueso/50'
                  }`}
                >
                  📍 {s}
                </button>
              ))}
            </div>
          )}

          {/* Separador vertical sutil */}
          <div className="h-5 w-px bg-aleman-negro/20" />

          {/* Filtro por estado (Todas / Libres / Ocupadas) */}
          <div className="flex items-center bg-aleman-crema p-0.5 rounded-sm border border-aleman-negro/20 gap-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => setFiltroEstadoMesa('todas')}
              className={`px-2.5 py-1 rounded-sm text-xs font-bold transition-all duration-150 cursor-pointer ${
                filtroEstadoMesa === 'todas'
                  ? 'bg-aleman-dorado text-aleman-negro shadow-2xs font-extrabold'
                  : 'text-aleman-negro/70 hover:text-aleman-negro hover:bg-aleman-hueso/60'
              }`}
            >
              Todas ({statsFiltroSector.total})
            </button>
            <button
              type="button"
              onClick={() => setFiltroEstadoMesa('libres')}
              className={`px-2.5 py-1 rounded-sm text-xs font-bold transition-all duration-150 cursor-pointer ${
                filtroEstadoMesa === 'libres'
                  ? 'bg-emerald-700 text-aleman-hueso shadow-2xs font-extrabold'
                  : 'text-aleman-negro/70 hover:text-aleman-negro hover:bg-aleman-hueso/60'
              }`}
            >
              🟢 Libres ({statsFiltroSector.libres})
            </button>
            <button
              type="button"
              onClick={() => setFiltroEstadoMesa('ocupadas')}
              className={`px-2.5 py-1 rounded-sm text-xs font-bold transition-all duration-150 cursor-pointer ${
                filtroEstadoMesa === 'ocupadas'
                  ? 'bg-aleman-rojo text-aleman-hueso shadow-2xs font-extrabold'
                  : 'text-aleman-negro/70 hover:text-aleman-negro hover:bg-aleman-hueso/60'
              }`}
            >
              🔴 Ocupadas ({statsFiltroSector.ocupadas})
            </button>
          </div>
        </div>

        {/* Acciones del plano: Reacomodar mesas y Modo edición (Solo Dueño) */}
        {esDueno && (
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              type="button"
              onClick={handleReacomodarMesas}
              title="Reorganiza automáticamente todas las mesas en una grilla visible"
              className="px-3 py-1.5 rounded-sm text-xs font-display font-bold uppercase tracking-wider bg-aleman-verde text-aleman-hueso hover:bg-aleman-verde-dark border border-aleman-dorado/50 transition-all cursor-pointer shadow-xs"
            >
              🧹 Reacomodar mesas
            </button>

            <div className="relative group">
              <button
                type="button"
                onClick={() => {
                  if (modoEdicion) {
                    setModoEdicion(false);
                    showToast('Distribución de mesas guardada');
                  } else {
                    if (typeof window !== 'undefined' && window.innerWidth < 768) {
                      showToast('💡 La edición de distribución (arrastrar mesas) se recomienda en computadoras o tablets.');
                    }
                    setModoEdicion(true);
                  }
                }}
                title={
                  modoEdicion
                    ? 'Arrastrá las mesas para reubicar. Clic para guardar distribución.'
                    : 'Clic sobre una mesa para abrir comanda. Clic aquí para editar distribución.'
                }
                className={`px-3 py-1.5 rounded-sm text-xs font-display font-bold uppercase tracking-wider transition-all duration-150 flex items-center gap-1.5 cursor-pointer border shadow-xs ${
                  modoEdicion
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-800 ring-2 ring-emerald-400/40 animate-pulse'
                    : 'bg-aleman-dorado hover:bg-aleman-dorado-light text-aleman-negro border-aleman-negro/30 hover:scale-[1.02] active:scale-[0.98]'
                }`}
              >
                <span>{modoEdicion ? '💾' : '📐'}</span>
                <span>{modoEdicion ? 'Guardar distribución' : 'Editar distribución'}</span>
              </button>

              <div className="absolute right-0 bottom-full mb-1.5 hidden group-hover:block z-30 pointer-events-none whitespace-nowrap bg-aleman-negro text-aleman-hueso text-[11px] font-semibold px-2.5 py-1 rounded-sm border border-aleman-dorado/40 shadow-lg">
                {modoEdicion
                  ? 'Arrastrá las mesas para reubicar'
                  : 'Clic sobre una mesa para abrir comanda'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* CANVAS DEL PLANO TIPO POS (DISTRIBUCIÓN LIBRE EN PISO) */}
      {/* ========================================================= */}
      <div
        ref={canvasRef}
        onPointerMove={handleCanvasPointerMove}
        onPointerUp={handleCanvasPointerUp}
        title={
          modoEdicion
            ? 'Arrastrá las mesas para reubicar'
            : 'Clic sobre una mesa para abrir comanda'
        }
        className={`hidden md:block relative w-full h-[580px] rounded-sm bg-aleman-negro select-none overflow-hidden transition-all duration-200 ${
          modoEdicion
            ? 'border-2 border-dashed border-aleman-dorado ring-4 ring-aleman-dorado/20'
            : 'border-2 border-aleman-negro/40 shadow-xl'
        }`}
        style={{ touchAction: modoEdicion ? 'none' : 'auto' }}
      >
        {/* Trama sutil de piso POS / puntos de orientación */}
        <div
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{
            backgroundImage: `radial-gradient(#FAF7F0 1.2px, transparent 1.2px)`,
            backgroundSize: '32px 32px',
          }}
        />

        {/* Indicador superior */}
        <div className="absolute top-3 left-3 z-10 pointer-events-none flex items-center gap-2">
          {modoEdicion ? (
            <div className="flex items-center gap-2 bg-aleman-dorado text-aleman-negro px-3 py-1.5 rounded-xs font-display font-bold text-xs uppercase tracking-wider shadow-lg border border-aleman-negro/30">
              <span className="animate-spin text-sm">⚙️</span>
              <span>Modo edición activo: Arrastrá las fichas para posicionarlas</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-aleman-hueso/10 backdrop-blur-xs text-aleman-hueso/70 px-2.5 py-1 rounded-xs border border-aleman-hueso/15 font-mono text-[11px]">
              <span>📍</span>
              <span>SALÓN EL ALEMÁN • PLANO POS</span>
            </div>
          )}
        </div>

        {/* Leyenda compacta en esquina inferior derecha */}
        <div className="absolute bottom-3 right-3 z-20 flex flex-wrap items-center gap-3 bg-aleman-negro/85 backdrop-blur-xs px-3 py-1.5 rounded-sm border border-aleman-hueso/20 text-aleman-hueso/90 shadow-lg pointer-events-none text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full border-2 border-dashed border-aleman-hueso/60 bg-aleman-hueso/15" />
            <span className="text-[11px] font-medium">Libre ({statsSalon.libres})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-aleman-rojo border border-aleman-rojo-dark" />
            <span className="text-[11px] font-medium">Ocupada ({statsSalon.ocupadas})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-aleman-dorado border border-amber-600" />
            <span className="text-[11px] font-medium text-aleman-dorado">Lista p/ cobrar</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-[11px] font-bold text-emerald-400">Plato listo</span>
          </div>
        </div>

        {/* Indicador de mesas visibles en esquina inferior izquierda */}
        <div className="absolute bottom-3 left-3 z-20 pointer-events-none font-mono text-[11px] text-aleman-hueso/50 hidden sm:block">
          {mesasFiltradas.length} {mesasFiltradas.length === 1 ? 'mesa mostrada' : 'mesas mostradas'}
          {filtroSector !== 'todos' ? ` (Filtrado por Sector: "${filtroSector}" • ${mesas.length} totales)` : ` (${mesas.length} totales)`}
        </div>

        {/* Renderizado de Fichas de Mesa */}
        {mesasFiltradas.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-6 text-center">
            <div className="bg-aleman-negro/90 backdrop-blur-xs p-6 rounded-sm border border-aleman-dorado/30 text-aleman-hueso shadow-xl max-w-sm">
              <span className="text-3xl block mb-2">🍽️</span>
              <h3 className="font-display font-bold text-base uppercase tracking-wider text-aleman-dorado">
                No se encontraron mesas
              </h3>
              <p className="text-xs text-aleman-hueso/70 mt-1">
                No hay mesas que coincidan con los filtros de sector o estado seleccionados.
              </p>
            </div>
          </div>
        ) : (
          mesasFiltradas.map((mesa) => {
            const totalMesa = calcularTotalMesa(mesa);
            const esLibre = mesa.estado === 'libre';
            const esListaParaCobrar = esMesaListaParaCobrar(mesa);
            const itemsSinEnviar = (mesa.pedido || []).filter(
              (it) => !it.enviadoACocina
            ).length;
            const itemsListos = (mesa.pedido || []).filter(
              (it) => it.enviadoACocina && it.estadoCocina === 'listo'
            ).length;
            const itemsEnCocina = (mesa.pedido || []).filter(
              (it) => it.enviadoACocina && it.estadoCocina === 'en_preparacion'
            ).length;

            const isDragging = arrastrandoMesaId === mesa.id;

            return (
              <div
                key={mesa.id}
                onPointerDown={(e) => handlePointerDownMesa(e, mesa)}
                onPointerUp={handlePointerUpMesa}
                onClick={() => {
                  if (modoEdicion) return;
                  handleAbrirMesaDetalle(mesa);
                }}
                style={{
                  left: `${mesa.posicionX ?? 50}%`,
                  top: `${mesa.posicionY ?? 50}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                className={`absolute group select-none transition-shadow ${
                  modoEdicion
                    ? isDragging
                      ? 'cursor-grabbing z-40 scale-110'
                      : 'cursor-grab hover:scale-105 z-30'
                    : 'cursor-pointer hover:scale-110 active:scale-95 z-20 transition-transform duration-150'
                }`}
              >
                {/* Chip de la Mesa */}
                <div
                  className={`relative flex flex-col items-center justify-center rounded-2xl transition-all shadow-md ${
                    mesa.capacidad >= 6 ? 'w-18 h-18 sm:w-20 sm:h-20' : 'w-15 h-15 sm:w-16 sm:h-16'
                  } ${
                    esLibre
                      ? 'bg-aleman-hueso/10 hover:bg-aleman-hueso/20 border-2 border-dashed border-aleman-hueso/40 text-aleman-hueso'
                      : esListaParaCobrar
                      ? 'bg-aleman-dorado border-2 border-amber-600 text-aleman-negro shadow-md ring-2 ring-aleman-dorado/50'
                      : 'bg-aleman-rojo border-2 border-aleman-rojo-dark text-aleman-hueso shadow-md'
                  } ${
                    modoEdicion
                      ? 'ring-2 ring-aleman-dorado/60 ring-offset-2 ring-offset-aleman-negro'
                      : ''
                  } ${isDragging ? 'ring-4 ring-aleman-dorado shadow-2xl' : ''}`}
                >
                  {/* Badge de lista para cobrar */}
                  {esListaParaCobrar && (
                    <span
                      className="absolute -top-1.5 -right-1.5 z-20 flex h-5 w-5 items-center justify-center rounded-full bg-aleman-negro text-[10px] font-black text-aleman-dorado shadow ring-2 ring-aleman-dorado/40"
                      title="Todos los platos entregados - Lista para cobrar"
                    >
                      💰
                    </span>
                  )}

                  {/* Halo pulsante si tiene platos listos */}
                  {itemsListos > 0 && !esListaParaCobrar && (
                    <span className="absolute -inset-1 rounded-2xl bg-emerald-500/35 animate-ping pointer-events-none" />
                  )}

                  {/* Badge superior si hay platos listos para servir */}
                  {itemsListos > 0 && !esListaParaCobrar && (
                    <span
                      className="absolute -top-2 -right-2 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-[11px] font-black text-white shadow-lg ring-2 ring-emerald-300 animate-bounce"
                      title={`${itemsListos} plato(s) listo(s) para servir`}
                    >
                      🍽️
                    </span>
                  )}

                  {/* Badge si está en cocina */}
                  {itemsEnCocina > 0 && itemsListos === 0 && (
                    <span
                      className="absolute -top-1.5 -left-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white shadow"
                      title={`${itemsEnCocina} en preparación`}
                    >
                      🍳
                    </span>
                  )}

                  {/* Badge si tiene ítems sin enviar */}
                  {itemsSinEnviar > 0 && (
                    <span
                      className="absolute -bottom-1 -left-1 z-10 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-amber-500 text-[10px] text-aleman-negro font-bold shadow"
                      title={`${itemsSinEnviar} sin enviar`}
                    >
                      ⚠️
                    </span>
                  )}

                  {/* Número de mesa */}
                  <span className="font-display font-bold text-base sm:text-lg leading-tight tracking-tight">
                    {mesa.numero}
                  </span>

                  {/* Subtexto: Capacidad (si libre) o Total (si ocupada) */}
                  {esLibre ? (
                    <span className="text-[10px] text-aleman-hueso/70 font-semibold leading-none">
                      {mesa.capacidad}p
                    </span>
                  ) : (
                    <span className={`text-[9px] sm:text-[10px] font-bold leading-none mt-0.5 max-w-[56px] truncate ${
                      esListaParaCobrar ? 'text-aleman-negro' : 'text-aleman-dorado'
                    }`}>
                      {formatCurrency(totalMesa)}
                    </span>
                  )}
                </div>

                {/* Tooltip flotante al hacer hover (deshabilitado mientras se arrastra) */}
                {!isDragging && (() => {
                  const esSuperior = (mesa.posicionY ?? 50) < 35;
                  return (
                    <div
                      className={`pointer-events-none absolute left-1/2 -translate-x-1/2 z-50 opacity-0 group-hover:opacity-100 transition-all duration-150 transform w-48 bg-aleman-negro text-aleman-hueso p-2.5 rounded-sm shadow-2xl border border-aleman-dorado text-left select-none ${
                        esSuperior
                          ? 'top-full mt-2.5 translate-y-1 group-hover:translate-y-0'
                          : 'bottom-full mb-2.5 translate-y-1 group-hover:translate-y-0'
                      }`}
                    >
                      <div className="flex items-center justify-between border-b border-aleman-hueso/20 pb-1 mb-1">
                        <span className="font-display font-bold text-xs uppercase tracking-wider text-aleman-dorado">
                          Mesa #{mesa.numero}
                        </span>
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded-xs font-bold uppercase ${
                            esLibre
                              ? 'bg-emerald-900/80 text-emerald-300 border border-emerald-500/40'
                              : esListaParaCobrar
                              ? 'bg-aleman-dorado text-aleman-negro border border-amber-600'
                              : 'bg-aleman-rojo text-white'
                          }`}
                        >
                          {esLibre ? 'Libre' : esListaParaCobrar ? 'Lista p/ cobrar' : 'Ocupada'}
                        </span>
                      </div>

                      <div className="text-xs space-y-0.5">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-aleman-hueso/70">Sector:</span>
                          <span className="font-semibold text-aleman-hueso">{mesa.sector}</span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-aleman-hueso/70">Capacidad:</span>
                          <span className="font-semibold text-aleman-hueso">{mesa.capacidad} pers.</span>
                        </div>

                        {!esLibre && (
                          <>
                            <div className="flex justify-between text-[11px] pt-1 border-t border-aleman-hueso/15 mt-1">
                              <span className="text-aleman-hueso/70">Total cuenta:</span>
                              <span className="font-bold text-aleman-dorado">
                                {formatCurrency(totalMesa)}
                              </span>
                            </div>
                            <div className="flex justify-between text-[11px]">
                              <span className="text-aleman-hueso/70">Ítems pedidos:</span>
                              <span className="font-semibold">{mesa.pedido?.length || 0}</span>
                            </div>
                            {itemsListos > 0 && (
                              <div className="text-emerald-400 text-[10px] font-bold animate-pulse pt-0.5">
                                🍽️ {itemsListos} plato(s) listos para servir!
                              </div>
                            )}
                            {itemsEnCocina > 0 && (
                              <div className="text-blue-300 text-[10px] font-semibold">
                                🍳 {itemsEnCocina} en preparación
                              </div>
                            )}
                            {itemsSinEnviar > 0 && (
                              <div className="text-amber-400 text-[10px] font-semibold">
                                ⚠️ {itemsSinEnviar} ítem(s) sin enviar
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      <div className="text-[9px] text-aleman-hueso/50 pt-1 text-center font-medium border-t border-aleman-hueso/10 mt-1">
                        {modoEdicion ? 'Arrastrá para reubicar' : 'Clic para abrir comanda'}
                      </div>
                      {/* Flecha del tooltip */}
                      <div
                        className={`absolute left-1/2 -translate-x-1/2 border-4 border-transparent ${
                          esSuperior
                            ? 'bottom-full border-b-aleman-negro'
                            : 'top-full border-t-aleman-negro'
                        }`}
                      />
                    </div>
                  );
                })()}

                {/* Acciones de edición/eliminación para dueño en mesa libre (fuera de modo drag) */}
                {esDueno && esLibre && !modoEdicion && (
                  <div className="pointer-events-auto absolute -bottom-5 left-1/2 -translate-x-1/2 hidden group-hover:flex items-center gap-1 z-40 bg-aleman-negro/95 px-1.5 py-0.5 rounded border border-aleman-hueso/20 shadow-md">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEditarMesa(mesa);
                      }}
                      className="text-xs hover:scale-125 transition-transform cursor-pointer"
                      title="Editar capacidad / número"
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEliminarMesa(e, mesa);
                      }}
                      className="text-xs hover:scale-125 transition-transform cursor-pointer"
                      title="Eliminar mesa"
                    >
                      🗑️
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ========================================================= */}
      {/* GRILLA TÁCTIL DE MESAS EN MOBILE (< md) */}
      {/* ========================================================= */}
      <div className="block md:hidden space-y-4">
        {mesasFiltradas.length === 0 ? (
          <div className="p-6 bg-aleman-hueso rounded-sm border-2 border-aleman-negro/20 text-center text-aleman-negro shadow-2xs">
            <span className="text-3xl block mb-2">🍽️</span>
            <h3 className="font-display font-bold text-base uppercase tracking-wider text-aleman-rojo">
              No se encontraron mesas
            </h3>
            <p className="text-xs text-aleman-negro/70 mt-1">
              No hay mesas que coincidan con los filtros de sector o estado seleccionados.
            </p>
          </div>
        ) : (
          (() => {
            const sectoresAMostrar =
              filtroSector === 'todos'
                ? sectores.filter((s) => mesasFiltradas.some((m) => m.sector === s))
                : [filtroSector];

            return sectoresAMostrar.map((sec) => {
              const mesasDelSector = mesasFiltradas.filter((m) => m.sector === sec);
              if (mesasDelSector.length === 0) return null;

              return (
                <div
                  key={sec}
                  className="bg-aleman-hueso p-3.5 rounded-sm border-2 border-aleman-negro/20 shadow-2xs space-y-2.5"
                >
                  <div className="flex items-center justify-between border-b border-aleman-negro/10 pb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">📍</span>
                      <h3 className="font-display font-bold text-sm uppercase tracking-wider text-aleman-negro">
                        {sec}
                      </h3>
                    </div>
                    <span className="text-xs text-aleman-negro/60 font-semibold">
                      {mesasDelSector.length} mesa{mesasDelSector.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {mesasDelSector.map((mesa) => {
                      const totalMesa = calcularTotalMesa(mesa);
                      const esLibre = mesa.estado === 'libre';
                      const esListaParaCobrar = esMesaListaParaCobrar(mesa);
                      const itemsListos = (mesa.pedido || []).filter(
                        (it) => it.enviadoACocina && it.estadoCocina === 'listo'
                      ).length;
                      const itemsEnCocina = (mesa.pedido || []).filter(
                        (it) => it.enviadoACocina && it.estadoCocina === 'en_preparacion'
                      ).length;
                      const itemsSinEnviar = (mesa.pedido || []).filter(
                        (it) => !it.enviadoACocina
                      ).length;

                      return (
                        <button
                          key={mesa.id}
                          type="button"
                          onClick={() => handleAbrirMesaDetalle(mesa)}
                          className={`relative flex flex-col items-center justify-center p-3 min-h-[84px] rounded-xl border-2 transition-all duration-150 cursor-pointer text-center shadow-xs active:scale-95 ${
                            esLibre
                              ? 'bg-aleman-crema border-aleman-verde/40 text-aleman-negro hover:border-aleman-verde'
                              : esListaParaCobrar
                              ? 'bg-aleman-dorado border-amber-600 text-aleman-negro shadow-md ring-1 ring-aleman-dorado/50'
                              : 'bg-aleman-rojo border-aleman-rojo-dark text-aleman-hueso shadow-md'
                          }`}
                        >
                          {/* Badge de lista para cobrar */}
                          {esListaParaCobrar && (
                            <span
                              className="absolute -top-1.5 -right-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-aleman-negro text-[10px] font-black text-aleman-dorado shadow ring-2 ring-aleman-dorado/40"
                              title="Todos los platos entregados - Lista para cobrar"
                            >
                              💰
                            </span>
                          )}

                          {/* Badges de cocina */}
                          {itemsListos > 0 && !esListaParaCobrar && (
                            <span
                              className="absolute -top-1.5 -right-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-black text-white shadow ring-2 ring-emerald-200 animate-bounce"
                              title={`${itemsListos} plato(s) listo(s)`}
                            >
                              🍽️
                            </span>
                          )}
                          {itemsEnCocina > 0 && itemsListos === 0 && (
                            <span
                              className="absolute -top-1.5 -left-1.5 z-10 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white shadow"
                              title={`${itemsEnCocina} en cocina`}
                            >
                              🍳
                            </span>
                          )}
                          {itemsSinEnviar > 0 && (
                            <span
                              className="absolute -bottom-1 -left-1 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] text-aleman-negro font-bold shadow"
                              title={`${itemsSinEnviar} sin enviar`}
                            >
                              ⚠️
                            </span>
                          )}

                          {/* Número de Mesa */}
                          <span className="font-display font-bold text-xl leading-tight">
                            Mesa #{mesa.numero}
                          </span>

                          {/* Estado y total / capacidad */}
                          <div className="mt-1">
                            {esLibre ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-300">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                                Libre ({mesa.capacidad}p)
                              </span>
                            ) : esListaParaCobrar ? (
                              <div className="flex flex-col items-center">
                                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-aleman-negro bg-aleman-hueso/90 px-2 py-0.5 rounded-full border border-aleman-negro/20">
                                  💰 Lista para cobrar
                                </span>
                                <span className="text-xs font-display font-black text-aleman-negro leading-tight mt-0.5">
                                  {formatCurrency(totalMesa)}
                                </span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-aleman-hueso/80 leading-none">
                                  Ocupada
                                </span>
                                <span className="text-xs font-display font-bold text-aleman-dorado leading-tight mt-0.5">
                                  {formatCurrency(totalMesa)}
                                </span>
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            });
          })()
        )}
      </div>

      {/* ========================================================= */}
      {/* MODAL / DRAWER DE COMANDA DE LA MESA SELECCIONADA */}
      {/* ========================================================= */}
      {mesaActual && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-6 bg-aleman-negro/60 backdrop-blur-xs overflow-y-auto animate-backdropFade">
          <div className="bg-aleman-hueso md:rounded-sm md:border-2 border-aleman-negro w-full max-w-5xl h-full md:h-auto md:max-h-[90vh] my-0 md:my-4 overflow-hidden flex flex-col shadow-2xl animate-modalEnter">
            {/* Modal Header */}
            <div className="px-4 py-3 md:px-6 md:py-4 border-b-2 border-aleman-dorado flex flex-wrap items-center justify-between gap-2.5 bg-aleman-verde text-aleman-hueso flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 md:w-10 md:h-10 rounded-sm bg-aleman-dorado text-aleman-negro font-display font-bold text-base md:text-lg flex items-center justify-center shadow-xs">
                  {mesaActual.numero}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg md:text-2xl font-display font-bold text-aleman-hueso uppercase tracking-wider leading-tight">
                      Mesa #{mesaActual.numero}
                    </h2>
                    <span className="text-xs md:text-sm bg-aleman-rojo text-aleman-hueso border border-aleman-rojo-dark px-2 py-0.5 rounded-sm font-bold shadow-xs">
                      Ocupada
                    </span>
                  </div>
                  <span className="text-xs md:text-sm text-aleman-hueso/70 font-semibold block leading-tight">
                    📍 {mesaActual.sector} • Capacidad: {mesaActual.capacidad}p
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 md:gap-4">
                {/* Total en el header */}
                <div className="text-right">
                  <span className="text-[10px] md:text-xs text-aleman-hueso/70 block uppercase tracking-wider font-semibold leading-none">
                    Total Mesa
                  </span>
                  <span className="text-lg md:text-2xl font-display font-bold text-aleman-dorado leading-tight">
                    <AnimatedPrice value={totalMesaActual} className="text-aleman-dorado" />
                  </span>
                </div>

                {/* Botón Imprimir Comanda */}
                <button
                  onClick={handleImprimirComanda}
                  className="hidden sm:flex px-2.5 py-1.5 md:px-3 md:py-2 bg-aleman-verde-dark hover:bg-aleman-verde text-aleman-hueso text-xs md:text-sm font-bold uppercase tracking-wider rounded-sm border border-aleman-dorado/40 items-center gap-1.5 cursor-pointer transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]"
                  title="Simular envío a impresora térmica"
                >
                  <span>🖨️</span> <span className="hidden md:inline">Imprimir</span>
                </button>

                {/* Cerrar modal */}
                <button
                  onClick={() => setMesaSeleccionadaId(null)}
                  className="text-aleman-hueso/70 hover:text-aleman-hueso text-xl font-bold p-1 rounded transition-transform duration-150 hover:scale-110 active:scale-95 cursor-pointer"
                  aria-label="Cerrar modal de mesa"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Mobile Selector de Vista (Cargar Ítems vs Comanda) */}
            <div className="md:hidden flex border-b-2 border-aleman-negro/15 bg-aleman-crema flex-shrink-0">
              <button
                type="button"
                onClick={() => setVistaMobileMesa('cargar')}
                className={`flex-1 py-2.5 text-xs font-display font-bold uppercase tracking-wider text-center transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                  vistaMobileMesa === 'cargar'
                    ? 'bg-aleman-hueso text-aleman-negro border-b-2 border-aleman-verde font-extrabold shadow-2xs'
                    : 'text-aleman-negro/60 hover:text-aleman-negro hover:bg-aleman-hueso/50'
                }`}
              >
                <span>🍕 Cargar Ítems</span>
              </button>
              <button
                type="button"
                onClick={() => setVistaMobileMesa('comanda')}
                className={`flex-1 py-2.5 text-xs font-display font-bold uppercase tracking-wider text-center transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                  vistaMobileMesa === 'comanda'
                    ? 'bg-aleman-hueso text-aleman-negro border-b-2 border-aleman-verde font-extrabold shadow-2xs'
                    : 'text-aleman-negro/60 hover:text-aleman-negro hover:bg-aleman-hueso/50'
                }`}
              >
                <span>📋 Comanda ({mesaActual.pedido.length})</span>
                {resumenCocinaMesa.sinEnviar > 0 && (
                  <span className="w-2 h-2 rounded-full bg-aleman-rojo animate-ping" />
                )}
              </button>
            </div>

            {/* Modal Body: Split Grid en Desktop / Vistas en Mobile */}
            <div className="flex-1 overflow-y-auto flex flex-col md:grid md:grid-cols-12 md:divide-x-2 divide-aleman-negro/15">
              {/* ========================================================= */}
              {/* COLUMNA IZQUIERDA: CARGADOR DE PRODUCTOS Y COMBOS (5 cols en desktop) */}
              {/* ========================================================= */}
              <div
                className={`p-4 md:p-5 space-y-4 bg-aleman-crema overflow-y-auto md:col-span-5 ${
                  vistaMobileMesa === 'cargar' ? 'flex flex-col flex-1' : 'hidden md:block'
                }`}
              >
                <div>
                  <h3 className="text-base font-display font-bold text-aleman-negro uppercase tracking-wider">
                    Cargar Ítems al Pedido
                  </h3>
                  <p className="text-sm text-aleman-negro/70">
                    Seleccioná productos o promociones para sumar a la mesa
                  </p>
                </div>

                {/* Selector Tipo: Productos vs Promociones */}
                <div className="flex bg-aleman-hueso p-1 rounded-sm border border-aleman-negro/20">
                  <button
                    type="button"
                    onClick={() => {
                      setTipoSeleccionItem('productos');
                      const firstProd = productosApi.find((p) => p.activo !== false);
                      setItemIdSeleccionado(firstProd?._id || firstProd?.id || '');
                    }}
                    className={`flex-1 py-1.5 text-sm font-bold rounded-sm transition-all duration-150 hover:scale-[1.01] active:scale-[0.99] cursor-pointer ${
                      tipoSeleccionItem === 'productos'
                        ? 'bg-aleman-dorado text-aleman-negro shadow-2xs'
                        : 'text-aleman-negro/70 hover:text-aleman-negro'
                    }`}
                  >
                    🍕 Productos ({productosApi.filter((p) => p.activo !== false).length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTipoSeleccionItem('promociones');
                      const firstPromo = promocionesApi.find((p) => p.activo !== false);
                      setItemIdSeleccionado(firstPromo?._id || firstPromo?.id || '');
                    }}
                    className={`flex-1 py-1.5 text-sm font-bold rounded-sm transition-all duration-150 hover:scale-[1.01] active:scale-[0.99] cursor-pointer ${
                      tipoSeleccionItem === 'promociones'
                        ? 'bg-aleman-dorado text-aleman-negro shadow-2xs'
                        : 'text-aleman-negro/70 hover:text-aleman-negro'
                    }`}
                  >
                    🎁 Combos ({promocionesApi.filter((p) => p.activo !== false).length})
                  </button>
                </div>

                {/* Filtros de categorías y buscador */}
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Buscar plato o bebida..."
                    value={busquedaItem}
                    onChange={(e) => setBusquedaItem(e.target.value)}
                    className="w-full px-3 py-2 bg-white border-2 border-aleman-negro/25 rounded-sm text-sm text-aleman-negro focus:border-aleman-verde focus:outline-none"
                  />

                  {tipoSeleccionItem === 'productos' && (
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={() => setCategoriaFiltro('todas')}
                        className={`px-2 py-1 rounded-sm text-xs font-bold transition-colors cursor-pointer ${
                          categoriaFiltro === 'todas'
                            ? 'bg-aleman-verde text-aleman-hueso'
                            : 'bg-white text-aleman-negro border border-aleman-negro/20 hover:bg-aleman-crema'
                        }`}
                      >
                        Todas
                      </button>
                      {mockCategorias.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setCategoriaFiltro(c.id)}
                          className={`px-2 py-1 rounded-sm text-xs font-bold transition-colors cursor-pointer ${
                            categoriaFiltro === c.id
                              ? 'bg-aleman-verde text-aleman-hueso'
                              : 'bg-white text-aleman-negro border border-aleman-negro/20 hover:bg-aleman-crema'
                          }`}
                        >
                          {c.nombre}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Formulario de carga de ítem */}
                <form
                  onSubmit={handleAgregarItemComanda}
                  className="bg-aleman-hueso p-4 rounded-sm border-2 border-aleman-negro/20 space-y-3"
                >
                  <div>
                    <label className="block text-xs font-bold text-aleman-negro uppercase tracking-wider mb-1">
                      Seleccionar Ítem
                    </label>
                    <select
                      value={itemIdSeleccionado}
                      onChange={(e) => setItemIdSeleccionado(e.target.value)}
                      className="w-full px-3 py-2 bg-white border-2 border-aleman-negro/25 rounded-sm text-sm text-aleman-negro font-semibold focus:border-aleman-verde focus:outline-none"
                    >
                      {itemsDisponibles.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.nombre} —{' '}
                          {formatCurrency(item.precioVenta || item.precioCombo)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-aleman-negro uppercase tracking-wider mb-1">
                        Cantidad
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={cantidadItem}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => {
                          const cleaned = e.target.value.replace(/\D/g, '');
                          if (cleaned === '') {
                            setCantidadItem('');
                          } else {
                            const num = Math.min(99, parseInt(cleaned, 10));
                            setCantidadItem(num.toString());
                          }
                        }}
                        onBlur={() => {
                          if (!cantidadItem || parseInt(cantidadItem, 10) < 1) {
                            setCantidadItem('1');
                          }
                        }}
                        className="w-full px-3 py-2 bg-white border-2 border-aleman-negro/25 rounded-sm text-sm text-aleman-negro font-bold text-center focus:border-aleman-verde"
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="block text-xs font-bold text-aleman-negro uppercase tracking-wider mb-1">
                        Aclaración / Nota (Opcional)
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: sin cebolla, bien dorada..."
                        value={aclaracionItem}
                        onChange={(e) => setAclaracionItem(e.target.value)}
                        className="w-full px-3 py-2 bg-white border-2 border-aleman-negro/25 rounded-sm text-sm text-aleman-negro focus:border-aleman-verde"
                      />
                    </div>
                  </div>

                                    <button
                    type="submit"
                    className="w-full py-2.5 bg-aleman-verde hover:bg-aleman-verde-dark text-aleman-hueso font-bold text-base rounded-sm border border-aleman-negro/40 shadow-xs transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
                  >
                    <span>+</span> Agregar a la Comanda
                  </button>
                </form>

                {/* Mobile Sticky Bottom Bar (Patrón Carrito) */}
                <div className="md:hidden sticky bottom-0 -mx-4 -mb-4 p-3 bg-aleman-verde text-aleman-hueso border-t-2 border-aleman-dorado shadow-2xl flex items-center justify-between z-20 mt-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🛒</span>
                    <div>
                      <span className="font-bold text-xs block leading-tight text-aleman-hueso">
                        {mesaActual.pedido.length} ítem{mesaActual.pedido.length !== 1 ? 's' : ''} en comanda
                        {resumenCocinaMesa.sinEnviar > 0 && (
                          <span className="text-aleman-dorado font-bold ml-1">
                            ({resumenCocinaMesa.sinEnviar} nuevo{resumenCocinaMesa.sinEnviar !== 1 ? 's' : ''})
                          </span>
                        )}
                      </span>
                      <span className="text-xs font-display font-bold text-aleman-dorado leading-tight">
                        Total: {formatCurrency(totalMesaActual)}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setVistaMobileMesa('comanda')}
                    className="px-3.5 py-1.5 bg-aleman-dorado hover:bg-aleman-dorado-light text-aleman-negro font-display font-bold text-xs uppercase tracking-wider rounded-sm shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <span>Ver comanda</span>
                    <span className="text-sm leading-none font-bold">▲</span>
                  </button>
                </div>
              </div>

              {/* ========================================================= */}
              {/* COLUMNA DERECHA: COMANDA ACTIVA & ENVÍO INCREMENTAL (7 cols en desktop) */}
              {/* ========================================================= */}
              <div
                className={`p-4 md:p-5 space-y-5 overflow-y-auto bg-aleman-hueso flex flex-col justify-between md:col-span-7 ${
                  vistaMobileMesa === 'comanda' ? 'flex flex-col flex-1' : 'hidden md:flex'
                }`}
              >
                <div className="space-y-5">
                  {/* Mobile Helper Banner to switch back to Cargar Ítems */}
                  <div className="md:hidden flex items-center justify-between bg-aleman-crema p-2.5 rounded-sm border border-aleman-negro/15">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-aleman-negro">
                      <span>📋</span>
                      <span>Comanda #{mesaActual.numero} ({mesaActual.pedido.length} ítems)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setVistaMobileMesa('cargar')}
                      className="px-2.5 py-1 bg-aleman-verde hover:bg-aleman-verde-dark text-aleman-hueso text-xs font-bold uppercase tracking-wider rounded-sm border border-aleman-dorado transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <span>➕</span> Seguir agregando
                    </button>
                  </div>
                  {/* Encabezado de la comanda */}
                  <div className="flex flex-wrap items-center justify-between border-b-2 border-aleman-negro/10 pb-3 gap-2">
                    <div>
                      <h3 className="text-lg font-display font-bold text-aleman-negro">
                        Detalle de la Comanda
                      </h3>
                      <span className="text-sm text-aleman-negro/60 font-semibold">
                        {mesaActual.pedido.length} ítems en total en la cuenta
                      </span>
                    </div>

                    {/* Botón de Enviar a Cocina Incremental */}
                    {resumenCocinaMesa.sinEnviar > 0 && (
                      <button
                        type="button"
                        onClick={handleEnviarComandaCocina}
                        className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-aleman-hueso font-bold text-sm uppercase tracking-wider rounded-sm border border-aleman-negro/30 transition-all duration-150 flex items-center gap-2 cursor-pointer animate-pulseGlow hover:scale-[1.02] active:scale-[0.98] shadow-sm"
                      >
                        <span>👨‍🍳</span> Enviar a Cocina (
                        {resumenCocinaMesa.sinEnviar} nuevos)
                      </button>
                    )}
                  </div>


                  {/* ========================================================= */}
                  {/* SECCIÓN 1: ÍTEMS EN CARRITO (SIN ENVIAR A COCINA) */}
                  {/* ========================================================= */}
                  {resumenCocinaMesa.sinEnviar > 0 && (
                    <div className="p-3.5 bg-aleman-crema border-2 border-aleman-dorado rounded-sm space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-aleman-negro uppercase tracking-wider flex items-center gap-1.5">
                          <span>⚠️</span> Ítems Nuevos (Pendientes de Envío a Cocina)
                        </span>
                        <span className="text-xs font-bold text-amber-900">
                          {resumenCocinaMesa.sinEnviar} por enviar
                        </span>
                      </div>

                      <div className="space-y-2">
                        {agruparItemsParaRender(mesaActual.pedido.filter((it) => !it.enviadoACocina)).map((grupo, gIdx) => {
                          const renderSingleItem = (item) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between p-2.5 bg-white rounded-sm border border-aleman-negro/15 text-sm animate-itemEnter transition-all duration-150 hover:border-aleman-negro/30"
                            >
                              <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-sm bg-aleman-crema text-aleman-negro font-bold flex items-center justify-center border border-aleman-negro/20">
                                  {item.cantidad}x
                                </span>
                                <div>
                                  <span className="font-bold text-aleman-negro">
                                    {item.nombre}
                                  </span>
                                  {item.aclaracion && (
                                    <span className="block text-xs text-amber-900 italic font-semibold">
                                      Nota: {item.aclaracion}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2.5 flex-wrap justify-end">
                                <span className="font-display font-bold text-aleman-negro text-base">
                                  {formatCurrency(
                                    item.precioUnitario * item.cantidad
                                  )}
                                </span>
                                {puedeModificarComanda ? (
                                  <div className="flex items-center gap-1.5 ml-1">
                                    <button
                                      type="button"
                                      onClick={() => handleAbrirModalEditar(item)}
                                      className="w-8 h-8 flex items-center justify-center text-sm font-bold bg-white hover:bg-aleman-dorado/20 text-aleman-negro border border-aleman-negro/25 rounded-sm transition-colors cursor-pointer shadow-2xs"
                                      title="Editar ítem"
                                      aria-label="Editar ítem"
                                    >
                                      ✏️
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleAbrirModalEliminar(item)}
                                      className="w-8 h-8 flex items-center justify-center text-sm font-bold bg-red-50 hover:bg-red-100 text-aleman-rojo border border-aleman-rojo/30 rounded-sm transition-colors cursor-pointer shadow-2xs"
                                      title="Eliminar ítem"
                                      aria-label="Eliminar ítem"
                                    >
                                      🗑️
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleQuitarItemNoEnviado(item.id)}
                                    className="text-aleman-negro/40 hover:text-aleman-rojo p-1 font-bold text-sm cursor-pointer transition-transform duration-150 hover:scale-125 active:scale-95"
                                    title="Quitar ítem antes de enviar"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            </div>
                          );

                          if (grupo.esPromo) {
                            const totalGrupo = grupo.items.reduce(
                              (sum, it) => sum + it.precioUnitario * it.cantidad,
                              0
                            );
                            return (
                              <div
                                key={grupo.grupoPromocionId || gIdx}
                                className="p-3 bg-amber-50/90 border-2 border-amber-300 rounded-sm space-y-2 my-1 shadow-2xs"
                              >
                                <div className="flex items-center justify-between border-b border-amber-200 pb-1.5 font-bold text-amber-950 text-xs">
                                  <span className="flex items-center gap-1.5">
                                    <span className="text-sm">🎉</span> Promo: {grupo.promocionNombre}
                                  </span>
                                  <span className="bg-amber-200/90 text-amber-950 px-2.5 py-0.5 rounded-full font-mono font-bold">
                                    Total: {formatCurrency(totalGrupo)}
                                  </span>
                                </div>
                                <div className="space-y-1.5">
                                  {grupo.items.map(renderSingleItem)}
                                </div>
                              </div>
                            );
                          }
                          return renderSingleItem(grupo.item);
                        })}
                      </div>

                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          onClick={handleEnviarComandaCocina}
                          className="w-full py-2.5 bg-aleman-rojo hover:bg-aleman-rojo-dark text-aleman-hueso font-bold text-sm uppercase tracking-wider rounded-sm border border-aleman-negro/40 transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer animate-pulseGlow hover:scale-[1.02] active:scale-[0.98] shadow-sm"
                        >
                          <span>👨‍🍳 Enviar Comanda</span> — (
                          {resumenCocinaMesa.sinEnviar} ítem(s) nuevos)
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ========================================================= */}
                  {/* SECCIÓN 2: ÍTEMS ENVIADOS A COCINA CON SEMÁFORO */}
                  {/* ========================================================= */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-aleman-negro/10 pb-1.5">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-display font-bold text-aleman-negro uppercase tracking-wider flex items-center gap-1.5">
                          <span>👨‍🍳</span> Comanda Enviada a Cocina
                        </h4>
                        <span className="text-xs text-aleman-negro/60 font-semibold">
                          ·{' '}
                          {
                            mesaActual.pedido.filter((it) => it.enviadoACocina)
                              .length
                          }{' '}
                          ítems en cocina
                        </span>
                      </div>
                    </div>

                    {mesaActual.pedido.filter((it) => it.enviadoACocina).length ===
                    0 ? (
                      <div className="p-6 bg-aleman-crema rounded-sm border border-dashed border-aleman-negro/20 text-center text-sm text-aleman-negro/50">
                        Aún no se enviaron ítems a cocina. Cargá productos y presioná "Enviar a Cocina".
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                        {agruparItemsParaRender(mesaActual.pedido.filter((it) => it.enviadoACocina)).map((grupo, gIdx) => {
                          const renderSingleItem = (item) => {
                            const currentEstadoObj =
                              ESTADOS_COCINA.find(
                                (e) => e.key === item.estadoCocina
                              ) || ESTADOS_COCINA[0];
                            const isEntregado = item.estadoCocina === 'entregado';

                            return (
                              <div
                                key={item.id}
                                className="p-3 bg-aleman-crema rounded-sm border border-aleman-negro/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm animate-itemEnter transition-all duration-150 hover:border-aleman-negro/30"
                              >
                                {/* Info ítem */}
                                <div className="flex items-start gap-2.5">
                                  <span className="w-6 h-6 rounded-sm bg-aleman-hueso text-aleman-negro font-bold flex items-center justify-center border border-aleman-negro/20 shrink-0 mt-0.5">
                                    {item.cantidad}x
                                  </span>
                                  <div>
                                    <div className="font-bold text-aleman-negro text-base">
                                      {item.nombre}
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <span className="text-xs text-aleman-negro/50 font-semibold">
                                        🕒 {item.horaEnvio || 'Enviado'}
                                      </span>
                                      {item.aclaracion && (
                                        <span className="text-xs text-amber-900 italic bg-amber-50 px-1.5 py-0.2 rounded-sm border border-amber-300 font-semibold">
                                          "{item.aclaracion}"
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Semáforo y Cambio de Estado */}
                                <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 flex-wrap">
                                  <span className="font-display font-bold text-aleman-negro text-lg">
                                    {formatCurrency(
                                      item.precioUnitario * item.cantidad
                                    )}
                                  </span>

                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {/* Icono Pop de Check al llegar a Entregado */}
                                    {isEntregado && (
                                      <span
                                        className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shadow-xs animate-popIn"
                                        title="Ítem entregado a la mesa"
                                      >
                                        ✓
                                      </span>
                                    )}

                                    {/* Selector rápido del semáforo */}
                                    <select
                                      value={item.estadoCocina}
                                      onChange={(e) =>
                                        handleCambiarEstadoCocinaItem(
                                          item.id,
                                          e.target.value
                                        )
                                      }
                                      className={`px-2.5 py-1.5 rounded-sm text-sm font-bold border transition-colors duration-200 cursor-pointer ${currentEstadoObj.badgeClass}`}
                                    >
                                      {ESTADOS_COCINA.map((est) => (
                                        <option key={est.key} value={est.key}>
                                          {est.icon} {est.label}
                                        </option>
                                      ))}
                                    </select>

                                    {/* Acciones de Editar / Eliminar para Dueño o Encargado */}
                                    {puedeModificarComanda && (
                                      <div className="flex items-center gap-1.5 ml-1">
                                        <button
                                          type="button"
                                          onClick={() => handleAbrirModalEditar(item)}
                                          className="w-8 h-8 flex items-center justify-center text-sm font-bold bg-white hover:bg-aleman-dorado/20 text-aleman-negro border border-aleman-negro/25 rounded-sm transition-colors cursor-pointer shadow-2xs"
                                          title="Editar ítem"
                                          aria-label="Editar ítem"
                                        >
                                          ✏️
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleAbrirModalEliminar(item)}
                                          className="w-8 h-8 flex items-center justify-center text-sm font-bold bg-red-50 hover:bg-red-100 text-aleman-rojo border border-aleman-rojo/30 rounded-sm transition-colors cursor-pointer shadow-2xs"
                                          title="Eliminar ítem"
                                          aria-label="Eliminar ítem"
                                        >
                                          🗑️
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          };

                          if (grupo.esPromo) {
                            const totalGrupo = grupo.items.reduce(
                              (sum, it) => sum + it.precioUnitario * it.cantidad,
                              0
                            );
                            return (
                              <div
                                key={grupo.grupoPromocionId || gIdx}
                                className="p-3 bg-amber-50/90 border-2 border-amber-300 rounded-sm space-y-2 my-1 shadow-2xs"
                              >
                                <div className="flex items-center justify-between border-b border-amber-200 pb-1.5 font-bold text-amber-950 text-xs">
                                  <span className="flex items-center gap-1.5">
                                    <span className="text-sm">🎉</span> Promo: {grupo.promocionNombre}
                                  </span>
                                  <span className="bg-amber-200/90 text-amber-950 px-2.5 py-0.5 rounded-full font-mono font-bold">
                                    Total: {formatCurrency(totalGrupo)}
                                  </span>
                                </div>
                                <div className="space-y-1.5">
                                  {grupo.items.map(renderSingleItem)}
                                </div>
                              </div>
                            );
                          }
                          return renderSingleItem(grupo.item);
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* ========================================================= */}
                {/* FOOTER DEL MODAL: CIERRE DE MESA */}
                {/* ========================================================= */}
                <div className="sticky bottom-0 bg-aleman-hueso pt-4 border-t-2 border-aleman-negro/10 mt-4 space-y-3 z-10">
                  <div className="bg-aleman-crema p-3 rounded-sm border border-aleman-negro/20 shadow-2xs">
                    {/* Indicador y Barra de Progreso de Platos Animada */}
                    <div>
                      <div className="flex items-center justify-between gap-2 text-sm font-semibold text-aleman-negro/70">
                        <span>Progreso de platos:</span>
                        <span className="font-bold text-aleman-negro">
                          {resumenCocinaMesa.entregados} de{' '}
                          {
                            mesaActual.pedido.filter((it) => it.enviadoACocina)
                              .length
                          }{' '}
                          entregados
                        </span>
                      </div>

                      {/* Barra de progreso visual con transición animada suave */}
                      {mesaActual.pedido.filter((it) => it.enviadoACocina).length > 0 && (
                        <div className="w-full h-2 bg-aleman-negro/15 rounded-full overflow-hidden mt-1.5 border border-aleman-negro/10">
                          <div
                            className="h-full bg-aleman-verde rounded-full transition-all duration-500 ease-out"
                            style={{
                              width: `${Math.round(
                                (resumenCocinaMesa.entregados /
                                  Math.max(
                                    1,
                                    mesaActual.pedido.filter((it) => it.enviadoACocina).length
                                  )) *
                                  100
                              )}%`,
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Acciones de cierre */}
                  <div className="flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setMesaSeleccionadaId(null)}
                        className="px-3.5 py-2 md:px-4 md:py-2.5 text-xs md:text-sm font-bold uppercase tracking-wider text-aleman-negro hover:bg-aleman-crema rounded-sm border border-aleman-negro/25 transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                      >
                        Volver al Plano
                      </button>
                      <button
                        type="button"
                        onClick={() => setVistaMobileMesa('cargar')}
                        className="md:hidden px-3 py-2 text-xs font-bold uppercase tracking-wider text-aleman-verde-dark bg-aleman-verde/15 hover:bg-aleman-verde/25 rounded-sm border border-aleman-verde/30 transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <span>➕</span> Agregar más
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleCerrarMesa}
                      disabled={!resumenCocinaMesa.puedeCerrar}
                      className={`px-4 py-2 md:px-6 md:py-2.5 rounded-sm text-xs md:text-sm font-bold uppercase tracking-wider transition-all duration-150 flex items-center gap-2 border ${
                        resumenCocinaMesa.puedeCerrar
                          ? 'bg-aleman-rojo hover:bg-aleman-rojo-dark text-aleman-hueso border-aleman-negro/40 cursor-pointer shadow-sm hover:scale-[1.02] active:scale-[0.98]'
                          : 'bg-aleman-crema text-aleman-negro/40 border-aleman-negro/20 cursor-not-allowed'
                      }`}
                      title={
                        resumenCocinaMesa.puedeCerrar
                          ? 'Cerrar mesa y liberar'
                          : 'Para cerrar, todos los ítems deben estar entregados y sin pendientes en el carrito'
                      }
                    >
                      <span>💰</span> Cerrar Mesa y Cobrar
                    </button>
                  </div>

                  {!resumenCocinaMesa.puedeCerrar &&
                    mesaActual.pedido.length > 0 && (
                      <p className="text-xs text-aleman-negro/50 text-right font-medium">
                        💡 Para cerrar la mesa, todos los ítems enviados deben estar marcados como "Entregado" y no debe haber ítems sin enviar.
                      </p>
                    )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: GESTIÓN DE SECTORES (ROL DUEÑO) */}
      {/* ========================================================= */}
      {isModalGestionSectoresOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-aleman-negro/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-aleman-hueso rounded-sm border-2 border-aleman-negro w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="px-6 py-4 bg-aleman-verde text-aleman-hueso border-b-2 border-aleman-dorado flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">⚙️</span>
                <div>
                  <h3 className="text-lg font-display font-bold uppercase tracking-wider">
                    Gestión de Sectores
                  </h3>
                  <span className="text-xs text-aleman-dorado font-bold">
                    Renombrar, reasignar mesas y eliminar sectores del salón
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalGestionSectoresOpen(false)}
                className="text-aleman-hueso/70 hover:text-aleman-hueso text-lg font-bold p-1 rounded transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              {/* Formulario rápido para crear nuevo sector */}
              <form
                onSubmit={handleCrearSectorDirecto}
                className="p-3.5 bg-aleman-crema rounded-sm border border-aleman-negro/20 flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
              >
                <div className="flex-1">
                  <label htmlFor="nuevoSectorDirecto" className="sr-only">
                    Nuevo sector
                  </label>
                  <input
                    id="nuevoSectorDirecto"
                    type="text"
                    placeholder="Nuevo sector (ej: Balcón, Barra, Jardín)..."
                    value={nombreNuevoSectorDirecto}
                    onChange={(e) => setNombreNuevoSectorDirecto(e.target.value)}
                    className="w-full px-3 py-2 bg-white border-2 border-aleman-negro/25 rounded-sm text-sm text-aleman-negro focus:border-aleman-verde focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!nombreNuevoSectorDirecto.trim()}
                  className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-sm border transition-colors flex items-center justify-center gap-1.5 shrink-0 ${
                    nombreNuevoSectorDirecto.trim()
                      ? 'bg-aleman-verde hover:bg-aleman-verde-dark text-aleman-hueso border-aleman-dorado cursor-pointer'
                      : 'bg-aleman-negro/10 text-aleman-negro/40 border-aleman-negro/20 cursor-not-allowed'
                  }`}
                >
                  <span>+</span> Agregar Sector
                </button>
              </form>

              {/* Panel de Reasignación Obligatoria cuando se intenta eliminar un sector con mesas */}
              {sectorParaEliminar && (
                <div className="p-4 bg-amber-50 rounded-sm border-2 border-amber-400 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <span className="text-2xl shrink-0">⚠️</span>
                    <div>
                      <h4 className="font-display font-bold text-base text-amber-900 uppercase tracking-wide">
                        Reasignación Obligatoria de Mesas
                      </h4>
                      <p className="text-xs text-amber-800 mt-0.5">
                        El sector <strong className="font-bold text-aleman-negro">«{sectorParaEliminar}»</strong> tiene{' '}
                        <strong className="font-bold text-aleman-negro">
                          {mesas.filter((m) => m.sector === sectorParaEliminar).length} mesa(s) asignada(s)
                        </strong>{' '}
                        (Mesas #{mesas.filter((m) => m.sector === sectorParaEliminar).map((m) => m.numero).join(', ')}).
                        No se puede eliminar directamente. Seleccioná a qué otro sector mover todas estas mesas:
                      </p>
                    </div>
                  </div>

                  {sectores.filter((s) => s !== sectorParaEliminar).length === 0 ? (
                    <div className="p-3 bg-white rounded-sm border border-amber-300 text-xs text-aleman-rojo font-bold">
                      No existen otros sectores disponibles a donde mover las mesas. Por favor creá un nuevo sector antes de eliminar este.
                    </div>
                  ) : (
                    <div className="space-y-3 pt-1">
                      <div>
                        <label className="block text-xs font-bold text-aleman-negro uppercase tracking-wider mb-1">
                          Mover mesas hacia el sector:
                        </label>
                        <select
                          value={sectorDestinoReasignar}
                          onChange={(e) => setSectorDestinoReasignar(e.target.value)}
                          className="w-full px-3 py-2 bg-white border-2 border-amber-400 rounded-sm text-sm font-semibold text-aleman-negro focus:outline-none"
                        >
                          {sectores
                            .filter((s) => s !== sectorParaEliminar)
                            .map((s) => (
                              <option key={s} value={s}>
                                📍 {s} ({mesas.filter((m) => m.sector === s).length} mesas actuales)
                              </option>
                            ))}
                        </select>
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-2 pt-1 border-t border-amber-300">
                        <button
                          type="button"
                          onClick={() => setSectorParaEliminar(null)}
                          className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-aleman-negro hover:bg-aleman-crema rounded-sm border border-aleman-negro/25 transition-colors cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleSoloReasignarMesas(sectorParaEliminar, sectorDestinoReasignar)
                          }
                          className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-aleman-negro bg-aleman-dorado hover:bg-aleman-dorado-light rounded-sm border border-aleman-negro/30 transition-colors cursor-pointer"
                          title="Mover las mesas dejando este sector con 0 mesas"
                        >
                          Solo Reasignar Mesas
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleReasignarYEliminarSector(
                              sectorParaEliminar,
                              sectorDestinoReasignar
                            )
                          }
                          className="px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-aleman-hueso bg-aleman-rojo hover:bg-aleman-rojo-dark rounded-sm border border-aleman-negro/40 transition-colors cursor-pointer shadow-xs"
                          title="Mover mesas y eliminar el sector vacío de inmediato"
                        >
                          Reasignar y Eliminar Sector
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Confirmación simple para eliminar sector vacío */}
              {confirmarEliminarVacio && (
                <div className="p-4 bg-aleman-crema rounded-sm border-2 border-aleman-rojo/50 space-y-3">
                  <div className="flex items-center gap-2 text-aleman-rojo font-bold text-sm">
                    <span>🗑️</span>
                    <span>¿Confirmar eliminación del sector «{confirmarEliminarVacio}»?</span>
                  </div>
                  <p className="text-xs text-aleman-negro/70">
                    Este sector no tiene mesas asignadas actualmente. Al eliminarlo, desaparecerá de los filtros y selectores del plano.
                  </p>
                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-aleman-negro/10">
                    <button
                      type="button"
                      onClick={() => setConfirmarEliminarVacio(null)}
                      className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-aleman-negro hover:bg-white rounded-sm border border-aleman-negro/25 transition-colors cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleConfirmarEliminarVacio(confirmarEliminarVacio)}
                      className="px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-aleman-hueso bg-aleman-rojo hover:bg-aleman-rojo-dark rounded-sm border border-aleman-negro/40 transition-colors cursor-pointer"
                    >
                      Sí, Eliminar Sector
                    </button>
                  </div>
                </div>
              )}

              {/* Listado de Sectores */}
              <div className="space-y-2">
                <div className="flex items-center justify-between pb-1 border-b border-aleman-negro/15">
                  <span className="text-xs font-bold uppercase tracking-wider text-aleman-negro/70">
                    Sectores del Salón ({sectores.length})
                  </span>
                  <span className="text-xs text-aleman-negro/50 font-semibold">
                    {mesas.length} mesas distribuidas en total
                  </span>
                </div>

                <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                  {sectores.map((sec) => {
                    const cantMesas = mesas.filter((m) => m.sector === sec).length;
                    const estaEnEdicion = sectorEnEdicion === sec;

                    return (
                      <div
                        key={sec}
                        className={`p-3 rounded-sm border-2 transition-all ${
                          estaEnEdicion
                            ? 'bg-aleman-crema border-aleman-dorado ring-2 ring-aleman-dorado/30'
                            : 'bg-white border-aleman-negro/20 hover:border-aleman-negro/40'
                        }`}
                      >
                        {estaEnEdicion ? (
                          /* Formulario inline para renombrar */
                          <div className="space-y-2.5">
                            <label className="block text-xs font-bold uppercase tracking-wider text-aleman-negro">
                              Renombrar sector:
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={nombreSectorEditado}
                                onChange={(e) => setNombreSectorEditado(e.target.value)}
                                className="flex-1 px-3 py-1.5 bg-white border-2 border-aleman-negro/30 rounded-sm text-sm font-bold text-aleman-negro focus:border-aleman-verde focus:outline-none"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleConfirmarRenombrarSector(sec);
                                  } else if (e.key === 'Escape') {
                                    handleCancelarRenombrarSector();
                                  }
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => handleConfirmarRenombrarSector(sec)}
                                className="px-3 py-1.5 bg-aleman-verde hover:bg-aleman-verde-dark text-aleman-hueso text-xs font-bold uppercase tracking-wider rounded-sm border border-aleman-dorado cursor-pointer"
                              >
                                Guardar
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelarRenombrarSector}
                                className="px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-aleman-negro hover:bg-aleman-crema rounded-sm border border-aleman-negro/25 cursor-pointer"
                              >
                                Cancelar
                              </button>
                            </div>
                            <span className="text-[11px] text-aleman-negro/60 block font-medium">
                              💡 Al renombrar, se actualizará automáticamente el sector de las {cantMesas} mesa(s) asociadas.
                            </span>
                          </div>
                        ) : (
                          /* Vista de fila normal */
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                            <div className="flex items-center gap-2.5">
                              <span className="text-base">📍</span>
                              <div>
                                <span className="font-display font-bold text-base text-aleman-negro">
                                  {sec}
                                </span>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span
                                    className={`text-[11px] font-bold px-2 py-0.5 rounded-xs border ${
                                      cantMesas > 0
                                        ? 'bg-aleman-verde/15 text-aleman-verde-dark border-aleman-verde/30'
                                        : 'bg-aleman-negro/10 text-aleman-negro/50 border-aleman-negro/20'
                                    }`}
                                  >
                                    {cantMesas === 1 ? '1 mesa asignada' : `${cantMesas} mesas asignadas`}
                                  </span>
                                  {cantMesas > 0 && (
                                    <span className="text-[11px] text-aleman-negro/50 hidden sm:inline">
                                      (Mesas: #{mesas.filter((m) => m.sector === sec).map((m) => m.numero).join(', ')})
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Acciones por sector */}
                            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                              <button
                                type="button"
                                onClick={() => handleIniciarRenombrarSector(sec)}
                                className="px-2.5 py-1.5 bg-aleman-hueso hover:bg-aleman-crema text-aleman-negro text-xs font-bold uppercase tracking-wider rounded-sm border border-aleman-negro/25 transition-colors flex items-center gap-1 cursor-pointer"
                                title={`Renombrar sector "${sec}"`}
                              >
                                <span>✏️</span> Renombrar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleIniciarEliminarSector(sec)}
                                className="px-2.5 py-1.5 bg-white hover:bg-red-50 text-aleman-rojo hover:text-aleman-rojo-dark text-xs font-bold uppercase tracking-wider rounded-sm border border-aleman-rojo/30 hover:border-aleman-rojo transition-colors flex items-center gap-1 cursor-pointer"
                                title={`Eliminar sector "${sec}"`}
                              >
                                <span>🗑️</span> Eliminar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-aleman-crema border-t-2 border-aleman-negro/15 flex items-center justify-between">
              <span className="text-xs text-aleman-negro/60 font-semibold">
                Rol actual: <strong>Dueño</strong> (Acceso completo)
              </span>
              <button
                type="button"
                onClick={() => setIsModalGestionSectoresOpen(false)}
                className="px-5 py-2 text-sm font-bold uppercase tracking-wider text-aleman-hueso bg-aleman-negro hover:bg-aleman-negro/80 rounded-sm border border-aleman-negro transition-colors cursor-pointer shadow-xs"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: ALTA DE MESAS POR CANTIDAD Y SECTOR (ROL DUEÑO) */}
      {/* ========================================================= */}
      {isModalCrearMesasOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-aleman-negro/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-aleman-hueso rounded-sm border-2 border-aleman-negro w-full max-w-md overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="px-6 py-4 bg-aleman-verde text-aleman-hueso border-b-2 border-aleman-dorado flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">🍽️</span>
                <div>
                  <h3 className="text-lg font-display font-bold uppercase tracking-wider">
                    Agregar Nuevas Mesas
                  </h3>
                  <span className="text-xs text-aleman-dorado font-bold">
                    Alta masiva por sector correlativo
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalCrearMesasOpen(false)}
                className="text-aleman-hueso/70 hover:text-aleman-hueso text-lg font-bold p-1 rounded transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleConfirmarCrearMesas} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-aleman-negro uppercase tracking-wider mb-1.5">
                  Cantidad de mesas a agregar *
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={crearCantidadMesas}
                  onChange={(e) =>
                    setCrearCantidadMesas(Math.max(1, Number(e.target.value) || 1))
                  }
                  required
                  className="w-full px-3.5 py-2.5 bg-white border-2 border-aleman-negro/25 rounded-sm text-base font-bold text-aleman-negro focus:border-aleman-verde focus:outline-none"
                />
                <span className="text-xs text-aleman-negro/60 font-semibold block mt-1">
                  Se numerarán correlativamente a partir de la Mesa #{mesas.reduce((m, x) => Math.max(m, Number(x.numero) || 0), 0) + 1}
                </span>
              </div>

              <div>
                <label className="block text-sm font-bold text-aleman-negro uppercase tracking-wider mb-1.5">
                  Sector *
                </label>
                <select
                  value={crearSectorMesa}
                  onChange={(e) => setCrearSectorMesa(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border-2 border-aleman-negro/25 rounded-sm text-base text-aleman-negro font-semibold focus:border-aleman-verde focus:outline-none"
                >
                  {sectores.map((sec) => (
                    <option key={sec} value={sec}>
                      📍 {sec}
                    </option>
                  ))}
                  <option value="__nuevo__">➕ Escribir un sector nuevo...</option>
                </select>
              </div>

              {crearSectorMesa === '__nuevo__' && (
                <div>
                  <label className="block text-sm font-bold text-aleman-negro uppercase tracking-wider mb-1.5">
                    Nombre del nuevo sector *
                  </label>
                  <input
                    type="text"
                    value={crearSectorNuevo}
                    onChange={(e) => setCrearSectorNuevo(e.target.value)}
                    placeholder="Ej: Terraza Exterior, Patio, Barra..."
                    required
                    className="w-full px-3.5 py-2.5 bg-white border-2 border-aleman-negro/25 rounded-sm text-base text-aleman-negro focus:border-aleman-verde focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-aleman-negro uppercase tracking-wider mb-1.5">
                  Capacidad por mesa (personas)
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={crearCapacidadMesa}
                  onChange={(e) =>
                    setCrearCapacidadMesa(Math.max(1, Number(e.target.value) || 1))
                  }
                  className="w-full px-3.5 py-2.5 bg-white border-2 border-aleman-negro/25 rounded-sm text-base font-bold text-aleman-negro focus:border-aleman-verde focus:outline-none"
                />
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t-2 border-aleman-negro/10">
                <button
                  type="button"
                  onClick={() => setIsModalCrearMesasOpen(false)}
                  className="px-4 py-2 text-sm font-bold uppercase tracking-wider text-aleman-negro hover:bg-aleman-crema rounded-sm border border-aleman-negro/25 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-bold uppercase tracking-wider text-aleman-hueso bg-aleman-rojo hover:bg-aleman-rojo-dark rounded-sm border border-aleman-negro/40 shadow-sm transition-colors cursor-pointer"
                >
                  Crear {crearCantidadMesas} Mesa{crearCantidadMesas > 1 ? 's' : ''}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL EDITAR ÍTEM DE COMANDA */}
      {/* ========================================================= */}
      {modalEditarItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-aleman-negro/70 backdrop-blur-xs animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalEditarItem(null);
          }}
        >
          <div
            className="bg-aleman-hueso rounded-sm border-2 border-aleman-negro max-w-md w-full shadow-2xl overflow-hidden animate-slideUp"
            role="dialog"
            aria-modal="true"
          >
            {/* Header */}
            <div className="bg-aleman-negro px-5 py-3.5 flex items-center justify-between border-b-2 border-aleman-dorado">
              <div className="flex items-center gap-2">
                <span className="text-xl">✏️</span>
                <h3 className="font-display font-bold text-aleman-hueso text-base uppercase tracking-wider">
                  Editar Ítem de Comanda
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalEditarItem(null)}
                className="text-aleman-hueso/70 hover:text-aleman-hueso text-lg font-bold p-1 rounded transition-colors cursor-pointer"
                title="Cerrar"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleConfirmarEdicionItem} className="p-5 space-y-4">
              {/* Info del ítem */}
              <div className="p-3 bg-aleman-crema border border-aleman-negro/20 rounded-sm flex items-center justify-between">
                <div>
                  <span className="font-bold text-aleman-negro block text-base">
                    {modalEditarItem.item.nombre}
                  </span>
                  <span className="text-xs text-aleman-negro/60 block">
                    Precio unitario: {formatCurrency(modalEditarItem.item.precioUnitario)}
                  </span>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-xs border bg-aleman-hueso border-aleman-negro/30 text-aleman-negro">
                  Mesa #{mesaActual?.numero}
                </span>
              </div>

              {/* Campo Cantidad */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-aleman-negro mb-1">
                  Cantidad *
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setModalEditarItem((prev) => {
                        const curr = parseInt(prev.nuevaCantidad, 10) || 1;
                        const next = Math.max(1, curr - 1);
                        return {
                          ...prev,
                          nuevaCantidad: next.toString(),
                          errorCantidad: '',
                        };
                      })
                    }
                    className="w-10 h-10 bg-aleman-crema hover:bg-aleman-dorado/30 text-aleman-negro font-bold text-lg rounded-sm border border-aleman-negro/30 flex items-center justify-center cursor-pointer transition-colors"
                  >
                    -
                  </button>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={modalEditarItem.nuevaCantidad}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const cleaned = e.target.value.replace(/\D/g, '');
                      if (cleaned === '') {
                        setModalEditarItem((prev) => ({
                          ...prev,
                          nuevaCantidad: '',
                          errorCantidad: '',
                        }));
                      } else {
                        const num = Math.min(99, parseInt(cleaned, 10));
                        setModalEditarItem((prev) => ({
                          ...prev,
                          nuevaCantidad: num.toString(),
                          errorCantidad: '',
                        }));
                      }
                    }}
                    onBlur={() => {
                      if (
                        !modalEditarItem.nuevaCantidad ||
                        parseInt(modalEditarItem.nuevaCantidad, 10) < 1
                      ) {
                        setModalEditarItem((prev) => ({
                          ...prev,
                          nuevaCantidad: '1',
                        }));
                      }
                    }}
                    className="flex-1 px-3 py-2 text-center text-base font-bold bg-white border border-aleman-negro/30 rounded-sm text-aleman-negro focus:outline-hidden focus:border-aleman-negro focus:ring-1 focus:ring-aleman-negro"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setModalEditarItem((prev) => {
                        const curr = parseInt(prev.nuevaCantidad, 10) || 1;
                        const next = Math.min(99, curr + 1);
                        return {
                          ...prev,
                          nuevaCantidad: next.toString(),
                          errorCantidad: '',
                        };
                      })
                    }
                    className="w-10 h-10 bg-aleman-crema hover:bg-aleman-dorado/30 text-aleman-negro font-bold text-lg rounded-sm border border-aleman-negro/30 flex items-center justify-center cursor-pointer transition-colors"
                  >
                    +
                  </button>
                </div>
                {modalEditarItem.errorCantidad && (
                  <p className="text-xs font-bold text-aleman-rojo mt-1">
                    {modalEditarItem.errorCantidad}
                  </p>
                )}
                <div className="mt-1 text-right text-xs text-aleman-negro/70 font-semibold">
                  Subtotal nuevo:{' '}
                  <span className="font-bold text-aleman-negro">
                    {formatCurrency(
                      modalEditarItem.item.precioUnitario *
                        (parseInt(modalEditarItem.nuevaCantidad, 10) || 0)
                    )}
                  </span>
                </div>
              </div>

              {/* Campo Aclaración / Nota */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-aleman-negro mb-1">
                  Aclaración / Nota del ítem
                </label>
                <input
                  type="text"
                  value={modalEditarItem.nuevaAclaracion}
                  onChange={(e) =>
                    setModalEditarItem((prev) => ({
                      ...prev,
                      nuevaAclaracion: e.target.value,
                    }))
                  }
                  placeholder="Ej: Sin sal, bien cocido, salsa aparte..."
                  className="w-full px-3 py-2 text-sm bg-white border border-aleman-negro/30 rounded-sm text-aleman-negro placeholder-aleman-negro/40 focus:outline-hidden focus:border-aleman-negro focus:ring-1 focus:ring-aleman-negro"
                />
              </div>

              {/* Campo Motivo OBLIGATORIO SOLO si rol Encargado */}
              {esEncargado && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-sm space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold uppercase tracking-wider text-amber-950">
                      Motivo de la modificación <span className="text-aleman-rojo">*</span>
                    </label>
                    <span className="text-[11px] font-bold text-amber-900 uppercase">
                      Requerido (Encargado)
                    </span>
                  </div>
                  <textarea
                    rows={2}
                    value={modalEditarItem.motivo}
                    onChange={(e) =>
                      setModalEditarItem((prev) => ({
                        ...prev,
                        motivo: e.target.value,
                        errorMotivo: '',
                      }))
                    }
                    placeholder="Explicá por qué se modifica este ítem (obligatorio)..."
                    className="w-full px-3 py-2 text-sm bg-white border border-amber-400 rounded-sm text-aleman-negro placeholder-amber-900/40 focus:outline-hidden focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
                  />
                  {modalEditarItem.errorMotivo && (
                    <p className="text-xs font-bold text-aleman-rojo">
                      ⚠️ {modalEditarItem.errorMotivo}
                    </p>
                  )}
                </div>
              )}

              {/* Footer Acciones */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-aleman-negro/15">
                <button
                  type="button"
                  onClick={() => setModalEditarItem(null)}
                  className="px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-aleman-negro hover:bg-aleman-crema rounded-sm border border-aleman-negro/30 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-aleman-negro bg-aleman-dorado hover:bg-aleman-dorado-light rounded-sm border border-aleman-negro/40 shadow-xs transition-colors cursor-pointer"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL ELIMINAR ÍTEM DE COMANDA */}
      {/* ========================================================= */}
      {modalEliminarItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-aleman-negro/70 backdrop-blur-xs animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalEliminarItem(null);
          }}
        >
          <div
            className="bg-aleman-hueso rounded-sm border-2 border-aleman-negro max-w-md w-full shadow-2xl overflow-hidden animate-slideUp"
            role="dialog"
            aria-modal="true"
          >
            {/* Header */}
            <div className="bg-aleman-rojo px-5 py-3.5 flex items-center justify-between border-b-2 border-aleman-negro">
              <div className="flex items-center gap-2">
                <span className="text-xl">🗑️</span>
                <h3 className="font-display font-bold text-aleman-hueso text-base uppercase tracking-wider">
                  Eliminar Ítem de Comanda
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalEliminarItem(null)}
                className="text-aleman-hueso/70 hover:text-aleman-hueso text-lg font-bold p-1 rounded transition-colors cursor-pointer"
                title="Cerrar"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleConfirmarEliminacionItem} className="p-5 space-y-4">
              <div className="p-3 bg-red-50 border border-aleman-rojo/30 rounded-sm space-y-1">
                <p className="text-sm font-bold text-aleman-negro">
                  ¿Confirmás que deseás quitar este ítem de la comanda?
                </p>
                <div className="text-sm text-aleman-rojo font-bold flex items-center justify-between pt-1">
                  <span>
                    {modalEliminarItem.item.cantidad}x {modalEliminarItem.item.nombre}
                  </span>
                  <span>
                    -
                    {formatCurrency(
                      modalEliminarItem.item.precioUnitario * modalEliminarItem.item.cantidad
                    )}
                  </span>
                </div>
                {modalEliminarItem.item.enviadoACocina && (
                  <span className="block text-xs text-amber-900 font-semibold pt-1">
                    ⚠️ Este ítem ya fue enviado a cocina (Estado: {modalEliminarItem.item.estadoCocina}).
                  </span>
                )}
              </div>

              {/* Campo Motivo OBLIGATORIO SOLO si rol Encargado */}
              {esEncargado && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-sm space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold uppercase tracking-wider text-amber-950">
                      Motivo de la eliminación <span className="text-aleman-rojo">*</span>
                    </label>
                    <span className="text-[11px] font-bold text-amber-900 uppercase">
                      Requerido (Encargado)
                    </span>
                  </div>
                  <textarea
                    rows={2}
                    value={modalEliminarItem.motivo}
                    onChange={(e) =>
                      setModalEliminarItem((prev) => ({
                        ...prev,
                        motivo: e.target.value,
                        errorMotivo: '',
                      }))
                    }
                    placeholder="Explicá por qué se quita este ítem (obligatorio)..."
                    className="w-full px-3 py-2 text-sm bg-white border border-amber-400 rounded-sm text-aleman-negro placeholder-amber-900/40 focus:outline-hidden focus:border-amber-600 focus:ring-1 focus:ring-amber-600"
                  />
                  {modalEliminarItem.errorMotivo && (
                    <p className="text-xs font-bold text-aleman-rojo">
                      ⚠️ {modalEliminarItem.errorMotivo}
                    </p>
                  )}
                </div>
              )}

              {/* Footer Acciones */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-aleman-negro/15">
                <button
                  type="button"
                  onClick={() => setModalEliminarItem(null)}
                  className="px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-aleman-negro hover:bg-aleman-crema rounded-sm border border-aleman-negro/30 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-aleman-hueso bg-aleman-rojo hover:bg-aleman-rojo-dark rounded-sm border border-aleman-negro/40 shadow-xs transition-colors cursor-pointer"
                >
                  Sí, Eliminar Ítem
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: EDITAR MESA EXISTENTE (ROL DUEÑO, SOLO LIBRES) */}
      {/* ========================================================= */}
      {mesaAEditar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-aleman-negro/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-aleman-hueso rounded-sm border-2 border-aleman-negro w-full max-w-md overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="px-6 py-4 bg-aleman-verde text-aleman-hueso border-b-2 border-aleman-dorado flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">✏️</span>
                <div>
                  <h3 className="text-lg font-display font-bold uppercase tracking-wider">
                    Editar Mesa #{mesaAEditar.numero}
                  </h3>
                  <span className="text-xs text-aleman-dorado font-bold">
                    Modificar sector o número de mesa libre
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMesaAEditar(null)}
                className="text-aleman-hueso/70 hover:text-aleman-hueso text-lg font-bold p-1 rounded transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleConfirmarEditarMesa} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-aleman-negro uppercase tracking-wider mb-1.5">
                  Número de Mesa *
                </label>
                <input
                  type="number"
                  min="1"
                  value={editNumeroMesa}
                  onChange={(e) => setEditNumeroMesa(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-white border-2 border-aleman-negro/25 rounded-sm text-base font-bold text-aleman-negro focus:border-aleman-verde focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-aleman-negro uppercase tracking-wider mb-1.5">
                  Sector *
                </label>
                <select
                  value={editSectorMesa}
                  onChange={(e) => setEditSectorMesa(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border-2 border-aleman-negro/25 rounded-sm text-base text-aleman-negro font-semibold focus:border-aleman-verde focus:outline-none"
                >
                  {sectores.map((sec) => (
                    <option key={sec} value={sec}>
                      📍 {sec}
                    </option>
                  ))}
                  <option value="__nuevo__">➕ Escribir un sector nuevo...</option>
                </select>
              </div>

              {editSectorMesa === '__nuevo__' && (
                <div>
                  <label className="block text-sm font-bold text-aleman-negro uppercase tracking-wider mb-1.5">
                    Nombre del nuevo sector *
                  </label>
                  <input
                    type="text"
                    value={editSectorNuevo}
                    onChange={(e) => setEditSectorNuevo(e.target.value)}
                    placeholder="Ej: Terraza VIP, Balcón..."
                    required
                    className="w-full px-3.5 py-2.5 bg-white border-2 border-aleman-negro/25 rounded-sm text-base text-aleman-negro focus:border-aleman-verde focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-aleman-negro uppercase tracking-wider mb-1.5">
                  Capacidad (personas)
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={editCapacidadMesa}
                  onChange={(e) =>
                    setEditCapacidadMesa(Math.max(1, Number(e.target.value) || 1))
                  }
                  className="w-full px-3.5 py-2.5 bg-white border-2 border-aleman-negro/25 rounded-sm text-base font-bold text-aleman-negro focus:border-aleman-verde focus:outline-none"
                />
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t-2 border-aleman-negro/10">
                <button
                  type="button"
                  onClick={() => setMesaAEditar(null)}
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

      {/* ========================================================= */}
      {/* MODAL: SELECCIÓN DE MEDIO DE PAGO AL CERRAR MESA */}
      {/* ========================================================= */}
      {modalCobroMesa && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-aleman-negro/75 backdrop-blur-xs overflow-y-auto">
          <div className="bg-aleman-hueso rounded-sm border-2 border-aleman-negro w-full max-w-md overflow-hidden shadow-2xl relative">
            {/* Header */}
            <div className="px-6 py-4 bg-aleman-verde text-aleman-hueso border-b-2 border-aleman-dorado flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">💰</span>
                <div>
                  <h3 className="text-lg font-display font-bold uppercase tracking-wider">
                    Cobro de Mesa #{modalCobroMesa.mesa.numero}
                  </h3>
                  <span className="text-sm text-aleman-dorado font-bold">
                    {modalCobroMesa.mesa.sector}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalCobroMesa(null)}
                className="text-aleman-hueso/70 hover:text-aleman-hueso text-lg font-bold p-1 rounded transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleConfirmarCobroYCierreMesa} className="p-6 space-y-5">
              <div className="p-4 bg-aleman-crema border-2 border-aleman-negro/20 rounded-sm text-center">
                <span className="text-sm font-bold text-aleman-negro/70 uppercase tracking-wider block">
                  Total a Cobrar
                </span>
                <span className="text-3xl font-display font-bold text-aleman-negro mt-1 block">
                  {formatCurrency(modalCobroMesa.total)}
                </span>
              </div>

              <div>
                <label className="block text-sm font-bold text-aleman-negro uppercase tracking-wider mb-2">
                  Seleccioná el Medio de Pago *
                </label>
                <div className="grid grid-cols-1 gap-2.5">
                  {[
                    { id: 'efectivo', label: '💵 Efectivo', desc: 'Pago en billetes en caja' },
                    { id: 'debito_credito', label: '💳 Tarjeta Débito / Crédito', desc: 'Terminal POS / Posnet' },
                    { id: 'transferencia', label: '📱 Transferencia / Mercado Pago', desc: 'QR o transferencia bancaria' },
                  ].map((op) => (
                    <label
                      key={op.id}
                      className={`flex items-center justify-between p-3 rounded-sm border-2 cursor-pointer transition-all ${
                        modalCobroMesa.medioPago === op.id
                          ? 'border-aleman-dorado bg-aleman-dorado/15'
                          : 'border-aleman-negro/20 hover:border-aleman-negro/40 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="medioPagoMesa"
                          value={op.id}
                          checked={modalCobroMesa.medioPago === op.id}
                          onChange={(e) =>
                            setModalCobroMesa({
                              ...modalCobroMesa,
                              medioPago: e.target.value,
                            })
                          }
                          className="text-aleman-verde focus:ring-aleman-verde"
                        />
                        <div>
                          <span className="font-bold text-sm text-aleman-negro block">
                            {op.label}
                          </span>
                          <span className="text-xs text-aleman-negro/60 block font-medium">
                            {op.desc}
                          </span>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t-2 border-aleman-negro/10">
                <button
                  type="button"
                  onClick={() => setModalCobroMesa(null)}
                  className="px-4 py-2 text-sm font-bold uppercase tracking-wider text-aleman-negro hover:bg-aleman-crema rounded-sm border border-aleman-negro/25 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-bold uppercase tracking-wider text-aleman-hueso bg-aleman-rojo hover:bg-aleman-rojo-dark rounded-sm border border-aleman-negro/40 transition-colors cursor-pointer shadow-sm"
                >
                  Confirmar Cobro y Cerrar Mesa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Vista Previa de Impresión */}
      <ModalPreviaImpresion
        isOpen={Boolean(modalImpresionData)}
        onClose={() => setModalImpresionData(null)}
        datos={modalImpresionData}
      />
    </div>
  );
}
