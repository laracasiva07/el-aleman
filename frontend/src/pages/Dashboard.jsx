import { useState, useEffect } from 'react';
import apiClient from '../services/apiClient';

const formatCurrency = (amount) => {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(num);
};

export default function Dashboard() {
  const [loading, setLoading] = useState(true);

  // States for real data
  const [ventasHoy, setVentasHoy] = useState({ total: 0, comida: 0, bebida: 0 });
  const [productoMasVendido, setProductoMasVendido] = useState(null);
  const [resumenFinanciero, setResumenFinanciero] = useState(null);
  const [alertasStock, setAlertasStock] = useState([]);
  const [pedidosActivosStats, setPedidosActivosStats] = useState({
    total: 0,
    salon: { total: 0, entregados: 0, enPreparacion: 0 },
    delivery: { total: 0, cocina: 0, enCamino: 0 },
    takeaway: { total: 0, cocina: 0, listo: 0 }
  });

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    const ahora = new Date();
    const hoyInicio = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 0, 0, 0).toISOString();
    const hoyFin = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 23, 59, 59, 999).toISOString();

    const paramsHoy = { desde: hoyInicio, hasta: hoyFin };

    Promise.all([
      apiClient.get('/reportes/ventas', { params: { ...paramsHoy, agrupacion: 'dia' } }).catch(() => null),
      apiClient.get('/reportes/productos-mas-vendidos', { params: { ...paramsHoy, limit: 1 } }).catch(() => null),
      apiClient.get('/reportes/resumen-financiero', { params: paramsHoy }).catch(() => null),
      apiClient.get('/reportes/stock-alertas').catch(() => null),
      apiClient.get('/pedidos-salon').catch(() => null),
      apiClient.get('/pedidos-delivery').catch(() => null),
      apiClient.get('/pedidos-takeaway').catch(() => null)
    ]).then(([resVentas, resProds, resFinanciero, resStock, resSalon, resDelivery, resTakeaway]) => {
      if (!isMounted) return;

      // 1. Ventas de hoy
      if (resVentas?.data) {
        setVentasHoy({
          total: resVentas.data.totalVentas || 0,
          comida: resVentas.data.comida || 0,
          bebida: resVentas.data.bebida || 0
        });
      }

      // 2. Producto más vendido
      if (resProds?.data?.productos && resProds.data.productos.length > 0) {
        const top = resProds.data.productos[0];
        setProductoMasVendido({
          nombre: top.nombre,
          cantidadVendida: top.cantidadVendida,
          montoGenerado: top.facturacionTotal
        });
      } else {
        setProductoMasVendido(null);
      }

      // 3. Resumen financiero de hoy
      if (resFinanciero?.data) {
        setResumenFinanciero(resFinanciero.data);
      }

      // 4. Alertas de stock
      if (resStock?.data?.alertas) {
        setAlertasStock(resStock.data.alertas);
      }

      // 5. Pedidos Activos
      const listSalon = resSalon?.data?.pedidos || [];
      const listDelivery = resDelivery?.data?.pedidos || [];
      const listTakeaway = resTakeaway?.data?.pedidos || [];

      const salonTotal = listSalon.length;
      const deliveryTotal = listDelivery.length;
      const takeawayTotal = listTakeaway.length;

      const deliveryCocina = listDelivery.filter((p) => p.estadoDelivery === 'cocina').length;
      const deliveryEnCamino = listDelivery.filter((p) => p.estadoDelivery === 'en_camino').length;

      const takeawayCocina = listTakeaway.filter((p) => p.estadoTakeaway === 'cocina').length;
      const takeawayListo = listTakeaway.filter((p) => p.estadoTakeaway === 'listo').length;

      setPedidosActivosStats({
        total: salonTotal + deliveryTotal + takeawayTotal,
        salon: { total: salonTotal },
        delivery: { total: deliveryTotal, cocina: deliveryCocina, enCamino: deliveryEnCamino },
        takeaway: { total: takeawayTotal, cocina: takeawayCocina, listo: takeawayListo }
      });

      setLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="space-y-6 font-body text-aleman-negro">
      {/* Encabezado del Dashboard / Inicio */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-3xl font-display font-bold text-aleman-negro">
            Inicio - Panel Principal
          </h1>
          <p className="text-base text-aleman-negro/70">
            Resumen de actividad operativa y comercial en tiempo real
          </p>
        </div>
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-aleman-verde text-aleman-hueso border-2 border-aleman-dorado rounded-sm text-sm font-semibold self-start sm:self-auto">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          Sistema en vivo
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center bg-aleman-hueso border-2 border-aleman-negro/20 rounded-sm space-y-3">
          <div className="w-10 h-10 border-4 border-aleman-dorado border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-base font-bold text-aleman-negro">Cargando panel de inicio...</p>
        </div>
      ) : (
        <>
          {/* Grid Superior: Métricas clave */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Card 1: Ventas de hoy */}
            <div className="bg-aleman-hueso rounded-sm p-6 border-2 border-aleman-negro/20 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold uppercase tracking-wider text-aleman-negro/70">
                    Ventas de hoy
                  </span>
                  <span className="p-2 bg-aleman-crema border border-aleman-negro/15 text-emerald-800 rounded-sm text-lg">
                    💰
                  </span>
                </div>
                <div className="text-3xl font-display font-bold text-aleman-negro mb-4">
                  {formatCurrency(ventasHoy.total)}
                </div>
              </div>

              <div className="pt-4 border-t-2 border-aleman-negro/10 grid grid-cols-2 gap-3">
                <div className="bg-aleman-crema p-3 rounded-sm border border-aleman-negro/15">
                  <span className="text-sm text-aleman-negro/70 block font-semibold">🍕 Comida</span>
                  <span className="text-base font-bold text-aleman-negro">
                    {formatCurrency(ventasHoy.comida)}
                  </span>
                </div>
                <div className="bg-aleman-crema p-3 rounded-sm border border-aleman-negro/15">
                  <span className="text-sm text-aleman-negro/70 block font-semibold">🥤 Bebida</span>
                  <span className="text-base font-bold text-aleman-negro">
                    {formatCurrency(ventasHoy.bebida)}
                  </span>
                </div>
              </div>
            </div>

            {/* Card 2: Producto más vendido hoy */}
            <div className="bg-aleman-hueso rounded-sm p-6 border-2 border-aleman-negro/20 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold uppercase tracking-wider text-aleman-negro/70">
                    Producto más vendido
                  </span>
                  <span className="p-2 bg-aleman-crema border border-aleman-negro/15 text-aleman-dorado rounded-sm text-lg">
                    🏆
                  </span>
                </div>
                {productoMasVendido ? (
                  <>
                    <div className="text-2xl font-display font-bold text-aleman-negro mt-1 mb-1">
                      {productoMasVendido.nombre}
                    </div>
                    <span className="inline-block text-xs bg-aleman-dorado text-aleman-negro font-bold px-2.5 py-0.5 rounded-sm border border-aleman-negro/30 mb-3">
                      Destacado de hoy
                    </span>
                  </>
                ) : (
                  <div className="py-4 text-aleman-negro/50 font-semibold text-sm">
                    Sin ventas registradas hoy
                  </div>
                )}
              </div>

              {productoMasVendido && (
                <div className="pt-4 border-t-2 border-aleman-negro/10 flex items-center justify-between bg-aleman-crema p-3 rounded-sm border border-aleman-negro/15">
                  <div>
                    <span className="text-sm text-aleman-negro/70 block">Total despachado</span>
                    <span className="text-xl font-bold text-aleman-rojo">
                      {productoMasVendido.cantidadVendida} unidades
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm text-aleman-negro/70 block">Generado</span>
                    <span className="text-base font-bold text-aleman-negro">
                      {formatCurrency(productoMasVendido.montoGenerado)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Card 3: Resumen Financiero Rápido de hoy */}
            <div className="bg-aleman-hueso rounded-sm p-6 border-2 border-aleman-negro/20 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold uppercase tracking-wider text-aleman-negro/70">
                    Balance Financiero (Hoy)
                  </span>
                  <span className="p-2 bg-aleman-crema border border-aleman-negro/15 text-blue-900 rounded-sm text-lg">
                    ⚖️
                  </span>
                </div>
                <div className="text-3xl font-display font-bold text-aleman-verde mb-1">
                  {formatCurrency(resumenFinanciero?.balanceComercial || 0)}
                </div>
                <p className="text-xs text-aleman-negro/70 font-semibold">
                  Resultado estimado descontando gastos diarios y prorrateos.
                </p>
              </div>

              <div className="pt-4 border-t-2 border-aleman-negro/10 grid grid-cols-2 gap-2 text-xs font-semibold">
                <div className="bg-aleman-crema p-2 rounded-sm border border-aleman-negro/15">
                  <span className="text-aleman-negro/70 block">Cobros Caja</span>
                  <span className="font-bold text-blue-900">
                    {formatCurrency(resumenFinanciero?.cobrosCaja || 0)}
                  </span>
                </div>
                <div className="bg-aleman-crema p-2 rounded-sm border border-aleman-negro/15">
                  <span className="text-aleman-negro/70 block">Total Gastos</span>
                  <span className="font-bold text-aleman-rojo">
                    {formatCurrency(resumenFinanciero?.totalGastos || 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Card: Pedidos Activos en Tiempo Real */}
          <div className="bg-aleman-hueso rounded-sm border-2 border-aleman-negro/20 p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b-2 border-aleman-negro/10 gap-2 mb-6">
              <div>
                <h2 className="text-xl font-display font-bold text-aleman-negro">
                  Pedidos Activos
                </h2>
                <p className="text-base text-aleman-negro/70">
                  Seguimiento en tiempo real por canal
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-base font-medium text-aleman-negro/80">Total en curso:</span>
                <span className="px-3 py-1 bg-aleman-verde text-aleman-hueso font-bold text-base rounded-sm border border-aleman-dorado">
                  {pedidosActivosStats.total}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Salón */}
              <div className="bg-aleman-crema border-2 border-aleman-negro/15 rounded-sm p-5 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🍽️</span>
                    <h3 className="font-display font-bold text-aleman-negro text-xl">Salón</h3>
                  </div>
                  <span className="text-sm font-bold bg-aleman-hueso border border-aleman-negro/30 text-aleman-negro px-2.5 py-1 rounded-sm">
                    {pedidosActivosStats.salon.total} mesas activas
                  </span>
                </div>
              </div>

              {/* Delivery */}
              <div className="bg-aleman-crema border-2 border-aleman-negro/15 rounded-sm p-5 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🛵</span>
                    <h3 className="font-display font-bold text-aleman-negro text-xl">Delivery</h3>
                  </div>
                  <span className="text-sm font-bold bg-aleman-hueso border border-aleman-negro/30 text-aleman-negro px-2.5 py-1 rounded-sm">
                    {pedidosActivosStats.delivery.total} pedidos
                  </span>
                </div>
                <div className="space-y-1 text-sm font-semibold">
                  <div className="flex justify-between bg-aleman-hueso p-2 rounded-sm border border-aleman-negro/10">
                    <span>En cocina:</span>
                    <span className="font-bold text-blue-800">{pedidosActivosStats.delivery.cocina}</span>
                  </div>
                  <div className="flex justify-between bg-aleman-hueso p-2 rounded-sm border border-aleman-negro/10">
                    <span>En camino:</span>
                    <span className="font-bold text-purple-800">{pedidosActivosStats.delivery.enCamino}</span>
                  </div>
                </div>
              </div>

              {/* Takeaway */}
              <div className="bg-aleman-crema border-2 border-aleman-negro/15 rounded-sm p-5 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🛍️</span>
                    <h3 className="font-display font-bold text-aleman-negro text-xl">Take Away</h3>
                  </div>
                  <span className="text-sm font-bold bg-aleman-hueso border border-aleman-negro/30 text-aleman-negro px-2.5 py-1 rounded-sm">
                    {pedidosActivosStats.takeaway.total} pedidos
                  </span>
                </div>
                <div className="space-y-1 text-sm font-semibold">
                  <div className="flex justify-between bg-aleman-hueso p-2 rounded-sm border border-aleman-negro/10">
                    <span>En cocina:</span>
                    <span className="font-bold text-blue-800">{pedidosActivosStats.takeaway.cocina}</span>
                  </div>
                  <div className="flex justify-between bg-aleman-hueso p-2 rounded-sm border border-aleman-negro/10">
                    <span>Listo para retirar:</span>
                    <span className="font-bold text-emerald-800">{pedidosActivosStats.takeaway.listo}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Card: Alertas de Stock */}
          <div className="bg-aleman-hueso rounded-sm border-2 border-aleman-negro/20 p-6">
            <div className="flex items-center justify-between pb-4 border-b-2 border-aleman-negro/10 mb-4">
              <div>
                <h2 className="text-xl font-display font-bold text-aleman-negro">
                  Alertas de Stock
                </h2>
                <p className="text-base text-aleman-negro/70">
                  Ingredientes que requieren reposición inmediata
                </p>
              </div>
              <span className="text-sm font-bold bg-rose-100 text-aleman-rojo border border-aleman-rojo/30 px-3 py-1 rounded-sm">
                {alertasStock.length} con stock bajo
              </span>
            </div>

            {alertasStock.length === 0 ? (
              <div className="p-6 text-center text-emerald-800 font-bold bg-aleman-crema border border-aleman-negro/15 rounded-sm">
                ✅ Todos los insumos se encuentran en niveles normales de stock.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {alertasStock.map((item) => {
                  const isCritico = item.estadoStock === 'critico' || item.stockActual <= item.umbralCritico;
                  return (
                    <div
                      key={item._id || item.nombre}
                      className={`p-4 rounded-sm border-2 transition-all ${
                        isCritico
                          ? 'bg-rose-50 border-aleman-rojo'
                          : 'bg-amber-50 border-amber-400'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm border ${
                            isCritico
                              ? 'bg-aleman-rojo text-aleman-hueso border-aleman-negro'
                              : 'bg-amber-300 text-aleman-negro border-amber-600'
                          }`}
                        >
                          {isCritico ? 'Crítico' : 'Stock Bajo'}
                        </span>
                        <span className="text-xs text-aleman-negro/70 font-semibold">
                          Mín: {item.umbralBajo} {item.unidadMedida}
                        </span>
                      </div>

                      <h4 className="font-display font-bold text-aleman-negro text-lg mb-1">
                        {item.nombre}
                      </h4>

                      <div className="mt-3 flex items-baseline justify-between pt-2 border-t border-aleman-negro/15">
                        <span className="text-xs text-aleman-negro/70 font-semibold">Disponible:</span>
                        <span
                          className={`text-xl font-bold ${
                            isCritico ? 'text-aleman-rojo' : 'text-amber-800'
                          }`}
                        >
                          {item.stockActual} {item.unidadMedida}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
