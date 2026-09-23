const Producto = require('../models/Producto');
const Categoria = require('../models/Categoria');
const Ingrediente = require('../models/Ingrediente');

// @desc    Obtener todos los productos (con populate de categoría e ingredientes de la receta)
// @route   GET /api/productos
// @access  Privado (Dueño)
const obtenerProductos = async (req, res) => {
  try {
    const productos = await Producto.find()
      .populate('categoriaId', 'nombre tipo')
      .populate('receta.ingredienteId', 'nombre unidadMedida precioCompra cantidadComprada stockActual')
      .sort({ nombre: 1 });

    res.json({ productos });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener productos', error: error.message });
  }
};

// @desc    Obtener un producto por ID
// @route   GET /api/productos/:id
// @access  Privado (Dueño)
const obtenerProductoPorId = async (req, res) => {
  try {
    const { id } = req.params;
    const producto = await Producto.findById(id)
      .populate('categoriaId', 'nombre tipo')
      .populate('receta.ingredienteId', 'nombre unidadMedida precioCompra cantidadComprada stockActual');

    if (!producto) {
      return res.status(404).json({ mensaje: 'Producto no encontrado' });
    }

    res.json({ producto });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener el producto', error: error.message });
  }
};

// @desc    Calcular el costo total de producción de un producto según su receta
// @route   GET /api/productos/:id/costo
// @access  Privado (Dueño)
const calcularCostoProducto = async (req, res) => {
  try {
    const { id } = req.params;
    const producto = await Producto.findById(id).populate('receta.ingredienteId');

    if (!producto) {
      return res.status(404).json({ mensaje: 'Producto no encontrado' });
    }

    let costoTotal = 0;
    const desglosado = [];

    if (producto.receta && producto.receta.length > 0) {
      for (const item of producto.receta) {
        const ingrediente = item.ingredienteId;
        if (ingrediente) {
          // costoUnitario es el virtual: precioCompra / cantidadComprada
          const costoUnitario = ingrediente.costoUnitario || 0;
          const subtotalIngrediente = costoUnitario * item.cantidad;
          costoTotal += subtotalIngrediente;

          desglosado.push({
            ingredienteId: ingrediente._id,
            nombreIngrediente: ingrediente.nombre,
            unidadMedida: ingrediente.unidadMedida,
            cantidadUsada: item.cantidad,
            costoUnitario: Number(costoUnitario.toFixed(4)),
            subtotal: Number(subtotalIngrediente.toFixed(2))
          });
        }
      }
    }

    res.json({
      productoId: producto._id,
      nombre: producto.nombre,
      costoTotal: Number(costoTotal.toFixed(2)),
      desglosado
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al calcular el costo del producto', error: error.message });
  }
};

// @desc    Toggle o cambiar el estado de disponibilidad del producto
// @route   PATCH /api/productos/:id/disponibilidad
// @access  Privado (Dueño)
const cambiarDisponibilidad = async (req, res) => {
  try {
    const { id } = req.params;
    const producto = await Producto.findById(id);

    if (!producto) {
      return res.status(404).json({ mensaje: 'Producto no encontrado' });
    }

    // Si se pasa 'disponible' explícitamente en req.body se usa ese valor, si no se conmuta
    if (typeof req.body.disponible === 'boolean') {
      producto.disponible = req.body.disponible;
    } else {
      producto.disponible = !producto.disponible;
    }

    await producto.save();
    res.json({
      mensaje: `Disponibilidad actualizada a ${producto.disponible ? 'Disponible' : 'Agotado'}`,
      producto
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al cambiar la disponibilidad', error: error.message });
  }
};

// @desc    Crear un nuevo producto
// @route   POST /api/productos
// @access  Privado (Dueño)
const crearProducto = async (req, res) => {
  try {
    const { nombre, categoriaId, precioVenta, disponible, receta, sucursalId } = req.body;

    if (!nombre || !categoriaId || precioVenta === undefined) {
      return res.status(400).json({ mensaje: 'Campos requeridos: nombre, categoriaId y precioVenta' });
    }

    // Validar existencia de la categoría
    const categoriaExiste = await Categoria.findById(categoriaId);
    if (!categoriaExiste) {
      return res.status(400).json({ mensaje: 'La categoría especificada no existe' });
    }

    // Validar receta si se proporciona
    if (receta && Array.isArray(receta)) {
      for (const item of receta) {
        if (!item.ingredienteId || item.cantidad === undefined) {
          return res.status(400).json({ mensaje: 'Cada elemento de la receta debe contener ingredienteId y cantidad' });
        }
        const ingredienteExiste = await Ingrediente.findById(item.ingredienteId);
        if (!ingredienteExiste) {
          return res.status(400).json({ mensaje: `El ingrediente con ID ${item.ingredienteId} no existe` });
        }
      }
    }

    const nuevoProducto = await Producto.create({
      nombre: nombre.trim(),
      categoriaId,
      precioVenta,
      disponible: disponible !== undefined ? disponible : true,
      receta: receta || [],
      sucursalId: sucursalId || 'sucursal-1'
    });

    const productoPoblado = await Producto.findById(nuevoProducto._id)
      .populate('categoriaId', 'nombre tipo')
      .populate('receta.ingredienteId', 'nombre unidadMedida');

    res.status(201).json({ producto: productoPoblado });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al crear el producto', error: error.message });
  }
};

// @desc    Editar un producto
// @route   PUT /api/productos/:id
// @access  Privado (Dueño)
const editarProducto = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, categoriaId, precioVenta, disponible, receta, sucursalId } = req.body;

    const producto = await Producto.findById(id);
    if (!producto) {
      return res.status(404).json({ mensaje: 'Producto no encontrado' });
    }

    if (categoriaId) {
      const categoriaExiste = await Categoria.findById(categoriaId);
      if (!categoriaExiste) {
        return res.status(400).json({ mensaje: 'La categoría especificada no existe' });
      }
      producto.categoriaId = categoriaId;
    }

    if (receta && Array.isArray(receta)) {
      for (const item of receta) {
        if (!item.ingredienteId || item.cantidad === undefined) {
          return res.status(400).json({ mensaje: 'Cada elemento de la receta debe contener ingredienteId y cantidad' });
        }
        const ingredienteExiste = await Ingrediente.findById(item.ingredienteId);
        if (!ingredienteExiste) {
          return res.status(400).json({ mensaje: `El ingrediente con ID ${item.ingredienteId} no existe` });
        }
      }
      producto.receta = receta;
    }

    if (nombre) producto.nombre = nombre.trim();
    if (precioVenta !== undefined) producto.precioVenta = precioVenta;
    if (disponible !== undefined) producto.disponible = disponible;
    if (sucursalId) producto.sucursalId = sucursalId;

    await producto.save();

    const productoActualizado = await Producto.findById(id)
      .populate('categoriaId', 'nombre tipo')
      .populate('receta.ingredienteId', 'nombre unidadMedida');

    res.json({ producto: productoActualizado });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al editar el producto', error: error.message });
  }
};

// @desc    Eliminar un producto
// @route   DELETE /api/productos/:id
// @access  Privado (Dueño)
const eliminarProducto = async (req, res) => {
  try {
    const { id } = req.params;
    const producto = await Producto.findById(id);

    if (!producto) {
      return res.status(404).json({ mensaje: 'Producto no encontrado' });
    }

    await Producto.findByIdAndDelete(id);
    res.json({ mensaje: 'Producto eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al eliminar el producto', error: error.message });
  }
};

module.exports = {
  obtenerProductos,
  obtenerProductoPorId,
  calcularCostoProducto,
  cambiarDisponibilidad,
  crearProducto,
  editarProducto,
  eliminarProducto
};
