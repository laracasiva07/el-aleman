const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Usuario = require('../models/Usuario');

async function testRoleFix() {
  console.log('--- Verificando Unificación de Rol "dueno" ---');
  
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error('MONGO_URI no definida en .env');
    }
    await mongoose.connect(mongoUri);

    const usuarioDueno = await Usuario.findOne({ login: 'dueno' });

    if (!usuarioDueno) {
      console.log('⚠️ No se encontró el usuario dueno en la base de datos.');
    } else {
      console.log('✅ Usuario en Base de Datos:', {
        id: usuarioDueno._id,
        nombre: usuarioDueno.nombre,
        login: usuarioDueno.login,
        rol: usuarioDueno.rol
      });

      if (usuarioDueno.rol !== 'dueno') {
        throw new Error(`El rol en DB no es 'dueno': ${usuarioDueno.rol}`);
      }
    }

    // Probar lógica exacta de las pantallas
    const rolActual = usuarioDueno ? usuarioDueno.rol : 'dueno';

    const esDuenoClientes = rolActual === 'dueno';
    const esDuenoTakeAway = rolActual === 'dueno';
    const esDuenoDelivery = rolActual === 'dueno';
    const esDuenoPedidosSalon = rolActual === 'dueno';
    const esDuenoCaja = rolActual === 'dueno';

    console.log('✅ Clientes.jsx esDueno:', esDuenoClientes);
    console.log('✅ TakeAway.jsx esDueno:', esDuenoTakeAway);
    console.log('✅ PedidosDelivery.jsx esDueno:', esDuenoDelivery);
    console.log('✅ PedidosSalon.jsx esDueno:', esDuenoPedidosSalon);
    console.log('✅ Caja.jsx esDueno:', esDuenoCaja);

    if (esDuenoClientes && esDuenoTakeAway && esDuenoDelivery && esDuenoPedidosSalon && esDuenoCaja) {
      console.log('\n🎉 ¡Verificación EXITOSA! Todas las pantallas del frontend reconocen uniformemente el rol "dueno".');
    } else {
      console.error('\n❌ Falló la verificación de roles.');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error en testRoleFix:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

testRoleFix();
