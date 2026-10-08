import React, { createContext, useContext, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';

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

  // Máximo 4 toasts visibles simultáneos
  const toastsVisibles = toasts.slice(-4);

  const portalContent = (
    <aside
      aria-label="Notificaciones"
      aria-live="polite"
      className="fixed top-20 left-4 right-4 sm:left-auto sm:right-6 sm:top-20 z-[100000] flex flex-col gap-2 max-w-[calc(100vw-2rem)] sm:max-w-md w-auto pointer-events-none items-end"
      style={{ isolation: 'isolate' }}
    >
      {toastsVisibles.map((t) => {
        let icono = 'ℹ️';
        if (t.tipo === 'success' || t.tipo === 'exito') {
          icono = '✅';
        } else if (t.tipo === 'error' || t.tipo === 'danger') {
          icono = '❌';
        } else if (t.tipo === 'warning' || t.tipo === 'aviso') {
          icono = '⚠️';
        }

        return (
          <div
            key={t.id}
            role="alert"
            onClick={() => removeToast(t.id)}
            className="pointer-events-auto bg-aleman-verde text-aleman-hueso text-sm font-semibold px-4 py-2.5 rounded-sm shadow-md flex items-center gap-2.5 border-2 border-aleman-dorado cursor-pointer select-none toast-pop-in max-w-full"
            title="Click para cerrar notificación"
          >
            <span className="text-base shrink-0 select-none leading-none">{icono}</span>
            <span className="whitespace-pre-line flex-1 leading-snug break-words">
              {t.mensaje}
            </span>
          </div>
        );
      })}
    </aside>
  );

  return (
    <ToastContext.Provider value={{ showToast, toast }}>
      {children}
      {typeof document !== 'undefined' ? createPortal(portalContent, document.body) : null}
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
