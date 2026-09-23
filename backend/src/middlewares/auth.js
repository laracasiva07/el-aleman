const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');

const protegerRuta = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ mensaje: 'No autorizado, token no proporcionado' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const usuario = await Usuario.findById(decoded.id);

    if (!usuario) {
      return res.status(401).json({ mensaje: 'No autorizado, usuario no encontrado' });
    }

    if (!usuario.activo) {
      return res.status(401).json({ mensaje: 'No autorizado, usuario inactivo' });
    }

    req.usuario = usuario;
    next();
  } catch (error) {
    return res.status(401).json({ mensaje: 'No autorizado, token inválido o expirado' });
  }
};

const permitirRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ mensaje: 'No autorizado, usuario no autenticado' });
    }

    if (!roles.includes(req.usuario.rol)) {
      return res.status(403).json({
        mensaje: `Acceso denegado. El rol '${req.usuario.rol}' no tiene permisos para esta acción`
      });
    }

    next();
  };
};

module.exports = {
  protegerRuta,
  permitirRoles
};
