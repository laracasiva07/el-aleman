const express = require('express');
const router = express.Router();
const {
  abrirTurno,
  cerrarTurno,
  obtenerTurnoActual,
  obtenerHistorialTurnos,
  obtenerDetalleTurno,
  registrarEgresoManual,
  obtenerDesgloseVentas
} = require('../controllers/cajaController');

const { protegerRuta, permitirRoles } = require('../middlewares/auth');

// Aplicar autenticación obligatoria a todas las rutas de caja
router.use(protegerRuta);

// Endpoint Turno Actual (Dueño y Encargado)
router.get('/turnos/actual', permitirRoles('dueno', 'encargado'), obtenerTurnoActual);

// Endpoint Abrir Turno (Dueño y Encargado)
router.post('/turnos/abrir', permitirRoles('dueno', 'encargado'), abrirTurno);

// Endpoint Cerrar Turno (Dueño y Encargado)
router.patch('/turnos/:id/cerrar', permitirRoles('dueno', 'encargado'), cerrarTurno);

// Endpoint Historial de Turnos Pasados (Solo Dueño)
router.get('/turnos', permitirRoles('dueno'), obtenerHistorialTurnos);

// Endpoint Detalle de Turno (Solo Dueño)
router.get('/turnos/:id', permitirRoles('dueno'), obtenerDetalleTurno);

// Endpoint Registrar Egreso Manual (Dueño y Encargado)
router.post('/movimientos', permitirRoles('dueno', 'encargado'), registrarEgresoManual);

// Endpoint Desglose de Ventas (Solo Dueño)
router.get('/desglose', permitirRoles('dueno'), obtenerDesgloseVentas);

module.exports = router;
