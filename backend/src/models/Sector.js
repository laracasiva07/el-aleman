const mongoose = require('mongoose');

const sectorSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: [true, 'El nombre del sector es obligatorio'],
      unique: true,
      trim: true
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

module.exports = mongoose.model('Sector', sectorSchema);
