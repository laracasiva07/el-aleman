const Cliente = require('../models/Cliente');
const Pedido = require('../models/Pedido');

// @desc    Obtener todos los clientes
// @route   GET /api/clientes
// @access  Privado (dueño, encargado)
const obtenerClientes = async (req, res) => {
  try {
    const clientes = await Cliente.find({}).sort({ nombre: 1 });
    res.json({ clientes });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener clientes', error: error.message });
  }
};

// @desc    Obtener un cliente por ID
// @route   GET /api/clientes/:id
// @access  Privado (dueño, encargado)
const obtenerClientePorId = async (req, res) => {
  try {
    const { id } = req.params;
    const cliente = await Cliente.findById(id);

    if (!cliente) {
      return res.status(404).json({ mensaje: 'Cliente no encontrado' });
    }

    res.json({ cliente });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al consultar cliente', error: error.message });
  }
};

// @desc    Obtener historial de pedidos de un cliente
// @route   GET /api/clientes/:id/pedidos
// @access  Privado (dueño, encargado)
const obtenerPedidosCliente = async (req, res) => {
  try {
    const { id } = req.params;
    const cliente = await Cliente.findById(id);

    if (!cliente) {
      return res.status(404).json({ mensaje: 'Cliente no encontrado' });
    }

    const pedidos = await Pedido.find({ clienteId: id })
      .populate('items.productoId', 'nombre categoriaId precioVenta')
      .sort({ createdAt: -1 });

    res.json({ cliente, pedidos });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener historial de pedidos del cliente', error: error.message });
  }
};

// @desc    Editar información de un cliente
// @route   PUT /api/clientes/:id
// @access  Privado (dueño, encargado)
const actualizarCliente = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, telefono, direccion } = req.body;

    const cliente = await Cliente.findById(id);
    if (!cliente) {
      return res.status(404).json({ mensaje: 'Cliente no encontrado' });
    }

    if (telefono && telefono.trim() !== cliente.telefono) {
      const existeTelefono = await Cliente.findOne({ telefono: telefono.trim(), _id: { $ne: id } });
      if (existeTelefono) {
        return res.status(400).json({ mensaje: 'Ya existe otro cliente con ese número de teléfono' });
      }
      cliente.telefono = telefono.trim();
    }

    if (nombre !== undefined && nombre.trim() !== '') {
      cliente.nombre = nombre.trim();
    }

    if (direccion !== undefined) {
      cliente.direccion = direccion.trim();
    }

    await cliente.save();

    res.json({
      mensaje: 'Cliente actualizado exitosamente',
      cliente
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al actualizar el cliente', error: error.message });
  }
};

// @desc    Crear un cliente manualmente
// @route   POST /api/clientes
// @access  Privado (dueño, encargado)
const crearCliente = async (req, res) => {
  try {
    const { nombre, telefono, direccion } = req.body || {};

    const telStr = telefono && typeof telefono === 'string' ? telefono.trim() : (telefono ? String(telefono).trim() : '');
    const nomStr = nombre && typeof nombre === 'string' ? nombre.trim() : (nombre ? String(nombre).trim() : '');
    const dirStr = direccion && typeof direccion === 'string' ? direccion.trim() : (direccion ? String(direccion).trim() : '');

    if (!nomStr) return res.status(400).json({ mensaje: 'El nombre es obligatorio' });
    if (!telStr) return res.status(400).json({ mensaje: 'El teléfono es obligatorio' });

    const existe = await Cliente.findOne({ telefono: telStr });
    if (existe) {
      if (dirStr) existe.direccion = dirStr;
      if (nomStr) existe.nombre = nomStr;
      await existe.save();
      return res.json({ mensaje: 'Cliente existente actualizado', cliente: existe });
    }

    const nuevo = await Cliente.create({
      nombre: nomStr,
      telefono: telStr,
      direccion: dirStr
    });

    res.status(201).json({ mensaje: 'Cliente creado exitosamente', cliente: nuevo });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al crear cliente', error: error.message });
  }
};

module.exports = {
  obtenerClientes,
  obtenerClientePorId,
  obtenerPedidosCliente,
  actualizarCliente,
  crearCliente
};
