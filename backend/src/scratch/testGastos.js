require('dotenv').config();
const http = require('http');
const conectarDB = require('../config/db');
const app = require('../app');
const Usuario = require('../models/Usuario');
const GastoFijo = require('../models/GastoFijo');
const MovimientoCaja = require('../models/MovimientoCaja');
const Turno = require('../models/Turno');

const PORT = 5099;
const BASE_URL = `http://localhost:${PORT}`;

async function runTests() {
  console.log('🚀 Iniciando pruebas de integración del módulo Gastos...');

  await conectarDB();

  // Asegurar que existan los usuarios 'dueno' y 'encargado'
  let userDueno = await Usuario.findOne({ login: 'dueno' });
  if (!userDueno) {
    userDueno = await Usuario.create({ nombre: 'Dueño Test', login: 'dueno', password: '1234', rol: 'dueno' });
  }

  let userEncargado = await Usuario.findOne({ login: 'encargado' });
  if (!userEncargado) {
    userEncargado = await Usuario.create({ nombre: 'Encargado Test', login: 'encargado', password: '1234', rol: 'encargado' });
  }

  // Iniciar servidor express
  const server = app.listen(PORT, async () => {
    console.log(`Servidor de prueba corriendo en el puerto ${PORT}`);

    try {
      // 1. Autenticación
      console.log('\n--- 1. Probando Login ---');
      const resLoginDueno = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: 'dueno', password: '1234' })
      });
      const dataDueno = await resLoginDueno.json();
      const tokenDueno = dataDueno.token;
      console.log('✓ Login dueño exitoso. Token recibido.');

      const resLoginEncargado = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: 'encargado', password: '1234' })
      });
      const dataEncargado = await resLoginEncargado.json();
      const tokenEncargado = dataEncargado.token;
      console.log('✓ Login encargado exitoso. Token recibido.');

      // 2. Control de Acceso por Rol (Restricción solo dueño)
      console.log('\n--- 2. Verificando seguridad de roles (403 para encargado) ---');
      const resAccesoDenegado = await fetch(`${BASE_URL}/api/gastos/fijos`, {
        headers: { Authorization: `Bearer ${tokenEncargado}` }
      });
      if (resAccesoDenegado.status !== 403) {
        throw new Error(`Esperado HTTP 403 para rol encargado en /api/gastos/fijos, recibido: ${resAccesoDenegado.status}`);
      }
      console.log('✓ Acceso denegado correctamente a rol encargado (403).');

      // 3. Limpieza de gastos fijos de prueba previos
      await GastoFijo.deleteMany({ sucursalId: 'sucursal-1' });

      // 4. Creación de Gastos Fijos (Dueño)
      console.log('\n--- 3. Creando Gastos Fijos ---');
      // Gasto 1: Alquiler
      const resGasto1 = await fetch(`${BASE_URL}/api/gastos/fijos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenDueno}`
        },
        body: JSON.stringify({ nombre: 'Alquiler', montoMensual: 300000 })
      });
      const dataGasto1 = await resGasto1.json();
      console.log('✓ Gasto fijo "Alquiler" creado:', dataGasto1.gastoFijo.nombre, `$${dataGasto1.gastoFijo.montoMensual}`);

      // Gasto 2: Luz
      const resGasto2 = await fetch(`${BASE_URL}/api/gastos/fijos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenDueno}`
        },
        body: JSON.stringify({ nombre: 'Luz', montoMensual: 60000 })
      });
      const dataGasto2 = await resGasto2.json();

      // Gasto 3: Servicio Limpieza (se va a dar de baja para probar exclusión)
      const resGasto3 = await fetch(`${BASE_URL}/api/gastos/fijos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenDueno}`
        },
        body: JSON.stringify({ nombre: 'Servicio Limpieza', montoMensual: 90000 })
      });
      const dataGasto3 = await resGasto3.json();
      const idGastoLimpieza = dataGasto3.gastoFijo._id;
      console.log('✓ 3 Gastos Fijos creados exitosamente.');

      // 5. Editar Gasto Fijo
      console.log('\n--- 4. Editando Gasto Fijo "Luz" ---');
      const resEdit = await fetch(`${BASE_URL}/api/gastos/fijos/${dataGasto2.gastoFijo._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenDueno}`
        },
        body: JSON.stringify({ montoMensual: 75000 })
      });
      const dataEdit = await resEdit.json();
      if (dataEdit.gastoFijo.montoMensual !== 75000) {
        throw new Error(`Esperado monto 75000 en Luz, recibido: ${dataEdit.gastoFijo.montoMensual}`);
      }
      console.log('✓ Monto de "Luz" actualizado correctamente a $75,000.');

      // 6. Dar de baja Gasto Fijo "Servicio Limpieza" (activo: false)
      console.log('\n--- 5. Dando de baja (desactivando) "Servicio Limpieza" ---');
      const resBaja = await fetch(`${BASE_URL}/api/gastos/fijos/${idGastoLimpieza}/activo`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenDueno}`
        },
        body: JSON.stringify({ activo: false })
      });
      const dataBaja = await resBaja.json();
      if (dataBaja.gastoFijo.activo !== false) {
        throw new Error(`Esperado activo: false para Servicio Limpieza, recibido: ${dataBaja.gastoFijo.activo}`);
      }
      console.log('✓ "Servicio Limpieza" dado de baja exitosamente (activo: false).');

      // 7. Registrar Egreso Manual en Caja con esGastoDiario: true y esGastoDiario: false
      console.log('\n--- 6. Registrando Egresos Manuales de Caja ---');
      // Abrir turno si no hay uno abierto
      let resTurnoActual = await fetch(`${BASE_URL}/api/caja/turnos/actual`, {
        headers: { Authorization: `Bearer ${tokenDueno}` }
      });
      let dataTurnoActual = await resTurnoActual.json();

      if (!dataTurnoActual.turno) {
        await fetch(`${BASE_URL}/api/caja/turnos/abrir`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${tokenDueno}`
          },
          body: JSON.stringify({ montoInicial: 20000 })
        });
      }

      // Registramos Egreso 1: Gasto Diario ($15,000)
      const resEgreso1 = await fetch(`${BASE_URL}/api/caja/movimientos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenDueno}`
        },
        body: JSON.stringify({
          monto: 15000,
          motivo: 'Compra de verduras e insumos frescos',
          esGastoDiario: true
        })
      });
      const dataEgreso1 = await resEgreso1.json();
      if (!dataEgreso1.movimiento.esGastoDiario) {
        throw new Error('El movimiento de caja no guardó esGastoDiario: true');
      }
      console.log('✓ Egreso manual marcado como gasto diario ($15,000) registrado exitosamente.');

      // Registramos Egreso 2: NO es gasto diario ($5,000)
      const resEgreso2 = await fetch(`${BASE_URL}/api/caja/movimientos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenDueno}`
        },
        body: JSON.stringify({
          monto: 5000,
          motivo: 'Retiro caja chica no considerado gasto operativo',
          esGastoDiario: false
        })
      });
      const dataEgreso2 = await resEgreso2.json();
      if (dataEgreso2.movimiento.esGastoDiario !== false) {
        throw new Error('El movimiento 2 debería tener esGastoDiario: false');
      }
      console.log('✓ Egreso manual NO gasto diario ($5,000) registrado exitosamente.');

      // 8. Probar GET /api/gastos/diarios (con y sin query params)
      console.log('\n--- 7. Obteniendo Gastos Diarios ---');
      const resDiariosDefault = await fetch(`${BASE_URL}/api/gastos/diarios`, {
        headers: { Authorization: `Bearer ${tokenDueno}` }
      });
      const dataDiariosDefault = await resDiariosDefault.json();
      console.log(`✓ GET /api/gastos/diarios (sin params) trajo por defecto el mes en curso. Total: $${dataDiariosDefault.total}`);
      if (dataDiariosDefault.gastosDiarios.some(m => m.monto === 5000)) {
        throw new Error('El egreso que NO es gasto diario de $5,000 fue incluido erróneamente');
      }
      if (!dataDiariosDefault.gastosDiarios.some(m => m.monto === 15000)) {
        throw new Error('El gasto diario de $15,000 no fue encontrado');
      }

      // 9. Probar GET /api/gastos/balance y verificar EXCLUSIÓN de gasto fijo inactivo
      console.log('\n--- 8. Obteniendo Balance de Gastos (Verificación de prorrateo y exclusión) ---');
      const resBalance = await fetch(`${BASE_URL}/api/gastos/balance`, {
        headers: { Authorization: `Bearer ${tokenDueno}` }
      });
      const dataBalance = await resBalance.json();
      console.log('📊 Resultado del Balance por defecto (mes en curso):');
      console.dir(dataBalance, { depth: null });

      // Verificaciones matemáticas
      // Gastos fijos activos: Alquiler (300,000) + Luz (75,000) = 375,000
      // "Servicio Limpieza" (90,000) está INACTIVO y debe ser EXCLUIDO.
      const ahora = new Date();
      const diasEnMesActual = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0).getDate();
      const prorrateoEsperadoPorDia = 375000 / diasEnMesActual;
      const totalProrrateadoEsperado = Number((dataBalance.rango.diasTotales * prorrateoEsperadoPorDia).toFixed(2));

      console.log(`\nVerificando cálculo matemático:`);
      console.log(`- Días en el mes: ${diasEnMesActual}`);
      console.log(`- Días en el rango consultado: ${dataBalance.rango.diasTotales}`);
      console.log(`- Prorrateo esperado fijos activos ($375,000 total): $${totalProrrateadoEsperado}`);
      console.log(`- Prorrateo retornado por API: $${dataBalance.gastosFijosProrrateados}`);

      if (Math.abs(dataBalance.gastosFijosProrrateados - totalProrrateadoEsperado) > 0.1) {
        throw new Error(`Cálculo de prorrateo incorrecto. Esperado: ${totalProrrateadoEsperado}, recibido: ${dataBalance.gastosFijosProrrateados}`);
      }
      console.log('✓ Confirmado: El gasto fijo inactivo ($90,000) fue EXCLUIDO correctamente.');

      if (dataBalance.gastosDiarios !== 15000) {
        throw new Error(`Esperado gastosDiarios: 15000, recibido: ${dataBalance.gastosDiarios}`);
      }
      console.log('✓ Confirmado: gastosDiarios es exactamente $15,000.');

      const balanceCalculadoManual = Number((dataBalance.ingresos - (dataBalance.gastosDiarios + dataBalance.gastosFijosProrrateados)).toFixed(2));
      if (dataBalance.balanceNeto !== balanceCalculadoManual) {
        throw new Error(`Balance neto no coincide. Esperado: ${balanceCalculadoManual}, recibido: ${dataBalance.balanceNeto}`);
      }
      console.log('✓ Confirmado: balanceNeto es exactamente ingresos - (gastosDiarios + gastosFijosProrrateados).');

      console.log('\n🎉 ¡TODAS LAS PRUEBAS DE INTEGRACIÓN DEL MÓDULO GASTOS PASARON EXITOSAMENTE!');
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
