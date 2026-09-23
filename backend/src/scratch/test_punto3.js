require('dotenv').config();
const mongoose = require('mongoose');
const express = require('express');
const app = require('../app');
const conectarDB = require('../config/db');
const Usuario = require('../models/Usuario');
const jwt = require('jsonwebtoken');

const testPunto3 = async () => {
  try {
    await conectarDB();

    // Obtener mozo y encargado
    const mozo = await Usuario.findOne({ login: 'mozo1' });
    const encargado = await Usuario.findOne({ login: 'encargado' });

    if (!mozo || !encargado) {
      console.error('No se encontraron usuarios mozo1 o encargado');
      process.exit(1);
    }

    const tokenMozo = jwt.sign({ id: mozo._id, rol: mozo.rol }, process.env.JWT_SECRET);
    const tokenEncargado = jwt.sign({ id: encargado._id, rol: encargado.rol }, process.env.JWT_SECRET);

    const server = app.listen(0, async () => {
      const port = server.address().port;
      const baseUrl = `http://localhost:${port}`;

      console.log(`Servidor de prueba corriendo en puerto ${port}`);

      const endpoints = [
        '/api/pedidos-salon/650000000000000000000001/cerrar',
        '/api/pedidos-delivery/650000000000000000000001/cerrar',
        '/api/pedidos-takeaway/650000000000000000000001/cerrar'
      ];

      let allPassed = true;

      for (const endpoint of endpoints) {
        // Intentar con token de mozo
        const resMozo = await fetch(`${baseUrl}${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tokenMozo}`
          },
          body: JSON.stringify({ medioPago: 'efectivo' })
        });

        const statusMozo = resMozo.status;
        const dataMozo = await resMozo.json();

        console.log(`Mozo POST ${endpoint} -> Status: ${statusMozo}, Mensaje: "${dataMozo.mensaje}"`);

        if (statusMozo !== 403) {
          console.error(`FAIL: Se esperaba 403 para mozo pero se obtuvo ${statusMozo}`);
          allPassed = false;
        } else {
          console.log(`PASS: Mozo fue bloqueado correctamente con 403.`);
        }

        // Intentar con token de encargado (no debe dar 403 por rol, sino otro status por lógica de negocio ej. 404 o 409)
        const resEncargado = await fetch(`${baseUrl}${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${tokenEncargado}`
          },
          body: JSON.stringify({ medioPago: 'efectivo' })
        });

        const statusEncargado = resEncargado.status;
        console.log(`Encargado POST ${endpoint} -> Status: ${statusEncargado}`);

        if (statusEncargado === 403) {
          console.error(`FAIL: Encargado no debería recibir 403.`);
          allPassed = false;
        } else {
          console.log(`PASS: Encargado no fue bloqueado con 403.`);
        }
      }

      server.close();
      mongoose.disconnect();

      if (allPassed) {
        console.log('\n✅ VERIFICACIÓN PUNTO 3 EXITOSA: El rol mozo está correctamente bloqueado (403) en todos los endpoints de cierre.');
        process.exit(0);
      } else {
        console.error('\n❌ VERIFICACIÓN PUNTO 3 FALLÓ.');
        process.exit(1);
      }
    });

  } catch (error) {
    console.error('Error durante el test:', error);
    process.exit(1);
  }
};

testPunto3();
