const express = require('express');
const router = express.Router();
const {
  obtenerPedidosTakeawayActivos,
  crearPedidoTakeaway,
  agregarItemsTakeaway,
  enviarComandaTakeaway,
  cambiarEstadoTakeaway,
  cambiarEstadoItemTakeaway,
  editarItemTakeaway,
  eliminarItemTakeaway,
  cerrarPedidoTakeaway
} = require('../controllers/pedidoTakeawayController');
const { protegerRuta, permitirRoles } = require('../middlewares/auth');

router.use(protegerRuta, permitirRoles('dueno', 'encargado', 'mozo'));

router.get('/', obtenerPedidosTakeawayActivos);
router.post('/', crearPedidoTakeaway);
router.patch('/:id/estado', cambiarEstadoTakeaway);
router.post('/:id/items', agregarItemsTakeaway);
router.post('/:id/comanda', enviarComandaTakeaway);
router.patch('/:id/items/:itemId/estado', cambiarEstadoItemTakeaway);
router.put('/:id/items/:itemId', editarItemTakeaway);
router.delete('/:id/items/:itemId', eliminarItemTakeaway);
router.post('/:id/cerrar', permitirRoles('dueno', 'encargado'), cerrarPedidoTakeaway);

module.exports = router;
