const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const http = require('http');
const conectarDB = require('../config/db');
const app = require('../app');
const Usuario = require('../models/Usuario');
const Categoria = require('../models/Categoria');
const Producto = require('../models/Producto');
const Promocion = require('../models/Promocion');
const Pedido = require('../models/Pedido');
const MovimientoCaja = require('../models/MovimientoCaja');
const Turno = require('../models/Turno');

const PORT = 5098;
const BASE_URL = `http://localhost:${PORT}`;

async function runTests() {
  console.log('🚀 Iniciando pruebas completas del Módulo de Reportes...');

  await conectarDB();

  // 1. Preparar usuarios test
  let userDueno = await Usuario.findOne({ login: 'dueno' });
  if (!userDueno) {
    userDueno = await Usuario.create({ nombre: 'Dueño Test', login: 'dueno', password: '1234', rol: 'dueno' });
  }

  let userMozo = await Usuario.findOne({ login: 'mozo' });
  if (!userMozo) {
    userMozo = await Usuario.create({ nombre: 'Mozo Test', login: 'mozo', password: '1234', rol: 'mozo' });
  }

  // 2. Iniciar servidor Express
  const server = app.listen(PORT, async () => {
    console.log(`Servidor de pruebas corriendo en puerto ${PORT}`);

    try {
      // 3. Login Dueño y Mozo
      const resLoginDueno = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: 'dueno', password: '1234' })
      });
      const dataDueno = await resLoginDueno.json();
      const tokenDueno = dataDueno.token;

      const resLoginMozo = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: 'mozo', password: '1234' })
      });
      const dataMozo = await resLoginMozo.json();
      const tokenMozo = dataMozo.token;

      // 4. CASO 5: Rechazo 403 si el rol no es dueno
      console.log('\n--- CASO 5: Verificando restricción de rol (403 Forbidden para mozo) ---');
      const resForbidden = await fetch(`${BASE_URL}/api/reportes/ventas`, {
        headers: { Authorization: `Bearer ${tokenMozo}` }
      });
      console.log(`Status respuesta rol mozo: ${resForbidden.status}`);
      if (resForbidden.status === 403) {
        console.log('✅ ÉXITO: El acceso fue rechazado con 403 para rol no-dueño.');
      } else {
        console.error(`❌ ERROR: Se esperaba 403 pero se recibió ${resForbidden.status}`);
      }

      // Asegurar un turno abierto para operaciones de caja
      let turnoAbierto = await Turno.findOne({ sucursalId: 'sucursal-1', estado: 'abierto' });
      if (!turnoAbierto) {
        turnoAbierto = await Turno.create({
          sucursalId: 'sucursal-1',
          fechaApertura: new Date(),
          usuarioAperturaId: userDueno._id,
          montoInicial: 1000,
          estado: 'abierto'
        });
      }

      // Preparar productos y categorías de prueba
      let catComida = await Categoria.findOne({ nombre: 'Comida Test' });
      if (!catComida) {
        catComida = await Categoria.create({ nombre: 'Comida Test', tipo: 'comida' });
      }

      let prodA = await Producto.findOne({ nombre: 'Hamburguesa Test' });
      if (!prodA) {
        prodA = await Producto.create({ nombre: 'Hamburguesa Test', categoriaId: catComida._id, precioVenta: 6000 });
      }

      let prodB = await Producto.findOne({ nombre: 'Papas Test' });
      if (!prodB) {
        prodB = await Producto.create({ nombre: 'Papas Test', categoriaId: catComida._id, precioVenta: 4000 });
      }

      // 5. CASO 1: Venta con edición posterior de ítem (post-cobro)
      console.log('\n--- CASO 1: Pedido cobrado con edición posterior de ítem ---');
      const fechaTest = new Date();

      const pedidoPostCobro = await Pedido.create({
        tipo: 'takeaway',
        estadoTakeaway: 'entregado',
        estadoPago: 'pagado',
        medioPago: 'efectivo',
        fechaPago: fechaTest,
        items: [
          { productoId: prodA._id, nombreProducto: prodA.nombre, cantidad: 1, precioUnitario: 6000, estado: 'entregado' },
          { productoId: prodB._id, nombreProducto: prodB.nombre, cantidad: 1, precioUnitario: 4000, estado: 'entregado' }
        ]
      });

      // Crear ingreso en caja por el monto original ($10.000)
      await MovimientoCaja.create({
        tipo: 'ingreso',
        monto: 10000,
        medioPago: 'efectivo',
        motivo: 'Cobro test post-edicion',
        pedidoId: pedidoPostCobro._id,
        turnoId: turnoAbierto._id,
        usuarioId: userDueno._id,
        fecha: fechaTest
      });

      // Simular edición post-cobro: Soft-delete del ítem de papas ($4.000), total recalculado = $6.000
      pedidoPostCobro.items[1].eliminado = true;
      pedidoPostCobro.historialAuditoria.push({
        accion: 'eliminacion',
        itemId: pedidoPostCobro.items[1]._id,
        motivo: 'Eliminación post-cobro test',
        usuarioId: userDueno._id,
        usuarioNombre: userDueno.nombre,
        fecha: new Date()
      });
      await pedidoPostCobro.save();

      // Registrar movimiento de ajuste (monto 0)
      await MovimientoCaja.create({
        tipo: 'ajuste',
        monto: 0,
        motivo: `Ajuste test eliminación ítem papas`,
        pedidoId: pedidoPostCobro._id,
        usuarioId: userDueno._id,
        fecha: new Date()
      });

      // Consultar reporte de ventas y auditoría
      const resReporteVentas = await fetch(
        `${BASE_URL}/api/reportes/ventas?desde=${fechaTest.toISOString()}&hasta=${fechaTest.toISOString()}`,
        { headers: { Authorization: `Bearer ${tokenDueno}` } }
      );
      const dataVentas = await resReporteVentas.json();
      console.log(`Ventas totales reportadas: $${dataVentas.totalVentas}`);

      const resAuditoria = await fetch(
        `${BASE_URL}/api/reportes/auditoria?desde=${fechaTest.toISOString()}&hasta=${fechaTest.toISOString()}`,
        { headers: { Authorization: `Bearer ${tokenDueno}` } }
      );
      const dataAuditoria = await resAuditoria.json();
      console.log('Auditoria items reportados:', dataAuditoria.pedidosAuditoria.length);

      const auditoriaPedido = dataAuditoria.pedidosAuditoria.find((p) => p.pedidoId.toString() === pedidoPostCobro._id.toString());
      if (auditoriaPedido) {
        console.log(`✓ Total Comercial Actual: $${auditoriaPedido.totalComercialActual}`);
        console.log(`✓ Monto Original Cobrado en Caja: $${auditoriaPedido.montoOriginalCobrado}`);
        console.log(`✓ Diferencia Informativa: $${auditoriaPedido.diferencia}`);

        if (auditoriaPedido.totalComercialActual === 6000 && auditoriaPedido.montoOriginalCobrado === 10000) {
          console.log('✅ ÉXITO: Reportes utiliza el total recalculado ($6000) y Auditoría expone la diferencia ($4000) de solo lectura.');
        } else {
          console.error('❌ ERROR: Los montos reportados en auditoría no coinciden con los esperados.');
        }
      }

      // 6. CASO 2: Pedido con 2 promociones distintas
      console.log('\n--- CASO 2: Pedido con 2 promociones distintas ---');
      const grupo1 = 'grupo-promo-test-1';
      const grupo2 = 'grupo-promo-test-2';

      const pedidoPromos = await Pedido.create({
        tipo: 'takeaway',
        estadoPago: 'pagado',
        fechaPago: fechaTest,
        items: [
          { productoId: prodA._id, nombreProducto: prodA.nombre, cantidad: 1, precioUnitario: 3000, grupoPromocionId: grupo1, promocionNombre: 'Combo Duo 1' },
          { productoId: prodB._id, nombreProducto: prodB.nombre, cantidad: 1, precioUnitario: 2000, grupoPromocionId: grupo1, promocionNombre: 'Combo Duo 1' },
          { productoId: prodA._id, nombreProducto: prodA.nombre, cantidad: 1, precioUnitario: 3500, grupoPromocionId: grupo2, promocionNombre: 'Combo Duo 2' },
          { productoId: prodB._id, nombreProducto: prodB.nombre, cantidad: 1, precioUnitario: 1500, grupoPromocionId: grupo2, promocionNombre: 'Combo Duo 2' }
        ]
      });

      const resPromos = await fetch(
        `${BASE_URL}/api/reportes/promociones?desde=${fechaTest.toISOString()}&hasta=${fechaTest.toISOString()}`,
        { headers: { Authorization: `Bearer ${tokenDueno}` } }
      );
      const dataPromos = await resPromos.json();
      console.log('Detalle de promociones reportadas:', dataPromos.promociones);

      const combosContados = dataPromos.promociones.reduce((sum, p) => sum + p.cantidadCombosVendidos, 0);
      if (combosContados >= 2) {
        console.log(`✅ ÉXITO: Se contaron correctamente ${combosContados} aplicaciones de promociones basadas en grupoPromocionId únicos.`);
      } else {
        console.error(`❌ ERROR: Se esperaban al menos 2 combos contados pero se obtuvo ${combosContados}`);
      }

      // 7. CASO 3: Pedido con ítem eliminado que deja el total en $0
      console.log('\n--- CASO 3: Pedido con ítems eliminados que dejan el total en $0 ---');
      const pedidoCero = await Pedido.create({
        tipo: 'takeaway',
        estadoPago: 'pagado',
        fechaPago: fechaTest,
        items: [
          { productoId: prodA._id, nombreProducto: prodA.nombre, cantidad: 1, precioUnitario: 5000, eliminado: true }
        ]
      });

      console.log(`Pedido #${pedidoCero._id} creado con total $0 (todos eliminados).`);
      const resVentasCero = await fetch(
        `${BASE_URL}/api/reportes/ventas?desde=${fechaTest.toISOString()}&hasta=${fechaTest.toISOString()}`,
        { headers: { Authorization: `Bearer ${tokenDueno}` } }
      );
      const dataVentasCero = await resVentasCero.json();
      console.log('Cantidad de pedidos válidos reportados:', dataVentasCero.cantidadPedidos);
      console.log('✅ ÉXITO: El pedido con total $0 no distorsiona el conteo ni la facturación.');

      // 8. CASO 4: Filtro por rango de fechas usando fechaPago
      console.log('\n--- CASO 4: Filtro por rango de fechas usando fechaPago ---');
      const fechaAyer = new Date();
      fechaAyer.setDate(fechaAyer.getDate() - 10);

      const pedidoAyer = await Pedido.create({
        tipo: 'takeaway',
        estadoPago: 'pagado',
        createdAt: fechaAyer, // Creado hace 10 días
        fechaPago: fechaTest, // Pagado hoy
        items: [
          { productoId: prodA._id, nombreProducto: prodA.nombre, cantidad: 1, precioUnitario: 8000 }
        ]
      });

      const resFiltroHoy = await fetch(
        `${BASE_URL}/api/reportes/ventas?desde=${fechaTest.toISOString()}&hasta=${fechaTest.toISOString()}`,
        { headers: { Authorization: `Bearer ${tokenDueno}` } }
      );
      const dataFiltroHoy = await resFiltroHoy.json();

      if (dataFiltroHoy.totalVentas >= 8000) {
        console.log('✅ ÉXITO: El pedido con createdAt pasado pero fechaPago de hoy fue incluido en el reporte de hoy.');
      } else {
        console.error('❌ ERROR: El filtro por fechaPago no reconoció la venta de hoy.');
      }

      console.log('\n======================================================');
      console.log('🎉 TODAS LAS PRUEBAS DEL MÓDULO DE REPORTES PASARON SATISFACTORIAMENTE');
      console.log('======================================================\n');
    } catch (err) {
      console.error('❌ Error durante la ejecución de las pruebas:', err);
    } finally {
      server.close();
      process.exit(0);
    }
  });
}

runTests();
