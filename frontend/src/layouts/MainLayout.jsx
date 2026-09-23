import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';

const navItems = [
  { name: 'Dashboard', path: '/', roles: ['dueno'] },
  { name: 'Menú', path: '/menu', roles: ['dueno'] },
  { name: 'Stock', path: '/stock', roles: ['dueno'] },
  { name: 'Promociones', path: '/promociones', roles: ['dueno'] },
  { name: 'Pedidos Salón', path: '/pedidos-salon', roles: ['dueno', 'encargado', 'mozo'] },
  { name: 'Pedidos Delivery', path: '/pedidos-delivery', roles: ['dueno', 'encargado', 'mozo'] },
  { name: 'Take Away', path: '/take-away', roles: ['dueno', 'encargado', 'mozo'] },
  { name: 'Clientes', path: '/clientes', roles: ['dueno'] },
  { name: 'Usuarios', path: '/usuarios', roles: ['dueno'] },
  { name: 'Caja', path: '/caja', roles: ['dueno', 'encargado'] },
  { name: 'Gastos', path: '/gastos', roles: ['dueno'] },
  { name: 'Reportes', path: '/reportes', roles: ['dueno'] },
];

function NavigationLinks({ items, onItemClick }) {
  return (
    <>
      {items.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.path === '/'}
          onClick={onItemClick}
          className={({ isActive }) =>
            `flex items-center px-4 py-2.5 rounded-lg text-base font-medium transition-colors font-body ${
              isActive
                ? 'bg-aleman-verde-dark text-aleman-hueso font-bold border-l-4 border-aleman-dorado'
                : 'text-aleman-hueso/80 hover:bg-aleman-verde-dark/60 hover:text-aleman-dorado border-l-4 border-transparent'
            }`
          }
        >
          {item.name}
        </NavLink>
      ))}
    </>
  );
}

export default function MainLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const visibleNavItems = navItems.filter(
    (item) => user && item.roles.includes(user.rol)
  );

  // Close drawer on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsMobileMenuOpen(false);
      }
    };
    if (isMobileMenuOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMobileMenuOpen]);

  return (
    <div className="flex h-screen bg-aleman-crema font-body text-aleman-negro">
      {/* Desktop Fixed Sidebar (md:flex) */}
      <aside className="hidden md:flex w-64 bg-aleman-verde text-aleman-hueso flex-col flex-shrink-0 border-r-2 border-aleman-negro/40">
        <div className="h-16 flex items-center gap-2.5 px-6 border-b-2 border-aleman-dorado bg-aleman-verde-dark font-display font-bold text-xl text-aleman-hueso tracking-wider">
          <span className="text-xl">🍺</span>
          <div className="leading-tight">
            <span className="block text-lg">EL ALEMÁN</span>
            <span className="block text-xs text-aleman-dorado font-body font-semibold tracking-widest uppercase">
              Gastronomía
            </span>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          <NavigationLinks items={visibleNavItems} />
        </nav>
      </aside>

      {/* Mobile Drawer Overlay / Backdrop */}
      <div
        className={`fixed inset-0 bg-aleman-negro/60 backdrop-blur-sm z-40 transition-opacity duration-300 md:hidden ${
          isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsMobileMenuOpen(false)}
        aria-hidden="true"
      />

      {/* Mobile Offcanvas Drawer Panel */}
      <aside
        className={`fixed inset-y-0 left-0 w-64 max-w-[85vw] bg-aleman-verde text-aleman-hueso flex flex-col z-50 shadow-2xl border-r-2 border-aleman-negro/40 transition-transform duration-300 ease-in-out md:hidden ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Navegación móvil"
      >
        <div className="h-16 flex items-center justify-between px-5 border-b-2 border-aleman-dorado bg-aleman-verde-dark font-display font-bold text-xl text-aleman-hueso tracking-wider flex-shrink-0">
          <div className="flex items-center gap-2.5 leading-tight">
            <span className="text-xl">🍺</span>
            <div>
              <span className="block text-lg">EL ALEMÁN</span>
              <span className="block text-xs text-aleman-dorado font-body font-semibold tracking-widest uppercase">
                Gastronomía
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(false)}
            className="p-1.5 rounded-lg text-aleman-hueso/80 hover:text-aleman-dorado hover:bg-aleman-verde transition-colors cursor-pointer"
            aria-label="Cerrar menú"
            title="Cerrar menú"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          <NavigationLinks
            items={visibleNavItems}
            onItemClick={() => setIsMobileMenuOpen(false)}
          />
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-16 bg-aleman-verde border-b-[3px] border-aleman-dorado flex items-center justify-between px-3 md:px-6 flex-shrink-0 text-aleman-hueso">
          <div className="flex items-center gap-2.5 md:gap-4 min-w-0">
            {/* Hamburger button (mobile only) */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-1.5 rounded-lg text-aleman-hueso hover:text-aleman-dorado hover:bg-aleman-verde-dark transition-colors cursor-pointer flex-shrink-0"
              aria-label="Abrir menú"
              title="Abrir menú"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div className="min-w-0">
              <h1 className="text-lg md:text-2xl font-display font-bold uppercase tracking-wider text-aleman-hueso leading-tight truncate">
                EL ALEMÁN
              </h1>
              <p className="hidden sm:block text-xs font-body text-aleman-dorado uppercase tracking-widest font-semibold leading-none">
                Sistema de Gestión
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
            {user && (
              <span className="text-xs md:text-sm font-semibold bg-aleman-verde-dark text-aleman-dorado px-2.5 py-1 md:px-3 md:py-1 rounded-full border border-aleman-dorado/40 font-body whitespace-nowrap">
                Rol:{' '}
                {user.rol === 'encargado'
                  ? 'Encargado'
                  : user.rol === 'dueno'
                  ? 'Dueño'
                  : user.rol === 'mozo' || user.rol?.toLowerCase() === 'mozo'
                  ? 'Mozo'
                  : user.rol
                  ? user.rol.charAt(0).toUpperCase() + user.rol.slice(1)
                  : ''}
              </span>
            )}
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 md:px-3.5 md:py-1.5 text-xs md:text-sm font-bold text-aleman-hueso bg-aleman-rojo hover:bg-aleman-rojo-dark rounded-lg transition-colors border border-aleman-negro/60 cursor-pointer font-body uppercase tracking-wider whitespace-nowrap"
              title="Cerrar sesión"
            >
              <span>Cerrar sesión</span>
            </button>
          </div>
        </header>

        {/* Dynamic Page Outlet */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-aleman-crema font-body text-aleman-negro">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
