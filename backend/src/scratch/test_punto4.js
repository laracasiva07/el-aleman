require('dotenv').config();
const app = require('../app');

const testPunto4 = async () => {
  const server = app.listen(0, async () => {
    const port = server.address().port;
    const baseUrl = `http://localhost:${port}`;

    console.log(`Servidor CORS corriendo en puerto ${port}`);

    let allPassed = true;

    // Test 1: Origen Permitido (http://localhost:5173)
    try {
      const resAllowed = await fetch(`${baseUrl}/api/health`, {
        headers: { 'Origin': 'http://localhost:5173' }
      });
      console.log(`Origin http://localhost:5173 -> Status: ${resAllowed.status}`);
      if (resAllowed.status === 200) {
        console.log('PASS: Solicitud de origen permitido aceptada correctamente.');
      } else {
        console.error('FAIL: Origen permitido fue rechazado.');
        allPassed = false;
      }
    } catch (err) {
      console.error('ERROR en Origen Permitido:', err.message);
      allPassed = false;
    }

    // Test 2: Origen No Autorizado (http://sitio-malicioso.com) -> debe devolver 403
    try {
      const resDisallowed = await fetch(`${baseUrl}/api/health`, {
        headers: { 'Origin': 'http://sitio-malicioso.com' }
      });
      const dataDisallowed = await resDisallowed.json();
      console.log(`Origin http://sitio-malicioso.com -> Status: ${resDisallowed.status}, Mensaje: "${dataDisallowed.mensaje}"`);

      if (resDisallowed.status === 403 && dataDisallowed.mensaje === 'Acceso denegado por política de CORS') {
        console.log('PASS: Origen no autorizado devolvió HTTP 403 con mensaje de rechazo limpio.');
      } else {
        console.error(`FAIL: Se esperaba 403 con mensaje de CORS pero se obtuvo Status: ${resDisallowed.status}`);
        allPassed = false;
      }
    } catch (err) {
      console.error('ERROR en Origen No Autorizado:', err.message);
      allPassed = false;
    }

    server.close();

    if (allPassed) {
      console.log('\n✅ VERIFICACIÓN REVISIÓN PUNTO 4 EXITOSA: CORS responde HTTP 403 sin expender stacktrace ni 500.');
      process.exit(0);
    } else {
      console.error('\n❌ VERIFICACIÓN REVISIÓN PUNTO 4 FALLÓ.');
      process.exit(1);
    }
  });
};

testPunto4();
