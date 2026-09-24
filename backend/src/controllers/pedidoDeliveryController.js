const mongoose = require('mongoose');
const Pedido = require('../models/Pedido');
const Cliente = require('../models/Cliente');
const Producto = require('../models/Producto');
const MovimientoCaja = require('../models/MovimientoCaja');
const Turno = require('../models/Turno');
const { procesarItemsPedido } = require('../utils/promoHelper');

// Helper interno para validar permisos de auditoría (editar/eliminar ítems en delivery)
const validarPermisoEdicionDelivery = (usuario, pedido, motivo) => {
  if (pedido.estadoPago === 'pagado' && usuario.rol !== 'dueno') {
    return {
      permitido: false,
      status: 403,
      mensaje: 'Únicamente el dueño puede modificar o eliminar ítems de un pedido ya pagado'
    };
  }

  if (usuario.rol === 'mozo') {
    return {
      permitido: false,
      status: 403,
      mensaje: 'Los mozos no tienen permiso para modificar o eliminar ítems de un pedido'
    };
  }

  if (usuario.rol === 'encargado') {
    if (pedido.estadoDelivery === 'entregado') {
      return {
        permitido: false,
        status: 403,
        mensaje: 'El encargado no puede modificar ítems si el pedido delivery ya fue entregado'
      };
    }

    if (!motivo || motivo.trim() === '') {
      return {
        permitido: false,
        status: 400,
        mensaje: 'El motivo es obligatorio para modificaciones realizadas por el encargado'
      };
    }
  }

  return { permitido: true };
};

// @desc    Obtener pedidos de delivery (activos o cerrados según query param)
// @route   GET /api/pedidos-delivery
// @access  Privado (dueño, encargado, mozo)
const obtenerPedidosDeliveryActivos = async (req, res) => {
  try {
    const { estado, estadoPago, incluirCerrados } = req.query;
    let query = { tipo: 'delivery' };

    if (estado === 'cerrado' || estado === 'entregado' || estadoPago === 'pagado') {
      query.estadoPago = 'pagado';
    } else if (incluirCerrados === 'true' || estado === 'todos_incluidos' || estado === 'todos') {
      // Sin filtro en estadoPago (obtiene todos los pedidos activos y cerrados)
    } else {
      query.estadoPago = 'pendiente';
    }

    const pedidos = await Pedido.find(query)
      .populate('clienteId')
      .populate('items.productoId', 'nombre categoriaId precioVenta')
      .sort({ createdAt: -1 });

    res.json({ pedidos });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener pedidos de delivery', error: error.message });
  }
};

// @desc    Crear nuevo pedido de delivery
// @route   POST /api/pedidos-delivery
// @access  Privado (dueño, encargado, mozo)
const crearPedidoDelivery = async (req, res) => {
  try {
    const { nombreCliente, telefono, direccionEntrega, items } = req.body || {};

    const telStr = telefono && typeof telefono === 'string' ? telefono.trim() : (telefono ? String(telefono).trim() : '');
    const nomStr = nombreCliente && typeof nombreCliente === 'string' ? nombreCliente.trim() : (nombreCliente ? String(nombreCliente).trim() : '');
    const dirStr = direccionEntrega && typeof direccionEntrega === 'string' ? direccionEntrega.trim() : (direccionEntrega ? String(direccionEntrega).trim() : '');

    if (!telStr) {
      return res.status(400).json({ mensaje: 'El teléfono del cliente es obligatorio' });
    }

    if (!nomStr) {
      return res.status(400).json({ mensaje: 'El nombre del cliente es obligatorio' });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ mensaje: 'Se requiere al menos un ítem para crear el pedido' });
    }

    // Buscar o crear cliente
    let cliente = await Cliente.findOne({ telefono: telStr });
    if (cliente) {
      if (dirStr) {
        cliente.direccion = dirStr;
      }
      if (nomStr) {
        cliente.nombre = nomStr;
      }
      await cliente.save();
    } else {
      cliente = await Cliente.create({
        nombre: nomStr,
        telefono: telStr,
        direccion: dirStr
      });
    }

    const resultadoProcesamiento = await procesarItemsPedido(items, {
      enviadoComanda: true,
      estado: 'entregado'
    });

    if (resultadoProcesamiento.status !== 200) {
      return res.status(resultadoProcesamiento.status).json({ mensaje: resultadoProcesamiento.mensaje });
    }

    const itemsProcesados = resultadoProcesamiento.itemsProcesados;

    const nuevoPedido = await Pedido.create({
      tipo: 'delivery',
      clienteId: cliente._id,
      direccionEntrega: dirStr || cliente.direccion,
      estadoDelivery: 'cocina',
      estadoPago: 'pendiente',
      items: itemsProcesados
    });

    const pedidoPoblado = await Pedido.findById(nuevoPedido._id)
      .populate('clienteId')
      .populate('items.productoId', 'nombre categoriaId precioVenta');

    res.status(201).json({
      mensaje: 'Pedido de delivery creado exitosamente',
      pedido: pedidoPoblado
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al crear pedido de delivery', error: error.message });
  }
};

// @desc    Cambiar estado del delivery (cocina -> en_camino -> entregado)
// @route   PATCH /api/pedidos-delivery/:id/estado
// @access  Privado (dueño, encargado, mozo)
const cambiarEstadoDelivery = async (req, res) => {
  try {
    const { id } = req.params;
    const { estadoDelivery } = req.body;

    const estadosValidos = ['cocina', 'en_camino', 'entregado'];
    if (!estadoDelivery || !estadosValidos.includes(estadoDelivery)) {
      return res.status(400).json({
        mensaje: `estadoDelivery no válido. Debe ser uno de: ${estadosValidos.join(', ')}`
      });
    }

    const pedido = await Pedido.findById(id);
    if (!pedido || pedido.tipo !== 'delivery') {
      return res.status(404).json({ mensaje: 'Pedido de delivery no encontrado' });
    }

    pedido.estadoDelivery = estadoDelivery;
    await pedido.save();

    const pedidoActualizado = await Pedido.findById(id)
      .populate('clienteId')
      .populate('items.productoId', 'nombre categoriaId precioVenta');

    res.json({
      mensaje: `Estado del delivery actualizado a '${estadoDelivery}'`,
      pedido: pedidoActualizado
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al actualizar estado del delivery', error: error.message });
  }
};

// @desc    Editar ítem de un pedido delivery
// @route   PUT /api/pedidos-delivery/:id/items/:itemId
// @access  Privado (Dueño / Encargado con motivo)
const editarItemDelivery = async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const { cantidad, aclaraciones, motivo } = req.body;

    const pedido = await Pedido.findById(id);
    if (!pedido || pedido.tipo !== 'delivery') {
      return res.status(404).json({ mensaje: 'Pedido de delivery no encontrado' });
    }

    const resultadoPermiso = validarPermisoEdicionDelivery(req.usuario, pedido, motivo);
    if (!resultadoPermiso.permitido) {
      return res.status(resultadoPermiso.status).json({ mensaje: resultadoPermiso.mensaje });
    }

    const item = pedido.items.id(itemId);
    if (!item || item.eliminado) {
      return res.status(404).json({ mensaje: 'Ítem no encontrado en el pedido' });
    }

    const oldCantidad = item.cantidad || 1;
    const precioUnitario = item.precioUnitario || 0;
    const oldTotalItem = oldCantidad * precioUnitario;

    if (cantidad !== undefined && cantidad > 0) item.cantidad = cantidad;
    if (aclaraciones !== undefined) item.aclaraciones = aclaraciones;

    const newTotalItem = (item.cantidad || 1) * precioUnitario;
    const diferenciaMonto = newTotalItem - oldTotalItem;

    const motivoTexto = motivo ? motivo.trim() : `Edición realizada por ${req.usuario.rol}`;
    pedido.historialAuditoria.push({
      accion: 'edicion',
      itemId: item._id,
      motivo: motivoTexto,
      usuarioId: req.usuario._id,
      usuarioNombre: req.usuario.nombre,
      fecha: new Date()
    });

    await pedido.save();

    if (pedido.estadoPago === 'pagado' && diferenciaMonto !== 0) {
      const turnoAbierto = await Turno.findOne({ sucursalId: 'sucursal-1', estado: 'abierto' });
      const tipoMovimiento = diferenciaMonto > 0 ? 'ingreso' : 'egreso';
      const montoAbsoluto = Math.abs(diferenciaMonto);

      await MovimientoCaja.create({
        tipo: tipoMovimiento,
        monto: montoAbsoluto,
        medioPago: pedido.medioPago || 'efectivo',
        motivo: `Ajuste post-cobro por edición de ítem '${item.nombreProducto}' en delivery #${pedido._id}: ${motivoTexto}`,
        pedidoId: pedido._id,
        turnoId: turnoAbierto ? turnoAbierto._id : undefined,
        usuarioId: req.usuario._id
      });
    } else {
      await MovimientoCaja.create({
        tipo: 'ajuste',
        monto: 0,
        motivo: `Ajuste por edición de ítem '${item.nombreProducto}' en delivery #${pedido._id}: ${motivoTexto}`,
        pedidoId: pedido._id,
        usuarioId: req.usuario._id
      });
    }

    const pedidoActualizado = await Pedido.findById(id)
      .populate('clienteId')
      .populate('items.productoId', 'nombre categoriaId precioVenta');

    res.json({
      mensaje: 'Ítem editado con éxito y registrado en auditoría',
      pedido: pedidoActualizado
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al editar ítem del delivery', error: error.message });
  }
};

// @desc    Eliminar ítem de un pedido delivery (soft delete)
// @route   DELETE /api/pedidos-delivery/:id/items/:itemId
// @access  Privado (Dueño / Encargado con motivo)
const eliminarItemDelivery = async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const { motivo } = req.body;

    const pedido = await Pedido.findById(id);
    if (!pedido || pedido.tipo !== 'delivery') {
      return res.status(404).json({ mensaje: 'Pedido de delivery no encontrado' });
    }

    const resultadoPermiso = validarPermisoEdicionDelivery(req.usuario, pedido, motivo);
    if (!resultadoPermiso.permitido) {
      return res.status(resultadoPermiso.status).json({ mensaje: resultadoPermiso.mensaje });
    }

    const item = pedido.items.id(itemId);
    if (!item || item.eliminado) {
      return res.status(404).json({ mensaje: 'Ítem no encontrado en el pedido' });
    }

    const totalItem = (item.cantidad || 1) * (item.precioUnitario || 0);

    item.eliminado = true;

    const motivoTexto = motivo ? motivo.trim() : `Eliminación realizada por ${req.usuario.rol}`;
    pedido.historialAuditoria.push({
      accion: 'eliminacion',
      itemId: item._id,
      motivo: motivoTexto,
      usuarioId: req.usuario._id,
      usuarioNombre: req.usuario.nombre,
      fecha: new Date()
    });

    await pedido.save();

    if (pedido.estadoPago === 'pagado' && totalItem > 0) {
      const turnoAbierto = await Turno.findOne({ sucursalId: 'sucursal-1', estado: 'abierto' });

      await MovimientoCaja.create({
        tipo: 'egreso',
        monto: totalItem,
        medioPago: pedido.medioPago || 'efectivo',
        motivo: `Ajuste post-cobro por eliminación de ítem '${item.nombreProducto}' en delivery #${pedido._id}: ${motivoTexto}`,
        pedidoId: pedido._id,
        turnoId: turnoAbierto ? turnoAbierto._id : undefined,
        usuarioId: req.usuario._id
      });
    } else {
      await MovimientoCaja.create({
        tipo: 'ajuste',
        monto: 0,
        motivo: `Ajuste por eliminación de ítem '${item.nombreProducto}' en delivery #${pedido._id}: ${motivoTexto}`,
        pedidoId: pedido._id,
        usuarioId: req.usuario._id
      });
    }

    const pedidoActualizado = await Pedido.findById(id)
      .populate('clienteId')
      .populate('items.productoId', 'nombre categoriaId precioVenta');

    res.json({
      mensaje: 'Ítem eliminado del delivery (soft delete) y registrado en auditoría',
      pedido: pedidoActualizado
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al eliminar ítem del delivery', error: error.message });
  }
};

// @desc    Cobrar y cerrar pedido de delivery
// @route   POST /api/pedidos-delivery/:id/cerrar
// @access  Privado (dueño, encargado, mozo)
const cerrarPedidoDelivery = async (req, res) => {
  const { id } = req.params;
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { medioPago } = req.body;

    const mediosValidos = ['efectivo', 'debito_credito', 'transferencia'];
    if (!medioPago || !mediosValidos.includes(medioPago)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        mensaje: `medioPago no válido. Debe ser uno de: ${mediosValidos.join(', ')}`
      });
    }

    const pedido = await Pedido.findOneAndUpdate(
      { _id: id, tipo: 'delivery', estadoPago: { $ne: 'pagado' } },
      {
        $set: {
          medioPago,
          estadoPago: 'pagado',
          fechaPago: new Date()
        }
      },
      { new: false, session }
    );

    if (!pedido) {
      await session.abortTransaction();
      session.endSession();

      const pedidoExiste = await Pedido.findById(id);
      if (!pedidoExiste || pedidoExiste.tipo !== 'delivery') {
        return res.status(404).json({ mensaje: 'Pedido de delivery no encontrado' });
      }
      return res.status(400).json({ mensaje: 'Este pedido de delivery ya fue cobrado y cerrado' });
    }

    if (pedido.estadoDelivery !== 'entregado') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        mensaje: 'No se puede cerrar el pedido. El estado de entrega debe ser entregado.'
      });
    }

    const montoTotal = (pedido.items || [])
      .filter((item) => !item.eliminado)
      .reduce((sum, item) => sum + (item.cantidad || 1) * (item.precioUnitario || 0), 0);

    const turnoAbierto = await Turno.findOne({ sucursalId: 'sucursal-1', estado: 'abierto' }).session(session);
    if (!turnoAbierto) {
      await session.abortTransaction();
      session.endSession();
      return res.status(409).json({ mensaje: 'No hay un turno de caja abierto' });
    }

    await MovimientoCaja.create(
      [
        {
          tipo: 'ingreso',
          monto: montoTotal,
          medioPago,
          motivo: `Cobro Pedido Delivery #${pedido._id}`,
          pedidoId: pedido._id,
          turnoId: turnoAbierto._id,
          usuarioId: req.usuario._id
        }
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    res.json({
      mensaje: 'Pedido de delivery cobrado y cerrado exitosamente',
      pedidoId: pedido._id,
      montoTotal,
      medioPago
    });
  } catch (error) {
    try {
      await session.abortTransaction();
    } catch (e) {}
    session.endSession();

    if (error.code === 112 || (error.message && error.message.includes('Write conflict')) || (error.hasErrorLabel && error.hasErrorLabel('TransientTransactionError'))) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      const pedidoPostCheck = await Pedido.findById(id);
      if (pedidoPostCheck && pedidoPostCheck.estadoPago === 'pagado') {
        return res.status(400).json({ mensaje: 'Este pedido de delivery ya fue cobrado y cerrado' });
      }
    }

    const pedidoCheck = await Pedido.findById(id);
    if (pedidoCheck && pedidoCheck.estadoPago === 'pagado') {
      return res.status(400).json({ mensaje: 'Este pedido de delivery ya fue cobrado y cerrado' });
    }

    res.status(500).json({ mensaje: 'Error al cerrar y cobrar pedido de delivery', error: error.message });
  }
};

// @desc    Agregar ítems a un pedido de delivery (comanda incremental)
// @route   POST /api/pedidos-delivery/:id/items
// @access  Privado (dueño, encargado, mozo)
const agregarItemsDelivery = async (req, res) => {
  try {
    const { id } = req.params;
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ mensaje: 'Se requiere un arreglo de ítems para agregar' });
    }

    const pedido = await Pedido.findById(id);
    if (!pedido) {
      return res.status(404).json({ mensaje: 'Pedido de delivery no encontrado' });
    }

    if (pedido.estadoPago === 'pagado') {
      return res.status(400).json({ mensaje: 'No se pueden agregar ítems a un pedido ya pagado y cerrado' });
    }

    const resultadoProcesamiento = await procesarItemsPedido(items, {
      enviadoComanda: true,
      estado: 'entregado'
    });

    if (resultadoProcesamiento.status !== 200) {
      return res.status(resultadoProcesamiento.status).json({ mensaje: resultadoProcesamiento.mensaje });
    }

    const nuevosItems = resultadoProcesamiento.itemsProcesados;
    for (const itemProc of nuevosItems) {
      pedido.items.push(itemProc);
    }

    await pedido.save();

    const pedidoActualizado = await Pedido.findById(id)
      .populate('clienteId')
      .populate('items.productoId', 'nombre categoriaId precioVenta');

    res.json({
      mensaje: 'Ítems agregados correctamente al pedido de delivery',
      pedido: pedidoActualizado,
      itemsAgregados: nuevosItems
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al agregar ítems al pedido de delivery', error: error.message });
  }
};

module.exports = {
  obtenerPedidosDeliveryActivos,
  crearPedidoDelivery,
  agregarItemsDelivery,
  cambiarEstadoDelivery,
  editarItemDelivery,
  eliminarItemDelivery,
  cerrarPedidoDelivery
};
