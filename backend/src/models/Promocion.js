const mongoose = require('mongoose');

const promocionProductoSchema = new mongoose.Schema(
  {
    productoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Producto',
      required: [true, 'El productoId es obligatorio']
    },
    cantidad: {
      type: Number,
      required: [true, 'La cantidad es obligatoria'],
      default: 1,
      min: [1, 'La cantidad debe ser al menos 1']
    }
  },
  { _id: false }
);

const promocionSchema = new mongoose.Schema(
  {
    sucursalId: {
      type: String,
      default: 'sucursal-1'
    },
    nombre: {
      type: String,
      required: [true, 'El nombre de la promoción es obligatorio'],
      trim: true
    },
    productos: {
      type: [promocionProductoSchema],
      required: [true, 'Los productos componentes son obligatorios'],
      validate: {
        validator: function (val) {
          return Array.isArray(val) && val.length > 0;
        },
        message: 'La promoción debe contener al menos un producto componente'
      }
    },
    precioFijo: {
      type: Number,
      required: [true, 'El precio fijo es obligatorio'],
      min: [0, 'El precio fijo debe ser mayor o igual a 0']
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

module.exports = mongoose.model('Promocion', promocionSchema);
