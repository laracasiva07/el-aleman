import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import RutaProtegida from './components/RutaProtegida';
import Login from './pages/Login';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/Dashboard';
import Menu from './pages/Menu';
import Stock from './pages/Stock';
import Promociones from './pages/Promociones';
import PedidosSalon from './pages/PedidosSalon';
import PedidosDelivery from './pages/PedidosDelivery';
import TakeAway from './pages/TakeAway';
import Clientes from './pages/Clientes';
import Caja from './pages/Caja';
import Gastos from './pages/Gastos';
import Reportes from './pages/Reportes';
import Usuarios from './pages/Usuarios';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Ruta pública */}
          <Route path="/login" element={<Login />} />

          {/* Rutas protegidas generales dentro de MainLayout */}
          <Route element={<RutaProtegida />}>
            <Route path="/" element={<MainLayout />}>
              {/* Rutas exclusivas para el rol "dueño" */}
              <Route element={<RutaProtegida rolesPermitidos={['dueno']} />}>
                <Route index element={<Dashboard />} />
                <Route path="menu" element={<Menu />} />
                <Route path="stock" element={<Stock />} />
                <Route path="promociones" element={<Promociones />} />
                <Route path="clientes" element={<Clientes />} />
                <Route path="usuarios" element={<Usuarios />} />
                <Route path="gastos" element={<Gastos />} />
                <Route path="reportes" element={<Reportes />} />
              </Route>

              {/* Rutas accesibles para "dueño" y "encargado" */}
              <Route element={<RutaProtegida rolesPermitidos={['dueno', 'encargado']} />}>
                <Route path="caja" element={<Caja />} />
              </Route>

              {/* Rutas accesibles para "mozo", "encargado" y "dueño" */}
              <Route
                element={
                  <RutaProtegida rolesPermitidos={['dueno', 'encargado', 'mozo']} />
                }
              >
                <Route path="pedidos-salon" element={<PedidosSalon />} />
                <Route path="pedidos-delivery" element={<PedidosDelivery />} />
                <Route path="take-away" element={<TakeAway />} />
              </Route>
            </Route>
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
