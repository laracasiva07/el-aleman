const express = require('express');
const router = express.Router();
const {
  obtenerClientes,
  obtenerClientePorId,
  obtenerPedidosCliente,
  actualizarCliente,
  crearCliente
} = require('../controllers/clienteController');
const { protegerRuta, permitirRoles } = require('../middlewares/auth');

// Todas las rutas de cliente son exclusivas para dueño y encargado
router.use(protegerRuta, permitirRoles('dueno', 'encargado'));

router.get('/', obtenerClientes);
router.post('/', crearCliente);
router.get('/:id', obtenerClientePorId);
router.get('/:id/pedidos', obtenerPedidosCliente);
router.put('/:id', actualizarCliente);

module.exports = router;
