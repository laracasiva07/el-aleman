// =========================================================
// ENTIDADES DE SUCURSAL Y USUARIOS (MODELADO MULTI-SUCURSAL)
// =========================================================

export const mockSucursalActual = {
  id: 'sucursal-1',
  nombre: 'El Alemán - Casa Central',
  direccion: 'Av. Corrientes 1234, CABA',
  telefono: '11-4567-8900',
};

export const mockSucursales = [
  mockSucursalActual,
];

export const mockUsuarios = [
  { id: 'usr-1', nombre: 'dueño', rol: 'dueno', sucursalId: 'sucursal-1' },
  { id: 'usr-2', nombre: 'encargado', rol: 'encargado', sucursalId: 'sucursal-1' },
  { id: 'usr-3', nombre: 'mozo', rol: 'mozo', sucursalId: 'sucursal-1' },
];

export const mockDashboardData = {
  ventasHoy: {
    total: 485600,
    comida: 362400,
    bebida: 123200,
  },
  pedidosActivos: {
    total: 18,
    porTipo: {
      salon: {
        nombre: 'Salón',
        total: 8,
        icono: '🍽️',
        estados: [
          { key: 'pendiente', label: 'Pendiente', count: 2, color: 'bg-amber-100 text-amber-800 border-amber-200' },
          { key: 'preparacion', label: 'En preparación', count: 4, color: 'bg-blue-100 text-blue-800 border-blue-200' },
          { key: 'listo', label: 'Listo', count: 2, color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
          { key: 'entregado', label: 'Entregado', count: 0, color: 'bg-slate-100 text-slate-700 border-slate-200' },
        ],
      },
      delivery: {
        nombre: 'Delivery',
        total: 6,
        icono: '🛵',
        estados: [
          { key: 'pendiente', label: 'Pendiente', count: 1, color: 'bg-amber-100 text-amber-800 border-amber-200' },
          { key: 'preparacion', label: 'En preparación', count: 2, color: 'bg-blue-100 text-blue-800 border-blue-200' },
          { key: 'listo', label: 'Listo', count: 1, color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
          { key: 'enCamino', label: 'En camino', count: 2, color: 'bg-purple-100 text-purple-800 border-purple-200' },
          { key: 'entregado', label: 'Entregado', count: 0, color: 'bg-slate-100 text-slate-700 border-slate-200' },
        ],
      },
      takeAway: {
        nombre: 'Take Away',
        total: 4,
        icono: '🛍️',
        estados: [
          { key: 'pendiente', label: 'Pendiente', count: 1, color: 'bg-amber-100 text-amber-800 border-amber-200' },
          { key: 'preparacion', label: 'En preparación', count: 1, color: 'bg-blue-100 text-blue-800 border-blue-200' },
          { key: 'listo', label: 'Listo', count: 2, color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
          { key: 'entregado', label: 'Entregado', count: 0, color: 'bg-slate-100 text-slate-700 border-slate-200' },
        ],
      },
    },
  },
  alertasStock: [
    {
      id: 1,
      ingrediente: 'Queso Muzzarella',
      cantidadActual: 3.5,
      unidad: 'kg',
      stockMinimo: 15,
      nivel: 'critico',
    },
    {
      id: 2,
      ingrediente: 'Harina 000',
      cantidadActual: 12,
      unidad: 'kg',
      stockMinimo: 30,
      nivel: 'bajo',
    },
    {
      id: 3,
      ingrediente: 'Jamón Cocido',
      cantidadActual: 1.8,
      unidad: 'kg',
      stockMinimo: 8,
      nivel: 'critico',
    },
    {
      id: 4,
      ingrediente: 'Salsa de Tomate',
      cantidadActual: 4,
      unidad: 'latas (3kg)',
      stockMinimo: 10,
      nivel: 'bajo',
    },
  ],
  productoMasVendido: {
    nombre: 'Pizza Muzzarella Especial',
    cantidadVendida: 46,
    categoria: 'Pizzas',
    montoGenerado: 345000,
  },
};

export const mockIngredientes = [
  {
    id: 'ing-1',
    nombre: 'Harina 000',
    unidad: 'kg',
    costoCompra: 10000,
    cantidadComprada: 5,
    costoUnitario: 2000, // $2.000 / kg
    stockActual: 12,
    umbralCritico: 10,
    umbralBajo: 30,
  },
  {
    id: 'ing-2',
    nombre: 'Queso Muzzarella',
    unidad: 'kg',
    costoCompra: 28000,
    cantidadComprada: 4,
    costoUnitario: 7000, // $7.000 / kg
    stockActual: 3.5,
    umbralCritico: 5,
    umbralBajo: 15,
  },
  {
    id: 'ing-3',
    nombre: 'Salsa de Tomate',
    unidad: 'kg',
    costoCompra: 9000,
    cantidadComprada: 3,
    costoUnitario: 3000, // $3.000 / kg
    stockActual: 4,
    umbralCritico: 5,
    umbralBajo: 10,
  },
  {
    id: 'ing-4',
    nombre: 'Jamón Cocido',
    unidad: 'kg',
    costoCompra: 18000,
    cantidadComprada: 2,
    costoUnitario: 9000, // $9.000 / kg
    stockActual: 1.8,
    umbralCritico: 2,
    umbralBajo: 8,
  },
  {
    id: 'ing-5',
    nombre: 'Aceitunas Verdes',
    unidad: 'kg',
    costoCompra: 6000,
    cantidadComprada: 1,
    costoUnitario: 6000, // $6.000 / kg
    stockActual: 8.5,
    umbralCritico: 2,
    umbralBajo: 5,
  },
  {
    id: 'ing-6',
    nombre: 'Coca-Cola 500ml',
    unidad: 'unidad',
    costoCompra: 14400,
    cantidadComprada: 12,
    costoUnitario: 1200, // $1.200 / unidad
    stockActual: 24,
    umbralCritico: 10,
    umbralBajo: 20,
  },
  {
    id: 'ing-7',
    nombre: 'Cerveza Quilmes 1L',
    unidad: 'unidad',
    costoCompra: 14400,
    cantidadComprada: 6,
    costoUnitario: 2400, // $2.400 / unidad
    stockActual: 18,
    umbralCritico: 8,
    umbralBajo: 15,
  },
  {
    id: 'ing-8',
    nombre: 'Tapa de Empanadas',
    unidad: 'unidad',
    costoCompra: 1800,
    cantidadComprada: 12,
    costoUnitario: 150, // $150 / unidad
    stockActual: 60,
    umbralCritico: 24,
    umbralBajo: 48,
  },
  {
    id: 'ing-9',
    nombre: 'Carne Picada Especial',
    unidad: 'kg',
    costoCompra: 15000,
    cantidadComprada: 2,
    costoUnitario: 7500, // $7.500 / kg
    stockActual: 5,
    umbralCritico: 3,
    umbralBajo: 8,
  },
  {
    id: 'ing-10',
    nombre: 'Cebolla',
    unidad: 'kg',
    costoCompra: 3000,
    cantidadComprada: 3,
    costoUnitario: 1000, // $1.000 / kg
    stockActual: 15,
    umbralCritico: 5,
    umbralBajo: 10,
  },
];

export const mockCategorias = [
  { id: 'cat-1', nombre: 'Pizzas', tipo: 'comida' },
  { id: 'cat-2', nombre: 'Empanadas', tipo: 'comida' },
  { id: 'cat-3', nombre: 'Bebidas', tipo: 'bebida' },
  { id: 'cat-4', nombre: 'Postres', tipo: 'comida' },
];

// TODO: definir si stock es compartido o por sucursal
export const mockProductos = [
  {
    id: 'prod-1',
    sucursalId: 'sucursal-1', // TODO: definir si stock es compartido o por sucursal
    nombre: 'Pizza Muzzarella Tradicional',
    categoriaId: 'cat-1',
    categoriaNombre: 'Pizzas',
    precioVenta: 7500,
    disponible: true,
    receta: [
      { ingredienteId: 'ing-1', cantidad: 0.25 },
      { ingredienteId: 'ing-3', cantidad: 0.15 },
      { ingredienteId: 'ing-2', cantidad: 0.3 },
      { ingredienteId: 'ing-5', cantidad: 0.05 },
    ],
  },
  {
    id: 'prod-2',
    sucursalId: 'sucursal-1',
    nombre: 'Pizza Especial Jamón y Morrones',
    categoriaId: 'cat-1',
    categoriaNombre: 'Pizzas',
    precioVenta: 9800,
    disponible: true,
    receta: [
      { ingredienteId: 'ing-1', cantidad: 0.25 },
      { ingredienteId: 'ing-3', cantidad: 0.15 },
      { ingredienteId: 'ing-2', cantidad: 0.3 },
      { ingredienteId: 'ing-4', cantidad: 0.15 },
      { ingredienteId: 'ing-5', cantidad: 0.05 },
    ],
  },
  {
    id: 'prod-3',
    sucursalId: 'sucursal-1',
    nombre: 'Empanada de Carne Criolla',
    categoriaId: 'cat-2',
    categoriaNombre: 'Empanadas',
    precioVenta: 1500,
    disponible: true,
    receta: [
      { ingredienteId: 'ing-8', cantidad: 1 },
      { ingredienteId: 'ing-9', cantidad: 0.06 },
      { ingredienteId: 'ing-10', cantidad: 0.04 },
    ],
  },
  {
    id: 'prod-4',
    sucursalId: 'sucursal-1',
    nombre: 'Coca-Cola 500ml',
    categoriaId: 'cat-3',
    categoriaNombre: 'Bebidas',
    precioVenta: 2200,
    disponible: true,
    receta: [{ ingredienteId: 'ing-6', cantidad: 1 }],
  },
  {
    id: 'prod-5',
    sucursalId: 'sucursal-1',
    nombre: 'Cerveza Quilmes 1L',
    categoriaId: 'cat-3',
    categoriaNombre: 'Bebidas',
    precioVenta: 4200,
    disponible: false,
    receta: [{ ingredienteId: 'ing-7', cantidad: 1 }],
  },
];

export const calcularCostoReceta = (receta, listaIngredientes = mockIngredientes) => {
  if (!Array.isArray(receta)) return 0;
  return receta.reduce((total, item) => {
    const ing = (listaIngredientes || mockIngredientes).find((i) => i.id === item.ingredienteId);
    if (!ing) return total;
    const cant = Number(item.cantidad) || 0;
    return total + cant * ing.costoUnitario;
  }, 0);
};

export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(amount);
};

// Funciones de sincronización para mantener la fuente de datos centralizada
export const updateIngredienteEnMockData = (id, actualizacion) => {
  const index = mockIngredientes.findIndex((i) => i.id === id);
  if (index !== -1) {
    mockIngredientes[index] = { ...mockIngredientes[index], ...actualizacion };
  }
};

export const addIngredienteEnMockData = (nuevoIng) => {
  mockIngredientes.unshift(nuevoIng);
};

export const deleteIngredienteEnMockData = (id) => {
  const index = mockIngredientes.findIndex((i) => i.id === id);
  if (index !== -1) {
    mockIngredientes.splice(index, 1);
  }
};

export const mockPromociones = [
  {
    id: 'promo-1',
    nombre: 'Combo Individual: Muzza + Coca-Cola',
    precioCombo: 8200,
    activa: true,
    items: [
      { productoId: 'prod-1', cantidad: 1 },
      { productoId: 'prod-4', cantidad: 1 },
    ],
  },
  {
    id: 'promo-2',
    nombre: 'Combo Pareja: Especial + Cerveza Quilmes',
    precioCombo: 11900,
    activa: true,
    items: [
      { productoId: 'prod-2', cantidad: 1 },
      { productoId: 'prod-5', cantidad: 1 },
    ],
  },
  {
    id: 'promo-3',
    nombre: 'Super Picada: Docena Criolla + 2 Bebidas',
    precioCombo: 18900,
    activa: true,
    items: [
      { productoId: 'prod-3', cantidad: 12 },
      { productoId: 'prod-4', cantidad: 2 },
    ],
  },
  {
    id: 'promo-4',
    nombre: 'Dúo Familiar de Muzzarellas',
    precioCombo: 13200,
    activa: false,
    items: [
      { productoId: 'prod-1', cantidad: 2 },
    ],
  },
];

export const mockMesasIniciales = [
  {
    id: 'mesa-1',
    sucursalId: 'sucursal-1',
    numero: 1,
    capacidad: 2,
    sector: 'Ventana',
    estado: 'libre',
    pedido: [],
    fechaApertura: null,
  },
  {
    id: 'mesa-2',
    sucursalId: 'sucursal-1',
    numero: 2,
    capacidad: 4,
    sector: 'Salón Principal',
    estado: 'ocupada',
    fechaApertura: '2026-09-02T00:10:00Z',
    pedido: [
      {
        id: 'item-101',
        tipo: 'producto',
        itemId: 'prod-1',
        nombre: 'Pizza Muzzarella Tradicional',
        precioUnitario: 7500,
        cantidad: 1,
        aclaracion: 'Bien dorada',
        enviadoACocina: true,
        estadoCocina: 'en_preparacion',
        horaEnvio: '00:12',
      },
      {
        id: 'item-102',
        tipo: 'producto',
        itemId: 'prod-4',
        nombre: 'Coca-Cola 500ml',
        precioUnitario: 2200,
        cantidad: 2,
        aclaracion: 'Con hielo y limón',
        enviadoACocina: true,
        estadoCocina: 'entregado',
        horaEnvio: '00:12',
      },
    ],
  },
  {
    id: 'mesa-3',
    sucursalId: 'sucursal-1',
    numero: 3,
    capacidad: 4,
    sector: 'Salón Principal',
    estado: 'libre',
    pedido: [],
    fechaApertura: null,
  },
  {
    id: 'mesa-4',
    sucursalId: 'sucursal-1',
    numero: 4,
    capacidad: 6,
    sector: 'Salón Principal',
    estado: 'ocupada',
    fechaApertura: '2026-09-02T00:05:00Z',
    pedido: [
      {
        id: 'item-103',
        tipo: 'promocion',
        itemId: 'promo-2',
        nombre: 'Combo Pareja: Especial + Cerveza Quilmes',
        precioUnitario: 11900,
        cantidad: 1,
        aclaracion: 'Cerveza bien fría',
        enviadoACocina: true,
        estadoCocina: 'listo',
        horaEnvio: '00:06',
      },
    ],
  },
  {
    id: 'mesa-5',
    sucursalId: 'sucursal-1',
    numero: 5,
    capacidad: 2,
    sector: 'Terraza',
    estado: 'libre',
    pedido: [],
    fechaApertura: null,
  },
  {
    id: 'mesa-6',
    sucursalId: 'sucursal-1',
    numero: 6,
    capacidad: 4,
    sector: 'Terraza',
    estado: 'libre',
    pedido: [],
    fechaApertura: null,
  },
  {
    id: 'mesa-7',
    sucursalId: 'sucursal-1',
    numero: 7,
    capacidad: 4,
    sector: 'Salón Principal',
    estado: 'libre',
    pedido: [],
    fechaApertura: null,
  },
  {
    id: 'mesa-8',
    sucursalId: 'sucursal-1',
    numero: 8,
    capacidad: 8,
    sector: 'Sector VIP',
    estado: 'libre',
    pedido: [],
    fechaApertura: null,
  },
];

// =========================================================
// GESTIÓN CENTRALIZADA DE CLIENTES
// =========================================================

export let mockClientes = [
  {
    id: 'cli-1',
    nombre: 'Juan Pérez',
    telefono: '11-4567-8901',
    direccionesFrecuentes: [
      'Av. Rivadavia 4520, Piso 4 Depto B (timbre Pérez)',
    ],
    historialPedidos: [
      {
        id: 'DEL-101',
        tipo: 'delivery',
        fecha: '2026-09-02 20:15',
        total: 9700,
      },
    ],
  },
  {
    id: 'cli-2',
    nombre: 'Lucía Morales',
    telefono: '11-9876-5432',
    direccionesFrecuentes: [
      'Corrientes 3200, PB 2 (portón negro)',
    ],
    historialPedidos: [
      {
        id: 'DEL-102',
        tipo: 'delivery',
        fecha: '2026-09-02 20:05',
        total: 11900,
      },
    ],
  },
  {
    id: 'cli-3',
    nombre: 'Nicolás Vázquez',
    telefono: '11-2233-4455',
    direccionesFrecuentes: [],
    historialPedidos: [
      {
        id: 'TK-201',
        tipo: 'take-away',
        fecha: '2026-09-02 20:10',
        total: 9800,
      },
    ],
  },
  {
    id: 'cli-4',
    nombre: 'Carlos Gómez',
    telefono: '11-3322-1100',
    direccionesFrecuentes: [
      'Medrano 850, timbre Gómez',
    ],
    historialPedidos: [
      {
        id: 'DEL-103',
        tipo: 'delivery',
        fecha: '2026-09-02 19:45',
        total: 13400,
      },
    ],
  },
];

// Buscar cliente por teléfono (normalizando espacios y guiones)
export const buscarClientePorTelefono = (telefono) => {
  if (!telefono) return null;
  const telNorm = String(telefono).trim().toLowerCase();
  return (
    mockClientes.find(
      (c) => String(c.telefono).trim().toLowerCase() === telNorm
    ) || null
  );
};

// Registrar o actualizar cliente (agrega dirección frecuente si es nueva)
export const registrarOActualizarCliente = ({ nombre, telefono, direccion }) => {
  if (!telefono) return null;
  const telLimpio = String(telefono).trim();
  const nombreLimpio = nombre ? String(nombre).trim() : 'Cliente sin nombre';
  const direccionLimpia = direccion ? String(direccion).trim() : '';

  const clienteExistente = buscarClientePorTelefono(telLimpio);

  if (clienteExistente) {
    if (nombreLimpio && nombreLimpio !== clienteExistente.nombre) {
      clienteExistente.nombre = nombreLimpio;
    }
    if (
      direccionLimpia &&
      !clienteExistente.direccionesFrecuentes.includes(direccionLimpia)
    ) {
      clienteExistente.direccionesFrecuentes.push(direccionLimpia);
    }
    return clienteExistente;
  }

  const nuevoCliente = {
    id: `cli-${Date.now()}`,
    nombre: nombreLimpio,
    telefono: telLimpio,
    direccionesFrecuentes: direccionLimpia ? [direccionLimpia] : [],
    historialPedidos: [],
  };

  mockClientes.unshift(nuevoCliente);
  return nuevoCliente;
};

// Agregar un pedido al historial del cliente
export const agregarPedidoAlHistorialCliente = (telefono, pedido) => {
  if (!telefono || !pedido) return;
  const cliente = buscarClientePorTelefono(telefono);
  if (cliente) {
    const nuevoRegistro = {
      id: pedido.id,
      tipo: pedido.tipo || 'delivery',
      fecha: pedido.fecha || new Date().toISOString(),
      total: Number(pedido.total) || 0,
    };
    cliente.historialPedidos.unshift(nuevoRegistro);
  }
};

// Editar datos de contacto de cliente existente
export const editarClienteEnMockData = (id, { nombre, telefono, direccionesFrecuentes }) => {
  const index = mockClientes.findIndex((c) => c.id === id);
  if (index !== -1) {
    mockClientes[index] = {
      ...mockClientes[index],
      ...(nombre !== undefined && { nombre: nombre.trim() }),
      ...(telefono !== undefined && { telefono: telefono.trim() }),
      ...(direccionesFrecuentes !== undefined && { direccionesFrecuentes }),
    };
    return mockClientes[index];
  }
  return null;
};

// =========================================================
// GESTIÓN CENTRALIZADA DE CAJA Y MOVIMIENTOS
// =========================================================

export let mockCaja = {
  sucursalId: 'sucursal-1',
  estado: 'abierta', // 'abierta' | 'cerrada'
  montoInicial: 50000,
  fechaApertura: '2026-09-02T18:00:00.000Z',
  movimientos: [
    {
      id: 'mov-1',
      sucursalId: 'sucursal-1',
      tipo: 'ingreso',
      origen: 'venta-delivery',
      medioPago: 'transferencia',
      monto: 9800,
      montoComida: 7500,
      montoBebida: 2300,
      descripcion: 'Cobro de Delivery #104 (Mariana Rossi)',
      fecha: '2026-09-02T19:55:00.000Z',
      referenciaPedido: 'DEL-104',
    },
    {
      id: 'mov-2',
      sucursalId: 'sucursal-1',
      tipo: 'ingreso',
      origen: 'venta-takeaway',
      medioPago: 'efectivo',
      monto: 7500,
      montoComida: 7500,
      montoBebida: 0,
      descripcion: 'Cobro de Take Away #204 (Paula Benítez)',
      fecha: '2026-09-02T19:35:00.000Z',
      referenciaPedido: 'TK-204',
    },
    {
      id: 'mov-3',
      sucursalId: 'sucursal-1',
      tipo: 'egreso',
      origen: 'manual',
      medioPago: 'efectivo',
      monto: 3500,
      montoComida: null,
      montoBebida: null,
      descripcion: 'Compra de artículos de limpieza y bolsas',
      fecha: '2026-09-02T18:30:00.000Z',
      referenciaPedido: '',
    },
  ],
};

export const abrirCaja = (montoInicial = 50000) => {
  mockCaja.estado = 'abierta';
  mockCaja.montoInicial = Number(montoInicial) || 0;
  mockCaja.fechaApertura = new Date().toISOString();
  return mockCaja;
};

export const cerrarCaja = () => {
  mockCaja.estado = 'cerrada';
  return mockCaja;
};

export const registrarMovimientoCaja = ({
  tipo = 'ingreso',
  origen = 'manual',
  medioPago = 'efectivo',
  monto = 0,
  montoComida = null,
  montoBebida = null,
  descripcion = '',
  referenciaPedido = '',
  motivo = null,
  usuario = null,
  rol = null,
  sucursalId = 'sucursal-1',
}) => {
  const montoNum =
    monto === null || monto === undefined ? null : Number(monto) || 0;
  const nuevoMovimiento = {
    id: `mov-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    sucursalId: sucursalId || 'sucursal-1',
    tipo: tipo || 'ingreso',
    origen: origen || 'manual',
    medioPago: tipo === 'ajuste' ? null : medioPago || (tipo === 'ingreso' ? 'efectivo' : null),
    monto: montoNum,
    montoComida: montoComida !== null && montoComida !== undefined ? Number(montoComida) : null,
    montoBebida: montoBebida !== null && montoBebida !== undefined ? Number(montoBebida) : null,
    descripcion:
      descripcion ||
      `${tipo === 'ingreso' ? 'Ingreso por' : tipo === 'ajuste' ? 'Ajuste de' : 'Egreso'} ${origen}`,
    fecha: new Date().toISOString(),
    referenciaPedido: referenciaPedido || '',
    motivo: motivo || null,
    usuario: usuario || null,
    rol: rol || null,
  };

  mockCaja.movimientos.unshift(nuevoMovimiento);
  return nuevoMovimiento;
};

// =========================================================
// GESTIÓN CENTRALIZADA DE GASTOS (FIJOS & DIARIOS)
// =========================================================

export let mockGastos = {
  gastosFijos: [
    {
      id: 'gf-1',
      sucursalId: 'sucursal-1',
      nombre: 'Alquiler del Local Comercial',
      montoMensual: 450000,
      diaVencimiento: 5,
      activo: true,
    },
    {
      id: 'gf-2',
      sucursalId: 'sucursal-1',
      nombre: 'Sueldos & Cargas Sociales',
      montoMensual: 1200000,
      diaVencimiento: 10,
      activo: true,
    },
    {
      id: 'gf-3',
      sucursalId: 'sucursal-1',
      nombre: 'Servicios Básicos (Luz, Gas, Agua, Internet)',
      montoMensual: 180000,
      diaVencimiento: 15,
      activo: true,
    },
    {
      id: 'gf-4',
      sucursalId: 'sucursal-1',
      nombre: 'Software de Gestión & Servidores',
      montoMensual: 35000,
      diaVencimiento: 1,
      activo: true,
    },
    {
      id: 'gf-5',
      sucursalId: 'sucursal-1',
      nombre: 'Seguro Integral de Comercio',
      montoMensual: 45000,
      diaVencimiento: 20,
      activo: false,
    },
  ],
  gastosDiarios: [
    {
      id: 'gd-1',
      sucursalId: 'sucursal-1',
      descripcion: 'Compra de artículos de limpieza y bolsas',
      monto: 3500,
      fecha: '2026-09-02T18:30:00.000Z',
      medioPago: 'efectivo',
      origenMovimientoCaja: 'mov-3',
    },
    {
      id: 'gd-2',
      sucursalId: 'sucursal-1',
      descripcion: 'Compra urgente de hielo en rolito',
      monto: 4000,
      fecha: '2026-09-02T20:00:00.000Z',
      medioPago: 'efectivo',
      origenMovimientoCaja: null,
    },
    {
      id: 'gd-3',
      sucursalId: 'sucursal-1',
      descripcion: 'Bobinas de papel térmico para comandas',
      monto: 2800,
      fecha: '2026-09-02T16:00:00.000Z',
      medioPago: 'transferencia',
      origenMovimientoCaja: null,
    },
  ],
};

// Agregar un nuevo gasto fijo mensual
export const agregarGastoFijo = ({
  nombre,
  montoMensual,
  diaVencimiento = null,
  activo = true,
  sucursalId = 'sucursal-1',
}) => {
  const nuevoGastoFijo = {
    id: `gf-${Date.now()}`,
    sucursalId: sucursalId || 'sucursal-1',
    nombre: nombre ? String(nombre).trim() : 'Gasto fijo sin nombre',
    montoMensual: Math.max(0, Number(montoMensual) || 0),
    diaVencimiento: diaVencimiento ? Number(diaVencimiento) : null,
    activo: activo !== false,
  };

  mockGastos.gastosFijos.push(nuevoGastoFijo);
  return nuevoGastoFijo;
};

// Editar un gasto fijo existente
export const editarGastoFijo = (id, cambios) => {
  const index = mockGastos.gastosFijos.findIndex((g) => g.id === id);
  if (index !== -1) {
    mockGastos.gastosFijos[index] = {
      ...mockGastos.gastosFijos[index],
      ...cambios,
      ...(cambios.nombre && { nombre: String(cambios.nombre).trim() }),
      ...(cambios.montoMensual !== undefined && {
        montoMensual: Math.max(0, Number(cambios.montoMensual) || 0),
      }),
    };
    return mockGastos.gastosFijos[index];
  }
  return null;
};

// Eliminar un gasto fijo
export const eliminarGastoFijo = (id) => {
  const index = mockGastos.gastosFijos.findIndex((g) => g.id === id);
  if (index !== -1) {
    const eliminado = mockGastos.gastosFijos.splice(index, 1);
    return eliminado[0];
  }
  return null;
};

// Agregar un nuevo gasto diario puntual
export const agregarGastoDiario = ({
  descripcion,
  monto,
  fecha,
  medioPago = 'efectivo',
  origenMovimientoCaja = null,
  sucursalId = 'sucursal-1',
}) => {
  const nuevoGastoDiario = {
    id: `gd-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    sucursalId: sucursalId || 'sucursal-1',
    descripcion: descripcion ? String(descripcion).trim() : 'Gasto diario',
    monto: Math.max(0, Number(monto) || 0),
    fecha: fecha || new Date().toISOString(),
    medioPago: medioPago || 'efectivo',
    origenMovimientoCaja: origenMovimientoCaja || null,
  };

  mockGastos.gastosDiarios.unshift(nuevoGastoDiario);
  return nuevoGastoDiario;
};

// Calcular prorrateo diario de gastos fijos para una fecha determinada
export const calcularProrrateoDiarioGastosFijos = (
  fecha = new Date(),
  listaGastosFijos = mockGastos.gastosFijos
) => {
  const d = new Date(fecha);
  const year = isNaN(d.getFullYear()) ? new Date().getFullYear() : d.getFullYear();
  const month = isNaN(d.getMonth()) ? new Date().getMonth() : d.getMonth();
  const diasEnMes = new Date(year, month + 1, 0).getDate();

  const lista = Array.isArray(listaGastosFijos)
    ? listaGastosFijos
    : mockGastos.gastosFijos;

  const totalMensualActivo = lista
    .filter((g) => g.activo !== false)
    .reduce((sum, g) => sum + (Number(g.montoMensual) || 0), 0);

  const prorrateoDiario = diasEnMes > 0 ? totalMensualActivo / diasEnMes : 0;

  return {
    diasEnMes,
    totalMensualActivo,
    prorrateoDiario: Math.round(prorrateoDiario),
  };
};

// =========================================================
// HISTORIAL CENTRALIZADO DE VENTAS PARA REPORTES
// =========================================================

export const mockHistorialVentas = [
  // --- HOY (2026-09-02) ---
  {
    id: 'VTA-101',
    sucursalId: 'sucursal-1',
    fecha: '2026-09-02T20:15:00.000Z',
    canal: 'delivery', // 'salon' | 'delivery' | 'takeaway'
    cliente: 'Juan Pérez',
    total: 9700,
    medioPago: 'transferencia',
    items: [
      { productoId: 'prod-1', nombre: 'Pizza Muzzarella Tradicional', cantidad: 1, precioUnitario: 7500, tipo: 'producto' },
      { productoId: 'prod-4', nombre: 'Coca-Cola 500ml', cantidad: 1, precioUnitario: 2200, tipo: 'producto' },
    ],
  },
  {
    id: 'VTA-102',
    sucursalId: 'sucursal-1',
    fecha: '2026-09-02T20:05:00.000Z',
    canal: 'delivery',
    cliente: 'Lucía Morales',
    total: 11900,
    medioPago: 'efectivo',
    items: [
      { promoId: 'promo-1', nombre: 'Combo Individual: Muzza + Coca-Cola', cantidad: 1, precioUnitario: 8200, tipo: 'promocion' },
      { productoId: 'prod-5', nombre: 'Cerveza Quilmes 1L', cantidad: 1, precioUnitario: 3700, tipo: 'producto' },
    ],
  },
  {
    id: 'VTA-103',
    sucursalId: 'sucursal-1',
    fecha: '2026-09-02T20:40:00.000Z',
    canal: 'salon',
    mesaNumero: 3,
    total: 21800,
    medioPago: 'tarjeta',
    items: [
      { productoId: 'prod-2', nombre: 'Pizza Especial Jamón y Morrones', cantidad: 1, precioUnitario: 9800, tipo: 'producto' },
      { productoId: 'prod-3', nombre: 'Empanada de Carne Criolla', cantidad: 4, precioUnitario: 1500, tipo: 'producto' },
      { productoId: 'prod-5', nombre: 'Cerveza Quilmes 1L', cantidad: 1, precioUnitario: 3700, tipo: 'producto' },
      { productoId: 'prod-6', nombre: 'Agua Mineral 500ml', cantidad: 1, precioUnitario: 1800, tipo: 'producto' },
    ],
  },
  {
    id: 'VTA-104',
    sucursalId: 'sucursal-1',
    fecha: '2026-09-02T19:35:00.000Z',
    canal: 'takeaway',
    cliente: 'Paula Benítez',
    total: 7500,
    medioPago: 'efectivo',
    items: [
      { productoId: 'prod-1', nombre: 'Pizza Muzzarella Tradicional', cantidad: 1, precioUnitario: 7500, tipo: 'producto' },
    ],
  },
  {
    id: 'VTA-105',
    sucursalId: 'sucursal-1',
    fecha: '2026-09-02T19:50:00.000Z',
    canal: 'takeaway',
    cliente: 'Camila Domínguez',
    total: 8200,
    medioPago: 'transferencia',
    items: [
      { promoId: 'promo-1', nombre: 'Combo Individual: Muzza + Coca-Cola', cantidad: 1, precioUnitario: 8200, tipo: 'promocion' },
    ],
  },
  {
    id: 'VTA-106',
    sucursalId: 'sucursal-1',
    fecha: '2026-09-02T19:10:00.000Z',
    canal: 'salon',
    mesaNumero: 1,
    total: 15600,
    medioPago: 'efectivo',
    items: [
      { promoId: 'promo-2', nombre: 'Dúo Pizza Especial + Cerveza Quilmes', cantidad: 1, precioUnitario: 12000, tipo: 'promocion' },
      { productoId: 'prod-4', nombre: 'Coca-Cola 500ml', cantidad: 1, precioUnitario: 2200, tipo: 'producto' },
      { productoId: 'prod-6', nombre: 'Agua Mineral 500ml', cantidad: 1, precioUnitario: 1800, tipo: 'producto' },
    ],
  },

  // --- AYER (2026-09-01) ---
  {
    id: 'VTA-201',
    sucursalId: 'sucursal-1',
    fecha: '2026-09-01T21:30:00.000Z',
    canal: 'salon',
    mesaNumero: 4,
    total: 34500,
    medioPago: 'tarjeta',
    items: [
      { productoId: 'prod-2', nombre: 'Pizza Especial Jamón y Morrones', cantidad: 2, precioUnitario: 9800, tipo: 'producto' },
      { productoId: 'prod-3', nombre: 'Empanada de Carne Criolla', cantidad: 6, precioUnitario: 1500, tipo: 'producto' },
      { productoId: 'prod-5', nombre: 'Cerveza Quilmes 1L', cantidad: 2, precioUnitario: 3700, tipo: 'producto' },
    ],
  },
  {
    id: 'VTA-202',
    sucursalId: 'sucursal-1',
    fecha: '2026-09-01T20:10:00.000Z',
    canal: 'delivery',
    cliente: 'Martín Palermo',
    total: 18900,
    medioPago: 'transferencia',
    items: [
      { promoId: 'promo-3', nombre: 'Super Picada: Docena Criolla + 2 Bebidas', cantidad: 1, precioUnitario: 18900, tipo: 'promocion' },
    ],
  },
  {
    id: 'VTA-203',
    sucursalId: 'sucursal-1',
    fecha: '2026-09-01T19:40:00.000Z',
    canal: 'takeaway',
    cliente: 'Sofía Álvarez',
    total: 9800,
    medioPago: 'efectivo',
    items: [
      { productoId: 'prod-2', nombre: 'Pizza Especial Jamón y Morrones', cantidad: 1, precioUnitario: 9800, tipo: 'producto' },
    ],
  },

  // --- DÍAS ANTERIORES DE ESTA SEMANA (2026-08-31 / 2026-08-30 / 2026-08-29) ---
  {
    id: 'VTA-301',
    sucursalId: 'sucursal-1',
    fecha: '2026-08-31T20:00:00.000Z',
    canal: 'salon',
    mesaNumero: 2,
    total: 42000,
    medioPago: 'tarjeta',
    items: [
      { productoId: 'prod-1', nombre: 'Pizza Muzzarella Tradicional', cantidad: 2, precioUnitario: 7500, tipo: 'producto' },
      { productoId: 'prod-2', nombre: 'Pizza Especial Jamón y Morrones', cantidad: 2, precioUnitario: 9800, tipo: 'producto' },
      { productoId: 'prod-5', nombre: 'Cerveza Quilmes 1L', cantidad: 2, precioUnitario: 3700, tipo: 'producto' },
    ],
  },
  {
    id: 'VTA-302',
    sucursalId: 'sucursal-1',
    fecha: '2026-08-30T21:15:00.000Z',
    canal: 'delivery',
    cliente: 'Esteban Quito',
    total: 26400,
    medioPago: 'efectivo',
    items: [
      { promoId: 'promo-3', nombre: 'Super Picada: Docena Criolla + 2 Bebidas', cantidad: 1, precioUnitario: 18900, tipo: 'promocion' },
      { productoId: 'prod-1', nombre: 'Pizza Muzzarella Tradicional', cantidad: 1, precioUnitario: 7500, tipo: 'producto' },
    ],
  },
  {
    id: 'VTA-303',
    sucursalId: 'sucursal-1',
    fecha: '2026-08-29T20:50:00.000Z',
    canal: 'salon',
    mesaNumero: 5,
    total: 31000,
    medioPago: 'transferencia',
    items: [
      { productoId: 'prod-2', nombre: 'Pizza Especial Jamón y Morrones', cantidad: 2, precioUnitario: 9800, tipo: 'producto' },
      { productoId: 'prod-5', nombre: 'Cerveza Quilmes 1L', cantidad: 2, precioUnitario: 3700, tipo: 'producto' },
      { productoId: 'prod-4', nombre: 'Coca-Cola 500ml', cantidad: 2, precioUnitario: 2200, tipo: 'producto' },
    ],
  },
  {
    id: 'VTA-304',
    sucursalId: 'sucursal-1',
    fecha: '2026-08-28T20:20:00.000Z',
    canal: 'takeaway',
    cliente: 'Marina Silva',
    total: 17300,
    medioPago: 'efectivo',
    items: [
      { productoId: 'prod-1', nombre: 'Pizza Muzzarella Tradicional', cantidad: 1, precioUnitario: 7500, tipo: 'producto' },
      { productoId: 'prod-2', nombre: 'Pizza Especial Jamón y Morrones', cantidad: 1, precioUnitario: 9800, tipo: 'producto' },
    ],
  },
  {
    id: 'VTA-305',
    sucursalId: 'sucursal-1',
    fecha: '2026-08-27T21:00:00.000Z',
    canal: 'delivery',
    cliente: 'Mariano Iúdica',
    total: 22700,
    medioPago: 'transferencia',
    items: [
      { promoId: 'promo-2', nombre: 'Dúo Pizza Especial + Cerveza Quilmes', cantidad: 1, precioUnitario: 12000, tipo: 'promocion' },
      { productoId: 'prod-2', nombre: 'Pizza Especial Jamón y Morrones', cantidad: 1, precioUnitario: 9800, tipo: 'producto' },
    ],
  },
  {
    id: 'VTA-306',
    fecha: '2026-08-20T20:30:00.000Z',
    canal: 'salon',
    mesaNumero: 2,
    total: 38000,
    medioPago: 'tarjeta',
    items: [
      { productoId: 'prod-1', nombre: 'Pizza Muzzarella Tradicional', cantidad: 2, precioUnitario: 7500, tipo: 'producto' },
      { productoId: 'prod-2', nombre: 'Pizza Especial Jamón y Morrones', cantidad: 2, precioUnitario: 9800, tipo: 'producto' },
      { productoId: 'prod-4', nombre: 'Coca-Cola 500ml', cantidad: 2, precioUnitario: 2200, tipo: 'producto' },
    ],
  },
  {
    id: 'VTA-307',
    fecha: '2026-08-15T21:00:00.000Z',
    canal: 'delivery',
    cliente: 'Gonzalo Higuain',
    total: 28700,
    medioPago: 'efectivo',
    items: [
      { promoId: 'promo-3', nombre: 'Super Picada: Docena Criolla + 2 Bebidas', cantidad: 1, precioUnitario: 18900, tipo: 'promocion' },
      { productoId: 'prod-2', nombre: 'Pizza Especial Jamón y Morrones', cantidad: 1, precioUnitario: 9800, tipo: 'producto' },
    ],
  },
  {
    id: 'VTA-308',
    fecha: '2026-07-25T20:00:00.000Z',
    canal: 'salon',
    mesaNumero: 6,
    total: 55000,
    medioPago: 'tarjeta',
    items: [
      { productoId: 'prod-1', nombre: 'Pizza Muzzarella Tradicional', cantidad: 3, precioUnitario: 7500, tipo: 'producto' },
      { productoId: 'prod-2', nombre: 'Pizza Especial Jamón y Morrones', cantidad: 2, precioUnitario: 9800, tipo: 'producto' },
      { productoId: 'prod-5', nombre: 'Cerveza Quilmes 1L', cantidad: 3, precioUnitario: 3700, tipo: 'producto' },
    ],
  },
  {
    id: 'VTA-309',
    fecha: '2026-06-18T20:30:00.000Z',
    canal: 'delivery',
    cliente: 'Lucas Romero',
    total: 41000,
    medioPago: 'transferencia',
    items: [
      { promoId: 'promo-3', nombre: 'Super Picada: Docena Criolla + 2 Bebidas', cantidad: 2, precioUnitario: 18900, tipo: 'promocion' },
      { productoId: 'prod-4', nombre: 'Coca-Cola 500ml', cantidad: 1, precioUnitario: 2200, tipo: 'producto' },
    ],
  },
];

// Obtener todas las ventas unificadas
export const obtenerTodasLasVentas = () => {
  return [...mockHistorialVentas];
};

// Función para desglosar una venta o ítem individual entre Comida y Bebida
export const desglosarItemComidaBebida = (item) => {
  if (!item) return { comida: 0, bebida: 0, total: 0 };

  const cant = Number(item.cantidad) || 1;
  const precioUnit = Number(item.precioUnitario) || 0;
  const subtotal = precioUnit * cant;

  const esPromo =
    item.tipo === 'promocion' ||
    Boolean(item.promoId) ||
    mockPromociones.some(
      (pr) => pr.id === item.itemId || pr.nombre === item.nombre
    );

  // Si es un producto regular
  if (!esPromo) {
    const prod = mockProductos.find(
      (p) =>
        p.id === item.productoId ||
        p.id === item.itemId ||
        p.nombre === item.nombre
    );
    const cat = mockCategorias.find((c) => c.id === prod?.categoriaId);
    const esBebida =
      cat?.tipo === 'bebida' ||
      prod?.categoriaNombre?.toLowerCase().includes('bebida') ||
      item.categoria?.toLowerCase().includes('bebida');

    return {
      comida: esBebida ? 0 : subtotal,
      bebida: esBebida ? subtotal : 0,
      total: subtotal,
    };
  }

  // Si es una promoción / combo
  const promo = mockPromociones.find(
    (pr) =>
      pr.id === item.promoId ||
      pr.id === item.itemId ||
      pr.nombre === item.nombre
  );
  if (!promo || !promo.items || promo.items.length === 0) {
    // Por defecto 75% comida / 25% bebida si no se encuentra
    return {
      comida: Math.round(subtotal * 0.75),
      bebida: Math.round(subtotal * 0.25),
      total: subtotal,
    };
  }

  // Calcular pesos individuales de la promo
  let sumaListaComida = 0;
  let sumaListaBebida = 0;

  promo.items.forEach((it) => {
    const prod = mockProductos.find((p) => p.id === it.productoId);
    if (!prod) return;
    const cat = mockCategorias.find((c) => c.id === prod.categoriaId);
    const precioProd = Number(prod.precioVenta) || 0;
    const cantProd = Number(it.cantidad) || 1;
    const subtotalProd = precioProd * cantProd;

    if (
      cat?.tipo === 'bebida' ||
      prod.categoriaNombre?.toLowerCase().includes('bebida')
    ) {
      sumaListaBebida += subtotalProd;
    } else {
      sumaListaComida += subtotalProd;
    }
  });

  const sumaListaTotal = sumaListaComida + sumaListaBebida;
  if (sumaListaTotal <= 0) {
    return { comida: subtotal, bebida: 0, total: subtotal };
  }

  const pesoComida = sumaListaComida / sumaListaTotal;
  const comidaAsignada = Math.round(subtotal * pesoComida);
  const bebidaAsignada = subtotal - comidaAsignada;

  return {
    comida: comidaAsignada,
    bebida: bebidaAsignada,
    total: subtotal,
  };
};

/**
 * Calcula el desglose consolidado de comida y bebida para una lista de ítems.
 * Reparte proporcionalmente el precio de los combos entre comida y bebida.
 * @param {Array} items - Listado de ítems del pedido (con producto/promo, cantidad y precio)
 * @returns {{ montoComida: number, montoBebida: number }}
 */
export const calcularDesgloseComidaBebida = (items = []) => {
  if (!Array.isArray(items) || items.length === 0) {
    return { montoComida: 0, montoBebida: 0 };
  }

  let montoComida = 0;
  let montoBebida = 0;

  items.forEach((item) => {
    const desglose = desglosarItemComidaBebida(item);
    montoComida += desglose.comida || 0;
    montoBebida += desglose.bebida || 0;
  });

  return {
    montoComida: Math.round(montoComida),
    montoBebida: Math.round(montoBebida),
  };
};






