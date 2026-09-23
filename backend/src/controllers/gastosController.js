const GastoFijo = require('../models/GastoFijo');
const MovimientoCaja = require('../models/MovimientoCaja');

// Helper para obtener fecha de inicio y fin por defecto (mes calendario en curso)
const obtenerRangoFechas = (desdeQuery, hastaQuery) => {
  const ahora = new Date();
  let inicio;
  let fin;

  if (desdeQuery) {
    inicio = new Date(desdeQuery);
    inicio.setHours(0, 0, 0, 0);
  } else {
    // Primer día del mes actual a las 00:00:00
    inicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1, 0, 0, 0, 0);
  }

  if (hastaQuery) {
    fin = new Date(hastaQuery);
    fin.setHours(23, 59, 59, 999);
  } else {
    // Último día del mes actual a las 23:59:59.999
    fin = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0, 23, 59, 59, 999);
  }

  return { inicio, fin };
};

// @desc    Listar todos los gastos fijos
// @route   GET /api/gastos/fijos
// @access  Privado (Solo Dueño)
const obtenerGastosFijos = async (req, res) => {
  try {
    const gastosFijos = await GastoFijo.find({ sucursalId: 'sucursal-1' }).sort({ createdAt: -1 });
    res.json({ gastosFijos });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener gastos fijos', error: error.message });
  }
};

// @desc    Crear un nuevo gasto fijo
// @route   POST /api/gastos/fijos
// @access  Privado (Solo Dueño)
const crearGastoFijo = async (req, res) => {
  try {
    const { nombre, montoMensual } = req.body;

    if (!nombre || !nombre.trim()) {
      return res.status(400).json({ mensaje: 'El nombre del gasto fijo es obligatorio' });
    }

    if (montoMensual === undefined || montoMensual === null || isNaN(montoMensual) || Number(montoMensual) <= 0) {
      return res.status(400).json({ mensaje: 'El montoMensual debe ser un número mayor a 0' });
    }

    const existeGasto = await GastoFijo.findOne({
      sucursalId: 'sucursal-1',
      nombre: nombre.trim()
    });

    if (existeGasto) {
      return res.status(400).json({ mensaje: 'Ya existe un gasto fijo con ese nombre' });
    }

    const nuevoGastoFijo = await GastoFijo.create({
      sucursalId: 'sucursal-1',
      nombre: nombre.trim(),
      montoMensual: Number(montoMensual),
      activo: true,
      fechaCreacion: new Date()
    });

    res.status(201).json({
      mensaje: 'Gasto fijo creado exitosamente',
      gastoFijo: nuevoGastoFijo
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al crear gasto fijo', error: error.message });
  }
};

// @desc    Editar un gasto fijo existente
// @route   PUT /api/gastos/fijos/:id
// @access  Privado (Solo Dueño)
const editarGastoFijo = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, montoMensual } = req.body;

    const gastoFijo = await GastoFijo.findById(id);
    if (!gastoFijo) {
      return res.status(404).json({ mensaje: 'Gasto fijo no encontrado' });
    }

    if (nombre) {
      if (!nombre.trim()) {
        return res.status(400).json({ mensaje: 'El nombre no puede estar vacío' });
      }

      const existeOtro = await GastoFijo.findOne({
        sucursalId: 'sucursal-1',
        nombre: nombre.trim(),
        _id: { $ne: id }
      });

      if (existeOtro) {
        return res.status(400).json({ mensaje: 'Ya existe otro gasto fijo con ese nombre' });
      }

      gastoFijo.nombre = nombre.trim();
    }

    if (montoMensual !== undefined && montoMensual !== null) {
      if (isNaN(montoMensual) || Number(montoMensual) <= 0) {
        return res.status(400).json({ mensaje: 'El montoMensual debe ser un número mayor a 0' });
      }
      gastoFijo.montoMensual = Number(montoMensual);
    }

    await gastoFijo.save();

    res.json({
      mensaje: 'Gasto fijo actualizado exitosamente',
      gastoFijo
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al actualizar gasto fijo', error: error.message });
  }
};

// @desc    Dar de baja o reactivar un gasto fijo (patch activo)
// @route   PATCH /api/gastos/fijos/:id/activo
// @access  Privado (Solo Dueño)
const cambiarEstadoGastoFijo = async (req, res) => {
  try {
    const { id } = req.params;
    const { activo } = req.body;

    const gastoFijo = await GastoFijo.findById(id);
    if (!gastoFijo) {
      return res.status(404).json({ mensaje: 'Gasto fijo no encontrado' });
    }

    if (typeof activo === 'boolean') {
      gastoFijo.activo = activo;
    } else {
      gastoFijo.activo = !gastoFijo.activo;
    }

    await gastoFijo.save();

    res.json({
      mensaje: `Gasto fijo ${gastoFijo.activo ? 'activado' : 'dado de baja'} exitosamente`,
      gastoFijo
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al cambiar el estado del gasto fijo', error: error.message });
  }
};

// @desc    Obtener lista de gastos diarios (Movimientos de caja tipo egreso con esGastoDiario: true)
// @route   GET /api/gastos/diarios?desde=&hasta=
// @access  Privado (Solo Dueño)
const obtenerGastosDiarios = async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    const { inicio, fin } = obtenerRangoFechas(desde, hasta);

    const movimientos = await MovimientoCaja.find({
      sucursalId: 'sucursal-1',
      tipo: 'egreso',
      esGastoDiario: true,
      fecha: { $gte: inicio, $lte: fin }
    })
      .sort({ fecha: -1 })
      .populate('usuarioId', 'nombre login rol')
      .populate('turnoId');

    const total = movimientos.reduce((sum, m) => sum + (m.monto || 0), 0);

    res.json({
      rango: {
        desde: inicio,
        hasta: fin
      },
      total,
      gastosDiarios: movimientos
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener gastos diarios', error: error.message });
  }
};

// @desc    Obtener balance neto de gastos e ingresos
// @route   GET /api/gastos/balance?desde=&hasta=
// @access  Privado (Solo Dueño)
const obtenerBalanceGastos = async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    const { inicio, fin } = obtenerRangoFechas(desde, hasta);

    // 1. Total de ventas/ingresos en el período
    const movimientosIngresos = await MovimientoCaja.find({
      sucursalId: 'sucursal-1',
      tipo: 'ingreso',
      fecha: { $gte: inicio, $lte: fin }
    });

    const totalIngresos = movimientosIngresos.reduce((sum, m) => sum + (m.monto || 0), 0);

    // 2. Total de gastos diarios reales en el período (egresos con esGastoDiario: true)
    const movimientosGastosDiarios = await MovimientoCaja.find({
      sucursalId: 'sucursal-1',
      tipo: 'egreso',
      esGastoDiario: true,
      fecha: { $gte: inicio, $lte: fin }
    });

    const totalGastosDiarios = movimientosGastosDiarios.reduce((sum, m) => sum + (m.monto || 0), 0);

    // 3. Gastos fijos prorrateados (SOLO GastoFijo donde activo === true)
    const gastosFijosActivos = await GastoFijo.find({
      sucursalId: 'sucursal-1',
      activo: true
    });

    let totalGastosFijosProrrateados = 0;
    let diasTotales = 0;

    const cur = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
    const end = new Date(fin.getFullYear(), fin.getMonth(), fin.getDate());

    while (cur <= end) {
      diasTotales++;
      const year = cur.getFullYear();
      const month = cur.getMonth();
      const diasEnMes = new Date(year, month + 1, 0).getDate();

      for (const gf of gastosFijosActivos) {
        totalGastosFijosProrrateados += gf.montoMensual / diasEnMes;
      }

      cur.setDate(cur.getDate() + 1);
    }

    totalGastosFijosProrrateados = Number(totalGastosFijosProrrateados.toFixed(2));
    const totalGastos = Number((totalGastosDiarios + totalGastosFijosProrrateados).toFixed(2));
    const balanceNeto = Number((totalIngresos - totalGastos).toFixed(2));

    res.json({
      rango: {
        desde: inicio,
        hasta: fin,
        diasTotales
      },
      ingresos: totalIngresos,
      gastosDiarios: totalGastosDiarios,
      gastosFijosProrrateados: totalGastosFijosProrrateados,
      totalGastos,
      balanceNeto,
      gastosFijosActivosCount: gastosFijosActivos.length
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener balance de gastos', error: error.message });
  }
};

module.exports = {
  obtenerGastosFijos,
  crearGastoFijo,
  editarGastoFijo,
  cambiarEstadoGastoFijo,
  obtenerGastosDiarios,
  obtenerBalanceGastos
};
