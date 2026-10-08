import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

// Iconos vectoriales limpios y consistentes en recuadro cuadrado
function ToastIcon({ tipo }) {
  if (tipo === 'success' || tipo === 'exito') {
    return (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    );
  }
  if (tipo === 'warning' || tipo === 'aviso') {
    return (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 18.75h.007v.008H12v-.008z" />
      </svg>
    );
  }
  if (tipo === 'error' || tipo === 'danger') {
    return (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    );
  }
  // info
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
    </svg>
  );
}

// Configuración de tokens visuales de El Alemán por variante
const VARIANTES_ESTILO = {
  success: {
    contenedor: 'bg-aleman-verde border-aleman-dorado text-aleman-hueso',
    cajaIcono: 'border-aleman-dorado bg-aleman-verde-dark text-aleman-dorado',
    titulo: 'text-aleman-dorado',
    detalle: 'text-aleman-crema',
    progreso: 'bg-aleman-dorado',
    botonCerrar: 'text-aleman-hueso/80 hover:text-aleman-dorado hover:bg-aleman-verde-dark',
  },
  warning: {
    contenedor: 'bg-aleman-dorado border-aleman-verde text-aleman-negro',
    cajaIcono: 'border-aleman-verde bg-aleman-dorado-light text-aleman-verde-dark',
    titulo: 'text-aleman-verde-dark',
    detalle: 'text-aleman-negro',
    progreso: 'bg-aleman-verde',
    botonCerrar: 'text-aleman-negro/80 hover:text-aleman-verde-dark hover:bg-aleman-dorado-light',
  },
  error: {
    contenedor: 'bg-aleman-rojo border-aleman-dorado text-aleman-hueso',
    cajaIcono: 'border-aleman-dorado bg-aleman-rojo-dark text-aleman-dorado',
    titulo: 'text-aleman-dorado',
    detalle: 'text-aleman-crema',
    progreso: 'bg-aleman-dorado',
    botonCerrar: 'text-aleman-hueso/80 hover:text-aleman-dorado hover:bg-aleman-rojo-dark',
  },
  info: {
    contenedor: 'bg-aleman-crema border-aleman-verde text-aleman-negro',
    cajaIcono: 'border-aleman-verde bg-white text-aleman-verde',
    titulo: 'text-aleman-verde',
    detalle: 'text-aleman-negro',
    progreso: 'bg-aleman-verde',
    botonCerrar: 'text-aleman-negro/70 hover:text-aleman-verde hover:bg-white',
  },
};

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
        : 3500;
    const tiempo = duracion !== undefined ? duracion : duracionPorDefecto;

    const id = Date.now() + Math.random().toString(36).substring(2, 7);
    setToasts((prev) => [...prev, { id, mensaje, tipo, duracion: tiempo }]);

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

  // Máximo 4 toasts visibles simultáneamente
  const toastsVisibles = toasts.slice(-4);

  return (
    <ToastContext.Provider value={{ showToast, toast }}>
      {children}
      {/* Contenedor flotante de Toasts */}
      <aside
        aria-label="Notificaciones"
        aria-live="polite"
        className="fixed top-4 left-4 right-4 sm:left-auto sm:right-6 sm:top-6 z-[9999] flex flex-col gap-2.5 max-w-[calc(100vw-2rem)] sm:max-w-md w-full pointer-events-none"
        style={{ isolation: 'isolate' }}
      >
        {toastsVisibles.map((t) => {
          const tipoNormalizado =
            t.tipo === 'exito'
              ? 'success'
              : t.tipo === 'danger'
              ? 'error'
              : t.tipo === 'aviso'
              ? 'warning'
              : t.tipo || 'info';

          const conf = VARIANTES_ESTILO[tipoNormalizado] || VARIANTES_ESTILO.info;

          // Separación de primera línea si hay saltos de línea (\n o \n\n)
          const partes = String(t.mensaje).split(/\n+/);
          const tieneTituloYDetalle = partes.length > 1;
          const lineaTitulo = partes[0];
          const lineasDetalle = partes.slice(1).join('\n');

          return (
            <div
              key={t.id}
              role="alert"
              className={`relative pointer-events-auto p-3 sm:p-3.5 border-2 rounded-sm shadow-xs flex items-start gap-3 toast-enter-anim overflow-hidden ${conf.contenedor}`}
            >
              {/* Recuadro cuadrado con borde para el ícono */}
              <div
                className={`w-7 h-7 shrink-0 rounded-xs border-2 flex items-center justify-center mt-0.5 ${conf.cajaIcono}`}
              >
                <ToastIcon tipo={tipoNormalizado} />
              </div>

              {/* Contenido del mensaje */}
              <div className="flex-1 min-w-0 pr-1">
                {tieneTituloYDetalle ? (
                  <>
                    <h5
                      className={`font-display font-bold uppercase tracking-wider text-xs sm:text-sm leading-tight mb-1 ${conf.titulo}`}
                    >
                      {lineaTitulo}
                    </h5>
                    <p
                      className={`font-body text-xs sm:text-sm leading-relaxed whitespace-pre-line break-words ${conf.detalle}`}
                    >
                      {lineasDetalle}
                    </p>
                  </>
                ) : (
                  <p
                    className={`font-body text-xs sm:text-sm font-semibold leading-snug break-words ${conf.detalle}`}
                  >
                    {t.mensaje}
                  </p>
                )}
              </div>

              {/* Botón de cierre discreto */}
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className={`shrink-0 -mr-1 -mt-1 p-1 rounded-xs transition-colors cursor-pointer ${conf.botonCerrar}`}
                title="Cerrar notificación"
                aria-label="Cerrar notificación"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Barra de progreso fina en la base */}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/15 overflow-hidden">
                <div
                  className={`h-full toast-progress-anim ${conf.progreso}`}
                  style={{ animationDuration: `${t.duracion}ms` }}
                />
              </div>
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
