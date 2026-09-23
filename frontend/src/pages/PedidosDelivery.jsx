import { useState, useMemo, useEffect, Fragment } from 'react';
import { useAuth } from '../context/useAuth';
import apiClient from '../services/apiClient';
import ModalPreviaImpresion from '../components/ModalPreviaImpresion';
import {
  mockProductos,
  mockPromociones,
  mockCategorias,
  formatCurrency,
} from '../services/mockData';

// Configuración de los 3 estados reales de Delivery
const ESTADOS_DELIVERY = [
  {
    key: 'cocina',
    label: 'Cocina',
    icon: '🍳',
    checkpointIcon: '🍳',
    colorText: 'text-blue-900',
    colorBg: 'bg-blue-100',
    colorBorder: 'border-blue-300',
    colBgHeader: 'bg-blue-100 text-blue-900 border-blue-300',
    badgeClass: 'bg-blue-100 text-blue-900 border-blue-300',
    dotClass: 'bg-blue-600',
    siguienteEstado: 'en_camino',
    btnSiguienteTexto: '🛵 Marcar en camino',
  },
  {
    key: 'en_camino',
    label: 'En camino',
    icon: '🛵',
    checkpointIcon: '🛵',
    colorText: 'text-purple-900',
    colorBg: 'bg-purple-100',
    colorBorder: 'border-purple-300',
    colBgHeader: 'bg-purple-100 text-purple-900 border-purple-300',
    badgeClass: 'bg-purple-100 text-purple-900 border-purple-300',
    dotClass: 'bg-purple-600',
    siguienteEstado: 'entregado',
    btnSiguienteTexto: '✅ Marcar entregado',
  },
  {
    key: 'entregado',
    label: 'Entregado',
    icon: '🏠',
    checkpointIcon: '🏠',
    colorText: 'text-aleman-negro',
    colorBg: 'bg-aleman-crema',
    colorBorder: 'border-aleman-negro/20',
    colBgHeader: 'bg-aleman-crema text-aleman-negro border-aleman-negro/20',
    badgeClass: 'bg-aleman-crema text-aleman-negro/80 border-aleman-negro/20',
    dotClass: 'bg-slate-400',
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

// Pedidos iniciales mockeados de ejemplo en los 3 estados de Delivery
const mockPedidosDeliveryIniciales = [
  {
    id: 'DEL-101',
    sucursalId: 'sucursal-1',
    numero: 101,
    cliente: 'Juan Pérez',
    telefono: '11-4567-8901',
    direccion: 'Av. Rivadavia 4520, Piso 4 Depto B (timbre Pérez)',
    notasEntrega: 'Paga en efectivo con $20.000 (llevar vuelto)',
    estado: 'cocina',
    horaCreacion: '20:15',
    historialEstados: [
      { estado: 'cocina', hora: '20:15', nota: 'Pedido recibido en cocina' },
    ],
    items: [
      {
        id: 'item-d1',
        tipo: 'producto',
        nombre: 'Pizza Muzzarella Tradicional',
        precioUnitario: 7500,
        cantidad: 1,
        aclaracion: 'Bien dorada, cortar en 8 porciones',
      },
      {
        id: 'item-d2',
        tipo: 'producto',
        nombre: 'Coca-Cola 500ml',
        precioUnitario: 2200,
        cantidad: 1,
        aclaracion: 'Bien fría',
      },
    ],
  },
  {
    id: 'DEL-102',
    sucursalId: 'sucursal-1',
    numero: 102,
    cliente: 'Lucía Morales',
    telefono: '11-9876-5432',
    direccion: 'Corrientes 3200, PB 2 (portón negro)',
    notasEntrega: 'Avisar por WhatsApp al llegar',
    estado: 'cocina',
    horaCreacion: '20:05',
    historialEstados: [
      { estado: 'cocina', hora: '20:05', nota: 'Pedido recibido en cocina' },
    ],
    items: [
      {
        id: 'item-d3',
        tipo: 'promocion',
        nombre: 'Combo Pareja: Especial + Cerveza Quilmes',
        precioUnitario: 11900,
        cantidad: 1,
        aclaracion: 'Cerveza bien helada',
      },
    ],
  },
  {
    id: 'DEL-103',
    sucursalId: 'sucursal-1',
    numero: 103,
    cliente: 'Carlos Gómez',
    telefono: '11-3322-1100',
    direccion: 'Medrano 850, timbre Gómez',
    notasEntrega: 'Dejar en recepción con encargado',
    estado: 'en_camino',
    horaCreacion: '19:45',
    historialEstados: [
      { estado: 'cocina', hora: '19:45', nota: 'Elaboración en cocina' },
      { estado: 'en_camino', hora: '20:10', nota: 'Salida con cadete en moto' },
    ],
    items: [
      {
        id: 'item-d4',
        tipo: 'producto',
        nombre: 'Empanada de Carne Criolla',
        precioUnitario: 1500,
        cantidad: 6,
        aclaracion: 'Con limón extra',
      },
      {
        id: 'item-d5',
        tipo: 'producto',
        nombre: 'Coca-Cola 500ml',
        precioUnitario: 2200,
        cantidad: 2,
        aclaracion: '',
      },
    ],
  },
  {
    id: 'DEL-104',
    sucursalId: 'sucursal-1',
    numero: 104,
    cliente: 'Mariana Rossi',
    telefono: '11-7788-9900',
    direccion: 'Castro Barros 120 (entre Belgrano e Yrigoyen)',
    notasEntrega: 'Pagó por transferencia previa',
    estado: 'entregado',
    horaCreacion: '19:10',
    historialEstados: [
      { estado: 'cocina', hora: '19:10', nota: 'Elaboración en cocina' },
      { estado: 'en_camino', hora: '19:35', nota: 'En reparto' },
      { estado: 'entregado', hora: '19:55', nota: 'Entregado al cliente' },
    ],
    items: [
      {
        id: 'item-d6',
        tipo: 'producto',
        nombre: 'Pizza Especial Jamón y Morrones',
        precioUnitario: 9800,
        cantidad: 1,
        aclaracion: 'Sin aceitunas',
      },
    ],
  },
];

export default function PedidosDelivery() {
  const { user } = useAuth();
  const esDueno = user?.rol === 'dueno';
  const esEncargado = user?.rol === 'encargado';
  const puedeModificarComanda = esDueno || esEncargado;

  const [pedidos, setPedidos] = useState([]);
  const [productos, setProductos] = useState([]);
  const [promociones, setPromociones] = useState([]);

  // Filtros y modo de vista ("Camino" de checkpoints con moto o "Lista" tabla)
  const [filtroEstado, setFiltroEstado] = useState('todos'); // 'todos' | 'cocina' | 'en_camino' | 'entregado'
  const [vistaModo, setVistaModo] = useState('camino'); // 'camino' | 'lista'
  const [busqueda, setBusqueda] = useState('');

  // Carga completa de pedidos de delivery desde el backend
  const cargarDatosDelivery = async () => {
    try {
      const endpointPedidos = '/pedidos-delivery?incluirCerrados=true';

      const [resDel, resProd, resPromos] = await Promise.all([
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

      const listDel = (resDel.data?.pedidos || []).map((p, idx) => {
        const cliObj = typeof p.clienteId === 'object' ? p.clienteId : null;
        const horaStr = p.createdAt
          ? new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : '20:00';

        const stRaw = p.estadoDelivery || p.estado || 'cocina';
        const st = (stRaw === 'pendiente' || stRaw === 'en_preparacion') ? 'cocina' : stRaw;

        return {
          id: p._id || p.id,
          _id: p._id || p.id,
          numero: p.numero || idx + 101,
          cliente: cliObj ? cliObj.nombre : 'Cliente Delivery',
          telefono: cliObj ? cliObj.telefono : '',
          direccion: p.direccionEntrega || (cliObj ? cliObj.direccion : ''),
          notasEntrega: '',
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
              grupoPromocionId: i.grupoPromocionId || null,
              promocionNombre: i.promocionNombre || null,
            };
          }),
        };
      });

      setPedidos(listDel);
    } catch {
      showToast('Error al cargar los pedidos de delivery desde el servidor');
    }
  };

  useEffect(() => {
    cargarDatosDelivery();
  }, []);

  // Modales
  const [isModalNuevoOpen, setIsModalNuevoOpen] = useState(false);
  const [pedidoDetalleId, setPedidoDetalleId] = useState(null);
  const [modalCobroDelivery, setModalCobroDelivery] = useState(null); // { pedido, total, medioPago }
  const [modalImpresionData, setModalImpresionData] = useState(null);
  const [modalEditarItem, setModalEditarItem] = useState(null); // { item, index, nuevaCantidad, nuevaAclaracion, motivo, errorMotivo, errorCantidad }
  const [modalEliminarItem, setModalEliminarItem] = useState(null); // { item, index, motivo, errorMotivo }
  const [, setHistorialModificaciones] = useState([]);

  // Estado para el formulario de Nuevo Pedido
  const [nuevoCliente, setNuevoCliente] = useState('');
  const [nuevoTelefono, setNuevoTelefono] = useState('');
  const [nuevaDireccion, setNuevaDireccion] = useState('');
  const [nuevasNotas, setNuevasNotas] = useState('');
  const [carritoItems, setCarritoItems] = useState([]);

  // Estado del builder de items dentro del modal de nuevo pedido
  const [tipoSeleccionItem, setTipoSeleccionItem] = useState('productos'); // 'productos' | 'promociones'
  const [categoriaFiltro, setCategoriaFiltro] = useState('todas');
  const [busquedaItem, setBusquedaItem] = useState('');
  const [itemIdSeleccionado, setItemIdSeleccionado] = useState('');
  const [cantidadItem, setCantidadItem] = useState(1);
  const [aclaracionItem, setAclaracionItem] = useState('');

  // Notificación toast
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Pedido seleccionado para ver detalle
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
  // AVANZAR ESTADO DEL SEMÁFORO (INTERCEPTA 'ENTREGADO' PARA COBRO)
  // =========================================================

  const handleAvanzarEstado = async (pedidoId, nuevoEstadoDirecto = null) => {
    const ped = pedidos.find((p) => p.id === pedidoId || p._id === pedidoId);
    if (!ped) return;

    let proximoEstado = nuevoEstadoDirecto;
    if (!proximoEstado) {
      const configEstadoActual = ESTADOS_DELIVERY.find(
        (e) => e.key === ped.estado
      );
      proximoEstado = configEstadoActual?.siguienteEstado || ped.estado;
    }

    // Si avanza a "entregado", abrimos el selector de medio de pago
    if (proximoEstado === 'entregado' && ped.estado !== 'entregado') {
      const total = calcularTotalPedido(ped);
      setPedidoDetalleId(null);
      setModalCobroDelivery({
        pedido: ped,
        total,
        medioPago: 'efectivo',
      });
      return;
    }

    try {
      await apiClient.patch(`/pedidos-delivery/${ped._id || ped.id}/estado`, {
        estadoDelivery: proximoEstado,
      });
      showToast(
        `Pedido #${ped.numero || pedidoId} actualizado a "${proximoEstado}"`
      );
      cargarDatosDelivery();
    } catch (err) {
      alert(err.response?.data?.mensaje || 'Error al cambiar estado del delivery');
    }
  };

  const handleConfirmarCobroDelivery = async (e) => {
    e.preventDefault();
    if (!modalCobroDelivery) return;

    const { pedido, medioPago } = modalCobroDelivery;
    const targetId = pedido._id || pedido.id;
    const medioPagoBackend = (medioPago === 'tarjeta' || medioPago === 'debito_credito')
      ? 'debito_credito'
      : (medioPago === 'transferencia' ? 'transferencia' : 'efectivo');

    try {
      // 1. Si aún no está en 'entregado', avanzamos el estado a 'entregado' primero
      if (pedido.estado !== 'entregado') {
        await apiClient.patch(`/pedidos-delivery/${targetId}/estado`, {
          estadoDelivery: 'entregado',
        });
      }

      // 2. Inmediatamente después, cerramos y cobramos el pedido
      await apiClient.post(`/pedidos-delivery/${targetId}/cerrar`, {
        medioPago: medioPagoBackend,
      });

      const numPed = pedido.numero;
      setModalCobroDelivery(null);
      setPedidoDetalleId(null);
      showToast(`✅ Pedido #${numPed} marcado como Entregado y cobrado (${medioPagoBackend})`);
      cargarDatosDelivery();
    } catch (err) {
      if (err.response?.status === 409) {
        alert('⚠️ No hay un turno de caja abierto.\n\nPor favor, ingresá al módulo de Caja y abrí un turno antes de cobrar el pedido.');
      } else {
        alert(err.response?.data?.mensaje || 'Error al cerrar y cobrar pedido de delivery');
      }
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
        `/pedidos-delivery/${pedidoActual._id || pedidoActual.id}/items/${item._id || item.id}`,
        {
          cantidad: cantNum,
          aclaraciones: nuevaAclaracion.trim(),
          motivo: motivo.trim(),
        }
      );
      showToast(`✏️ Ítem "${item.nombre}" actualizado.`);
      setModalEditarItem(null);
      cargarDatosDelivery();
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
        `/pedidos-delivery/${pedidoActual._id || pedidoActual.id}/items/${item._id || item.id}`,
        {
          data: { motivo: motivo.trim() },
        }
      );
      showToast(`🗑️ Ítem "${item.nombre}" eliminado del pedido.`);
      setModalEliminarItem(null);
      cargarDatosDelivery();
    } catch (err) {
      const msg = err.response?.data?.mensaje || 'Error al eliminar ítem';
      setModalEliminarItem((prev) => ({ ...prev, errorMotivo: msg }));
      alert(msg);
    }
  };

  // =========================================================
  // CARGA DE NUEVO PEDIDO
  // =========================================================

  const handleOpenNuevoPedidoModal = () => {
    setNuevoCliente('');
    setNuevoTelefono('');
    setNuevaDireccion('');
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

  const handleCrearPedidoDelivery = async (e) => {
    e.preventDefault();

    if (!nuevoCliente.trim()) {
      alert('Por favor ingresá el nombre del cliente.');
      return;
    }

    if (!nuevoTelefono.trim()) {
      alert('Por favor ingresá un número de teléfono de contacto.');
      return;
    }

    if (!nuevaDireccion.trim()) {
      alert('Por favor ingresá la dirección de entrega.');
      return;
    }

    if (carritoItems.length === 0) {
      alert('Debes agregar al menos un producto o combo al pedido.');
      return;
    }

    try {
      const payload = {
        nombreCliente: nuevoCliente.trim(),
        telefono: nuevoTelefono.trim(),
        direccionEntrega: nuevaDireccion.trim(),
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

      await apiClient.post('/pedidos-delivery', payload);
      showToast('🛵 Pedido de Delivery creado exitosamente');
      setIsModalNuevoOpen(false);
      cargarDatosDelivery();
    } catch (err) {
      alert(err.response?.data?.mensaje || 'Error al crear el pedido de delivery');
    }
  };

  // =========================================================
  // SIMULACIÓN DE IMPRESIÓN
  // =========================================================

  const handleImprimirComanda = (pedido) => {
    if (!pedido) return;
    setModalImpresionData({
      canal: 'delivery',
      numeroPedido: pedido.numero,
      cliente: pedido.cliente,
      telefono: pedido.telefono,
      direccion: pedido.direccion,
      notasEntrega: pedido.notasEntrega,
      fecha: pedido.horaCreacion,
      items: pedido.items || [],
      total: calcularTotalPedido(pedido),
      medioPago: pedido.medioPago || 'Efectivo',
      vistaInicial: 'cocina',
    });
  };

  const handleImprimirTicket = (pedido) => {
    if (!pedido) return;
    setModalImpresionData({
      canal: 'delivery',
      numeroPedido: pedido.numero,
      cliente: pedido.cliente,
      telefono: pedido.telefono,
      direccion: pedido.direccion,
      notasEntrega: pedido.notasEntrega,
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
      if (filtroEstado !== 'todos') {
        if (filtroEstado === 'cocina') {
          if (p.estado !== 'cocina' && p.estado !== 'pendiente' && p.estado !== 'en_preparacion') return false;
        } else if (p.estado !== filtroEstado) {
          return false;
        }
      }

      // Filtro de búsqueda
      if (busqueda.trim()) {
        const term = busqueda.toLowerCase();
        const matchCliente = p.cliente.toLowerCase().includes(term);
        const matchDireccion = p.direccion.toLowerCase().includes(term);
        const matchTel = p.telefono.toLowerCase().includes(term);
        const matchId = String(p.numero).includes(term) || p.id.toLowerCase().includes(term);
        if (!matchCliente && !matchDireccion && !matchTel && !matchId) return false;
      }

      return true;
    });
  }, [pedidos, filtroEstado, busqueda]);

  const statsDelivery = useMemo(() => {
    const total = pedidos.length;
    const enCocina = pedidos.filter((p) =>
      ['cocina', 'pendiente', 'en_preparacion', 'listo'].includes(p.estado)
    ).length;
    const enCamino = pedidos.filter((p) => p.estado === 'en_camino').length;
    const entregados = pedidos.filter((p) => p.estado === 'entregado').length;

    const activos = enCocina + enCamino;
    const ventaTotal = pedidos.reduce((acc, p) => acc + calcularTotalPedido(p), 0);

    return {
      total,
      enCocina,
      enCamino,
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
          <span>🛵</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ========================================================= */}
      {/* ENCABEZADO Y ACCIÓN NUEVO PEDIDO */}
      {/* ========================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-aleman-negro">
            Gestión de Pedidos Delivery
          </h1>
          <p className="text-base text-aleman-negro/70">
            Seguimiento en tiempo real de envíos a domicilio, comanda y despacho
          </p>
        </div>

        <button
          onClick={handleOpenNuevoPedidoModal}
          className="px-4 py-2.5 bg-aleman-rojo hover:bg-aleman-rojo-dark text-aleman-hueso font-bold text-base rounded-sm border border-aleman-negro/40 shadow-sm transition-colors flex items-center justify-center gap-2 self-start sm:self-auto cursor-pointer uppercase tracking-wider"
        >
          <span className="text-lg leading-none font-bold">+</span> Nuevo Pedido Delivery
        </button>
      </div>

      {/* ========================================================= */}
      {/* TARJETAS KPI / MÉTRICAS DE DELIVERY */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Pedidos Activos */}
        <div className="bg-aleman-hueso rounded-sm p-5 border-2 border-aleman-negro/20 flex items-center justify-between">
          <div>
            <span className="text-sm font-bold uppercase tracking-wider text-aleman-negro/70 block">
              Pedidos Activos en Curso
            </span>
            <div className="text-2xl font-display font-bold text-aleman-negro mt-1">
              {statsDelivery.activos}{' '}
              <span className="text-sm text-aleman-negro/50 font-normal">
                ({statsDelivery.total} totales)
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1 text-sm font-semibold">
              <span className="text-blue-900">🍳 {statsDelivery.enCocina} en cocina</span>
              <span className="text-aleman-negro/30">•</span>
              <span className="text-purple-900">🛵 {statsDelivery.enCamino} en camino</span>
            </div>
          </div>
          <div className="p-3 bg-aleman-crema border border-aleman-negro/15 text-aleman-dorado rounded-sm text-2xl">
            🛵
          </div>
        </div>

        {/* Card 2: En camino */}
        <div className="bg-aleman-hueso rounded-sm p-5 border-2 border-aleman-negro/20 flex items-center justify-between">
          <div>
            <span className="text-sm font-bold uppercase tracking-wider text-aleman-negro/70 block">
              En Despacho / En Camino
            </span>
            <div className="text-2xl font-display font-bold text-purple-900 mt-1">
              {statsDelivery.enCamino} en reparto
            </div>
            <span className="text-sm text-blue-900 font-bold block mt-1">
              🍳 {statsDelivery.enCocina} preparándose en cocina
            </span>
          </div>
          <div className="p-3 bg-aleman-crema border border-aleman-negro/15 text-purple-900 rounded-sm text-2xl">
            🛣️
          </div>
        </div>

        {/* Card 3: Ventas Delivery */}
        <div className="bg-aleman-hueso rounded-sm p-5 border-2 border-aleman-negro/20 flex items-center justify-between">
          <div>
            <span className="text-sm font-bold uppercase tracking-wider text-aleman-negro/70 block">
              Ventas Totales Delivery
            </span>
            <div className="text-2xl font-display font-bold text-aleman-negro mt-1">
              {formatCurrency(statsDelivery.ventaTotal)}
            </div>
            <span className="text-sm text-aleman-negro/60 font-medium block mt-1">
              ✅ {statsDelivery.entregados} pedidos entregados
            </span>
          </div>
          <div className="p-3 bg-aleman-crema border border-aleman-negro/15 text-emerald-800 rounded-sm text-2xl">
            💰
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* BARRA DE FILTROS Y SELECTOR DE VISTA (CAMINO VS LISTA) */}
      {/* ========================================================= */}
      <div className="bg-aleman-hueso rounded-sm p-4 border-2 border-aleman-negro/20 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Selector de modo de vista: SOLO DOS OPCIONES (Camino y Lista) */}
          <div className="flex bg-aleman-crema p-1 rounded-sm border border-aleman-negro/15">
            <button
              onClick={() => setVistaModo('camino')}
              className={`px-3.5 py-1.5 rounded-sm text-sm font-bold transition-all cursor-pointer ${
                vistaModo === 'camino'
                  ? 'bg-aleman-dorado text-aleman-negro shadow-2xs'
                  : 'text-aleman-negro/70 hover:text-aleman-negro'
              }`}
            >
              🛵 Camino
            </button>
            <button
              onClick={() => setVistaModo('lista')}
              className={`px-3.5 py-1.5 rounded-sm text-sm font-bold transition-all cursor-pointer ${
                vistaModo === 'lista'
                  ? 'bg-aleman-dorado text-aleman-negro shadow-2xs'
                  : 'text-aleman-negro/70 hover:text-aleman-negro'
              }`}
            >
              📑 Lista
            </button>
          </div>

          {/* Selector de estado (los 3 estados nuevos) */}
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="px-3 py-1.5 bg-white border-2 border-aleman-negro/25 rounded-sm text-sm text-aleman-negro focus:border-aleman-verde focus:outline-none font-semibold"
          >
            <option value="todos">Todos los estados ({pedidos.length})</option>
            <option value="cocina">🍳 Cocina ({statsDelivery.enCocina})</option>
            <option value="en_camino">🛵 En camino ({statsDelivery.enCamino})</option>
            <option value="entregado">🏠 Entregados ({statsDelivery.entregados})</option>
          </select>

          {/* Input Buscador */}
          <div className="relative min-w-[220px]">
            <input
              type="text"
              placeholder="Buscar cliente, tel, dirección..."
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
      {/* VISTA 1: CAMINO DE DELIVERY (3 CHECKPOINTS CON LA MOTO) */}
      {/* ========================================================= */}
      {vistaModo === 'camino' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-start">
          {pedidosFiltrados.length === 0 ? (
            <div className="col-span-full py-16 text-center bg-aleman-hueso rounded-sm border-2 border-dashed border-aleman-negro/20 p-6">
              <span className="text-3xl block mb-2">🛵</span>
              <h4 className="font-display font-bold text-base uppercase tracking-wider text-aleman-negro">
                No se encontraron pedidos
              </h4>
              <p className="text-sm text-aleman-negro/60 mt-1">
                No hay pedidos de delivery que coincidan con el filtro seleccionado.
              </p>
            </div>
          ) : (
            pedidosFiltrados.map((pedido) => {
              const total = calcularTotalPedido(pedido);
              const estConfig =
                ESTADOS_DELIVERY.find((e) => e.key === pedido.estado) || ESTADOS_DELIVERY[0];
              const stepIndex =
                pedido.estado === 'cocina' ? 0 : pedido.estado === 'en_camino' ? 1 : 2;

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

                    {/* Cliente & Dirección */}
                    <div>
                      <h4 className="font-display font-bold text-lg text-aleman-negro group-hover:text-aleman-rojo transition-colors leading-tight">
                        {pedido.cliente}
                      </h4>
                      <div className="text-sm text-aleman-negro/80 font-medium flex items-start gap-1.5 mt-1">
                        <span className="shrink-0 text-aleman-negro/50">📍</span>
                        <span className="line-clamp-2 leading-tight">
                          {pedido.direccion}
                        </span>
                      </div>
                      <div className="text-xs text-aleman-negro/60 mt-1 flex items-center gap-1 font-semibold">
                        <span>📞</span> {pedido.telefono}
                      </div>
                      {pedido.notasEntrega && (
                        <div className="text-xs text-amber-900 bg-amber-50 border border-amber-300 p-1.5 rounded-sm font-semibold mt-2">
                          Nota: {pedido.notasEntrega}
                        </div>
                      )}
                    </div>

                    {/* ========================================================= */}
                    {/* CHECKPOINTS CON LA MOTO (3 ESTADOS) */}
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
                          { key: 'cocina', label: 'Cocina', icon: '🍳' },
                          { key: 'en_camino', label: 'En camino', icon: '🛵' },
                          { key: 'entregado', label: 'Entregado', icon: '🏠' },
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

                      {/* Moto indicadora de posición sobre la pista */}
                      <div className="mt-2.5 text-center text-[11px] font-bold text-aleman-negro/80 bg-aleman-hueso/80 py-1 rounded-xs border border-aleman-negro/10">
                        {stepIndex === 0 && '🍳 1. En preparación en Cocina'}
                        {stepIndex === 1 && '🛵 2. Moto en camino al domicilio'}
                        {stepIndex === 2 && '🏠 3. Entregado al cliente'}
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
                      {estConfig.siguienteEstado ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAvanzarEstado(pedido.id);
                          }}
                          className={`px-3 py-1.5 text-xs font-bold rounded-sm uppercase tracking-wider transition-colors cursor-pointer border shadow-2xs ${
                            pedido.estado === 'cocina'
                              ? 'bg-aleman-verde hover:bg-aleman-verde-dark text-aleman-hueso border-aleman-dorado/40'
                              : 'bg-aleman-rojo hover:bg-aleman-rojo-dark text-aleman-hueso border-aleman-negro/30'
                          }`}
                          title={estConfig.btnSiguienteTexto}
                        >
                          {estConfig.btnSiguienteTexto}
                        </button>
                      ) : (
                        <span className="text-xs font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-1 rounded-sm">
                          ✅ Entregado
                        </span>
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
      {/* VISTA 2: LISTA DETALLADA DE PEDIDOS (TABLA EN DESKTOP / CARDS EN MOBILE) */}
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
                    <th className="py-3.5 px-6">Dirección de Entrega</th>
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
                        No se encontraron pedidos de delivery con los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    pedidosFiltrados.map((pedido) => {
                      const total = calcularTotalPedido(pedido);
                      const estadoObj =
                        ESTADOS_DELIVERY.find((e) => e.key === pedido.estado) ||
                        ESTADOS_DELIVERY[0];

                      return (
                        <tr
                          key={pedido.id}
                          onClick={() => setPedidoDetalleId(pedido.id)}
                          className="hover:bg-aleman-crema/50 transition-colors cursor-pointer"
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

                          {/* Dirección */}
                          <td className="py-4 px-6 max-w-xs">
                            <div className="text-sm text-aleman-negro font-medium">
                              📍 {pedido.direccion}
                            </div>
                            {pedido.notasEntrega && (
                              <div className="text-xs text-amber-900 italic font-semibold mt-0.5">
                                Nota: {pedido.notasEntrega}
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
                                className="px-2.5 py-1 text-sm font-bold uppercase tracking-wider bg-aleman-rojo hover:bg-aleman-rojo-dark text-aleman-hueso rounded-sm border border-aleman-negro/40 transition-colors cursor-pointer"
                              >
                                {pedido.estado === 'cocina' ? 'Marcar en camino' : 'Marcar entregado'}
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
                No se encontraron pedidos de delivery con los filtros seleccionados.
              </div>
            ) : (
              pedidosFiltrados.map((pedido) => {
                const total = calcularTotalPedido(pedido);
                const estadoObj =
                  ESTADOS_DELIVERY.find((e) => e.key === pedido.estado) ||
                  ESTADOS_DELIVERY[0];

                return (
                  <div
                    key={pedido.id}
                    onClick={() => setPedidoDetalleId(pedido.id)}
                    className="bg-aleman-hueso rounded-sm p-4 border-2 border-aleman-negro/20 hover:border-aleman-dorado transition-colors cursor-pointer space-y-3 shadow-2xs"
                  >
                    {/* Arriba: número de pedido + badge de estado + hora */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-display font-bold text-base bg-aleman-crema text-aleman-negro px-2.5 py-0.5 rounded-sm border border-aleman-negro/20">
                          #{pedido.numero}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-sm text-xs font-bold border ${estadoObj.badgeClass}`}
                        >
                          <span>{estadoObj.icon}</span> {estadoObj.label}
                        </span>
                      </div>
                      <span className="text-xs text-aleman-negro/60 font-semibold shrink-0">
                        🕒 {pedido.horaCreacion}
                      </span>
                    </div>

                    {/* Debajo: nombre del cliente y teléfono */}
                    <div>
                      <div className="font-display font-bold text-base text-aleman-negro">
                        {pedido.cliente}
                      </div>
                      <div className="text-sm text-aleman-negro/70 font-semibold flex items-center gap-1 mt-0.5">
                        <span>📞</span> {pedido.telefono}
                      </div>
                    </div>

                    {/* Debajo: dirección */}
                    <div>
                      <div className="text-sm text-aleman-negro font-medium flex items-start gap-1.5">
                        <span className="shrink-0 text-aleman-negro/50">📍</span>
                        <span>{pedido.direccion}</span>
                      </div>
                      {pedido.notasEntrega && (
                        <div className="text-xs text-amber-900 bg-amber-50 border border-amber-300 p-1.5 rounded-sm font-semibold mt-1.5">
                          Nota: {pedido.notasEntrega}
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
                            className="px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider bg-aleman-rojo hover:bg-aleman-rojo-dark text-aleman-hueso rounded-sm border border-aleman-negro/40 transition-colors cursor-pointer"
                          >
                            {pedido.estado === 'cocina' ? 'Marcar en camino' : 'Marcar entregado'}
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
      {/* MODAL: NUEVO PEDIDO DELIVERY */}
      {/* ========================================================= */}
      {isModalNuevoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-aleman-negro/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-aleman-hueso rounded-sm border-2 border-aleman-negro w-full max-w-4xl my-4 overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b-2 border-aleman-dorado flex items-center justify-between bg-aleman-verde text-aleman-hueso">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🛵</span>
                <div>
                  <h3 className="text-xl font-display font-bold uppercase tracking-wider">
                    Nuevo Pedido Delivery
                  </h3>
                  <p className="text-sm text-aleman-hueso/70">
                    Cargá los datos del cliente, dirección y productos solicitados
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

            {/* Modal Body: Split Form & Item Builder */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Sección 1: Datos del Cliente y Envío */}
              <div className="p-4 bg-aleman-crema border-2 border-aleman-negro/15 rounded-sm space-y-4">
                <h4 className="text-sm font-display font-bold text-aleman-negro uppercase tracking-wider">
                  Datos de Entrega y Contacto
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-aleman-negro uppercase tracking-wider mb-1.5">
                      Nombre del Cliente *
                    </label>
                    <input
                      type="text"
                      value={nuevoCliente}
                      onChange={(e) => setNuevoCliente(e.target.value)}
                      placeholder="Ej: Marcelo Tinelli"
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
                      placeholder="Ej: 11-4567-8901"
                      required
                      className="w-full px-3.5 py-2.5 bg-white border-2 border-aleman-negro/25 rounded-sm text-base text-aleman-negro focus:border-aleman-verde focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-sm font-bold text-aleman-negro uppercase tracking-wider mb-1.5">
                      Dirección de Entrega (Calle, altura, piso/depto, referencias) *
                    </label>
                    <input
                      type="text"
                      value={nuevaDireccion}
                      onChange={(e) => setNuevaDireccion(e.target.value)}
                      placeholder="Ej: Av. Santa Fe 2450, 6to B (entre Pueyrredón y Larrea, timbre 6B)"
                      required
                      className="w-full px-3.5 py-2.5 bg-white border-2 border-aleman-negro/25 rounded-sm text-base text-aleman-negro font-semibold focus:border-aleman-verde focus:outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-sm font-bold text-aleman-negro uppercase tracking-wider mb-1.5">
                      Aclaraciones de Entrega / Pago (Opcional)
                    </label>
                    <input
                      type="text"
                      value={nuevasNotas}
                      onChange={(e) => setNuevasNotas(e.target.value)}
                      placeholder="Ej: Paga con $10.000 en efectivo, dejar con seguridad en recepción..."
                      className="w-full px-3.5 py-2 bg-white border-2 border-aleman-negro/25 rounded-sm text-sm text-aleman-negro focus:border-aleman-verde focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Sección 2: Carga de Productos y Combos */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Selector de ítems (Columna Izquierda 6 cols) */}
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
                        placeholder="Ej: sin aceitunas..."
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

                {/* Carrito del pedido (Columna Derecha 6 cols) */}
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
                        No agregaste ítems al pedido todavía.
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

                  {/* Resumen Total */}
                  <div className="pt-2 border-t-2 border-aleman-negro/10 flex items-center justify-between">
                    <span className="text-sm font-bold text-aleman-negro/70 uppercase tracking-wider">
                      Total del Pedido:
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
                  onClick={handleCrearPedidoDelivery}
                  className="px-6 py-2 text-sm font-bold uppercase tracking-wider text-aleman-hueso bg-aleman-rojo hover:bg-aleman-rojo-dark rounded-sm border border-aleman-negro/40 shadow-sm transition-colors cursor-pointer"
                >
                  Crear Pedido Delivery (Cocina)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL / DRAWER: DETALLE COMPLETO DE PEDIDO DELIVERY */}
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
                      Pedido Delivery #{pedidoActual.numero}
                    </h3>
                    {(() => {
                      const estObj =
                        ESTADOS_DELIVERY.find(
                          (e) => e.key === pedidoActual.estado
                        ) || ESTADOS_DELIVERY[0];
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
                    🕒 Creado a las {pedidoActual.horaCreacion}
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
                  title="Imprimir ticket para repartidor/cliente"
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
              {/* Card Datos Cliente & Entrega */}
              <div className="p-4 bg-aleman-crema border-2 border-aleman-negro/15 rounded-sm space-y-3">
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

                <div className="pt-2 border-t border-aleman-negro/15 text-xs">
                  <span className="text-aleman-negro/60 font-bold block uppercase tracking-wider text-xs">
                    Dirección de Entrega
                  </span>
                  <span className="text-base font-semibold text-aleman-negro block mt-0.5">
                    📍 {pedidoActual.direccion}
                  </span>
                  {pedidoActual.notasEntrega && (
                    <div className="mt-1 p-2 bg-amber-50 rounded-sm border border-amber-300 text-amber-950 text-sm font-semibold">
                      💡 <strong>Aclaración / Notas:</strong> {pedidoActual.notasEntrega}
                    </div>
                  )}
                </div>
              </div>

              {/* Semáforo Interactivo de Avance */}
              <div className="p-4 bg-aleman-hueso border-2 border-aleman-negro/20 rounded-sm space-y-3">
                <span className="text-sm font-display font-bold text-aleman-negro uppercase tracking-wider block">
                  Estado del Pedido (Camino de Delivery)
                </span>

                {/* Stepper Visual de 3 Checkpoints con la Moto */}
                <div className="py-2.5 px-3 bg-aleman-crema rounded-sm border border-aleman-negro/15">
                  <div className="relative flex items-center justify-between">
                    <div className="absolute left-6 right-6 top-4 h-1 bg-aleman-negro/20 z-0">
                      <div
                        className="h-full bg-aleman-dorado transition-all duration-300"
                        style={{
                          width:
                            pedidoActual.estado === 'cocina'
                              ? '0%'
                              : pedidoActual.estado === 'en_camino'
                              ? '50%'
                              : '100%',
                        }}
                      />
                    </div>

                    {[
                      { key: 'cocina', label: 'Cocina', icon: '🍳' },
                      { key: 'en_camino', label: 'En camino', icon: '🛵' },
                      { key: 'entregado', label: 'Entregado', icon: '🏠' },
                    ].map((step, idx) => {
                      const currentIdx =
                        pedidoActual.estado === 'cocina'
                          ? 0
                          : pedidoActual.estado === 'en_camino'
                          ? 1
                          : 2;
                      const isCompleted = idx < currentIdx;
                      const isCurrent = idx === currentIdx;

                      return (
                        <div key={step.key} className="relative z-10 flex flex-col items-center">
                          <div
                            className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
                              isCurrent
                                ? 'bg-aleman-dorado text-aleman-negro border-aleman-negro ring-4 ring-aleman-dorado/30 scale-110'
                                : isCompleted
                                ? 'bg-aleman-verde text-aleman-hueso border-aleman-verde-dark'
                                : 'bg-white text-aleman-negro/40 border-aleman-negro/30'
                            }`}
                          >
                            <span>{step.icon}</span>
                          </div>
                          <span
                            className={`text-[11px] font-bold mt-1 uppercase tracking-wider ${
                              isCurrent ? 'text-aleman-negro font-extrabold' : 'text-aleman-negro/60'
                            }`}
                          >
                            {step.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  {ESTADOS_DELIVERY.map((est) => {
                    const isCurrent = pedidoActual.estado === est.key;
                    return (
                      <button
                        key={est.key}
                        type="button"
                        onClick={() =>
                          handleAvanzarEstado(pedidoActual.id, est.key)
                        }
                        className={`px-3 py-1.5 rounded-sm text-sm font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
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
                                <span className="text-xs text-amber-900 italic font-semibold">
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

              {/* Historial de Cambios de Estado */}
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
                const estConfig = ESTADOS_DELIVERY.find(
                  (e) => e.key === pedidoActual.estado
                );
                if (estConfig?.siguienteEstado) {
                  return (
                    <button
                      type="button"
                      onClick={() => handleAvanzarEstado(pedidoActual.id)}
                      className="px-5 py-2 text-sm font-bold uppercase tracking-wider text-aleman-hueso bg-aleman-rojo hover:bg-aleman-rojo-dark rounded-sm border border-aleman-negro/40 shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <span>{estConfig.btnSiguienteTexto}</span>
                    </button>
                  );
                }
                return (
                  <span className="text-sm font-bold text-emerald-800 flex items-center gap-1">
                    <span>✅</span> Pedido completado
                  </span>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: SELECCIÓN DE MEDIO DE PAGO AL ENTREGAR DELIVERY */}
      {/* ========================================================= */}
      {modalCobroDelivery && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-aleman-negro/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-[#FAF7F0] rounded-sm border-2 border-aleman-negro w-full max-w-md overflow-hidden shadow-2xl relative z-[1010] isolate">
            {/* Header: Título + Cliente */}
            <div className="px-6 py-4 bg-aleman-verde text-aleman-hueso border-b-2 border-aleman-dorado flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">🛵</span>
                <div>
                  <h3 className="text-lg font-display font-bold uppercase tracking-wider">
                    Cobro Delivery #{modalCobroDelivery.pedido.numero}
                  </h3>
                  <span className="text-sm text-aleman-dorado font-bold">
                    Cliente: {modalCobroDelivery.pedido.cliente}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalCobroDelivery(null)}
                className="text-aleman-hueso/70 hover:text-aleman-hueso text-lg font-bold p-1 rounded transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleConfirmarCobroDelivery} className="p-6 space-y-5">
              {/* Tarjeta de Total + Dirección */}
              <div className="p-4 bg-aleman-crema border-2 border-aleman-negro/20 rounded-sm text-center shadow-xs">
                <span className="text-xs font-bold text-aleman-negro/70 uppercase tracking-wider block">
                  Total del Pedido a Cobrar
                </span>
                <span className="text-3xl font-display font-bold text-aleman-negro mt-1 block">
                  {formatCurrency(modalCobroDelivery.total)}
                </span>
                <span className="text-sm text-aleman-negro/80 block mt-1 font-semibold">
                  📍 {modalCobroDelivery.pedido.direccion}
                </span>
              </div>

              {/* Selector de Medio de Pago */}
              <div>
                <label className="block text-xs font-bold text-aleman-negro uppercase tracking-wider mb-2">
                  Medio de Pago Recibido *
                </label>
                <div className="grid grid-cols-1 gap-2.5">
                  {[
                    { id: 'efectivo', label: '💵 Efectivo', desc: 'Pago contra entrega al repartidor' },
                    { id: 'debito_credito', label: '💳 Tarjeta Débito / Crédito', desc: 'POS inalámbrico / Pago online' },
                    { id: 'transferencia', label: '📱 Transferencia / Mercado Pago', desc: 'QR o transferencia' },
                  ].map((op) => (
                    <label
                      key={op.id}
                      className={`flex items-center justify-between p-3 rounded-sm border-2 cursor-pointer transition-all ${
                        modalCobroDelivery.medioPago === op.id
                          ? 'border-aleman-dorado bg-aleman-dorado/15 shadow-xs'
                          : 'border-aleman-negro/20 hover:border-aleman-negro/40 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="medioPagoDelivery"
                          value={op.id}
                          checked={modalCobroDelivery.medioPago === op.id}
                          onChange={(e) =>
                            setModalCobroDelivery({
                              ...modalCobroDelivery,
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

              {/* Footer: Botones Cancelar y Confirmar */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t-2 border-aleman-negro/10">
                <button
                  type="button"
                  onClick={() => setModalCobroDelivery(null)}
                  className="px-4 py-2 text-sm font-bold uppercase tracking-wider text-aleman-negro hover:bg-aleman-crema rounded-sm border border-aleman-negro/25 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-bold uppercase tracking-wider text-aleman-hueso bg-aleman-rojo hover:bg-aleman-rojo-dark rounded-sm border border-aleman-negro/40 shadow-sm transition-colors cursor-pointer"
                >
                  Confirmar Cobro y Marcar Entregado
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ========================================================= */}
      {/* MODAL EDITAR ÍTEM DE PEDIDO DELIVERY */}
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
      {/* MODAL ELIMINAR ÍTEM DE PEDIDO DELIVERY */}
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
