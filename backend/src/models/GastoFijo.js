const mongoose = require('mongoose');

const gastoFijoSchema = new mongoose.Schema(
  {
    sucursalId: {
      type: String,
      default: 'sucursal-1'
    },
    nombre: {
      type: String,
      required: [true, 'El nombre del gasto fijo es obligatorio'],
      trim: true
    },
    montoMensual: {
      type: Number,
      required: [true, 'El monto mensual es obligatorio'],
      min: [0, 'El monto mensual debe ser mayor o igual a 0']
    },
    activo: {
      type: Boolean,
      default: true
    },
    fechaCreacion: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('GastoFijo', gastoFijoSchema);
