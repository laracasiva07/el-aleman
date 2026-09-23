const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');

// Helper para generar JWT Token
const generarToken = (id, rol) => {
  return jwt.sign(
    { id, rol },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '8h'
    }
  );
};

// @desc    Autenticar usuario y obtener token
// @route   POST /api/auth/login
// @access  Público
const login = async (req, res) => {
  try {
    const { login: loginInput, password } = req.body;

    if (!loginInput || typeof loginInput !== 'string' || !password || typeof password !== 'string') {
      return res.status(400).json({ mensaje: 'Por favor, ingrese login y contraseña válidos' });
    }

    const loginNormalizado = String(loginInput).toLowerCase().trim();
    const usuario = await Usuario.findOne({ login: loginNormalizado });

    if (!usuario) {
      return res.status(401).json({ mensaje: 'Credenciales inválidas' });
    }

    if (!usuario.activo) {
      return res.status(401).json({ mensaje: 'Usuario deshabilitado, contactá al dueño' });
    }

    const esPasswordCorrecto = await usuario.compararPassword(password);
    if (!esPasswordCorrecto) {
      return res.status(401).json({ mensaje: 'Credenciales inválidas' });
    }

    const token = generarToken(usuario._id, usuario.rol);

    res.json({
      usuario,
      token
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error del servidor al iniciar sesión', error: error.message });
  }
};

// @desc    Obtener perfil del usuario autenticado
// @route   GET /api/auth/perfil
// @access  Privado
const obtenerPerfil = async (req, res) => {
  try {
    res.json({ usuario: req.usuario });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener el perfil', error: error.message });
  }
};

// @desc    Crear un nuevo usuario
// @route   POST /api/auth/usuarios
// @access  Privado (solo Dueño)
const crearUsuario = async (req, res) => {
  try {
    const { nombre, login: loginInput, password, rol, sucursalId, activo } = req.body;

    if (!nombre || !loginInput || !password || !rol) {
      return res.status(400).json({ mensaje: 'Los campos nombre, login, password y rol son obligatorios' });
    }

    const loginNormalizado = loginInput.toLowerCase().trim();
    const existeUsuario = await Usuario.findOne({ login: loginNormalizado });

    if (existeUsuario) {
      return res.status(400).json({ mensaje: 'El login ya se encuentra registrado' });
    }

    const nuevoUsuario = await Usuario.create({
      nombre,
      login: loginNormalizado,
      password,
      rol,
      sucursalId: sucursalId || 'sucursal-1',
      activo: activo !== undefined ? activo : true
    });

    res.status(201).json({ usuario: nuevoUsuario });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al crear el usuario', error: error.message });
  }
};

// @desc    Listar todos los usuarios
// @route   GET /api/auth/usuarios
// @access  Privado (solo Dueño)
const listarUsuarios = async (req, res) => {
  try {
    const usuarios = await Usuario.find().select('-password');
    res.json({ usuarios });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener usuarios', error: error.message });
  }
};

module.exports = {
  login,
  obtenerPerfil,
  crearUsuario,
  listarUsuarios
};
