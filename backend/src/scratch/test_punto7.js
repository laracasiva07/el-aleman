require('dotenv').config();
const mongoose = require('mongoose');
const app = require('../app');
const conectarDB = require('../config/db');
const Usuario = require('../models/Usuario');
const Pedido = require('../models/Pedido');
const Producto = require('../models/Producto');
const Turno = require('../models/Turno');
const MovimientoCaja = require('../models/MovimientoCaja');
const jwt = require('jsonwebtoken');

const testPunto7 = async () => {
  try {
    await conectarDB();

    const dueno = await Usuario.findOne({ login: 'dueno' });
    const encargado = await Usuario.findOne({ login: 'encargado' });
    const producto = await Producto.findOne();

    if (!dueno || !encargado || !producto) {
      console.error('Faltan datos de prueba (dueno, encargado o producto)');
      process.exit(1);
    }

    const tokenDueno = jwt.sign({ id: dueno._id, rol: dueno.rol }, process.env.JWT_SECRET);
    const tokenEncargado = jwt.sign({ id: encargado._id, rol: encargado.rol }, process.env.JWT_SECRET);

    // Asegurar que exista un turno abierto
    let turno = await Turno.findOne({ sucursalId: 'sucursal-1', estado: 'abierto' });
    if (!turno) {
      turno = await Turno.create({
        sucursalId: 'sucursal-1',
        fechaApertura: new Date(),
        usuarioAperturaId: dueno._id,
        montoInicial: 10000,
        estado: 'abierto'
      });
    }

    // Crear un pedido de takeaway de prueba y marcarlo como pagado
    const pedido = await Pedido.create({
      tipo: 'takeaway',
      estadoTakeaway: 'entregado',
      estadoPago: 'pagado',
      medioPago: 'efectivo',
      fechaPago: new Date(),
      items: [
        {
          productoId: producto._id,
          nombreProducto: producto.nombre,
          precioUnitario: 5000,
          cantidad: 1,
          estado: 'entregado'
        }
      ]
    });

    const itemId = pedido.items[0]._id;

    const server = app.listen(0, async () => {
      const port = server.address().port;
      const baseUrl = `http://localhost:${port}`;

      console.log(`Servidor de prueba Punto 7 corriendo en puerto ${port}`);
      let allPassed = true;

      // 1. Intentar editar ítem con rol ENCARGADO en pedido pagado (Debe dar 403)
      const resEncargadoEdit = await fetch(`${baseUrl}/api/pedidos-takeaway/${pedido._id}/items/${itemId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenEncargado}`
        },
        body: JSON.stringify({ cantidad: 2, motivo: 'Error de tipeo' })
      });

      console.log(`Encargado editar ítem pagado -> Status: ${resEncargadoEdit.status}`);
      if (resEncargadoEdit.status === 403) {
        console.log('PASS: Encargado bloqueado correctamente con 403 para pedido pagado.');
      } else {
        console.error(`FAIL: Se esperaba 403 para encargado pero se recibió ${resEncargadoEdit.status}`);
        allPassed = false;
      }

      // 2. Editar ítem con rol DUEÑO (Aumentar cantidad de 1 a 2 -> Diferencia +$5000)
      const movCountBefore = await MovimientoCaja.countDocuments({ pedidoId: pedido._id });

      const resDuenoEdit = await fetch(`${baseUrl}/api/pedidos-takeaway/${pedido._id}/items/${itemId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenDueno}`
        },
        body: JSON.stringify({ cantidad: 2, motivo: 'Agregó producto extra post-cobro' })
      });

      console.log(`Dueño editar ítem pagado -> Status: ${resDuenoEdit.status}`);
      const movsPostEdit = await MovimientoCaja.find({ pedidoId: pedido._id }).sort({ createdAt: -1 });
      const ultimoMovEdit = movsPostEdit[0];

      if (resDuenoEdit.status === 200 && ultimoMovEdit && ultimoMovEdit.tipo === 'ingreso' && ultimoMovEdit.monto === 5000) {
        console.log(`PASS: Dueño editó ítem pagado y se generó un MovimientoCaja INGRESO por $${ultimoMovEdit.monto}.`);
      } else {
        console.error(`FAIL: No se generó el MovimientoCaja de ingreso esperado. Movimiento:`, ultimoMovEdit);
        allPassed = false;
      }

      // 3. Eliminar ítem con rol DUEÑO (Eliminar ítem pagado -> Debe generar EGRESO por el valor actual 2 * 5000 = $10000)
      const resDuenoDelete = await fetch(`${baseUrl}/api/pedidos-takeaway/${pedido._id}/items/${itemId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenDueno}`
        },
        body: JSON.stringify({ motivo: 'Devolución de ítem post-cobro' })
      });

      console.log(`Dueño eliminar ítem pagado -> Status: ${resDuenoDelete.status}`);
      const movsPostDelete = await MovimientoCaja.find({ pedidoId: pedido._id }).sort({ createdAt: -1 });
      const ultimoMovDelete = movsPostDelete[0];

      if (resDuenoDelete.status === 200 && ultimoMovDelete && ultimoMovDelete.tipo === 'egreso' && ultimoMovDelete.monto === 10000) {
        console.log(`PASS: Dueño eliminó ítem pagado y se generó un MovimientoCaja EGRESO por $${ultimoMovDelete.monto}.`);
      } else {
        console.error(`FAIL: No se generó el MovimientoCaja de egreso esperado. Movimiento:`, ultimoMovDelete);
        allPassed = false;
      }

      // Limpieza de prueba
      await Pedido.findByIdAndDelete(pedido._id);
      await MovimientoCaja.deleteMany({ pedidoId: pedido._id });

      server.close();
      mongoose.disconnect();

      if (allPassed) {
        console.log('\n✅ VERIFICACIÓN PUNTO 7 EXITOSA: Bloqueo de no-dueño y cálculo de diferencias reales en caja funcionando perfectamente.');
        process.exit(0);
      } else {
        console.error('\n❌ VERIFICACIÓN PUNTO 7 FALLÓ.');
        process.exit(1);
      }
    });

  } catch (error) {
    console.error('Error durante el test Punto 7:', error);
    process.exit(1);
  }
};

testPunto7();
