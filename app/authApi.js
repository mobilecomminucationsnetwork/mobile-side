import api from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react'; // Add this for the default export

// Kullanıcı Kaydı (Register)
export const register = async (userData) => {
  try {
    // Ensure all required fields are present
    const completeUserData = {
      ...userData,
      first_name: userData.first_name || userData.name?.split(' ')[0] || '',
      last_name: userData.last_name || userData.name?.split(' ').slice(1).join(' ') || '',
      password2: userData.password2 || userData.password || '', // Use password2 if provided, otherwise use password
    };
    
    const response = await api.post('/api/auth/register/', completeUserData);
    return response.data;
  } catch (error) {
    console.error('Registration error:', error.response?.data || error.message);
    throw error.response?.data || { error: error.message };
  }
};

// Kullanıcı Girişi (Login)
export const login = async (username, password) => {
  try {
    const response = await api.post('/api/auth/login/', { username, password });
    
    // Token'ları sakla
    if (response.data.tokens) {
      await AsyncStorage.setItem('accessToken', response.data.tokens.access);
      await AsyncStorage.setItem('refreshToken', response.data.tokens.refresh);
      // Kullanıcı bilgilerini de saklayabilirsiniz
      await AsyncStorage.setItem('user', JSON.stringify(response.data.user));
    }
    
    return response.data;
  } catch (error) {
    console.error('Login error:', error.response?.data || error.message);
    throw error.response?.data || { error: error.message };
  }
};

// Kullanıcı Çıkışı (Logout)
export const logout = async () => {
  try {
    // Çıkış API'sini çağır (mevcut token'ı kullanarak)
    const response = await api.post('/api/auth/logout/');
    
    // Token'ları ve kullanıcı bilgilerini temizle
    await AsyncStorage.removeItem('accessToken');
    await AsyncStorage.removeItem('refreshToken');
    await AsyncStorage.removeItem('user');
    
    return response.data;
  } catch (error) {
    console.error('Logout error:', error.response?.data || error.message);
    
    // API çağrısı başarısız olsa bile token'ları temizle
    await AsyncStorage.removeItem('accessToken');
    await AsyncStorage.removeItem('refreshToken');
    await AsyncStorage.removeItem('user');
    
    throw error.response?.data || { error: error.message };
  }
};

// Kullanıcı Bilgisi Alma
export const getCurrentUser = async () => {
  try {
    const userJson = await AsyncStorage.getItem('user');
    if (userJson) {
      return JSON.parse(userJson);
    }
    return null;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
};

// Token Kontrolü (kimlik doğrulama durumunu kontrol etme)
export const isAuthenticated = async () => {
  try {
    const token = await AsyncStorage.getItem('accessToken');
    return !!token;
  } catch (error) {
    console.error('Error checking authentication:', error);
    return false;
  }
};

// Add a default export (a dummy component) to satisfy expo-router
export default function AuthAPI() {
  // This is just a placeholder component to prevent the warning
  return React.createElement('div', null, 'Auth API is not a route');
}
