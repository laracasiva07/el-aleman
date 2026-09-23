const Ingrediente = require('../models/Ingrediente');
const Producto = require('../models/Producto');

// @desc    Obtener todos los ingredientes (con virtuals costoUnitario y estadoStock)
// @route   GET /api/ingredientes
// @access  Privado (Dueño)
const obtenerIngredientes = async (req, res) => {
  try {
    const ingredientes = await Ingrediente.find().sort({ nombre: 1 });
    res.json({ ingredientes });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener ingredientes', error: error.message });
  }
};

// @desc    Obtener solo ingredientes en alerta ("critico" o "bajo")
// @route   GET /api/ingredientes/alertas
// @access  Privado (Dueño)
const obtenerAlertasStock = async (req, res) => {
  try {
    const todosIngredientes = await Ingrediente.find().sort({ nombre: 1 });
    // Filtrar los que estén en estado 'critico' o 'bajo'
    const alertas = todosIngredientes.filter(
      (i) => i.estadoStock === 'critico' || i.estadoStock === 'bajo'
    );
    res.json({ alertas });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener alertas de stock', error: error.message });
  }
};

// @desc    Crear un nuevo ingrediente
// @route   POST /api/ingredientes
// @access  Privado (Dueño)
const crearIngrediente = async (req, res) => {
  try {
    const {
      nombre,
      unidadMedida,
      stockActual,
      precioCompra,
      cantidadComprada,
      umbralCritico,
      umbralBajo,
      sucursalId
    } = req.body;

    if (
      !nombre ||
      !unidadMedida ||
      precioCompra === undefined ||
      cantidadComprada === undefined ||
      umbralCritico === undefined ||
      umbralBajo === undefined
    ) {
      return res.status(400).json({
        mensaje: 'Campos requeridos: nombre, unidadMedida, precioCompra, cantidadComprada, umbralCritico, umbralBajo'
      });
    }

    const nuevoIngrediente = await Ingrediente.create({
      nombre: nombre.trim(),
      unidadMedida,
      stockActual: stockActual !== undefined ? stockActual : 0,
      precioCompra,
      cantidadComprada,
      umbralCritico,
      umbralBajo,
      sucursalId: sucursalId || 'sucursal-1'
    });

    res.status(201).json({ ingrediente: nuevoIngrediente });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al crear ingrediente', error: error.message });
  }
};

// @desc    Editar ingrediente / Actualizar stock
// @route   PUT /api/ingredientes/:id
// @access  Privado (Dueño)
const editarIngrediente = async (req, res) => {
  try {
    const { id } = req.params;
    const ingrediente = await Ingrediente.findById(id);

    if (!ingrediente) {
      return res.status(404).json({ mensaje: 'Ingrediente no encontrado' });
    }

    const camposPermitidos = [
      'nombre',
      'unidadMedida',
      'stockActual',
      'precioCompra',
      'cantidadComprada',
      'umbralCritico',
      'umbralBajo',
      'sucursalId'
    ];

    camposPermitidos.forEach((campo) => {
      if (req.body[campo] !== undefined) {
        ingrediente[campo] = req.body[campo];
      }
    });

    await ingrediente.save();
    res.json({ ingrediente });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al actualizar ingrediente', error: error.message });
  }
};

// @desc    Eliminar ingrediente
// @route   DELETE /api/ingredientes/:id
// @access  Privado (Dueño)
const eliminarIngrediente = async (req, res) => {
  try {
    const { id } = req.params;

    const ingrediente = await Ingrediente.findById(id);
    if (!ingrediente) {
      return res.status(404).json({ mensaje: 'Ingrediente no encontrado' });
    }

    // Validar si algún producto utiliza este ingrediente en su receta
    const productosConIngrediente = await Producto.countDocuments({
      'receta.ingredienteId': id
    });

    if (productosConIngrediente > 0) {
      return res.status(400).json({
        mensaje: `No se puede eliminar el ingrediente '${ingrediente.nombre}' porque forma parte de la receta de ${productosConIngrediente} producto(s).`
      });
    }

    await Ingrediente.findByIdAndDelete(id);
    res.json({ mensaje: 'Ingrediente eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al eliminar ingrediente', error: error.message });
  }
};

module.exports = {
  obtenerIngredientes,
  obtenerAlertasStock,
  crearIngrediente,
  editarIngrediente,
  eliminarIngrediente
};
