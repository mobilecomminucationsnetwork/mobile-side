import React from "react";
import { Stack } from "expo-router";
import { AuthProvider } from "./context/AuthContext";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import { useAuth } from "./context/AuthContext";

// Wrap the app with AuthProvider
export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}

// Navigation component that handles routing based on auth state
function RootLayoutNav() {
  const { isLoading, isLoggedIn } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4a7fee" />
      </View>
    );
  }

  return (
    <Stack 
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
      }}
      initialRouteName={isLoggedIn ? "dashboard" : "index"}
    />
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fd',
  },
});
