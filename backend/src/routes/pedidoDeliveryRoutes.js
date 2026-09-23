const express = require('express');
const router = express.Router();
const {
  obtenerPedidosDeliveryActivos,
  crearPedidoDelivery,
  agregarItemsDelivery,
  cambiarEstadoDelivery,
  editarItemDelivery,
  eliminarItemDelivery,
  cerrarPedidoDelivery
} = require('../controllers/pedidoDeliveryController');
const { protegerRuta, permitirRoles } = require('../middlewares/auth');

router.use(protegerRuta, permitirRoles('dueno', 'encargado', 'mozo'));

router.get('/', obtenerPedidosDeliveryActivos);
router.post('/', crearPedidoDelivery);
router.post('/:id/items', agregarItemsDelivery);
router.patch('/:id/estado', cambiarEstadoDelivery);
router.put('/:id/items/:itemId', editarItemDelivery);
router.delete('/:id/items/:itemId', eliminarItemDelivery);
router.post('/:id/cerrar', permitirRoles('dueno', 'encargado'), cerrarPedidoDelivery);

module.exports = router;
