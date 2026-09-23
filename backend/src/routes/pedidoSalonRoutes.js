const express = require('express');
const router = express.Router();
const {
  obtenerPedidosSalonActivos,
  obtenerPedidoMesa,
  abrirMesaCrearPedido,
  agregarItemsPedido,
  enviarComanda,
  cambiarEstadoItemPedido,
  editarItemPedido,
  eliminarItemPedido,
  cerrarMesaCobrar
} = require('../controllers/pedidoSalonController');
const { protegerRuta, permitirRoles } = require('../middlewares/auth');

router.use(protegerRuta, permitirRoles('dueno', 'encargado', 'mozo'));

router.get('/', obtenerPedidosSalonActivos);
router.get('/mesa/:mesaId', obtenerPedidoMesa);
router.post('/', abrirMesaCrearPedido);
router.post('/:id/items', agregarItemsPedido);
router.post('/:id/comanda', enviarComanda);
router.patch('/:id/items/:itemId/estado', cambiarEstadoItemPedido);
router.put('/:id/items/:itemId', editarItemPedido);
router.delete('/:id/items/:itemId', eliminarItemPedido);
router.post('/:id/cerrar', permitirRoles('dueno', 'encargado'), cerrarMesaCobrar);

module.exports = router;
