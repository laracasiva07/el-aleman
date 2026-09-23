const Sector = require('../models/Sector');
const Mesa = require('../models/Mesa');

// @desc    Obtener todos los sectores
// @route   GET /api/sectores
// @access  Privado (Dueño)
const obtenerSectores = async (req, res) => {
  try {
    const sectores = await Sector.find().sort({ nombre: 1 });
    res.json({ sectores });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener sectores', error: error.message });
  }
};

// @desc    Crear un nuevo sector
// @route   POST /api/sectores
// @access  Privado (Dueño)
const crearSector = async (req, res) => {
  try {
    const { nombre, sucursalId } = req.body;

    if (!nombre) {
      return res.status(400).json({ mensaje: 'El nombre del sector es obligatorio' });
    }

    const existe = await Sector.findOne({ nombre: nombre.trim() });
    if (existe) {
      return res.status(400).json({ mensaje: 'Ya existe un sector con ese nombre' });
    }

    const nuevoSector = await Sector.create({
      nombre: nombre.trim(),
      sucursalId: sucursalId || 'sucursal-1'
    });

    res.status(201).json({ sector: nuevoSector });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al crear el sector', error: error.message });
  }
};

// @desc    Renombrar / Editar un sector
// @route   PUT /api/sectores/:id
// @access  Privado (Dueño)
const editarSector = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre } = req.body;

    const sector = await Sector.findById(id);
    if (!sector) {
      return res.status(404).json({ mensaje: 'Sector no encontrado' });
    }

    if (nombre) {
      const existeOtro = await Sector.findOne({
        nombre: nombre.trim(),
        _id: { $ne: id }
      });
      if (existeOtro) {
        return res.status(400).json({ mensaje: 'Ya existe otro sector con ese nombre' });
      }
      sector.nombre = nombre.trim();
    }

    await sector.save();
    res.json({ sector });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al editar el sector', error: error.message });
  }
};

// @desc    Eliminar un sector
// @route   DELETE /api/sectores/:id
// @access  Privado (Dueño)
const eliminarSector = async (req, res) => {
  try {
    const { id } = req.params;

    const sector = await Sector.findById(id);
    if (!sector) {
      return res.status(404).json({ mensaje: 'Sector no encontrado' });
    }

    // Validar que no haya mesas asignadas a este sector
    const mesasAsignadas = await Mesa.countDocuments({ sectorId: id });
    if (mesasAsignadas > 0) {
      return res.status(400).json({
        mensaje: `No se puede eliminar el sector '${sector.nombre}' porque contiene ${mesasAsignadas} mesa(s) asignada(s).`
      });
    }

    await Sector.findByIdAndDelete(id);
    res.json({ mensaje: 'Sector eliminado correctamente' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al eliminar el sector', error: error.message });
  }
};

module.exports = {
  obtenerSectores,
  crearSector,
  editarSector,
  eliminarSector
};
