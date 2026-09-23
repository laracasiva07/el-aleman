const mongoose = require('mongoose');

const itemPedidoSchema = new mongoose.Schema(
  {
    productoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Producto',
      required: [true, 'El productoId es obligatorio']
    },
    nombreProducto: {
      type: String,
      required: [true, 'El nombre del producto es obligatorio']
    },
    cantidad: {
      type: Number,
      required: [true, 'La cantidad es obligatoria'],
      default: 1
    },
    precioUnitario: {
      type: Number,
      required: [true, 'El precio unitario es obligatorio']
    },
    aclaraciones: {
      type: String,
      default: ''
    },
    enviadoComanda: {
      type: Boolean,
      default: false
    },
    estado: {
      type: String,
      enum: {
        values: ['pendiente', 'en_preparacion', 'listo', 'entregado'],
        message: 'Estado del ítem no válido ({VALUE})'
      },
      default: 'pendiente'
    },
    eliminado: {
      type: Boolean,
      default: false
    },
    grupoPromocionId: {
      type: String,
      default: null
    },
    promocionNombre: {
      type: String,
      default: ''
    }
  }
);

const auditoriaItemSchema = new mongoose.Schema(
  {
    accion: {
      type: String,
      enum: ['edicion', 'eliminacion'],
      required: true
    },
    itemId: {
      type: mongoose.Schema.Types.ObjectId
    },
    motivo: {
      type: String,
      default: ''
    },
    usuarioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Usuario',
      required: true
    },
    usuarioNombre: {
      type: String,
      required: true
    },
    fecha: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

const pedidoSchema = new mongoose.Schema(
  {
    tipo: {
      type: String,
      enum: {
        values: ['salon', 'delivery', 'takeaway'],
        message: 'Tipo de pedido no válido ({VALUE}). Debe ser: salon, delivery o takeaway'
      },
      required: [true, 'El tipo de pedido es obligatorio']
    },
    mesaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Mesa'
    },
    clienteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cliente'
    },
    direccionEntrega: {
      type: String,
      default: ''
    },
    estadoDelivery: {
      type: String,
      enum: {
        values: ['cocina', 'en_camino', 'entregado'],
        message: 'Estado de delivery no válido ({VALUE})'
      },
      default: 'cocina'
    },
    estadoTakeaway: {
      type: String,
      enum: {
        values: ['cocina', 'listo', 'entregado'],
        message: 'Estado de takeaway no válido ({VALUE})'
      },
      default: 'cocina'
    },
    items: [itemPedidoSchema],
    medioPago: {
      type: String,
      enum: ['efectivo', 'debito_credito', 'transferencia']
    },
    estadoPago: {
      type: String,
      enum: ['pendiente', 'pagado'],
      default: 'pendiente'
    },
    fechaPago: {
      type: Date
    },
    historialAuditoria: [auditoriaItemSchema],
    horarioEstimado: {
      type: String,
      default: ''
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

pedidoSchema.virtual('estado').get(function () {
  if (this.tipo === 'delivery') {
    return this.estadoDelivery || 'cocina';
  }
  if (this.tipo === 'takeaway') {
    return this.estadoTakeaway || 'cocina';
  }
  const itemsActivos = (this.items || []).filter((it) => !it.eliminado);
  if (itemsActivos.length === 0) return 'pendiente';
  if (itemsActivos.every((it) => it.estado === 'entregado')) return 'entregado';
  if (itemsActivos.every((it) => it.estado === 'listo' || it.estado === 'entregado')) return 'listo';
  if (itemsActivos.every((it) => it.estado === 'pendiente')) return 'pendiente';
  return 'en_preparacion';
});

pedidoSchema.virtual('total').get(function () {
  const itemsActivos = (this.items || []).filter((it) => !it.eliminado);
  return itemsActivos.reduce((sum, it) => sum + (it.cantidad || 1) * (it.precioUnitario || 0), 0);
});

module.exports = mongoose.model('Pedido', pedidoSchema);
