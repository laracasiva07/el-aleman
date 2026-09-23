const express = require('express');
const router = express.Router();
const {
  obtenerReporteVentas,
  obtenerProductosMasVendidos,
  obtenerReportePromociones,
  obtenerStockAlertasReportes,
  obtenerReporteAuditoria,
  obtenerResumenFinanciero
} = require('../controllers/reportesController');

const { protegerRuta, permitirRoles } = require('../middlewares/auth');

// Proteger todas las rutas de reportes: requerir autenticación y rol exclusivo 'dueno'
router.use(protegerRuta);
router.use(permitirRoles('dueno'));

// Rutas de Reportes
router.get('/ventas', obtenerReporteVentas);
router.get('/productos-mas-vendidos', obtenerProductosMasVendidos);
router.get('/promociones', obtenerReportePromociones);
router.get('/stock-alertas', obtenerStockAlertasReportes);
router.get('/auditoria', obtenerReporteAuditoria);
router.get('/resumen-financiero', obtenerResumenFinanciero);

module.exports = router;
