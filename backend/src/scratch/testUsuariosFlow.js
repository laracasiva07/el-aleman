const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const express = require('express');
const app = require('../app');
const Usuario = require('../models/Usuario');

async function testUsuariosFlow() {
  console.log('====================================================');
  console.log('🧪 INICIANDO VERIFICACIÓN DEL MÓDULO DE USUARIOS');
  console.log('====================================================\n');

  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) throw new Error('MONGO_URI no está configurada');
    await mongoose.connect(mongoUri);

    // Ensure initial seed users exist
    let usuarioDueno = await Usuario.findOne({ login: 'dueno' });
    if (!usuarioDueno) {
      usuarioDueno = await Usuario.create({
        nombre: 'Dueño Test',
        login: 'dueno',
        password: '1234',
        rol: 'dueno',
        activo: true
      });
    }

    let usuarioMozo = await Usuario.findOne({ login: 'mozo1' });
    if (!usuarioMozo) {
      usuarioMozo = await Usuario.create({
        nombre: 'Mozo 1 Test',
        login: 'mozo1',
        password: '1234',
        rol: 'mozo',
        activo: true
      });
    }

    let usuarioEncargado = await Usuario.findOne({ login: 'encargado' });
    if (!usuarioEncargado) {
      usuarioEncargado = await Usuario.create({
        nombre: 'Encargado Test',
        login: 'encargado',
        password: '1234',
        rol: 'encargado',
        activo: true
      });
    }

    // Helper for login request
    const loginUser = async (login, password) => {
      const server = app.listen(0);
      const port = server.address().port;
      try {
        const res = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ login, password })
        });
        const data = await res.json();
        return { status: res.status, data };
      } finally {
        server.close();
      }
    };

    // Helper for API request with token
    const apiCall = async (method, pathUrl, token, body = null) => {
      const server = app.listen(0);
      const port = server.address().port;
      try {
        const options = {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          }
        };
        if (body) options.body = JSON.stringify(body);
        const res = await fetch(`http://127.0.0.1:${port}${pathUrl}`, options);
        const data = await res.json();
        return { status: res.status, data };
      } finally {
        server.close();
      }
    };

    // Get tokens
    const loginDuenoRes = await loginUser('dueno', '1234');
    const tokenDueno = loginDuenoRes.data.token;

    const loginMozoRes = await loginUser('mozo1', '1234');
    const tokenMozo = loginMozoRes.data.token;

    const loginEncargadoRes = await loginUser('encargado', '1234');
    const tokenEncargado = loginEncargadoRes.data.token;

    console.log('1️⃣ PRUEBA DE CONTROL DE ACCESO (403 Forbidden para roles no dueños):');
    
    // Mozo intenta acceder a GET /api/usuarios
    const mozoGetRes = await apiCall('GET', '/api/usuarios', tokenMozo);
    console.log(`   - Mozo GET /api/usuarios: HTTP ${mozoGetRes.status} (${mozoGetRes.data.mensaje})`);
    if (mozoGetRes.status !== 403) throw new Error('Se esperaba 403 para Mozo en GET /api/usuarios');

    // Encargado intenta acceder a POST /api/usuarios
    const encargadoPostRes = await apiCall('POST', '/api/usuarios', tokenEncargado, {
      nombre: 'Nuevo Mozo', login: 'mozonuevo', password: '1234', rol: 'mozo'
    });
    console.log(`   - Encargado POST /api/usuarios: HTTP ${encargadoPostRes.status} (${encargadoPostRes.data.mensaje})`);
    if (encargadoPostRes.status !== 403) throw new Error('Se esperaba 403 para Encargado en POST /api/usuarios');
    console.log('   ✅ Control de acceso correcto: Mozo y Encargado reciben 403 Acceso denegado.\n');

    console.log('2️⃣ PRUEBA DE CREACIÓN DE USUARIO (POST /api/usuarios):');
    const testLogin = `user_test_${Date.now()}`;
    const crearRes = await apiCall('POST', '/api/usuarios', tokenDueno, {
      nombre: 'Usuario Test Temp',
      login: testLogin,
      password: 'password_vieja',
      rol: 'mozo'
    });
    console.log(`   - Crear usuario '${testLogin}': HTTP ${crearRes.status}`);
    if (crearRes.status !== 201) throw new Error('Error al crear usuario test');
    const nuevoUsuarioId = crearRes.data.usuario._id;
    console.log('   ✅ Usuario creado con éxito (contraseña no devuelta en JSON).\n');

    console.log('3️⃣ PRUEBA DE DUPLICADO DE LOGIN (Rechazar si el login ya existe):');
    const duplicadoRes = await apiCall('POST', '/api/usuarios', tokenDueno, {
      nombre: 'Otro Usuario',
      login: testLogin,
      password: 'password123',
      rol: 'mozo'
    });
    console.log(`   - Login duplicado '${testLogin}': HTTP ${duplicadoRes.status} (${duplicadoRes.data.mensaje})`);
    if (duplicadoRes.status !== 400) throw new Error('Se esperaba 400 en login duplicado');
    console.log('   ✅ Intento de registrar login duplicado rechazado adecuadamente.\n');

    console.log('4️⃣ PRUEBA DE CAMBIO DE CONTRASEÑA Y LOGIN:');
    // Login inicial con la password vieja
    const loginViejoRes = await loginUser(testLogin, 'password_vieja');
    console.log(`   - Login con contraseña vieja ('password_vieja'): HTTP ${loginViejoRes.status} (OK)`);
    if (loginViejoRes.status !== 200) throw new Error('Fallo al loguear con clave inicial');

    // Cambiar contraseña vía PATCH /api/usuarios/:id/password
    const cambioPassRes = await apiCall('PATCH', `/api/usuarios/${nuevoUsuarioId}/password`, tokenDueno, {
      password: 'password_nueva_123'
    });
    console.log(`   - PATCH /api/usuarios/${nuevoUsuarioId}/password: HTTP ${cambioPassRes.status} (${cambioPassRes.data.mensaje})`);
    if (cambioPassRes.status !== 200) throw new Error('Fallo al cambiar contraseña');

    // Intento de login con la contraseña VIEJA -> debe fallar (401)
    const loginViejoFallido = await loginUser(testLogin, 'password_vieja');
    console.log(`   - Intento de login con contraseña VIEJA: HTTP ${loginViejoFallido.status} (${loginViejoFallido.data.mensaje})`);
    if (loginViejoFallido.status !== 401) throw new Error('Se esperaba 401 para la clave vieja');

    // Intento de login con la contraseña NUEVA -> debe funcionar (200)
    const loginNuevoExitoso = await loginUser(testLogin, 'password_nueva_123');
    console.log(`   - Intento de login con contraseña NUEVA: HTTP ${loginNuevoExitoso.status} (Exitoso)`);
    if (loginNuevoExitoso.status !== 200) throw new Error('Fallo al loguear con la clave nueva');
    console.log('   ✅ Cambio de contraseña verificado correctamente: la clave vieja falla (401) y la nueva funciona (200).\n');

    console.log('5️⃣ PRUEBA DE DESACTIVAR USUARIO Y RECHAZO DE LOGIN:');
    // Desactivar el usuario (activo: false)
    const toggleRes = await apiCall('PATCH', `/api/usuarios/${nuevoUsuarioId}/activo`, tokenDueno, {
      activo: false
    });
    console.log(`   - Desactivar usuario: HTTP ${toggleRes.status} (activo: ${toggleRes.data.usuario.activo})`);
    if (toggleRes.status !== 200 || toggleRes.data.usuario.activo !== false) throw new Error('Fallo al desactivar usuario');

    // Intentar iniciar sesión con usuario desactivado
    const loginDesactivadoRes = await loginUser(testLogin, 'password_nueva_123');
    console.log(`   - Login de usuario desactivado: HTTP ${loginDesactivadoRes.status} (${loginDesactivadoRes.data.mensaje})`);
    if (loginDesactivadoRes.status !== 401 || loginDesactivadoRes.data.mensaje !== 'Usuario deshabilitado, contactá al dueño') {
      throw new Error(`Se esperaba 401 con el mensaje exacto 'Usuario deshabilitado, contactá al dueño'. Recibido: ${loginDesactivadoRes.data.mensaje}`);
    }
    console.log('   ✅ Usuario desactivado rechazado correctamente con el mensaje: "Usuario deshabilitado, contactá al dueño".\n');

    // Limpieza de usuario temporal
    await Usuario.findByIdAndDelete(nuevoUsuarioId);

    console.log('====================================================');
    console.log('🎉 TODAS LAS PRUEBAS SE COMPLETARON CON ÉXITO');
    console.log('====================================================');
  } catch (error) {
    console.error('\n❌ ERROR EN LA VERIFICACIÓN:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

testUsuariosFlow();
