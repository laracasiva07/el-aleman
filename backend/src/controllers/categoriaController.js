const Categoria = require('../models/Categoria');
const Producto = require('../models/Producto');

// @desc    Obtener todas las categorías
// @route   GET /api/categorias
// @access  Privado (Dueño)
const obtenerCategorias = async (req, res) => {
  try {
    const categorias = await Categoria.find().sort({ nombre: 1 });
    res.json({ categorias });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener categorías', error: error.message });
  }
};

// @desc    Crear una nueva categoría
// @route   POST /api/categorias
// @access  Privado (Dueño)
const crearCategoria = async (req, res) => {
  try {
    const { nombre, tipo } = req.body;

    if (!nombre || !tipo) {
      return res.status(400).json({ mensaje: 'Los campos nombre y tipo son obligatorios' });
    }

    const existeCategoria = await Categoria.findOne({ nombre: nombre.trim() });
    if (existeCategoria) {
      return res.status(400).json({ mensaje: 'Ya existe una categoría con ese nombre' });
    }

    const nuevaCategoria = await Categoria.create({
      nombre: nombre.trim(),
      tipo
    });

    res.status(201).json({ categoria: nuevaCategoria });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al crear la categoría', error: error.message });
  }
};

// @desc    Editar una categoría
// @route   PUT /api/categorias/:id
// @access  Privado (Dueño)
const editarCategoria = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, tipo } = req.body;

    const categoria = await Categoria.findById(id);
    if (!categoria) {
      return res.status(404).json({ mensaje: 'Categoría no encontrada' });
    }

    if (nombre) {
      const existeOtra = await Categoria.findOne({
        nombre: nombre.trim(),
        _id: { $ne: id }
      });
      if (existeOtra) {
        return res.status(400).json({ mensaje: 'Ya existe otra categoría con ese nombre' });
      }
      categoria.nombre = nombre.trim();
    }

    if (tipo) {
      categoria.tipo = tipo;
    }

    await categoria.save();
    res.json({ categoria });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al actualizar la categoría', error: error.message });
  }
};

// @desc    Eliminar una categoría
// @route   DELETE /api/categorias/:id
// @access  Privado (Dueño)
const eliminarCategoria = async (req, res) => {
  try {
    const { id } = req.params;

    const categoria = await Categoria.findById(id);
    if (!categoria) {
      return res.status(404).json({ mensaje: 'Categoría no encontrada' });
    }

    // Validar que no existan productos asociados a esta categoría
    const productosAsociados = await Producto.countDocuments({ categoriaId: id });
    if (productosAsociados > 0) {
      return res.status(400).json({
        mensaje: `No se puede eliminar la categoría '${categoria.nombre}' porque está asociada a ${productosAsociados} producto(s).`
      });
    }

    await Categoria.findByIdAndDelete(id);
    res.json({ mensaje: 'Categoría eliminada correctamente' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al eliminar la categoría', error: error.message });
  }
};

module.exports = {
  obtenerCategorias,
  crearCategoria,
  editarCategoria,
  eliminarCategoria
};
