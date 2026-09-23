const Turno = require('../models/Turno');
const MovimientoCaja = require('../models/MovimientoCaja');
const Pedido = require('../models/Pedido');
const Producto = require('../models/Producto');
const Categoria = require('../models/Categoria');

// @desc    Abrir un nuevo turno de caja
// @route   POST /api/caja/turnos/abrir
// @access  Privado (Dueño, Encargado)
const abrirTurno = async (req, res) => {
  try {
    const { montoInicial } = req.body;

    if (montoInicial === undefined || montoInicial === null || isNaN(montoInicial) || Number(montoInicial) < 0) {
      return res.status(400).json({ mensaje: 'El montoInicial es obligatorio y debe ser mayor o igual a 0' });
    }

    // Verificar si ya existe un turno abierto en la sucursal
    const turnoExistente = await Turno.findOne({
      sucursalId: 'sucursal-1',
      estado: 'abierto'
    });

    if (turnoExistente) {
      return res.status(409).json({
        mensaje: 'Ya existe un turno abierto en esta sucursal',
        turnoId: turnoExistente._id
      });
    }

    const nuevoTurno = await Turno.create({
      sucursalId: 'sucursal-1',
      fechaApertura: new Date(),
      usuarioAperturaId: req.usuario._id,
      montoInicial: Number(montoInicial),
      estado: 'abierto'
    });

    const turnoPoblado = await Turno.findById(nuevoTurno._id).populate('usuarioAperturaId', 'nombre login rol');

    res.status(201).json({
      mensaje: 'Turno de caja abierto exitosamente',
      turno: turnoPoblado
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ mensaje: 'Ya existe un turno abierto en esta sucursal' });
    }
    res.status(500).json({ mensaje: 'Error al abrir el turno de caja', error: error.message });
  }
};

// @desc    Cerrar el turno de caja actual
// @route   PATCH /api/caja/turnos/:id/cerrar
// @access  Privado (Dueño, Encargado)
const cerrarTurno = async (req, res) => {
  try {
    const { id } = req.params;
    const { montoContadoEfectivo } = req.body;

    if (montoContadoEfectivo === undefined || montoContadoEfectivo === null || isNaN(montoContadoEfectivo) || Number(montoContadoEfectivo) < 0) {
      return res.status(400).json({ mensaje: 'El montoContadoEfectivo es obligatorio y debe ser mayor o igual a 0' });
    }

    const turno = await Turno.findById(id);

    if (!turno) {
      return res.status(404).json({ mensaje: 'Turno de caja no encontrado' });
    }

    if (turno.estado === 'cerrado') {
      return res.status(400).json({ mensaje: 'El turno ya se encuentra cerrado' });
    }

    // Obtener movimientos de caja de este turno
    const movimientos = await MovimientoCaja.find({ turnoId: turno._id });

    // Sumar ingresos en efectivo
    const ingresosEfectivo = movimientos
      .filter((m) => m.tipo === 'ingreso' && m.medioPago === 'efectivo')
      .reduce((sum, m) => sum + (m.monto || 0), 0);

    // Sumar egresos (los egresos representan salida de efectivo)
    const egresosEfectivo = movimientos
      .filter((m) => m.tipo === 'egreso')
      .reduce((sum, m) => sum + (m.monto || 0), 0);

    const montoCalculadoEfectivo = Number(turno.montoInicial) + ingresosEfectivo - egresosEfectivo;
    const diferencia = Number(montoContadoEfectivo) - montoCalculadoEfectivo;

    turno.estado = 'cerrado';
    turno.fechaCierre = new Date();
    turno.usuarioCierreId = req.usuario._id;
    turno.montoContadoEfectivo = Number(montoContadoEfectivo);
    turno.montoCalculadoEfectivo = montoCalculadoEfectivo;
    turno.diferencia = diferencia;

    await turno.save();

    const turnoPoblado = await Turno.findById(turno._id)
      .populate('usuarioAperturaId', 'nombre login rol')
      .populate('usuarioCierreId', 'nombre login rol');

    res.json({
      mensaje: 'Turno de caja cerrado exitosamente',
      turno: turnoPoblado,
      resumenCalculo: {
        montoInicial: turno.montoInicial,
        ingresosEfectivo,
        egresosEfectivo,
        montoCalculadoEfectivo,
        montoContadoEfectivo: Number(montoContadoEfectivo),
        diferencia
      }
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al cerrar el turno de caja', error: error.message });
  }
};

// @desc    Obtener turno abierto actual y sus totales acumulados
// @route   GET /api/caja/turnos/actual
// @access  Privado (Dueño, Encargado)
const obtenerTurnoActual = async (req, res) => {
  try {
    const turno = await Turno.findOne({
      sucursalId: 'sucursal-1',
      estado: 'abierto'
    }).populate('usuarioAperturaId', 'nombre login rol');

    if (!turno) {
      return res.json({
        turno: null,
        totales: null,
        movimientos: []
      });
    }

    const movimientos = await MovimientoCaja.find({ turnoId: turno._id })
      .populate('usuarioId', 'nombre login rol')
      .populate('pedidoId');

    const ingresosEfectivo = movimientos
      .filter((m) => m.tipo === 'ingreso' && m.medioPago === 'efectivo')
      .reduce((sum, m) => sum + (m.monto || 0), 0);

    const ingresosTarjeta = movimientos
      .filter((m) => m.tipo === 'ingreso' && m.medioPago === 'debito_credito')
      .reduce((sum, m) => sum + (m.monto || 0), 0);

    const ingresosTransferencia = movimientos
      .filter((m) => m.tipo === 'ingreso' && m.medioPago === 'transferencia')
      .reduce((sum, m) => sum + (m.monto || 0), 0);

    const totalIngresos = ingresosEfectivo + ingresosTarjeta + ingresosTransferencia;

    const totalEgresos = movimientos
      .filter((m) => m.tipo === 'egreso')
      .reduce((sum, m) => sum + (m.monto || 0), 0);

    const totalAjustes = movimientos
      .filter((m) => m.tipo === 'ajuste')
      .reduce((sum, m) => sum + (m.monto || 0), 0);

    const montoCalculadoEfectivo = Number(turno.montoInicial) + ingresosEfectivo - totalEgresos;

    res.json({
      turno,
      totales: {
        ingresosPorMedioPago: {
          efectivo: ingresosEfectivo,
          debito_credito: ingresosTarjeta,
          transferencia: ingresosTransferencia,
          total: totalIngresos
        },
        totalEgresos,
        totalAjustes,
        montoCalculadoEfectivo
      },
      movimientos
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener el turno actual', error: error.message });
  }
};

// @desc    Obtener historial de turnos de caja
// @route   GET /api/caja/turnos
// @access  Privado (Solo Dueño)
const obtenerHistorialTurnos = async (req, res) => {
  try {
    const { fecha, desde, hasta } = req.query;
    const filtro = { sucursalId: 'sucursal-1' };

    if (fecha) {
      const inicioDia = new Date(fecha);
      inicioDia.setHours(0, 0, 0, 0);
      const finDia = new Date(fecha);
      finDia.setHours(23, 59, 59, 999);
      filtro.fechaApertura = { $gte: inicioDia, $lte: finDia };
    } else if (desde || hasta) {
      filtro.fechaApertura = {};
      if (desde) filtro.fechaApertura.$gte = new Date(desde);
      if (hasta) {
        const fin = new Date(hasta);
        fin.setHours(23, 59, 59, 999);
        filtro.fechaApertura.$lte = fin;
      }
    }

    const turnos = await Turno.find(filtro)
      .sort({ fechaApertura: -1 })
      .populate('usuarioAperturaId', 'nombre login rol')
      .populate('usuarioCierreId', 'nombre login rol');

    res.json({ turnos });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener el historial de turnos', error: error.message });
  }
};

// @desc    Obtener detalle de un turno específico con sus movimientos
// @route   GET /api/caja/turnos/:id
// @access  Privado (Solo Dueño)
const obtenerDetalleTurno = async (req, res) => {
  try {
    const { id } = req.params;

    const turno = await Turno.findById(id)
      .populate('usuarioAperturaId', 'nombre login rol')
      .populate('usuarioCierreId', 'nombre login rol');

    if (!turno) {
      return res.status(404).json({ mensaje: 'Turno de caja no encontrado' });
    }

    const movimientos = await MovimientoCaja.find({ turnoId: turno._id })
      .populate('usuarioId', 'nombre login rol')
      .populate('pedidoId');

    res.json({ turno, movimientos });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener el detalle del turno', error: error.message });
  }
};

// @desc    Registrar egreso manual de caja
// @route   POST /api/caja/movimientos
// @access  Privado (Dueño, Encargado)
const registrarEgresoManual = async (req, res) => {
  try {
    const { monto, motivo, categoria, esGastoDiario } = req.body;

    // Verificar si existe turno abierto
    const turnoAbierto = await Turno.findOne({
      sucursalId: 'sucursal-1',
      estado: 'abierto'
    });

    if (!turnoAbierto) {
      return res.status(409).json({ mensaje: 'No hay un turno de caja abierto' });
    }

    if (monto === undefined || monto === null || isNaN(monto) || Number(monto) <= 0) {
      return res.status(400).json({ mensaje: 'El monto debe ser un número mayor a 0' });
    }

    // Validación de motivo por rol
    if (req.usuario.rol === 'encargado' && (!motivo || !motivo.trim())) {
      return res.status(400).json({ mensaje: 'El motivo es obligatorio para el rol encargado' });
    }

    if (categoria && !['comida', 'bebida'].includes(categoria)) {
      return res.status(400).json({ mensaje: 'La categoría debe ser: comida o bebida' });
    }

    const movimiento = await MovimientoCaja.create({
      tipo: 'egreso',
      monto: Number(monto),
      motivo: motivo ? motivo.trim() : (req.usuario.rol === 'dueno' ? 'Egreso manual' : ''),
      categoria: categoria || undefined,
      esGastoDiario: Boolean(esGastoDiario),
      turnoId: turnoAbierto._id,
      usuarioId: req.usuario._id,
      sucursalId: 'sucursal-1',
      fecha: new Date()
    });

    const movimientoPoblado = await MovimientoCaja.findById(movimiento._id)
      .populate('usuarioId', 'nombre login rol');

    res.status(201).json({
      mensaje: 'Egreso manual registrado exitosamente',
      movimiento: movimientoPoblado
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al registrar el egreso manual', error: error.message });
  }
};

// @desc    Obtener desglose de ventas por categoría (comida / bebida)
// @route   GET /api/caja/desglose
// @access  Privado (Solo Dueño)
const obtenerDesgloseVentas = async (req, res) => {
  try {
    const { turnoId, desde, hasta } = req.query;
    let pedidoIds = [];
    let filtroPedidos = { estadoPago: 'pagado' };

    if (turnoId) {
      const movimientosIngreso = await MovimientoCaja.find({
        turnoId,
        tipo: 'ingreso',
        pedidoId: { $ne: null }
      });
      pedidoIds = movimientosIngreso.map((m) => m.pedidoId);
      filtroPedidos._id = { $in: pedidoIds };
    } else if (desde || hasta) {
      filtroPedidos.updatedAt = {};
      if (desde) filtroPedidos.updatedAt.$gte = new Date(desde);
      if (hasta) {
        const fin = new Date(hasta);
        fin.setHours(23, 59, 59, 999);
        filtroPedidos.updatedAt.$lte = fin;
      }
    } else {
      // Si no envía ni turnoId ni rango de fechas, buscamos el turno abierto actual
      const turnoActual = await Turno.findOne({ sucursalId: 'sucursal-1', estado: 'abierto' });
      if (turnoActual) {
        const movimientosIngreso = await MovimientoCaja.find({
          turnoId: turnoActual._id,
          tipo: 'ingreso',
          pedidoId: { $ne: null }
        });
        pedidoIds = movimientosIngreso.map((m) => m.pedidoId);
        filtroPedidos._id = { $in: pedidoIds };
      }
    }

    const pedidos = await Pedido.find(filtroPedidos).populate({
      path: 'items.productoId',
      populate: { path: 'categoriaId' }
    });

    let totalComida = 0;
    let totalBebida = 0;
    const porCategoriaMap = {};

    pedidos.forEach((pedido) => {
      (pedido.items || []).forEach((item) => {
        if (item.eliminado) return;

        const subtotal = (item.cantidad || 1) * (item.precioUnitario || 0);
        const producto = item.productoId;
        const categoria = producto && typeof producto === 'object' ? producto.categoriaId : null;
        const tipoCategoria = categoria && typeof categoria === 'object' ? categoria.tipo : null;
        const nombreCategoria = categoria && typeof categoria === 'object' ? categoria.nombre : 'Sin Categoría';

        if (tipoCategoria === 'comida') {
          totalComida += subtotal;
        } else if (tipoCategoria === 'bebida') {
          totalBebida += subtotal;
        } else {
          // Si no está tipificado explícitamente, se asigna proporcionalmente o a comida
          totalComida += subtotal;
        }

        if (!porCategoriaMap[nombreCategoria]) {
          porCategoriaMap[nombreCategoria] = {
            categoria: nombreCategoria,
            tipo: tipoCategoria || 'comida',
            total: 0
          };
        }
        porCategoriaMap[nombreCategoria].total += subtotal;
      });
    });

    const totalVentas = totalComida + totalBebida;
    const porcentajeComida = totalVentas > 0 ? Number(((totalComida / totalVentas) * 100).toFixed(2)) : 0;
    const porcentajeBebida = totalVentas > 0 ? Number(((totalBebida / totalVentas) * 100).toFixed(2)) : 0;

    res.json({
      comida: totalComida,
      bebida: totalBebida,
      totalVentas,
      porcentajeComida,
      porcentajeBebida,
      cantidadPedidos: pedidos.length,
      porCategoria: Object.values(porCategoriaMap)
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener el desglose de ventas', error: error.message });
  }
};

module.exports = {
  abrirTurno,
  cerrarTurno,
  obtenerTurnoActual,
  obtenerHistorialTurnos,
  obtenerDetalleTurno,
  registrarEgresoManual,
  obtenerDesgloseVentas
};
