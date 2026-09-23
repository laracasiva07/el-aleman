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
let tokenEncargado;

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

    req.on('error', reject);
    if (dataStr) req.write(dataStr);
    req.end();
  });
};

async function runTests() {
  try {
    console.log('🚀 Iniciando pruebas de Medios de Pago (Delivery, TakeAway, Salón)...');
    await conectarDB();

    server = http.createServer(app);
    await new Promise((resolve) => {
      server.listen(0, () => {
        port = server.address().port;
        console.log(`Servidor de pruebas corriendo en puerto ${port}`);
        resolve();
      });
    });

    // Garantizar usuario encargado de prueba
    let encargado = await Usuario.findOne({ login: 'encargado_test_medios' });
    if (!encargado) {
      encargado = await Usuario.create({
        nombre: 'Encargado Test Medios',
        login: 'encargado_test_medios',
        password: '123',
        rol: 'encargado'
      });
    }

    // Login Encargado
    const loginRes = await request('POST', '/api/auth/login', null, {
      login: 'encargado_test_medios',
      password: '123'
    });
    if (loginRes.status !== 200 || !loginRes.body.token) {
      throw new Error(`Falló login encargado: ${JSON.stringify(loginRes.body)}`);
    }
    tokenEncargado = loginRes.body.token;

    // Asegurar turno de caja abierto
    let turno = await Turno.findOne({ estado: 'abierto' });
    if (!turno) {
      const openRes = await request('POST', '/api/caja/abrir', tokenEncargado, {
        montoInicial: 1000,
        observaciones: 'Turno test medios pago'
      });
      console.log('Turno de caja abierto:', openRes.status);
      turno = await Turno.findOne({ estado: 'abierto' });
    }

    // Obtener un producto activo o crear uno de prueba
    let prod = await Producto.findOne({ activo: true });
    if (!prod) {
      let cat = await Categoria.findOne();
      if (!cat) {
        cat = await Categoria.create({ nombre: 'Test Cat' });
      }
      prod = await Producto.create({
        nombre: 'Hamburguesa Test',
        precioVenta: 1500,
        categoriaId: cat._id,
        activo: true
      });
    }

    const medios = ['efectivo', 'debito_credito', 'transferencia'];

    // 1. PROBAR DELIVERY
    console.log('\n--- PRUEBAS EN DELIVERY ---');
    for (const medio of medios) {
      const ped = await Pedido.create({
        tipo: 'delivery',
        clienteNombre: 'Cliente Test Delivery',
        direccionEntrega: 'Av. Siempre Viva 123',
        estadoDelivery: 'entregado',
        estadoPago: 'pendiente',
        items: [{
          productoId: prod._id,
          nombreProducto: prod.nombre,
          cantidad: 1,
          precioUnitario: prod.precioVenta,
          subtotal: prod.precioVenta
        }],
        subtotal: prod.precioVenta,
        total: prod.precioVenta,
        mozoId: (await Usuario.findOne({ rol: 'encargado' }))._id
      });

      const resCobro = await request('POST', `/api/pedidos-delivery/${ped._id}/cerrar`, tokenEncargado, {
        medioPago: medio
      });

      console.log(`Cobro Delivery con medio '${medio}': Status ${resCobro.status}`);
      if (resCobro.status !== 200) {
        throw new Error(`Error en cobro delivery ${medio}: ${JSON.stringify(resCobro.body)}`);
      }
      if (resCobro.body.medioPago !== medio) {
        throw new Error(`Medio de pago no coincide en respuesta delivery: esperado '${medio}', obtenido '${resCobro.body.medioPago}'`);
      }
      const pedDB = await Pedido.findById(ped._id);
      if (pedDB.medioPago !== medio) {
        throw new Error(`Medio de pago no coincide en DB Delivery: esperado '${medio}', obtenido '${pedDB.medioPago}'`);
      }
      console.log(`✅ Éxito: Delivery cobrado correctamente con ${medio}`);
    }

    // 2. PROBAR TAKE AWAY
    console.log('\n--- PRUEBAS EN TAKE AWAY ---');
    for (const medio of medios) {
      const ped = await Pedido.create({
        tipo: 'takeaway',
        clienteNombre: 'Cliente Test TakeAway',
        estadoTakeaway: 'entregado',
        estadoPago: 'pendiente',
        items: [{
          productoId: prod._id,
          nombreProducto: prod.nombre,
          cantidad: 1,
          precioUnitario: prod.precioVenta,
          subtotal: prod.precioVenta
        }],
        subtotal: prod.precioVenta,
        total: prod.precioVenta,
        mozoId: (await Usuario.findOne({ rol: 'encargado' }))._id
      });

      const resCobro = await request('POST', `/api/pedidos-takeaway/${ped._id}/cerrar`, tokenEncargado, {
        medioPago: medio
      });

      console.log(`Cobro Take Away con medio '${medio}': Status ${resCobro.status}`);
      if (resCobro.status !== 200) {
        throw new Error(`Error en cobro takeaway ${medio}: ${JSON.stringify(resCobro.body)}`);
      }
      if (resCobro.body.medioPago !== medio) {
        throw new Error(`Medio de pago no coincide en respuesta takeaway: esperado '${medio}', obtenido '${resCobro.body.medioPago}'`);
      }
      const pedDB = await Pedido.findById(ped._id);
      if (pedDB.medioPago !== medio) {
        throw new Error(`Medio de pago no coincide en DB TakeAway: esperado '${medio}', obtenido '${pedDB.medioPago}'`);
      }
      console.log(`✅ Éxito: Take Away cobrado correctamente con ${medio}`);
    }

    // 3. PROBAR SALÓN
    console.log('\n--- PRUEBAS EN SALÓN ---');
    let mesa = await Mesa.findOne({});
    if (!mesa) {
      let sec = await Sector.findOne({});
      if (!sec) {
        sec = await Sector.create({ nombre: 'Salon Principal' });
      }
      mesa = await Mesa.create({ numero: 999, sectorId: sec._id, capacidad: 4, estado: 'libre' });
    }

    for (const medio of medios) {
      const ped = await Pedido.create({
        tipo: 'salon',
        mesaId: mesa._id,
        estado: 'entregado',
        estadoPago: 'pendiente',
        items: [{
          productoId: prod._id,
          nombreProducto: prod.nombre,
          cantidad: 1,
          precioUnitario: prod.precioVenta,
          subtotal: prod.precioVenta,
          estadoCocina: 'entregado'
        }],
        subtotal: prod.precioVenta,
        total: prod.precioVenta,
        mozoId: (await Usuario.findOne({ rol: 'encargado' }))._id
      });

      mesa.estado = 'ocupada';
      mesa.pedidoActivoId = ped._id;
      await mesa.save();

      const resCobro = await request('POST', `/api/pedidos-salon/${ped._id}/cerrar`, tokenEncargado, {
        medioPago: medio
      });

      console.log(`Cobro Salón con medio '${medio}': Status ${resCobro.status}`);
      if (resCobro.status !== 200) {
        throw new Error(`Error en cobro salón ${medio}: ${JSON.stringify(resCobro.body)}`);
      }
      if (resCobro.body.medioPago !== medio) {
        throw new Error(`Medio de pago no coincide en respuesta salón: esperado '${medio}', obtenido '${resCobro.body.medioPago}'`);
      }
      const pedDB = await Pedido.findById(ped._id);
      if (pedDB.medioPago !== medio) {
        throw new Error(`Medio de pago no coincide en DB Salón: esperado '${medio}', obtenido '${pedDB.medioPago}'`);
      }
      console.log(`✅ Éxito: Salón cobrado correctamente con ${medio}`);
    }

    console.log('\n======================================================');
    console.log('🎉 TODAS LAS PRUEBAS DE MEDIOS DE PAGO PASARON CORRECTAMENTE');
    console.log('======================================================');

  } catch (err) {
    console.error('❌ ERROR EN PRUEBAS:', err);
    process.exitCode = 1;
  } finally {
    if (server) server.close();
    await mongoose.connection.close();
    process.exit();
  }
}

runTests();
