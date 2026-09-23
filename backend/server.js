require('dotenv').config();

// Validación fatal de variables de entorno críticas
if (!process.env.JWT_SECRET || !process.env.JWT_SECRET.trim()) {
  console.error('FATAL ERROR: La variable de entorno JWT_SECRET no está configurada o está vacía.');
  process.exit(1);
}

if (!process.env.MONGO_URI || !process.env.MONGO_URI.trim()) {
  console.error('FATAL ERROR: La variable de entorno MONGO_URI no está configurada o está vacía.');
  process.exit(1);
}

const app = require('./src/app');
const conectarDB = require('./src/config/db');

const PORT = process.env.PORT || 5000;

// Conectar a la base de datos e iniciar el servidor
conectarDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Servidor "El Alemán" corriendo en puerto ${PORT}`);
  });
});
