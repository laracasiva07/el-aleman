const express = require('express');
const router = express.Router();
const {
  obtenerIngredientes,
  obtenerAlertasStock,
  crearIngrediente,
  editarIngrediente,
  eliminarIngrediente
} = require('../controllers/ingredienteController');
const { protegerRuta, permitirRoles } = require('../middlewares/auth');

router.use(protegerRuta, permitirRoles('dueno'));

// Nota: /alertas debe ir antes de /:id para evitar colisiones de rutas
router.get('/alertas', obtenerAlertasStock);
router.get('/', obtenerIngredientes);
router.post('/', crearIngrediente);
router.put('/:id', editarIngrediente);
router.delete('/:id', eliminarIngrediente);

module.exports = router;
