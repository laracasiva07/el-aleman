const express = require('express');
const router = express.Router();
const {
  login,
  obtenerPerfil,
  crearUsuario,
  listarUsuarios
} = require('../controllers/authController');
const { protegerRuta, permitirRoles } = require('../middlewares/auth');

const rateLimit = require('express-rate-limit');

// Rate limiter específico para login (máximo 10 intentos cada 15 minutos por IP)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { mensaje: 'Demasiados intentos de inicio de sesión desde esta IP. Por favor intente nuevamente en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Rutas públicas
router.post('/login', loginLimiter, login);

// Rutas protegidas (requieren autenticación)
router.get('/perfil', protegerRuta, obtenerPerfil);

// Rutas protegidas solo para rol "dueno"
router.post('/usuarios', protegerRuta, permitirRoles('dueno'), crearUsuario);
router.get('/usuarios', protegerRuta, permitirRoles('dueno'), listarUsuarios);

module.exports = router;
