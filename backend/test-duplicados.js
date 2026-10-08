require('dotenv').config();
const mongoose = require('mongoose');
const Producto = require('./src/models/Producto');
const Categoria = require('./src/models/Categoria');
const Ingrediente = require('./src/models/Ingrediente');
const { crearProducto } = require('./src/controllers/productoController');
const { crearCategoria } = require('./src/controllers/categoriaController');
const { crearIngrediente } = require('./src/controllers/ingredienteController');

const mockRes = () => {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    }
  };
  return res;
};

async function runTestSuite() {
  const baseUri = process.env.MONGO_URI;
  if (!baseUri || !baseUri.includes('/elaleman')) {
    throw new Error('MONGO_URI no configurado o formato inesperado en .env');
  }

  // Base de datos de prueba aislada (longitud corta < 38 caracteres para Atlas)
  const testUri = baseUri.replace(/\/elaleman\?/, '/test_dup_fase2?');
  console.log('='.repeat(80));
  console.log('SUITE DE VERIFICACIÓN ANTI-DUPLICADOS (Fase 2, Parte 3)');
  console.log('Conectando a base de datos de prueba aislada:');
  console.log(testUri.replace(/:[^:]*@/, ':****@'));
  console.log('='.repeat(80));

  await mongoose.connect(testUri);

  try {
    // Sincronizar índices con collation en la base de prueba
    console.log('\nSincronizando índices en base de prueba...');
    await Categoria.syncIndexes();
    await Ingrediente.syncIndexes();
    await Producto.syncIndexes();
    console.log('✓ Índices sincronizados exitosamente.');

    // Limpieza inicial
    await Producto.deleteMany({});
    await Categoria.deleteMany({});
    await Ingrediente.deleteMany({});

    // Categorías base
    const catPizzas = await Categoria.create({ nombre: 'Pizzas Especiales', tipo: 'comida' });
    const catEmpanadas = await Categoria.create({ nombre: 'Empanadas Caseras', tipo: 'comida' });

    // -------------------------------------------------------------------------
    // (a) Dos POST simultáneos con Promise.all del mismo producto
    // -------------------------------------------------------------------------
    console.log('\n--- (a) Dos POST concurrentes (Promise.all) del mismo producto ---');
    const reqProd1 = {
      body: {
        nombre: 'Pizza Fugazzeta Rellena',
        categoriaId: catPizzas._id,
        precioVenta: 14000
      }
    };
    const reqProd2 = {
      body: {
        nombre: 'Pizza Fugazzeta Rellena',
        categoriaId: catPizzas._id,
        precioVenta: 14000
      }
    };

    const resProd1 = mockRes();
    const resProd2 = mockRes();

    await Promise.all([
      crearProducto(reqProd1, resProd1),
      crearProducto(reqProd2, resProd2)
    ]);

    const codigosProd = [resProd1.statusCode, resProd2.statusCode].sort();
    console.log(`Respuestas recibidas: [${resProd1.statusCode}, ${resProd2.statusCode}]`);
    if (codigosProd[0] !== 201 || codigosProd[1] !== 409) {
      throw new Error(`Se esperaba un 201 y un 409, pero se obtuvo: ${JSON.stringify(codigosProd)}`);
    }

    const cantProdsEnBD = await Producto.countDocuments({
      nombre: 'Pizza Fugazzeta Rellena',
      categoriaId: catPizzas._id
    });
    if (cantProdsEnBD !== 1) {
      throw new Error(`Se esperaba exactamente 1 documento en BD, pero hay ${cantProdsEnBD}`);
    }
    console.log('✓ Concurrencia Producto superada: solo 1 documento creado y el otro rechazado con 409.');

    // -------------------------------------------------------------------------
    // (b) Dos POST simultáneos con Promise.all para Categoría e Ingrediente
    // -------------------------------------------------------------------------
    console.log('\n--- (b.1) Dos POST concurrentes (Promise.all) de Categoría ---');
    const resCat1 = mockRes();
    const resCat2 = mockRes();

    await Promise.all([
      crearCategoria({ body: { nombre: 'Postres Artesanales', tipo: 'comida' } }, resCat1),
      crearCategoria({ body: { nombre: 'Postres Artesanales', tipo: 'comida' } }, resCat2)
    ]);

    const codigosCat = [resCat1.statusCode, resCat2.statusCode].sort();
    console.log(`Respuestas Categoría: [${resCat1.statusCode}, ${resCat2.statusCode}]`);
    if (codigosCat[0] !== 201 || codigosCat[1] !== 409) {
      throw new Error(`Se esperaba un 201 y un 409 en Categoría, pero se obtuvo: ${JSON.stringify(codigosCat)}`);
    }
    const cantCatsEnBD = await Categoria.countDocuments({ nombre: 'Postres Artesanales' });
    if (cantCatsEnBD !== 1) {
      throw new Error(`Se esperaba 1 categoría en BD, pero hay ${cantCatsEnBD}`);
    }
    console.log('✓ Concurrencia Categoría superada: solo 1 creada y el otro rechazado con 409.');

    console.log('\n--- (b.2) Dos POST concurrentes (Promise.all) de Ingrediente ---');
    const resIng1 = mockRes();
    const resIng2 = mockRes();
    const datosIng = {
      nombre: 'Harina de Fuerza 000',
      unidadMedida: 'kg',
      stockActual: 50,
      precioCompra: 25000,
      cantidadComprada: 25,
      umbralCritico: 5,
      umbralBajo: 10
    };

    await Promise.all([
      crearIngrediente({ body: { ...datosIng } }, resIng1),
      crearIngrediente({ body: { ...datosIng } }, resIng2)
    ]);

    const codigosIng = [resIng1.statusCode, resIng2.statusCode].sort();
    console.log(`Respuestas Ingrediente: [${resIng1.statusCode}, ${resIng2.statusCode}]`);
    if (codigosIng[0] !== 201 || codigosIng[1] !== 409) {
      throw new Error(`Se esperaba un 201 y un 409 en Ingrediente, pero se obtuvo: ${JSON.stringify(codigosIng)}`);
    }
    const cantIngsEnBD = await Ingrediente.countDocuments({ nombre: 'Harina de Fuerza 000' });
    if (cantIngsEnBD !== 1) {
      throw new Error(`Se esperaba 1 ingrediente en BD, pero hay ${cantIngsEnBD}`);
    }
    console.log('✓ Concurrencia Ingrediente superada: solo 1 creado y el otro rechazado con 409.');

    // -------------------------------------------------------------------------
    // (c) Mismo nombre de producto en otra categoría: permitido
    // -------------------------------------------------------------------------
    console.log('\n--- (c) Mismo nombre de producto en otra categoría ---');
    const resProdOtraCat = mockRes();
    await crearProducto({
      body: {
        nombre: 'Pizza Fugazzeta Rellena',
        categoriaId: catEmpanadas._id,
        precioVenta: 15000
      }
    }, resProdOtraCat);

    console.log(`Respuesta misma creación en otra categoría: Status ${resProdOtraCat.statusCode}`);
    if (resProdOtraCat.statusCode !== 201) {
      throw new Error(`Se esperaba 201 al crear en otra categoría, pero devolvió ${resProdOtraCat.statusCode}`);
    }
    console.log('✓ Mismo nombre en diferente categoría permitido con 201.');

    // -------------------------------------------------------------------------
    // (d) Nombres que difieren solo en mayúsculas o tildes: 409
    // -------------------------------------------------------------------------
    console.log('\n--- (d.1) Producto con diferencia solo de tildes y mayúsculas ---');
    // Creamos "Jamón Cocido Especial"
    const resProdJam = mockRes();
    await crearProducto({
      body: {
        nombre: 'Jamón Cocido Especial',
        categoriaId: catPizzas._id,
        precioVenta: 12000
      }
    }, resProdJam);
    if (resProdJam.statusCode !== 201) throw new Error('Error al crear producto base para tildes');

    // Intentamos "jamon cocido especial" (sin tilde y minúsculas)
    const resProdSinTilde = mockRes();
    await crearProducto({
      body: {
        nombre: '  jamon cocido especial  ',
        categoriaId: catPizzas._id,
        precioVenta: 12000
      }
    }, resProdSinTilde);
    console.log(`Intento sin tilde / minúsculas: Status ${resProdSinTilde.statusCode} (${resProdSinTilde.body?.mensaje})`);
    if (resProdSinTilde.statusCode !== 409) {
      throw new Error(`Se esperaba 409 por colisión de tilde/mayúscula, pero dio ${resProdSinTilde.statusCode}`);
    }
    console.log('✓ Producto con variación de tilde/mayúscula bloqueado con 409.');

    console.log('\n--- (d.2) Categoría con diferencia solo de tildes y mayúsculas ---');
    // Ya existe "Pizzas Especiales", intentamos crear "PIZZAS ESPECIALES"
    const resCatUpper = mockRes();
    await crearCategoria({
      body: { nombre: 'PIZZAS ESPECIALES', tipo: 'comida' }
    }, resCatUpper);
    console.log(`Intento Categoría mayúsculas: Status ${resCatUpper.statusCode} (${resCatUpper.body?.mensaje})`);
    if (resCatUpper.statusCode !== 409) {
      throw new Error(`Se esperaba 409 en categoría mayúsculas, pero dio ${resCatUpper.statusCode}`);
    }

    // Creamos "Bebidas Alcohólicas" e intentamos "bebidas alcoholicas"
    const resCatAlc = mockRes();
    await crearCategoria({ body: { nombre: 'Bebidas Alcohólicas', tipo: 'bebida' } }, resCatAlc);
    const resCatAlcSinTilde = mockRes();
    await crearCategoria({ body: { nombre: 'bebidas alcoholicas', tipo: 'bebida' } }, resCatAlcSinTilde);
    console.log(`Intento Categoría sin tilde: Status ${resCatAlcSinTilde.statusCode} (${resCatAlcSinTilde.body?.mensaje})`);
    if (resCatAlcSinTilde.statusCode !== 409) {
      throw new Error(`Se esperaba 409 en categoría sin tilde, pero dio ${resCatAlcSinTilde.statusCode}`);
    }
    console.log('✓ Categoría con variación de tildes y mayúsculas bloqueada con 409.');

    console.log('\n--- (d.3) Ingrediente con diferencia solo de tildes y mayúsculas ---');
    const resIngOregano = mockRes();
    await crearIngrediente({
      body: {
        nombre: 'Orégano Seco',
        unidadMedida: 'g',
        precioCompra: 1000,
        cantidadComprada: 500,
        umbralCritico: 50,
        umbralBajo: 100
      }
    }, resIngOregano);

    const resIngOreganoSinTilde = mockRes();
    await crearIngrediente({
      body: {
        nombre: 'oregano seco',
        unidadMedida: 'g',
        precioCompra: 1000,
        cantidadComprada: 500,
        umbralCritico: 50,
        umbralBajo: 100
      }
    }, resIngOreganoSinTilde);
    console.log(`Intento Ingrediente sin tilde: Status ${resIngOreganoSinTilde.statusCode} (${resIngOreganoSinTilde.body?.mensaje})`);
    if (resIngOreganoSinTilde.statusCode !== 409) {
      throw new Error(`Se esperaba 409 en ingrediente sin tilde, pero dio ${resIngOreganoSinTilde.statusCode}`);
    }
    console.log('✓ Ingrediente con variación de tildes y mayúsculas bloqueado con 409.');

    console.log('\n' + '='.repeat(80));
    console.log('✓ TODAS LAS PRUEBAS (a, b, c, d) PASARON EXITOSAMENTE AL 100%');
    console.log('='.repeat(80));
  } finally {
    // Limpieza de datos en base de prueba
    await Producto.deleteMany({});
    await Categoria.deleteMany({});
    await Ingrediente.deleteMany({});
    await mongoose.connection.close();
  }
}

runTestSuite().catch((err) => {
  console.error('ERROR EN PRUEBA:', err);
  process.exit(1);
});
