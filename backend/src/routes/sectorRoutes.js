const express = require('express');
const router = express.Router();
const {
  obtenerSectores,
  crearSector,
  editarSector,
  eliminarSector
} = require('../controllers/sectorController');
const { protegerRuta, permitirRoles } = require('../middlewares/auth');

router.use(protegerRuta);

router.get('/', permitirRoles('dueno', 'encargado', 'mozo'), obtenerSectores);
router.post('/', permitirRoles('dueno'), crearSector);
router.put('/:id', permitirRoles('dueno'), editarSector);
router.delete('/:id', permitirRoles('dueno'), eliminarSector);

module.exports = router;
