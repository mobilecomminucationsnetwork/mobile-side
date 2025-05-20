import React, { useEffect } from "react";
import { Stack } from "expo-router";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import websocketService from "./services/websocketService";
import notificationHandler from "./utils/NotificationHandler";

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
  const { isLoading } = useAuth();

  // Initialize WebSocket connection - only when actually logged in via manual login
  // This will now be handled in the login/dashboard screens instead of here

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
      initialRouteName="index" // Always start at the index page, not dashboard
    />
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f9fd",
  },
});
