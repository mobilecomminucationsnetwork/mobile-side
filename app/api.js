import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Base URL already configured with HTTP protocol

const API_URL = 'http://161.35.195.142:8000';

// Axios instance oluşturma
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// İstek gönderilmeden önce token ekle
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Make sure refresh token call also uses HTTP
export const refreshToken = async () => {
  try {
    const refreshToken = await AsyncStorage.getItem('refreshToken');
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    // Update to correct token refresh endpoint
    const response = await axios.post(`${API_URL}/api/auth/refresh-token/`, {
      refresh: refreshToken
    });

    if (response.data.access) {
      await AsyncStorage.setItem('accessToken', response.data.access);
      return response.data.access;
    }
  } catch (error) {
    console.error('Error refreshing token:', error);
    // For development, don't clear tokens on refresh failure to avoid login loops
    // Uncomment in production:
    // await AsyncStorage.removeItem('accessToken');
    // await AsyncStorage.removeItem('refreshToken');
    throw error;
  }
};

// Yanıt hata işleyici
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // 401 hatası (kimlik doğrulama hatası) ve daha önce token yenileme denemesi yapılmadıysa
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const newToken = await refreshToken();
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Token yenilenemezse
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;
