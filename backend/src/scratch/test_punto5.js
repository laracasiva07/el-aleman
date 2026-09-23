require('dotenv').config();
const app = require('../app');

const conectarDB = require('../config/db');

const testPunto5 = async () => {
  await conectarDB();
  const server = app.listen(0, async () => {
    const port = server.address().port;
    const baseUrl = `http://localhost:${port}`;

    console.log(`Servidor de prueba NoSQL Sanitize corriendo en puerto ${port}`);

    let allPassed = true;

    // Test 1: Payload con Inyección NoSQL { "login": { "$ne": null }, "password": "123" }
    try {
      const resMalicious = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          login: { "$ne": null },
          password: "123"
        })
      });

      const statusMalicious = resMalicious.status;
      const bodyMalicious = await resMalicious.json();

      console.log(`Payload Malicioso NoSQL -> Status: ${statusMalicious}, Response:`, bodyMalicious);

      if (statusMalicious === 400 || statusMalicious === 401) {
        console.log('PASS: Ataque de Inyección NoSQL fue neutralizado correctamente.');
      } else {
        console.error(`FAIL: Inyección NoSQL devolvió un status inesperado (${statusMalicious}).`);
        allPassed = false;
      }
    } catch (err) {
      console.error('ERROR en test de inyección NoSQL:', err.message);
      allPassed = false;
    }

    // Test 2: Login Legítimo { "login": "dueno", "password": "1234" }
    try {
      const resLegit = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          login: "dueno",
          password: "1234"
        })
      });

      const statusLegit = resLegit.status;
      const bodyLegit = await resLegit.json();

      console.log(`Login Legítimo -> Status: ${statusLegit}`);

      if (statusLegit === 200 && bodyLegit.token) {
        console.log('PASS: Login legítimo funcionó correctamente.');
      } else {
        console.error('FAIL: Login legítimo no funcionó.');
        allPassed = false;
      }
    } catch (err) {
      console.error('ERROR en test de login legítimo:', err.message);
      allPassed = false;
    }

    server.close();

    if (allPassed) {
      console.log('\n✅ VERIFICACIÓN PUNTO 5 EXITOSA: Inputs sanitizados contra inyección NoSQL.');
      process.exit(0);
    } else {
      console.error('\n❌ VERIFICACIÓN PUNTO 5 FALLÓ.');
      process.exit(1);
    }
  });
};

testPunto5();
