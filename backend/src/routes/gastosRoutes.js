const express = require('express');
const router = express.Router();
const {
  obtenerGastosFijos,
  crearGastoFijo,
  editarGastoFijo,
  cambiarEstadoGastoFijo,
  obtenerGastosDiarios,
  obtenerBalanceGastos
} = require('../controllers/gastosController');

const { protegerRuta, permitirRoles } = require('../middlewares/auth');

// Aplicar autenticación y rol exclusivo dueño a todas las rutas de gastos
router.use(protegerRuta);
router.use(permitirRoles('dueno'));

// Rutas Gastos Fijos
router.get('/fijos', obtenerGastosFijos);
router.post('/fijos', crearGastoFijo);
router.put('/fijos/:id', editarGastoFijo);
router.patch('/fijos/:id/activo', cambiarEstadoGastoFijo);

// Rutas Gastos Diarios y Balance
router.get('/diarios', obtenerGastosDiarios);
router.get('/balance', obtenerBalanceGastos);

module.exports = router;
