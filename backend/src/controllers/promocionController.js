const Promocion = require('../models/Promocion');
const Producto = require('../models/Producto');

// @desc    Obtener todas las promociones (activas e inactivas)
// @route   GET /api/promociones
// @access  Privado (Solo Dueño)
const obtenerPromociones = async (req, res) => {
  try {
    const promociones = await Promocion.find({ sucursalId: 'sucursal-1' })
      .populate('productos.productoId', 'nombre categoriaId precioVenta disponible')
      .sort({ createdAt: -1 });

    res.json({ promociones });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener promociones', error: error.message });
  }
};

// @desc    Crear una nueva promoción (combo)
// @route   POST /api/promociones
// @access  Privado (Solo Dueño)
const crearPromocion = async (req, res) => {
  try {
    const { nombre, productos, precioFijo } = req.body;

    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ mensaje: 'El nombre de la promoción es obligatorio' });
    }

    if (precioFijo === undefined || precioFijo === null || isNaN(precioFijo) || Number(precioFijo) < 0) {
      return res.status(400).json({ mensaje: 'El precioFijo es obligatorio y debe ser mayor o igual a 0' });
    }

    if (!productos || !Array.isArray(productos) || productos.length === 0) {
      return res.status(400).json({ mensaje: 'Debe incluir al menos un producto componente en la promoción' });
    }

    // Validar productos existentes
    for (const comp of productos) {
      if (!comp.productoId) {
        return res.status(400).json({ mensaje: 'Cada componente debe incluir productoId' });
      }
      const prodExiste = await Producto.findById(comp.productoId);
      if (!prodExiste) {
        return res.status(404).json({ mensaje: `El producto componente con ID ${comp.productoId} no existe` });
      }
    }

    const existePromo = await Promocion.findOne({
      sucursalId: 'sucursal-1',
      nombre: nombre.trim()
    });

    if (existePromo) {
      return res.status(400).json({ mensaje: 'Ya existe una promoción con ese nombre' });
    }

    const nuevaPromocion = await Promocion.create({
      sucursalId: 'sucursal-1',
      nombre: nombre.trim(),
      productos: productos.map((p) => ({
        productoId: p.productoId,
        cantidad: p.cantidad && p.cantidad > 0 ? Number(p.cantidad) : 1
      })),
      precioFijo: Number(precioFijo),
      activo: true,
      fechaCreacion: new Date()
    });

    const promocionPoblada = await Promocion.findById(nuevaPromocion._id)
      .populate('productos.productoId', 'nombre categoriaId precioVenta disponible');

    res.status(201).json({
      mensaje: 'Promoción creada exitosamente',
      promocion: promocionPoblada
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al crear la promoción', error: error.message });
  }
};

// @desc    Editar una promoción existente
// @route   PUT /api/promociones/:id
// @access  Privado (Solo Dueño)
const editarPromocion = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, productos, precioFijo } = req.body;

    const promocion = await Promocion.findById(id);
    if (!promocion) {
      return res.status(404).json({ mensaje: 'Promoción no encontrada' });
    }

    if (nombre) {
      if (!nombre.trim()) {
        return res.status(400).json({ mensaje: 'El nombre de la promoción no puede estar vacío' });
      }

      const existeOtra = await Promocion.findOne({
        sucursalId: 'sucursal-1',
        nombre: nombre.trim(),
        _id: { $ne: id }
      });

      if (existeOtra) {
        return res.status(400).json({ mensaje: 'Ya existe otra promoción con ese nombre' });
      }

      promocion.nombre = nombre.trim();
    }

    if (precioFijo !== undefined && precioFijo !== null) {
      if (isNaN(precioFijo) || Number(precioFijo) < 0) {
        return res.status(400).json({ mensaje: 'El precioFijo debe ser mayor o igual a 0' });
      }
      promocion.precioFijo = Number(precioFijo);
    }

    if (productos && Array.isArray(productos)) {
      if (productos.length === 0) {
        return res.status(400).json({ mensaje: 'La promoción debe contener al menos un producto componente' });
      }

      for (const comp of productos) {
        if (!comp.productoId) {
          return res.status(400).json({ mensaje: 'Cada componente debe incluir productoId' });
        }
        const prodExiste = await Producto.findById(comp.productoId);
        if (!prodExiste) {
          return res.status(404).json({ mensaje: `El producto componente con ID ${comp.productoId} no existe` });
        }
      }

      promocion.productos = productos.map((p) => ({
        productoId: p.productoId,
        cantidad: p.cantidad && p.cantidad > 0 ? Number(p.cantidad) : 1
      }));
    }

    await promocion.save();

    const promocionPoblada = await Promocion.findById(promocion._id)
      .populate('productos.productoId', 'nombre categoriaId precioVenta disponible');

    res.json({
      mensaje: 'Promoción actualizada exitosamente',
      promocion: promocionPoblada
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al actualizar la promoción', error: error.message });
  }
};

// @desc    Activar / Desactivar una promoción (patch activo)
// @route   PATCH /api/promociones/:id/activo
// @access  Privado (Solo Dueño)
const cambiarEstadoPromocion = async (req, res) => {
  try {
    const { id } = req.params;
    const { activo } = req.body;

    const promocion = await Promocion.findById(id);
    if (!promocion) {
      return res.status(404).json({ mensaje: 'Promoción no encontrada' });
    }

    if (typeof activo === 'boolean') {
      promocion.activo = activo;
    } else {
      promocion.activo = !promocion.activo;
    }

    await promocion.save();

    const promocionPoblada = await Promocion.findById(promocion._id)
      .populate('productos.productoId', 'nombre categoriaId precioVenta disponible');

    res.json({
      mensaje: `Promoción ${promocion.activo ? 'activada' : 'desactivada'} exitosamente`,
      promocion: promocionPoblada
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al cambiar el estado de la promoción', error: error.message });
  }
};

module.exports = {
  obtenerPromociones,
  crearPromocion,
  editarPromocion,
  cambiarEstadoPromocion
};
