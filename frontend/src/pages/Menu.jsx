import { useState, useEffect } from 'react';
import apiClient from '../services/apiClient';
import {
  calcularCostoReceta,
  formatCurrency,
} from '../services/mockData';

export default function Menu() {
  const [activeTab, setActiveTab] = useState('productos'); // 'productos' | 'categorias'
  const [categorias, setCategorias] = useState([]);
  const [productos, setProductos] = useState([]);
  const [ingredientes, setIngredientes] = useState([]);

  // Notificación tipo toast / feedback
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Carga inicial de backend
  const cargarDatosMenu = async () => {
    try {
      const [resCat, resProd, resIng] = await Promise.all([
        apiClient.get('/categorias').catch(() => ({ data: { categorias: [] } })),
        apiClient.get('/productos').catch(() => ({ data: { productos: [] } })),
        apiClient.get('/ingredientes').catch(() => ({ data: { ingredientes: [] } })),
      ]);

      const listCategorias = (resCat.data?.categorias || []).map((c) => ({
        id: c._id || c.id,
        _id: c._id || c.id,
        nombre: c.nombre,
        tipo: c.tipo,
      }));
      setCategorias(listCategorias);

      const listProductos = (resProd.data?.productos || []).map((p) => {
        const catObj = typeof p.categoriaId === 'object' ? p.categoriaId : null;
        return {
          id: p._id || p.id,
          _id: p._id || p.id,
          nombre: p.nombre,
          categoriaId: catObj ? catObj._id : p.categoriaId,
          categoriaNombre: catObj ? catObj.nombre : 'Sin categoría',
          precioVenta: p.precioVenta,
          disponible: p.disponible,
          receta: (p.receta || []).map((r) => ({
            ingredienteId: typeof r.ingredienteId === 'object' ? r.ingredienteId?._id : r.ingredienteId,
            cantidad: r.cantidad,
          })),
        };
      });
      setProductos(listProductos);

      const listIngredientes = (resIng.data?.ingredientes || []).map((i) => ({
        id: i._id || i.id,
        _id: i._id || i.id,
        nombre: i.nombre,
        unidad: i.unidadMedida || i.unidad || 'kg',
        costoUnitario: i.costoUnitario || (i.cantidadComprada > 0 ? Math.round(i.precioCompra / i.cantidadComprada) : 0),
      }));
      setIngredientes(listIngredientes);
    } catch {
      showToast('Error al cargar datos del menú desde el servidor');
    }
  };

  useEffect(() => {
    cargarDatosMenu();
  }, []);

  // Filtros en tabla de productos
  const [selectedCategoriaFilter, setSelectedCategoriaFilter] = useState('todas');
  const [searchTerm, setSearchTerm] = useState('');

  // Estado para crear nueva categoría
  const [nuevaCatNombre, setNuevaCatNombre] = useState('');
  const [nuevaCatTipo, setNuevaCatTipo] = useState('comida');

  // Estado para modal de producto (Crear / Editar)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState(null);

  const initialFormState = {
    nombre: '',
    categoriaId: '',
    precioVenta: '',
    disponible: true,
    receta: [],
  };

  const [formData, setFormData] = useState(initialFormState);

  // Manejadores de Categorías
  const handleCrearCategoria = async (e) => {
    e.preventDefault();
    if (!nuevaCatNombre.trim()) return;

    try {
      const res = await apiClient.post('/categorias', {
        nombre: nuevaCatNombre.trim(),
        tipo: nuevaCatTipo,
      });
      showToast(`Categoría "${res.data?.categoria?.nombre || nuevaCatNombre}" creada con éxito`);
      setNuevaCatNombre('');
      setNuevaCatTipo('comida');
      cargarDatosMenu();
    } catch (err) {
      alert(err.response?.data?.mensaje || 'Error al crear la categoría');
    }
  };

  const handleEliminarCategoria = async (id) => {
    if (window.confirm('¿Seguro que deseas eliminar esta categoría?')) {
      try {
        await apiClient.delete(`/categorias/${id}`);
        showToast('Categoría eliminada con éxito');
        if (selectedCategoriaFilter === id) {
          setSelectedCategoriaFilter('todas');
        }
        cargarDatosMenu();
      } catch (err) {
        alert(err.response?.data?.mensaje || 'Error al eliminar categoría');
      }
    }
  };

  // Manejadores de Modal de Producto
  const handleOpenCreateModal = () => {
    setEditingProductId(null);
    setFormData({
      nombre: '',
      categoriaId: categorias[0]?.id || '',
      precioVenta: '',
      disponible: true,
      receta: [{ ingredienteId: ingredientes[0]?.id || '', cantidad: '' }],
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (producto) => {
    setEditingProductId(producto.id);
    setFormData({
      nombre: producto.nombre,
      categoriaId: producto.categoriaId,
      precioVenta: producto.precioVenta,
      disponible: producto.disponible,
      receta: producto.receta.map((r) => ({ ...r })),
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingProductId(null);
  };

  // Receta dinámica dentro del modal
  const handleAddRecetaRow = () => {
    setFormData({
      ...formData,
      receta: [
        ...formData.receta,
        { ingredienteId: ingredientes[0]?.id || '', cantidad: '' },
      ],
    });
  };

  const handleRemoveRecetaRow = (index) => {
    const updated = formData.receta.filter((_, i) => i !== index);
    setFormData({ ...formData, receta: updated });
  };

  const handleRecetaChange = (index, field, value) => {
    const updated = [...formData.receta];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, receta: updated });
  };

  // Guardar Producto (Crear / Editar)
  const handleSaveProduct = async (e) => {
    e.preventDefault();

    if (!formData.nombre.trim()) {
      alert('Por favor ingresá un nombre para el producto.');
      return;
    }

    const precioNum = Number(formData.precioVenta);
    if (isNaN(precioNum) || precioNum <= 0) {
      alert('Por favor ingresá un precio de venta válido mayor a 0.');
      return;
    }

    if (!formData.categoriaId) {
      alert('Por favor seleccioná una categoría para el producto.');
      return;
    }

    // Limpiar receta de ingredientes inválidos
    const recetaLimpia = formData.receta
      .filter((r) => r.ingredienteId && Number(r.cantidad) > 0)
      .map((r) => ({
        ingredienteId: r.ingredienteId,
        cantidad: Number(r.cantidad),
      }));

    const payload = {
      nombre: formData.nombre.trim(),
      categoriaId: formData.categoriaId,
      precioVenta: precioNum,
      disponible: formData.disponible,
      receta: recetaLimpia,
    };

    try {
      if (editingProductId) {
        await apiClient.put(`/productos/${editingProductId}`, payload);
        showToast(`Producto "${formData.nombre}" actualizado con éxito`);
      } else {
        await apiClient.post('/productos', payload);
        showToast(`Producto "${formData.nombre}" creado con éxito`);
      }
      handleCloseModal();
      cargarDatosMenu();
    } catch (err) {
      alert(err.response?.data?.mensaje || 'Error al guardar el producto');
    }
  };

  const handleEliminarProducto = async (id) => {
    if (window.confirm('¿Seguro que deseas eliminar este producto?')) {
      try {
        await apiClient.delete(`/productos/${id}`);
        showToast('Producto eliminado con éxito');
        cargarDatosMenu();
      } catch (err) {
        alert(err.response?.data?.mensaje || 'Error al eliminar producto');
      }
    }
  };

  const handleToggleDisponible = async (id) => {
    try {
      const res = await apiClient.patch(`/productos/${id}/disponibilidad`);
      showToast(res.data?.mensaje || 'Disponibilidad actualizada');
      cargarDatosMenu();
    } catch (err) {
      alert(err.response?.data?.mensaje || 'Error al cambiar disponibilidad');
    }
  };

  // Cálculos en tiempo real del modal
  const modalCostoCalculado = calcularCostoReceta(formData.receta, ingredientes);
  const modalPrecioVentaNum = Number(formData.precioVenta) || 0;
  const modalMargenBruto = modalPrecioVentaNum - modalCostoCalculado;
  const modalMargenPorcentaje =
    modalPrecioVentaNum > 0
      ? ((modalMargenBruto / modalPrecioVentaNum) * 100).toFixed(1)
      : 0;

  // Filtrado de productos en la tabla
  const productosFiltrados = productos.filter((prod) => {
    const matchCat =
      selectedCategoriaFilter === 'todas' ||
      prod.categoriaId === selectedCategoriaFilter;
    const matchSearch =
      prod.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prod.categoriaNombre.toLowerCase().includes(searchTerm.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="space-y-6 font-body text-aleman-negro">
      {/* Toast de notificación rápida */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-aleman-verde text-aleman-hueso text-sm font-semibold px-4 py-2.5 rounded-sm shadow-md flex items-center gap-2 border-2 border-aleman-dorado animate-bounce">
          <span>✨</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Encabezado y Navegación de Pestañas */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-aleman-negro">
            Gestión de Menú
          </h1>
          <p className="text-base text-aleman-negro/70">
            Administrá los platos, bebidas, recetas y categorías de tu cervecería & pizzería
          </p>
        </div>

        {/* Selector de Pestañas */}
        <div className="flex bg-aleman-verde p-1 rounded-sm border border-aleman-dorado/40 self-start sm:self-auto shadow-2xs">
          <button
            onClick={() => setActiveTab('productos')}
            className={`px-4 py-2 rounded-sm text-base font-bold transition-all cursor-pointer ${
              activeTab === 'productos'
                ? 'bg-aleman-dorado text-aleman-negro'
                : 'text-aleman-hueso hover:text-aleman-dorado'
            }`}
          >
            🍽️ Productos ({productos.length})
          </button>
          <button
            onClick={() => setActiveTab('categorias')}
            className={`px-4 py-2 rounded-sm text-base font-bold transition-all cursor-pointer ${
              activeTab === 'categorias'
                ? 'bg-aleman-dorado text-aleman-negro'
                : 'text-aleman-hueso hover:text-aleman-dorado'
            }`}
          >
            🏷️ Categorías ({categorias.length})
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* SECCIÓN 1: CATEGORÍAS */}
      {/* ========================================================= */}
      {activeTab === 'categorias' && (
        <div className="space-y-6">
          {/* Formulario Agregar Categoría */}
          <div className="bg-aleman-hueso rounded-sm p-6 border-2 border-aleman-negro/20">
            <h2 className="text-xl font-display font-bold text-aleman-negro mb-1">
              Nueva Categoría
            </h2>
            <p className="text-base text-aleman-negro/70 mb-4">
              Creá categorías para organizar los productos y separar las ventas en
              Comida y Bebida.
            </p>

            <form
              onSubmit={handleCrearCategoria}
              className="flex flex-col sm:flex-row gap-4 items-end"
            >
              <div className="flex-1 w-full">
                <label className="block text-sm font-bold text-aleman-negro uppercase tracking-wider mb-1.5">
                  Nombre de la categoría
                </label>
                <input
                  type="text"
                  value={nuevaCatNombre}
                  onChange={(e) => setNuevaCatNombre(e.target.value)}
                  placeholder="Ej: Calzones, Postres, Cervezas..."
                  required
                  className="w-full px-3.5 py-2.5 bg-white border-2 border-aleman-negro/25 rounded-sm text-base text-aleman-negro focus:border-aleman-verde focus:outline-none"
                />
              </div>

              <div className="w-full sm:w-48">
                <label className="block text-sm font-bold text-aleman-negro uppercase tracking-wider mb-1.5">
                  Tipo de rubro
                </label>
                <select
                  value={nuevaCatTipo}
                  onChange={(e) => setNuevaCatTipo(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border-2 border-aleman-negro/25 rounded-sm text-base text-aleman-negro focus:border-aleman-verde focus:outline-none font-semibold"
                >
                  <option value="comida">🍕 Comida</option>
                  <option value="bebida">🥤 Bebida</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full sm:w-auto px-5 py-2.5 bg-aleman-rojo hover:bg-aleman-rojo-dark text-aleman-hueso font-bold text-base rounded-sm border border-aleman-negro/40 transition-colors cursor-pointer flex items-center justify-center gap-1.5 uppercase tracking-wider"
              >
                <span>+</span> Agregar Categoría
              </button>
            </form>
          </div>

          {/* Listado de Categorías */}
          <div className="bg-aleman-hueso rounded-sm border-2 border-aleman-negro/20 overflow-hidden">
            <div className="p-5 border-b-2 border-aleman-negro/10 flex items-center justify-between">
              <h3 className="font-display font-bold text-aleman-negro text-xl">
                Categorías Registradas
              </h3>
              <span className="text-sm font-semibold text-aleman-negro/70">
                {categorias.length} categorías en total
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-base text-aleman-negro">
                <thead className="bg-aleman-crema text-sm uppercase font-bold text-aleman-negro border-b-2 border-aleman-negro/20">
                  <tr>
                    <th className="py-3 px-6">Categoría</th>
                    <th className="py-3 px-6">Tipo</th>
                    <th className="py-3 px-6 text-center">Productos Asociados</th>
                    <th className="py-3 px-6 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-aleman-negro/10">
                  {categorias.map((cat) => {
                    const cantProductos = productos.filter(
                      (p) => p.categoriaId === cat.id
                    ).length;
                    return (
                      <tr
                        key={cat.id}
                        className="hover:bg-aleman-crema/50 transition-colors"
                      >
                        <td className="py-4 px-6 font-bold text-aleman-negro">
                          {cat.nombre}
                        </td>
                        <td className="py-4 px-6">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-sm text-sm font-bold border ${
                              cat.tipo === 'bebida'
                                ? 'bg-blue-100 text-blue-900 border-blue-300'
                                : 'bg-amber-100 text-amber-900 border-amber-300'
                            }`}
                          >
                            {cat.tipo === 'bebida' ? '🥤 Bebida' : '🍕 Comida'}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <span className="inline-block px-2.5 py-0.5 rounded-sm bg-aleman-crema border border-aleman-negro/20 font-bold text-aleman-negro text-sm">
                            {cantProductos}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <button
                            onClick={() => handleEliminarCategoria(cat.id)}
                            className="text-aleman-rojo hover:text-aleman-rojo-dark font-bold text-sm px-2.5 py-1.5 hover:bg-rose-50 rounded-sm transition-colors border border-transparent hover:border-aleman-rojo/30 cursor-pointer"
                          >
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* SECCIÓN 2: PRODUCTOS */}
      {/* ========================================================= */}
      {activeTab === 'productos' && (
        <div className="space-y-6">
          {/* Barra de Filtros y Acción Nuevo Producto */}
          <div className="bg-aleman-hueso rounded-sm p-4 border-2 border-aleman-negro/20 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <input
                type="text"
                placeholder="Buscar por nombre..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-3.5 py-2 bg-white border-2 border-aleman-negro/25 rounded-sm text-base text-aleman-negro focus:border-aleman-verde focus:outline-none w-full sm:w-60"
              />

              <select
                value={selectedCategoriaFilter}
                onChange={(e) => setSelectedCategoriaFilter(e.target.value)}
                className="px-3.5 py-2 bg-white border-2 border-aleman-negro/25 rounded-sm text-base text-aleman-negro focus:border-aleman-verde focus:outline-none font-semibold"
              >
                <option value="todas">Todas las categorías</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleOpenCreateModal}
              className="w-full md:w-auto px-4 py-2.5 bg-aleman-rojo hover:bg-aleman-rojo-dark text-aleman-hueso font-bold text-base rounded-sm border border-aleman-negro/40 transition-colors flex items-center justify-center gap-2 uppercase tracking-wider cursor-pointer"
            >
              <span className="text-lg leading-none">+</span> Nuevo Producto
            </button>
          </div>

          {/* DESKTOP (>= md): Tabla de Productos intacta */}
          <div className="hidden md:block bg-aleman-hueso rounded-sm border-2 border-aleman-negro/20 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-base text-aleman-negro">
                <thead className="bg-aleman-crema text-sm uppercase font-bold text-aleman-negro border-b-2 border-aleman-negro/20">
                  <tr>
                    <th className="py-3.5 px-6">Producto</th>
                    <th className="py-3.5 px-6">Categoría</th>
                    <th className="py-3.5 px-6 text-right">Precio Venta</th>
                    <th className="py-3.5 px-6 text-right">Costo Receta</th>
                    <th className="py-3.5 px-6 text-right">Margen Bruto</th>
                    <th className="py-3.5 px-6 text-center">Estado</th>
                    <th className="py-3.5 px-6 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-aleman-negro/10">
                  {productosFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-aleman-negro/50">
                        No se encontraron productos con los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    productosFiltrados.map((prod) => {
                      const costo = calcularCostoReceta(prod.receta, ingredientes);
                      const margen = prod.precioVenta - costo;
                      const margenPct =
                        prod.precioVenta > 0
                          ? ((margen / prod.precioVenta) * 100).toFixed(0)
                          : 0;

                      return (
                        <tr
                          key={prod.id}
                          className="hover:bg-aleman-crema/50 transition-colors"
                        >
                          <td className="py-4 px-6">
                            <div className="font-bold text-aleman-negro">
                              {prod.nombre}
                            </div>
                            <div className="text-sm text-aleman-negro/60">
                              {prod.receta.length} insumo(s) en receta
                            </div>
                          </td>

                          <td className="py-4 px-6">
                            <span className="inline-block px-2.5 py-0.5 rounded-sm bg-aleman-dorado/20 text-aleman-negro text-sm font-bold border border-aleman-dorado">
                              {prod.categoriaNombre}
                            </span>
                          </td>

                          <td className="py-4 px-6 text-right font-display font-bold text-aleman-negro text-lg">
                            {formatCurrency(prod.precioVenta)}
                          </td>

                          <td className="py-4 px-6 text-right font-semibold text-aleman-negro/70 text-base">
                            {formatCurrency(costo)}
                          </td>

                          <td className="py-4 px-6 text-right">
                            <div className="font-bold text-emerald-800 text-base">
                              {formatCurrency(margen)}
                            </div>
                            <span className="text-sm text-aleman-negro/60 font-semibold">
                              {margenPct}% margen
                            </span>
                          </td>

                          <td className="py-4 px-6 text-center">
                            <button
                              onClick={() => handleToggleDisponible(prod.id)}
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-sm text-sm font-bold border transition-colors cursor-pointer ${
                                prod.disponible
                                  ? 'bg-emerald-100 text-emerald-900 border-emerald-300 hover:bg-emerald-200'
                                  : 'bg-rose-100 text-rose-900 border-rose-300 hover:bg-rose-200'
                              }`}
                              title="Hacé click para cambiar estado"
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  prod.disponible ? 'bg-emerald-600' : 'bg-aleman-rojo'
                                }`}
                              ></span>
                              {prod.disponible ? 'Disponible' : 'Agotado'}
                            </button>
                          </td>

                          <td className="py-4 px-6 text-right space-x-2">
                            <button
                              onClick={() => handleOpenEditModal(prod)}
                              className="text-aleman-dorado hover:text-amber-800 font-bold text-sm px-2.5 py-1 hover:bg-amber-50 rounded-sm border border-aleman-dorado/30 transition-colors cursor-pointer"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleEliminarProducto(prod.id)}
                              className="text-aleman-rojo hover:text-aleman-rojo-dark font-bold text-sm px-2.5 py-1 hover:bg-rose-50 rounded-sm border border-aleman-rojo/30 transition-colors cursor-pointer"
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

          {/* MOBILE (< md): Cards apiladas */}
          <div className="md:hidden space-y-3">
            {productosFiltrados.length === 0 ? (
              <div className="bg-aleman-hueso rounded-sm border-2 border-aleman-negro/20 p-8 text-center text-base text-aleman-negro/50">
                No se encontraron productos con los filtros seleccionados.
              </div>
            ) : (
              productosFiltrados.map((prod) => {
                const costo = calcularCostoReceta(prod.receta, ingredientes);
                const margen = prod.precioVenta - costo;
                const margenPct =
                  prod.precioVenta > 0
                    ? ((margen / prod.precioVenta) * 100).toFixed(0)
                    : 0;

                return (
                  <div
                    key={prod.id}
                    className="bg-aleman-hueso rounded-sm p-4 border-2 border-aleman-negro/20 hover:border-aleman-dorado transition-colors space-y-3 shadow-2xs"
                  >
                    {/* Arriba: categoría + estado (disponible/agotado) y nombre del producto */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-block px-2.5 py-0.5 rounded-sm bg-aleman-dorado/20 text-aleman-negro text-xs font-bold border border-aleman-dorado">
                          {prod.categoriaNombre}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleToggleDisponible(prod.id)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-xs font-bold border transition-colors cursor-pointer ${
                            prod.disponible
                              ? 'bg-emerald-100 text-emerald-900 border-emerald-300 hover:bg-emerald-200 active:scale-95'
                              : 'bg-rose-100 text-rose-900 border-rose-300 hover:bg-rose-200 active:scale-95'
                          }`}
                          title="Hacé click para cambiar estado"
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              prod.disponible ? 'bg-emerald-600' : 'bg-aleman-rojo'
                            }`}
                          ></span>
                          {prod.disponible ? 'Disponible' : 'Agotado'}
                        </button>
                      </div>
                      <h3 className="text-lg font-display font-bold text-aleman-negro leading-tight">
                        {prod.nombre}
                      </h3>
                    </div>

                    {/* Debajo: precio de venta destacado y grande */}
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-aleman-negro/60 block">
                        Precio de Venta
                      </span>
                      <div className="text-2xl font-display font-bold text-aleman-negro">
                        {formatCurrency(prod.precioVenta)}
                      </div>
                    </div>

                    {/* Debajo: datos de costo/rentabilidad e insumos en receta (más chicos/secundarios) */}
                    <div className="p-2.5 bg-aleman-crema/60 rounded-sm border border-aleman-negro/15 text-xs space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-aleman-negro/70">
                          Costo receta:{' '}
                          <strong className="text-aleman-negro font-semibold">
                            {formatCurrency(costo)}
                          </strong>
                        </span>
                        <span className="text-aleman-negro/70">
                          Margen:{' '}
                          <strong
                            className={`font-semibold ${
                              margen >= 0 ? 'text-emerald-800' : 'text-aleman-rojo'
                            }`}
                          >
                            {formatCurrency(margen)} ({margenPct}%)
                          </strong>
                        </span>
                      </div>
                      <div className="text-[11px] text-aleman-negro/60 font-semibold border-t border-aleman-negro/10 pt-1 flex items-center gap-1">
                        <span>📋</span> {prod.receta.length} insumo(s) en receta
                      </div>
                    </div>

                    {/* Al final: botones de Editar y Eliminar cómodos para tocar */}
                    <div className="pt-2.5 border-t border-aleman-negro/10 grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(prod)}
                        className="w-full py-2.5 px-3 text-sm font-bold uppercase tracking-wider text-aleman-negro bg-aleman-crema hover:bg-aleman-dorado/20 active:bg-aleman-dorado/30 rounded-sm border border-aleman-negro/25 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <span>✏️</span> Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEliminarProducto(prod.id)}
                        className="w-full py-2.5 px-3 text-sm font-bold uppercase tracking-wider text-aleman-rojo hover:text-aleman-rojo-dark hover:bg-rose-50 active:bg-rose-100 rounded-sm border border-aleman-rojo/30 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <span>🗑️</span> Eliminar
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL CONSTRUCTOR DE PRODUCTO Y RECETA */}
      {/* ========================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-aleman-negro/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-aleman-hueso rounded-sm border-2 border-aleman-negro w-full max-w-2xl my-8 overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b-2 border-aleman-dorado flex items-center justify-between bg-aleman-verde text-aleman-hueso">
              <h3 className="text-xl font-display font-bold uppercase tracking-wider">
                {editingProductId ? 'Editar Producto' : 'Nuevo Producto'}
              </h3>
              <button
                onClick={handleCloseModal}
                className="text-aleman-hueso/70 hover:text-aleman-hueso text-xl font-bold p-1 rounded transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveProduct} className="p-6 space-y-6">
              {/* Información General */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-bold text-aleman-negro uppercase tracking-wider mb-1.5">
                    Nombre del Producto
                  </label>
                  <input
                    type="text"
                    value={formData.nombre}
                    onChange={(e) =>
                      setFormData({ ...formData, nombre: e.target.value })
                    }
                    placeholder="Ej: Pizza Napolitana con Ajo"
                    required
                    className="w-full px-3.5 py-2.5 bg-white border-2 border-aleman-negro/25 rounded-sm text-base text-aleman-negro focus:border-aleman-verde focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-aleman-negro uppercase tracking-wider mb-1.5">
                    Categoría
                  </label>
                  <select
                    value={formData.categoriaId}
                    onChange={(e) =>
                      setFormData({ ...formData, categoriaId: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 bg-white border-2 border-aleman-negro/25 rounded-sm text-base text-aleman-negro focus:border-aleman-verde focus:outline-none font-semibold"
                  >
                    {categorias.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre} ({c.tipo})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-aleman-negro uppercase tracking-wider mb-1.5">
                    Precio de Venta ($)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    value={formData.precioVenta}
                    onChange={(e) =>
                      setFormData({ ...formData, precioVenta: e.target.value })
                    }
                    placeholder="Ej: 8500"
                    required
                    className="w-full px-3.5 py-2.5 bg-white border-2 border-aleman-negro/25 rounded-sm text-base text-aleman-negro focus:border-aleman-verde focus:outline-none font-bold"
                  />
                </div>
              </div>

              {/* Toggle de Disponibilidad */}
              <div className="flex items-center gap-3 p-3 bg-aleman-crema rounded-sm border-2 border-aleman-negro/15">
                <input
                  type="checkbox"
                  id="disponibleCheck"
                  checked={formData.disponible}
                  onChange={(e) =>
                    setFormData({ ...formData, disponible: e.target.checked })
                  }
                  className="w-4 h-4 text-aleman-verde rounded focus:ring-aleman-verde cursor-pointer"
                />
                <label
                  htmlFor="disponibleCheck"
                  className="text-base font-semibold text-aleman-negro cursor-pointer select-none"
                >
                  Producto disponible para venta en salón y pedidos
                </label>
              </div>

              {/* Constructor de Receta */}
              <div className="space-y-3 pt-2">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <h4 className="text-base font-display font-bold text-aleman-negro uppercase tracking-wider">
                      Constructor de Receta (Insumos)
                    </h4>
                    <p className="text-sm text-aleman-negro/70">
                      Definí los ingredientes para calcular el costo y margen en tiempo
                      real.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddRecetaRow}
                    className="w-full md:w-auto text-sm font-bold text-aleman-negro bg-aleman-dorado hover:bg-aleman-dorado-light px-4 py-2.5 md:py-1.5 rounded-sm transition-colors border border-aleman-negro/30 cursor-pointer uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-2xs active:scale-98"
                  >
                    <span className="text-base leading-none font-bold">+</span> Agregar Ingrediente
                  </button>
                </div>

                {formData.receta.length === 0 ? (
                  <div className="p-4 bg-aleman-crema border-2 border-dashed border-aleman-negro/20 rounded-sm text-center text-sm text-aleman-negro/60">
                    No agregaste ingredientes a la receta. (Costo: $0)
                  </div>
                ) : (
                  <div className="space-y-3 max-h-72 md:max-h-56 overflow-y-auto pr-1">
                    {formData.receta.map((row, index) => {
                      const selectedIng = ingredientes.find(
                        (i) => i.id === row.ingredienteId
                      );
                      const subtotal = selectedIng
                        ? (Number(row.cantidad) || 0) * selectedIng.costoUnitario
                        : 0;

                      return (
                        <div key={index}>
                          {/* DESKTOP (>= md): fila horizontal exacta */}
                          <div className="hidden md:flex items-center gap-2 p-2.5 bg-aleman-crema rounded-sm border-2 border-aleman-negro/15">
                            {/* Selector de Ingrediente */}
                            <div className="flex-1">
                              <select
                                value={row.ingredienteId}
                                onChange={(e) =>
                                  handleRecetaChange(
                                    index,
                                    'ingredienteId',
                                    e.target.value
                                  )
                                }
                                className="w-full px-2.5 py-1.5 bg-white border border-aleman-negro/25 rounded-sm text-sm text-aleman-negro focus:border-aleman-verde font-semibold"
                              >
                                {ingredientes.map((ing) => (
                                  <option key={ing.id} value={ing.id}>
                                    {ing.nombre} ({formatCurrency(ing.costoUnitario)}/
                                    {ing.unidad})
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Cantidad requerida */}
                            <div className="w-24">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="Cant."
                                value={row.cantidad}
                                onChange={(e) =>
                                  handleRecetaChange(index, 'cantidad', e.target.value)
                                }
                                className="w-full px-2.5 py-1.5 bg-white border border-aleman-negro/25 rounded-sm text-sm text-aleman-negro text-center font-bold focus:border-aleman-verde"
                              />
                            </div>

                            {/* Unidad */}
                            <span className="text-sm font-bold text-aleman-negro/70 w-12 text-left">
                              {selectedIng?.unidad || ''}
                            </span>

                            {/* Subtotal */}
                            <span className="text-sm font-bold text-aleman-negro w-20 text-right">
                              {formatCurrency(subtotal)}
                            </span>

                            {/* Eliminar Fila */}
                            <button
                              type="button"
                              onClick={() => handleRemoveRecetaRow(index)}
                              className="text-aleman-negro/40 hover:text-aleman-rojo p-1 rounded transition-colors cursor-pointer"
                              title="Quitar ingrediente"
                            >
                              ✕
                            </button>
                          </div>

                          {/* MOBILE (< md): mini-card apilada */}
                          <div className="md:hidden bg-aleman-crema/75 p-3 rounded-sm border-2 border-aleman-negro/15 space-y-2.5 shadow-2xs">
                            {/* Encabezado de mini-card: etiqueta y botón quitar en la esquina */}
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold uppercase tracking-wider text-aleman-negro/70">
                                Insumo #{index + 1}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRemoveRecetaRow(index)}
                                className="px-2.5 py-1 text-xs font-bold text-aleman-rojo hover:text-aleman-rojo-dark bg-white hover:bg-rose-50 border border-aleman-rojo/30 rounded-sm transition-colors cursor-pointer flex items-center gap-1"
                                title="Quitar ingrediente"
                              >
                                <span>🗑️</span> Quitar
                              </button>
                            </div>

                            {/* Primera fila: selector de ingrediente (ancho completo) */}
                            <div>
                              <select
                                value={row.ingredienteId}
                                onChange={(e) =>
                                  handleRecetaChange(
                                    index,
                                    'ingredienteId',
                                    e.target.value
                                  )
                                }
                                className="w-full px-3 py-2 bg-white border-2 border-aleman-negro/25 rounded-sm text-sm text-aleman-negro focus:border-aleman-verde font-semibold"
                              >
                                {ingredientes.map((ing) => (
                                  <option key={ing.id} value={ing.id}>
                                    {ing.nombre} ({formatCurrency(ing.costoUnitario)}/{ing.unidad})
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Segunda fila: cantidad e input de unidad lado a lado + subtotal */}
                            <div className="flex items-center justify-between gap-3 pt-1 border-t border-aleman-negro/10">
                              <div className="flex items-center gap-2">
                                <div className="w-28">
                                  <label className="block text-[11px] font-bold text-aleman-negro/60 uppercase tracking-wider mb-1">
                                    Cantidad
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    placeholder="0"
                                    value={row.cantidad}
                                    onChange={(e) =>
                                      handleRecetaChange(index, 'cantidad', e.target.value)
                                    }
                                    className="w-full px-3 py-2 bg-white border-2 border-aleman-negro/25 rounded-sm text-base text-aleman-negro text-center font-bold focus:border-aleman-verde"
                                  />
                                </div>
                                <div className="pt-5">
                                  <span className="inline-block px-2.5 py-2 bg-aleman-hueso text-aleman-negro/80 border border-aleman-negro/20 rounded-sm text-sm font-bold">
                                    {selectedIng?.unidad || 'un.'}
                                  </span>
                                </div>
                              </div>

                              <div className="text-right pt-2">
                                <span className="block text-[11px] font-bold text-aleman-negro/60 uppercase tracking-wider">
                                  Subtotal
                                </span>
                                <span className="font-display font-bold text-base text-aleman-negro">
                                  {formatCurrency(subtotal)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Resumen de Rentabilidad en Tiempo Real */}
              <div className="p-4 bg-aleman-crema border-2 border-aleman-dorado/60 rounded-sm grid grid-cols-1 md:grid-cols-3 gap-3 text-center divide-y md:divide-y-0 divide-aleman-negro/15">
                <div className="pt-0">
                  <span className="text-xs md:text-sm text-aleman-negro/70 block font-semibold uppercase tracking-wider">
                    Costo Total Receta
                  </span>
                  <span className="text-xl md:text-lg font-display font-bold text-aleman-negro mt-0.5 block">
                    {formatCurrency(modalCostoCalculado)}
                  </span>
                </div>
                <div className="pt-2.5 md:pt-0">
                  <span className="text-xs md:text-sm text-aleman-negro/70 block font-semibold uppercase tracking-wider">
                    Precio Venta
                  </span>
                  <span className="text-xl md:text-lg font-display font-bold text-aleman-negro mt-0.5 block">
                    {formatCurrency(modalPrecioVentaNum)}
                  </span>
                </div>
                <div className="pt-2.5 md:pt-0">
                  <span className="text-xs md:text-sm text-aleman-negro/70 block font-semibold uppercase tracking-wider">
                    Margen Estimado
                  </span>
                  <span
                    className={`text-xl md:text-lg font-display font-bold mt-0.5 block ${
                      modalMargenBruto >= 0 ? 'text-emerald-800' : 'text-aleman-rojo'
                    }`}
                  >
                    {formatCurrency(modalMargenBruto)} ({modalMargenPorcentaje}%)
                  </span>
                </div>
              </div>

              {/* Modal Footer Actions */}
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
                  className="px-5 py-2 text-sm font-bold uppercase tracking-wider text-aleman-hueso bg-aleman-rojo hover:bg-aleman-rojo-dark rounded-sm border border-aleman-negro/40 transition-colors cursor-pointer"
                >
                  {editingProductId ? 'Guardar Cambios' : 'Crear Producto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
