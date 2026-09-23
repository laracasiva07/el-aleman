import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

export default function RutaProtegida({ rolesPermitidos }) {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (rolesPermitidos && !rolesPermitidos.includes(user?.rol)) {
    const fallbackPath =
      user?.rol === 'mozo' || user?.rol === 'encargado'
        ? '/pedidos-salon'
        : '/';
    return <Navigate to={fallbackPath} replace />;
  }

  return <Outlet />;
}
