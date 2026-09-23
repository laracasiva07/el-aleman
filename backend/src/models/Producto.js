const mongoose = require('mongoose');

const recetaItemSchema = new mongoose.Schema(
  {
    ingredienteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Ingrediente',
      required: [true, 'El ingrediente es obligatorio en la receta']
    },
    cantidad: {
      type: Number,
      required: [true, 'La cantidad de ingrediente es obligatoria']
    }
  },
  { _id: false }
);

const productoSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: [true, 'El nombre del producto es obligatorio'],
      trim: true
    },
    categoriaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Categoria',
      required: [true, 'La categoría es obligatoria']
    },
    precioVenta: {
      type: Number,
      required: [true, 'El precio de venta es obligatorio']
    },
    disponible: {
      type: Boolean,
      default: true
    },
    receta: [recetaItemSchema],
    sucursalId: {
      type: String,
      default: 'sucursal-1'
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Producto', productoSchema);
