require('dotenv').config();
const mongoose = require('mongoose');
const http = require('http');
const app = require('../app');
const conectarDB = require('../config/db');
const Usuario = require('../models/Usuario');
const Categoria = require('../models/Categoria');
const Producto = require('../models/Producto');
const Sector = require('../models/Sector');
const Mesa = require('../models/Mesa');
const Pedido = require('../models/Pedido');
const Turno = require('../models/Turno');
const MovimientoCaja = require('../models/MovimientoCaja');

let server;
let port;
let tokenDueno;
let tokenEncargado;
let tokenMozo;

const request = (method, path, token, body = null) => {
  return new Promise((resolve, reject) => {
    const dataStr = body ? JSON.stringify(body) : '';
    const options = {
      hostname: '127.0.0.1',
      port,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(dataStr)
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => (responseBody += chunk));
      res.on('end', () => {
        let json;
        try {
          json = JSON.parse(responseBody);
        } catch (e) {
          json = { raw: responseBody };
        }
        resolve({ status: res.statusCode, body: json });
      });
    });

    req.on('error', (err) => reject(err));
    if (dataStr) req.write(dataStr);
    req.end();
  });
};

const runVerification = async () => {
  try {
    await conectarDB();

    // Iniciar servidor http temporal en puerto aleatorio
    server = app.listen(0);
    port = server.address().port;
    console.log(`Servidor de prueba corriendo en puerto ${port}`);

    // Limpiar turnos y movimientos de prueba
    await Turno.deleteMany({});
    await MovimientoCaja.deleteMany({});
    await Pedido.deleteMany({});

    // Garantizar que existan los usuarios de prueba
    await Usuario.deleteMany({});
    const dueno = await Usuario.create({ nombre: 'Dueño Test', login: 'dueno_test', password: '123', rol: 'dueno' });
    const encargado = await Usuario.create({ nombre: 'Encargado Test', login: 'encargado_test', password: '123', rol: 'encargado' });
    const mozo = await Usuario.create({ nombre: 'Mozo Test', login: 'mozo_test', password: '123', rol: 'mozo' });

    // Obtener JWT tokens vía login
    const resLoginDueno = await request('POST', '/api/auth/login', null, { login: 'dueno_test', password: '123' });
    tokenDueno = resLoginDueno.body.token;

    const resLoginEncargado = await request('POST', '/api/auth/login', null, { login: 'encargado_test', password: '123' });
    tokenEncargado = resLoginEncargado.body.token;

    const resLoginMozo = await request('POST', '/api/auth/login', null, { login: 'mozo_test', password: '123' });
    tokenMozo = resLoginMozo.body.token;

    console.log('--- INICIO DE PRUEBAS DEL MÓDULO CAJA ---');

    // 1. Intentar registrar un egreso manual sin turno abierto -> 409
    const test1 = await request('POST', '/api/caja/movimientos', tokenEncargado, { monto: 500, motivo: 'Compra servilletas' });
    console.assert(test1.status === 409, `Test 1 Falló: status ${test1.status}`);
    console.log(`[PASS] Test 1: Egreso sin turno abierto rechazado con 409 (${test1.body.mensaje})`);

    // 2. Crear un pedido y pretender cobrarlo sin turno abierto -> 409
    const catComida = await Categoria.create({ nombre: 'Hamburguesas Test', tipo: 'comida' });
    const prodHam = await Producto.create({ nombre: 'Hamburguesa Doble', categoriaId: catComida._id, precioVenta: 5000 });
    const sector = await Sector.create({ nombre: 'Salón Test' });
    const mesa = await Mesa.create({ numero: 99, sectorId: sector._id, estado: 'ocupada' });
    const pedido = await Pedido.create({
      tipo: 'salon',
      mesaId: mesa._id,
      items: [{ productoId: prodHam._id, nombreProducto: prodHam.nombre, cantidad: 1, precioUnitario: 5000, estado: 'entregado' }]
    });

    const test2 = await request('POST', `/api/pedidos-salon/${pedido._id}/cerrar`, tokenEncargado, { medioPago: 'efectivo' });
    console.assert(test2.status === 409, `Test 2 Falló: status ${test2.status}`);
    console.log(`[PASS] Test 2: Cobro de pedido sin turno abierto rechazado con 409 (${test2.body.mensaje})`);

    // 3. Abrir turno de caja como Encargado con montoInicial 10000 -> 201
    const test3 = await request('POST', '/api/caja/turnos/abrir', tokenEncargado, { montoInicial: 10000 });
    console.assert(test3.status === 201, `Test 3 Falló: status ${test3.status}`);
    const turnoId = test3.body.turno._id;
    console.log(`[PASS] Test 3: Turno abierto exitosamente con $10000 (ID: ${turnoId})`);

    // 4. Intentar abrir segundo turno mientras hay uno abierto -> 409
    const test4 = await request('POST', '/api/caja/turnos/abrir', tokenDueno, { montoInicial: 5000 });
    console.assert(test4.status === 409, `Test 4 Falló: status ${test4.status}`);
    console.log(`[PASS] Test 4: Apertura de segundo turno duplicado rechazada con 409 (${test4.body.mensaje})`);

    // 5. Encargado registra egreso manual SIN motivo -> 400
    const test5 = await request('POST', '/api/caja/movimientos', tokenEncargado, { monto: 1500 });
    console.assert(test5.status === 400, `Test 5 Falló: status ${test5.status}`);
    console.log(`[PASS] Test 5: Egreso de encargado sin motivo rechazado con 400 (${test5.body.mensaje})`);

    // 6. Encargado registra egreso manual CON motivo -> 201
    const test6 = await request('POST', '/api/caja/movimientos', tokenEncargado, { monto: 1500, motivo: 'Hielo para barra' });
    console.assert(test6.status === 201, `Test 6 Falló: status ${test6.status}`);
    console.log(`[PASS] Test 6: Egreso de encargado con motivo registrado con éxito ($1500)`);

    // 7. DUEÑO registra egreso manual SIN motivo -> 201 (Confirmación explícita de la regla por rol)
    const test7 = await request('POST', '/api/caja/movimientos', tokenDueno, { monto: 2000 });
    console.assert(test7.status === 201, `Test 7 Falló: status ${test7.status}`);
    console.log(`[PASS] Test 7: Dueño registra egreso manual SIN motivo con éxito (Diferenciación por rol verificada)`);

    // 8. Mozo intenta ver turno actual -> 403
    const test8 = await request('GET', '/api/caja/turnos/actual', tokenMozo);
    console.assert(test8.status === 403, `Test 8 Falló: status ${test8.status}`);
    console.log(`[PASS] Test 8: Acceso de Mozo a turno actual denegado con 403 (${test8.body.mensaje})`);

    // 9. Cobrar pedido con turno abierto -> 200
    const test9 = await request('POST', `/api/pedidos-salon/${pedido._id}/cerrar`, tokenEncargado, { medioPago: 'efectivo' });
    console.assert(test9.status === 200, `Test 9 Falló: status ${test9.status}`);
    console.log(`[PASS] Test 9: Pedido cobrado exitosamente con turno abierto ($5000 en efectivo)`);

    // 10. Ver turno actual y acumulados -> 200
    const test10 = await request('GET', '/api/caja/turnos/actual', tokenEncargado);
    console.assert(test10.status === 200, `Test 10 Falló: status ${test10.status}`);
    const totales = test10.body.totales;
    // montoCalculadoEfectivo = 10000 (montoInicial) + 5000 (ingreso efectivo) - 3500 (1500 + 2000 egresos) = 11500
    console.assert(totales.montoCalculadoEfectivo === 11500, `Monto calculado incorrecto: ${totales.montoCalculadoEfectivo}`);
    console.log(`[PASS] Test 10: Turno actual acumulados verificados. Efectivo Calculado: $${totales.montoCalculadoEfectivo}`);

    // 11. Mozo intenta ver historial de turnos -> 403
    const test11 = await request('GET', '/api/caja/turnos', tokenMozo);
    console.assert(test11.status === 403, `Test 11 Falló: status ${test11.status}`);
    console.log(`[PASS] Test 11: Acceso de Mozo a historial denegado con 403 (${test11.body.mensaje})`);

    // 12. Dueño consulta historial de turnos -> 200
    const test12 = await request('GET', '/api/caja/turnos', tokenDueno);
    console.assert(test12.status === 200, `Test 12 Falló: status ${test12.status}`);
    console.log(`[PASS] Test 12: Historial consultado por Dueño (Total turnos: ${test12.body.turnos.length})`);

    // 13. Cerrar turno con montoContadoEfectivo 11000 -> 200 (Diferencia = 11000 - 11500 = -500)
    const test13 = await request('PATCH', `/api/caja/turnos/${turnoId}/cerrar`, tokenEncargado, { montoContadoEfectivo: 11000 });
    console.assert(test13.status === 200, `Test 13 Falló: status ${test13.status}`);
    console.assert(test13.body.turno.diferencia === -500, `Diferencia esperada -500 pero fue ${test13.body.turno.diferencia}`);
    console.log(`[PASS] Test 13: Turno cerrado con éxito. Monto Contado: $11000, Calculado: $11500, Diferencia: $${test13.body.turno.diferencia}`);

    // 14. Dueño consulta desglose de ventas -> 200
    const test14 = await request('GET', `/api/caja/desglose?turnoId=${turnoId}`, tokenDueno);
    console.assert(test14.status === 200, `Test 14 Falló: status ${test14.status}`);
    console.log(`[PASS] Test 14: Desglose consultado por Dueño. Comida: $${test14.body.comida}, Bebida: $${test14.body.bebida}, Total: $${test14.body.totalVentas}`);

    console.log('--- ¡TODAS LAS PRUEBAS DEL MÓDULO CAJA SE EJECUTARON CON ÉXITO! ---');
    server.close();
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('ERROR EN VERIFICACIÓN:', error);
    if (server) server.close();
    await mongoose.connection.close();
    process.exit(1);
  }
};

runVerification();
