const fs = require('fs');
const path = require('path');

const files = [
  'frontend/src/pages/Clientes.jsx',
  'frontend/src/pages/TakeAway.jsx',
  'frontend/src/pages/PedidosDelivery.jsx'
];

files.forEach(relPath => {
  const fullPath = path.join(__dirname, '../../..', relPath);
  const content = fs.readFileSync(fullPath, 'utf8');
  const lines = content.split('\n');

  console.log(`\n========================================`);
  console.log(`FILE: ${relPath}`);
  console.log(`========================================`);

  lines.forEach((line, idx) => {
    if (line.includes('esDueno') || line.includes('puedeModificarComanda')) {
      console.log(`L${idx + 1}: ${line.trim()}`);
    }
  });
});
