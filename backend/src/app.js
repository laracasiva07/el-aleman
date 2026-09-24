const express = require('express');
const cors = require('cors');
const mongoSanitize = require('express-mongo-sanitize');
const authRoutes = require('./routes/authRoutes');
const categoriaRoutes = require('./routes/categoriaRoutes');
const ingredienteRoutes = require('./routes/ingredienteRoutes');
const productoRoutes = require('./routes/productoRoutes');
const sectorRoutes = require('./routes/sectorRoutes');
const mesaRoutes = require('./routes/mesaRoutes');
const pedidoSalonRoutes = require('./routes/pedidoSalonRoutes');
const clienteRoutes = require('./routes/clienteRoutes');
const pedidoDeliveryRoutes = require('./routes/pedidoDeliveryRoutes');
const pedidoTakeawayRoutes = require('./routes/pedidoTakeawayRoutes');
const cajaRoutes = require('./routes/cajaRoutes');
const gastosRoutes = require('./routes/gastosRoutes');
const promocionRoutes = require('./routes/promocionRoutes');
const reportesRoutes = require('./routes/reportesRoutes');
const usuarioRoutes = require('./routes/usuarioRoutes');

const app = express();

// Middleware de CORS estricto
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'https://el-aleman-ten.vercel.app'
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Permitir solicitudes sin header Origin (ej. servidor a servidor, herramientas local) o si coincide con los orígenes permitidos
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      const error = new Error('Acceso denegado por política de CORS');
      error.isCorsError = true;
      callback(error);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(mongoSanitize());

// Rutas de la API
app.use('/api/auth', authRoutes);
app.use('/api/categorias', categoriaRoutes);
app.use('/api/ingredientes', ingredienteRoutes);
app.use('/api/productos', productoRoutes);
app.use('/api/sectores', sectorRoutes);
app.use('/api/mesas', mesaRoutes);
app.use('/api/pedidos-salon', pedidoSalonRoutes);
app.use('/api/clientes', clienteRoutes);
app.use('/api/pedidos-delivery', pedidoDeliveryRoutes);
app.use('/api/pedidos-takeaway', pedidoTakeawayRoutes);
app.use('/api/caja', cajaRoutes);
app.use('/api/gastos', gastosRoutes);
app.use('/api/promociones', promocionRoutes);
app.use('/api/reportes', reportesRoutes);
app.use('/api/usuarios', usuarioRoutes);

// Ruta de comprobación de estado de la API
app.get('/api/health', (req, res) => {
  res.json({ estado: 'OK', sistema: 'El Alemán Backend API' });
});

// Manejador de rutas no encontradas (404)
app.use((req, res) => {
  res.status(404).json({ mensaje: 'Ruta no encontrada' });
});

// Manejador global de errores (captura errores de CORS)
app.use((err, req, res, next) => {
  if (err && (err.isCorsError || (err.message && err.message.includes('CORS')))) {
    return res.status(403).json({ mensaje: 'Acceso denegado por política de CORS' });
  }
  res.status(err.status || 500).json({ mensaje: err.message || 'Error interno del servidor' });
});

module.exports = app;
