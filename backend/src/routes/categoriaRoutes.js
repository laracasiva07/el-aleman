const express = require('express');
const router = express.Router();
const {
  obtenerCategorias,
  crearCategoria,
  editarCategoria,
  eliminarCategoria
} = require('../controllers/categoriaController');
const { protegerRuta, permitirRoles } = require('../middlewares/auth');

// Todas las rutas de categoría requieren autenticación y rol de dueño
router.use(protegerRuta, permitirRoles('dueno'));

router.get('/', obtenerCategorias);
router.post('/', crearCategoria);
router.put('/:id', editarCategoria);
router.delete('/:id', eliminarCategoria);

module.exports = router;
