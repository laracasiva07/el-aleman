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

const testPunto8 = async () => {
  try {
    await conectarDB();

    // Asegurar sincronización de índices en Mongoose (crea el partial unique index en MongoDB Atlas)
    await Turno.syncIndexes();

    const dueno = await Usuario.findOne({ login: 'dueno' });
    const producto = await Producto.findOne();

    if (!dueno || !producto) {
      console.error('Faltan datos de prueba');
      process.exit(1);
    }

    const tokenDueno = jwt.sign({ id: dueno._id, rol: dueno.rol }, process.env.JWT_SECRET);

    // Asegurar que no haya turno abierto al comenzar la prueba de apertura simultánea
    await Turno.deleteMany({ sucursalId: 'sucursal-1' });

    const server = app.listen(0, async () => {
      const port = server.address().port;
      const baseUrl = `http://localhost:${port}`;

      console.log(`Servidor de prueba Concurrencia Punto 8 corriendo en puerto ${port}`);
      let allPassed = true;

      // ==========================================
      // TEST 8.a: APERTURA SIMULTÁNEA DE TURNO DE CAJA
      // ==========================================
      console.log('\n--- Ejecutando Test 8.a: Apertura Simultánea de Turno (Promise.all) ---');
      const peticionesApertura = [1, 2, 3].map(() =>
        fetch(`${baseUrl}/api/caja/turnos/abrir`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tokenDueno}`
          },
          body: JSON.stringify({ montoInicial: 5000 })
        })
      );

      const respuestasApertura = await Promise.all(peticionesApertura);
      const resultadosApertura = await Promise.all(respuestasApertura.map((r) => r.json().then((data) => ({ status: r.status, data }))));

      let exitoContador = 0;
      let conflictoContador = 0;

      resultadosApertura.forEach((res, idx) => {
        console.log(`Respuesta Apertura #${idx + 1} -> Status: ${res.status}, Mensaje: "${res.data.mensaje}"`);
        if (res.status === 201) exitoContador++;
        if (res.status === 409 && res.data.mensaje.includes('Ya existe un turno abierto')) conflictoContador++;
      });

      if (exitoContador === 1 && conflictoContador === 2) {
        console.log('PASS 8.a: Exactamente 1 apertura tuvo éxito (201) y 2 fueron rechazadas con conflicto (409).');
      } else {
        console.error(`FAIL 8.a: Éxitos: ${exitoContador}, Conflictos: ${conflictoContador}`);
        allPassed = false;
      }

      // Validar en la base de datos física que solo existe 1 turno abierto
      const turnosAbiertosEnBD = await Turno.countDocuments({ sucursalId: 'sucursal-1', estado: 'abierto' });
      console.log(`Turnos abiertos registrados en MongoDB: ${turnosAbiertosEnBD}`);
      if (turnosAbiertosEnBD !== 1) {
        console.error(`FAIL 8.a: Se encontraron ${turnosAbiertosEnBD} turnos abiertos en MongoDB.`);
        allPassed = false;
      }

      // ==========================================
      // TEST 8.b: COBRO SIMULTÁNEO SOBRE EL MISMO PEDIDO
      // ==========================================
      console.log('\n--- Ejecutando Test 8.b: Cobro Simultáneo de Pedido (Promise.all) ---');

      // Crear pedido de prueba listo para cobrar
      const pedidoPrueba = await Pedido.create({
        tipo: 'takeaway',
        estadoTakeaway: 'entregado',
        estadoPago: 'pendiente',
        items: [
          {
            productoId: producto._id,
            nombreProducto: producto.nombre,
            precioUnitario: 3500,
            cantidad: 2,
            estado: 'entregado'
          }
        ]
      });

      const peticionesCobro = [1, 2, 3].map(() =>
        fetch(`${baseUrl}/api/pedidos-takeaway/${pedidoPrueba._id}/cerrar`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tokenDueno}`
          },
          body: JSON.stringify({ medioPago: 'efectivo' })
        })
      );

      const respuestasCobro = await Promise.all(peticionesCobro);
      const resultadosCobro = await Promise.all(respuestasCobro.map((r) => r.json().then((data) => ({ status: r.status, data }))));

      let cobroExitoCount = 0;
      let cobroRechazoCount = 0;

      resultadosCobro.forEach((res, idx) => {
        console.log(`Respuesta Cobro #${idx + 1} -> Status: ${res.status}, Mensaje: "${res.data.mensaje}"`);
        if (res.status === 200) cobroExitoCount++;
        if (res.status === 400 && res.data.mensaje.includes('ya fue cobrado')) cobroRechazoCount++;
      });

      if (cobroExitoCount === 1 && cobroRechazoCount === 2) {
        console.log('PASS 8.b: Exactamente 1 cobro tuvo éxito (200) y 2 peticiones simultáneas fueron prevenidas (400).');
      } else {
        console.error(`FAIL 8.b: Cobros exitosos: ${cobroExitoCount}, Cobros rechazados: ${cobroRechazoCount}`);
        allPassed = false;
      }

      // Validar en la base de datos que se haya creado exactamente UN MovimientoCaja para este pedido
      const movimientosCreados = await MovimientoCaja.countDocuments({ pedidoId: pedidoPrueba._id, tipo: 'ingreso' });
      console.log(`MovimientosCaja de ingreso generados en MongoDB: ${movimientosCreados}`);

      if (movimientosCreados === 1) {
        console.log('PASS 8.b: Se registró exactamente 1 MovimientoCaja en la base de datos.');
      } else {
        console.error(`FAIL 8.b: Se encontraron ${movimientosCreados} MovimientosCaja registrados para el pedido.`);
        allPassed = false;
      }

      // Limpieza
      await Pedido.findByIdAndDelete(pedidoPrueba._id);
      await MovimientoCaja.deleteMany({ pedidoId: pedidoPrueba._id });

      server.close();
      mongoose.disconnect();

      if (allPassed) {
        console.log('\n✅ VERIFICACIÓN PUNTO 8 EXITOSA: Concurrencia controlada, doble turno impedido por índice único parcial y cobro duplicado prevenido con transacciones de Mongoose.');
        process.exit(0);
      } else {
        console.error('\n❌ VERIFICACIÓN PUNTO 8 FALLÓ.');
        process.exit(1);
      }
    });

  } catch (error) {
    console.error('Error durante el test Punto 8:', error);
    process.exit(1);
  }
};

testPunto8();
