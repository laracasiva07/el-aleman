const mongoose = require('mongoose');

const clienteSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: [true, 'El nombre del cliente es obligatorio'],
      trim: true
    },
    telefono: {
      type: String,
      required: [true, 'El teléfono del cliente es obligatorio'],
      unique: true,
      trim: true
    },
    direccion: {
      type: String,
      trim: true,
      default: ''
    },
    sucursalId: {
      type: String,
      default: 'sucursal-1'
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Cliente', clienteSchema);
