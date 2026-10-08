const mongoose = require('mongoose');

const categoriaSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: [true, 'El nombre de la categoría es obligatorio'],
      trim: true
    },
    tipo: {
      type: String,
      enum: {
        values: ['comida', 'bebida'],
        message: 'Tipo de categoría no válido ({VALUE}). Debe ser: comida o bebida'
      },
      required: [true, 'El tipo de categoría es obligatorio']
    }
  },
  {
    timestamps: true
  }
);

categoriaSchema.index(
  { nombre: 1 },
  { unique: true, collation: { locale: 'es', strength: 2 } }
);

module.exports = mongoose.model('Categoria', categoriaSchema);
