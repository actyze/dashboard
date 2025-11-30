import React, { createContext, useContext, useState, useEffect } from 'react';
import { AuthService } from '../services/AuthService';
import { apiInstance } from '../services/network';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        // Set default header for future requests
        apiInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        try {
          const userData = await AuthService.getCurrentUser();
          setUser(userData);
        } catch (err) {
          console.error('Token validation failed', err);
          logout();
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (username, password) => {
    setError(null);
    try {
      const response = await AuthService.login(username, password);
      const { access_token, user: userData } = response;
      
      // Store token
      localStorage.setItem('token', access_token);
      
      // Set default header
      apiInstance.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
      
      // Set user
      setUser(userData);
      return true;
    } catch (err) {
      setError(err.message || 'Login failed');
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    delete apiInstance.defaults.headers.common['Authorization'];
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

