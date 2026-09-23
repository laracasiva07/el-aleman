require('dotenv').config();
const mongoose = require('mongoose');
const conectarDB = require('./config/db');
const Usuario = require('./models/Usuario');
const Categoria = require('./models/Categoria');
const Ingrediente = require('./models/Ingrediente');
const Producto = require('./models/Producto');
const Sector = require('./models/Sector');
const Mesa = require('./models/Mesa');
const Cliente = require('./models/Cliente');
const Pedido = require('./models/Pedido');
const MovimientoCaja = require('./models/MovimientoCaja');
const GastoFijo = require('./models/GastoFijo');
const Promocion = require('./models/Promocion');

const usuariosIniciales = [
  { nombre: 'Dueño', login: 'dueno', password: '1234', rol: 'dueno' },
  { nombre: 'Encargado', login: 'encargado', password: '1234', rol: 'encargado' },
  { nombre: 'Mozo 1', login: 'mozo1', password: '1234', rol: 'mozo' }
];

const clientesIniciales = [
  { nombre: 'Juan Pérez', telefono: '1144332211', direccion: 'Av. Siempreviva 742' },
  { nombre: 'María González', telefono: '1155667788', direccion: 'Calle Falsa 123' },
  { nombre: 'Carlos Rodríguez', telefono: '1199887766', direccion: 'Mitre 456' }
];

const sembrarDatos = async () => {
  try {
    await conectarDB();

    console.log('Limpiando colecciones existentes...');
    await Usuario.deleteMany({});
    await Categoria.deleteMany({});
    await Ingrediente.deleteMany({});
    await Producto.deleteMany({});
    await Sector.deleteMany({});
    await Mesa.deleteMany({});
    await Cliente.deleteMany({});
    await Pedido.deleteMany({});
    await MovimientoCaja.deleteMany({});
    await GastoFijo.deleteMany({});
    await Promocion.deleteMany({});

    console.log('Insertando usuarios iniciales...');
    for (const u of usuariosIniciales) {
      await Usuario.create(u);
    }

    console.log('Insertando clientes iniciales...');
    for (const c of clientesIniciales) {
      await Cliente.create(c);
    }

    console.log('Insertando categorías iniciales...');
    const catPizzas = await Categoria.create({ nombre: 'Pizzas', tipo: 'comida' });
    const catEmpanadas = await Categoria.create({ nombre: 'Empanadas', tipo: 'comida' });
    const catBebidas = await Categoria.create({ nombre: 'Bebidas', tipo: 'bebida' });

    console.log('Insertando ingredientes iniciales...');
    const ingHarina = await Ingrediente.create({
      nombre: 'Harina 000',
      unidadMedida: 'kg',
      stockActual: 50,
      precioCompra: 15000,
      cantidadComprada: 25,
      umbralCritico: 5,
      umbralBajo: 15
    });

    const ingMuzzarella = await Ingrediente.create({
      nombre: 'Queso Muzzarella',
      unidadMedida: 'kg',
      stockActual: 4, // Estado: 'bajo'
      precioCompra: 32000,
      cantidadComprada: 8,
      umbralCritico: 3,
      umbralBajo: 5
    });

    const ingSalsa = await Ingrediente.create({
      nombre: 'Salsa de Tomate',
      unidadMedida: 'l',
      stockActual: 1, // Estado: 'critico'
      precioCompra: 8000,
      cantidadComprada: 10,
      umbralCritico: 2,
      umbralBajo: 4
    });

    const ingCervezaIPA = await Ingrediente.create({
      nombre: 'Cerveza IPA 500ml',
      unidadMedida: 'unidad',
      stockActual: 24,
      precioCompra: 24000,
      cantidadComprada: 24,
      umbralCritico: 5,
      umbralBajo: 10
    });

    console.log('Insertando productos iniciales con recetas...');
    await Producto.create({
      nombre: 'Pizza Muzzarella Grande',
      categoriaId: catPizzas._id,
      precioVenta: 8500,
      disponible: true,
      receta: [
        { ingredienteId: ingHarina._id, cantidad: 0.25 },
        { ingredienteId: ingMuzzarella._id, cantidad: 0.3 },
        { ingredienteId: ingSalsa._id, cantidad: 0.15 }
      ]
    });

    await Producto.create({
      nombre: 'Cerveza IPA 500ml',
      categoriaId: catBebidas._id,
      precioVenta: 3500,
      disponible: true,
      receta: [
        { ingredienteId: ingCervezaIPA._id, cantidad: 1 }
      ]
    });

    console.log('Insertando sectores de ejemplo...');
    const sectorSalon = await Sector.create({ nombre: 'Salón Principal' });
    const sectorTerraza = await Sector.create({ nombre: 'Terraza' });
    const sectorVIP = await Sector.create({ nombre: 'VIP' });

    console.log('Insertando mesas iniciales repartidas por sector...');
    const mesasIniciales = [
      { numero: 1, sectorId: sectorSalon._id, posicionX: 20, posicionY: 30, estado: 'libre' },
      { numero: 2, sectorId: sectorSalon._id, posicionX: 40, posicionY: 30, estado: 'libre' },
      { numero: 3, sectorId: sectorSalon._id, posicionX: 60, posicionY: 30, estado: 'libre' },
      { numero: 4, sectorId: sectorSalon._id, posicionX: 80, posicionY: 30, estado: 'libre' },
      { numero: 5, sectorId: sectorTerraza._id, posicionX: 30, posicionY: 70, estado: 'libre' },
      { numero: 6, sectorId: sectorTerraza._id, posicionX: 50, posicionY: 70, estado: 'libre' },
      { numero: 7, sectorId: sectorVIP._id, posicionX: 70, posicionY: 70, estado: 'libre' }
    ];

    for (const m of mesasIniciales) {
      await Mesa.create(m);
    }

    console.log('¡Base de datos sembrada con éxito!');
    console.log('Usuarios creados: dueno / encargado / mozo1 (password: 1234)');
    console.log('Clientes creados: Juan Pérez, María González, Carlos Rodríguez');
    console.log('Categorías creadas: Pizzas, Empanadas, Bebidas');
    console.log('Ingredientes creados: Harina 000, Queso Muzzarella, Salsa de Tomate, Cerveza IPA');
    console.log('Productos creados: Pizza Muzzarella Grande, Cerveza IPA 500ml');
    console.log('Sectores creados: Salón Principal, Terraza, VIP');
    console.log('Mesas creadas: 7 mesas repartidas con estado "libre"');

    process.exit(0);
  } catch (error) {
    console.error(`Error al ejecutar el seed: ${error.message}`);
    process.exit(1);
  }
};

sembrarDatos();
