const express = require('express');
const router = express.Router();
const {
  obtenerPromociones,
  crearPromocion,
  editarPromocion,
  cambiarEstadoPromocion
} = require('../controllers/promocionController');

const { protegerRuta, permitirRoles } = require('../middlewares/auth');

// Aplicar autenticación y rol exclusivo dueño a todas las rutas de catálogo de promociones
router.use(protegerRuta);
router.use(permitirRoles('dueno'));

router.get('/', obtenerPromociones);
router.post('/', crearPromocion);
router.put('/:id', editarPromocion);
router.patch('/:id/activo', cambiarEstadoPromocion);

module.exports = router;
