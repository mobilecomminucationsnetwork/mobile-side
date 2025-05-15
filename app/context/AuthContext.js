import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Create the auth context with a default value
const AuthContext = createContext({
  isLoading: true,
  userToken: null,
  userData: null,
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

  useEffect(() => {
    // Check for stored credentials when the app starts
    const bootstrapAsync = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        const userDataString = await AsyncStorage.getItem('userData');
        
        if (token && userDataString) {
          setUserToken(token);
          setUserData(JSON.parse(userDataString));
        }
      } catch (e) {
        console.log('Failed to load credentials from storage', e);
      } finally {
        setIsLoading(false);
      }
    };

    bootstrapAsync();
  }, []);

  const login = async (userData) => {
    setIsLoading(true);
    try {
      // In a real app, this would include API authentication
      const token = 'dummy-auth-token-' + Date.now();
      
      // Store credentials in AsyncStorage
      await AsyncStorage.setItem('userToken', token);
      await AsyncStorage.setItem('userData', JSON.stringify(userData));
      
      // Update state
      setUserToken(token);
      setUserData(userData);
    } catch (e) {
      console.log('Login failed', e);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      // Clear storage
      await AsyncStorage.removeItem('userToken');
      await AsyncStorage.removeItem('userData');
      
      // Reset state
      setUserToken(null);
      setUserData(null);
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
