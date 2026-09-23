const express = require('express');
const router = express.Router();
const {
  obtenerProductos,
  obtenerProductoPorId,
  calcularCostoProducto,
  cambiarDisponibilidad,
  crearProducto,
  editarProducto,
  eliminarProducto
} = require('../controllers/productoController');
const { protegerRuta, permitirRoles } = require('../middlewares/auth');

router.use(protegerRuta);

router.get('/', permitirRoles('dueno', 'encargado', 'mozo'), obtenerProductos);
router.get('/:id/costo', permitirRoles('dueno'), calcularCostoProducto);
router.get('/:id', permitirRoles('dueno', 'encargado', 'mozo'), obtenerProductoPorId);
router.patch('/:id/disponibilidad', permitirRoles('dueno'), cambiarDisponibilidad);
router.post('/', permitirRoles('dueno'), crearProducto);
router.put('/:id', permitirRoles('dueno'), editarProducto);
router.delete('/:id', permitirRoles('dueno'), eliminarProducto);

module.exports = router;
