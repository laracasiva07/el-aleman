require('dotenv').config();
const conectarDB = require('../config/db');
const app = require('../app');
const Usuario = require('../models/Usuario');
const Categoria = require('../models/Categoria');
const Ingrediente = require('../models/Ingrediente');
const Producto = require('../models/Producto');
const Promocion = require('../models/Promocion');
const Mesa = require('../models/Mesa');
const Pedido = require('../models/Pedido');

const PORT = 5098;
const BASE_URL = `http://localhost:${PORT}`;

async function runTests() {
  console.log('🚀 Iniciando pruebas de integración del módulo Promociones...');

  await conectarDB();

  // Asegurar datos iniciales mínimos
  let userDueno = await Usuario.findOne({ login: 'dueno' });
  if (!userDueno) {
    userDueno = await Usuario.create({ nombre: 'Dueño Test', login: 'dueno', password: '1234', rol: 'dueno' });
  }

  let userEncargado = await Usuario.findOne({ login: 'encargado' });
  if (!userEncargado) {
    userEncargado = await Usuario.create({ nombre: 'Encargado Test', login: 'encargado', password: '1234', rol: 'encargado' });
  }

  let userMozo = await Usuario.findOne({ login: 'mozo1' });
  if (!userMozo) {
    userMozo = await Usuario.create({ nombre: 'Mozo Test', login: 'mozo1', password: '1234', rol: 'mozo' });
  }

  // Cargar o crear productos de prueba
  let catPizzas = await Categoria.findOne({ nombre: 'Pizzas' });
  if (!catPizzas) catPizzas = await Categoria.create({ nombre: 'Pizzas', tipo: 'comida' });

  let catBebidas = await Categoria.findOne({ nombre: 'Bebidas' });
  if (!catBebidas) catBebidas = await Categoria.create({ nombre: 'Bebidas', tipo: 'bebida' });

  let ingHarina = await Ingrediente.findOne({ nombre: 'Harina 000' });
  if (!ingHarina) ingHarina = await Ingrediente.create({ nombre: 'Harina 000', unidadMedida: 'kg', stockActual: 100, umbralCritico: 5, umbralBajo: 15 });

  let ingCerveza = await Ingrediente.findOne({ nombre: 'Cerveza IPA 500ml' });
  if (!ingCerveza) ingCerveza = await Ingrediente.create({ nombre: 'Cerveza IPA 500ml', unidadMedida: 'unidad', stockActual: 100, umbralCritico: 5, umbralBajo: 10 });

  let prodPizza = await Producto.findOne({ nombre: 'Pizza Muzzarella Grande' });
  if (!prodPizza) {
    prodPizza = await Producto.create({
      nombre: 'Pizza Muzzarella Grande',
      categoriaId: catPizzas._id,
      precioVenta: 8500,
      disponible: true,
      receta: [{ ingredienteId: ingHarina._id, cantidad: 0.25 }]
    });
  }

  let prodBirra = await Producto.findOne({ nombre: 'Cerveza IPA 500ml' });
  if (!prodBirra) {
    prodBirra = await Producto.create({
      nombre: 'Cerveza IPA 500ml',
      categoriaId: catBebidas._id,
      precioVenta: 3500,
      disponible: true,
      receta: [{ ingredienteId: ingCerveza._id, cantidad: 1 }]
    });
  }

  let mesa1 = await Mesa.findOne({ numero: 1 });
  if (!mesa1) {
    mesa1 = await Mesa.create({ numero: 1, posicionX: 10, posicionY: 10, estado: 'libre' });
  }

  const stockHarinaInicial = ingHarina.stockActual;
  const stockCervezaInicial = ingCerveza.stockActual;

  const server = app.listen(PORT, async () => {
    console.log(`Servidor de prueba corriendo en puerto ${PORT}`);

    try {
      // 1. Logins
      console.log('\n--- 1. Probando Login ---');
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
        body: JSON.stringify({ login: 'mozo1', password: '1234' })
      });
      const dataMozo = await resLoginMozo.json();
      const tokenMozo = dataMozo.token;

      console.log('✓ Login dueño y mozo exitosos.');

      // 2. Control de Acceso por Rol al Catálogo de Promociones
      console.log('\n--- 2. Verificando seguridad de catálogo de promociones (403 para mozo) ---');
      const resMozoCatalog = await fetch(`${BASE_URL}/api/promociones`, {
        headers: { Authorization: `Bearer ${tokenMozo}` }
      });
      if (resMozoCatalog.status !== 403) {
        throw new Error(`Esperado 403 para mozo en /api/promociones, recibido: ${resMozoCatalog.status}`);
      }
      console.log('✓ Mozo bloqueado correctamente del catálogo de promociones (403).');

      // Limpiar promociones de prueba anteriores
      await Promocion.deleteMany({ sucursalId: 'sucursal-1' });

      // 3. Crear 2 Promociones distintas (Dueño)
      console.log('\n--- 3. Creando Promociones ---');
      // Promo 1: Combo Pizza + Birra (Normal $12,000 -> Precio Fijo $9,600)
      const resPromo1 = await fetch(`${BASE_URL}/api/promociones`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenDueno}`
        },
        body: JSON.stringify({
          nombre: 'Combo Pizza + Birra',
          productos: [
            { productoId: prodPizza._id, cantidad: 1 },
            { productoId: prodBirra._id, cantidad: 1 }
          ],
          precioFijo: 9600
        })
      });
      const dataPromo1 = await resPromo1.json();
      const promo1 = dataPromo1.promocion;
      console.log('✓ Promo 1 creada:', promo1.nombre, `($${promo1.precioFijo})`);

      // Promo 2: Super Combo 2 Pizzas + 2 Birras (Normal $24,000 -> Precio Fijo $18,000)
      const resPromo2 = await fetch(`${BASE_URL}/api/promociones`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenDueno}`
        },
        body: JSON.stringify({
          nombre: 'Super Combo 2 Pizzas + 2 Birras',
          productos: [
            { productoId: prodPizza._id, cantidad: 2 },
            { productoId: prodBirra._id, cantidad: 2 }
          ],
          precioFijo: 18000
        })
      });
      const dataPromo2 = await resPromo2.json();
      const promo2 = dataPromo2.promocion;
      console.log('✓ Promo 2 creada:', promo2.nombre, `($${promo2.precioFijo})`);

      // 4. Probar deshabilitar y reactivar promoción
      console.log('\n--- 4. Probando deshabilitar y reactivar promoción ---');
      await fetch(`${BASE_URL}/api/promociones/${promo1._id}/activo`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenDueno}`
        },
        body: JSON.stringify({ activo: false })
      });

      // Crear pedido salón para intentar agregar promo inactiva
      const resAbrirMesa = await fetch(`${BASE_URL}/api/pedidos-salon`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenMozo}`
        },
        body: JSON.stringify({ mesaId: mesa1._id })
      });
      const dataMesa = await resAbrirMesa.json();
      const pedidoSalonId = dataMesa.pedido._id;

      // Intentar agregar promo inactiva
      const resInactiva = await fetch(`${BASE_URL}/api/pedidos-salon/${pedidoSalonId}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenMozo}`
        },
        body: JSON.stringify({
          items: [{ promocionId: promo1._id, cantidad: 1 }]
        })
      });
      if (resInactiva.status !== 400) {
        throw new Error(`Esperado HTTP 400 para promo inactiva, recibido: ${resInactiva.status}`);
      }
      console.log('✓ Se rechazó correctamente la adición de una promoción inactiva (400).');

      // Reactivar promo 1
      await fetch(`${BASE_URL}/api/promociones/${promo1._id}/activo`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenDueno}`
        },
        body: JSON.stringify({ activo: true })
      });
      console.log('✓ Promo 1 reactivada correctamente.');

      // 5. Aplicar DOS Promociones Distintas en el mismo pedido de Salón (Ajuste Solicitado #2)
      console.log('\n--- 5. Aplicando DOS promociones distintas al mismo pedido de Salón ---');
      const resAgregarDosPromos = await fetch(`${BASE_URL}/api/pedidos-salon/${pedidoSalonId}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenMozo}`
        },
        body: JSON.stringify({
          items: [
            { promocionId: promo1._id, cantidad: 1 },
            { promocionId: promo2._id, cantidad: 1 }
          ]
        })
      });
      const dataAgregarDos = await resAgregarDosPromos.json();
      const itemsPedidoSalon = dataAgregarDos.pedido.items;

      console.log(`Ítems resultantes explotados en el pedido (${itemsPedidoSalon.length} ítems):`);
      itemsPedidoSalon.forEach((it) => {
        console.log(`- ${it.nombreProducto} x${it.cantidad} | P.Unit: $${it.precioUnitario} | Promo: "${it.promocionNombre}" | GrupoId: ${it.grupoPromocionId}`);
      });

      // Verificaciones:
      // Deberían generarse 4 ítems explotados (2 de Promo 1 + 2 de Promo 2)
      if (itemsPedidoSalon.length !== 4) {
        throw new Error(`Esperados 4 ítems en pedido salón, recibidos: ${itemsPedidoSalon.length}`);
      }

      const itemsPromo1 = itemsPedidoSalon.filter((it) => it.promocionNombre === 'Combo Pizza + Birra');
      const itemsPromo2 = itemsPedidoSalon.filter((it) => it.promocionNombre === 'Super Combo 2 Pizzas + 2 Birras');

      if (itemsPromo1.length !== 2 || itemsPromo2.length !== 2) {
        throw new Error('Fallo al clasificar los ítems por promocionNombre');
      }

      // Verificar que cada promo tiene su propio grupoPromocionId distinto
      const grupoId1 = itemsPromo1[0].grupoPromocionId;
      const grupoId2 = itemsPromo2[0].grupoPromocionId;

      if (!grupoId1 || !grupoId2 || grupoId1 === grupoId2) {
        throw new Error(`Los grupoPromocionId deben ser distintos entre promociones distintas. Recibidos: ${grupoId1} y ${grupoId2}`);
      }
      console.log('✓ Confirmado: Cada promoción generó su propio grupoPromocionId único e independiente.');

      // Verificar prorrateo exacto
      const totalProrrateadoPromo1 = itemsPromo1.reduce((sum, it) => sum + (it.cantidad * it.precioUnitario), 0);
      const totalProrrateadoPromo2 = itemsPromo2.reduce((sum, it) => sum + (it.cantidad * it.precioUnitario), 0);

      console.log(`- Subtotal Promo 1 ("${promo1.nombre}") prorrateado: $${totalProrrateadoPromo1} (Esperado $9,600)`);
      console.log(`- Subtotal Promo 2 ("${promo2.nombre}") prorrateado: $${totalProrrateadoPromo2} (Esperado $18,000)`);

      if (Math.abs(totalProrrateadoPromo1 - 9600) > 1) {
        throw new Error(`Prorrateo incorrecto para Promo 1. Esperado 9600, recibido: ${totalProrrateadoPromo1}`);
      }
      if (Math.abs(totalProrrateadoPromo2 - 18000) > 1) {
        throw new Error(`Prorrateo incorrecto para Promo 2. Esperado 18000, recibido: ${totalProrrateadoPromo2}`);
      }
      console.log('✓ Prorrateo de precios de combos verificado con éxito.');

      // 6. Probar creación y adición INCREMENTAL de promociones en Delivery (Ajuste Solicitado #1)
      console.log('\n--- 6. Probando creación y adición INCREMENTAL de promociones en Delivery ---');
      // Crear pedido Delivery con Promo 1
      const resCrearDelivery = await fetch(`${BASE_URL}/api/pedidos-delivery`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenMozo}`
        },
        body: JSON.stringify({
          nombreCliente: 'Juan Carlos Test',
          telefono: '1122334455',
          direccionEntrega: 'Av. Corrientes 1234',
          items: [{ promocionId: promo1._id, cantidad: 1 }]
        })
      });
      const dataCrearDelivery = await resCrearDelivery.json();
      const pedidoDeliveryId = dataCrearDelivery.pedido._id;
      console.log('✓ Pedido de Delivery creado con Promo 1 exitosamente.');

      // Agregar de forma INCREMENTAL la Promo 2 al mismo pedido de Delivery
      const resIncrementalDelivery = await fetch(`${BASE_URL}/api/pedidos-delivery/${pedidoDeliveryId}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenMozo}`
        },
        body: JSON.stringify({
          items: [{ promocionId: promo2._id, cantidad: 1 }]
        })
      });
      const dataIncrementalDelivery = await resIncrementalDelivery.json();
      if (resIncrementalDelivery.status !== 200) {
        throw new Error(`Fallo al agregar ítems incrementales a Delivery: ${dataIncrementalDelivery.mensaje}`);
      }

      const itemsDeliveryActualizados = dataIncrementalDelivery.pedido.items;
      console.log(`✓ Adición incremental a Delivery exitosa. El pedido ahora tiene ${itemsDeliveryActualizados.length} ítems.`);

      // 7. Verificación de Descuento de Stock por Receta
      console.log('\n--- 7. Verificando descuento de stock de ingredientes por receta ---');
      const ingHarinaActual = await Ingrediente.findById(ingHarina._id);
      const ingCervezaActual = await Ingrediente.findById(ingCerveza._id);

      console.log(`- Stock inicial Harina: ${stockHarinaInicial} kg | Stock actual: ${ingHarinaActual.stockActual} kg`);
      console.log(`- Stock inicial Cerveza: ${stockCervezaInicial} un | Stock actual: ${ingCervezaActual.stockActual} un`);

      if (ingHarinaActual.stockActual >= stockHarinaInicial) {
        throw new Error('El stock de Harina no disminuyó');
      }
      if (ingCervezaActual.stockActual >= stockCervezaInicial) {
        throw new Error('El stock de Cerveza no disminuyó');
      }
      console.log('✓ Descuento de stock de ingredientes según recetas verificado correctamente.');

      console.log('\n🎉 ¡TODAS LAS PRUEBAS DE INTEGRACIÓN DEL MÓDULO PROMOCIONES PASARON EXITOSAMENTE!');
      server.close();
      process.exit(0);
    } catch (err) {
      console.error('\n❌ ERROR EN LAS PRUEBAS:', err.message);
      server.close();
      process.exit(1);
    }
  });
}

runTests();
