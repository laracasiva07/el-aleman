import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((mensaje, tipo = 'info', duracion) => {
    if (!mensaje) return;
    const duracionPorDefecto =
      tipo === 'error' || tipo === 'danger' || tipo === 'warning' || tipo === 'aviso'
        ? 6000
        : 3000;
    const tiempo = duracion !== undefined ? duracion : duracionPorDefecto;

    const id = Date.now() + Math.random().toString(36).substring(2, 7);
    setToasts((prev) => [...prev, { id, mensaje, tipo }]);

    setTimeout(() => {
      removeToast(id);
    }, tiempo);
  }, [removeToast]);

  const toast = {
    success: (msg, dur) => showToast(msg, 'success', dur),
    error: (msg, dur) => showToast(msg, 'error', dur),
    warning: (msg, dur) => showToast(msg, 'warning', dur),
    info: (msg, dur) => showToast(msg, 'info', dur),
  };

  return (
    <ToastContext.Provider value={{ showToast, toast }}>
      {children}
      {/* Contenedor flotante de Toasts accesible y posicionado */}
      <aside
        aria-label="Notificaciones"
        className="fixed top-4 left-4 right-4 sm:left-auto sm:right-5 sm:top-5 z-[9999] flex flex-col gap-2.5 max-w-[calc(100vw-2rem)] sm:max-w-md w-full pointer-events-none"
        style={{ isolation: 'isolate' }}
      >
        {toasts.map((t) => {
          let estilo = 'bg-aleman-hueso text-aleman-negro border-aleman-negro';
          let icono = 'ℹ️';

          if (t.tipo === 'success' || t.tipo === 'exito') {
            estilo = 'bg-aleman-verde text-aleman-hueso border-aleman-dorado';
            icono = '✅';
          } else if (t.tipo === 'error' || t.tipo === 'danger') {
            estilo = 'bg-aleman-rojo text-aleman-hueso border-aleman-negro';
            icono = '❌';
          } else if (t.tipo === 'warning' || t.tipo === 'aviso') {
            estilo = 'bg-aleman-dorado text-aleman-negro border-aleman-negro';
            icono = '⚠️';
          }

          return (
            <div
              key={t.id}
              role="alert"
              className={`pointer-events-auto p-3.5 border-2 rounded-sm shadow-md flex items-start gap-2.5 animate-modalEnter font-body text-sm ${estilo}`}
            >
              <span className="text-base select-none shrink-0 mt-0.5">{icono}</span>
              <div className="flex-1 font-semibold break-words leading-snug whitespace-pre-line">
                {t.mensaje}
              </div>
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className="shrink-0 text-xs font-bold px-1.5 py-0.5 opacity-80 hover:opacity-100 hover:scale-110 transition-all cursor-pointer"
                title="Cerrar notificación"
              >
                ✕
              </button>
            </div>
          );
        })}
      </aside>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast debe ser utilizado dentro de un ToastProvider');
  }
  return context;
}
