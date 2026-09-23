const Usuario = require('../models/Usuario');

// @desc    Listar todos los usuarios (sin password)
// @route   GET /api/usuarios
// @access  Privado (solo Dueño)
const listarUsuarios = async (req, res) => {
  try {
    const usuarios = await Usuario.find().select('-password').sort({ createdAt: -1 });
    res.json({ usuarios });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener el listado de usuarios', error: error.message });
  }
};

// @desc    Crear un nuevo usuario
// @route   POST /api/usuarios
// @access  Privado (solo Dueño)
const crearUsuario = async (req, res) => {
  try {
    const { nombre, login: loginInput, password, rol, sucursalId } = req.body;

    if (!nombre || !loginInput || !password || !rol) {
      return res.status(400).json({ mensaje: 'Todos los campos (nombre, login, password, rol) son obligatorios' });
    }

    if (password.length < 4) {
      return res.status(400).json({ mensaje: 'La contraseña debe tener al menos 4 caracteres' });
    }

    const rolesValidos = ['dueno', 'encargado', 'mozo'];
    if (!rolesValidos.includes(rol)) {
      return res.status(400).json({ mensaje: `Rol no válido. Debe ser uno de: ${rolesValidos.join(', ')}` });
    }

    const loginNormalizado = String(loginInput).toLowerCase().trim();
    const existeUsuario = await Usuario.findOne({ login: loginNormalizado });

    if (existeUsuario) {
      return res.status(400).json({ mensaje: 'El login ya se encuentra registrado' });
    }

    const nuevoUsuario = await Usuario.create({
      nombre: String(nombre).trim(),
      login: loginNormalizado,
      password,
      rol,
      sucursalId: sucursalId || 'sucursal-1',
      activo: true
    });

    const usuarioSinPassword = nuevoUsuario.toJSON();
    res.status(201).json({ usuario: usuarioSinPassword, mensaje: 'Usuario creado exitosamente' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al crear el usuario', error: error.message });
  }
};

// @desc    Editar nombre y/o rol de un usuario existente
// @route   PATCH /api/usuarios/:id
// @access  Privado (solo Dueño)
const actualizarUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, rol } = req.body;

    const usuario = await Usuario.findById(id);
    if (!usuario) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    if (nombre !== undefined) {
      if (!String(nombre).trim()) {
        return res.status(400).json({ mensaje: 'El nombre no puede estar vacío' });
      }
      usuario.nombre = String(nombre).trim();
    }

    if (rol !== undefined) {
      const rolesValidos = ['dueno', 'encargado', 'mozo'];
      if (!rolesValidos.includes(rol)) {
        return res.status(400).json({ mensaje: `Rol no válido. Debe ser uno de: ${rolesValidos.join(', ')}` });
      }
      usuario.rol = rol;
    }

    await usuario.save();

    res.json({ usuario: usuario.toJSON(), mensaje: 'Usuario actualizado correctamente' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al actualizar el usuario', error: error.message });
  }
};

// @desc    Cambiar contraseña de un usuario
// @route   PATCH /api/usuarios/:id/password
// @access  Privado (solo Dueño)
const cambiarPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password || typeof password !== 'string' || password.trim().length < 4) {
      return res.status(400).json({ mensaje: 'La nueva contraseña debe tener al menos 4 caracteres' });
    }

    const usuario = await Usuario.findById(id);
    if (!usuario) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    usuario.password = password;
    await usuario.save();

    res.json({ mensaje: 'Contraseña actualizada correctamente' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al cambiar la contraseña', error: error.message });
  }
};

// @desc    Togglear el campo activo (true/false) de un usuario
// @route   PATCH /api/usuarios/:id/activo
// @access  Privado (solo Dueño)
const toggleActivo = async (req, res) => {
  try {
    const { id } = req.params;
    const usuario = await Usuario.findById(id);

    if (!usuario) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    if (req.body.activo !== undefined) {
      usuario.activo = Boolean(req.body.activo);
    } else {
      usuario.activo = !usuario.activo;
    }

    await usuario.save();

    res.json({
      usuario: usuario.toJSON(),
      mensaje: `Usuario ${usuario.activo ? 'activado' : 'desactivado'} correctamente`
    });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al cambiar el estado activo del usuario', error: error.message });
  }
};

module.exports = {
  listarUsuarios,
  crearUsuario,
  actualizarUsuario,
  cambiarPassword,
  toggleActivo
};
