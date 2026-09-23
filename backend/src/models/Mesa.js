const mongoose = require('mongoose');

const mesaSchema = new mongoose.Schema(
  {
    numero: {
      type: Number,
      required: [true, 'El número de mesa es obligatorio']
    },
    sectorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sector',
      required: [true, 'El sector es obligatorio']
    },
    estado: {
      type: String,
      enum: {
        values: ['libre', 'ocupada'],
        message: 'Estado de mesa no válido ({VALUE}). Debe ser: libre u ocupada'
      },
      default: 'libre'
    },
    posicionX: {
      type: Number,
      default: 0
    },
    posicionY: {
      type: Number,
      default: 0
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

module.exports = mongoose.model('Mesa', mesaSchema);
