const express = require('express');
const router = express.Router();
const {
  listarUsuarios,
  crearUsuario,
  actualizarUsuario,
  cambiarPassword,
  toggleActivo
} = require('../controllers/usuarioController');
const { protegerRuta, permitirRoles } = require('../middlewares/auth');

// Todas las rutas de usuarios requieren autenticación y rol exclusivo 'dueno'
router.use(protegerRuta);
router.use(permitirRoles('dueno'));

router.get('/', listarUsuarios);
router.post('/', crearUsuario);
router.patch('/:id', actualizarUsuario);
router.patch('/:id/password', cambiarPassword);
router.patch('/:id/activo', toggleActivo);

module.exports = router;
