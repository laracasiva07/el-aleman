const mongoose = require('mongoose');

const turnoSchema = new mongoose.Schema(
  {
    sucursalId: {
      type: String,
      default: 'sucursal-1'
    },
    fechaApertura: {
      type: Date,
      default: Date.now,
      required: true
    },
    usuarioAperturaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      required: [true, 'El usuario de apertura es obligatorio']
    },
    montoInicial: {
      type: Number,
      required: [true, 'El monto inicial es obligatorio'],
      min: [0, 'El monto inicial debe ser mayor o igual a 0']
    },
    estado: {
      type: String,
      enum: {
        values: ['abierto', 'cerrado'],
        message: 'Estado de turno no válido ({VALUE}). Debe ser: abierto o cerrado'
      },
      default: 'abierto',
      required: true
    },
    fechaCierre: {
      type: Date
    },
    usuarioCierreId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario'
    },
    montoContadoEfectivo: {
      type: Number
    },
    montoCalculadoEfectivo: {
      type: Number
    },
    diferencia: {
      type: Number
    }
  },
  {
    timestamps: true
  }
);

// Índice único parcial para evitar dos turnos abiertos simultáneos en la misma sucursal
turnoSchema.index(
  { sucursalId: 1, estado: 1 },
  { unique: true, partialFilterExpression: { estado: 'abierto' } }
);

module.exports = mongoose.model('Turno', turnoSchema);
