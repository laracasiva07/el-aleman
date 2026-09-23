const mongoose = require('mongoose');

const ingredienteSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: [true, 'El nombre del ingrediente es obligatorio'],
      trim: true
    },
    unidadMedida: {
      type: String,
      enum: {
        values: ['kg', 'g', 'l', 'ml', 'unidad'],
        message: 'Unidad de medida no válida ({VALUE}). Debe ser: kg, g, l, ml o unidad'
      },
      required: [true, 'La unidad de medida es obligatoria']
    },
    stockActual: {
      type: Number,
      required: [true, 'El stock actual es obligatorio'],
      default: 0
    },
    precioCompra: {
      type: Number,
      required: [true, 'El precio de compra es obligatorio']
    },
    cantidadComprada: {
      type: Number,
      required: [true, 'La cantidad comprada es obligatoria']
    },
    umbralCritico: {
      type: Number,
      required: [true, 'El umbral crítico es obligatorio']
    },
    umbralBajo: {
      type: Number,
      required: [true, 'El umbral bajo es obligatorio']
    },
    sucursalId: {
      type: String,
      default: 'sucursal-1'
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual para calcular el costo por unidad de medida (precioCompra / cantidadComprada)
ingredienteSchema.virtual('costoUnitario').get(function () {
  if (!this.cantidadComprada || this.cantidadComprada === 0) return 0;
  return this.precioCompra / this.cantidadComprada;
});

// Virtual para determinar el estado de stock ("critico", "bajo", "normal")
ingredienteSchema.virtual('estadoStock').get(function () {
  if (this.stockActual <= this.umbralCritico) {
    return 'critico';
  }
  if (this.stockActual <= this.umbralBajo) {
    return 'bajo';
  }
  return 'normal';
});

module.exports = mongoose.model('Ingrediente', ingredienteSchema);
