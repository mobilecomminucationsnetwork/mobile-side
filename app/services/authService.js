import api from '../api';

// Auth endpoints from your Django URLs
const AUTH_ENDPOINTS = {
  LOGIN: '/api/auth/login/',
  LOGOUT: '/api/auth/logout/',
  REGISTER: '/api/auth/register/',
};

const authService = {
  // Login without token refresh mechanism
  login: async (username, password) => {
    try {
      const response = await api.post(AUTH_ENDPOINTS.LOGIN, {
        username,
        password
      });
      
      // Store user data from response
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Login failed:', error);
      return {
        success: false,
        error: error.response?.data?.detail || 'Login failed. Please try again.'
      };
    }
  },
  
  // Simple logout without token refresh
  logout: async () => {
    try {
      await api.post(AUTH_ENDPOINTS.LOGOUT);
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      // Even if server logout fails, we can still clear local state
      return { success: true };
    }
  },
  
  // Register a new user
  register: async (userData) => {
    try {
      const response = await api.post(AUTH_ENDPOINTS.REGISTER, userData);
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Registration failed:', error);
      return {
        success: false,
        error: error.response?.data || 'Registration failed. Please try again.'
      };
    }
  }
};

export default authService;
