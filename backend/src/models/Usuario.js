const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const usuarioSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: [true, 'El nombre es obligatorio'],
      trim: true
    },
    login: {
      type: String,
      required: [true, 'El login es obligatorio'],
      unique: true,
      trim: true,
      lowercase: true
    },
    password: {
      type: String,
      required: [true, 'La contraseña es obligatoria']
    },
    rol: {
      type: String,
      enum: {
        values: ['dueno', 'encargado', 'mozo'],
        message: 'Rol no válido ({VALUE}). Debe ser: dueno, encargado o mozo'
      },
      required: [true, 'El rol es obligatorio']
    },
    sucursalId: {
      type: String,
      default: 'sucursal-1'
    },
    activo: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

// Pre-save hook para hashear la contraseña automáticamente si fue modificada
usuarioSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Método de instancia para comparar contraseña ingresada con el hash almacenado
usuarioSchema.methods.compararPassword = async function (canditatePassword) {
  return await bcrypt.compare(canditatePassword, this.password);
};

// Sobreescribir toJSON para omitir el campo password en las respuestas JSON
usuarioSchema.methods.toJSON = function () {
  const usuarioObject = this.toObject();
  delete usuarioObject.password;
  return usuarioObject;
};

module.exports = mongoose.model('Usuario', usuarioSchema);
