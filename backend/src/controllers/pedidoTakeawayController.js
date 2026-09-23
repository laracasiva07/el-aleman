const mongoose = require('mongoose');
const Pedido = require('../models/Pedido');
const Cliente = require('../models/Cliente');
const Producto = require('../models/Producto');
const MovimientoCaja = require('../models/MovimientoCaja');
const Turno = require('../models/Turno');
const { procesarItemsPedido } = require('../utils/promoHelper');

// Helper interno para validar permisos de auditoría (editar/eliminar ítems en takeaway)
const validarPermisoEdicionTakeaway = (usuario, pedido, motivo) => {
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
      mensaje: 'Los mozos no tienen permiso para modificar o eliminar ítems de una comanda'
    };
  }

  if (usuario.rol === 'encargado') {
    if (pedido.estadoTakeaway === 'entregado' || pedido.estado === 'entregado') {
      return {
        permitido: false,
        status: 403,
        mensaje: 'El encargado no puede modificar ítems si el pedido ya está en estado entregado'
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

// @desc    Obtener pedidos de takeaway (activos o cerrados según query param)
// @route   GET /api/pedidos-takeaway
// @access  Privado (dueño, encargado, mozo)
const obtenerPedidosTakeawayActivos = async (req, res) => {
  try {
    const { estado, estadoPago, incluirCerrados } = req.query;
    let query = { tipo: 'takeaway' };

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
    res.status(500).json({ mensaje: 'Error al obtener pedidos de takeaway', error: error.message });
  }
};

// @desc    Crear pedido takeaway (venta rápida con o sin cliente)
// @route   POST /api/pedidos-takeaway
// @access  Privado (dueño, encargado, mozo)
const crearPedidoTakeaway = async (req, res) => {
  try {
    const { nombreCliente, telefono, items, horarioEstimado, horaRetiroEstimada } = req.body;

    let clienteId = null;

    if (telefono && telefono.trim()) {
      let cliente = await Cliente.findOne({ telefono: telefono.trim() });
      if (cliente) {
        if (nombreCliente && nombreCliente.trim()) {
          cliente.nombre = nombreCliente.trim();
          await cliente.save();
        }
      } else {
        cliente = await Cliente.create({
          nombre: nombreCliente && nombreCliente.trim() ? nombreCliente.trim() : 'Cliente Takeaway',
          telefono: telefono.trim()
        });
      }
      clienteId = cliente._id;
    }

    let itemsProcesados = [];
    if (items && Array.isArray(items) && items.length > 0) {
      const resProc = await procesarItemsPedido(items, {
        enviadoComanda: false,
        estado: 'pendiente'
      });
      if (resProc.status !== 200) {
        return res.status(resProc.status).json({ mensaje: resProc.mensaje });
      }
      itemsProcesados = resProc.itemsProcesados;
    }

    const nuevoPedido = await Pedido.create({
      tipo: 'takeaway',
      clienteId,
      horarioEstimado: (horarioEstimado || horaRetiroEstimada || '').trim(),
      estadoTakeaway: 'cocina',
      estadoPago: 'pendiente',
      items: itemsProcesados
    });

    const pedidoPoblado = await Pedido.findById(nuevoPedido._id)
      .populate('clienteId')
      .populate('items.productoId', 'nombre categoriaId precioVenta');

    res.status(201).json({
      mensaje: 'Pedido de takeaway creado exitosamente',
      pedido: pedidoPoblado
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al crear pedido de takeaway', error: error.message });
  }
};

// @desc    Agregar ítems a un pedido de takeaway
// @route   POST /api/pedidos-takeaway/:id/items
// @access  Privado (dueño, encargado, mozo)
const agregarItemsTakeaway = async (req, res) => {
  try {
    const { id } = req.params;
    const { items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ mensaje: 'Se requiere un arreglo de ítems para agregar' });
    }

    const pedido = await Pedido.findById(id);
    if (!pedido || pedido.tipo !== 'takeaway') {
      return res.status(404).json({ mensaje: 'Pedido de takeaway no encontrado' });
    }

    if (pedido.estadoPago === 'pagado') {
      return res.status(400).json({ mensaje: 'No se pueden agregar ítems a un pedido ya pagado y cerrado' });
    }

    const resProc = await procesarItemsPedido(items, {
      enviadoComanda: false,
      estado: 'pendiente'
    });

    if (resProc.status !== 200) {
      return res.status(resProc.status).json({ mensaje: resProc.mensaje });
    }

    const nuevosItems = resProc.itemsProcesados;
    for (const itemProc of nuevosItems) {
      pedido.items.push(itemProc);
    }

    await pedido.save();

    const pedidoActualizado = await Pedido.findById(id)
      .populate('clienteId')
      .populate('items.productoId', 'nombre categoriaId precioVenta');

    res.json({
      mensaje: 'Ítems agregados correctamente al pedido de takeaway',
      pedido: pedidoActualizado,
      itemsAgregados: nuevosItems
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al agregar ítems al pedido de takeaway', error: error.message });
  }
};

// @desc    Enviar a cocina (marcar ítems pendientes con enviadoComanda: true)
// @route   POST /api/pedidos-takeaway/:id/comanda
// @access  Privado (dueño, encargado, mozo)
const enviarComandaTakeaway = async (req, res) => {
  try {
    const { id } = req.params;
    const pedido = await Pedido.findById(id).populate({
      path: 'items.productoId',
      populate: { path: 'categoriaId' }
    });

    if (!pedido || pedido.tipo !== 'takeaway') {
      return res.status(404).json({ mensaje: 'Pedido de takeaway no encontrado' });
    }

    const itemsParaEnviar = pedido.items.filter(
      (item) => !item.enviadoComanda && !item.eliminado
    );

    if (itemsParaEnviar.length === 0) {
      return res.status(400).json({ mensaje: 'No hay ítems nuevos pendientes para enviar a comanda' });
    }

    itemsParaEnviar.forEach((item) => {
      item.enviadoComanda = true;
      if (item.estado === 'pendiente') {
        item.estado = 'en_preparacion';
      }
    });

    await pedido.save();

    const itemsEnviados = itemsParaEnviar;
    const itemsParaCocina = itemsParaEnviar.filter((item) => {
      const prod = item.productoId;
      const cat = prod && typeof prod === 'object' ? prod.categoriaId : null;
      const tipoCat = cat && typeof cat === 'object' ? cat.tipo : null;
      return tipoCat === 'comida';
    });

    const pedidoActualizado = await Pedido.findById(id)
      .populate('clienteId')
      .populate('items.productoId', 'nombre categoriaId precioVenta');

    res.json({
      mensaje: 'Comanda enviada a cocina con éxito',
      pedidoId: pedido._id,
      pedido: pedidoActualizado,
      itemsEnviados,
      itemsParaCocina
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al enviar comanda de takeaway', error: error.message });
  }
};

// @desc    Cambiar estado individual de un ítem (pendiente -> en_preparacion -> listo -> entregado)
// @route   PATCH /api/pedidos-takeaway/:id/items/:itemId/estado
// @access  Privado (dueño, encargado, mozo)
const cambiarEstadoItemTakeaway = async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const { estado } = req.body;

    const estadosValidos = ['pendiente', 'en_preparacion', 'listo', 'entregado'];
    if (!estado || !estadosValidos.includes(estado)) {
      return res.status(400).json({
        mensaje: `Estado no válido. Debe ser uno de: ${estadosValidos.join(', ')}`
      });
    }

    const pedido = await Pedido.findById(id);
    if (!pedido || pedido.tipo !== 'takeaway') {
      return res.status(404).json({ mensaje: 'Pedido de takeaway no encontrado' });
    }

    const item = pedido.items.id(itemId);
    if (!item || item.eliminado) {
      return res.status(404).json({ mensaje: 'Ítem no encontrado en el pedido' });
    }

    item.estado = estado;
    await pedido.save();

    const pedidoActualizado = await Pedido.findById(id)
      .populate('clienteId')
      .populate('items.productoId', 'nombre categoriaId precioVenta');

    res.json({
      mensaje: `Estado del ítem '${item.nombreProducto}' actualizado a '${estado}'`,
      pedido: pedidoActualizado,
      itemActualizado: item
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al cambiar estado del ítem en takeaway', error: error.message });
  }
};

// @desc    Editar ítem de un pedido takeaway
// @route   PUT /api/pedidos-takeaway/:id/items/:itemId
// @access  Privado (Dueño / Encargado con motivo)
const editarItemTakeaway = async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const { cantidad, aclaraciones, motivo } = req.body;

    const pedido = await Pedido.findById(id);
    if (!pedido || pedido.tipo !== 'takeaway') {
      return res.status(404).json({ mensaje: 'Pedido de takeaway no encontrado' });
    }

    const resultadoPermiso = validarPermisoEdicionTakeaway(req.usuario, pedido, motivo);
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
        motivo: `Ajuste post-cobro por edición de ítem '${item.nombreProducto}' en takeaway #${pedido._id}: ${motivoTexto}`,
        pedidoId: pedido._id,
        turnoId: turnoAbierto ? turnoAbierto._id : undefined,
        usuarioId: req.usuario._id
      });
    } else {
      await MovimientoCaja.create({
        tipo: 'ajuste',
        monto: 0,
        motivo: `Ajuste por edición de ítem '${item.nombreProducto}' en takeaway #${pedido._id}: ${motivoTexto}`,
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
    res.status(500).json({ mensaje: 'Error al editar ítem del takeaway', error: error.message });
  }
};

// @desc    Eliminar ítem de un pedido takeaway (soft delete)
// @route   DELETE /api/pedidos-takeaway/:id/items/:itemId
// @access  Privado (Dueño / Encargado con motivo)
const eliminarItemTakeaway = async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const { motivo } = req.body;

    const pedido = await Pedido.findById(id);
    if (!pedido || pedido.tipo !== 'takeaway') {
      return res.status(404).json({ mensaje: 'Pedido de takeaway no encontrado' });
    }

    const resultadoPermiso = validarPermisoEdicionTakeaway(req.usuario, pedido, motivo);
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
        motivo: `Ajuste post-cobro por eliminación de ítem '${item.nombreProducto}' en takeaway #${pedido._id}: ${motivoTexto}`,
        pedidoId: pedido._id,
        turnoId: turnoAbierto ? turnoAbierto._id : undefined,
        usuarioId: req.usuario._id
      });
    } else {
      await MovimientoCaja.create({
        tipo: 'ajuste',
        monto: 0,
        motivo: `Ajuste por eliminación de ítem '${item.nombreProducto}' en takeaway #${pedido._id}: ${motivoTexto}`,
        pedidoId: pedido._id,
        usuarioId: req.usuario._id
      });
    }

    const pedidoActualizado = await Pedido.findById(id)
      .populate('clienteId')
      .populate('items.productoId', 'nombre categoriaId precioVenta');

    res.json({
      mensaje: 'Ítem eliminado del takeaway (soft delete) y registrado en auditoría',
      pedido: pedidoActualizado
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al eliminar ítem del takeaway', error: error.message });
  }
};

// @desc    Cobrar y cerrar pedido de takeaway
// @desc    Cambiar estado a nivel de pedido de takeaway (cocina -> listo -> entregado)
// @route   PATCH /api/pedidos-takeaway/:id/estado
// @access  Privado (dueño, encargado, mozo)
const cambiarEstadoTakeaway = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    const estadosValidos = ['cocina', 'listo', 'entregado'];
    if (!estado || !estadosValidos.includes(estado)) {
      return res.status(400).json({
        mensaje: `Estado de takeaway no válido. Debe ser uno de: ${estadosValidos.join(', ')}`
      });
    }

    const pedido = await Pedido.findById(id);
    if (!pedido || pedido.tipo !== 'takeaway') {
      return res.status(404).json({ mensaje: 'Pedido de takeaway no encontrado' });
    }

    pedido.estadoTakeaway = estado;

    // Sincronizar ítems activos
    (pedido.items || []).forEach((item) => {
      if (!item.eliminado) {
        if (estado === 'entregado') item.estado = 'entregado';
        else if (estado === 'listo') item.estado = 'listo';
        else if (estado === 'cocina') item.estado = 'en_preparacion';
      }
    });

    await pedido.save();

    const pedidoActualizado = await Pedido.findById(id)
      .populate('clienteId')
      .populate('items.productoId', 'nombre categoriaId precioVenta');

    res.json({
      mensaje: `Estado del pedido de takeaway actualizado a '${estado}'`,
      pedido: pedidoActualizado
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al cambiar estado del pedido de takeaway', error: error.message });
  }
};

// @desc    Cobrar y cerrar pedido de takeaway
// @route   POST /api/pedidos-takeaway/:id/cerrar
// @access  Privado (dueño, encargado, mozo)
const cerrarPedidoTakeaway = async (req, res) => {
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
      { _id: id, tipo: 'takeaway', estadoPago: { $ne: 'pagado' } },
      {
        $set: {
          medioPago,
          estadoPago: 'pagado',
          fechaPago: new Date(),
          estadoTakeaway: 'entregado'
        }
      },
      { new: false, session }
    );

    if (!pedido) {
      await session.abortTransaction();
      session.endSession();

      const pedidoExiste = await Pedido.findById(id);
      if (!pedidoExiste || pedidoExiste.tipo !== 'takeaway') {
        return res.status(404).json({ mensaje: 'Pedido de takeaway no encontrado' });
      }
      return res.status(400).json({ mensaje: 'Este pedido de takeaway ya fue cobrado y cerrado' });
    }

    // Sincronizar estado de ítems en el objeto modificado antes de calcular total
    (pedido.items || []).forEach((item) => {
      if (!item.eliminado) item.estado = 'entregado';
    });

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
          motivo: `Cobro Pedido Takeaway #${pedido._id}`,
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
      mensaje: 'Pedido de takeaway cobrado y cerrado exitosamente',
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
        return res.status(400).json({ mensaje: 'Este pedido de takeaway ya fue cobrado y cerrado' });
      }
    }

    const pedidoCheck = await Pedido.findById(id);
    if (pedidoCheck && pedidoCheck.estadoPago === 'pagado') {
      return res.status(400).json({ mensaje: 'Este pedido de takeaway ya fue cobrado y cerrado' });
    }

    res.status(500).json({ mensaje: 'Error al cerrar y cobrar pedido de takeaway', error: error.message });
  }
};

module.exports = {
  obtenerPedidosTakeawayActivos,
  crearPedidoTakeaway,
  agregarItemsTakeaway,
  enviarComandaTakeaway,
  cambiarEstadoTakeaway,
  cambiarEstadoItemTakeaway,
  editarItemTakeaway,
  eliminarItemTakeaway,
  cerrarPedidoTakeaway
};
