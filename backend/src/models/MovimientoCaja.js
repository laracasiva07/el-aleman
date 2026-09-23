const mongoose = require('mongoose');

const movimientoCajaSchema = new mongoose.Schema(
  {
    tipo: {
      type: String,
      enum: {
        values: ['ingreso', 'egreso', 'ajuste'],
        message: 'Tipo de movimiento no válido ({VALUE}). Debe ser: ingreso, egreso o ajuste'
      },
      required: [true, 'El tipo de movimiento es obligatorio']
    },
    monto: {
      type: Number,
      required: [true, 'El monto es obligatorio']
    },
    medioPago: {
      type: String,
      enum: ['efectivo', 'debito_credito', 'transferencia']
    },
    motivo: {
      type: String,
      default: ''
    },
    pedidoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Pedido'
    },
    turnoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Turno'
    },
    categoria: {
      type: String,
      enum: {
        values: ['comida', 'bebida'],
        message: 'Categoría no válida ({VALUE}). Debe ser: comida o bebida'
      }
    },
    fecha: {
      type: Date,
      default: Date.now
    },
    usuarioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      required: [true, 'El usuario es obligatorio']
    },
    sucursalId: {
      type: String,
      default: 'sucursal-1'
    },
    esGastoDiario: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('MovimientoCaja', movimientoCajaSchema);
