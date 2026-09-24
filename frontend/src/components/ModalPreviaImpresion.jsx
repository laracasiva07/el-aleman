import { useState } from 'react';
import { formatCurrency } from '../services/mockData';

/**
 * Modal de Vista Previa de Impresión de Ticket Térmico (Cliente / Cocina)
 *
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {Function} props.onClose
 * @param {Object} props.datos - Datos del pedido / mesa
 *   - canal: 'salon' | 'delivery' | 'takeaway'
 *   - mesaNumero?: number | string
 *   - numeroPedido?: number | string
 *   - cliente?: string
 *   - telefono?: string
 *   - direccion?: string
 *   - notasEntrega?: string
 *   - fecha?: string
 *   - mozo?: string
 *   - items: Array<{ nombre: string, cantidad: number, precioUnitario?: number, aclaracion?: string }>
 *   - subtotal?: number
 *   - total?: number
 *   - medioPago?: string
 *   - vistaInicial?: 'cliente' | 'cocina'
 */
export default function ModalPreviaImpresion({ isOpen, onClose, datos }) {
  const [tabActiva, setTabActiva] = useState(datos?.vistaInicial || 'cliente');
  const [imprimiendo, setImprimiendo] = useState(false);
  const [mensajeExito, setMensajeExito] = useState(null);

  if (!isOpen || !datos) return null;

  const items = datos.items || [];
  const totalCalculado =
    datos.total ??
    items.reduce(
      (acc, it) => acc + (Number(it.precioUnitario ?? it.precio ?? 0) * (Number(it.cantidad) || 1)),
      0
    );

  const fechaFormateada = datos.fecha
    ? new Date(datos.fecha).toLocaleString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : new Date().toLocaleString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

  const handleImprimirReal = () => {
    setImprimiendo(true);
    const destino = tabActiva === 'cocina' ? 'Cocina' : 'Cliente (Caja)';

    // Disparar diálogo nativo de impresión del navegador
    setTimeout(() => {
      window.print();
      setImprimiendo(false);
      setMensajeExito(`✅ Ticket de ${destino} enviado a la impresora`);
      setTimeout(() => setMensajeExito(null), 3500);
    }, 100);
  };

  const esCocina = tabActiva === 'cocina';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-aleman-negro/80 backdrop-blur-xs overflow-y-auto animate-backdropFade">
      <div className="bg-aleman-negro text-aleman-hueso rounded-sm border-2 border-aleman-dorado/40 max-w-md w-full shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Cabecera del Modal */}
        <div className="p-3.5 sm:p-4 bg-aleman-negro/90 border-b border-aleman-dorado/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🖨️</span>
            <div>
              <h3 className="font-display font-bold text-sm sm:text-base text-aleman-dorado uppercase tracking-wider">
                Vista Previa de Impresión
              </h3>
              <p className="text-[10px] text-aleman-hueso/70 font-mono">
                Simulación de ticket térmico 80mm
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-aleman-hueso/70 hover:text-white text-lg font-bold p-1 rounded transition-transform active:scale-95 cursor-pointer"
            title="Cerrar modal"
          >
            ✕
          </button>
        </div>

        {/* Toggle Selector de Tabs (Ticket Cliente vs Comanda Cocina) */}
        <div className="p-3 bg-aleman-negro/60 border-b border-aleman-hueso/10 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setTabActiva('cliente')}
            className={`flex-1 py-2 px-3 rounded-xs font-display font-bold text-xs uppercase tracking-wider transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer border ${
              !esCocina
                ? 'bg-aleman-dorado text-aleman-negro border-amber-500 shadow-md ring-2 ring-aleman-dorado/40'
                : 'bg-aleman-hueso/10 text-aleman-hueso/70 border-aleman-hueso/20 hover:bg-aleman-hueso/20 hover:text-white'
            }`}
          >
            <span>🧾</span>
            <span>Ticket Cliente</span>
          </button>

          <button
            type="button"
            onClick={() => setTabActiva('cocina')}
            className={`flex-1 py-2 px-3 rounded-xs font-display font-bold text-xs uppercase tracking-wider transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer border ${
              esCocina
                ? 'bg-aleman-verde text-aleman-hueso border-emerald-400 shadow-md ring-2 ring-emerald-500/40'
                : 'bg-aleman-hueso/10 text-aleman-hueso/70 border-aleman-hueso/20 hover:bg-aleman-hueso/20 hover:text-white'
            }`}
          >
            <span>🍳</span>
            <span>Comanda Cocina</span>
          </button>
        </div>

        {/* Notificación de éxito al simular impresión */}
        {mensajeExito && (
          <div className="bg-emerald-900/90 text-emerald-200 border-b border-emerald-500/40 p-2 text-center text-xs font-bold font-mono animate-fadeIn">
            {mensajeExito}
          </div>
        )}

        {/* Contenedor del Ticket Térmico Simulado e Imprimible */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-aleman-negro/95 flex justify-center">
          <div
            id="ticket-impresion-container"
            className="w-[285px] sm:w-[300px] relative select-none transition-all duration-300"
          >
            {/* Perforación dentada superior (no se imprime en térmicas) */}
            <div
              className="h-2.5 w-full bg-repeat-x relative z-10 no-print"
              style={{
                backgroundImage: esCocina
                  ? `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 6' width='12' height='6'%3E%3Cpath fill='%23164E2A' d='M0 6L6 0l6 6z'/%3E%3C/svg%3E")`
                  : `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 6' width='12' height='6'%3E%3Cpath fill='%23FAF7F0' d='M0 6L6 0l6 6z'/%3E%3C/svg%3E")`,
              }}
            />

            {/* CUERPO DEL TICKET */}
            <div
              className={`p-4 shadow-2xl transition-colors duration-200 ticket-cuerpo-impresion ${
                esCocina ? 'bg-aleman-verde-dark text-aleman-hueso' : 'bg-aleman-hueso text-aleman-negro'
              }`}
            >
              {esCocina ? (
                /* ========================================================= */
                /* DISEÑO: COMANDA COCINA */
                /* ========================================================= */
                <div>
                  {/* Encabezado Cocina */}
                  <div className="text-center">
                    <h2 className="font-display font-extrabold text-xl uppercase tracking-wider text-aleman-dorado leading-none">
                      🔥 COMANDA COCINA 🔥
                    </h2>
                    <p className="text-[10px] font-mono text-aleman-hueso/80 uppercase tracking-widest mt-1">
                      SECTOR ELABORACIÓN
                    </p>
                  </div>

                  <div className="my-2.5 border-t border-dashed border-aleman-dorado/40" />

                  {/* Banner destacado de Mesa / Pedido */}
                  <div className="bg-aleman-negro/40 p-2 rounded-xs border border-aleman-dorado/30 text-center">
                    <div className="font-display font-black text-2xl text-aleman-dorado uppercase leading-none">
                      {datos.mesaNumero
                        ? `MESA #${datos.mesaNumero}`
                        : datos.canal
                        ? `${datos.canal.toUpperCase()} #${datos.numeroPedido || '---'}`
                        : `PEDIDO #${datos.numeroPedido || '---'}`}
                    </div>
                    <div className="text-[10px] font-mono text-aleman-hueso/70 mt-1">
                      {fechaFormateada}
                    </div>
                  </div>

                  {/* Metadatos de Cocina */}
                  <div className="mt-2 text-xs font-mono space-y-0.5 text-aleman-hueso/90">
                    {datos.mozo && (
                      <div className="flex justify-between">
                        <span className="text-aleman-hueso/60">MOZO:</span>
                        <span className="font-bold">{datos.mozo}</span>
                      </div>
                    )}
                    {datos.cliente && (
                      <div className="flex justify-between">
                        <span className="text-aleman-hueso/60">CLIENTE:</span>
                        <span className="font-bold truncate max-w-[170px]">{datos.cliente}</span>
                      </div>
                    )}
                    {datos.notasEntrega && (
                      <div className="text-[10px] text-amber-200 mt-1 italic bg-amber-950/40 p-1 rounded border border-amber-500/20">
                        📌 {datos.notasEntrega}
                      </div>
                    )}
                  </div>

                  <div className="my-2.5 border-t border-dashed border-aleman-dorado/40" />

                  {/* Lista de Ítems sin precios (solo comida para cocina) */}
                  <div className="space-y-2 py-1">
                    {(() => {
                      const itemsCocina = items.filter((it) => {
                        if (it.categoriaTipo) return it.categoriaTipo === 'comida';
                        if (it.categoriaNombre) return it.categoriaNombre.toLowerCase() !== 'bebidas';
                        const nombre = (it.nombre || '').toLowerCase();
                        const esBebidaNombre =
                          nombre.includes('cerveza') ||
                          nombre.includes('coca') ||
                          nombre.includes('bebida') ||
                          nombre.includes('agua') ||
                          nombre.includes('gaseosa') ||
                          nombre.includes('vino') ||
                          nombre.includes('jugo') ||
                          nombre.includes('ipa');
                        return !esBebidaNombre;
                      });

                      if (itemsCocina.length === 0) {
                        return (
                          <p className="text-center text-xs font-mono italic text-aleman-hueso/60">
                            No hay ítems de cocina (comida) para preparar
                          </p>
                        );
                      }

                      return itemsCocina.map((it, idx) => (
                        <div
                          key={idx}
                          className="bg-aleman-negro/35 p-2 rounded-xs border border-aleman-hueso/15 ticket-item-box"
                        >
                          <div className="flex items-baseline gap-2">
                            <span className="font-display font-black text-xl text-aleman-dorado leading-none">
                              {it.cantidad}x
                            </span>
                            <span className="font-mono text-sm font-bold text-aleman-hueso flex-1 leading-snug break-words">
                              {it.nombre}
                            </span>
                          </div>
                          {it.aclaracion && (
                            <div className="mt-1 text-[11px] font-mono text-amber-200 bg-amber-950/70 px-2 py-1 rounded-xs border border-amber-500/40">
                              ⚠️ {it.aclaracion}
                            </div>
                          )}
                        </div>
                      ));
                    })()}
                  </div>

                  <div className="my-3 border-t border-dashed border-aleman-dorado/40" />

                  {/* Pie Cocina */}
                  <div className="text-center font-mono text-[10px] text-aleman-dorado uppercase tracking-wider font-bold">
                    ⚠️ SIN PRECIOS - SOLO USO COCINA
                  </div>
                </div>
              ) : (
                /* ========================================================= */
                /* DISEÑO: TICKET CLIENTE */
                /* ========================================================= */
                <div>
                  {/* Encabezado Local */}
                  <div className="text-center">
                    <h2 className="font-display font-black text-2xl uppercase tracking-wider text-aleman-negro leading-none">
                      EL ALEMÁN
                    </h2>
                    <p className="text-[10px] font-mono text-aleman-negro/80 uppercase tracking-widest mt-1">
                      PIZZERÍA
                    </p>
                    <p className="text-[9px] font-mono text-aleman-negro/60 mt-0.5">
                      Casa Central • Av. Corrientes 1234
                    </p>
                  </div>

                  <div className="my-2 border-t border-dashed border-aleman-negro/40" />

                  {/* Datos del Pedido */}
                  <div className="text-[11px] font-mono space-y-0.5 text-aleman-negro/90">
                    <div className="font-bold text-xs uppercase tracking-wider text-aleman-negro border-b border-dashed border-aleman-negro/20 pb-1 mb-1">
                      {datos.mesaNumero
                        ? `SALÓN • MESA #${datos.mesaNumero}`
                        : datos.canal === 'delivery'
                        ? `DELIVERY #${datos.numeroPedido || '---'}`
                        : datos.canal === 'takeaway'
                        ? `TAKE AWAY #${datos.numeroPedido || '---'}`
                        : `COMPROBANTE #${datos.numeroPedido || '---'}`}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-aleman-negro/60">FECHA:</span>
                      <span className="font-semibold">{fechaFormateada}</span>
                    </div>
                    {datos.mozo && (
                      <div className="flex justify-between">
                        <span className="text-aleman-negro/60">MOZO:</span>
                        <span className="font-semibold">{datos.mozo}</span>
                      </div>
                    )}
                    {datos.cliente && (
                      <div className="flex justify-between">
                        <span className="text-aleman-negro/60">CLIENTE:</span>
                        <span className="font-semibold truncate max-w-[160px]">{datos.cliente}</span>
                      </div>
                    )}
                    {datos.direccion && (
                      <div className="text-[10px] text-aleman-negro/70 truncate">
                        <span className="font-bold">DIR:</span> {datos.direccion}
                      </div>
                    )}
                  </div>

                  <div className="my-2 border-t border-dashed border-aleman-negro/40" />

                  {/* Tabla de Ítems */}
                  <div className="font-mono text-[11px]">
                    <div className="flex justify-between font-bold border-b border-dashed border-aleman-negro/30 pb-1 mb-1.5 text-[10px] uppercase text-aleman-negro/70">
                      <span className="w-7">CANT</span>
                      <span className="flex-1 px-1">DETALLE</span>
                      <span className="text-right w-16">IMPORTE</span>
                    </div>

                    {items.length === 0 ? (
                      <p className="text-center italic text-aleman-negro/60 py-2">
                        Sin ítems consumidos
                      </p>
                    ) : (
                      items.map((it, idx) => {
                        const cant = Number(it.cantidad) || 1;
                        const precioU = Number(it.precioUnitario ?? it.precio ?? 0);
                        const subtotalItem = precioU * cant;

                        return (
                          <div key={idx} className="mb-1.5">
                            <div className="flex justify-between items-start leading-tight">
                              <span className="font-bold w-7 text-center">{cant}x</span>
                              <span className="flex-1 px-1 font-semibold break-words">
                                {it.nombre}
                              </span>
                              <span className="text-right w-16 font-bold">
                                {formatCurrency(subtotalItem)}
                              </span>
                            </div>
                            {it.aclaracion && (
                              <div className="text-[10px] text-aleman-negro/70 pl-8 italic leading-tight mt-0.5">
                                ↳ {it.aclaracion}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="my-2.5 border-t border-dashed border-aleman-negro/40" />

                  {/* Sección Totales */}
                  <div className="font-mono space-y-1">
                    <div className="flex justify-between items-baseline pt-1">
                      <span className="font-display font-bold text-sm text-aleman-negro uppercase">
                        TOTAL:
                      </span>
                      <span className="font-display font-black text-2xl text-aleman-rojo leading-none">
                        {formatCurrency(totalCalculado)}
                      </span>
                    </div>

                    {datos.medioPago && (
                      <div className="flex justify-between text-[10px] text-aleman-negro/70 pt-1">
                        <span>MEDIO DE PAGO:</span>
                        <span className="font-bold uppercase text-aleman-negro">
                          {datos.medioPago}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="my-2.5 border-t border-dashed border-aleman-negro/40" />

                  {/* Pie Ticket */}
                  <div className="text-center space-y-0.5">
                    <p className="font-display font-bold text-xs tracking-wider uppercase text-aleman-negro">
                      ¡GRACIAS POR SU COMPRA!
                    </p>
                    <p className="text-[9px] font-mono text-aleman-negro/60">
                      Conserve este ticket como comprobante
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Perforación dentada inferior (no se imprime) */}
            <div
              className="h-2.5 w-full bg-repeat-x relative z-10 no-print"
              style={{
                backgroundImage: esCocina
                  ? `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 6' width='12' height='6'%3E%3Cpath fill='%23164E2A' d='M0 0l6 6 6-6z'/%3E%3C/svg%3E")`
                  : `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 6' width='12' height='6'%3E%3Cpath fill='%23FAF7F0' d='M0 0l6 6 6-6z'/%3E%3C/svg%3E")`,
              }}
            />
          </div>
        </div>

        {/* Pie del Modal: Botones de Acción */}
        <div className="p-3 sm:p-4 bg-aleman-negro/90 border-t border-aleman-dorado/30 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-aleman-hueso/10 hover:bg-aleman-hueso/20 text-aleman-hueso text-xs font-bold uppercase tracking-wider rounded-xs border border-aleman-hueso/20 transition-transform active:scale-95 cursor-pointer"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={handleImprimirReal}
            disabled={imprimiendo}
            className="px-5 py-2 bg-aleman-dorado hover:bg-aleman-dorado-light text-aleman-negro text-xs font-display font-bold uppercase tracking-wider rounded-xs border border-amber-600 shadow-lg flex items-center gap-2 transition-transform active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <span>{imprimiendo ? '⏳' : '🖨️'}</span>
            <span>{imprimiendo ? 'Imprimiendo...' : 'Imprimir Ticket'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
