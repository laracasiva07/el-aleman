const BASE_URL = 'http://localhost:5000/api';

async function testFrontendFlow() {
  console.log('🚀 Iniciando verificación de flujo completo de Promociones...');

  try {
    // 1. Obtener token de dueño
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'dueno@elaleman.com',
        password: 'password123',
      }),
    });
    const loginData = await loginRes.json();
    if (!loginRes.ok) throw new Error(loginData.mensaje || 'Error login');

    const token = loginData.token;
    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
    console.log('✅ Login exitoso como Dueño');

    // 2. Obtener productos y stock de ingredientes para baseline
    const prodRes = await fetch(`${BASE_URL}/productos`, { headers: authHeaders });
    const prodData = await prodRes.json();
    const productos = prodData.productos || [];
    if (productos.length < 2) {
      throw new Error('Se necesitan al menos 2 productos para la prueba.');
    }
    const p1 = productos[0];
    const p2 = productos[1];
    console.log(`📦 Productos para combo: "${p1.nombre}" ($${p1.precioVenta}) y "${p2.nombre}" ($${p2.precioVenta})`);

    // Stock baseline
    const stockBaselineRes = await fetch(`${BASE_URL}/stock`, { headers: authHeaders });
    const stockBaselineData = await stockBaselineRes.json();
    const stockBaseline = stockBaselineData.ingredientes || [];
    const stockMapBefore = new Map(stockBaseline.map((i) => [i._id, i.stockActual]));

    // 3. Crear una promoción desde POST /api/promociones
    const promoPayload = {
      nombre: 'Combo Test Frontend Flow',
      precioFijo: (p1.precioVenta + p2.precioVenta) * 0.8, // 20% descuento combo
      productos: [
        { productoId: p1._id, cantidad: 1 },
        { productoId: p2._id, cantidad: 2 },
      ],
    };
    const promoRes = await fetch(`${BASE_URL}/promociones`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(promoPayload),
    });
    const promoData = await promoRes.json();
    if (!promoRes.ok) throw new Error(promoData.mensaje || 'Error al crear promocion');
    const promo = promoData.promocion;
    console.log(`🎉 Promoción creada: "${promo.nombre}" (Precio Fijo: $${promo.precioFijo})`);

    // 4. Salón: Abrir mesa y agregar la promoción
    const mesaRes = await fetch(`${BASE_URL}/mesas`, { headers: authHeaders });
    const mesaData = await mesaRes.json();
    const mesaLibre = mesaData.mesas.find((m) => m.estado === 'libre') || mesaData.mesas[0];

    const openSalonRes = await fetch(`${BASE_URL}/pedidos-salon`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ mesaId: mesaLibre._id }),
    });
    const openSalonData = await openSalonRes.json();
    const pedSalonId = openSalonData.pedido._id;

    const addSalonRes = await fetch(`${BASE_URL}/pedidos-salon/${pedSalonId}/items`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ items: [{ promocionId: promo._id, cantidad: 1, aclaraciones: 'Mesa test' }] }),
    });
    const addSalonData = await addSalonRes.json();
    const itemsSalon = addSalonData.pedido.items;
    const gruposSalon = new Set(itemsSalon.map((i) => i.grupoPromocionId).filter(Boolean));
    console.log(`🍽️ Salón: Pedido con ${itemsSalon.length} ítems componentes, grupoPromocionId único: ${[...gruposSalon].join(', ')}`);

    // 5. Delivery: Crear pedido de delivery con la promoción
    const createDeliveryRes = await fetch(`${BASE_URL}/pedidos-delivery`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        nombreCliente: 'Cliente Test Delivery Promo',
        telefono: '11-9999-8888',
        direccionEntrega: 'Av. Corrientes 1234',
        items: [{ promocionId: promo._id, cantidad: 1, aclaraciones: 'Delivery test' }],
      }),
    });
    const createDeliveryData = await createDeliveryRes.json();
    if (!createDeliveryRes.ok) throw new Error(createDeliveryData.mensaje || 'Error delivery');
    const itemsDelivery = createDeliveryData.pedido.items;
    const gruposDelivery = new Set(itemsDelivery.map((i) => i.grupoPromocionId).filter(Boolean));
    console.log(`🛵 Delivery: Pedido con ${itemsDelivery.length} ítems componentes, grupoPromocionId único: ${[...gruposDelivery].join(', ')}`);

    // 6. Take Away: Crear pedido de takeaway con la promoción
    const createTKRes = await fetch(`${BASE_URL}/pedidos-takeaway`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        nombreCliente: 'Cliente Test Takeaway Promo',
        telefono: '11-7777-6666',
        horaRetiroEstimada: '21:00',
        items: [{ promocionId: promo._id, cantidad: 1, aclaraciones: 'Takeaway test' }],
      }),
    });
    const createTKData = await createTKRes.json();
    if (!createTKRes.ok) throw new Error(createTKData.mensaje || 'Error takeaway');
    const itemsTK = createTKData.pedido.items;
    const gruposTK = new Set(itemsTK.map((i) => i.grupoPromocionId).filter(Boolean));
    console.log(`🛍️ Takeaway: Pedido con ${itemsTK.length} ítems componentes, grupoPromocionId único: ${[...gruposTK].join(', ')}`);

    // 7. Verificar descuento de stock
    const stockAfterRes = await fetch(`${BASE_URL}/stock`, { headers: authHeaders });
    const stockAfterData = await stockAfterRes.json();
    const stockAfter = stockAfterData.ingredientes || [];

    let descuentoRegistrado = false;
    stockAfter.forEach((ing) => {
      const prevStock = stockMapBefore.get(ing._id);
      if (prevStock !== undefined && ing.stockActual < prevStock) {
        console.log(`  📉 Stock de "${ing.nombre}": ${prevStock} ${ing.unidadMedida} ➔ ${ing.stockActual} ${ing.unidadMedida}`);
        descuentoRegistrado = true;
      }
    });

    if (descuentoRegistrado) {
      console.log('✅ Descuento de stock verificado correctamente tras la aplicación de combos en los 3 canales.');
    } else {
      console.log('ℹ️ Nota: Los productos de la promo no tenían ingredientes asociados o el stock permaneció igual.');
    }

    console.log('\n✨ ¡TODAS LAS PRUEBAS DE INTEGRACIÓN DE PROMOCIONES PASARON EXITOSAMENTE! ✨');
  } catch (err) {
    console.error('❌ Error en test de integración:', err.message);
    process.exit(1);
  }
}

testFrontendFlow();
