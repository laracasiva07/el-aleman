import { useState, useEffect, useMemo, useCallback } from 'react';
import apiClient from '../services/apiClient';

const formatCurrency = (val) => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(val || 0);
};

/**
 * Función auxiliar para calcular en tiempo real los valores de una promo:
 * - Suma de precios de lista individuales
 * - Ahorro en $ y %
 * - Proporción y monto asignado a "Comida" y "Bebida"
 * - Desglose proporcional de cada ítem en el combo
 */
const calcularDetallePromo = (
  promo,
  productosList = [],
  categoriasList = []
) => {
  let sumaIndividualTotal = 0;
  let sumaIndividualComida = 0;
  let sumaIndividualBebida = 0;

  const rawItems = promo.productos || promo.items || [];
  const itemsValidos = rawItems.filter(
    (item) => (item.productoId?._id || item.productoId) && Number(item.cantidad) > 0
  );

  const itemsDetallados = itemsValidos.map((item) => {
    const targetProdId = item.productoId?._id || item.productoId;
    const prod = productosList.find(
      (p) => (p._id || p.id) === targetProdId
    );

    const targetCatId = prod?.categoriaId?._id || prod?.categoriaId;
    const cat = prod ? categoriasList.find((c) => (c._id || c.id) === targetCatId) : null;
    const tipo = cat?.tipo === 'bebida' ? 'bebida' : 'comida';
    const precioUnitario = prod ? prod.precioVenta : 0;
    const cantidad = Number(item.cantidad) || 0;
    const subtotalIndividual = precioUnitario * cantidad;

    sumaIndividualTotal += subtotalIndividual;
    if (tipo === 'bebida') {
      sumaIndividualBebida += subtotalIndividual;
    } else {
      sumaIndividualComida += subtotalIndividual;
    }

    return {
      productoId: targetProdId,
      nombre: prod ? prod.nombre : (item.productoId?.nombre || 'Producto no disponible'),
      categoriaNombre: cat?.nombre || (tipo === 'bebida' ? 'Bebidas' : 'Comida'),
      tipo,
      cantidad,
      precioUnitario,
      subtotalIndividual,
    };
  });

  const precioCombo = Number(promo.precioFijo || promo.precioCombo) || 0;
  const ahorro = sumaIndividualTotal - precioCombo;
  const porcentajeAhorro =
    sumaIndividualTotal > 0
      ? ((ahorro / sumaIndividualTotal) * 100).toFixed(1)
      : '0.0';

  const propComida =
    sumaIndividualTotal > 0 ? sumaIndividualComida / sumaIndividualTotal : 0;
  const propBebida =
    sumaIndividualTotal > 0 ? sumaIndividualBebida / sumaIndividualTotal : 0;

  const asignadoComida = precioCombo * propComida;
  const asignadoBebida = precioCombo * propBebida;

  const itemsConProporcion = itemsDetallados.map((it) => {
    const pesoEnCombo =
      sumaIndividualTotal > 0 ? it.subtotalIndividual / sumaIndividualTotal : 0;
    const precioAsignadoEnCombo = precioCombo * pesoEnCombo;
    const ahorroItem = it.subtotalIndividual - precioAsignadoEnCombo;

    return {
      ...it,
      pesoEnComboPct: (pesoEnCombo * 100).toFixed(1),
      precioAsignadoEnCombo,
      ahorroItem,
    };
  });

  return {
    sumaIndividualTotal,
    sumaIndividualComida,
    sumaIndividualBebida,
    precioCombo,
    ahorro,
    porcentajeAhorro,
    propComidaPct: (propComida * 100).toFixed(1),
    propBebidaPct: (propBebida * 100).toFixed(1),
    asignadoComida,
    asignadoBebida,
    items: itemsConProporcion,
    tieneComida: sumaIndividualComida > 0,
    tieneBebida: sumaIndividualBebida > 0,
  };
};

export default function Promociones() {
  const [promociones, setPromociones] = useState([]);
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todas'); // 'todas' | 'activas' | 'inactivas'

  // Filas expandidas para ver detalle en tabla
  const [expandedRowIds, setExpandedRowIds] = useState(new Set());

  // Estado del Modal de Crear / Editar
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPromoId, setEditingPromoId] = useState(null);

  const [formData, setFormData] = useState({
    nombre: '',
    precioCombo: '',
    activa: true,
    items: [],
  });

  // Cargar promociones, productos y categorías del backend
  const cargarDatos = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [resPromos, resProds, resCats] = await Promise.all([
        apiClient.get('/promociones'),
        apiClient.get('/productos'),
        apiClient.get('/categorias'),
      ]);

      const promosBack = (resPromos.data.promociones || []).map((p) => ({
        ...p,
        id: p._id,
        precioCombo: p.precioFijo,
        activa: p.activo,
        items: p.productos || [],
      }));

      setPromociones(promosBack);
      setProductos(resProds.data.productos || []);
      setCategorias(resCats.data.categorias || []);
    } catch (err) {
      console.error('Error al cargar catálogo de promociones:', err);
      setError(
        err.response?.data?.mensaje ||
          'Error al conectar con el backend de promociones.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // Toggle fila expandida
  const toggleRowExpansion = (id) => {
    setExpandedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Abrir modal para crear
  const handleOpenCreateModal = () => {
    setEditingPromoId(null);
    setFormData({
      nombre: '',
      precioCombo: '',
      activa: true,
      items: [
        {
          productoId: productos[0]?._id || productos[0]?.id || '',
          cantidad: 1,
        },
      ],
    });
    setIsModalOpen(true);
  };

  // Abrir modal para editar
  const handleOpenEditModal = (promo) => {
    const promoId = promo._id || promo.id;
    setEditingPromoId(promoId);

    const itemsMapeados = (promo.productos || promo.items || []).map((it) => ({
      productoId: it.productoId?._id || it.productoId,
      cantidad: it.cantidad,
    }));

    setFormData({
      nombre: promo.nombre,
      precioCombo: promo.precioFijo || promo.precioCombo,
      activa: promo.activo !== false && promo.activa !== false,
      items: itemsMapeados.length > 0 ? itemsMapeados : [
        { productoId: productos[0]?._id || '', cantidad: 1 }
      ],
    });
    setIsModalOpen(true);
  };

  // Cerrar modal
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingPromoId(null);
  };

  // Manejadores del constructor dinámico de items
  const handleAddItemRow = () => {
    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          productoId: productos[0]?._id || productos[0]?.id || '',
          cantidad: 1,
        },
      ],
    }));
  };

  const handleRemoveItemRow = (index) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const handleItemChange = (index, field, value) => {
    setFormData((prev) => {
      const updated = [...prev.items];
      updated[index] = {
        ...updated[index],
        [field]: field === 'cantidad' ? Math.max(1, Number(value) || 1) : value,
      };
      return { ...prev, items: updated };
    });
  };

  // Guardar (Crear / Editar) en backend
  const handleSavePromo = async (e) => {
    e.preventDefault();

    if (!formData.nombre.trim()) {
      alert('Por favor ingresá un nombre para la promoción.');
      return;
    }

    const precioNum = Number(formData.precioCombo);
    if (isNaN(precioNum) || precioNum < 0) {
      alert('Por favor ingresá un precio de combo válido mayor o igual a 0.');
      return;
    }

    const itemsValidos = formData.items
      .filter((it) => (it.productoId?._id || it.productoId) && Number(it.cantidad) > 0)
      .map((it) => ({
        productoId: it.productoId?._id || it.productoId,
        cantidad: Number(it.cantidad),
      }));

    if (itemsValidos.length === 0) {
      alert('Debés incluir al menos un producto con cantidad válida en la promoción.');
      return;
    }

    const payload = {
      nombre: formData.nombre.trim(),
      precioFijo: precioNum,
      productos: itemsValidos,
    };

    try {
      if (editingPromoId) {
        await apiClient.put(`/promociones/${editingPromoId}`, payload);
      } else {
        await apiClient.post('/promociones', payload);
      }

      handleCloseModal();
      cargarDatos();
    } catch (err) {
      alert(
        err.response?.data?.mensaje ||
          'Ocurrió un error al guardar la promoción en el servidor.'
      );
    }
  };

  // Toggle estado activa / inactiva en backend
  const handleToggleActiva = async (promo) => {
    const id = promo._id || promo.id;
    const nuevoEstado = !(promo.activo !== false && promo.activa !== false);

    try {
      await apiClient.patch(`/promociones/${id}/activo`, {
        activo: nuevoEstado,
      });
      cargarDatos();
    } catch (err) {
      alert(
        err.response?.data?.mensaje ||
          'Error al cambiar el estado de la promoción.'
      );
    }
  };

  // Cálculo en tiempo real para el modal
  const modalCalculos = useMemo(
    () => calcularDetallePromo(formData, productos, categorias),
    [formData, productos, categorias]
  );

  // Filtrado de promociones
  const promocionesFiltradas = useMemo(() => {
    return promociones.filter((promo) => {
      const estaActiva = promo.activo !== false && promo.activa !== false;

      if (filtroEstado === 'activas' && !estaActiva) return false;
      if (filtroEstado === 'inactivas' && estaActiva) return false;

      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchNombre = promo.nombre.toLowerCase().includes(term);
        const rawItems = promo.productos || promo.items || [];
        const matchProductos = rawItems.some((it) => {
          const targetProdId = it.productoId?._id || it.productoId;
          const prod = productos.find((p) => (p._id || p.id) === targetProdId);
          return prod && prod.nombre.toLowerCase().includes(term);
        });
        if (!matchNombre && !matchProductos) return false;
      }

      return true;
    });
  }, [promociones, filtroEstado, searchTerm, productos]);

  // Métricas generales para las KPI cards superiores
  const statsGenerales = useMemo(() => {
    const totalPromos = promociones.length;
    const activasCount = promociones.filter(
      (p) => p.activo !== false && p.activa !== false
    ).length;
    let ahorroTotalSum = 0;
    let sumaPreciosCombos = 0;

    promociones.forEach((p) => {
      const calc = calcularDetallePromo(p, productos, categorias);
      if (calc.ahorro > 0) {
        ahorroTotalSum += calc.ahorro;
      }
      sumaPreciosCombos += calc.precioCombo;
    });

    const promedioAhorro =
      totalPromos > 0 ? Math.round(ahorroTotalSum / totalPromos) : 0;

    return {
      totalPromos,
      activasCount,
      inactivasCount: totalPromos - activasCount,
      promedioAhorro,
      sumaPreciosCombos,
    };
  }, [promociones, productos, categorias]);

  return (
    <div className="space-y-6 font-body text-aleman-negro">
      {/* ENCABEZADO Y ACCIÓN PRINCIPAL */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-aleman-negro">
            Catálogo de Promociones y Combos
          </h1>
          <p className="text-base text-aleman-negro/70">
            Creá combos a precio fijo con reparto proporcional de ingresos entre Comida y Bebida (Exclusivo Dueño)
          </p>
        </div>

        <button
          onClick={handleOpenCreateModal}
          className="px-4 py-2.5 bg-aleman-rojo hover:bg-aleman-rojo-dark text-aleman-hueso font-bold text-base rounded-sm border border-aleman-negro/40 shadow-sm transition-colors flex items-center justify-center gap-2 self-start sm:self-auto cursor-pointer uppercase tracking-wider"
        >
          <span className="text-lg leading-none font-bold">+</span> Nueva Promoción
        </button>
      </div>

      {/* TARJETAS KPI / MÉTRICAS RÁPIDAS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-aleman-hueso rounded-sm p-5 border-2 border-aleman-negro/20 flex items-center justify-between">
          <div>
            <span className="text-sm font-bold uppercase tracking-wider text-aleman-negro/70 block">
              Promociones Registradas
            </span>
            <div className="text-2xl font-display font-bold text-aleman-negro mt-1">
              {statsGenerales.totalPromos}
            </div>
            <div className="flex items-center gap-2 mt-1.5 text-sm">
              <span className="inline-flex items-center gap-1 font-bold text-emerald-800">
                <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                {statsGenerales.activasCount} activas
              </span>
              <span className="text-aleman-negro/30">•</span>
              <span className="text-aleman-negro/60 font-semibold">
                {statsGenerales.inactivasCount} inactivas
              </span>
            </div>
          </div>
          <div className="p-3 bg-aleman-crema border border-aleman-negro/15 text-aleman-dorado rounded-sm text-2xl">
            🏷️
          </div>
        </div>

        <div className="bg-aleman-hueso rounded-sm p-5 border-2 border-aleman-negro/20 flex items-center justify-between">
          <div>
            <span className="text-sm font-bold uppercase tracking-wider text-aleman-negro/70 block">
              Ahorro Promedio Cliente
            </span>
            <div className="text-2xl font-display font-bold text-emerald-800 mt-1">
              {formatCurrency(statsGenerales.promedioAhorro)}
            </div>
            <span className="text-sm text-aleman-negro/60 font-medium block mt-1">
              Diferencia media vs. compra por separado
            </span>
          </div>
          <div className="p-3 bg-aleman-crema border border-aleman-negro/15 text-emerald-800 rounded-sm text-2xl">
            🎁
          </div>
        </div>

        <div className="bg-aleman-hueso rounded-sm p-5 border-2 border-aleman-negro/20 flex items-center justify-between">
          <div>
            <span className="text-sm font-bold uppercase tracking-wider text-aleman-negro/70 block">
              Reparto Proporcional
            </span>
            <div className="text-lg font-display font-bold text-aleman-negro mt-1">
              Comida 🍕 & Bebida 🥤
            </div>
            <span className="text-sm text-aleman-negro/60 font-medium block mt-1">
              Ponderación automática según precio individual
            </span>
          </div>
          <div className="p-3 bg-aleman-crema border border-aleman-negro/15 text-aleman-verde rounded-sm text-2xl">
            ⚖️
          </div>
        </div>
      </div>

      {/* BARRA DE BÚSQUEDA Y FILTROS */}
      <div className="bg-aleman-hueso rounded-sm p-4 border-2 border-aleman-negro/20 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:max-w-md">
            <input
              type="text"
              placeholder="Buscar por nombre de combo o producto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3.5 py-2 bg-white border-2 border-aleman-negro/25 rounded-sm text-base text-aleman-negro focus:border-aleman-verde focus:outline-none"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-aleman-negro/40 hover:text-aleman-negro text-base cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="px-3.5 py-2 bg-white border-2 border-aleman-negro/25 rounded-sm text-base text-aleman-negro focus:border-aleman-verde focus:outline-none font-semibold"
          >
            <option value="todas">Todos los estados</option>
            <option value="activas">Solo Activas</option>
            <option value="inactivas">Solo Inactivas</option>
          </select>
        </div>

        <div className="text-sm text-aleman-negro/70 font-semibold self-end sm:self-center">
          Mostrando {promocionesFiltradas.length} de {promociones.length} combos
        </div>
      </div>

      {/* MENSAJE DE CARGA / ERROR */}
      {loading && (
        <div className="bg-aleman-hueso rounded-sm border-2 border-aleman-negro/20 p-8 text-center font-bold text-aleman-negro/60">
          <div className="animate-spin text-3xl mb-2">⏳</div>
          Cargando catálogo de promociones...
        </div>
      )}

      {error && !loading && (
        <div className="bg-rose-50 border-2 border-rose-300 text-rose-900 rounded-sm p-4 font-semibold text-sm flex items-center justify-between">
          <span>⚠️ {error}</span>
          <button
            onClick={cargarDatos}
            className="px-3 py-1 bg-rose-200 hover:bg-rose-300 text-rose-900 font-bold rounded text-xs transition-colors cursor-pointer"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* TABLA PRINCIPAL DE PROMOCIONES */}
      {!loading && !error && (
        <div className="bg-aleman-hueso rounded-sm border-2 border-aleman-negro/20 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-base text-aleman-negro">
              <thead className="bg-aleman-crema text-sm uppercase font-bold text-aleman-negro border-b-2 border-aleman-negro/20">
                <tr>
                  <th className="py-3.5 px-6">Promoción / Combo</th>
                  <th className="py-3.5 px-6">Productos Incluidos</th>
                  <th className="py-3.5 px-6 text-right">Precio Combo</th>
                  <th className="py-3.5 px-6 text-right">Suma Individual</th>
                  <th className="py-3.5 px-6 text-right">Ahorro Cliente</th>
                  <th className="py-3.5 px-6">Reparto Proporcional</th>
                  <th className="py-3.5 px-6 text-center">Estado</th>
                  <th className="py-3.5 px-6 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-aleman-negro/10">
                {promocionesFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-aleman-negro/50">
                      <div className="text-3xl mb-2">🏷️</div>
                      <p className="font-bold text-aleman-negro text-lg">
                        No se encontraron promociones en el catálogo
                      </p>
                      <p className="text-sm text-aleman-negro/60 mt-1">
                        Hacé clic en "+ Nueva Promoción" para crear una.
                      </p>
                    </td>
                  </tr>
                ) : (
                  promocionesFiltradas.map((promo) => {
                    const promoId = promo._id || promo.id;
                    const estaActiva = promo.activo !== false && promo.activa !== false;
                    const calc = calcularDetallePromo(promo, productos, categorias);
                    const isExpanded = expandedRowIds.has(promoId);

                    return (
                      <tr
                        key={promoId}
                        className={`group transition-colors ${
                          !estaActiva
                            ? 'bg-gray-100/70 opacity-65'
                            : isExpanded
                            ? 'bg-amber-50/40'
                            : 'hover:bg-aleman-crema/40'
                        }`}
                      >
                        {/* 1. Nombre */}
                        <td className="py-4 px-6 align-top">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleRowExpansion(promoId)}
                              className="text-aleman-negro/50 hover:text-aleman-dorado font-bold text-sm p-1 rounded hover:bg-aleman-crema transition-colors cursor-pointer"
                            >
                              {isExpanded ? '▼' : '▶'}
                            </button>
                            <div>
                              <div className="font-bold text-aleman-negro flex items-center gap-1.5">
                                {promo.nombre}
                              </div>
                              <button
                                onClick={() => toggleRowExpansion(promoId)}
                                className="text-sm text-amber-800 hover:underline font-bold mt-0.5 cursor-pointer"
                              >
                                {isExpanded ? 'Ocultar desglose' : 'Ver desglose proporcional'}
                              </button>
                            </div>
                          </div>
                        </td>

                        {/* 2. Productos incluidos */}
                        <td className="py-4 px-6 align-top">
                          <div className="flex flex-wrap gap-1.5 max-w-xs">
                            {calc.items.map((it, idx) => (
                              <span
                                key={idx}
                                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-sm text-sm font-bold border ${
                                  it.tipo === 'bebida'
                                    ? 'bg-blue-50 text-blue-900 border-blue-200'
                                    : 'bg-amber-50 text-amber-900 border-amber-300'
                                }`}
                              >
                                <span className="font-extrabold">{it.cantidad}x</span>
                                <span className="truncate max-w-[130px]" title={it.nombre}>
                                  {it.nombre}
                                </span>
                                <span className="text-xs opacity-75">
                                  {it.tipo === 'bebida' ? '🥤' : '🍕'}
                                </span>
                              </span>
                            ))}
                          </div>
                        </td>

                        {/* 3. Precio Combo */}
                        <td className="py-4 px-6 text-right align-top">
                          <div className="font-display font-bold text-aleman-negro text-lg">
                            {formatCurrency(calc.precioCombo)}
                          </div>
                          <span className="text-xs text-aleman-negro/60 font-semibold">
                            Precio Fijo
                          </span>
                        </td>

                        {/* 4. Suma Individual */}
                        <td className="py-4 px-6 text-right align-top">
                          <div className="font-semibold text-aleman-negro/50 line-through text-sm">
                            {formatCurrency(calc.sumaIndividualTotal)}
                          </div>
                          <span className="text-xs text-aleman-negro/50">
                            Valor lista
                          </span>
                        </td>

                        {/* 5. Ahorro */}
                        <td className="py-4 px-6 text-right align-top">
                          {calc.ahorro > 0 ? (
                            <div>
                              <div className="font-bold text-emerald-800 text-base">
                                {formatCurrency(calc.ahorro)}
                              </div>
                              <span className="inline-block px-1.5 py-0.5 rounded-sm bg-emerald-100 text-emerald-900 font-extrabold text-xs border border-emerald-300">
                                -{calc.porcentajeAhorro}%
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm font-semibold text-aleman-negro/60">
                              Sin descuento ($0)
                            </span>
                          )}
                        </td>

                        {/* 6. Reparto Proporcional */}
                        <td className="py-4 px-6 align-top min-w-[200px]">
                          <div className="space-y-1.5">
                            <div className="w-full h-2.5 bg-aleman-crema rounded-full overflow-hidden flex border border-aleman-negro/20 shadow-inner">
                              <div
                                style={{ width: `${calc.propComidaPct}%` }}
                                className="bg-aleman-dorado h-full transition-all duration-300"
                              />
                              <div
                                style={{ width: `${calc.propBebidaPct}%` }}
                                className="bg-aleman-verde h-full transition-all duration-300"
                              />
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-amber-900 font-bold flex items-center gap-1">
                                <span>🍕</span> {formatCurrency(calc.asignadoComida)} ({calc.propComidaPct}%)
                              </span>
                              <span className="text-aleman-verde font-bold flex items-center gap-1">
                                <span>🥤</span> {formatCurrency(calc.asignadoBebida)} ({calc.propBebidaPct}%)
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* 7. Estado Toggle */}
                        <td className="py-4 px-6 text-center align-top">
                          <button
                            onClick={() => handleToggleActiva(promo)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-sm text-sm font-bold transition-colors cursor-pointer border ${
                              estaActiva
                                ? 'bg-emerald-100 text-emerald-900 border-emerald-300 hover:bg-emerald-200'
                                : 'bg-gray-200 text-gray-700 border-gray-300 hover:bg-gray-300'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                estaActiva ? 'bg-emerald-600' : 'bg-gray-500'
                              }`}
                            />
                            {estaActiva ? '🟢 Activa' : '⚪ Inactiva'}
                          </button>
                        </td>

                        {/* 8. Acciones */}
                        <td className="py-4 px-6 text-right align-top space-x-1.5">
                          <button
                            onClick={() => handleOpenEditModal(promo)}
                            className="text-aleman-dorado hover:text-amber-800 font-bold text-sm px-2.5 py-1 hover:bg-amber-50 rounded-sm border border-aleman-dorado/30 transition-colors cursor-pointer"
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

          {/* Detalle expandible (sub-tabla de desglose item por item) */}
          {promocionesFiltradas.some((p) => expandedRowIds.has(p._id || p.id)) && (
            <div className="p-4 bg-aleman-crema border-t-2 border-aleman-negro/20 space-y-4">
              {promocionesFiltradas
                .filter((p) => expandedRowIds.has(p._id || p.id))
                .map((promo) => {
                  const promoId = promo._id || promo.id;
                  const calc = calcularDetallePromo(promo, productos, categorias);
                  return (
                    <div
                      key={`detail-${promoId}`}
                      className="bg-aleman-hueso rounded-sm p-4 border-2 border-aleman-dorado space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-aleman-negro/10 pb-3">
                        <div>
                          <span className="text-sm font-bold text-amber-800 uppercase tracking-wider">
                            Desglose Proporcional Detallado
                          </span>
                          <h4 className="text-lg font-display font-bold text-aleman-negro">
                            {promo.nombre}
                          </h4>
                        </div>
                        <div className="flex items-center gap-4 text-sm font-bold text-aleman-negro">
                          <span>
                            Precio Combo:{' '}
                            <strong className="text-aleman-negro font-display text-base">
                              {formatCurrency(calc.precioCombo)}
                            </strong>
                          </span>
                          <span>
                            Ahorro Total:{' '}
                            <strong className="text-emerald-800">
                              {formatCurrency(calc.ahorro)} ({calc.porcentajeAhorro}%)
                            </strong>
                          </span>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-aleman-negro">
                          <thead className="bg-aleman-crema text-xs uppercase font-bold text-aleman-negro border-b border-aleman-negro/20">
                            <tr>
                              <th className="py-2.5 px-3">Producto</th>
                              <th className="py-2.5 px-3">Rubro</th>
                              <th className="py-2.5 px-3 text-center">Cantidad</th>
                              <th className="py-2.5 px-3 text-right">Precio Unitario (Lista)</th>
                              <th className="py-2.5 px-3 text-right">Subtotal Individual</th>
                              <th className="py-2.5 px-3 text-right">Peso en Combo</th>
                              <th className="py-2.5 px-3 text-right font-bold text-aleman-negro">
                                Precio Asignado en Combo
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-aleman-negro/10">
                            {calc.items.map((it, idx) => (
                              <tr key={idx} className="hover:bg-aleman-crema/40">
                                <td className="py-2.5 px-3 font-bold text-aleman-negro">
                                  {it.nombre}
                                </td>
                                <td className="py-2.5 px-3">
                                  <span
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-bold border ${
                                      it.tipo === 'bebida'
                                        ? 'bg-blue-50 text-blue-900 border-blue-200'
                                        : 'bg-amber-50 text-amber-900 border-amber-300'
                                    }`}
                                  >
                                    {it.tipo === 'bebida' ? '🥤 Bebida' : '🍕 Comida'}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-center font-bold">
                                  {it.cantidad}
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  {formatCurrency(it.precioUnitario)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-semibold text-aleman-negro/60">
                                  {formatCurrency(it.subtotalIndividual)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-bold text-aleman-negro">
                                  {it.pesoEnComboPct}%
                                </td>
                                <td className="py-2.5 px-3 text-right font-display font-bold text-aleman-negro text-base">
                                  {formatCurrency(it.precioAsignadoEnCombo)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* MODAL: NUEVA / EDITAR PROMOCIÓN */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-aleman-negro/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-aleman-hueso rounded-sm border-2 border-aleman-negro w-full max-w-2xl my-8 overflow-hidden">
            <div className="px-6 py-4 border-b-2 border-aleman-dorado flex items-center justify-between bg-aleman-verde text-aleman-hueso">
              <div>
                <h3 className="text-xl font-display font-bold uppercase tracking-wider">
                  {editingPromoId ? 'Editar Promoción' : 'Nueva Promoción'}
                </h3>
                <p className="text-sm text-aleman-hueso/70">
                  Armá tu combo a precio fijo y visualizá el reparto en tiempo real
                </p>
              </div>
              <button
                onClick={handleCloseModal}
                className="text-aleman-hueso/70 hover:text-aleman-hueso text-xl font-bold p-1 rounded transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePromo} className="p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-bold text-aleman-negro uppercase tracking-wider mb-1.5">
                    Nombre de la Promoción *
                  </label>
                  <input
                    type="text"
                    value={formData.nombre}
                    onChange={(e) =>
                      setFormData({ ...formData, nombre: e.target.value })
                    }
                    placeholder="Ej: Combo Pizza + Birra"
                    required
                    className="w-full px-3.5 py-2.5 bg-white border-2 border-aleman-negro/25 rounded-sm text-base text-aleman-negro focus:border-aleman-verde focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-aleman-negro uppercase tracking-wider mb-1.5">
                    Precio Combo ($) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={formData.precioCombo}
                    onChange={(e) =>
                      setFormData({ ...formData, precioCombo: e.target.value })
                    }
                    placeholder="Ej: 9600"
                    required
                    className="w-full px-3.5 py-2.5 bg-white border-2 border-aleman-negro/25 rounded-sm text-base text-aleman-negro font-bold focus:border-aleman-verde focus:outline-none"
                  />
                </div>
              </div>

              {/* Constructor Dinámico de Productos */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-aleman-negro uppercase tracking-wider">
                      Productos Incluidos en el Combo *
                    </h4>
                    <p className="text-xs text-aleman-negro/60">
                      Seleccioná los componentes de este combo
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="text-xs font-bold text-aleman-negro bg-aleman-crema hover:bg-aleman-hueso px-3 py-1.5 rounded-sm transition-colors border border-aleman-negro/25 cursor-pointer uppercase tracking-wider"
                  >
                    + Agregar Producto
                  </button>
                </div>

                {formData.items.length === 0 ? (
                  <div className="p-4 bg-aleman-crema border-2 border-dashed border-aleman-negro/20 rounded-sm text-center text-sm text-aleman-negro/60">
                    No agregaste productos al combo. Hacé click en "+ Agregar Producto".
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                    {formData.items.map((row, index) => {
                      const targetProdId = row.productoId?._id || row.productoId;
                      const selectedProd = productos.find(
                        (p) => (p._id || p.id) === targetProdId
                      );

                      const targetCatId = selectedProd?.categoriaId?._id || selectedProd?.categoriaId;
                      const cat = selectedProd
                        ? categorias.find((c) => (c._id || c.id) === targetCatId)
                        : null;
                      const tipo = cat?.tipo || 'comida';
                      const precioUnitario = selectedProd ? selectedProd.precioVenta : 0;
                      const subtotal = precioUnitario * (Number(row.cantidad) || 0);

                      return (
                        <div
                          key={index}
                          className="flex items-center gap-2 p-2.5 bg-aleman-crema rounded-sm border-2 border-aleman-negro/15"
                        >
                          <span
                            className={`text-sm px-2 py-1 rounded-sm font-bold border ${
                              tipo === 'bebida'
                                ? 'bg-blue-50 text-blue-900 border-blue-200'
                                : 'bg-amber-50 text-amber-900 border-amber-300'
                            }`}
                          >
                            {tipo === 'bebida' ? '🥤' : '🍕'}
                          </span>

                          <div className="flex-1">
                            <select
                              value={targetProdId}
                              onChange={(e) =>
                                handleItemChange(index, 'productoId', e.target.value)
                              }
                              className="w-full px-2.5 py-1.5 bg-white border-2 border-aleman-negro/25 rounded-sm text-sm text-aleman-negro font-semibold focus:border-aleman-verde"
                            >
                              {productos.map((prod) => (
                                <option key={prod._id || prod.id} value={prod._id || prod.id}>
                                  {prod.nombre} — {formatCurrency(prod.precioVenta)}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="w-20">
                            <input
                              type="number"
                              min="1"
                              step="1"
                              placeholder="Cant."
                              value={row.cantidad}
                              onChange={(e) =>
                                handleItemChange(index, 'cantidad', e.target.value)
                              }
                              className="w-full px-2 py-1.5 bg-white border-2 border-aleman-negro/25 rounded-sm text-sm text-aleman-negro text-center font-bold focus:border-aleman-verde"
                            />
                          </div>

                          <div className="w-24 text-right">
                            <span className="text-sm font-bold text-aleman-negro block">
                              {formatCurrency(subtotal)}
                            </span>
                            <span className="text-xs text-aleman-negro/60 font-semibold">
                              lista ind.
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveItemRow(index)}
                            disabled={formData.items.length === 1}
                            className="text-aleman-negro/40 hover:text-aleman-rojo disabled:opacity-30 disabled:hover:text-aleman-negro/40 p-1 rounded transition-colors cursor-pointer font-bold"
                            title="Quitar producto"
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Panel de Cálculo y Proporción en Tiempo Real */}
              <div className="p-4 bg-aleman-crema border-2 border-aleman-negro/15 rounded-sm space-y-4">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-white p-2.5 rounded-sm border-2 border-aleman-negro/20">
                    <span className="text-xs text-aleman-negro/60 block font-bold uppercase tracking-wider">
                      Suma Lista Individual
                    </span>
                    <span className="text-base font-bold text-aleman-negro">
                      {formatCurrency(modalCalculos.sumaIndividualTotal)}
                    </span>
                  </div>

                  <div className="bg-white p-2.5 rounded-sm border-2 border-aleman-negro/20">
                    <span className="text-xs text-aleman-negro/60 block font-bold uppercase tracking-wider">
                      Precio Combo
                    </span>
                    <span className="text-base font-display font-bold text-aleman-negro">
                      {formatCurrency(modalCalculos.precioCombo)}
                    </span>
                  </div>

                  <div className="bg-white p-2.5 rounded-sm border-2 border-aleman-negro/20">
                    <span className="text-xs text-aleman-negro/60 block font-bold uppercase tracking-wider">
                      Ahorro Cliente
                    </span>
                    <span
                      className={`text-base font-bold ${
                        modalCalculos.ahorro > 0
                          ? 'text-emerald-800'
                          : modalCalculos.ahorro === 0
                          ? 'text-aleman-negro/70'
                          : 'text-aleman-rojo'
                      }`}
                    >
                      {formatCurrency(modalCalculos.ahorro)} ({modalCalculos.porcentajeAhorro}%)
                    </span>
                  </div>
                </div>
              </div>

              {/* Toggle de Estado Activa / Inactiva */}
              <div className="flex items-center gap-3 p-3 bg-aleman-crema rounded-sm border-2 border-aleman-negro/15">
                <input
                  type="checkbox"
                  id="promoActivaCheck"
                  checked={formData.activa}
                  onChange={(e) =>
                    setFormData({ ...formData, activa: e.target.checked })
                  }
                  className="w-4 h-4 text-aleman-verde rounded focus:ring-aleman-verde cursor-pointer"
                />
                <label
                  htmlFor="promoActivaCheck"
                  className="text-base font-bold text-aleman-negro cursor-pointer select-none"
                >
                  Promoción activa y habilitada para la venta
                </label>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t-2 border-aleman-negro/10">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-sm font-bold uppercase tracking-wider text-aleman-negro hover:bg-aleman-crema rounded-sm border border-aleman-negro/25 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-bold uppercase tracking-wider text-aleman-hueso bg-aleman-rojo hover:bg-aleman-rojo-dark rounded-sm border border-aleman-negro/40 shadow-sm transition-colors cursor-pointer"
                >
                  {editingPromoId ? 'Guardar Cambios' : 'Crear Promoción'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
