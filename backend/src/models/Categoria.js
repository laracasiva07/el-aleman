const mongoose = require('mongoose');

const categoriaSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: [true, 'El nombre de la categoría es obligatorio'],
      unique: true,
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

module.exports = mongoose.model('Categoria', categoriaSchema);
