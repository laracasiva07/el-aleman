const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');

// Importación de modelos
const Producto = require('../src/models/Producto');
const Categoria = require('../src/models/Categoria');
const Ingrediente = require('../src/models/Ingrediente');
const Pedido = require('../src/models/Pedido');
const Promocion = require('../src/models/Promocion');

// Normalizador de texto: trim, minúsculas y colapso de espacios múltiples
const normalizarTexto = (texto) => {
  if (!texto || typeof texto !== 'string') return '';
  return texto.trim().toLowerCase().replace(/\s+/g, ' ');
};

async function main() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('ERROR: MONGO_URI no está configurado en .env');
    process.exit(1);
  }

  const esEjecutar = process.argv.includes('--ejecutar');

  console.log('='.repeat(80));
  console.log(`SCRIPT DE DETECCIÓN Y LIMPIEZA DE PRODUCTOS DUPLICADOS`);
  console.log(`MODO: ${esEjecutar ? '⚠️  EJECUCIÓN REAL (--ejecutar)' : '🔍  DRY-RUN (SOLO LECTURA)'}`);
  console.log(`Base de datos: ${mongoUri.replace(/:[^:]*@/, ':****@')}`);
  console.log('='.repeat(80));

  await mongoose.connect(mongoUri);

  try {
    // -------------------------------------------------------------------------
    // 1. REVISIÓN DE REFERENCIAS Y COLECCIONES
    // -------------------------------------------------------------------------
    console.log('\n--- VERIFICACIÓN DE INTEGRIDAD REFERENCIAL ---');
    console.log('Colecciones y campos auditados para referencias a Producto:');
    console.log('  1. Pedido (colección "pedidos"): campo "items.productoId" (cubre Salón, Delivery y Take Away)');
    console.log('  2. Promocion (colección "promocions"): campo "productos.productoId"');

    // -------------------------------------------------------------------------
    // 2. DETECCIÓN Y AGRUPACIÓN DE PRODUCTOS DUPLICADOS
    // -------------------------------------------------------------------------
    const todosProductos = await Producto.find().lean();
    const todasCategorias = await Categoria.find().lean();
    const categoriasMap = new Map(todasCategorias.map((c) => [c._id.toString(), c.nombre]));

    // Agrupación por: categoriaId + nombre normalizado
    const gruposMap = new Map();

    for (const prod of todosProductos) {
      const catId = prod.categoriaId ? prod.categoriaId.toString() : 'sin_categoria';
      const nombreNorm = normalizarTexto(prod.nombre);
      const claveGrupo = `${catId}:::${nombreNorm}`;

      if (!gruposMap.has(claveGrupo)) {
        gruposMap.set(claveGrupo, []);
      }
      gruposMap.get(claveGrupo).push(prod);
    }

    // Filtrar solo grupos con más de 1 producto (duplicados reales)
    const gruposDuplicados = [];
    for (const [clave, docs] of gruposMap.entries()) {
      if (docs.length > 1) {
        gruposDuplicados.push({ clave, docs });
      }
    }

    console.log(`\nTotal de productos en base de datos: ${todosProductos.length}`);
    console.log(`Grupos con productos duplicados detectados: ${gruposDuplicados.length}`);

    // -------------------------------------------------------------------------
    // 3. ANÁLISIS DE CADA GRUPO DUPLICADO
    // -------------------------------------------------------------------------
    let totalConservar = 0;
    let totalBorrar = 0;
    let totalRevisionManual = 0;
    const documentosParaBorrar = [];

    if (gruposDuplicados.length === 0) {
      console.log('\n✅ No se encontraron productos duplicados.');
    } else {
      console.log('\n' + '-'.repeat(80));
      console.log('DETALLE DE GRUPOS DE PRODUCTOS DUPLICADOS');
      console.log('-'.repeat(80));

      for (let i = 0; i < gruposDuplicados.length; i++) {
        const { clave, docs } = gruposDuplicados[i];
        const catId = docs[0].categoriaId ? docs[0].categoriaId.toString() : null;
        const nombreCat = catId ? (categoriasMap.get(catId) || 'Categoría Desconocida') : 'Sin Categoría';
        const nombreGrupo = docs[0].nombre;

        // Contar referencias para cada documento
        for (const doc of docs) {
          const refsPedidos = await Pedido.countDocuments({ 'items.productoId': doc._id });
          const refsPromociones = await Promocion.countDocuments({ 'productos.productoId': doc._id });
          doc.refsPedidos = refsPedidos;
          doc.refsPromociones = refsPromociones;
          doc.totalReferencias = refsPedidos + refsPromociones;
        }

        // Comparar datos entre duplicados
        const precios = new Set(docs.map((d) => Number(d.precioVenta)));
        const disponibilidades = new Set(docs.map((d) => Boolean(d.disponible)));
        const cantInsumos = new Set(docs.map((d) => (d.receta || []).length));

        const difierePrecio = precios.size > 1;
        const difiereDisponibilidad = disponibilidades.size > 1;
        const difiereReceta = cantInsumos.size > 1;
        const hayDiferencias = difierePrecio || difiereDisponibilidad || difiereReceta;

        const discrepancias = [];
        if (difierePrecio) discrepancias.push(`Precio (${Array.from(precios).map((p) => '$' + p).join(' vs ')})`);
        if (difiereDisponibilidad) discrepancias.push(`Disponibilidad (${Array.from(disponibilidades).join(' vs ')})`);
        if (difiereReceta) discrepancias.push(`Receta (${Array.from(cantInsumos).map((c) => c + ' insumos').join(' vs ')})`);

        // Criterio de conservación
        const docsConRefs = docs.filter((d) => d.totalReferencias > 0);

        if (docsConRefs.length > 1) {
          // Más de uno tiene referencias -> REVISIÓN MANUAL obligatoria, no borrar nada
          docs.forEach((d) => {
            d.accion = 'REVISIÓN MANUAL';
            totalRevisionManual++;
          });
        } else if (docsConRefs.length === 1) {
          // Exactamente uno tiene referencias -> conservar ese
          const conservado = docsConRefs[0];
          docs.forEach((d) => {
            if (d._id.toString() === conservado._id.toString()) {
              d.accion = 'CONSERVAR';
              totalConservar++;
            } else {
              d.accion = 'BORRAR';
              totalBorrar++;
              documentosParaBorrar.push(d);
            }
          });
        } else {
          // Ninguno tiene referencias -> conservar el más antiguo (menor createdAt)
          docs.sort((a, b) => {
            const fechaA = new Date(a.createdAt || a._id.getTimestamp()).getTime();
            const fechaB = new Date(b.createdAt || b.getTimestamp ? b.createdAt : b._id.getTimestamp()).getTime();
            return fechaA - fechaB;
          });

          const masAntiguo = docs[0];
          docs.forEach((d) => {
            if (d._id.toString() === masAntiguo._id.toString()) {
              d.accion = 'CONSERVAR';
              totalConservar++;
            } else {
              d.accion = 'BORRAR';
              totalBorrar++;
              documentosParaBorrar.push(d);
            }
          });
        }

        // Imprimir reporte del grupo
        console.log(`\n[GRUPO #${i + 1}] Producto: "${nombreGrupo}" | Categoría: "${nombreCat}" (${catId})`);
        if (hayDiferencias) {
          console.log(`  ⚠️  ATENCIÓN: Existen diferencias entre duplicados -> ${discrepancias.join(' | ')}`);
        } else {
          console.log('  ℹ️  Los duplicados tienen idéntico precio, disponibilidad y cantidad de receta.');
        }

        console.log('  ' + '-'.repeat(76));
        console.log(`  ${'ID'.padEnd(26)} | ${'Creado'.padEnd(20)} | ${'Precio'.padEnd(8)} | ${'Disp.'.padEnd(6)} | ${'Insumos'.padEnd(8)} | ${'Refs (Ped/Pro)'.padEnd(15)} | Acción`);
        console.log('  ' + '-'.repeat(76));

        for (const doc of docs) {
          const fechaStr = doc.createdAt ? new Date(doc.createdAt).toISOString().replace('T', ' ').substring(0, 19) : 'Sin fecha';
          const precioStr = ('$' + doc.precioVenta).padEnd(8);
          const dispStr = (doc.disponible ? 'Sí' : 'No').padEnd(6);
          const insumosStr = String((doc.receta || []).length).padEnd(8);
          const refsStr = `${doc.totalReferencias} (${doc.refsPedidos}/${doc.refsPromociones})`.padEnd(15);
          const accionStr = doc.accion === 'CONSERVAR' ? '✅ CONSERVAR' : (doc.accion === 'BORRAR' ? '❌ BORRAR' : '⚠️ REVISIÓN MANUAL');

          console.log(`  ${doc._id.toString().padEnd(26)} | ${fechaStr} | ${precioStr} | ${dispStr} | ${insumosStr} | ${refsStr} | ${accionStr}`);
        }
      }
    }

    // -------------------------------------------------------------------------
    // 4. RESUMEN DE PRODUCTOS
    // -------------------------------------------------------------------------
    console.log('\n' + '='.repeat(80));
    console.log('RESUMEN GENERAL DE PRODUCTOS');
    console.log('='.repeat(80));
    console.log(`Total productos analizados       : ${todosProductos.length}`);
    console.log(`Grupos de duplicados detectados  : ${gruposDuplicados.length}`);
    console.log(`Productos a CONSERVAR            : ${totalConservar}`);
    console.log(`Productos marcados para BORRAR   : ${totalBorrar}`);
    console.log(`Productos en REVISIÓN MANUAL     : ${totalRevisionManual}`);

    // -------------------------------------------------------------------------
    // 5. EJECUCIÓN (SOLO SI SE PASA --ejecutar)
    // -------------------------------------------------------------------------
    if (esEjecutar) {
      if (documentosParaBorrar.length === 0) {
        console.log('\nNo hay documentos marcados para borrar.');
      } else {
        const fecha = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = path.join(__dirname, `respaldo-duplicados-${fecha}.json`);

        fs.writeFileSync(backupPath, JSON.stringify(documentosParaBorrar, null, 2), 'utf-8');
        console.log(`\n💾 Respaldo de seguridad guardado en: ${backupPath}`);

        let borrados = 0;
        for (const doc of documentosParaBorrar) {
          // Doble verificación estricta de seguridad: nunca borrar con referencias
          if (doc.totalReferencias > 0) {
            console.error(`⛔ ALERTA: Intento de borrar doc con referencias omitido (${doc._id})`);
            continue;
          }
          await Producto.findByIdAndDelete(doc._id);
          borrados++;
        }
        console.log(`🗑️  Se eliminaron ${borrados} productos duplicados exitosamente.`);
      }
    } else {
      console.log('\n[MODO DRY-RUN ACTIVO] No se modificó ni borró ningún dato en la base.');
      console.log('Para ejecutar los borrados una vez revisado, corra el script con: node backend/scripts/limpiarDuplicados.js --ejecutar');
    }

    // -------------------------------------------------------------------------
    // 6. CHEQUEO ADICIONAL DE DUPLICADOS EN CATEGORÍAS E INGREDIENTES (SOLO LECTURA)
    // -------------------------------------------------------------------------
    console.log('\n' + '='.repeat(80));
    console.log('AUDITORÍA DE DUPLICADOS EN OTRAS COLECCIONES (SOLO LECTURA)');
    console.log('='.repeat(80));

    // A. Categorías
    const categoriasGrupos = new Map();
    for (const cat of todasCategorias) {
      const norm = normalizarTexto(cat.nombre);
      if (!categoriasGrupos.has(norm)) categoriasGrupos.set(norm, []);
      categoriasGrupos.get(norm).push(cat);
    }
    const catDuplicadas = Array.from(categoriasGrupos.entries()).filter(([_, docs]) => docs.length > 1);

    console.log(`\nCategorías analizadas: ${todasCategorias.length}`);
    if (catDuplicadas.length === 0) {
      console.log('  ✅ No se detectaron duplicados en Categorías.');
    } else {
      console.log(`  ⚠️  Se encontraron ${catDuplicadas.length} grupos de Categorías duplicadas:`);
      for (const [nombreNorm, docs] of catDuplicadas) {
        console.log(`    - Nombre normalizado: "${nombreNorm}" (${docs.length} documentos):`);
        docs.forEach((d) => console.log(`        ID: ${d._id} | Nombre original: "${d.nombre}" | Tipo: "${d.tipo}"`));
      }
    }

    // B. Ingredientes
    const todosIngredientes = await Ingrediente.find().lean();
    const ingredientesGrupos = new Map();
    for (const ing of todosIngredientes) {
      const norm = normalizarTexto(ing.nombre);
      if (!ingredientesGrupos.has(norm)) ingredientesGrupos.set(norm, []);
      ingredientesGrupos.get(norm).push(ing);
    }
    const ingDuplicados = Array.from(ingredientesGrupos.entries()).filter(([_, docs]) => docs.length > 1);

    console.log(`\nIngredientes analizados: ${todosIngredientes.length}`);
    if (ingDuplicados.length === 0) {
      console.log('  ✅ No se detectaron duplicados en Ingredientes.');
    } else {
      console.log(`  ⚠️  Se encontraron ${ingDuplicados.length} grupos de Ingredientes duplicados:`);
      for (const [nombreNorm, docs] of ingDuplicados) {
        console.log(`    - Nombre normalizado: "${nombreNorm}" (${docs.length} documentos):`);
        docs.forEach((d) => console.log(`        ID: ${d._id} | Nombre original: "${d.nombre}" | Unidad: "${d.unidadMedida}"`));
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('FIN DE LA AUDITORÍA');
    console.log('='.repeat(80));
  } catch (error) {
    console.error('Error al ejecutar el script de duplicados:', error);
  } finally {
    await mongoose.connection.close();
  }
}

main();
