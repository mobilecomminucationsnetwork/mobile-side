import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../api';

// Create the auth context with a default value
const AuthContext = createContext({
  isLoading: true,
  userToken: null,
  userData: null,
  userId: null,
  login: () => {},
  logout: () => {},
  isLoggedIn: false
});

// Important: Export default to fix the warning
export default AuthContext;

export const AuthProvider = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [userToken, setUserToken] = useState(null);
  const [userData, setUserData] = useState(null);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    // Replace the token checking logic with a simple loading completion
    // This removes the automatic login based on stored credentials
    const initializeAuth = async () => {
      try {
        // Clear any existing tokens to ensure fresh login
        await AsyncStorage.removeItem('userToken');
        await AsyncStorage.removeItem('accessToken');
        await AsyncStorage.removeItem('refreshToken');
        await AsyncStorage.removeItem('userData');
        
        // Reset state
        setUserToken(null);
        setUserData(null);
        setUserId(null);
      } catch (e) {
        console.log('Auth initialization error:', e);
      } finally {
        // Complete the loading regardless of result
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (userData, tokens) => {
    setIsLoading(true);
    try {
      // In a real app, tokens would come from the API response
      // Store both access and refresh tokens
      await AsyncStorage.setItem('accessToken', tokens.access);
      await AsyncStorage.setItem('refreshToken', tokens.refresh);
      
      // For backward compatibility
      await AsyncStorage.setItem('userToken', tokens.access);
      
      // Store user data
      await AsyncStorage.setItem('userData', JSON.stringify(userData));
      
      // Update state
      setUserToken(tokens.access);
      setUserData(userData);
      setUserId(userData.id || userData.userId);
      
      console.log('Login successful, tokens stored');
    } catch (e) {
      console.log('Login failed', e);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      // Clear all auth storage
      await AsyncStorage.removeItem('userToken');
      await AsyncStorage.removeItem('accessToken');
      await AsyncStorage.removeItem('refreshToken');
      await AsyncStorage.removeItem('userData');
      
      // Reset state
      setUserToken(null);
      setUserData(null);
      setUserId(null);
    } catch (e) {
      console.log('Logout failed', e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      isLoading, 
      userToken, 
      userData, 
      userId,
      login, 
      logout,
      isLoggedIn: !!userToken,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
