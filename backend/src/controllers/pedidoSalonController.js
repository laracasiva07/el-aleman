const mongoose = require('mongoose');
const Pedido = require('../models/Pedido');
const Mesa = require('../models/Mesa');
const Producto = require('../models/Producto');
const MovimientoCaja = require('../models/MovimientoCaja');
const Turno = require('../models/Turno');
const { procesarItemsPedido } = require('../utils/promoHelper');

// @desc    Obtener pedidos de salón activos (no entregados y pagados)
// @route   GET /api/pedidos-salon
// @access  Privado (dueño, encargado, mozo)
const obtenerPedidosSalonActivos = async (req, res) => {
  try {
    const pedidos = await Pedido.find({
      tipo: 'salon',
      estadoPago: 'pendiente'
    })
      .populate({
        path: 'mesaId',
        populate: { path: 'sectorId', select: 'nombre' }
      })
      .populate('items.productoId', 'nombre categoriaId precioVenta')
      .sort({ createdAt: -1 });

    res.json({ pedidos });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener pedidos de salón', error: error.message });
  }
};

// @desc    Obtener el pedido activo de una mesa específica
// @route   GET /api/pedidos-salon/mesa/:mesaId
// @access  Privado (dueño, encargado, mozo)
const obtenerPedidoMesa = async (req, res) => {
  try {
    const { mesaId } = req.params;

    const pedido = await Pedido.findOne({
      tipo: 'salon',
      mesaId,
      estadoPago: 'pendiente'
    })
      .populate('mesaId')
      .populate('items.productoId', 'nombre categoriaId precioVenta');

    if (!pedido) {
      return res.json({ pedido: null, mensaje: 'La mesa se encuentra libre sin pedidos activos' });
    }

    res.json({ pedido });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al consultar pedido de la mesa', error: error.message });
  }
};

// @desc    Abrir mesa / crear pedido salón
// @route   POST /api/pedidos-salon
// @access  Privado (dueño, encargado, mozo)
const abrirMesaCrearPedido = async (req, res) => {
  try {
    const { mesaId } = req.body;

    if (!mesaId) {
      return res.status(400).json({ mensaje: 'El mesaId es obligatorio' });
    }

    const mesa = await Mesa.findById(mesaId);
    if (!mesa) {
      return res.status(404).json({ mensaje: 'Mesa no encontrada' });
    }

    // Verificar si ya existe un pedido activo para esa mesa
    let pedidoExistente = await Pedido.findOne({
      tipo: 'salon',
      mesaId,
      estadoPago: 'pendiente'
    });

    if (pedidoExistente) {
      // Marcar mesa como ocupada por seguridad
      if (mesa.estado !== 'ocupada') {
        mesa.estado = 'ocupada';
        await mesa.save();
      }
      return res.json({
        mensaje: 'La mesa ya tiene un pedido activo abierto',
        pedido: pedidoExistente
      });
    }

    // Marcar mesa como ocupada
    mesa.estado = 'ocupada';
    await mesa.save();

    // Crear nuevo pedido
    const nuevoPedido = await Pedido.create({
      tipo: 'salon',
      mesaId,
      estadoPago: 'pendiente',
      items: []
    });

    const pedidoPoblado = await Pedido.findById(nuevoPedido._id).populate('mesaId');
    res.status(201).json({
      mensaje: `Mesa ${mesa.numero} abierta exitosamente`,
      pedido: pedidoPoblado
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al abrir la mesa', error: error.message });
  }
};

// @desc    Agregar ítems a un pedido de salón
// @route   POST /api/pedidos-salon/:id/items
// @access  Privado (dueño, encargado, mozo)
const agregarItemsPedido = async (req, res) => {
  try {
    const { id } = req.params;
    const { items } = req.body; // Array de { productoId, cantidad, aclaraciones }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ mensaje: 'Se requiere un arreglo de ítems para agregar' });
    }

    const pedido = await Pedido.findById(id);
    if (!pedido) {
      return res.status(404).json({ mensaje: 'Pedido no encontrado' });
    }

    if (pedido.estadoPago === 'pagado') {
      return res.status(400).json({ mensaje: 'No se pueden agregar ítems a un pedido ya pagado y cerrado' });
    }

    const resultadoProcesamiento = await procesarItemsPedido(items, {
      enviadoComanda: false,
      estado: 'pendiente'
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
      .populate('mesaId')
      .populate('items.productoId', 'nombre categoriaId precioVenta');

    res.json({
      mensaje: 'Ítems agregados correctamente al pedido',
      pedido: pedidoActualizado,
      itemsAgregados: nuevosItems
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al agregar ítems al pedido', error: error.message });
  }
};

// @desc    Enviar a cocina (marcar ítems pendientes con enviadoComanda: true)
// @route   POST /api/pedidos-salon/:id/comanda
// @access  Privado (dueño, encargado, mozo)
const enviarComanda = async (req, res) => {
  try {
    const { id } = req.params;
    const pedido = await Pedido.findById(id).populate({
      path: 'items.productoId',
      populate: { path: 'categoriaId' }
    });

    if (!pedido) {
      return res.status(404).json({ mensaje: 'Pedido no encontrado' });
    }

    // Filtrar ítems que no han sido enviados a comanda y no están eliminados
    const itemsParaEnviar = pedido.items.filter(
      (item) => !item.enviadoComanda && !item.eliminado
    );

    if (itemsParaEnviar.length === 0) {
      return res.status(400).json({ mensaje: 'No hay ítems nuevos pendientes para enviar a comanda' });
    }

    // Marcar como enviados y actualizar estado a 'en_preparacion' si estaba en 'pendiente'
    itemsParaEnviar.forEach((item) => {
      item.enviadoComanda = true;
      if (item.estado === 'pendiente') {
        item.estado = 'en_preparacion';
      }
    });

    await pedido.save();

    // itemsEnviados: TODOS los ítems recién marcados enviadoComanda: true (sin filtrar)
    const itemsEnviados = itemsParaEnviar;

    // itemsParaCocina: Filtrados a ítems cuya categoría es de tipo "comida"
    const itemsParaCocina = itemsParaEnviar.filter((item) => {
      const prod = item.productoId;
      const cat = prod && typeof prod === 'object' ? prod.categoriaId : null;
      const tipoCat = cat && typeof cat === 'object' ? cat.tipo : null;
      return tipoCat === 'comida';
    });

    const pedidoActualizado = await Pedido.findById(id)
      .populate('mesaId')
      .populate('items.productoId', 'nombre categoriaId precioVenta');

    res.json({
      mensaje: 'Comanda enviada a cocina con éxito',
      pedidoId: pedido._id,
      pedido: pedidoActualizado,
      itemsEnviados,
      itemsParaCocina
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al enviar la comanda', error: error.message });
  }
};

// @desc    Cambiar estado del semáforo de un ítem puntual (pendiente -> en_preparacion -> listo -> entregado)
// @route   PATCH /api/pedidos-salon/:id/items/:itemId/estado
// @access  Privado (dueño, encargado, mozo)
const cambiarEstadoItemPedido = async (req, res) => {
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
    if (!pedido) {
      return res.status(404).json({ mensaje: 'Pedido no encontrado' });
    }

    const item = pedido.items.id(itemId);
    if (!item || item.eliminado) {
      return res.status(404).json({ mensaje: 'Ítem no encontrado en el pedido' });
    }

    item.estado = estado;
    await pedido.save();

    const pedidoActualizado = await Pedido.findById(id)
      .populate('mesaId')
      .populate('items.productoId', 'nombre categoriaId precioVenta');

    res.json({
      mensaje: `Estado del ítem '${item.nombreProducto}' actualizado a '${estado}'`,
      pedido: pedidoActualizado,
      itemActualizado: item
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al cambiar estado del ítem', error: error.message });
  }
};

// Helper interno para validar permisos de auditoría (editar/eliminar ítems)
const validarPermisoEdicionComanda = (usuario, pedido, motivo) => {
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
    if (pedido.estado === 'entregado') {
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

// @desc    Editar un ítem de la comanda (cantidad, aclaraciones)
// @route   PUT /api/pedidos-salon/:id/items/:itemId
// @access  Privado (Dueño / Encargado con motivo)
const editarItemPedido = async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const { cantidad, aclaraciones, motivo } = req.body;

    const pedido = await Pedido.findById(id);
    if (!pedido) {
      return res.status(404).json({ mensaje: 'Pedido no encontrado' });
    }

    // Validar permisos según rol del usuario y estado de pago
    const resultadoPermiso = validarPermisoEdicionComanda(req.usuario, pedido, motivo);
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

    // Registrar en auditoría
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

    // Si el pedido ya estaba pagado, registrar la diferencia real en MovimientoCaja
    if (pedido.estadoPago === 'pagado' && diferenciaMonto !== 0) {
      const turnoAbierto = await Turno.findOne({ sucursalId: 'sucursal-1', estado: 'abierto' });
      const tipoMovimiento = diferenciaMonto > 0 ? 'ingreso' : 'egreso';
      const montoAbsoluto = Math.abs(diferenciaMonto);

      await MovimientoCaja.create({
        tipo: tipoMovimiento,
        monto: montoAbsoluto,
        medioPago: pedido.medioPago || 'efectivo',
        motivo: `Ajuste post-cobro por edición de ítem '${item.nombreProducto}': ${motivoTexto}`,
        pedidoId: pedido._id,
        turnoId: turnoAbierto ? turnoAbierto._id : undefined,
        usuarioId: req.usuario._id
      });
    } else {
      await MovimientoCaja.create({
        tipo: 'ajuste',
        monto: 0,
        motivo: `Ajuste por edición de ítem '${item.nombreProducto}': ${motivoTexto}`,
        pedidoId: pedido._id,
        usuarioId: req.usuario._id
      });
    }

    res.json({
      mensaje: 'Ítem editado con éxito y registrado en auditoría',
      pedido
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al editar el ítem', error: error.message });
  }
};

// @desc    Eliminar ítem de comanda (Soft delete: eliminado: true)
// @route   DELETE /api/pedidos-salon/:id/items/:itemId
// @access  Privado (Dueño / Encargado con motivo)
const eliminarItemPedido = async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const { motivo } = req.body;

    const pedido = await Pedido.findById(id);
    if (!pedido) {
      return res.status(404).json({ mensaje: 'Pedido no encontrado' });
    }

    // Validar permisos según rol del usuario y estado de pago
    const resultadoPermiso = validarPermisoEdicionComanda(req.usuario, pedido, motivo);
    if (!resultadoPermiso.permitido) {
      return res.status(resultadoPermiso.status).json({ mensaje: resultadoPermiso.mensaje });
    }

    const item = pedido.items.id(itemId);
    if (!item || item.eliminado) {
      return res.status(404).json({ mensaje: 'Ítem no encontrado en el pedido' });
    }

    const totalItem = (item.cantidad || 1) * (item.precioUnitario || 0);

    // Marcar como eliminado
    item.eliminado = true;

    // Registrar en auditoría
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

    // Si el pedido ya estaba pagado, registrar egreso en MovimientoCaja por el monto del ítem eliminado
    if (pedido.estadoPago === 'pagado' && totalItem > 0) {
      const turnoAbierto = await Turno.findOne({ sucursalId: 'sucursal-1', estado: 'abierto' });

      await MovimientoCaja.create({
        tipo: 'egreso',
        monto: totalItem,
        medioPago: pedido.medioPago || 'efectivo',
        motivo: `Ajuste post-cobro por eliminación de ítem '${item.nombreProducto}': ${motivoTexto}`,
        pedidoId: pedido._id,
        turnoId: turnoAbierto ? turnoAbierto._id : undefined,
        usuarioId: req.usuario._id
      });
    } else {
      await MovimientoCaja.create({
        tipo: 'ajuste',
        monto: 0,
        motivo: `Ajuste por eliminación de ítem '${item.nombreProducto}': ${motivoTexto}`,
        pedidoId: pedido._id,
        usuarioId: req.usuario._id
      });
    }

    res.json({
      mensaje: 'Ítem eliminado de la comanda (soft delete) y registrado en auditoría',
      pedido
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al eliminar el ítem', error: error.message });
  }
};

// @desc    Cerrar mesa y cobrar pedido
// @route   POST /api/pedidos-salon/:id/cerrar
// @access  Privado (dueño, encargado, mozo)
const cerrarMesaCobrar = async (req, res) => {
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

    // Actualizar de forma atómica únicamente si el pedido NO está ya pagado
    const pedido = await Pedido.findOneAndUpdate(
      { _id: id, estadoPago: { $ne: 'pagado' } },
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
      if (!pedidoExiste) {
        return res.status(404).json({ mensaje: 'Pedido no encontrado' });
      }
      return res.status(400).json({ mensaje: 'Este pedido ya fue cobrado y cerrado' });
    }

    // Validar que el pedido esté en estado entregado
    if (pedido.estado !== 'entregado') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        mensaje: 'No se puede cerrar el pedido. Todos los ítems deben estar en estado entregado.'
      });
    }

    // Calcular monto total cobrado
    let montoTotal = 0;
    if (pedido.items && pedido.items.length > 0) {
      montoTotal = pedido.items
        .filter((item) => !item.eliminado)
        .reduce((sum, item) => sum + (item.cantidad || 1) * (item.precioUnitario || 0), 0);
    }

    // Validar turno de caja abierto dentro de la transacción
    const turnoAbierto = await Turno.findOne({ sucursalId: 'sucursal-1', estado: 'abierto' }).session(session);
    if (!turnoAbierto) {
      await session.abortTransaction();
      session.endSession();
      return res.status(409).json({ mensaje: 'No hay un turno de caja abierto' });
    }

    // Liberar la mesa asociada
    if (pedido.mesaId) {
      await Mesa.findByIdAndUpdate(pedido.mesaId, { estado: 'libre' }, { session });
    }

    // Crear registro de ingreso en MovimientoCaja
    await MovimientoCaja.create(
      [
        {
          tipo: 'ingreso',
          monto: montoTotal,
          medioPago,
          motivo: `Cobro Pedido Salón #${pedido._id}`,
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
      mensaje: 'Mesa cerrada y cobrada exitosamente',
      pedidoId: pedido._id,
      montoTotal,
      medioPago,
      estadoMesa: 'libre'
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
        return res.status(400).json({ mensaje: 'Este pedido ya fue cobrado y cerrado' });
      }
    }

    const pedidoCheck = await Pedido.findById(id);
    if (pedidoCheck && pedidoCheck.estadoPago === 'pagado') {
      return res.status(400).json({ mensaje: 'Este pedido ya fue cobrado y cerrado' });
    }

    res.status(500).json({ mensaje: 'Error al cerrar la mesa y cobrar', error: error.message });
  }
};

module.exports = {
  obtenerPedidosSalonActivos,
  obtenerPedidoMesa,
  abrirMesaCrearPedido,
  agregarItemsPedido,
  enviarComanda,
  cambiarEstadoItemPedido,
  editarItemPedido,
  eliminarItemPedido,
  cerrarMesaCobrar
};
