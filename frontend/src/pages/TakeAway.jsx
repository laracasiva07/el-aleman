import { useState, useMemo, useEffect, Fragment } from 'react';
import { useAuth } from '../context/useAuth';
import apiClient from '../services/apiClient';
import ModalPreviaImpresion from '../components/ModalPreviaImpresion';
import {
  mockProductos,
  mockPromociones,
  mockCategorias,
  formatCurrency,
  registrarOActualizarCliente,
  agregarPedidoAlHistorialCliente,
  registrarMovimientoCaja,
  calcularDesgloseComidaBebida,
} from '../services/mockData';

// Configuración de los 3 estados del pedido Take Away (Retiro en local)
const ESTADOS_TAKEAWAY = [
  {
    key: 'cocina',
    label: 'Cocina',
    icon: '🍳',
    checkpointIcon: '🔔',
    colorText: 'text-amber-900',
    colBgHeader: 'bg-amber-100 text-amber-900 border-amber-300',
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-300 font-semibold',
    siguienteEstado: 'listo',
    btnSiguienteTexto: '🛍️ Marcar Listo para Retiro',
  },
  {
    key: 'listo',
    label: 'Listo para Retiro',
    icon: '🛍️',
    checkpointIcon: '🛍️',
    colorText: 'text-blue-900',
    colBgHeader: 'bg-blue-100 text-blue-900 border-blue-300',
    badgeClass: 'bg-blue-100 text-blue-900 border-blue-300 font-semibold animate-pulse',
    siguienteEstado: 'entregado',
    btnSiguienteTexto: '✅ Marcar Retirado / Entregado',
  },
  {
    key: 'entregado',
    label: 'Entregado / Retirado',
    icon: '✅',
    checkpointIcon: '✅',
    colorText: 'text-emerald-950',
    colBgHeader: 'bg-emerald-100 text-emerald-950 border-emerald-400',
    badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-400 font-bold',
    siguienteEstado: null,
    btnSiguienteTexto: null,
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

// Pedidos iniciales mockeados de ejemplo en distintos estados
const mockPedidosTakeAwayIniciales = [
  {
    id: 'TK-201',
    sucursalId: 'sucursal-1',
    numero: 201,
    cliente: 'Nicolás Vázquez',
    telefono: '11-2233-4455',
    horaRetiroEstimada: '20:30',
    notas: 'Paga con Mercado Pago al retirar',
    estado: 'cocina',
    horaCreacion: '20:10',
    historialEstados: [
      { estado: 'cocina', hora: '20:10', nota: 'Pedido recibido en cocina' },
    ],
    items: [
      {
        id: 'it-tk1',
        tipo: 'producto',
        nombre: 'Pizza Especial Jamón y Morrones',
        precioUnitario: 9800,
        cantidad: 1,
        aclaracion: 'Bien tostada la masa',
      },
    ],
  },
  {
    id: 'TK-202',
    sucursalId: 'sucursal-1',
    numero: 202,
    cliente: 'Camila Domínguez',
    telefono: '11-6677-8899',
    horaRetiroEstimada: '20:15',
    notas: 'Esperando en mostrador del local',
    estado: 'listo',
    horaCreacion: '19:50',
    historialEstados: [
      { estado: 'cocina', hora: '19:50', nota: 'Pedido recibido en cocina' },
      { estado: 'listo', hora: '20:10', nota: 'Listo en mostrador para entregar' },
    ],
    items: [
      {
        id: 'it-tk2',
        tipo: 'promocion',
        nombre: 'Combo Individual: Muzza + Coca-Cola',
        precioUnitario: 8200,
        cantidad: 1,
        aclaracion: 'Gaseosa bien fría',
      },
    ],
  },
  {
    id: 'TK-203',
    sucursalId: 'sucursal-1',
    numero: 203,
    cliente: 'Federico Rossi',
    telefono: '11-4455-6677',
    horaRetiroEstimada: '20:45',
    notas: 'Pasa a retirar el hijo',
    estado: 'cocina',
    horaCreacion: '20:00',
    historialEstados: [
      { estado: 'cocina', hora: '20:00', nota: 'Pedido en cocina' },
    ],
    items: [
      {
        id: 'it-tk3',
        tipo: 'producto',
        nombre: 'Empanada de Carne Criolla',
        precioUnitario: 1500,
        cantidad: 12,
        aclaracion: 'Poner servilletas extra',
      },
      {
        id: 'it-tk4',
        tipo: 'producto',
        nombre: 'Coca-Cola 500ml',
        precioUnitario: 2200,
        cantidad: 2,
        aclaracion: '',
      },
    ],
  },
  {
    id: 'TK-204',
    sucursalId: 'sucursal-1',
    numero: 204,
    cliente: 'Paula Benítez',
    telefono: '11-9988-7766',
    horaRetiroEstimada: '19:30',
    notas: 'Pagado en efectivo',
    estado: 'entregado',
    horaCreacion: '19:15',
    historialEstados: [
      { estado: 'cocina', hora: '19:15', nota: 'Pedido en cocina' },
      { estado: 'listo', hora: '19:32', nota: 'Listo en mostrador' },
      { estado: 'entregado', hora: '19:35', nota: 'Retirado por el cliente' },
    ],
    items: [
      {
        id: 'it-tk5',
        tipo: 'producto',
        nombre: 'Pizza Muzzarella Tradicional',
        precioUnitario: 7500,
        cantidad: 1,
        aclaracion: '',
      },
    ],
  },
];

export default function TakeAway() {
  const { user } = useAuth();
  const esDueno = user?.rol === 'dueno';
  const esEncargado = user?.rol === 'encargado';
  const puedeModificarComanda = esDueno || esEncargado;

  const [pedidos, setPedidos] = useState([]);
  const [productos, setProductos] = useState([]);
  const [promociones, setPromociones] = useState([]);

  // Filtros y modo de visualización
  const [filtroEstado, setFiltroEstado] = useState('todos'); // 'todos' | 'cocina' | 'listo' | 'entregado'
  const [vistaModo, setVistaModo] = useState('camino'); // 'camino' | 'lista'
  const [busqueda, setBusqueda] = useState('');

  // Carga completa de pedidos desde backend
  const cargarDatosTakeAway = async () => {
    try {
      const endpointPedidos = '/pedidos-takeaway?incluirCerrados=true';

      const [resTK, resProd, resPromos] = await Promise.all([
        apiClient.get(endpointPedidos).catch(() => ({ data: { pedidos: [] } })),
        apiClient.get('/productos').catch(() => ({ data: { productos: [] } })),
        apiClient.get('/promociones').catch(() => ({ data: { promociones: [] } })),
      ]);

      setPromociones(resPromos.data?.promociones || []);

      const listProd = (resProd.data?.productos || []).map((p) => ({
        id: p._id || p.id,
        _id: p._id || p.id,
        nombre: p.nombre,
        precioVenta: p.precioVenta,
        categoriaNombre: typeof p.categoriaId === 'object' ? p.categoriaId?.nombre : 'General',
      }));
      setProductos(listProd.length > 0 ? listProd : mockProductos);

      const listTK = (resTK.data?.pedidos || []).map((p, idx) => {
        const cliObj = typeof p.clienteId === 'object' ? p.clienteId : null;
        const horaStr = p.createdAt
          ? new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : '20:10';

        const stRaw = p.estadoTakeaway || p.estado || 'cocina';
        const st = (stRaw === 'pendiente' || stRaw === 'en_preparacion') ? 'cocina' : stRaw;

        return {
          id: p._id || p.id,
          _id: p._id || p.id,
          numero: p.numero || idx + 201,
          cliente: cliObj ? cliObj.nombre : 'Cliente Takeaway',
          telefono: cliObj ? cliObj.telefono : '',
          horaRetiroEstimada: p.horarioEstimado || p.horaRetiroEstimada || 'Lo antes posible',
          horarioEstimado: p.horarioEstimado || p.horaRetiroEstimada || '',
          notas: '',
          estado: st,
          estadoPago: p.estadoPago || 'pendiente',
          medioPago: p.medioPago || '',
          horaCreacion: horaStr,
          historialEstados: [
            { estado: st, hora: horaStr, nota: `Estado actual: ${st}` },
          ],
          items: (p.items || []).filter((i) => !i.eliminado).map((i) => {
            const prodObj = typeof i.productoId === 'object' ? i.productoId : null;
            return {
              id: i._id || i.id,
              _id: i._id || i.id,
              productoId: prodObj ? prodObj._id : i.productoId,
              nombre: i.nombreProducto || prodObj?.nombre || 'Producto',
              precioUnitario: i.precioUnitario || prodObj?.precioVenta || 0,
              cantidad: i.cantidad || 1,
              aclaracion: i.aclaraciones || '',
              enviadoComanda: i.enviadoComanda || false,
              estado: i.estado || 'pendiente',
              grupoPromocionId: i.grupoPromocionId || null,
              promocionNombre: i.promocionNombre || null,
            };
          }),
        };
      });

      setPedidos(listTK);
    } catch {
      showToast('Error al cargar pedidos de takeaway desde el servidor');
    }
  };

  useEffect(() => {
    cargarDatosTakeAway();
  }, []);

  // Modales
  const [isModalNuevoOpen, setIsModalNuevoOpen] = useState(false);
  const [pedidoDetalleId, setPedidoDetalleId] = useState(null);
  const [modalCobroTakeAway, setModalCobroTakeAway] = useState(null); // { pedido, total, medioPago }
  const [isSubmittingCobro, setIsSubmittingCobro] = useState(false);
  const [modalImpresionData, setModalImpresionData] = useState(null);
  const [modalEditarItem, setModalEditarItem] = useState(null); // { item, index, nuevaCantidad, nuevaAclaracion, motivo, errorMotivo, errorCantidad }
  const [modalEliminarItem, setModalEliminarItem] = useState(null); // { item, index, motivo, errorMotivo }
  const [, setHistorialModificaciones] = useState([]);

  // Formulario Nuevo Pedido Take Away
  const [nuevoCliente, setNuevoCliente] = useState('');
  const [nuevoTelefono, setNuevoTelefono] = useState('');
  const [nuevaHoraRetiro, setNuevaHoraRetiro] = useState('');
  const [nuevasNotas, setNuevasNotas] = useState('');
  const [carritoItems, setCarritoItems] = useState([]);

  // Builder de items en modal
  const [tipoSeleccionItem, setTipoSeleccionItem] = useState('productos'); // 'productos' | 'promociones'
  const [categoriaFiltro, setCategoriaFiltro] = useState('todas');
  const [busquedaItem, setBusquedaItem] = useState('');
  const [itemIdSeleccionado, setItemIdSeleccionado] = useState('');
  const [cantidadItem, setCantidadItem] = useState(1);
  const [aclaracionItem, setAclaracionItem] = useState('');

  // Toast
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Pedido activo en modal de detalle
  const pedidoActual = useMemo(() => {
    return pedidos.find((p) => p.id === pedidoDetalleId) || null;
  }, [pedidos, pedidoDetalleId]);

  // Calcular total de un pedido
  const calcularTotalPedido = (pedido) => {
    if (!pedido || !Array.isArray(pedido.items)) return 0;
    return pedido.items.reduce((sum, it) => {
      const p = Number(it.precioUnitario) || 0;
      const c = Number(it.cantidad) || 1;
      return sum + p * c;
    }, 0);
  };

  // =========================================================
  // AVANZAR ESTADO DEL SEMÁFORO TAKE AWAY (INTERCEPTA RETIRADO PARA COBRO)
  // =========================================================

  const handleAvanzarEstado = async (pedidoId, nuevoEstadoDirecto = null) => {
    const ped = pedidos.find((p) => p.id === pedidoId || p._id === pedidoId);
    if (!ped) return;

    let proximoEstado = nuevoEstadoDirecto;
    if (!proximoEstado) {
      const configEstadoActual = ESTADOS_TAKEAWAY.find(
        (e) => e.key === ped.estado
      );
      proximoEstado = configEstadoActual?.siguienteEstado || ped.estado;
    }

    if (proximoEstado === 'entregado') {
      if (ped.estadoPago !== 'pagado') {
        const total = calcularTotalPedido(ped);
        setModalCobroTakeAway({
          pedido: ped,
          total,
          medioPago: 'efectivo',
        });
        return;
      }
    }

    try {
      const pedId = ped._id || ped.id;
      await apiClient.patch(`/pedidos-takeaway/${pedId}/estado`, {
        estado: proximoEstado,
      });
      const lbl = ESTADOS_TAKEAWAY.find((e) => e.key === proximoEstado)?.label || proximoEstado;
      showToast(`Estado del pedido actualizado a "${lbl}"`);
      await cargarDatosTakeAway();
    } catch (err) {
      alert(err.response?.data?.mensaje || 'Error al actualizar el estado del pedido');
    }
  };

  const handleConfirmarCobroTakeAway = async (e) => {
    e?.preventDefault();
    if (!modalCobroTakeAway || isSubmittingCobro) return;

    const { pedido, medioPago } = modalCobroTakeAway;
    const targetId = pedido._id || pedido.id;
    const medioPagoFormateado = (medioPago === 'tarjeta' || medioPago === 'debito_credito')
      ? 'debito_credito'
      : (medioPago === 'transferencia' ? 'transferencia' : 'efectivo');

    setIsSubmittingCobro(true);

    try {
      await apiClient.post(`/pedidos-takeaway/${targetId}/cerrar`, {
        medioPago: medioPagoFormateado,
      });

      const numPed = pedido.numero;
      setModalCobroTakeAway(null);
      setPedidoDetalleId(null);
      showToast(`✅ Pedido Take Away #${numPed} marcado como Retirado y cobrado (${medioPagoFormateado})`);
      await cargarDatosTakeAway();
    } catch (err) {
      setModalCobroTakeAway(null);
      setPedidoDetalleId(null);
      if (err.response?.status === 409) {
        alert('⚠️ No hay un turno de caja abierto.\n\nPor favor, ingresá al módulo de Caja y abrí un turno antes de cobrar el pedido.');
      } else {
        const errorMsg = err.response?.data?.mensaje || 'Error al cerrar pedido de takeaway';
        alert(errorMsg);
      }
      await cargarDatosTakeAway();
    } finally {
      setIsSubmittingCobro(false);
    }
  };

  // =========================================================
  // EDICIÓN Y ELIMINACIÓN DE ÍTEMS DE COMANDA (DUEÑO Y ENCARGADO)
  // =========================================================

  const handleAbrirModalEditar = (item, index) => {
    setModalEditarItem({
      item,
      index,
      nuevaCantidad: item.cantidad || 1,
      nuevaAclaracion: item.aclaracion || '',
      motivo: '',
      errorMotivo: '',
      errorCantidad: '',
    });
  };

  const handleAbrirModalEliminar = (item, index) => {
    setModalEliminarItem({
      item,
      index,
      motivo: '',
      errorMotivo: '',
    });
  };

  const handleConfirmarEdicionItem = async (e) => {
    e?.preventDefault();
    if (!modalEditarItem || !pedidoActual) return;

    const { item, nuevaCantidad, nuevaAclaracion, motivo } = modalEditarItem;
    const cantNum = parseInt(nuevaCantidad, 10);

    if (isNaN(cantNum) || cantNum <= 0) {
      setModalEditarItem((prev) => ({
        ...prev,
        errorCantidad: 'La cantidad debe ser mayor a 0.',
      }));
      return;
    }

    if (esEncargado && !motivo.trim()) {
      setModalEditarItem((prev) => ({
        ...prev,
        errorMotivo: 'El motivo es obligatorio para el rol encargado.',
      }));
      return;
    }

    try {
      await apiClient.put(
        `/pedidos-takeaway/${pedidoActual._id || pedidoActual.id}/items/${item._id || item.id}`,
        {
          cantidad: cantNum,
          aclaraciones: nuevaAclaracion.trim(),
          motivo: motivo.trim(),
        }
      );
      showToast(`✏️ Ítem "${item.nombre}" actualizado.`);
      setModalEditarItem(null);
      cargarDatosTakeAway();
    } catch (err) {
      const msg = err.response?.data?.mensaje || 'Error al editar ítem';
      setModalEditarItem((prev) => ({ ...prev, errorMotivo: msg }));
      alert(msg);
    }
  };

  const handleConfirmarEliminacionItem = async (e) => {
    e?.preventDefault();
    if (!modalEliminarItem || !pedidoActual) return;

    const { item, motivo } = modalEliminarItem;

    if (esEncargado && !motivo.trim()) {
      setModalEliminarItem((prev) => ({
        ...prev,
        errorMotivo: 'El motivo es obligatorio para el rol encargado.',
      }));
      return;
    }

    try {
      await apiClient.delete(
        `/pedidos-takeaway/${pedidoActual._id || pedidoActual.id}/items/${item._id || item.id}`,
        {
          data: { motivo: motivo.trim() },
        }
      );
      showToast(`🗑️ Ítem "${item.nombre}" eliminado del pedido.`);
      setModalEliminarItem(null);
      cargarDatosTakeAway();
    } catch (err) {
      const msg = err.response?.data?.mensaje || 'Error al eliminar ítem';
      setModalEliminarItem((prev) => ({ ...prev, errorMotivo: msg }));
      alert(msg);
    }
  };

  // =========================================================
  // CARGA DE NUEVO PEDIDO TAKE AWAY
  // =========================================================

  const handleOpenNuevoPedidoModal = () => {
    setNuevoCliente('');
    setNuevoTelefono('');
    setNuevaHoraRetiro('');
    setNuevasNotas('');
    setCarritoItems([]);
    setTipoSeleccionItem('productos');
    setCategoriaFiltro('todas');
    setBusquedaItem('');
    const listaProdUsar = productos.length > 0 ? productos : mockProductos;
    const primerId = listaProdUsar[0]?._id || listaProdUsar[0]?.id || '';
    setItemIdSeleccionado(String(primerId));
    setCantidadItem(1);
    setAclaracionItem('');
    setIsModalNuevoOpen(true);
  };

  const handleAgregarItemAlCarrito = (e) => {
    e.preventDefault();

    let itemInfo;
    if (tipoSeleccionItem === 'promociones') {
      const promo = promociones.find(
        (p) => String(p._id || p.id) === String(itemIdSeleccionado)
      );
      if (!promo) {
        alert('Seleccioná una promoción válida.');
        return;
      }
      itemInfo = {
        tipo: 'promocion',
        promocionId: promo._id || promo.id,
        itemId: promo._id || promo.id,
        nombre: promo.nombre,
        precioUnitario: promo.precioFijo,
        categoria: 'Promoción',
      };
    } else {
      const listaProdUsar = productos.length > 0 ? productos : mockProductos;
      const prod = listaProdUsar.find(
        (p) => String(p._id || p.id) === String(itemIdSeleccionado)
      );

      if (!prod) {
        alert('Seleccioná un producto válido.');
        return;
      }

      itemInfo = {
        tipo: 'producto',
        productoId: prod._id || prod.id,
        itemId: prod._id || prod.id,
        nombre: prod.nombre,
        precioUnitario: prod.precioVenta,
        categoria: prod.categoriaNombre || 'General',
      };
    }

    const cant = Math.max(1, Number(cantidadItem) || 1);

    const nuevoItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      ...itemInfo,
      cantidad: cant,
      aclaracion: aclaracionItem.trim(),
    };

    setCarritoItems((prev) => [...prev, nuevoItem]);
    setAclaracionItem('');
    setCantidadItem(1);
  };

  const handleQuitarItemCarrito = (itemId) => {
    setCarritoItems((prev) => prev.filter((it) => it.id !== itemId));
  };

  const handleCrearPedidoTakeAway = async (e) => {
    e.preventDefault();

    if (carritoItems.length === 0) {
      alert('Debes agregar al menos un plato o combo al pedido.');
      return;
    }

    try {
      const payload = {
        nombreCliente: nuevoCliente.trim(),
        telefono: nuevoTelefono.trim(),
        horaRetiroEstimada: nuevaHoraRetiro.trim(),
        horarioEstimado: nuevaHoraRetiro.trim(),
        items: carritoItems.map((it) => {
          if (it.tipo === 'promocion') {
            return {
              promocionId: it.promocionId || it.itemId || it.id,
              cantidad: it.cantidad,
              aclaraciones: it.aclaracion || '',
            };
          }
          return {
            productoId: it.productoId || it.itemId || it.id,
            cantidad: it.cantidad,
            aclaraciones: it.aclaracion || '',
          };
        }),
      };

      await apiClient.post('/pedidos-takeaway', payload);
      showToast('🛍️ Pedido Take Away creado exitosamente');
      setIsModalNuevoOpen(false);
      cargarDatosTakeAway();
    } catch (err) {
      alert(err.response?.data?.mensaje || 'Error al crear el pedido de takeaway');
    }
  };

  // =========================================================
  // SIMULACIÓN DE IMPRESIÓN
  // =========================================================

  const handleImprimirComanda = async (pedido) => {
    if (!pedido) return;
    try {
      const res = await apiClient.post(`/pedidos-takeaway/${pedido._id || pedido.id}/comanda`);
      const itemsCocina = res.data?.itemsParaCocina || (pedido.items || []);
      const itemsMostrar = itemsCocina.map((i) => ({
        id: i._id || i.id,
        nombre: i.nombreProducto || i.nombre,
        cantidad: i.cantidad,
        precioUnitario: i.precioUnitario,
        aclaracion: i.aclaraciones || i.aclaracion || '',
      }));
      setModalImpresionData({
        canal: 'takeaway',
        numeroPedido: pedido.numero,
        cliente: pedido.cliente,
        telefono: pedido.telefono,
        notasEntrega: pedido.notas,
        fecha: pedido.horaCreacion,
        items: itemsMostrar,
        total: calcularTotalPedido(pedido),
        medioPago: 'Pendiente',
        vistaInicial: 'cocina',
      });
      showToast('🍳 Comanda enviada a cocina con éxito');
      cargarDatosTakeAway();
    } catch (err) {
      alert(err.response?.data?.mensaje || 'Error al enviar comanda a cocina');
    }
  };

  const handleImprimirTicket = (pedido) => {
    if (!pedido) return;
    setModalImpresionData({
      canal: 'takeaway',
      numeroPedido: pedido.numero,
      cliente: pedido.cliente,
      telefono: pedido.telefono,
      notasEntrega: pedido.notas,
      fecha: pedido.horaCreacion,
      items: pedido.items || [],
      total: calcularTotalPedido(pedido),
      medioPago: pedido.medioPago || 'Efectivo',
      vistaInicial: 'cliente',
    });
  };

  // =========================================================
  // FILTRADO Y ESTADÍSTICAS
  // =========================================================

  const pedidosFiltrados = useMemo(() => {
    return pedidos.filter((p) => {
      // Filtro de estado
      const st = (p.estado || 'cocina').toLowerCase();
      const f = (filtroEstado || 'todos').toLowerCase();

      if (f !== 'todos' && f !== 'todos_los_estados' && f !== 'todos_incluidos' && f !== 'all') {
        if (f === 'cocina') {
          if (st !== 'cocina' && st !== 'pendiente' && st !== 'en_preparacion') return false;
        } else if (st !== f) {
          return false;
        }
      }

      // Filtro de búsqueda
      if (busqueda && busqueda.trim()) {
        const term = busqueda.toLowerCase().trim();
        const matchCliente = (p.cliente || '').toLowerCase().includes(term);
        const matchTel = (p.telefono || '').toLowerCase().includes(term);
        const matchId = String(p.numero || '').includes(term) || (p.id || '').toLowerCase().includes(term);
        if (!matchCliente && !matchTel && !matchId) return false;
      }

      return true;
    });
  }, [pedidos, filtroEstado, busqueda]);

  const statsTakeAway = useMemo(() => {
    const total = pedidos.length;
    const enCocina = pedidos.filter((p) => p.estado === 'cocina' || p.estado === 'pendiente' || p.estado === 'en_preparacion').length;
    const listos = pedidos.filter((p) => p.estado === 'listo').length;
    const entregados = pedidos.filter((p) => p.estado === 'entregado').length;

    const activos = enCocina + listos;
    const ventaTotal = pedidos.reduce((acc, p) => acc + calcularTotalPedido(p), 0);

    return {
      total,
      enCocina,
      listos,
      entregados,
      activos,
      ventaTotal,
    };
  }, [pedidos]);

  // Lista de items disponibles para el modal
  const itemsDisponibles = useMemo(() => {
    const listaProdUsar = productos.length > 0 ? productos : mockProductos;
    if (tipoSeleccionItem === 'productos') {
      return listaProdUsar.filter((p) => {
        const matchCat =
          categoriaFiltro === 'todas' ||
          p.categoriaId === categoriaFiltro ||
          p.categoriaId?._id === categoriaFiltro ||
          p.categoriaNombre === categoriaFiltro;
        const matchSearch =
          !busquedaItem.trim() ||
          p.nombre.toLowerCase().includes(busquedaItem.toLowerCase());
        return matchCat && matchSearch;
      });
    } else {
      return promociones
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
  }, [productos, promociones, tipoSeleccionItem, categoriaFiltro, busquedaItem]);

  useEffect(() => {
    if (itemsDisponibles.length > 0) {
      const existe = itemsDisponibles.some(
        (it) => String(it._id || it.id) === String(itemIdSeleccionado)
      );
      if (!existe) {
        setItemIdSeleccionado(String(itemsDisponibles[0]._id || itemsDisponibles[0].id));
      }
    } else {
      setItemIdSeleccionado('');
    }
  }, [itemsDisponibles, itemIdSeleccionado]);

  const totalCarrito = useMemo(() => {
    return carritoItems.reduce(
      (sum, it) => sum + (Number(it.precioUnitario) || 0) * (Number(it.cantidad) || 1),
      0
    );
  }, [carritoItems]);

  return (
    <div className="space-y-6 font-body text-aleman-negro">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-aleman-verde text-aleman-hueso text-sm font-semibold px-4 py-2.5 rounded-sm shadow-md flex items-center gap-2 border-2 border-aleman-dorado animate-bounce">
          <span>🛍️</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ========================================================= */}
      {/* ENCABEZADO Y ACCIÓN NUEVO PEDIDO */}
      {/* ========================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-aleman-negro">
            Gestión de Take Away (Retiro en Local)
          </h1>
          <p className="text-base text-aleman-negro/70">
            Control de pedidos para retirar en mostrador y aviso a clientes
          </p>
        </div>

        <button
          onClick={handleOpenNuevoPedidoModal}
          className="px-4 py-2.5 bg-aleman-rojo hover:bg-aleman-rojo-dark text-aleman-hueso font-bold text-base rounded-sm border border-aleman-negro/40 shadow-sm transition-colors flex items-center justify-center gap-2 self-start sm:self-auto cursor-pointer uppercase tracking-wider"
        >
          <span className="text-lg leading-none font-bold">+</span> Nuevo Pedido Take Away
        </button>
      </div>

      {/* ========================================================= */}
      {/* TARJETAS KPI / MÉTRICAS DE TAKE AWAY */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Pedidos Activos */}
        <div className="bg-aleman-hueso rounded-sm p-5 border-2 border-aleman-negro/20 flex items-center justify-between">
          <div>
            <span className="text-sm font-bold uppercase tracking-wider text-aleman-negro/70 block">
              Pedidos Activos en Curso
            </span>
            <div className="text-2xl font-display font-bold text-aleman-negro mt-1">
              {statsTakeAway.activos}{' '}
              <span className="text-sm text-aleman-negro/50 font-normal">
                ({statsTakeAway.total} totales)
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1 text-sm font-semibold">
              <span className="text-amber-900">🍳 {statsTakeAway.enCocina} en cocina</span>
              <span className="text-aleman-negro/30">•</span>
              <span className="text-blue-900">🛍️ {statsTakeAway.listos} listos</span>
            </div>
          </div>
          <div className="p-3 bg-aleman-crema border border-aleman-negro/15 text-aleman-negro rounded-sm text-2xl">
            🛍️
          </div>
        </div>

        {/* Card 2: Listos para retirar en mostrador (DESTACADO) */}
        <div className="bg-aleman-hueso rounded-sm p-5 border-2 border-emerald-600/60 flex items-center justify-between">
          <div>
            <span className="text-sm font-bold uppercase tracking-wider text-emerald-950 block">
              Listos en Mostrador (Por Retirar)
            </span>
            <div className="text-2xl font-display font-bold text-emerald-900 mt-1 flex items-center gap-2">
              <span>{statsTakeAway.listos} pedidos</span>
              {statsTakeAway.listos > 0 && (
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-ping"></span>
              )}
            </div>
            <span className="text-sm text-emerald-800 font-semibold block mt-1">
              Esperando retiro por el cliente
            </span>
          </div>
          <div className="p-3 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-sm text-2xl">
            🔔
          </div>
        </div>

        {/* Card 3: Ventas Take Away */}
        <div className="bg-aleman-hueso rounded-sm p-5 border-2 border-aleman-negro/20 flex items-center justify-between">
          <div>
            <span className="text-sm font-bold uppercase tracking-wider text-aleman-negro/70 block">
              Ventas Totales Take Away
            </span>
            <div className="text-2xl font-display font-bold text-aleman-negro mt-1">
              {formatCurrency(statsTakeAway.ventaTotal)}
            </div>
            <span className="text-sm text-aleman-negro/60 font-medium block mt-1">
              ✅ {statsTakeAway.entregados} pedidos ya retirados
            </span>
          </div>
          <div className="p-3 bg-aleman-crema border border-aleman-negro/15 text-emerald-800 rounded-sm text-2xl">
            💰
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* BARRA DE FILTROS Y SELECTOR DE VISTA */}
      {/* ========================================================= */}
      <div className="bg-aleman-hueso rounded-sm p-4 border-2 border-aleman-negro/20 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Selector de modo de vista */}
          <div className="flex bg-aleman-crema p-1 rounded-sm border border-aleman-negro/15">
            <button
              onClick={() => setVistaModo('camino')}
              className={`px-3 py-1.5 rounded-sm text-sm font-bold transition-all cursor-pointer ${
                vistaModo === 'camino'
                  ? 'bg-aleman-dorado text-aleman-negro shadow-2xs'
                  : 'text-aleman-negro/70 hover:text-aleman-negro'
              }`}
            >
              🛤️ Camino Take Away
            </button>
            <button
              onClick={() => setVistaModo('lista')}
              className={`px-3 py-1.5 rounded-sm text-sm font-bold transition-all cursor-pointer ${
                vistaModo === 'lista'
                  ? 'bg-aleman-dorado text-aleman-negro shadow-2xs'
                  : 'text-aleman-negro/70 hover:text-aleman-negro'
              }`}
            >
              📑 Vista Lista
            </button>
          </div>

          {/* Selector de estado */}
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="px-3 py-1.5 bg-white border-2 border-aleman-negro/25 rounded-sm text-sm text-aleman-negro focus:border-aleman-verde focus:outline-none font-semibold"
          >
            <option value="todos">Todos los estados ({pedidos.length})</option>
            <option value="cocina">🍳 En Cocina ({statsTakeAway.enCocina})</option>
            <option value="listo">🛍️ Listos para retirar ({statsTakeAway.listos})</option>
            <option value="entregado">✅ Entregados / Retirados ({statsTakeAway.entregados})</option>
          </select>

          {/* Input Buscador */}
          <div className="relative min-w-[220px]">
            <input
              type="text"
              placeholder="Buscar cliente, teléfono o #..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full px-3 py-1.5 bg-white border-2 border-aleman-negro/25 rounded-sm text-sm text-aleman-negro focus:border-aleman-verde focus:outline-none"
            />
            {busqueda && (
              <button
                onClick={() => setBusqueda('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-aleman-negro/40 hover:text-aleman-negro text-sm cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        <span className="text-sm text-aleman-negro/70 font-semibold self-end sm:self-center">
          Mostrando {pedidosFiltrados.length} pedidos
        </span>
      </div>

      {/* ========================================================= */}
      {/* VISTA 1: CAMINO DE TAKE AWAY (3 CHECKPOINTS CON CAMPANA 🔔 EN COCINA) */}
      {/* ========================================================= */}
      {vistaModo === 'camino' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-start">
          {pedidosFiltrados.length === 0 ? (
            <div className="col-span-full py-16 text-center bg-aleman-hueso rounded-sm border-2 border-dashed border-aleman-negro/20 p-6">
              <span className="text-3xl block mb-2">🛍️</span>
              <h4 className="font-display font-bold text-base uppercase tracking-wider text-aleman-negro">
                No se encontraron pedidos
              </h4>
              <p className="text-sm text-aleman-negro/60 mt-1">
                No hay pedidos de takeaway que coincidan con el filtro seleccionado.
              </p>
            </div>
          ) : (
            pedidosFiltrados.map((pedido) => {
              const total = calcularTotalPedido(pedido);
              const estConfig =
                ESTADOS_TAKEAWAY.find((e) => e.key === pedido.estado) || ESTADOS_TAKEAWAY[0];
              const stepIndex =
                pedido.estado === 'cocina' ? 0 : pedido.estado === 'listo' ? 1 : 2;

              return (
                <div
                  key={pedido.id}
                  onClick={() => setPedidoDetalleId(pedido.id)}
                  className="bg-aleman-hueso rounded-sm p-4 border-2 border-aleman-negro/20 hover:border-aleman-dorado transition-all cursor-pointer flex flex-col justify-between space-y-4 shadow-sm group"
                >
                  <div className="space-y-3">
                    {/* Top Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-display font-bold text-base bg-aleman-crema text-aleman-negro px-2.5 py-0.5 rounded-sm border border-aleman-negro/20">
                          #{pedido.numero}
                        </span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-sm border ${estConfig.badgeClass}`}>
                          {estConfig.icon} {estConfig.label}
                        </span>
                      </div>
                      <span className="text-xs text-aleman-negro/60 font-semibold">
                        🕒 {pedido.horaCreacion}
                      </span>
                    </div>

                    {/* Cliente & Retiro */}
                    <div>
                      <h4 className="font-display font-bold text-lg text-aleman-negro group-hover:text-aleman-rojo transition-colors leading-tight">
                        {pedido.cliente}
                      </h4>
                      <div className="text-sm text-aleman-negro/80 font-medium flex items-center gap-1.5 mt-1">
                        <span className="shrink-0 text-aleman-negro/50">📞</span>
                        <span className="truncate font-semibold">{pedido.telefono}</span>
                      </div>
                      {pedido.horaRetiroEstimada && (
                        <div className="text-xs text-aleman-negro/60 mt-1 font-semibold">
                          ⏰ Retiro estimado: <strong>{pedido.horaRetiroEstimada}</strong>
                        </div>
                      )}
                      {pedido.notas && (
                        <div className="text-xs text-amber-900 bg-amber-50 border border-amber-300 p-1.5 rounded-sm font-semibold mt-2">
                          Nota: {pedido.notas}
                        </div>
                      )}
                    </div>

                    {/* ========================================================= */}
                    {/* CHECKPOINTS PROGRESS BAR (3 ESTADOS: COCINA 🔔, LISTO 🛍️, ENTREGADO ✅) */}
                    {/* ========================================================= */}
                    <div className="py-3 px-3 bg-aleman-crema rounded-sm border border-aleman-negro/15 relative isolate">
                      <div className="relative flex items-center justify-between">
                        {/* Línea de pista del camino */}
                        <div className="absolute left-6 right-6 top-4 h-1 bg-aleman-negro/20 z-0">
                          <div
                            className="h-full bg-aleman-dorado transition-all duration-300"
                            style={{
                              width: stepIndex === 0 ? '0%' : stepIndex === 1 ? '50%' : '100%',
                            }}
                          />
                        </div>

                        {[
                          { key: 'cocina', label: 'Cocina', icon: '🔔' },
                          { key: 'listo', label: 'Listo', icon: '🛍️' },
                          { key: 'entregado', label: 'Entregado', icon: '✅' },
                        ].map((chk, idx) => {
                          const isDone = idx < stepIndex;
                          const isCurrent = idx === stepIndex;

                          return (
                            <div key={chk.key} className="relative z-10 flex flex-col items-center">
                              <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm border-2 transition-all ${
                                  isCurrent
                                    ? 'bg-aleman-dorado text-aleman-negro border-aleman-negro ring-2 ring-aleman-dorado/50 scale-110 shadow-xs'
                                    : isDone
                                    ? 'bg-aleman-verde text-aleman-hueso border-aleman-verde-dark'
                                    : 'bg-white text-aleman-negro/30 border-aleman-negro/20'
                                }`}
                              >
                                <span>{chk.icon}</span>
                              </div>
                              <span
                                className={`text-[11px] font-bold mt-1 uppercase tracking-tight ${
                                  isCurrent ? 'text-aleman-negro font-extrabold' : 'text-aleman-negro/60'
                                }`}
                              >
                                {chk.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Indicador de posición */}
                      <div className="mt-2.5 text-center text-[11px] font-bold text-aleman-negro/80 bg-aleman-hueso/80 py-1 rounded-xs border border-aleman-negro/10">
                        {stepIndex === 0 && '🔔 1. En preparación en Cocina'}
                        {stepIndex === 1 && '🛍️ 2. Listo en mostrador para retirar'}
                        {stepIndex === 2 && '✅ 3. Entregado al cliente'}
                      </div>
                    </div>

                    {/* Resumen Ítems */}
                    <div className="p-2.5 bg-aleman-crema rounded-sm border border-aleman-negro/15 text-xs space-y-1">
                      {pedido.items.map((it, idx) => (
                        <div key={idx} className="flex items-center justify-between text-aleman-negro">
                          <span className="truncate pr-1">
                            <strong>{it.cantidad}x</strong> {it.nombre}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Footer Tarjeta: Total y Botón de Avance */}
                  <div className="pt-3 border-t-2 border-aleman-negro/10 flex items-center justify-between gap-2">
                    <span className="text-xl font-display font-bold text-aleman-negro">
                      {formatCurrency(total)}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {estConfig.siguienteEstado && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAvanzarEstado(pedido.id);
                          }}
                          className="px-3 py-1.5 text-xs font-bold rounded-sm uppercase tracking-wider bg-aleman-verde hover:bg-aleman-verde-dark text-aleman-hueso border border-aleman-dorado/40 transition-colors cursor-pointer shadow-2xs"
                          title={estConfig.btnSiguienteTexto}
                        >
                          ➜ {ESTADOS_TAKEAWAY.find((s) => s.key === estConfig.siguienteEstado)?.icon} Avanzar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* VISTA 2: LISTA DETALLADA DE TAKE AWAY (TABLA EN DESKTOP / CARDS EN MOBILE) */}
      {/* ========================================================= */}
      {vistaModo === 'lista' && (
        <>
          {/* DESKTOP (>= md): Tabla detallada intacta */}
          <div className="hidden md:block bg-aleman-hueso rounded-sm border-2 border-aleman-negro/20 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-base text-aleman-negro">
                <thead className="bg-aleman-crema text-sm uppercase font-bold text-aleman-negro border-b-2 border-aleman-negro/20">
                  <tr>
                    <th className="py-3.5 px-6">Pedido</th>
                    <th className="py-3.5 px-6">Cliente & Contacto</th>
                    <th className="py-3.5 px-6">Hora Estimada</th>
                    <th className="py-3.5 px-6">Ítems Pedidos</th>
                    <th className="py-3.5 px-6 text-right">Total</th>
                    <th className="py-3.5 px-6 text-center">Estado</th>
                    <th className="py-3.5 px-6 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-aleman-negro/10">
                  {pedidosFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-base text-aleman-negro/50">
                        No se encontraron pedidos Take Away con los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    pedidosFiltrados.map((pedido) => {
                      const total = calcularTotalPedido(pedido);
                      const estadoObj =
                        ESTADOS_TAKEAWAY.find((e) => e.key === pedido.estado) ||
                        ESTADOS_TAKEAWAY[0];
                      const esListo = pedido.estado === 'listo';

                      return (
                        <tr
                          key={pedido.id}
                          onClick={() => setPedidoDetalleId(pedido.id)}
                          className={`transition-colors cursor-pointer ${
                            esListo
                              ? 'bg-emerald-50/50 hover:bg-emerald-50/80'
                              : 'hover:bg-aleman-crema/50'
                          }`}
                        >
                          {/* Pedido */}
                          <td className="py-4 px-6 font-bold text-aleman-negro">
                            <div>#{pedido.numero}</div>
                            <span className="text-sm text-aleman-negro/50 font-normal">
                              🕒 {pedido.horaCreacion}
                            </span>
                          </td>

                          {/* Cliente */}
                          <td className="py-4 px-6">
                            <div className="font-bold text-aleman-negro">
                              {pedido.cliente}
                            </div>
                            <div className="text-sm text-aleman-negro/60 font-semibold">
                              📞 {pedido.telefono}
                            </div>
                          </td>

                          {/* Hora Estimada */}
                          <td className="py-4 px-6 text-sm text-aleman-negro">
                            {pedido.horaRetiroEstimada ? (
                              <span className="font-bold">
                                ⏰ {pedido.horaRetiroEstimada}
                              </span>
                            ) : (
                              <span className="text-aleman-negro/50">Inmediato</span>
                            )}
                            {pedido.notas && (
                              <div className="text-xs text-amber-900 italic font-semibold mt-0.5">
                                {pedido.notas}
                              </div>
                            )}
                          </td>

                          {/* Items */}
                          <td className="py-4 px-6">
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {pedido.items.map((it, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-0.5 bg-aleman-crema text-aleman-negro text-sm rounded-sm font-semibold border border-aleman-negro/15"
                                >
                                  {it.cantidad}x {it.nombre}
                                </span>
                              ))}
                            </div>
                          </td>

                          {/* Total */}
                          <td className="py-4 px-6 text-right font-display font-bold text-aleman-negro text-lg">
                            {formatCurrency(total)}
                          </td>

                          {/* Estado */}
                          <td className="py-4 px-6 text-center">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-sm font-bold border ${estadoObj.badgeClass}`}
                            >
                              <span>{estadoObj.icon}</span> {estadoObj.label}
                            </span>
                          </td>

                          {/* Acciones */}
                          <td className="py-4 px-6 text-right space-x-2">
                            {estadoObj.siguienteEstado && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAvanzarEstado(pedido.id);
                                }}
                                className={`px-2.5 py-1 text-sm font-bold uppercase tracking-wider rounded-sm transition-colors cursor-pointer border ${
                                  esListo
                                    ? 'bg-emerald-700 hover:bg-emerald-800 text-aleman-hueso border-aleman-negro/30'
                                    : 'bg-aleman-rojo hover:bg-aleman-rojo-dark text-aleman-hueso border-aleman-negro/40'
                                }`}
                              >
                                Avanzar
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setPedidoDetalleId(pedido.id);
                              }}
                              className="px-2.5 py-1 text-sm font-bold uppercase tracking-wider text-aleman-negro bg-aleman-crema hover:bg-aleman-hueso rounded-sm border border-aleman-negro/25 transition-colors cursor-pointer"
                            >
                              Detalle
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

          {/* MOBILE (< md): Cards apiladas */}
          <div className="md:hidden space-y-3">
            {pedidosFiltrados.length === 0 ? (
              <div className="bg-aleman-hueso rounded-sm border-2 border-aleman-negro/20 p-8 text-center text-base text-aleman-negro/50">
                No se encontraron pedidos Take Away con los filtros seleccionados.
              </div>
            ) : (
              pedidosFiltrados.map((pedido) => {
                const total = calcularTotalPedido(pedido);
                const estadoObj =
                  ESTADOS_TAKEAWAY.find((e) => e.key === pedido.estado) ||
                  ESTADOS_TAKEAWAY[0];
                const esListo = pedido.estado === 'listo';

                return (
                  <div
                    key={pedido.id}
                    onClick={() => setPedidoDetalleId(pedido.id)}
                    className={`rounded-sm p-4 border-2 transition-colors cursor-pointer space-y-3 shadow-2xs ${
                      esListo
                        ? 'bg-emerald-50/70 border-emerald-600/70 hover:border-emerald-700'
                        : 'bg-aleman-hueso border-aleman-negro/20 hover:border-aleman-dorado'
                    }`}
                  >
                    {/* Arriba: número de pedido + badge de estado + hora */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-display font-bold text-base px-2.5 py-0.5 rounded-sm border ${
                            esListo
                              ? 'bg-emerald-100 text-emerald-950 border-emerald-300'
                              : 'bg-aleman-crema text-aleman-negro border-aleman-negro/20'
                          }`}
                        >
                          #{pedido.numero}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-sm text-xs font-bold border ${estadoObj.badgeClass}`}
                        >
                          <span>{estadoObj.icon}</span> {estadoObj.label}
                        </span>
                        {esListo && (
                          <span className="hidden xs:inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-emerald-100 text-emerald-900 text-xs font-bold border border-emerald-300 animate-pulse">
                            🔔 En mostrador
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-aleman-negro/60 font-semibold shrink-0">
                        🕒 {pedido.horaCreacion}
                      </span>
                    </div>

                    {/* Debajo: nombre del cliente, teléfono y hora estimada de retiro */}
                    <div>
                      <div
                        className={`font-display font-bold text-base leading-tight ${
                          esListo ? 'text-emerald-950' : 'text-aleman-negro'
                        }`}
                      >
                        {pedido.cliente}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm">
                        <div className="text-aleman-negro/70 font-semibold flex items-center gap-1">
                          <span>📞</span> {pedido.telefono}
                        </div>
                        <div className="text-aleman-negro/80 font-medium flex items-center gap-1">
                          <span>⏰</span>
                          {pedido.horaRetiroEstimada ? (
                            <span>
                              Retiro: <strong className="text-aleman-negro">{pedido.horaRetiroEstimada}</strong>
                            </span>
                          ) : (
                            <span className="text-aleman-negro/60">Retiro: Inmediato</span>
                          )}
                        </div>
                      </div>
                      {pedido.notas && (
                        <div className="text-xs text-amber-900 bg-amber-50 border border-amber-300 p-1.5 rounded-sm font-semibold mt-1.5">
                          Nota: {pedido.notas}
                        </div>
                      )}
                    </div>

                    {/* Debajo: resumen de ítems */}
                    <div className="p-2.5 bg-aleman-crema/60 rounded-sm border border-aleman-negro/15">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-aleman-negro/60 mb-1.5">
                        Ítems pedidos:
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {pedido.items.map((it, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 bg-aleman-crema text-aleman-negro text-xs rounded-sm font-semibold border border-aleman-negro/15"
                          >
                            {it.cantidad}x {it.nombre}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Al final: total destacado y botón de acción para avanzar de estado */}
                    <div className="pt-3 border-t-2 border-aleman-negro/10 flex items-center justify-between gap-2">
                      <div>
                        <span className="text-[11px] text-aleman-negro/60 uppercase tracking-wider font-bold block">
                          Total
                        </span>
                        <span className="text-xl font-display font-bold text-aleman-negro">
                          {formatCurrency(total)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {estadoObj.siguienteEstado && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAvanzarEstado(pedido.id);
                            }}
                            className={`px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider rounded-sm transition-colors cursor-pointer border shadow-2xs ${
                              esListo
                                ? 'bg-emerald-700 hover:bg-emerald-800 text-aleman-hueso border-aleman-negro/30'
                                : 'bg-aleman-rojo hover:bg-aleman-rojo-dark text-aleman-hueso border-aleman-negro/40'
                            }`}
                            title={estadoObj.btnSiguienteTexto}
                          >
                            {pedido.estado === 'cocina'
                              ? 'Marcar listo'
                              : 'Marcar retirado'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPedidoDetalleId(pedido.id);
                          }}
                          className="px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider text-aleman-negro bg-aleman-crema hover:bg-aleman-hueso rounded-sm border border-aleman-negro/25 transition-colors cursor-pointer"
                        >
                          Detalle
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* ========================================================= */}
      {/* MODAL: NUEVO PEDIDO TAKE AWAY */}
      {/* ========================================================= */}
      {isModalNuevoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-aleman-negro/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-aleman-hueso rounded-sm border-2 border-aleman-negro w-full max-w-4xl my-4 overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b-2 border-aleman-dorado flex items-center justify-between bg-aleman-verde text-aleman-hueso">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🛍️</span>
                <div>
                  <h3 className="text-xl font-display font-bold uppercase tracking-wider">
                    Nuevo Pedido Take Away (Retiro en Mostrador)
                  </h3>
                  <p className="text-sm text-aleman-hueso/70">
                    Ingresá el cliente, teléfono para avisar y los ítems solicitados
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

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Datos Cliente */}
              <div className="p-4 bg-aleman-crema border-2 border-aleman-negro/15 rounded-sm space-y-4">
                <h4 className="text-sm font-display font-bold text-aleman-negro uppercase tracking-wider">
                  Datos del Cliente y Retiro
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-aleman-negro uppercase tracking-wider mb-1.5">
                      Nombre del Cliente *
                    </label>
                    <input
                      type="text"
                      value={nuevoCliente}
                      onChange={(e) => setNuevoCliente(e.target.value)}
                      placeholder="Ej: Nicolás Vázquez"
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
                      value={nuevoTelefono}
                      onChange={(e) => setNuevoTelefono(e.target.value)}
                      placeholder="Ej: 11-2233-4455"
                      required
                      className="w-full px-3.5 py-2.5 bg-white border-2 border-aleman-negro/25 rounded-sm text-base text-aleman-negro focus:border-aleman-verde focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-aleman-negro uppercase tracking-wider mb-1.5">
                      Hora Estimada de Retiro
                    </label>
                    <input
                      type="text"
                      value={nuevaHoraRetiro}
                      onChange={(e) => setNuevaHoraRetiro(e.target.value)}
                      placeholder="Ej: 20:30 o En 15 min"
                      className="w-full px-3.5 py-2.5 bg-white border-2 border-aleman-negro/25 rounded-sm text-base text-aleman-negro focus:border-aleman-verde focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-sm font-bold text-aleman-negro uppercase tracking-wider mb-1.5">
                      Notas de Mostrador / Pago (Opcional)
                    </label>
                    <input
                      type="text"
                      value={nuevasNotas}
                      onChange={(e) => setNuevasNotas(e.target.value)}
                      placeholder="Ej: Paga por Mercado Pago al retirar, espera en mostrador..."
                      className="w-full px-3.5 py-2 bg-white border-2 border-aleman-negro/25 rounded-sm text-sm text-aleman-negro focus:border-aleman-verde focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Selector de ítems y Carrito */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Selector */}
                <div className="lg:col-span-6 p-4 bg-aleman-crema border-2 border-aleman-negro/15 rounded-sm space-y-3">
                  <h4 className="text-sm font-display font-bold text-aleman-negro uppercase tracking-wider">
                    Seleccionar Platos y Bebidas
                  </h4>

                  <div className="flex bg-aleman-hueso p-1 rounded-sm border border-aleman-negro/20">
                    <button
                      type="button"
                      onClick={() => {
                        setTipoSeleccionItem('productos');
                        const listaProdUsar = productos.length > 0 ? productos : mockProductos;
                        if (listaProdUsar.length > 0) {
                          setItemIdSeleccionado(String(listaProdUsar[0]._id || listaProdUsar[0].id));
                        }
                      }}
                      className={`flex-1 py-1.5 text-sm font-bold rounded-sm transition-all cursor-pointer ${
                        tipoSeleccionItem === 'productos'
                          ? 'bg-aleman-dorado text-aleman-negro'
                          : 'text-aleman-negro/70 hover:text-aleman-negro'
                      }`}
                    >
                      🍕 Productos ({(productos.length > 0 ? productos : mockProductos).length})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTipoSeleccionItem('promociones');
                        const activePromos = promociones.filter((p) => p.activo !== false);
                        if (activePromos.length > 0) {
                          setItemIdSeleccionado(String(activePromos[0]._id || activePromos[0].id));
                        }
                      }}
                      className={`flex-1 py-1.5 text-sm font-bold rounded-sm transition-all cursor-pointer ${
                        tipoSeleccionItem === 'promociones'
                          ? 'bg-aleman-dorado text-aleman-negro'
                          : 'text-aleman-negro/70 hover:text-aleman-negro'
                      }`}
                    >
                      🎁 Combos ({promociones.filter((p) => p.activo !== false).length})
                    </button>
                  </div>

                  <input
                    type="text"
                    placeholder="Filtrar por nombre..."
                    value={busquedaItem}
                    onChange={(e) => setBusquedaItem(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border-2 border-aleman-negro/25 rounded-sm text-sm text-aleman-negro focus:border-aleman-verde focus:outline-none"
                  />

                  {tipoSeleccionItem === 'productos' && (
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={() => setCategoriaFiltro('todas')}
                        className={`px-2 py-0.5 rounded-sm text-xs font-bold transition-colors cursor-pointer ${
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
                          className={`px-2 py-0.5 rounded-sm text-xs font-bold transition-colors cursor-pointer ${
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

                  <div>
                    <label className="block text-xs font-bold text-aleman-negro uppercase tracking-wider mb-1">
                      Ítem a agregar
                    </label>
                    <select
                      value={itemIdSeleccionado}
                      onChange={(e) => setItemIdSeleccionado(e.target.value)}
                      className="w-full px-3 py-2 bg-white border-2 border-aleman-negro/25 rounded-sm text-sm text-aleman-negro font-semibold focus:border-aleman-verde focus:outline-none"
                    >
                      {itemsDisponibles.map((item) => {
                        const val = String(item._id || item.id);
                        return (
                          <option key={val} value={val}>
                            {item.nombre} —{' '}
                            {formatCurrency(item.precioVenta || item.precioCombo)}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs font-bold text-aleman-negro uppercase tracking-wider mb-1">
                        Cant.
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={cantidadItem}
                        onChange={(e) =>
                          setCantidadItem(Math.max(1, Number(e.target.value) || 1))
                        }
                        className="w-full px-2.5 py-1.5 bg-white border-2 border-aleman-negro/25 rounded-sm text-sm text-aleman-negro font-bold text-center focus:border-aleman-verde"
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="block text-xs font-bold text-aleman-negro uppercase tracking-wider mb-1">
                        Aclaración (Opcional)
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: bien dorada, con hielo..."
                        value={aclaracionItem}
                        onChange={(e) => setAclaracionItem(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border-2 border-aleman-negro/25 rounded-sm text-sm text-aleman-negro focus:border-aleman-verde"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAgregarItemAlCarrito}
                    className="w-full py-2 bg-aleman-rojo hover:bg-aleman-rojo-dark text-aleman-hueso text-sm font-bold uppercase tracking-wider rounded-sm border border-aleman-negro/40 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <span>+</span> Agregar al Pedido
                  </button>
                </div>

                {/* Carrito */}
                <div className="lg:col-span-6 p-4 bg-aleman-hueso border-2 border-aleman-negro/20 rounded-sm space-y-3 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between border-b-2 border-aleman-negro/10 pb-2">
                      <h4 className="text-sm font-display font-bold text-aleman-negro uppercase tracking-wider">
                        🛒 Ítems en el Pedido
                      </h4>
                      <span className="text-sm font-semibold text-aleman-negro/60">
                        {carritoItems.length} ítems
                      </span>
                    </div>

                    {carritoItems.length === 0 ? (
                      <div className="py-8 text-center text-sm text-aleman-negro/40 border-2 border-dashed border-aleman-negro/20 rounded-sm my-2">
                        No agregaste platos o combos todavía.
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 my-2">
                        {carritoItems.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between p-2 bg-aleman-crema rounded-sm border border-aleman-negro/15 text-sm"
                          >
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-sm bg-aleman-hueso text-aleman-negro font-bold text-xs flex items-center justify-center border border-aleman-negro/20">
                                {item.cantidad}x
                              </span>
                              <div>
                                <span className="font-bold text-aleman-negro">
                                  {item.nombre}
                                </span>
                                {item.aclaracion && (
                                  <span className="block text-xs text-amber-900 italic font-semibold">
                                    "{item.aclaracion}"
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="font-display font-bold text-aleman-negro text-sm">
                                {formatCurrency(
                                  item.precioUnitario * item.cantidad
                                )}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleQuitarItemCarrito(item.id)}
                                className="text-aleman-negro/40 hover:text-aleman-rojo font-bold px-1 cursor-pointer"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t-2 border-aleman-negro/10 flex items-center justify-between">
                    <span className="text-sm font-bold text-aleman-negro/70 uppercase tracking-wider">
                      Total a Cobrar:
                    </span>
                    <span className="text-2xl font-display font-bold text-aleman-negro">
                      {formatCurrency(totalCarrito)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t-2 border-aleman-negro/10">
                <button
                  type="button"
                  onClick={() => setIsModalNuevoOpen(false)}
                  className="px-4 py-2 text-sm font-bold uppercase tracking-wider text-aleman-negro hover:bg-aleman-crema rounded-sm border border-aleman-negro/25 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCrearPedidoTakeAway}
                  className="px-6 py-2 text-sm font-bold uppercase tracking-wider text-aleman-hueso bg-aleman-rojo hover:bg-aleman-rojo-dark rounded-sm border border-aleman-negro/40 shadow-sm transition-colors cursor-pointer"
                >
                  Crear Pedido Take Away (Pendiente)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: DETALLE COMPLETO DE PEDIDO TAKE AWAY */}
      {/* ========================================================= */}
      {pedidoActual && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-aleman-negro/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-aleman-hueso rounded-sm border-2 border-aleman-negro w-full max-w-3xl my-4 overflow-hidden flex flex-col max-h-[92vh]">
            {/* Header Detalle */}
            <div className="px-6 py-4 border-b-2 border-aleman-dorado flex flex-wrap items-center justify-between gap-3 bg-aleman-verde text-aleman-hueso">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-sm bg-aleman-dorado text-aleman-negro font-display font-bold text-lg flex items-center justify-center">
                  #{pedidoActual.numero}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-display font-bold uppercase tracking-wider">
                      Pedido Take Away #{pedidoActual.numero}
                    </h3>
                    {(() => {
                      const estObj =
                        ESTADOS_TAKEAWAY.find(
                          (e) => e.key === pedidoActual.estado
                        ) || ESTADOS_TAKEAWAY[0];
                      return (
                        <span
                          className={`text-sm px-2.5 py-0.5 rounded-sm font-bold border ${estObj.badgeClass}`}
                        >
                          {estObj.icon} {estObj.label}
                        </span>
                      );
                    })()}
                  </div>
                  <span className="text-sm text-aleman-hueso/70 font-semibold">
                    🕒 Creado a las {pedidoActual.horaCreacion} • ⏰ Retiro estimado: {pedidoActual.horaRetiroEstimada || 'Inmediato'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleImprimirComanda(pedidoActual)}
                  className="px-3 py-1.5 bg-aleman-verde-dark hover:bg-aleman-verde text-aleman-hueso text-sm font-bold uppercase tracking-wider rounded-sm border border-aleman-dorado/40 flex items-center gap-1 cursor-pointer transition-colors"
                  title="Imprimir comanda para cocina"
                >
                  🖨️ Comanda
                </button>
                <button
                  onClick={() => handleImprimirTicket(pedidoActual)}
                  className="px-3 py-1.5 bg-aleman-verde-dark hover:bg-aleman-verde text-aleman-hueso text-sm font-bold uppercase tracking-wider rounded-sm border border-aleman-dorado/40 flex items-center gap-1 cursor-pointer transition-colors"
                  title="Imprimir ticket de retiro en mostrador"
                >
                  🧾 Ticket
                </button>
                <button
                  onClick={() => setPedidoDetalleId(null)}
                  className="text-aleman-hueso/70 hover:text-aleman-hueso text-xl font-bold p-1 rounded transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Body Detalle */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Card Cliente & Retiro */}
              <div
                className={`p-4 rounded-sm border-2 space-y-3 ${
                  pedidoActual.estado === 'listo'
                    ? 'bg-aleman-crema border-emerald-600/70'
                    : 'bg-aleman-crema border-aleman-negro/15'
                }`}
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-aleman-negro/60 font-bold block uppercase tracking-wider text-xs">
                      Cliente
                    </span>
                    <span className="text-base font-bold text-aleman-negro block mt-0.5">
                      {pedidoActual.cliente}
                    </span>
                  </div>

                  <div>
                    <span className="text-aleman-negro/60 font-bold block uppercase tracking-wider text-xs">
                      Teléfono
                    </span>
                    <span className="text-base font-semibold text-aleman-negro block mt-0.5">
                      📞 {pedidoActual.telefono}
                    </span>
                  </div>

                  <div>
                    <span className="text-aleman-negro/60 font-bold block uppercase tracking-wider text-xs">
                      Total
                    </span>
                    <span className="text-xl font-display font-bold text-aleman-negro block mt-0.5">
                      {formatCurrency(calcularTotalPedido(pedidoActual))}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-aleman-negro/15 text-xs flex items-center justify-between">
                  <div>
                    <span className="text-aleman-negro/60 font-bold uppercase tracking-wider text-xs">
                      Hora Estimada de Retiro:
                    </span>{' '}
                    <span className="font-bold text-aleman-negro text-base ml-1">
                      {pedidoActual.horaRetiroEstimada || 'A la brevedad'}
                    </span>
                  </div>

                  {pedidoActual.estado === 'listo' && (
                    <span className="px-3 py-1 rounded-sm bg-emerald-700 text-aleman-hueso font-bold text-sm shadow-xs animate-pulse">
                      🔔 ¡Listo para retirar en mostrador!
                    </span>
                  )}
                </div>

                {pedidoActual.notas && (
                  <div className="p-2 bg-aleman-hueso rounded-sm border border-aleman-negro/20 text-sm text-aleman-negro">
                    💡 <strong>Notas:</strong> {pedidoActual.notas}
                  </div>
                )}
              </div>

              {/* Semáforo Interactivo de Estado del Pedido */}
              <div className="p-4 bg-aleman-hueso border-2 border-aleman-negro/20 rounded-sm space-y-3">
                <span className="text-sm font-display font-bold text-aleman-negro uppercase tracking-wider block">
                  Estado del Pedido
                </span>

                <div className="flex flex-wrap gap-2">
                  {ESTADOS_TAKEAWAY.map((est) => {
                    const isCurrent = pedidoActual.estado === est.key;
                    return (
                      <button
                        key={est.key}
                        type="button"
                        onClick={() =>
                          handleAvanzarEstado(pedidoActual.id, est.key)
                        }
                        className={`px-3.5 py-2 rounded-sm text-sm font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                          isCurrent
                            ? `${est.badgeClass} ring-2 ring-aleman-dorado shadow-xs`
                            : 'bg-aleman-crema text-aleman-negro/70 border-aleman-negro/20 hover:bg-aleman-hueso'
                        }`}
                      >
                        <span>{est.icon}</span> {est.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Desglose de Ítems */}
              <div className="space-y-2">
                <h4 className="text-sm font-display font-bold text-aleman-negro uppercase tracking-wider">
                  Detalle de Platos y Bebidas
                </h4>

                <div className="overflow-x-auto border-2 border-aleman-negro/20 rounded-sm overflow-hidden">
                  <table className="w-full text-left text-sm text-aleman-negro">
                    <thead className="bg-aleman-crema font-bold uppercase text-xs text-aleman-negro border-b-2 border-aleman-negro/20">
                      <tr>
                        <th className="py-2.5 px-4">Ítem</th>
                        <th className="py-2.5 px-4 text-center">Cant.</th>
                        <th className="py-2.5 px-4 text-right">Precio Unit.</th>
                        <th className="py-2.5 px-4 text-right font-bold">
                          Subtotal
                        </th>
                        {puedeModificarComanda && (
                          <th className="py-2.5 px-4 text-center w-24">
                            Acciones
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-aleman-negro/10 bg-aleman-hueso">
                      {agruparItemsParaRender(pedidoActual.items).map((grupo, gIdx) => {
                        const renderItemRow = (it, idx) => (
                          <tr key={it.id || idx}>
                            <td className="py-3 px-4">
                              <span className="font-bold text-aleman-negro block">
                                {it.nombre}
                              </span>
                              {it.aclaracion && (
                                <span className="text-xs text-amber-900 italic font-semibold block mb-1">
                                  Nota: "{it.aclaracion}"
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center font-bold">
                              {it.cantidad}
                            </td>
                            <td className="py-3 px-4 text-right font-semibold text-xs text-aleman-negro/80">
                              {formatCurrency(it.precioUnitario)}
                            </td>
                            <td className="py-3 px-4 text-right font-display font-bold text-aleman-negro text-base">
                              {formatCurrency(it.precioUnitario * it.cantidad)}
                            </td>
                            {puedeModificarComanda && (
                              <td className="py-3 px-4 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleAbrirModalEditar(it, idx)}
                                    className="w-8 h-8 flex items-center justify-center text-sm font-bold bg-white hover:bg-aleman-dorado/20 text-aleman-negro border border-aleman-negro/25 rounded-sm transition-colors cursor-pointer shadow-2xs"
                                    title="Editar ítem"
                                    aria-label="Editar ítem"
                                  >
                                    ✏️
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleAbrirModalEliminar(it, idx)}
                                    className="w-8 h-8 flex items-center justify-center text-sm font-bold bg-red-50 hover:bg-red-100 text-aleman-rojo border border-aleman-rojo/30 rounded-sm transition-colors cursor-pointer shadow-2xs"
                                    title="Eliminar ítem"
                                    aria-label="Eliminar ítem"
                                  >
                                    🗑️
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        );

                        if (grupo.esPromo) {
                          const totalGrupo = grupo.items.reduce(
                            (sum, it) => sum + it.precioUnitario * it.cantidad,
                            0
                          );
                          return (
                            <Fragment key={grupo.grupoPromocionId || gIdx}>
                              <tr className="bg-amber-100/80 border-y-2 border-amber-300">
                                <td
                                  colSpan={puedeModificarComanda ? 5 : 4}
                                  className="py-2 px-4 font-bold text-amber-950 text-xs"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="flex items-center gap-1.5">
                                      <span className="text-sm">🎉</span> Promo: {grupo.promocionNombre}
                                    </span>
                                    <span className="bg-amber-200/90 text-amber-950 px-2.5 py-0.5 rounded-full font-mono font-bold">
                                      Total Combo: {formatCurrency(totalGrupo)}
                                    </span>
                                  </div>
                                </td>
                              </tr>
                              {grupo.items.map((it, idx) => renderItemRow(it, idx))}
                            </Fragment>
                          );
                        }
                        return renderItemRow(grupo.item, gIdx);
                      })}
                    </tbody>
                    <tfoot className="bg-aleman-crema font-bold text-aleman-negro border-t-2 border-aleman-negro/20">
                      <tr>
                        <td
                          colSpan={puedeModificarComanda ? 4 : 3}
                          className="py-3 px-4 text-right uppercase tracking-wider text-sm"
                        >
                          Total a Cobrar:
                        </td>
                        <td className="py-3 px-4 text-right text-lg font-display font-bold text-aleman-negro">
                          {formatCurrency(calcularTotalPedido(pedidoActual))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Historial de Eventos */}
              {pedidoActual.historialEstados &&
                pedidoActual.historialEstados.length > 0 && (
                  <div className="p-3 bg-aleman-crema rounded-sm border border-aleman-negro/15 text-xs space-y-1.5">
                    <span className="font-bold text-aleman-negro uppercase tracking-wider text-xs block">
                      Historial de Eventos
                    </span>
                    <div className="space-y-1">
                      {pedidoActual.historialEstados.map((h, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between text-aleman-negro/70 text-xs font-semibold"
                        >
                          <span className="flex items-center gap-1.5">
                            <span>•</span>
                            <strong>{h.nota || h.estado}</strong>
                          </span>
                          <span className="text-aleman-negro/50 font-mono">
                            {h.hora}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>

            {/* Footer Detalle */}
            <div className="px-6 py-3 bg-aleman-crema border-t-2 border-aleman-negro/10 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setPedidoDetalleId(null)}
                className="px-4 py-2 text-sm font-bold uppercase tracking-wider text-aleman-negro hover:bg-aleman-hueso rounded-sm border border-aleman-negro/25 transition-colors cursor-pointer"
              >
                Cerrar Detalle
              </button>

              {(() => {
                const estConfig = ESTADOS_TAKEAWAY.find(
                  (e) => e.key === pedidoActual.estado
                );
                if (estConfig?.siguienteEstado) {
                  return (
                    <button
                      type="button"
                      onClick={() => handleAvanzarEstado(pedidoActual.id)}
                      className={`px-5 py-2 text-sm font-bold uppercase tracking-wider text-aleman-hueso rounded-sm border shadow-sm transition-colors cursor-pointer flex items-center gap-1.5 ${
                        pedidoActual.estado === 'listo'
                          ? 'bg-emerald-700 hover:bg-emerald-800 border-aleman-negro/30'
                          : 'bg-aleman-rojo hover:bg-aleman-rojo-dark border-aleman-negro/40'
                      }`}
                    >
                      <span>{estConfig.btnSiguienteTexto}</span>
                    </button>
                  );
                }
                return (
                  <span className="text-sm font-bold text-emerald-800 flex items-center gap-1">
                    <span>✅</span> Pedido retirado y completado
                  </span>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: SELECCIÓN DE MEDIO DE PAGO AL RETIRAR TAKE AWAY */}
      {/* ========================================================= */}
      {modalCobroTakeAway && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-aleman-negro/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-aleman-hueso rounded-sm border-2 border-aleman-negro w-full max-w-md overflow-hidden shadow-2xl relative z-[1010] isolate">
            {/* Header */}
            <div className="px-6 py-4 bg-aleman-verde text-aleman-hueso border-b-2 border-aleman-dorado flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">🛍️</span>
                <div>
                  <h3 className="text-lg font-display font-bold uppercase tracking-wider">
                    Cobro Take Away #{modalCobroTakeAway.pedido.numero}
                  </h3>
                  <span className="text-sm text-aleman-dorado font-bold">
                    Cliente: {modalCobroTakeAway.pedido.cliente}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalCobroTakeAway(null)}
                className="text-aleman-hueso/70 hover:text-aleman-hueso text-lg font-bold p-1 rounded transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleConfirmarCobroTakeAway} className="p-6 space-y-5">
              <div className="p-4 bg-aleman-crema border-2 border-aleman-negro/20 rounded-sm text-center">
                <span className="text-sm font-bold text-aleman-negro/70 uppercase tracking-wider block">
                  Total a Cobrar en Mostrador
                </span>
                <span className="text-3xl font-display font-bold text-aleman-negro mt-1 block">
                  {formatCurrency(modalCobroTakeAway.total)}
                </span>
                <span className="text-sm text-aleman-negro/60 block mt-1 font-semibold">
                  📞 {modalCobroTakeAway.pedido.telefono}
                </span>
              </div>

              <div>
                <label className="block text-sm font-bold text-aleman-negro uppercase tracking-wider mb-2">
                  Medio de Pago Recibido en Mostrador *
                </label>
                <div className="grid grid-cols-1 gap-2.5">
                  {[
                    { id: 'efectivo', label: '💵 Efectivo', desc: 'Cobro en billetes en caja del local' },
                    { id: 'debito_credito', label: '💳 Tarjeta Débito / Crédito', desc: 'Terminal POS de mostrador' },
                    { id: 'transferencia', label: '📱 Transferencia / Mercado Pago', desc: 'QR o transferencia mostrador' },
                  ].map((op) => (
                    <label
                      key={op.id}
                      className={`flex items-center justify-between p-3 rounded-sm border-2 cursor-pointer transition-all ${
                        modalCobroTakeAway.medioPago === op.id
                          ? 'border-aleman-dorado bg-aleman-dorado/15'
                          : 'border-aleman-negro/20 hover:border-aleman-negro/40 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="medioPagoTakeAway"
                          value={op.id}
                          checked={modalCobroTakeAway.medioPago === op.id}
                          onChange={(e) =>
                            setModalCobroTakeAway({
                              ...modalCobroTakeAway,
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
                  disabled={isSubmittingCobro}
                  onClick={() => setModalCobroTakeAway(null)}
                  className="px-4 py-2 text-sm font-bold uppercase tracking-wider text-aleman-negro hover:bg-aleman-crema rounded-sm border border-aleman-negro/25 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCobro}
                  className={`px-5 py-2 text-sm font-bold uppercase tracking-wider text-aleman-hueso rounded-sm border border-aleman-negro/40 shadow-sm transition-colors cursor-pointer ${
                    isSubmittingCobro
                      ? 'bg-gray-400 opacity-60 cursor-not-allowed'
                      : 'bg-aleman-rojo hover:bg-aleman-rojo-dark'
                  }`}
                >
                  {isSubmittingCobro ? 'Procesando...' : 'Confirmar Cobro y Marcar Retirado'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ========================================================= */}
      {/* MODAL EDITAR ÍTEM DE PEDIDO TAKE AWAY */}
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
                  Editar Ítem de Pedido
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
                  {pedidoActual?.id}
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
                      setModalEditarItem((prev) => ({
                        ...prev,
                        nuevaCantidad: Math.max(1, Number(prev.nuevaCantidad || 1) - 1),
                        errorCantidad: '',
                      }))
                    }
                    className="w-10 h-10 bg-aleman-crema hover:bg-aleman-dorado/30 text-aleman-negro font-bold text-lg rounded-sm border border-aleman-negro/30 flex items-center justify-center cursor-pointer transition-colors"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    value={modalEditarItem.nuevaCantidad}
                    onChange={(e) =>
                      setModalEditarItem((prev) => ({
                        ...prev,
                        nuevaCantidad: e.target.value,
                        errorCantidad: '',
                      }))
                    }
                    className="flex-1 px-3 py-2 text-center text-base font-bold bg-white border border-aleman-negro/30 rounded-sm text-aleman-negro focus:outline-hidden focus:border-aleman-negro focus:ring-1 focus:ring-aleman-negro"
                    required
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setModalEditarItem((prev) => ({
                        ...prev,
                        nuevaCantidad: Number(prev.nuevaCantidad || 1) + 1,
                        errorCantidad: '',
                      }))
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
                        (Number(modalEditarItem.nuevaCantidad) || 0)
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
                  placeholder="Ej: Sin sal, bien tostada, salsa aparte..."
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
      {/* MODAL ELIMINAR ÍTEM DE PEDIDO TAKE AWAY */}
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
                  Eliminar Ítem de Pedido
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
                  ¿Confirmás que deseás quitar este ítem del pedido?
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

      {/* Modal de Vista Previa de Impresión */}
      <ModalPreviaImpresion
        isOpen={Boolean(modalImpresionData)}
        onClose={() => setModalImpresionData(null)}
        datos={modalImpresionData}
      />
    </div>
  );
}
