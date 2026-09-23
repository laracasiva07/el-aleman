import { useState, useEffect, useMemo } from 'react';
import apiClient from '../services/apiClient';

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [toastMessage, setToastMessage] = useState(null);

  // Modales
  const [isModalNuevoOpen, setIsModalNuevoOpen] = useState(false);
  const [isModalEditarOpen, setIsModalEditarOpen] = useState(false);
  const [isModalPasswordOpen, setIsModalPasswordOpen] = useState(false);

  // Usuario seleccionado para editar / cambiar password
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(null);

  // Formulario Nuevo Usuario
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoLogin, setNuevoLogin] = useState('');
  const [nuevoPassword, setNuevoPassword] = useState('');
  const [nuevoRol, setNuevoRol] = useState('mozo');
  const [errorNuevo, setErrorNuevo] = useState('');

  // Formulario Editar Usuario
  const [editNombre, setEditNombre] = useState('');
  const [editRol, setEditRol] = useState('mozo');
  const [errorEditar, setErrorEditar] = useState('');

  // Formulario Resetear Contraseña
  const [nuevoPassInput, setNuevoPassInput] = useState('');
  const [confirmPassInput, setConfirmPassInput] = useState('');
  const [errorPassword, setErrorPassword] = useState('');

  const showToast = (msg, tipo = 'exito') => {
    setToastMessage({ texto: msg, tipo });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Cargar usuarios desde backend
  const cargarUsuarios = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/usuarios');
      setUsuarios(res.data?.usuarios || []);
    } catch (err) {
      showToast(err.response?.data?.mensaje || 'Error al cargar listado de usuarios', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarUsuarios();
  }, []);

  // Filtrado por búsqueda
  const usuariosFiltrados = useMemo(() => {
    return usuarios.filter((u) => {
      const q = busqueda.toLowerCase().trim();
      if (!q) return true;
      return (
        (u.nombre && u.nombre.toLowerCase().includes(q)) ||
        (u.login && u.login.toLowerCase().includes(q)) ||
        (u.rol && u.rol.toLowerCase().includes(q))
      );
    });
  }, [usuarios, busqueda]);

  // ==========================================
  // CREAR USUARIO
  // ==========================================
  const handleAbrirNuevo = () => {
    setNuevoNombre('');
    setNuevoLogin('');
    setNuevoPassword('');
    setNuevoRol('mozo');
    setErrorNuevo('');
    setIsModalNuevoOpen(true);
  };

  const handleCrearUsuario = async (e) => {
    e.preventDefault();
    setErrorNuevo('');

    if (!nuevoNombre.trim()) {
      setErrorNuevo('El nombre es obligatorio.');
      return;
    }
    if (!nuevoLogin.trim()) {
      setErrorNuevo('El login es obligatorio.');
      return;
    }
    if (!nuevoPassword || nuevoPassword.length < 4) {
      setErrorNuevo('La contraseña debe tener al menos 4 caracteres.');
      return;
    }

    try {
      await apiClient.post('/usuarios', {
        nombre: nuevoNombre.trim(),
        login: nuevoLogin.trim(),
        password: nuevoPassword,
        rol: nuevoRol,
      });

      showToast('Usuario creado con éxito');
      setIsModalNuevoOpen(false);
      cargarUsuarios();
    } catch (err) {
      setErrorNuevo(err.response?.data?.mensaje || 'Error al crear usuario');
    }
  };

  // ==========================================
  // EDITAR USUARIO (Nombre / Rol)
  // ==========================================
  const handleAbrirEditar = (usr) => {
    setUsuarioSeleccionado(usr);
    setEditNombre(usr.nombre);
    setEditRol(usr.rol);
    setErrorEditar('');
    setIsModalEditarOpen(true);
  };

  const handleEditarUsuario = async (e) => {
    e.preventDefault();
    setErrorEditar('');

    if (!editNombre.trim()) {
      setErrorEditar('El nombre es obligatorio.');
      return;
    }

    try {
      await apiClient.patch(`/usuarios/${usuarioSeleccionado._id || usuarioSeleccionado.id}`, {
        nombre: editNombre.trim(),
        rol: editRol,
      });

      showToast('Usuario actualizado correctamente');
      setIsModalEditarOpen(false);
      cargarUsuarios();
    } catch (err) {
      setErrorEditar(err.response?.data?.mensaje || 'Error al actualizar usuario');
    }
  };

  // ==========================================
  // RESETEAR CONTRASEÑA
  // ==========================================
  const handleAbrirPassword = (usr) => {
    setUsuarioSeleccionado(usr);
    setNuevoPassInput('');
    setConfirmPassInput('');
    setErrorPassword('');
    setIsModalPasswordOpen(true);
  };

  const handleResetearPassword = async (e) => {
    e.preventDefault();
    setErrorPassword('');

    if (!nuevoPassInput || nuevoPassInput.length < 4) {
      setErrorPassword('La nueva contraseña debe tener al menos 4 caracteres.');
      return;
    }
    if (nuevoPassInput !== confirmPassInput) {
      setErrorPassword('Las contraseñas no coinciden.');
      return;
    }

    try {
      await apiClient.patch(`/usuarios/${usuarioSeleccionado._id || usuarioSeleccionado.id}/password`, {
        password: nuevoPassInput,
      });

      showToast(`Contraseña actualizada para ${usuarioSeleccionado.nombre}`);
      setIsModalPasswordOpen(false);
    } catch (err) {
      setErrorPassword(err.response?.data?.mensaje || 'Error al cambiar la contraseña');
    }
  };

  // ==========================================
  // TOGGLE ESTADO ACTIVO / INACTIVO
  // ==========================================
  const handleToggleActivo = async (usr) => {
    try {
      const res = await apiClient.patch(`/usuarios/${usr._id || usr.id}/activo`);
      const updated = res.data?.usuario;
      const estadoTexto = updated?.activo ? 'activado' : 'desactivado';
      showToast(`Usuario ${usr.nombre} ${estadoTexto}`);
      
      setUsuarios((prev) =>
        prev.map((u) =>
          (u._id || u.id) === (usr._id || usr.id) ? { ...u, activo: updated?.activo } : u
        )
      );
    } catch (err) {
      showToast(err.response?.data?.mensaje || 'Error al cambiar estado de usuario', 'error');
    }
  };

  // Helper para badge de rol
  const renderRolBadge = (rol) => {
    switch (rol) {
      case 'dueno':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
            Dueño
          </span>
        );
      case 'encargado':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-900 border border-blue-300">
            Encargado
          </span>
        );
      case 'mozo':
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
            Mozo
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div
          className={`fixed top-20 right-6 z-50 px-4 py-3 rounded-lg shadow-lg border-2 font-bold text-sm transition-all duration-300 flex items-center gap-2 ${
            toastMessage.tipo === 'error'
              ? 'bg-red-100 text-red-900 border-red-500'
              : 'bg-emerald-100 text-emerald-900 border-emerald-500'
          }`}
        >
          <span>{toastMessage.tipo === 'error' ? '⚠️' : '✅'}</span>
          <span>{toastMessage.texto}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-aleman-verde p-4 md:p-6 rounded-xl border-2 border-aleman-dorado shadow-md text-aleman-hueso">
        <div>
          <h1 className="text-xl md:text-2xl font-display font-bold uppercase tracking-wider text-aleman-hueso flex items-center gap-2">
            <span>👤</span> Gestión de Usuarios
          </h1>
          <p className="text-xs md:text-sm text-aleman-dorado mt-1">
            Administración de accesos, roles y contraseñas del personal.
          </p>
        </div>

        <button
          type="button"
          onClick={handleAbrirNuevo}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-aleman-dorado hover:bg-aleman-dorado-dark text-aleman-negro font-bold rounded-lg border border-aleman-negro transition-colors cursor-pointer shadow-sm text-sm uppercase tracking-wider whitespace-nowrap"
        >
          <span>➕</span> Nuevo Usuario
        </button>
      </div>

      {/* Filtros y búsqueda */}
      <div className="bg-white p-4 rounded-xl border-2 border-aleman-negro/20 shadow-sm">
        <div className="relative">
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar usuario por nombre, login o rol..."
            className="w-full pl-10 pr-4 py-2 bg-aleman-crema/40 border border-aleman-negro/30 rounded-lg text-sm text-aleman-negro focus:outline-none focus:ring-2 focus:ring-aleman-verde"
          />
          <span className="absolute left-3 top-2.5 text-gray-400">🔍</span>
        </div>
      </div>

      {/* Contenido Listado */}
      {loading ? (
        <div className="text-center py-12 bg-white rounded-xl border-2 border-aleman-negro/20">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-aleman-verde border-t-transparent"></div>
          <p className="mt-3 text-sm font-semibold text-gray-600">Cargando usuarios...</p>
        </div>
      ) : usuariosFiltrados.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border-2 border-aleman-negro/20 text-gray-500">
          <span className="text-3xl block mb-2">👤</span>
          <p className="font-bold text-base">No se encontraron usuarios</p>
          <p className="text-xs text-gray-400 mt-1">
            {busqueda ? 'Intenta modificar el término de búsqueda' : 'Haz clic en "Nuevo Usuario" para agregar el primero.'}
          </p>
        </div>
      ) : (
        <>
          {/* VISTA DESKTOP: Tabla */}
          <div className="hidden md:block bg-white rounded-xl border-2 border-aleman-negro/20 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-aleman-verde-dark text-aleman-hueso text-xs uppercase tracking-wider font-display border-b-2 border-aleman-dorado">
                  <th className="py-3.5 px-4 font-bold">Nombre</th>
                  <th className="py-3.5 px-4 font-bold">Login</th>
                  <th className="py-3.5 px-4 font-bold">Rol</th>
                  <th className="py-3.5 px-4 font-bold text-center">Estado</th>
                  <th className="py-3.5 px-4 font-bold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-sm">
                {usuariosFiltrados.map((usr) => (
                  <tr key={usr._id || usr.id} className="hover:bg-aleman-crema/40 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-aleman-negro">{usr.nombre}</td>
                    <td className="py-3.5 px-4 font-mono text-xs text-gray-600">{usr.login}</td>
                    <td className="py-3.5 px-4">{renderRolBadge(usr.rol)}</td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleActivo(usr)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-colors cursor-pointer ${
                          usr.activo
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-400 hover:bg-emerald-200'
                            : 'bg-red-100 text-red-800 border-red-400 hover:bg-red-200'
                        }`}
                        title="Haz clic para activar/desactivar"
                      >
                        <span className={`w-2 h-2 rounded-full ${usr.activo ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                        <span>{usr.activo ? 'Activo' : 'Inactivo'}</span>
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleAbrirEditar(usr)}
                          className="px-2.5 py-1.5 text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 rounded border border-gray-300 transition-colors cursor-pointer"
                          title="Editar nombre y rol"
                        >
                          ✏️ Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAbrirPassword(usr)}
                          className="px-2.5 py-1.5 text-xs font-semibold bg-amber-50 text-amber-900 hover:bg-amber-100 rounded border border-amber-300 transition-colors cursor-pointer"
                          title="Resetear contraseña"
                        >
                          🔑 Contraseña
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* VISTA MOBILE: Cards apiladas */}
          <div className="block md:hidden space-y-4">
            {usuariosFiltrados.map((usr) => (
              <div
                key={usr._id || usr.id}
                className="bg-white p-4 rounded-xl border-2 border-aleman-negro/20 shadow-sm space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-base text-aleman-negro">{usr.nombre}</h3>
                    <p className="text-xs font-mono text-gray-500 mt-0.5">@{usr.login}</p>
                  </div>
                  {renderRolBadge(usr.rol)}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => handleToggleActivo(usr)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-colors cursor-pointer ${
                      usr.activo
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-400'
                        : 'bg-red-100 text-red-800 border-red-400'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${usr.activo ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                    <span>{usr.activo ? 'Activo' : 'Inactivo'}</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleAbrirEditar(usr)}
                      className="px-2.5 py-1.5 text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 rounded border border-gray-300 transition-colors"
                    >
                      ✏️ Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAbrirPassword(usr)}
                      className="px-2.5 py-1.5 text-xs font-semibold bg-amber-50 text-amber-900 hover:bg-amber-100 rounded border border-amber-300 transition-colors"
                    >
                      🔑 Pass
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* MODAL NUEVO USUARIO */}
      {isModalNuevoOpen && (
        <div className="fixed inset-0 bg-aleman-negro/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border-2 border-aleman-negro shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-aleman-verde px-5 py-4 border-b-2 border-aleman-dorado flex items-center justify-between text-aleman-hueso">
              <h2 className="font-display font-bold text-lg uppercase tracking-wider flex items-center gap-2">
                <span>➕</span> Nuevo Usuario
              </h2>
              <button
                type="button"
                onClick={() => setIsModalNuevoOpen(false)}
                className="text-aleman-hueso/80 hover:text-aleman-dorado text-xl font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCrearUsuario} className="p-5 space-y-4">
              {errorNuevo && (
                <div className="p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-bold rounded">
                  ⚠️ {errorNuevo}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-aleman-negro mb-1">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  required
                  value={nuevoNombre}
                  onChange={(e) => setNuevoNombre(e.target.value)}
                  placeholder="Ej: Carlos Pérez"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-aleman-verde focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-aleman-negro mb-1">
                  Nombre de Usuario (Login) *
                </label>
                <input
                  type="text"
                  required
                  value={nuevoLogin}
                  onChange={(e) => setNuevoLogin(e.target.value)}
                  placeholder="Ej: cperez"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-aleman-verde focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-aleman-negro mb-1">
                  Contraseña * (mín. 4 caracteres)
                </label>
                <input
                  type="password"
                  required
                  minLength={4}
                  value={nuevoPassword}
                  onChange={(e) => setNuevoPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-aleman-verde focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-aleman-negro mb-1">
                  Rol del Usuario *
                </label>
                <select
                  value={nuevoRol}
                  onChange={(e) => setNuevoRol(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-aleman-verde focus:outline-none font-semibold"
                >
                  <option value="mozo">Mozo</option>
                  <option value="encargado">Encargado</option>
                  <option value="dueno">Dueño</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalNuevoOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-lg border border-gray-300 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-aleman-verde text-aleman-hueso hover:bg-aleman-verde-dark rounded-lg border border-aleman-negro transition-colors cursor-pointer uppercase tracking-wider"
                >
                  Guardar Usuario
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDITAR USUARIO */}
      {isModalEditarOpen && usuarioSeleccionado && (
        <div className="fixed inset-0 bg-aleman-negro/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border-2 border-aleman-negro shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-aleman-verde px-5 py-4 border-b-2 border-aleman-dorado flex items-center justify-between text-aleman-hueso">
              <h2 className="font-display font-bold text-lg uppercase tracking-wider flex items-center gap-2">
                <span>✏️</span> Editar Usuario: {usuarioSeleccionado.login}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalEditarOpen(false)}
                className="text-aleman-hueso/80 hover:text-aleman-dorado text-xl font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditarUsuario} className="p-5 space-y-4">
              {errorEditar && (
                <div className="p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-bold rounded">
                  ⚠️ {errorEditar}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-aleman-negro mb-1">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  required
                  value={editNombre}
                  onChange={(e) => setEditNombre(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-aleman-verde focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-aleman-negro mb-1">
                  Rol del Usuario *
                </label>
                <select
                  value={editRol}
                  onChange={(e) => setEditRol(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-aleman-verde focus:outline-none font-semibold"
                >
                  <option value="mozo">Mozo</option>
                  <option value="encargado">Encargado</option>
                  <option value="dueno">Dueño</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalEditarOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-lg border border-gray-300 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-aleman-verde text-aleman-hueso hover:bg-aleman-verde-dark rounded-lg border border-aleman-negro transition-colors cursor-pointer uppercase tracking-wider"
                >
                  Actualizar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL RESETEAR CONTRASEÑA */}
      {isModalPasswordOpen && usuarioSeleccionado && (
        <div className="fixed inset-0 bg-aleman-negro/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border-2 border-aleman-negro shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-aleman-verde px-5 py-4 border-b-2 border-aleman-dorado flex items-center justify-between text-aleman-hueso">
              <h2 className="font-display font-bold text-lg uppercase tracking-wider flex items-center gap-2">
                <span>🔑</span> Resetear Contraseña ({usuarioSeleccionado.login})
              </h2>
              <button
                type="button"
                onClick={() => setIsModalPasswordOpen(false)}
                className="text-aleman-hueso/80 hover:text-aleman-dorado text-xl font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleResetearPassword} className="p-5 space-y-4">
              {errorPassword && (
                <div className="p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-xs font-bold rounded">
                  ⚠️ {errorPassword}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-aleman-negro mb-1">
                  Nueva Contraseña * (mín. 4 caracteres)
                </label>
                <input
                  type="password"
                  required
                  minLength={4}
                  value={nuevoPassInput}
                  onChange={(e) => setNuevoPassInput(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-aleman-verde focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-aleman-negro mb-1">
                  Confirmar Nueva Contraseña *
                </label>
                <input
                  type="password"
                  required
                  minLength={4}
                  value={confirmPassInput}
                  onChange={(e) => setConfirmPassInput(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-aleman-verde focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalPasswordOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-lg border border-gray-300 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-aleman-dorado text-aleman-negro hover:bg-aleman-dorado-dark rounded-lg border border-aleman-negro transition-colors cursor-pointer uppercase tracking-wider"
                >
                  Cambiar Contraseña
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
