const express = require('express');
const router = express.Router();
const {
  obtenerMesas,
  crearMesa,
  crearMesasLote,
  editarMesa,
  actualizarPosicionMesa,
  eliminarMesa
} = require('../controllers/mesaController');
const { protegerRuta, permitirRoles } = require('../middlewares/auth');

router.use(protegerRuta);

// GET accesible para dueno, encargado y mozo
router.get('/', permitirRoles('dueno', 'encargado', 'mozo'), obtenerMesas);

// Rutas de administración exclusivas para dueño
router.post('/lote', permitirRoles('dueno'), crearMesasLote);
router.post('/', permitirRoles('dueno'), crearMesa);
router.put('/:id', permitirRoles('dueno'), editarMesa);
router.patch('/:id/posicion', permitirRoles('dueno'), actualizarPosicionMesa);
router.delete('/:id', permitirRoles('dueno'), eliminarMesa);

module.exports = router;
