const Mesa = require('../models/Mesa');
const Sector = require('../models/Sector');

// @desc    Obtener todas las mesas con populate de sector
// @route   GET /api/mesas
// @access  Privado (dueño, encargado, mozo)
const obtenerMesas = async (req, res) => {
  try {
    const mesas = await Mesa.find()
      .populate('sectorId', 'nombre')
      .sort({ numero: 1 });
    res.json({ mesas });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener mesas', error: error.message });
  }
};

// @desc    Crear una mesa individual
// @route   POST /api/mesas
// @access  Privado (Dueño)
const crearMesa = async (req, res) => {
  try {
    const { numero, sectorId, posicionX, posicionY } = req.body;

    if (!sectorId) {
      return res.status(400).json({ mensaje: 'El sectorId es obligatorio' });
    }

    const sectorExiste = await Sector.findById(sectorId);
    if (!sectorExiste) {
      return res.status(400).json({ mensaje: 'El sector especificado no existe' });
    }

    let numeroMesa = numero;
    if (!numeroMesa) {
      // Si no se indica número, buscar el número más alto existente y sumar 1
      const ultimaMesa = await Mesa.findOne().sort({ numero: -1 });
      numeroMesa = ultimaMesa ? ultimaMesa.numero + 1 : 1;
    } else {
      const existeNumero = await Mesa.findOne({ numero: numeroMesa });
      if (existeNumero) {
        return res.status(400).json({ mensaje: `Ya existe la mesa número ${numeroMesa}` });
      }
    }

    const totalExistentes = await Mesa.countDocuments();
    const col = totalExistentes % 4;
    const row = Math.floor(totalExistentes / 4) % 4;
    const defaultX = Math.min(84, 16 + col * 22);
    const defaultY = Math.min(80, 24 + row * 20);

    const nuevaMesa = await Mesa.create({
      numero: numeroMesa,
      sectorId,
      posicionX: posicionX !== undefined ? posicionX : defaultX,
      posicionY: posicionY !== undefined ? posicionY : defaultY,
      estado: 'libre'
    });

    const mesaPoblada = await Mesa.findById(nuevaMesa._id).populate('sectorId', 'nombre');
    res.status(201).json({ mesa: mesaPoblada });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al crear la mesa', error: error.message });
  }
};

// @desc    Alta masiva de mesas por lote
// @route   POST /api/mesas/lote
// @access  Privado (Dueño)
const crearMesasLote = async (req, res) => {
  try {
    const { cantidad, sectorId } = req.body;

    if (!cantidad || cantidad <= 0 || !sectorId) {
      return res.status(400).json({ mensaje: 'La cantidad debe ser mayor a 0 y el sectorId es obligatorio' });
    }

    const sectorExiste = await Sector.findById(sectorId);
    if (!sectorExiste) {
      return res.status(400).json({ mensaje: 'El sector especificado no existe' });
    }

    const ultimaMesa = await Mesa.findOne().sort({ numero: -1 });
    let proximoNumero = ultimaMesa ? ultimaMesa.numero + 1 : 1;

    const totalExistentes = await Mesa.countDocuments();

    const mesasACrear = [];
    for (let i = 0; i < cantidad; i++) {
      const slotIndex = totalExistentes + i;
      const col = slotIndex % 4;
      const row = Math.floor(slotIndex / 4) % 4;

      const posX = Math.min(84, 16 + col * 22);
      const posY = Math.min(80, 24 + row * 20);

      mesasACrear.push({
        numero: proximoNumero + i,
        sectorId,
        posicionX: posX,
        posicionY: posY,
        estado: 'libre'
      });
    }

    const mesasCreadas = await Mesa.insertMany(mesasACrear);
    res.status(201).json({
      mensaje: `Se crearon ${mesasCreadas.length} mesas exitosamente`,
      mesas: mesasCreadas
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al crear mesas en lote', error: error.message });
  }
};

// @desc    Editar una mesa (número, sector)
// @route   PUT /api/mesas/:id
// @access  Privado (Dueño)
const editarMesa = async (req, res) => {
  try {
    const { id } = req.params;
    const { numero, sectorId, posicionX, posicionY, estado } = req.body;

    const mesa = await Mesa.findById(id);
    if (!mesa) {
      return res.status(404).json({ mensaje: 'Mesa no encontrada' });
    }

    if (numero && numero !== mesa.numero) {
      const existeNumero = await Mesa.findOne({ numero, _id: { $ne: id } });
      if (existeNumero) {
        return res.status(400).json({ mensaje: `Ya existe otra mesa con el número ${numero}` });
      }
      mesa.numero = numero;
    }

    if (sectorId) {
      const sectorExiste = await Sector.findById(sectorId);
      if (!sectorExiste) {
        return res.status(400).json({ mensaje: 'El sector especificado no existe' });
      }
      mesa.sectorId = sectorId;
    }

    if (posicionX !== undefined) mesa.posicionX = posicionX;
    if (posicionY !== undefined) mesa.posicionY = posicionY;
    if (estado) mesa.estado = estado;

    await mesa.save();
    const mesaPoblada = await Mesa.findById(id).populate('sectorId', 'nombre');
    res.json({ mesa: mesaPoblada });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al editar la mesa', error: error.message });
  }
};

// @desc    Actualizar posición de mesa para drag & drop del plano
// @route   PATCH /api/mesas/:id/posicion
// @access  Privado (Dueño)
const actualizarPosicionMesa = async (req, res) => {
  try {
    const { id } = req.params;
    const { posicionX, posicionY } = req.body;

    if (posicionX === undefined || posicionY === undefined) {
      return res.status(400).json({ mensaje: 'posicionX y posicionY son requeridos' });
    }

    const mesa = await Mesa.findById(id);
    if (!mesa) {
      return res.status(404).json({ mensaje: 'Mesa no encontrada' });
    }

    mesa.posicionX = posicionX;
    mesa.posicionY = posicionY;
    await mesa.save();

    res.json({ mensaje: 'Posición actualizada correctamente', mesa });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al actualizar posición de la mesa', error: error.message });
  }
};

// @desc    Eliminar una mesa
// @route   DELETE /api/mesas/:id
// @access  Privado (Dueño)
const eliminarMesa = async (req, res) => {
  try {
    const { id } = req.params;

    const mesa = await Mesa.findById(id);
    if (!mesa) {
      return res.status(404).json({ mensaje: 'Mesa no encontrada' });
    }

    if (mesa.estado === 'ocupada') {
      return res.status(400).json({
        mensaje: `No se puede eliminar la mesa número ${mesa.numero} porque se encuentra actualmente ocupada.`
      });
    }

    await Mesa.findByIdAndDelete(id);
    res.json({ mensaje: 'Mesa eliminada correctamente' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al eliminar la mesa', error: error.message });
  }
};

module.exports = {
  obtenerMesas,
  crearMesa,
  crearMesasLote,
  editarMesa,
  actualizarPosicionMesa,
  eliminarMesa
};
