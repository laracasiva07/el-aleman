import { useState } from 'react';
import { AuthContext } from './authContextInstance';
import apiClient from '../services/apiClient';

const STORAGE_KEY = 'pizzeria_auth_user';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem(STORAGE_KEY);
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });

  const login = async (loginInput, password) => {
    try {
      const response = await apiClient.post('/auth/login', {
        login: loginInput,
        password,
      });

      const { usuario, token } = response.data;

      localStorage.setItem('token', token);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(usuario));

      setUser(usuario);
      return { success: true, user: usuario };
    } catch (error) {
      const errorMessage =
        error.response?.data?.mensaje ||
        'No se pudo conectar con el servidor de autenticación';
      return {
        success: false,
        error: errorMessage,
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  };

  const obtenerPerfil = async () => {
    try {
      const response = await apiClient.get('/auth/perfil');
      const usuario = response.data.usuario;

      localStorage.setItem(STORAGE_KEY, JSON.stringify(usuario));
      setUser(usuario);
      return { success: true, user: usuario };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.mensaje || 'Error al obtener perfil',
      };
    }
  };

  const value = {
    user,
    isAuthenticated: Boolean(user),
    login,
    logout,
    obtenerPerfil,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

