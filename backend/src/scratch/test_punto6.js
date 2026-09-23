require('dotenv').config();
const app = require('../app');
const conectarDB = require('../config/db');

const testPunto6 = async () => {
  await conectarDB();
  const server = app.listen(0, async () => {
    const port = server.address().port;
    const baseUrl = `http://localhost:${port}`;

    console.log(`Servidor Rate Limit corriendo en puerto ${port}`);

    let allPassed = true;
    let limitExceeded = false;

    for (let i = 1; i <= 11; i++) {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: 'dueno', password: 'incorrect_password' })
      });

      const status = res.status;
      const data = await res.json();

      console.log(`Intento #${i} -> Status: ${status}, Mensaje: "${data.mensaje}"`);

      if (i <= 10) {
        if (status === 429) {
          console.error(`FAIL: Intento #${i} fue bloqueado antes de tiempo.`);
          allPassed = false;
        }
      } else {
        if (status === 429) {
          console.log(`PASS: Intento #${i} fue bloqueado correctamente con 429 (Rate Limit).`);
          limitExceeded = true;
        } else {
          console.error(`FAIL: Intento #${i} NO fue bloqueado con 429 (Status actual: ${status}).`);
          allPassed = false;
        }
      }
    }

    server.close();

    if (allPassed && limitExceeded) {
      console.log('\n✅ VERIFICACIÓN PUNTO 6 EXITOSA: Rate limiting en login funcionando correctamente (429 al superar 10 intentos).');
      process.exit(0);
    } else {
      console.error('\n❌ VERIFICACIÓN PUNTO 6 FALLÓ.');
      process.exit(1);
    }
  });
};

testPunto6();
