import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [modalState, setModalState] = useState(null);
  const resolverRef = useRef(null);
  const cancelBtnRef = useRef(null);

  const confirmar = useCallback(({
    titulo = 'Confirmar acción',
    mensaje = '¿Estás seguro de que deseas continuar?',
    textoConfirmar = 'Confirmar',
    textoCancelar = 'Cancelar',
    variante = 'peligro', // 'peligro' | 'normal'
  }) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setModalState({
        titulo,
        mensaje,
        textoConfirmar,
        textoCancelar,
        variante,
      });
    });
  }, []);

  const handleClose = useCallback((resultado) => {
    if (resolverRef.current) {
      resolverRef.current(resultado);
      resolverRef.current = null;
    }
    setModalState(null);
  }, []);

  // Foco inicial en botón cancelar y escucha de Escape
  useEffect(() => {
    if (modalState) {
      const timer = setTimeout(() => {
        cancelBtnRef.current?.focus();
      }, 50);

      const handleKeyDown = (e) => {
        if (e.key === 'Escape') {
          handleClose(false);
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [modalState, handleClose]);

  return (
    <ConfirmContext.Provider value={{ confirmar }}>
      {children}
      {modalState && (
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-aleman-negro/80 backdrop-blur-xs animate-backdropFade"
          style={{ isolation: 'isolate' }}
          onClick={() => handleClose(false)}
        >
          <div
            className="bg-aleman-hueso border-3 border-aleman-negro rounded-sm max-w-md w-full p-6 shadow-2xl animate-modalEnter"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-modal-title"
          >
            <h3
              id="confirm-modal-title"
              className="text-2xl font-display font-bold uppercase tracking-wider text-aleman-negro mb-3"
            >
              {modalState.titulo}
            </h3>
            <p className="font-body text-base text-aleman-negro/85 leading-relaxed mb-6 whitespace-pre-line">
              {modalState.mensaje}
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t-2 border-aleman-negro/15">
              <button
                ref={cancelBtnRef}
                type="button"
                onClick={() => handleClose(false)}
                className="px-4 py-2 text-sm font-bold uppercase tracking-wider text-aleman-negro hover:bg-aleman-crema border-2 border-aleman-negro/30 rounded-sm transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-aleman-negro"
              >
                {modalState.textoCancelar}
              </button>
              <button
                type="button"
                onClick={() => handleClose(true)}
                className={`px-5 py-2 text-sm font-bold uppercase tracking-wider text-aleman-hueso border-2 border-aleman-negro rounded-sm transition-colors cursor-pointer ${
                  modalState.variante === 'peligro'
                    ? 'bg-aleman-rojo hover:bg-aleman-rojo-dark'
                    : 'bg-aleman-verde hover:bg-aleman-verde-dark'
                }`}
              >
                {modalState.textoConfirmar}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm debe ser utilizado dentro de un ConfirmProvider');
  }
  return context;
}
