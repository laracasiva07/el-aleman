const mongoose = require('mongoose');
const Producto = require('../models/Producto');
const Promocion = require('../models/Promocion');
const Ingrediente = require('../models/Ingrediente');

/**
 * Descuenta el stock de los ingredientes de la receta de un producto
 * @param {ObjectId|String} productoId
 * @param {Number} cantidadVendida
 */
const descontarStockProducto = async (productoId, cantidadVendida) => {
  if (!productoId || !cantidadVendida || cantidadVendida <= 0) return;

  const producto = await Producto.findById(productoId);
  if (!producto || !producto.receta || producto.receta.length === 0) return;

  for (const itemReceta of producto.receta) {
    if (itemReceta.ingredienteId && itemReceta.cantidad > 0) {
      const ingrediente = await Ingrediente.findById(itemReceta.ingredienteId);
      if (ingrediente) {
        const descuento = itemReceta.cantidad * cantidadVendida;
        ingrediente.stockActual = Math.max(0, (ingrediente.stockActual || 0) - descuento);
        await ingrediente.save();
      }
    }
  }
};

/**
 * Procesa un arreglo de ítems (productos individuales o promociones/combos)
 * @param {Array} itemsInput Arreglo de { productoId?, promocionId?, cantidad?, aclaraciones? }
 * @param {Object} opcionesDefaults { enviadoComanda: Boolean, estado: String }
 * @returns {Object} { status: Number, mensaje?: String, itemsProcesados: Array }
 */
const procesarItemsPedido = async (itemsInput, opcionesDefaults = {}) => {
  if (!itemsInput || !Array.isArray(itemsInput) || itemsInput.length === 0) {
    return { status: 400, mensaje: 'Se requiere al menos un ítem o promoción para agregar' };
  }

  const { enviadoComanda = false, estado = 'pendiente' } = opcionesDefaults;
  const itemsResultantes = [];

  for (const item of itemsInput) {
    // CASO A: Es una Promoción / Combo
    if (item.promocionId) {
      const promo = await Promocion.findById(item.promocionId);
      if (!promo) {
        return { status: 404, mensaje: `La promoción con ID ${item.promocionId} no existe` };
      }

      if (!promo.activo) {
        return { status: 400, mensaje: `La promoción '${promo.nombre}' no se encuentra activa` };
      }

      const cantidadCombos = item.cantidad && item.cantidad > 0 ? Number(item.cantidad) : 1;
      const grupoPromocionId = new mongoose.Types.ObjectId().toString();

      // Cargar productos componentes y calcular el costo normal total de 1 combo
      let sumaNormalUnCombo = 0;
      const componentesDetalle = [];

      for (const comp of promo.productos) {
        const prodComponente = await Producto.findById(comp.productoId);
        if (!prodComponente) {
          return { status: 404, mensaje: `El producto componente con ID ${comp.productoId} de la promoción '${promo.nombre}' no existe` };
        }
        const cantComponente = comp.cantidad || 1;
        const subtotalNormalComponente = cantComponente * (prodComponente.precioVenta || 0);
        sumaNormalUnCombo += subtotalNormalComponente;

        componentesDetalle.push({
          producto: prodComponente,
          cantidadEnCombo: cantComponente,
          subtotalNormalComponente
        });
      }

      // Generar ItemPedido para cada producto componente con prorrateo de precioFijo
      for (const compDet of componentesDetalle) {
        let precioUnitarioProrrateado = 0;

        if (sumaNormalUnCombo > 0) {
          const proporcion = compDet.subtotalNormalComponente / sumaNormalUnCombo;
          const precioTotalPromoComponente = promo.precioFijo * proporcion;
          precioUnitarioProrrateado = Number((precioTotalPromoComponente / compDet.cantidadEnCombo).toFixed(2));
        } else {
          // Si el total normal era 0, repartir equitativamente
          const parteIgual = promo.precioFijo / componentesDetalle.length;
          precioUnitarioProrrateado = Number((parteIgual / compDet.cantidadEnCombo).toFixed(2));
        }

        const cantidadTotalItem = compDet.cantidadEnCombo * cantidadCombos;

        // Descontar stock por ingrediente de cada componente
        await descontarStockProducto(compDet.producto._id, cantidadTotalItem);

        itemsResultantes.push({
          productoId: compDet.producto._id,
          nombreProducto: compDet.producto.nombre,
          cantidad: cantidadTotalItem,
          precioUnitario: precioUnitarioProrrateado,
          aclaraciones: item.aclaraciones ? item.aclaraciones.trim() : '',
          grupoPromocionId,
          promocionNombre: promo.nombre,
          enviadoComanda,
          estado,
          eliminado: false
        });
      }
    }
    // CASO B: Es un Producto individual normal
    else if (item.productoId) {
      const producto = await Producto.findById(item.productoId);
      if (!producto) {
        return { status: 404, mensaje: `El producto con ID ${item.productoId} no existe` };
      }

      const cantidadItem = item.cantidad && item.cantidad > 0 ? Number(item.cantidad) : 1;

      // Descontar stock por ingrediente
      await descontarStockProducto(producto._id, cantidadItem);

      itemsResultantes.push({
        productoId: producto._id,
        nombreProducto: producto.nombre,
        cantidad: cantidadItem,
        precioUnitario: producto.precioVenta,
        aclaraciones: item.aclaraciones ? item.aclaraciones.trim() : '',
        grupoPromocionId: null,
        promocionNombre: '',
        enviadoComanda,
        estado,
        eliminado: false
      });
    } else {
      return { status: 400, mensaje: 'Cada ítem debe incluir un productoId o un promocionId' };
    }
  }

  return { status: 200, itemsProcesados: itemsResultantes };
};

module.exports = {
  descontarStockProducto,
  procesarItemsPedido
};
