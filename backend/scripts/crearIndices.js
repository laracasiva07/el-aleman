const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');

const Producto = require('../src/models/Producto');
const Categoria = require('../src/models/Categoria');
const Ingrediente = require('../src/models/Ingrediente');

async function sincronizarIndices() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('ERROR: MONGO_URI no configurado en .env');
    process.exit(1);
  }

  console.log('='.repeat(80));
  console.log('CREACIÓN Y SINCRONIZACIÓN MANUAL DE ÍNDICES EN MONGODB');
  console.log(`Base de datos: ${mongoUri.replace(/:[^:]*@/, ':****@')}`);
  console.log('='.repeat(80));

  await mongoose.connect(mongoUri);

  try {
    console.log('\nSincronizando índices con Mongoose syncIndexes()...');

    await Categoria.syncIndexes();
    console.log('✓ Índices sincronizados para Categoria');

    await Ingrediente.syncIndexes();
    console.log('✓ Índices sincronizados para Ingrediente');

    await Producto.syncIndexes();
    console.log('✓ Índices sincronizados para Producto');

    console.log('\n' + '-'.repeat(80));
    console.log('ÍNDICES VIGENTES EN LAS COLECCIONES:');
    console.log('-'.repeat(80));

    const indicesCategorias = await Categoria.collection.indexes();
    console.log('\n[Colección Categorias]:');
    console.dir(indicesCategorias, { depth: null });

    const indicesIngredientes = await Ingrediente.collection.indexes();
    console.log('\n[Colección Ingredientes]:');
    console.dir(indicesIngredientes, { depth: null });

    const indicesProductos = await Producto.collection.indexes();
    console.log('\n[Colección Productos]:');
    console.dir(indicesProductos, { depth: null });

    console.log('\n' + '='.repeat(80));
    console.log('✓ Todos los índices únicos y collations quedaron creados y verificados.');
    console.log('='.repeat(80));
  } catch (error) {
    console.error('Error al sincronizar índices:', error);
  } finally {
    await mongoose.connection.close();
  }
}

sincronizarIndices();
