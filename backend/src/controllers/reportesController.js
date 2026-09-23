const Pedido = require('../models/Pedido');
const MovimientoCaja = require('../models/MovimientoCaja');
const Ingrediente = require('../models/Ingrediente');
const { obtenerAlertasStock } = require('./ingredienteController');
const { obtenerBalanceGastos } = require('./gastosController');

// Helper interno para obtener rango de fechas (por defecto mes en curso)
const obtenerRangoFechasReportes = (desdeQuery, hastaQuery) => {
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

// Helper interno para formatear claves de agrupación temporal
const obtenerClaveAgrupacion = (fecha, agrupacion) => {
  const d = new Date(fecha);
  const anio = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');

  if (agrupacion === 'anio') {
    return `${anio}`;
  }
  if (agrupacion === 'mes') {
    return `${anio}-${mes}`;
  }
  if (agrupacion === 'semana') {
    // Número de semana ISO o fecha del inicio de semana
    const firstDayOfYear = new Date(anio, 0, 1);
    const pastDaysOfYear = (d - firstDayOfYear) / 86400000;
    const semanaNum = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    return `${anio}-W${String(semanaNum).padStart(2, '0')}`;
  }
  // Defecto 'dia'
  return `${anio}-${mes}-${dia}`;
};

// @desc    a) GET /api/reportes/ventas?desde&hasta&agrupacion=dia|semana|mes|anio
// @route   GET /api/reportes/ventas
// @access  Privado (Solo Dueño)
const obtenerReporteVentas = async (req, res) => {
  try {
    const { desde, hasta, agrupacion = 'dia' } = req.query;
    const { inicio, fin } = obtenerRangoFechasReportes(desde, hasta);

    // Filtrar pedidos pagados cuya fechaPago esté dentro del rango
    const pedidos = await Pedido.find({
      estadoPago: 'pagado',
      fechaPago: { $gte: inicio, $lte: fin }
    }).populate({
      path: 'items.productoId',
      populate: { path: 'categoriaId' }
    });

    let totalVentas = 0;
    let totalComida = 0;
    let totalBebida = 0;
    let cantidadPedidosValidos = 0;
    const agrupadoMap = {};

    pedidos.forEach((pedido) => {
      const itemsActivos = (pedido.items || []).filter((it) => !it.eliminado);
      if (itemsActivos.length === 0) return;

      const montoPedido = itemsActivos.reduce(
        (sum, it) => sum + (it.cantidad || 1) * (it.precioUnitario || 0),
        0
      );

      if (montoPedido <= 0) return;

      cantidadPedidosValidos++;
      totalVentas += montoPedido;

      const claveAgrupacion = obtenerClaveAgrupacion(pedido.fechaPago || pedido.createdAt, agrupacion);
      if (!agrupadoMap[claveAgrupacion]) {
        agrupadoMap[claveAgrupacion] = {
          etiqueta: claveAgrupacion,
          total: 0,
          comida: 0,
          bebida: 0,
          cantidadPedidos: 0
        };
      }
      agrupadoMap[claveAgrupacion].total += montoPedido;
      agrupadoMap[claveAgrupacion].cantidadPedidos += 1;

      itemsActivos.forEach((item) => {
        const subtotal = (item.cantidad || 1) * (item.precioUnitario || 0);
        const producto = item.productoId;
        const categoria = producto && typeof producto === 'object' ? producto.categoriaId : null;
        const tipoCategoria = categoria && typeof categoria === 'object' ? categoria.tipo : null;

        if (tipoCategoria === 'bebida') {
          totalBebida += subtotal;
          agrupadoMap[claveAgrupacion].bebida += subtotal;
        } else {
          // comida o sin categoría explícita
          totalComida += subtotal;
          agrupadoMap[claveAgrupacion].comida += subtotal;
        }
      });
    });

    const porcentajeComida = totalVentas > 0 ? Number(((totalComida / totalVentas) * 100).toFixed(2)) : 0;
    const porcentajeBebida = totalVentas > 0 ? Number(((totalBebida / totalVentas) * 100).toFixed(2)) : 0;

    const serieTemporal = Object.values(agrupadoMap).sort((a, b) => (a.etiqueta > b.etiqueta ? 1 : -1));

    res.json({
      rango: { desde: inicio, hasta: fin },
      agrupacion,
      totalVentas: Number(totalVentas.toFixed(2)),
      comida: Number(totalComida.toFixed(2)),
      bebida: Number(totalBebida.toFixed(2)),
      porcentajeComida,
      porcentajeBebida,
      cantidadPedidos: cantidadPedidosValidos,
      serieTemporal
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener reporte de ventas', error: error.message });
  }
};

// @desc    b) GET /api/reportes/productos-mas-vendidos?desde&hasta&limit
// @route   GET /api/reportes/productos-mas-vendidos
// @access  Privado (Solo Dueño)
const obtenerProductosMasVendidos = async (req, res) => {
  try {
    const { desde, hasta, limit = 10 } = req.query;
    const { inicio, fin } = obtenerRangoFechasReportes(desde, hasta);
    const limiteNum = Math.max(1, parseInt(limit, 10) || 10);

    const pedidos = await Pedido.find({
      estadoPago: 'pagado',
      fechaPago: { $gte: inicio, $lte: fin }
    });

    const productosMap = {};

    pedidos.forEach((pedido) => {
      const itemsActivos = (pedido.items || []).filter((it) => !it.eliminado);
      if (itemsActivos.length === 0) return;

      const totalPedido = itemsActivos.reduce(
        (sum, it) => sum + (it.cantidad || 1) * (it.precioUnitario || 0),
        0
      );
      if (totalPedido <= 0) return;

      itemsActivos.forEach((item) => {
        const prodId = item.productoId ? item.productoId.toString() : item.nombreProducto;
        const nombre = item.nombreProducto || 'Producto Desconocido';
        const cant = item.cantidad || 1;
        const facturacion = cant * (item.precioUnitario || 0);

        if (!productosMap[prodId]) {
          productosMap[prodId] = {
            productoId: item.productoId || null,
            nombre,
            cantidadVendida: 0,
            facturacionTotal: 0
          };
        }

        productosMap[prodId].cantidadVendida += cant;
        productosMap[prodId].facturacionTotal += facturacion;
      });
    });

    const ranking = Object.values(productosMap)
      .map((p) => ({
        ...p,
        facturacionTotal: Number(p.facturacionTotal.toFixed(2))
      }))
      .sort((a, b) => b.cantidadVendida - a.cantidadVendida)
      .slice(0, limiteNum);

    res.json({
      rango: { desde: inicio, hasta: fin },
      limite: limiteNum,
      productos: ranking
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener productos más vendidos', error: error.message });
  }
};

// @desc    c) GET /api/reportes/promociones?desde&hasta
// @route   GET /api/reportes/promociones
// @access  Privado (Solo Dueño)
const obtenerReportePromociones = async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    const { inicio, fin } = obtenerRangoFechasReportes(desde, hasta);

    const pedidos = await Pedido.find({
      estadoPago: 'pagado',
      fechaPago: { $gte: inicio, $lte: fin }
    });

    let facturacionPromociones = 0;
    let facturacionNormal = 0;

    // Mapa para agrupar ítems por grupoPromocionId único
    const gruposPromoMap = {};
    // Mapa acumulado por nombre de promoción
    const promoNombreMap = {};

    pedidos.forEach((pedido) => {
      const itemsActivos = (pedido.items || []).filter((it) => !it.eliminado);
      if (itemsActivos.length === 0) return;

      const totalPedido = itemsActivos.reduce(
        (sum, it) => sum + (it.cantidad || 1) * (it.precioUnitario || 0),
        0
      );
      if (totalPedido <= 0) return;

      itemsActivos.forEach((item) => {
        const subtotal = (item.cantidad || 1) * (item.precioUnitario || 0);

        if (item.grupoPromocionId) {
          facturacionPromociones += subtotal;

          if (!gruposPromoMap[item.grupoPromocionId]) {
            gruposPromoMap[item.grupoPromocionId] = {
              nombre: item.promocionNombre || 'Promoción Sin Nombre',
              subtotalGrupo: 0
            };
          }
          gruposPromoMap[item.grupoPromocionId].subtotalGrupo += subtotal;
        } else {
          facturacionNormal += subtotal;
        }
      });
    });

    // Consolidar los gruposPromocionId únicos por nombre de promoción
    Object.values(gruposPromoMap).forEach((grupo) => {
      const nombre = grupo.nombre;
      if (!promoNombreMap[nombre]) {
        promoNombreMap[nombre] = {
          nombre,
          cantidadCombosVendidos: 0,
          facturacionTotal: 0
        };
      }
      promoNombreMap[nombre].cantidadCombosVendidos += 1;
      promoNombreMap[nombre].facturacionTotal += grupo.subtotalGrupo;
    });

    const listaPromociones = Object.values(promoNombreMap).map((p) => ({
      ...p,
      facturacionTotal: Number(p.facturacionTotal.toFixed(2))
    }));

    const facturacionTotal = facturacionPromociones + facturacionNormal;
    const porcentajePromociones = facturacionTotal > 0 ? Number(((facturacionPromociones / facturacionTotal) * 100).toFixed(2)) : 0;
    const porcentajeNormal = facturacionTotal > 0 ? Number(((facturacionNormal / facturacionTotal) * 100).toFixed(2)) : 0;

    res.json({
      rango: { desde: inicio, hasta: fin },
      facturacionPromociones: Number(facturacionPromociones.toFixed(2)),
      facturacionNormal: Number(facturacionNormal.toFixed(2)),
      facturacionTotal: Number(facturacionTotal.toFixed(2)),
      porcentajePromociones,
      porcentajeNormal,
      promociones: listaPromociones
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener reporte de promociones', error: error.message });
  }
};

// @desc    d) GET /api/reportes/stock-alertas
// @route   GET /api/reportes/stock-alertas
// @access  Privado (Solo Dueño)
const obtenerStockAlertasReportes = async (req, res) => {
  // Reutiliza la función del ingredienteController
  return obtenerAlertasStock(req, res);
};

// @desc    e) GET /api/reportes/auditoria?desde&hasta
// @route   GET /api/reportes/auditoria
// @access  Privado (Solo Dueño)
const obtenerReporteAuditoria = async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    const { inicio, fin } = obtenerRangoFechasReportes(desde, hasta);

    // 1. Obtener movimientos de caja tipo 'ajuste' en el rango de fechas
    const movimientosAjuste = await MovimientoCaja.find({
      sucursalId: 'sucursal-1',
      tipo: 'ajuste',
      fecha: { $gte: inicio, $lte: fin }
    })
      .sort({ fecha: -1 })
      .populate('usuarioId', 'nombre login rol')
      .populate('pedidoId');

    // 2. Obtener IDs únicos de pedidos involucrados en los ajustes
    const pedidoIdsAjustados = [
      ...new Set(
        movimientosAjuste
          .filter((m) => m.pedidoId)
          .map((m) => m.pedidoId._id || m.pedidoId)
      )
    ];

    // 3. Consultar los pedidos con su historialAuditoria y calcular la diferencia informativo (Solo Lectura)
    const pedidosAfectados = await Pedido.find({
      _id: { $in: pedidoIdsAjustados }
    }).populate('historialAuditoria.usuarioId', 'nombre login rol');

    // Para cada pedido, buscar su cobro original en MovimientoCaja (ingreso)
    const comparativaAuditoria = await Promise.all(
      pedidosAfectados.map(async (pedido) => {
        const cobroOriginal = await MovimientoCaja.findOne({
          pedidoId: pedido._id,
          tipo: 'ingreso'
        });

        const itemsActivos = (pedido.items || []).filter((it) => !it.eliminado);
        const totalComercialActual = itemsActivos.reduce(
          (sum, it) => sum + (it.cantidad || 1) * (it.precioUnitario || 0),
          0
        );

        const montoOriginalCobrado = cobroOriginal ? cobroOriginal.monto : null;
        const diferencia = montoOriginalCobrado !== null ? Number((totalComercialActual - montoOriginalCobrado).toFixed(2)) : 0;

        return {
          pedidoId: pedido._id,
          tipo: pedido.tipo,
          estadoPago: pedido.estadoPago,
          fechaPago: pedido.fechaPago,
          createdAt: pedido.createdAt,
          totalComercialActual: Number(totalComercialActual.toFixed(2)),
          montoOriginalCobrado,
          diferencia,
          historialAuditoria: pedido.historialAuditoria || []
        };
      })
    );

    res.json({
      rango: { desde: inicio, hasta: fin },
      totalAjustesRegistrados: movimientosAjuste.length,
      movimientosAjuste,
      pedidosAuditoria: comparativaAuditoria
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener reporte de auditoría', error: error.message });
  }
};

// @desc    f) GET /api/reportes/resumen-financiero?desde&hasta
// @route   GET /api/reportes/resumen-financiero
// @access  Privado (Solo Dueño)
const obtenerResumenFinanciero = async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    const { inicio, fin } = obtenerRangoFechasReportes(desde, hasta);

    // 1. Obtener datos comerciales directos de Pedido (ventas reales comerciales)
    const pedidos = await Pedido.find({
      estadoPago: 'pagado',
      fechaPago: { $gte: inicio, $lte: fin }
    });

    let ventasComercialesTotal = 0;
    pedidos.forEach((p) => {
      const itemsActivos = (p.items || []).filter((it) => !it.eliminado);
      const totalP = itemsActivos.reduce(
        (sum, it) => sum + (it.cantidad || 1) * (it.precioUnitario || 0),
        0
      );
      if (totalP > 0) {
        ventasComercialesTotal += totalP;
      }
    });
    ventasComercialesTotal = Number(ventasComercialesTotal.toFixed(2));

    // 2. REUTILIZAR gastosController.obtenerBalanceGastos para gastos diarios y fijos prorrateados
    let datosBalanceGastos = null;
    const reqMock = { query: { desde, hasta } };
    const resMock = {
      json: (data) => {
        datosBalanceGastos = data;
      },
      status: () => resMock
    };

    await obtenerBalanceGastos(reqMock, resMock);

    if (!datosBalanceGastos) {
      return res.status(500).json({ mensaje: 'Error al calcular balance de gastos' });
    }

    const cobrosCaja = datosBalanceGastos.ingresos || 0;
    const gastosDiarios = datosBalanceGastos.gastosDiarios || 0;
    const gastosFijosProrrateados = datosBalanceGastos.gastosFijosProrrateados || 0;
    const totalGastos = datosBalanceGastos.totalGastos || 0;
    const balanceFinancieroCaja = datosBalanceGastos.balanceNeto || 0;
    const balanceComercial = Number((ventasComercialesTotal - totalGastos).toFixed(2));

    res.json({
      rango: datosBalanceGastos.rango || { desde: inicio, hasta: fin },
      ventasComerciales: ventasComercialesTotal,
      cobrosCaja,
      gastosDiarios,
      gastosFijosProrrateados,
      totalGastos,
      balanceFinancieroCaja,
      balanceComercial
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener resumen financiero', error: error.message });
  }
};

module.exports = {
  obtenerReporteVentas,
  obtenerProductosMasVendidos,
  obtenerReportePromociones,
  obtenerStockAlertasReportes,
  obtenerReporteAuditoria,
  obtenerResumenFinanciero
};
