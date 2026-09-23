import { useState, useMemo, useEffect } from 'react';
import apiClient from '../services/apiClient';
import { formatCurrency } from '../services/mockData';

// Unidades de medida disponibles
const UNIDADES_MEDIDA = [
  { value: 'kg', label: 'Kilogramos (kg)' },
  { value: 'gr', label: 'Gramos (gr)' },
  { value: 'lt', label: 'Litros (lt)' },
  { value: 'ml', label: 'Mililitros (ml)' },
  { value: 'unidad', label: 'Unidades (u)' },
  { value: 'latas', label: 'Latas' },
];

/**
 * Determina el estado del stock según los umbrales configurables
 */
const calcularEstadoStock = (stockActual, umbralCritico, umbralBajo) => {
  const stock = Number(stockActual) || 0;
  const crit = Number(umbralCritico) || 0;
  const bajo = Number(umbralBajo) || 0;

  if (stock <= crit) {
    return {
      key: 'critico',
      label: 'Crítico',
      bgBadge: 'bg-red-100 text-red-800 border-red-200',
      dotColor: 'bg-red-600',
      icon: '🔴',
      descripcion: 'Stock por debajo o igual al umbral crítico. ¡Reponer urgente!',
    };
  }
  if (stock <= bajo) {
    return {
      key: 'bajo',
      label: 'Bajo',
      bgBadge: 'bg-amber-100 text-amber-800 border-amber-200',
      dotColor: 'bg-amber-600',
      icon: '🟡',
      descripcion: 'Stock por debajo o igual al umbral bajo. Planificar compra.',
    };
  }
  return {
    key: 'normal',
    label: 'Normal',
    bgBadge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    dotColor: 'bg-emerald-600',
    icon: '🟢',
    descripcion: 'Nivel de stock óptimo dentro de los parámetros esperados.',
  };
};

export default function Stock() {
  const [ingredientes, setIngredientes] = useState([]);
  const [productos, setProductos] = useState([]);

  // Notificación tipo toast / feedback
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Carga inicial de backend (Ingredientes, Productos)
  const cargarDatosStock = async () => {
    try {
      const [resIng, resProd] = await Promise.all([
        apiClient.get('/ingredientes').catch(() => ({ data: { ingredientes: [] } })),
        apiClient.get('/productos').catch(() => ({ data: { productos: [] } })),
      ]);

      const listIngredientes = (resIng.data?.ingredientes || []).map((i) => ({
        id: i._id || i.id,
        _id: i._id || i.id,
        nombre: i.nombre,
        unidad: i.unidadMedida || i.unidad || 'kg',
        cantidadComprada: i.cantidadComprada,
        costoCompra: i.precioCompra,
        costoUnitario: i.costoUnitario || (i.cantidadComprada > 0 ? Math.round(i.precioCompra / i.cantidadComprada) : 0),
        stockActual: i.stockActual,
        umbralCritico: i.umbralCritico,
        umbralBajo: i.umbralBajo,
        estadoStock: i.estadoStock,
      }));
      setIngredientes(listIngredientes);

      const listProductos = (resProd.data?.productos || []).map((p) => ({
        id: p._id || p.id,
        nombre: p.nombre,
        receta: (p.receta || []).map((r) => ({
          ingredienteId: typeof r.ingredienteId === 'object' ? r.ingredienteId?._id : r.ingredienteId,
          cantidad: r.cantidad,
        })),
      }));
      setProductos(listProductos);
    } catch {
      showToast('Error al cargar insumos desde el servidor');
    }
  };

  useEffect(() => {
    cargarDatosStock();
  }, []);

  // Filtros y búsqueda
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todas'); // 'todas' | 'alertas' | 'critico' | 'bajo' | 'normal'
  const [filtroUnidad, setFiltroUnidad] = useState('todas');

  // Modales
  const [modalType, setModalType] = useState(null); // 'crear' | 'editar' | 'compra' | null
  const [selectedIngrediente, setSelectedIngrediente] = useState(null);

  // Alerta de validación de eliminación (cuando está en uso en recetas)
  const [bloqueoEliminacion, setBloqueoEliminacion] = useState(null);

  // Estado para Crear / Editar General
  const initialFormState = {
    nombre: '',
    unidad: 'kg',
    cantidadComprada: '',
    costoCompra: '',
    stockActual: '',
    umbralCritico: '',
    umbralBajo: '',
  };
  const [formData, setFormData] = useState(initialFormState);

  // Estado para Modal "Registrar Nueva Compra"
  const [compraData, setCompraData] = useState({
    cantidadComprada: '',
    costoTotal: '',
  });

  // =========================================================
  // MANEJADORES DE APERTURA DE MODALES
  // =========================================================

  const handleOpenCrearModal = () => {
    setSelectedIngrediente(null);
    setFormData({
      nombre: '',
      unidad: 'kg',
      cantidadComprada: '',
      costoCompra: '',
      stockActual: '',
      umbralCritico: '',
      umbralBajo: '',
    });
    setModalType('crear');
  };

  const handleOpenEditarModal = (ing) => {
    setSelectedIngrediente(ing);
    setFormData({
      nombre: ing.nombre,
      unidad: ing.unidad,
      cantidadComprada: ing.cantidadComprada,
      costoCompra: ing.costoCompra,
      stockActual: ing.stockActual,
      umbralCritico: ing.umbralCritico,
      umbralBajo: ing.umbralBajo,
    });
    setModalType('editar');
  };

  const handleOpenCompraModal = (ing) => {
    setSelectedIngrediente(ing);
    setCompraData({
      cantidadComprada: '',
      costoTotal: '',
    });
    setModalType('compra');
  };

  const handleCloseModal = () => {
    setModalType(null);
    setSelectedIngrediente(null);
  };

  // =========================================================
  // GUARDAR: CREAR O EDITAR GENERAL
  // =========================================================

  const handleSaveIngrediente = async (e) => {
    e.preventDefault();

    if (!formData.nombre.trim()) {
      alert('Por favor ingresá un nombre para el ingrediente.');
      return;
    }

    const cantComprada = Number(formData.cantidadComprada);
    const costoTotal = Number(formData.costoCompra);
    const stockAct = Number(formData.stockActual);
    const umbCrit = Number(formData.umbralCritico);
    const umbBaj = Number(formData.umbralBajo);

    if (isNaN(cantComprada) || cantComprada <= 0) {
      alert('La cantidad comprada debe ser mayor a 0.');
      return;
    }

    if (isNaN(costoTotal) || costoTotal <= 0) {
      alert('El costo total de compra debe ser mayor a $0.');
      return;
    }

    if (isNaN(stockAct) || stockAct < 0) {
      alert('El stock actual no puede ser un número negativo.');
      return;
    }

    if (isNaN(umbCrit) || umbCrit < 0) {
      alert('El umbral crítico debe ser 0 o mayor.');
      return;
    }

    if (isNaN(umbBaj) || umbBaj < umbCrit) {
      alert('El umbral bajo debe ser mayor o igual al umbral crítico.');
      return;
    }

    const payload = {
      nombre: formData.nombre.trim(),
      unidadMedida: formData.unidad,
      stockActual: stockAct,
      precioCompra: costoTotal,
      cantidadComprada: cantComprada,
      umbralCritico: umbCrit,
      umbralBajo: umbBaj,
    };

    try {
      if (modalType === 'editar' && selectedIngrediente) {
        await apiClient.put(`/ingredientes/${selectedIngrediente.id}`, payload);
        showToast(`Ingrediente "${formData.nombre}" actualizado con éxito`);
      } else {
        await apiClient.post('/ingredientes', payload);
        showToast(`Ingrediente "${formData.nombre}" creado con éxito`);
      }
      handleCloseModal();
      cargarDatosStock();
    } catch (err) {
      alert(err.response?.data?.mensaje || 'Error al guardar ingrediente');
    }
  };

  // =========================================================
  // GUARDAR: REGISTRAR NUEVA COMPRA (SUMA STOCK + RECALCULA COSTO)
  // =========================================================

  const handleSaveCompra = async (e) => {
    e.preventDefault();
    if (!selectedIngrediente) return;

    const cantNueva = Number(compraData.cantidadComprada);
    const costoNuevo = Number(compraData.costoTotal);

    if (isNaN(cantNueva) || cantNueva <= 0) {
      alert('Ingresá una cantidad comprada válida mayor a 0.');
      return;
    }

    if (isNaN(costoNuevo) || costoNuevo <= 0) {
      alert('Ingresá un costo total válido mayor a 0.');
      return;
    }

    const nuevoStock = selectedIngrediente.stockActual + cantNueva;

    try {
      await apiClient.put(`/ingredientes/${selectedIngrediente.id}`, {
        cantidadComprada: cantNueva,
        precioCompra: costoNuevo,
        stockActual: nuevoStock,
      });
      showToast(`Stock de "${selectedIngrediente.nombre}" repuesto (+${cantNueva} ${selectedIngrediente.unidad})`);
      handleCloseModal();
      cargarDatosStock();
    } catch (err) {
      alert(err.response?.data?.mensaje || 'Error al registrar la compra');
    }
  };


  // =========================================================
  // ELIMINAR INGREDIENTE CON VALIDACIÓN EN RECETAS
  // =========================================================

  const handleEliminarIngrediente = async (ing) => {
    if (
      window.confirm(
        `¿Estás seguro de que deseas eliminar el ingrediente "${ing.nombre}"? Esta acción no se puede deshacer.`
      )
    ) {
      try {
        await apiClient.delete(`/ingredientes/${ing.id}`);
        showToast(`Ingrediente "${ing.nombre}" eliminado con éxito`);
        cargarDatosStock();
      } catch (err) {
        const mensajeBackend = err.response?.data?.mensaje;
        if (mensajeBackend) {
          const productosQueLoUsan = productos.filter((prod) =>
            (prod.receta || []).some((r) => String(r.ingredienteId) === String(ing.id))
          );
          if (productosQueLoUsan.length > 0) {
            setBloqueoEliminacion({
              ingrediente: ing,
              productos: productosQueLoUsan,
              mensajeServidor: mensajeBackend,
            });
          } else {
            alert(mensajeBackend);
          }
        } else {
          alert('Error al eliminar ingrediente');
        }
      }
    }
  };


  // =========================================================
  // FILTRADO Y BÚSQUEDA
  // =========================================================

  const ingredientesFiltrados = useMemo(() => {
    return ingredientes.filter((ing) => {
      // Filtro de texto
      if (
        searchTerm.trim() &&
        !ing.nombre.toLowerCase().includes(searchTerm.toLowerCase())
      ) {
        return false;
      }

      // Filtro de unidad
      if (filtroUnidad !== 'todas' && ing.unidad !== filtroUnidad) {
        return false;
      }

      // Filtro de estado
      const estado = calcularEstadoStock(
        ing.stockActual,
        ing.umbralCritico,
        ing.umbralBajo
      );

      if (filtroEstado === 'alertas') {
        return estado.key === 'critico' || estado.key === 'bajo';
      }
      if (filtroEstado === 'critico') return estado.key === 'critico';
      if (filtroEstado === 'bajo') return estado.key === 'bajo';
      if (filtroEstado === 'normal') return estado.key === 'normal';

      return true;
    });
  }, [ingredientes, searchTerm, filtroEstado, filtroUnidad]);

  // =========================================================
  // MÉTRICAS GLOBALES SUPERIORES (KPIs)
  // =========================================================

  const statsStock = useMemo(() => {
    let criticosCount = 0;
    let bajosCount = 0;
    let normalesCount = 0;
    let valoracionTotal = 0;

    ingredientes.forEach((ing) => {
      const estado = calcularEstadoStock(
        ing.stockActual,
        ing.umbralCritico,
        ing.umbralBajo
      );
      if (estado.key === 'critico') criticosCount++;
      else if (estado.key === 'bajo') bajosCount++;
      else normalesCount++;

      valoracionTotal += (Number(ing.stockActual) || 0) * (Number(ing.costoUnitario) || 0);
    });

    return {
      total: ingredientes.length,
      criticosCount,
      bajosCount,
      normalesCount,
      totalAlertas: criticosCount + bajosCount,
      valoracionTotal,
    };
  }, [ingredientes]);

  return (
    <div className="space-y-6 font-body text-aleman-negro">
      {/* Toast de notificación rápida */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-aleman-verde text-aleman-hueso text-sm font-semibold px-4 py-2.5 rounded-sm shadow-md flex items-center gap-2 border-2 border-aleman-dorado animate-bounce">
          <span>✨</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ========================================================= */}
      {/* ENCABEZADO Y BOTÓN NUEVO INGREDIENTE */}
      {/* ========================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-aleman-negro">
            Control de Stock e Insumos
          </h1>
          <p className="text-base text-aleman-negro/70">
            Supervisá inventario en tiempo real, registrá compras, mermas y umbrales de reposición
          </p>
        </div>

        <button
          onClick={handleOpenCrearModal}
          className="px-4 py-2.5 bg-aleman-rojo hover:bg-aleman-rojo-dark text-aleman-hueso font-bold text-base rounded-sm border border-aleman-negro/40 shadow-sm transition-colors flex items-center justify-center gap-2 self-start sm:self-auto cursor-pointer uppercase tracking-wider"
        >
          <span className="text-lg leading-none font-bold">+</span> Nuevo Ingrediente
        </button>
      </div>

      {/* ========================================================= */}
      {/* TARJETAS KPI / MÉTRICAS DE STOCK */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Total Insumos */}
        <div className="bg-aleman-hueso rounded-sm p-5 border-2 border-aleman-negro/20 flex items-center justify-between">
          <div>
            <span className="text-sm font-bold uppercase tracking-wider text-aleman-negro/70 block">
              Insumos Registrados
            </span>
            <div className="text-2xl font-display font-bold text-aleman-negro mt-1">
              {statsStock.total}
            </div>
            <span className="text-sm text-emerald-800 font-semibold block mt-1">
              🟢 {statsStock.normalesCount} en nivel normal
            </span>
          </div>
          <div className="p-3 bg-aleman-crema border border-aleman-negro/15 text-aleman-negro rounded-sm text-2xl">
            📦
          </div>
        </div>

        {/* Card 2: Alertas de Reposición */}
        <div className="bg-aleman-hueso rounded-sm p-5 border-2 border-aleman-negro/20 flex items-center justify-between">
          <div>
            <span className="text-sm font-bold uppercase tracking-wider text-aleman-negro/70 block">
              Alertas de Reposición
            </span>
            <div className="text-2xl font-display font-bold text-aleman-rojo mt-1">
              {statsStock.totalAlertas}
            </div>
            <div className="flex items-center gap-2 mt-1 text-sm font-bold">
              <span className="text-aleman-rojo">🔴 {statsStock.criticosCount} críticos</span>
              <span className="text-aleman-negro/30">•</span>
              <span className="text-amber-800">🟡 {statsStock.bajosCount} bajos</span>
            </div>
          </div>
          <div className="p-3 bg-rose-50 border border-aleman-rojo/30 text-aleman-rojo rounded-sm text-2xl">
            ⚠️
          </div>
        </div>

        {/* Card 3: Valoración Total del Inventario */}
        <div className="bg-aleman-hueso rounded-sm p-5 border-2 border-aleman-negro/20 flex items-center justify-between">
          <div>
            <span className="text-sm font-bold uppercase tracking-wider text-aleman-negro/70 block">
              Valoración del Stock Actual
            </span>
            <div className="text-2xl font-display font-bold text-aleman-negro mt-1">
              {formatCurrency(statsStock.valoracionTotal)}
            </div>
            <span className="text-sm text-aleman-negro/60 font-medium block mt-1">
              Calculado según último costo unitario
            </span>
          </div>
          <div className="p-3 bg-aleman-crema border border-aleman-negro/15 text-emerald-800 rounded-sm text-2xl">
            💵
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* BARRA DE BÚSQUEDA Y FILTROS */}
      {/* ========================================================= */}
      <div className="bg-aleman-hueso rounded-sm p-4 border-2 border-aleman-negro/20 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap flex-1 items-center gap-3 w-full sm:w-auto">
          {/* Input Buscador */}
          <div className="relative flex-1 sm:max-w-xs min-w-[200px]">
            <input
              type="text"
              placeholder="Buscar ingrediente por nombre..."
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

          {/* Filtro por Estado */}
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="px-3.5 py-2 bg-white border-2 border-aleman-negro/25 rounded-sm text-base text-aleman-negro focus:border-aleman-verde focus:outline-none font-semibold"
          >
            <option value="todas">Todos los estados</option>
            <option value="alertas">⚠️ Alertas (Crítico + Bajo)</option>
            <option value="critico">🔴 Solo Crítico</option>
            <option value="bajo">🟡 Solo Bajo</option>
            <option value="normal">🟢 Solo Normal</option>
          </select>

          {/* Filtro por Unidad */}
          <select
            value={filtroUnidad}
            onChange={(e) => setFiltroUnidad(e.target.value)}
            className="px-3.5 py-2 bg-white border-2 border-aleman-negro/25 rounded-sm text-base text-aleman-negro focus:border-aleman-verde focus:outline-none font-semibold"
          >
            <option value="todas">Todas las unidades</option>
            {UNIDADES_MEDIDA.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </select>
        </div>

        <div className="text-sm text-aleman-negro/70 font-semibold self-end sm:self-center">
          Mostrando {ingredientesFiltrados.length} de {ingredientes.length} ingredientes
        </div>
      </div>

      {/* ========================================================= */}
      {/* TABLA PRINCIPAL DE INGREDIENTES */}
      {/* ========================================================= */}
      <div className="bg-aleman-hueso rounded-sm border-2 border-aleman-negro/20 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-base text-aleman-negro">
            <thead className="bg-aleman-crema text-sm uppercase font-bold text-aleman-negro border-b-2 border-aleman-negro/20">
              <tr>
                <th className="py-3.5 px-6">Ingrediente</th>
                <th className="py-3.5 px-6 text-center">Unidad</th>
                <th className="py-3.5 px-6 text-right">Stock Disponible</th>
                <th className="py-3.5 px-6 text-right">Última Compra</th>
                <th className="py-3.5 px-6 text-right">Costo Unitario</th>
                <th className="py-3.5 px-6">Umbrales Reposición</th>
                <th className="py-3.5 px-6 text-center">Estado</th>
                <th className="py-3.5 px-6 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-aleman-negro/10">
              {ingredientesFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-aleman-negro/50">
                    <div className="text-3xl mb-2">🔍</div>
                    <p className="font-bold text-aleman-negro text-lg">
                      No se encontraron ingredientes con los filtros seleccionados
                    </p>
                    <p className="text-sm text-aleman-negro/60 mt-1">
                      Probá ajustando la búsqueda o agregá un nuevo ingrediente.
                    </p>
                  </td>
                </tr>
              ) : (
                ingredientesFiltrados.map((ing) => {
                  const estado = calcularEstadoStock(
                    ing.stockActual,
                    ing.umbralCritico,
                    ing.umbralBajo
                  );
                  const valorTotalStock =
                    (Number(ing.stockActual) || 0) * (Number(ing.costoUnitario) || 0);

                  return (
                    <tr
                      key={ing.id}
                      className="hover:bg-aleman-crema/50 transition-colors"
                    >
                      {/* 1. Nombre */}
                      <td className="py-4 px-6">
                        <div className="font-bold text-aleman-negro">
                          {ing.nombre}
                        </div>
                        <div className="text-sm text-aleman-negro/50">
                          ID: {ing.id}
                        </div>
                      </td>

                      {/* 2. Unidad de medida */}
                      <td className="py-4 px-6 text-center">
                        <span className="inline-block px-2.5 py-0.5 rounded-sm bg-aleman-crema font-bold text-aleman-negro text-sm border border-aleman-negro/20">
                          {ing.unidad}
                        </span>
                      </td>

                      {/* 3. Stock Actual */}
                      <td className="py-4 px-6 text-right">
                        <div
                          className={`font-display font-bold text-lg ${
                            estado.key === 'critico'
                              ? 'text-aleman-rojo'
                              : estado.key === 'bajo'
                              ? 'text-amber-800'
                              : 'text-aleman-negro'
                          }`}
                        >
                          {ing.stockActual} {ing.unidad}
                        </div>
                        <span className="text-xs text-aleman-negro/60">
                          Val: {formatCurrency(valorTotalStock)}
                        </span>
                      </td>

                      {/* 4. Última Compra */}
                      <td className="py-4 px-6 text-right">
                        <div className="font-bold text-aleman-negro text-sm">
                          {formatCurrency(ing.costoCompra)}
                        </div>
                        <span className="text-xs text-aleman-negro/60">
                          por {ing.cantidadComprada} {ing.unidad}
                        </span>
                      </td>

                      {/* 5. Costo Unitario */}
                      <td className="py-4 px-6 text-right">
                        <div className="font-display font-bold text-aleman-negro text-lg">
                          {formatCurrency(ing.costoUnitario)}
                        </div>
                        <span className="text-xs text-aleman-negro/60 font-semibold">
                          por {ing.unidad}
                        </span>
                      </td>

                      {/* 6. Umbrales */}
                      <td className="py-4 px-6">
                        <div className="space-y-1 text-sm">
                          <div className="flex items-center gap-1.5 text-aleman-rojo font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-aleman-rojo"></span>
                            <span>Crítico: ≤ {ing.umbralCritico} {ing.unidad}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-amber-800 font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                            <span>Bajo: ≤ {ing.umbralBajo} {ing.unidad}</span>
                          </div>
                        </div>
                      </td>

                      {/* 7. Estado Badge */}
                      <td className="py-4 px-6 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-sm text-sm font-bold border ${estado.bgBadge}`}
                          title={estado.descripcion}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${estado.dotColor}`}
                          ></span>
                          {estado.label}
                        </span>
                      </td>

                      {/* 8. Acciones */}
                      <td className="py-4 px-6 text-right space-x-1.5 whitespace-nowrap">
                        {/* Registrar Compra */}
                        <button
                          onClick={() => handleOpenCompraModal(ing)}
                          className="text-emerald-900 bg-emerald-100 hover:bg-emerald-200 font-bold text-sm px-2.5 py-1 rounded-sm transition-colors border border-emerald-400 cursor-pointer"
                          title="Registrar nueva compra (suma stock y recalcula costo)"
                        >
                          🛒 +Compra
                        </button>

                        {/* Editar */}
                        <button
                          onClick={() => handleOpenEditarModal(ing)}
                          className="text-aleman-dorado hover:text-amber-800 font-bold text-sm px-2 py-1 hover:bg-amber-50 rounded-sm border border-aleman-dorado/30 transition-colors cursor-pointer"
                          title="Editar información, stock actual y umbrales"
                        >
                          Editar
                        </button>

                        {/* Eliminar */}
                        <button
                          onClick={() => handleEliminarIngrediente(ing)}
                          className="text-aleman-rojo hover:text-aleman-rojo-dark font-bold text-sm px-2 py-1 hover:bg-rose-50 rounded-sm border border-aleman-rojo/30 transition-colors cursor-pointer"
                          title="Eliminar ingrediente"
                        >
                          Eliminar
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
      {/* MODAL: NUEVO / EDITAR INGREDIENTE GENERAL */}
      {/* ========================================================= */}
      {(modalType === 'crear' || modalType === 'editar') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-aleman-negro/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-aleman-hueso rounded-sm border-2 border-aleman-negro w-full max-w-xl my-8 overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b-2 border-aleman-dorado flex items-center justify-between bg-aleman-verde text-aleman-hueso">
              <div>
                <h3 className="text-xl font-display font-bold uppercase tracking-wider">
                  {modalType === 'editar'
                    ? 'Editar Parámetros de Ingrediente'
                    : 'Nuevo Ingrediente'}
                </h3>
                <p className="text-sm text-aleman-hueso/70">
                  Configurá datos de compra, stock disponible y umbrales de alerta
                </p>
              </div>
              <button
                onClick={handleCloseModal}
                className="text-aleman-hueso/70 hover:text-aleman-hueso text-xl font-bold p-1 rounded transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveIngrediente} className="p-6 space-y-5">
              {/* Nombre y Unidad */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-bold text-aleman-negro uppercase tracking-wider mb-1.5">
                    Nombre del Ingrediente
                  </label>
                  <input
                    type="text"
                    value={formData.nombre}
                    onChange={(e) =>
                      setFormData({ ...formData, nombre: e.target.value })
                    }
                    placeholder="Ej: Harina 000, Queso Muzzarella..."
                    required
                    className="w-full px-3.5 py-2.5 bg-white border-2 border-aleman-negro/25 rounded-sm text-base text-aleman-negro focus:border-aleman-verde focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-aleman-negro uppercase tracking-wider mb-1.5">
                    Unidad de Medida
                  </label>
                  <select
                    value={formData.unidad}
                    onChange={(e) =>
                      setFormData({ ...formData, unidad: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 bg-white border-2 border-aleman-negro/25 rounded-sm text-base text-aleman-negro focus:border-aleman-verde focus:outline-none font-semibold"
                  >
                    {UNIDADES_MEDIDA.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Parámetros de Compra Inicial / Última */}
              <div className="p-4 bg-aleman-crema border-2 border-aleman-negro/15 rounded-sm space-y-3">
                <h4 className="text-sm font-bold text-aleman-negro uppercase tracking-wider">
                  Datos de Compra y Costo
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-aleman-negro/80 mb-1">
                      Cantidad Comprada ({formData.unidad})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={formData.cantidadComprada}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          cantidadComprada: e.target.value,
                        })
                      }
                      placeholder="Ej: 5"
                      required
                      className="w-full px-3.5 py-2 bg-white border-2 border-aleman-negro/25 rounded-sm text-base text-aleman-negro focus:border-aleman-verde"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-aleman-negro/80 mb-1">
                      Costo Total de la Compra ($)
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      value={formData.costoCompra}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          costoCompra: e.target.value,
                        })
                      }
                      placeholder="Ej: 10000"
                      required
                      className="w-full px-3.5 py-2 bg-white border-2 border-aleman-negro/25 rounded-sm text-base text-aleman-negro font-bold focus:border-aleman-verde"
                    />
                  </div>
                </div>

                {/* Previsualización en tiempo real del costo unitario */}
                {Number(formData.cantidadComprada) > 0 &&
                  Number(formData.costoCompra) > 0 && (
                    <div className="flex items-center justify-between p-2.5 bg-emerald-50 border border-emerald-300 rounded-sm text-sm">
                      <span className="text-emerald-900 font-semibold">
                        Costo Unitario Resultante:
                      </span>
                      <span className="font-extrabold text-emerald-900 text-base">
                        {formatCurrency(
                          Math.round(
                            Number(formData.costoCompra) /
                              Number(formData.cantidadComprada)
                          )
                        )}{' '}
                        / {formData.unidad}
                      </span>
                    </div>
                  )}
              </div>

              {/* Stock Actual y Umbrales */}
              <div className="p-4 bg-aleman-crema border-2 border-aleman-negro/15 rounded-sm space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <h4 className="text-sm font-bold text-aleman-negro uppercase tracking-wider">
                    Stock Disponible y Umbrales de Alerta
                  </h4>
                  {modalType === 'editar' && (
                    <span className="text-xs font-semibold text-emerald-900 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300 self-start sm:self-auto">
                      ⚖️ Permite ajuste manual (recuento/merma)
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-aleman-negro/80 mb-1">
                      Stock Actual ({formData.unidad})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.stockActual}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          stockActual: e.target.value,
                        })
                      }
                      placeholder="Ej: 12"
                      required
                      className="w-full px-3.5 py-2 bg-white border-2 border-aleman-negro/25 rounded-sm text-base text-aleman-negro font-bold focus:border-aleman-verde"
                    />
                    {modalType === 'editar' && selectedIngrediente && (
                      <div className="mt-1 text-xs">
                        <span className="text-aleman-negro/70 block">
                          Original: {selectedIngrediente.stockActual} {formData.unidad}
                        </span>
                        {(() => {
                          const actual = Number(formData.stockActual);
                          const prev = Number(selectedIngrediente.stockActual);
                          if (!isNaN(actual) && actual !== prev) {
                            const diff = actual - prev;
                            return (
                              <span
                                className={`inline-block mt-0.5 font-bold ${
                                  diff > 0 ? 'text-emerald-800' : 'text-aleman-rojo'
                                }`}
                              >
                                ⚖️ Diferencia de ajuste: {diff > 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2)} {formData.unidad} ({diff > 0 ? 'ingreso / recuento' : 'merma / desperdicio'})
                              </span>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-aleman-rojo mb-1">
                      🔴 Umbral Crítico (≤)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.umbralCritico}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          umbralCritico: e.target.value,
                        })
                      }
                      placeholder="Ej: 10"
                      required
                      className="w-full px-3.5 py-2 bg-white border-2 border-aleman-rojo/40 rounded-sm text-base text-aleman-negro font-bold focus:border-aleman-rojo"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-amber-800 mb-1">
                      🟡 Umbral Bajo (≤)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.umbralBajo}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          umbralBajo: e.target.value,
                        })
                      }
                      placeholder="Ej: 30"
                      required
                      className="w-full px-3.5 py-2 bg-white border-2 border-amber-400 rounded-sm text-base text-aleman-negro font-bold focus:border-amber-600"
                    />
                  </div>
                </div>

                {/* Previsualización del estado resultante */}
                {formData.stockActual !== '' &&
                  formData.umbralCritico !== '' &&
                  formData.umbralBajo !== '' && (
                    <div className="pt-1 flex items-center justify-between text-sm">
                      <span className="text-aleman-negro/70 font-semibold">
                        Estado inicial estimado:
                      </span>
                      {(() => {
                        const previewEstado = calcularEstadoStock(
                          formData.stockActual,
                          formData.umbralCritico,
                          formData.umbralBajo
                        );
                        return (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm font-bold border ${previewEstado.bgBadge}`}
                          >
                            <span>{previewEstado.icon}</span> {previewEstado.label}
                          </span>
                        );
                      })()}
                    </div>
                  )}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t-2 border-aleman-negro/10">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-sm font-bold uppercase tracking-wider text-aleman-negro hover:bg-aleman-crema rounded-sm border border-aleman-negro/25 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-bold uppercase tracking-wider text-aleman-hueso bg-aleman-rojo hover:bg-aleman-rojo-dark rounded-sm border border-aleman-negro/40 transition-colors cursor-pointer"
                >
                  {modalType === 'editar'
                    ? 'Guardar Cambios'
                    : 'Crear Ingrediente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: REGISTRAR NUEVA COMPRA (SUMA STOCK + RECALCULA COSTO) */}
      {/* ========================================================= */}
      {modalType === 'compra' && selectedIngrediente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-aleman-negro/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-aleman-hueso rounded-sm border-2 border-aleman-negro w-full max-w-lg my-8 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b-2 border-aleman-dorado flex items-center justify-between bg-aleman-verde text-aleman-hueso">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🛒</span>
                <div>
                  <h3 className="text-xl font-display font-bold uppercase tracking-wider">
                    Registrar Nueva Compra
                  </h3>
                  <p className="text-sm text-aleman-hueso/70">
                    Ingrediente:{' '}
                    <strong className="text-aleman-dorado">
                      {selectedIngrediente.nombre}
                    </strong>
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseModal}
                className="text-aleman-hueso/70 hover:text-aleman-hueso text-xl font-bold p-1 rounded transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveCompra} className="p-6 space-y-5">
              {/* Información actual de referencia */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-aleman-crema rounded-sm border-2 border-aleman-negro/15 text-sm">
                <div>
                  <span className="text-aleman-negro/70 block font-semibold">Stock Actual:</span>
                  <span className="text-base font-bold text-aleman-negro">
                    {selectedIngrediente.stockActual} {selectedIngrediente.unidad}
                  </span>
                </div>
                <div>
                  <span className="text-aleman-negro/70 block font-semibold">Costo Unitario Previo:</span>
                  <span className="text-base font-bold text-aleman-negro">
                    {formatCurrency(selectedIngrediente.costoUnitario)} /{' '}
                    {selectedIngrediente.unidad}
                  </span>
                </div>
              </div>

              {/* Inputs de la nueva compra */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-aleman-negro uppercase tracking-wider mb-1.5">
                    Cantidad Comprada en esta compra (+{selectedIngrediente.unidad})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={compraData.cantidadComprada}
                    onChange={(e) =>
                      setCompraData({
                        ...compraData,
                        cantidadComprada: e.target.value,
                      })
                    }
                    placeholder={`Ej: 10 (${selectedIngrediente.unidad})`}
                    required
                    className="w-full px-3.5 py-2.5 bg-white border-2 border-aleman-negro/25 rounded-sm text-base text-aleman-negro font-bold focus:border-aleman-verde focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-aleman-negro uppercase tracking-wider mb-1.5">
                    Costo Total Facturado ($)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    value={compraData.costoTotal}
                    onChange={(e) =>
                      setCompraData({
                        ...compraData,
                        costoTotal: e.target.value,
                      })
                    }
                    placeholder="Ej: 22000"
                    required
                    className="w-full px-3.5 py-2.5 bg-white border-2 border-aleman-negro/25 rounded-sm text-base text-aleman-negro font-bold focus:border-aleman-verde focus:outline-none"
                  />
                </div>
              </div>

              {/* Panel de Cálculo Proyectado */}
              {Number(compraData.cantidadComprada) > 0 &&
                Number(compraData.costoTotal) > 0 && (
                  <div className="p-4 bg-emerald-50 border-2 border-emerald-300 rounded-sm space-y-2 text-sm">
                    <span className="font-bold text-emerald-950 block uppercase tracking-wider text-xs">
                      Impacto Proyectado en Stock e Insumos
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-emerald-900 block font-semibold">
                          Nuevo Stock Total:
                        </span>
                        <span className="text-base font-extrabold text-emerald-950">
                          {selectedIngrediente.stockActual +
                            Number(compraData.cantidadComprada)}{' '}
                          {selectedIngrediente.unidad}
                        </span>
                        <span className="text-xs text-emerald-800 font-bold block">
                          (+{compraData.cantidadComprada}{' '}
                          {selectedIngrediente.unidad})
                        </span>
                      </div>

                      <div>
                        <span className="text-emerald-900 block font-semibold">
                          Nuevo Costo Unitario:
                        </span>
                        <span className="text-base font-extrabold text-emerald-950">
                          {formatCurrency(
                            Math.round(
                              Number(compraData.costoTotal) /
                                Number(compraData.cantidadComprada)
                            )
                          )}{' '}
                          / {selectedIngrediente.unidad}
                        </span>
                        <span className="text-xs text-emerald-800 block">
                          Actualiza el cálculo de recetas
                        </span>
                      </div>
                    </div>
                  </div>
                )}

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t-2 border-aleman-negro/10">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-sm font-bold uppercase tracking-wider text-aleman-negro hover:bg-aleman-crema rounded-sm border border-aleman-negro/25 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-bold uppercase tracking-wider text-aleman-hueso bg-emerald-700 hover:bg-emerald-800 rounded-sm border border-aleman-negro/40 transition-colors cursor-pointer"
                >
                  Confirmar Compra y Sumar a Stock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL INFORMATIVO: BLOQUEO DE ELIMINACIÓN (EN USO EN RECETAS) */}
      {/* ========================================================= */}
      {bloqueoEliminacion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-aleman-negro/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-aleman-hueso rounded-sm border-2 border-aleman-rojo w-full max-w-md my-8 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b-2 border-aleman-rojo flex items-center justify-between bg-rose-50 text-aleman-rojo">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🚫</span>
                <div>
                  <h3 className="text-lg font-display font-bold uppercase tracking-wider text-aleman-rojo">
                    No se puede eliminar el ingrediente
                  </h3>
                  <span className="text-sm text-aleman-rojo font-bold">
                    Ingrediente en uso activo en el menú
                  </span>
                </div>
              </div>
              <button
                onClick={() => setBloqueoEliminacion(null)}
                className="text-aleman-rojo/70 hover:text-aleman-rojo text-xl font-bold p-1 rounded transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <p className="text-base text-aleman-negro">
                El ingrediente{' '}
                <strong className="text-aleman-negro">
                  "{bloqueoEliminacion.ingrediente.nombre}"
                </strong>{' '}
                forma parte de la receta de los siguientes{' '}
                <strong>{bloqueoEliminacion.productos.length} producto(s)</strong>:
              </p>

              <div className="max-h-48 overflow-y-auto space-y-2 p-2 bg-aleman-crema border-2 border-aleman-negro/15 rounded-sm">
                {bloqueoEliminacion.productos.map((prod) => (
                  <div
                    key={prod.id}
                    className="flex items-center justify-between p-2 bg-white rounded-sm border border-aleman-negro/20 text-sm"
                  >
                    <span className="font-bold text-aleman-negro">
                      🍽️ {prod.nombre}
                    </span>
                    <span className="text-aleman-negro/60 font-semibold">
                      {prod.categoriaNombre}
                    </span>
                  </div>
                ))}
              </div>

              <div className="p-3 bg-amber-50 border border-amber-300 rounded-sm text-sm text-amber-950">
                💡 <strong>¿Cómo proceder?</strong> Para poder eliminar este ingrediente, primero debés editar o remover su uso de las recetas correspondientes en <strong>Gestión de Menú</strong>.
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 bg-aleman-crema border-t-2 border-aleman-negro/10 flex justify-end">
              <button
                type="button"
                onClick={() => setBloqueoEliminacion(null)}
                className="px-5 py-2 text-sm font-bold uppercase tracking-wider text-aleman-negro bg-white border-2 border-aleman-negro/30 hover:bg-aleman-hueso rounded-sm transition-colors cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
