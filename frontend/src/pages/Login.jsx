import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

export default function Login() {
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const { user, login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      const target =
        user?.rol === 'mozo' || user?.rol === 'encargado'
          ? '/pedidos-salon'
          : '/';
      navigate(target, { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setCargando(true);

    try {
      const res = await login(usuario, password);
      if (res.success) {
        const rol = res.user?.rol;
        const isMozoOEncargado = rol === 'mozo' || rol === 'encargado';
        const target = isMozoOEncargado ? '/pedidos-salon' : '/';
        navigate(target, { replace: true });
      } else {
        setError(res.error || 'Credenciales inválidas');
      }
    } catch {
      setError('Error al procesar la solicitud de ingreso');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-aleman-verde p-4 font-body">
      <div className="w-full max-w-md bg-aleman-hueso rounded-2xl border-4 border-aleman-dorado p-8 text-aleman-negro shadow-2xs">
        <div className="text-center mb-8">
          <span className="text-4xl mb-2 inline-block">🍺</span>
          <h1 className="text-3xl font-display font-bold uppercase tracking-wider text-aleman-negro">
            EL ALEMÁN
          </h1>
          <p className="text-xs font-semibold text-aleman-rojo uppercase tracking-widest mt-0.5">
            Gastronomía & Cervecería — Sistema de Gestión
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3 rounded-lg bg-rose-50 border-2 border-aleman-rojo text-aleman-rojo text-xs font-bold text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="usuario"
              className="block text-xs font-bold uppercase tracking-wider text-aleman-negro mb-1.5"
            >
              Usuario
            </label>
            <input
              id="usuario"
              type="text"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              placeholder="dueno, encargado o mozo1"
              required
              disabled={cargando}
              className="w-full px-3.5 py-2.5 bg-white border-2 border-aleman-negro/30 rounded-lg text-aleman-negro text-sm focus:outline-none focus:border-aleman-verde font-medium transition-colors"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-bold uppercase tracking-wider text-aleman-negro mb-1.5"
            >
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••"
              required
              disabled={cargando}
              className="w-full px-3.5 py-2.5 bg-white border-2 border-aleman-negro/30 rounded-lg text-aleman-negro text-sm focus:outline-none focus:border-aleman-verde font-medium transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={cargando}
            className="w-full py-3 px-4 bg-aleman-rojo hover:bg-aleman-rojo-dark text-aleman-hueso font-display font-bold uppercase tracking-wider text-base rounded-lg border-2 border-aleman-negro transition-colors cursor-pointer disabled:opacity-50"
          >
            {cargando ? 'Ingresando...' : 'Ingresar al Sistema'}
          </button>
        </form>

        <div className="mt-6 pt-4 border-t-2 border-aleman-negro/10 text-xs text-aleman-negro/70 text-center">
          <p>
            Acceso: usuarios <strong className="text-aleman-negro">dueno</strong>,{' '}
            <strong className="text-aleman-negro">encargado</strong> o{' '}
            <strong className="text-aleman-negro">mozo1</strong> / clave:{' '}
            <strong className="text-aleman-negro">1234</strong>
          </p>
        </div>
      </div>
    </div>
  );
}
