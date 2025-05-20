import React, { useEffect, useState, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  SafeAreaView,
  StatusBar,
  ScrollView, 
  Alert,
  Image,
  Dimensions,
  Animated,
  ActivityIndicator,
  Modal
} from 'react-native';
import { router } from 'expo-router';
import { MaterialIcons, Ionicons, Feather } from '@expo/vector-icons';
import { useAuth } from './context/AuthContext';
import api from './api';
import websocketService, { WebSocketEvents } from './services/websocketService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';

const { width } = Dimensions.get('window');

// Constants for API endpoints to match Django URLs
const DOOR_API_ENDPOINTS = {
  LIST: '/api/doors/',
  DOOR_CONTROL: '/api/doors', // Base endpoint for door control
  OPEN: '/api/doors/open-doors/',
  CLOSE: '/api/doors/close-doors/',
  SET_STATUS: (doorId) => `/api/doors/${doorId}/set-status/` // Hardware sends CLOSED status here
};

// Door physical states - different from the locked/unlocked software state
const DOOR_PHYSICAL_STATE = {
  CLOSED: 'CLOSED',  // Door is physically closed and can be locked
  OPEN: 'OPEN',      // Door is physically open and can't be locked
  UNKNOWN: 'UNKNOWN' // Door state is unknown
};

// Add this constant at the top (after imports, before component):
const SERVER_URL = "http://161.35.195.142:8000";
const ANON_STORE_URL = `${SERVER_URL}/api/anonymous-face-vectors/`;

export default function Home() {
  const { userData, logout } = useAuth();
  // Update the userName assignment to check multiple possible name fields
  const userName = userData?.name || userData?.full_name || userData?.fullName || 
                  userData?.displayName || userData?.username || 
                  userData?.firstName || "User"; // Get name from auth context with multiple fallbacks
  
  // Create separate animated values for UI animations with native driver
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const translateY = React.useRef(new Animated.Value(30)).current;
  
  // Create separate animated values for door animations without native driver
  const doorAnim = React.useRef(new Animated.Value(0)).current;
  const doorShadowOpacity = React.useRef(new Animated.Value(0)).current;
  const doorShadowScale = React.useRef(new Animated.Value(0)).current;
  const doorHandleColor = React.useRef(new Animated.Value(0)).current;
  const doorButtonColor = React.useRef(new Animated.Value(0)).current;
  
  // Use useRef for storing last log time between renders
  const lastDoorSystemLogTimeRef = useRef(0);
  
  // Last access state
  const [lastAccess, setLastAccess] = useState(null);
  const [loadingAccess, setLoadingAccess] = useState(true);
  
  // Door control state
  const [doorOpen, setDoorOpen] = useState(false);
  const [doorActionLoading, setDoorActionLoading] = useState(false);
  
  // New: Track physical door state (is it physically open or closed?)
  const [doorPhysicalState, setDoorPhysicalState] = useState(DOOR_PHYSICAL_STATE.UNKNOWN);
  
  // Connection status states
  const [wsConnected, setWsConnected] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [pollingFailed, setPollingFailed] = useState(false);
  const [serverUnreachable, setServerUnreachable] = useState(false);
  
  // New: Door system status state
  const [doorSystemActive, setDoorSystemActive] = useState(false);
  const [checkingDoorSystem, setCheckingDoorSystem] = useState(true);

  // Registered faces state
  const [registeredFaces, setRegisteredFaces] = useState([]);
  const [loadingFaces, setLoadingFaces] = useState(false);
  const [showRegisteredFaces, setShowRegisteredFaces] = useState(false);

  // Add state for anonymous activities
  const [anonymousActivities, setAnonymousActivities] = useState([]);
  const [loadingAnon, setLoadingAnon] = useState(false);

  // Format the access time to a readable string
  const formatAccessTime = (timestamp) => {
    if (!timestamp) return "No recent access";
    
    const accessDate = new Date(timestamp);
    const now = new Date();
    
    // Check if the access was today
    if (accessDate.toDateString() === now.toDateString()) {
      return `Today, ${accessDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    // Check if the access was yesterday
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (accessDate.toDateString() === yesterday.toDateString()) {
      return `Yesterday, ${accessDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    // Otherwise, show the full date
    return accessDate.toLocaleDateString() + ', ' + 
           accessDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  // Simulate fetching last access data from an API or local storage
  const fetchLastAccess = () => {
    setLoadingAccess(true);
    
    // Simulate API delay
    setTimeout(() => {
      // Randomly decide if there was a recent access (70% chance)
      const hasRecentAccess = Math.random() > 0.3;
      
      if (hasRecentAccess) {
        // Generate a random time within the last 24 hours
        const now = new Date();
        const hoursAgo = Math.floor(Math.random() * 24);
        const minutesAgo = Math.floor(Math.random() * 60);
        
        const accessTime = new Date(now);
        accessTime.setHours(now.getHours() - hoursAgo);
        accessTime.setMinutes(now.getMinutes() - minutesAgo);
        
        setLastAccess(accessTime.getTime());
      } else {
        setLastAccess(null);
      }
      
      setLoadingAccess(false);
    }, 1000);
  };
  
  // New: Function to check if the door system is actually active and operational
  const checkDoorSystemStatus = async () => {
    // Only start checking if we're not already checking
    if (checkingDoorSystem) {
      console.log('Already checking door system status, skipping');
      return;
    }
    
    console.log('Starting door system status check');
    setCheckingDoorSystem(true);
    
    // IMPORTANT: Create a reference to track if the check was completed
    let checkCompleted = false;
    
    // Add a more reliable timeout to ensure we don't get stuck in checking mode
    const timeoutId = setTimeout(() => {
      if (!checkCompleted) {
        console.log('Door system check timed out - forcing status resolution');
        // Force a status - assuming system is active is better for UX
        setDoorSystemActive(true);
        setCheckingDoorSystem(false);
      }
    }, 3000); // Reduce timeout to 3 seconds for better UX
    
    try {
      // Attempt to get the status of the door system from the backend
      console.log('Making API call to check door system status...');
      const response = await api.get(DOOR_API_ENDPOINTS.LIST);
      
      checkCompleted = true;
      
      // If we get ANY successful response, the system is active
      console.log('Door system API response:', response.status);
      setDoorSystemActive(true);
      
      // If we have door data, update our door status
      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        console.log('Found door data:', response.data.length, 'doors');
        const firstDoor = response.data[0];
        if (firstDoor.status) {
          setDoorOpen(firstDoor.status === "OPEN");
        }
      } else {
        console.log('Door system is active but no doors are configured');
      }
    } catch (error) {
      checkCompleted = true;
      console.error('Error checking door system status:', error.message);
      
      // Check if we at least got a response from the server
      if (error.response) {
        // We got a response from the server, so the system is active
        console.log('Door API responded with error code:', error.response.status);
        setDoorSystemActive(true);
      } else if (error.request) {
        // No response received, server is unreachable
        console.log('No response received from door system API');
        setDoorSystemActive(false);
        setServerUnreachable(true);
      } else {
        // Something else went wrong
        console.log('Error setting up request:', error.message);
        // Assume system is active for better user experience
        setDoorSystemActive(true);
      }
    } finally {
      clearTimeout(timeoutId); // Clear the timeout in finally block
      
      if (checkCompleted) {
        console.log('Door system check completed, updating UI');
        setCheckingDoorSystem(false);
      }
    }
  };

  // Call the door system check on component mount and periodically
  useEffect(() => {
    // Check door system status immediately
    checkDoorSystemStatus();
    
    // Set up periodic check every 30 seconds
    const doorSystemCheckInterval = setInterval(() => {
      checkDoorSystemStatus();
    }, 30000);
    
    // Clean up interval on unmount
    return () => {
      clearInterval(doorSystemCheckInterval);
    };
  }, []); // Remove checkingDoorSystem from dependencies

  // Add a manual status reset function
  const resetSystemStatus = () => {
    console.log('Manually resetting system status');
    // Force the system to not be checking anymore
    setCheckingDoorSystem(false);
    // Default to system active for better UX
    setDoorSystemActive(true);
    setServerUnreachable(false);
    setPollingFailed(false);
  };

  // Add door status reading functionality
  const getDoorStatus = async () => {
    try {
      // Set a loading state if you want to show a loading indicator
      setDoorActionLoading(true);
      
      // Default door ID - this is the same ID that's working with your WebSocket
      const defaultDoorId = "e43b48ac-6cce-430e-a119-5c5ff5d62967";
      
      // First try to get door information from the system
      let doorId = null;
      let doorData = null;
      
      try {
        // Try to get door information from the API using the correct endpoint
        const doorsResponse = await api.get(DOOR_API_ENDPOINTS.LIST);
        
        if (doorsResponse.data && Array.isArray(doorsResponse.data) && doorsResponse.data.length > 0) {
          doorId = doorsResponse.data[0].id || doorsResponse.data[0].uuid;
          doorData = doorsResponse.data[0];
          console.log('Found door with ID:', doorId);
        } else {
          console.log('No doors found in API response, using default door ID');
          doorId = defaultDoorId;
        }
      } catch (error) {
        console.log('Error fetching doors from API:', error.message);
        doorId = defaultDoorId; // Use default if API fails
      }
      
      // If we have door data from the first API call, use that
      if (doorData && doorData.status) {
        const doorStatus = doorData.status;
        console.log(`Door status from API: ${doorStatus}`);
        setDoorOpen(doorStatus === "OPEN");
        return { success: true, status: doorStatus, doorId };
      }
      
      // If not, try to get the specific door status
      if (doorId) {
        try {
          const statusResponse = await api.get(`${DOOR_API_ENDPOINTS.LIST}${doorId}/`);
          
          if (statusResponse.data && statusResponse.data.status) {
            const doorStatus = statusResponse.data.status;
            console.log(`Door status from specific API: ${doorStatus}`);
            setDoorOpen(doorStatus === "OPEN");
            return { success: true, status: doorStatus, doorId };
          }
        } catch (error) {
          console.log('Error fetching specific door status:', error.message);
        }
      }
      
      // As a fallback, try the WebSocket approach - listen for status updates
      if (websocketService.isConnected) {
        console.log('Using WebSocket to request door status');
        
        // Send a request for the current door status via WebSocket
        websocketService.sendMessage({
          type: "door_status_request",
          door_id: doorId,
          timestamp: new Date().toISOString()
        });
        
        // Note: The actual status will be received through WebSocket listener
        return { success: true, status: doorOpen ? "OPEN" : "CLOSED", isCurrentState: true, doorId };
      }
      
      // If all else fails, just return the current UI state
      console.log('Using current UI state for door status');
      return { success: true, status: doorOpen ? "OPEN" : "CLOSED", isCurrentState: true, doorId };
      
    } catch (error) {
      console.error('Error reading door status:', error);
      return { success: false, error: error.message };
    } finally {
      // Clear loading state
      setDoorActionLoading(false);
    }
  };

  // Toggle door state using WebSocket with simple text commands
  const toggleDoor = async () => {
    if (doorActionLoading) return;
    
    // Check if trying to lock a physically open door (can't be locked)
    if (doorOpen && doorPhysicalState === DOOR_PHYSICAL_STATE.OPEN) {
      Alert.alert(
        "Cannot Lock Door",
        "The door is physically open. Please close the door before locking.",
        [{ text: "OK" }]
      );
      return;
    }
    
    setDoorActionLoading(true);
    
    try {
      // Using the exact same door ID that your hardware side uses
      const doorId = "e43b48ac-6cce-430e-a119-5c5ff5d62967";
      
      // Send the appropriate command based on current door state
      let success = false;
      
      if (websocketService.isConnected) {
        if (doorOpen) {
          // Send the exact text command "close-doors" that your hardware listens for
          success = websocketService.closeDoor();
          console.log('Sent close-doors command via WebSocket');
          
          // For CLOSING: Don't update state immediately - wait for hardware confirmation
          // The state will be updated when the hardware sends back a "CLOSED" status
          // through the WebSocket door_status_changed event
        } else {
          // Send the exact text command "open-doors" that your hardware listens for
          success = websocketService.openDoor();
          console.log('Sent open-doors command via WebSocket');
          
          // For opening, we can update the UI immediately for better responsiveness
          setDoorOpen(true);
        }
      }
      
      if (!success) {
        // WebSocket failed or not connected, fall back to HTTP API
        console.log('WebSocket unavailable, falling back to HTTP API');
        
        const newStatus = doorOpen ? "CLOSED" : "OPEN";
        
        try {
          // First try the specific door status endpoint
          const doorStatusUrl = DOOR_API_ENDPOINTS.SET_STATUS(doorId);
          const response = await api.post(doorStatusUrl, { status: newStatus });
          console.log('Door status change request sent via HTTP:', response.data);
          
          // For CLOSING: Only update UI when hardware actually confirms the CLOSED state
          if (newStatus === "OPEN") {
            // For opening, update UI immediately for responsiveness
            setDoorOpen(true);
          } else {
            // For closing, log that we're waiting for hardware confirmation
            console.log('Waiting for hardware to confirm CLOSED status...');
            // State will be updated when hardware notification is received
          }
        } catch (err) {
          console.log(`HTTP door control failed with specific endpoint:`, err.message);
          
          // Try the general door action endpoint as fallback
          try {
            const actionEndpoint = doorOpen ? DOOR_API_ENDPOINTS.CLOSE : DOOR_API_ENDPOINTS.OPEN;
            const response = await api.post(actionEndpoint, { door_id: doorId });
            console.log('Door status changed via general action endpoint:', response.data);
          } catch (actionErr) {
            console.log(`HTTP door control failed with action endpoint:`, actionErr.message);
            throw actionErr;
          }
        }
      }
    } catch (error) {
      console.error('Error toggling door:', error);
      
      // Do NOT automatically update state for demo purposes anymore
      // Only log the error
    } finally {
      setDoorActionLoading(false);
    }
  };
  
  // Handle door button click - only opens the door
  const handleDoorButtonClick = async () => {
    if (doorActionLoading) return;
    
    setDoorActionLoading(true);
    
    try {
      // Always send the open door command, regardless of current state
      console.log('Opening door...');
      const success = websocketService.openDoor();
      
      // Log the result
      if (success) {
        console.log('Open door command sent successfully');
      } else {
        console.error('Failed to send open door command');
      }
    } catch (error) {
      console.error('Error opening door:', error);
    } finally {
      setDoorActionLoading(false);
    }
  };

  // Control the door opening/closing animation with enhanced physics
  useEffect(() => {
    if (doorActionLoading) return;
    
    // Animate all door-related properties
    const animations = [
      // Spring-based animation for more natural door movement
      Animated.spring(doorAnim, {
        toValue: doorOpen ? 1 : 0,
        tension: 50,
        friction: 7,
        useNativeDriver: false,
      }),
      Animated.timing(doorShadowOpacity, {
        toValue: doorOpen ? 1 : 0,
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(doorShadowScale, {
        toValue: doorOpen ? 1 : 0,
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(doorHandleColor, {
        toValue: doorOpen ? 1 : 0,
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(doorButtonColor, {
        toValue: doorOpen ? 1 : 0,
        duration: 300,
        useNativeDriver: false,
      })
    ];
    
    Animated.parallel(animations).start();
  }, [doorOpen, doorActionLoading]);

  // Check for refresh flag when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      const checkRefreshFlag = async () => {
        try {
          const refreshFlag = await AsyncStorage.getItem('REFRESH_REGISTERED_USERS');
          if (refreshFlag === 'true') {
            console.log('Refresh flag detected, fetching registered users...');
            fetchRegisteredFaces();
            await AsyncStorage.removeItem('REFRESH_REGISTERED_USERS');
          }
        } catch (error) {
          console.error('Error checking refresh flag:', error);
        }
      };
      
      checkRefreshFlag();
    }, [])
  );

  // Initial animations for page load
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      })
    ]).start();
    
    // Fetch last access data when component mounts
    fetchLastAccess();
    
    // Fetch registered faces when component mounts
    fetchRegisteredFaces();
    
    // Fetch anonymous activities when component mounts
    fetchAnonymousActivities();
  }, []);
  
  // WebSocket initialization and event listeners
  useEffect(() => {
    // Connect to WebSocket when component mounts
    websocketService.connect();
    
    // Listen for connection status changes
    const connectionListener = websocketService.addEventListener(
      WebSocketEvents.CONNECTION_STATUS,
      (status) => {
        console.log('WebSocket connection status:', status);
        setWsConnected(status.connected);
        setIsPolling(status.isPolling || false);
        setPollingFailed(status.pollingFailed || false);
        
        // Determine if the server is completely unreachable
        // This happens when both WebSocket fails and polling fails
        setServerUnreachable(!status.connected && status.pollingFailed);
        
        // Show a toast message about connection status if you want
        if (!status.connected && status.error) {
          console.error('WebSocket connection error:', status.error);
        }
      }
    );
    
    // Listen for door status changes
    const doorStatusListener = websocketService.addEventListener(
      WebSocketEvents.DOOR_STATUS_CHANGED,
      (data) => {
        console.log('Door status changed notification received:', data);
        
        // Update door state based on WebSocket data
        if (data.status === 'OPEN') {
          setDoorOpen(true);
          console.log('Door OPENED based on hardware confirmation');
        } else if (data.status === 'CLOSED') {
          setDoorOpen(false);
          console.log('Door CLOSED based on hardware confirmation');
        } else {
          console.log('Received unknown door status:', data.status);
        }
        
        // NEW: Update physical door state if included in the data
        if (data.physical_state) {
          setDoorPhysicalState(data.physical_state);
          console.log('Door physical state updated:', data.physical_state);
        }
        
        // If there's access information, update the last access
        if (data.timestamp) {
          setLastAccess(new Date(data.timestamp).getTime());
        }
      }
    );
    
    // Listen for access notifications
    const accessGrantedListener = websocketService.addEventListener(
      WebSocketEvents.ACCESS_GRANTED,
      (data) => {
        console.log('Access granted:', data);
        // Show a notification or update UI
        Alert.alert('Access Granted', `${data.user || 'Someone'} has accessed the door.`);
        // Update last access data
        if (data.timestamp) {
          setLastAccess(new Date(data.timestamp).getTime());
        }
      }
    );
    
    const accessDeniedListener = websocketService.addEventListener(
      WebSocketEvents.ACCESS_DENIED,
      (data) => {
        console.log('Access denied:', data);
        // Show a notification
        Alert.alert('Security Alert', 'Unauthorized access attempt detected.');
      }
    );
    
    // General notifications
    const notificationListener = websocketService.addEventListener(
      WebSocketEvents.NOTIFICATION,
      (data) => {
        console.log('Notification received:', data);
        if (data.title && data.message) {
          Alert.alert(data.title, data.message);
        }
      }
    );
    
    // Clean up event listeners when component unmounts
    return () => {
      connectionListener();
      doorStatusListener();
      accessGrantedListener();
      accessDeniedListener();
      notificationListener();
    };
  }, []);
  
  const handleLogout = () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        { 
          text: "Logout", 
          onPress: async () => {
            await logout();
            router.replace('/');
          }
        }
      ]
    );
  };

  const currentTime = new Date();
  const hours = currentTime.getHours();
  let greeting = "Good morning";
  
  if (hours >= 12 && hours < 17) {
    greeting = "Good afternoon";
  } else if (hours >= 17) {
    greeting = "Good evening";
  }

  // Function to fetch registered faces
  const fetchRegisteredFaces = async () => {
    try {
      setLoadingFaces(true);
      console.log('Fetching face data from server...');
      const faceData = await websocketService.getFaceData();
      
      // Ensure faceData is an array
      if (Array.isArray(faceData)) {
        console.log(`Retrieved ${faceData.length} registered faces`);
        if (faceData.length > 0) {
          console.log('First face data keys:', Object.keys(faceData[0]));
        }
        setRegisteredFaces(faceData);
      } else if (faceData && typeof faceData === 'object') {
        // If it's an object with results property (common API pattern)
        setRegisteredFaces(Array.isArray(faceData.results) ? faceData.results : []);
      } else {
        // Default to empty array for any other response
        setRegisteredFaces([]);
        console.warn('Unexpected face data format:', faceData);
      }
    } catch (error) {
      console.error('Error fetching registered faces:', error);
      setRegisteredFaces([]); // Ensure it's at least an empty array
      
      // Show error alert for better user feedback
      Alert.alert(
        'Error',
        'Unable to load registered users. Please try again later.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoadingFaces(false);
    }
  };
  
  // Toggle the registered faces modal
  const toggleRegisteredFaces = () => {
    setShowRegisteredFaces(!showRegisteredFaces);
    if (!showRegisteredFaces) {
      fetchRegisteredFaces(); // Refresh data when opening
    }
  };
  
  // Update handleDeleteUser to send a WebSocket message for deletion
  const handleDeleteUser = (face, idx) => {
    Alert.alert(
      'Delete User',
      `Are you sure you want to delete "${face.name || 'Unknown User'}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Send delete request via websocket
              websocketService.sendMessage({
                type: 'face_vector_delete',
                // Use id, uuid, or another unique identifier if available
                name: face.name 
              });
              // Remove from UI immediately
              setRegisteredFaces(prev => prev.filter((_, i) => i !== idx));
              Alert.alert('Deleted', 'User has been deleted.');
            } catch (err) {
              Alert.alert('Error', 'Failed to delete user.');
            }
          }
        }
      ]
    );
  };

  // Fetch anonymous activities from API
  const fetchAnonymousActivities = async () => {
    setLoadingAnon(true);
    try {
      console.log("Fetching unknown activities from:", ANON_STORE_URL);
      const response = await fetch(ANON_STORE_URL);
      if (!response.ok) {
        throw new Error(`Failed with status: ${response.status}`);
      }
      
      // Get the raw text
      const responseText = await response.text();
    //  console.log("Raw unknown activities response:", responseText);
      
      // The response appears to be a string with format: BASE64_IMAGE, JSON_OBJECT
      // We need to parse this correctly
      let data;
      try {
        // First try to parse as standard JSON
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.log("Initial JSON parse failed, trying alternative formats");
        
        // If the first parse fails, check if it's a non-standard format
        try {
          // Look for JSON part (everything after the last comma and closing brace)
          const jsonStart = responseText.lastIndexOf('{');
          const jsonPart = responseText.substring(jsonStart);
          data = JSON.parse(jsonPart);
          console.log("Extracted JSON object:", data);
        } catch (err) {
          console.error("Failed to extract JSON part:", err);
          
          // If all parsing fails, create a single object from what we can see
          const parts = responseText.split(', ');
          const faceImageBase64 = parts[0];
          data = [{
            id: "unknown-" + Date.now(),
            name: "Unknown Person",
            face_image_base64: faceImageBase64,
            created_at: new Date().toISOString(),
            source_ip: "N/A"
          }];
        }
      }
      
     // console.log("Unknown activities parsed data:", data);
      
      // Handle different response formats
      let processedData = [];
      
      if (Array.isArray(data)) {
        // If it's already an array, use it
        processedData = data;
      } else if (data && typeof data === 'object') {
        if (Array.isArray(data.results)) {
          // If it has a results array property
          processedData = data.results;
        } else {
          // It's a single object
          processedData = [data];
        }
      }
      
      // Process the data to ensure it has all fields we need
      const normalizedData = processedData.map(item => ({
        id: item.id || String(Math.random()),
        name: item.name || 'Unknown Person',
        face_image_base64: item.face_image_base64 || null,
        created_at: item.created_at || item.timestamp || new Date().toISOString(),
        formatted_created_at: item.formatted_created_at || formatDate(item.created_at || item.timestamp),
        source_ip: item.source_ip || 'Unknown source'
      }));
      
     // console.log("Normalized data:", normalizedData);
      setAnonymousActivities(normalizedData);
    } catch (err) {
      console.error("Error fetching unknown activities:", err);
      setAnonymousActivities([]);
    } finally {
      setLoadingAnon(false);
    }
  };

  // Helper function to format dates consistently
  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown time';
    try {
      return new Date(dateString).toLocaleString();
    } catch (e) {
      return 'Invalid date';
    }
  };

  useEffect(() => {
    // Log the anonymous activities whenever they are fetched
    //console.log("Anonymous activities:", anonymousActivities);
  }, [anonymousActivities]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.greeting}>{greeting}</Text>
            <Text style={styles.title}>{userName}</Text>
          </View>
          <View style={styles.avatarContainer}>
            <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
              <Feather name="log-out" size={22} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.avatar}
              onPress={() => router.push('/profile')}
            >
              <Text style={styles.avatarText}>{userName.charAt(0)}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
        
      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View 
          style={[
            styles.doorControlContainer, 
            {
              opacity: fadeAnim,
              transform: [{ translateY: translateY }]
            }
          ]}
        >
          <View style={styles.doorControlCard}>
            <View style={styles.doorControlHeader}>
              <View style={styles.doorIconContainer}>
                <Feather name="home" size={22} color="#fff" />
              </View>
              <View style={styles.doorTitleContainer}>
                <Text style={styles.doorControlTitle}>Smart Door Control</Text>
                <Text style={styles.doorControlSubtitle}>Control your door lock remotely</Text>
              </View>
            </View>
            
            {/* Door visualization */}
            <View style={styles.doorVisualContainer}>
              <View style={styles.doorFrame}>
                <Animated.View 
                  style={[
                    styles.doorPanel,
                    {
                      // Use rotation transformation for more realistic door opening
                      transform: [
                        { perspective: 1000 },
                        { 
                          rotateY: doorAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0deg', '-75deg']
                          })
                        },
                        {
                          translateX: doorAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, -10]
                          })
                        }
                      ],
                    }
                  ]}
                >
                  {/* Create a separate view for the dynamic shadow */}
                  <Animated.View
                    style={{
                      ...StyleSheet.absoluteFillObject,
                      shadowColor: '#000',
                      shadowOffset: { 
                        width: doorAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, -5]
                        }), 
                        height: 2 
                      },
                      shadowOpacity: doorAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.2, 0.7]
                      }),
                      shadowRadius: 5,
                    }}
                  />
                  
                  {/* Door handle */}
                  <Animated.View 
                    style={[
                      styles.doorHandle, 
                      {
                        backgroundColor: doorAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['#ffcc00', '#ffee77']
                        }),
                        transform: [
                          { translateY: -17.5 },
                          { 
                            scale: doorAnim.interpolate({
                              inputRange: [0, 0.5, 1],
                              outputRange: [1, 1.05, 1.1]
                            })
                          }
                        ]
                      }
                    ]}
                  />
                  
                  {/* Lock indicator */}
                  <Animated.View
                    style={[
                      styles.lockIndicator,
                      {
                        opacity: doorAnim.interpolate({
                          inputRange: [0, 0.2, 0.4],
                          outputRange: [1, 0.5, 0]
                        })
                      }
                    ]}
                  >
                    <Feather name="lock" size={16} color="#ffffff" />
                  </Animated.View>
                </Animated.View>
                
                {/* Replace door shadow with a simpler version */}
                <View style={styles.doorShadowContainer}>
                  <Animated.View
                    style={[
                      styles.doorShadow,
                      {
                        opacity: doorAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, 0.7]
                        }),
                        transform: [{
                          scaleX: doorAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, 1]
                          })
                        }]
                      }
                    ]}
                  />
                </View>
              </View>
              <View style={styles.doorStatusBadge}>
                <Animated.View 
                  style={[
                    styles.statusDot, 
                    {
                      backgroundColor: doorAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['#ff5e5e', '#4ced69']
                      }),
                      transform: [
                        { 
                          scale: doorActionLoading ? 1.2 : 1 
                        }
                      ]
                    }
                  ]}
                />
                <Text style={styles.doorStatusLabel}>
                  {doorActionLoading ? 'Processing...' : (doorOpen ? 'Door Open' : 'Door Closed')}
                </Text>
              </View>
            </View>
            
            {/* Door action button - replace with conditional button */}
            <View style={styles.doorButtonContainer}>
              <Animated.View 
                style={[
                  styles.doorStatusText,
                  {
                    opacity: doorAnim.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [1, 0.7, 1]
                    })
                  }
                ]}
              >
                <Text style={styles.currentStatusLabel}>
                  Current Status: <Text style={[
                    styles.currentStatusValue,
                    { color: doorOpen ? '#4ced69' : '#ff5e5e' }
                  ]}>
                    {doorOpen ? "Unlocked" : "Locked"}
                  </Text>
                  {doorPhysicalState === DOOR_PHYSICAL_STATE.OPEN && doorOpen && (
                    <Text style={styles.physicalStateIndicator}> (Physically Open)</Text>
                  )}
                </Text>
              </Animated.View>
              
              <TouchableOpacity
                style={[
                  styles.doorActionButton,
                  doorPhysicalState === DOOR_PHYSICAL_STATE.OPEN && doorOpen && styles.doorActionButtonDisabled
                ]}
                onPress={handleDoorButtonClick}
                disabled={doorActionLoading}
              >
                <Animated.View
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    borderRadius: 12,
                    backgroundColor: '#4ced69' // Always green for "Open Door"
                  }}
                />
                {doorActionLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <View style={styles.doorActionContent}>
                    <Feather name="unlock" size={22} color="#fff" />
                    <Text style={styles.doorActionButtonText}>Open Door</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>          </View>
        </Animated.View>
        
        <View style={styles.sectionTitle}>
          <Feather name="grid" size={20} color="#555" />
          <Text style={styles.sectionTitleText}>Quick Access</Text>
        </View>
        
        {/* Centered and elite Register Face card */}
        <View style={styles.eliteCardWrapper}>
          <TouchableOpacity 
            style={styles.eliteActionCard}
            activeOpacity={0.92}
            onPress={() => router.push('/photo-registration')}
          >
            <View style={styles.eliteCardGradient}>
              <View style={styles.eliteIconCircle}>
                <Feather name="camera" size={38} color="#fff" />
              </View>
              <Text style={styles.eliteCardTitle}>Register Face</Text>
              <Text style={styles.eliteCardDescription}>
                Add your facial biometrics to the door security system
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Registered Users Section - add refresh button in section title */}
        <View style={styles.sectionTitle}>
          <Feather name="users" size={20} color="#4a90e2" />
          <Text style={styles.sectionTitleText}>Registered Users</Text>
          <TouchableOpacity 
            style={styles.sectionAction}
            onPress={fetchRegisteredFaces}
          >
            <Feather name="refresh-cw" size={16} color="#4a90e2" />
          </TouchableOpacity>
        </View>
        <View style={styles.namesListContainer}>
          {loadingFaces ? (
            <View style={styles.loadingFacesContainer}>
              <ActivityIndicator size="large" color="#4a90e2" />
              <Text style={styles.loadingText}>Loading registered users...</Text>
            </View>
          ) : registeredFaces.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Feather name="users" size={60} color="#666" />
              <Text style={styles.emptyText}>No registered users found</Text>
              <TouchableOpacity 
                style={[styles.refreshButton, {marginTop: 15, backgroundColor: '#4a90e2'}]}
                onPress={fetchRegisteredFaces}
              >
                <Feather name="refresh-cw" size={16} color="#fff" />
                <Text style={styles.refreshButtonText}>Refresh</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.namesListHeader}>
                <Text style={styles.namesListTitle}>{registeredFaces.length} Registered User{registeredFaces.length > 1 ? 's' : ''}</Text>
                <TouchableOpacity 
                  style={styles.refreshButton}
                  onPress={fetchRegisteredFaces}
                >
                  <Feather name="refresh-cw" size={14} color="#fff" />
                  <Text style={styles.refreshButtonText}>Refresh</Text>
                </TouchableOpacity>
              </View>
              {registeredFaces.map((face, idx) => (
                <View key={idx} style={styles.nameRowClassic}>
                  {face.face_image_base64 ? (
                    <Image
                      source={{ uri: `data:image/jpeg;base64,${face.face_image_base64}` }}
                      style={styles.userAvatarClassic}
                    />
                  ) : (
                    <View style={styles.userAvatarFallbackClassic}>
                      <Text style={styles.userAvatarInitialsClassic}>
                        {face.name && face.name.length > 0 ? face.name.charAt(0).toUpperCase() : "?"}
                      </Text>
                    </View>
                  )}
                  <View style={styles.userInfoColClassic}>
                    <Text style={styles.nameTextClassic}>{face.name || 'Unknown User'}</Text>
                    {face.created_at && (
                      <Text style={styles.userDateClassic}>
                        {new Date(face.created_at).toLocaleDateString()}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity
                    style={styles.deleteUserButton}
                    onPress={() => handleDeleteUser(face, idx)}
                  >
                    <Feather name="trash-2" size={20} color="#ff3b30" />
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}
        </View>
        
        {/* Unknown Activities Section */}
        <View style={styles.sectionTitle}>
          <Feather name="alert-circle" size={20} color="#ff9800" />
          <Text style={styles.sectionTitleText}>Unknown Activities</Text>
          <TouchableOpacity 
            style={styles.sectionAction}
            onPress={fetchAnonymousActivities}
          >
            <Feather name="refresh-cw" size={16} color="#ff9800" />
          </TouchableOpacity>
        </View>
        <View style={styles.namesListContainer}>
          {loadingAnon ? (
            <View style={styles.loadingFacesContainer}>
              <ActivityIndicator size="large" color="#ff9800" />
              <Text style={styles.loadingText}>Loading unknown activities...</Text>
            </View>
          ) : anonymousActivities.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Feather name="alert-circle" size={60} color="#bbb" />
              <Text style={styles.emptyText}>No unknown activities found</Text>
              <TouchableOpacity 
                style={[styles.refreshButton, {marginTop: 15, backgroundColor: '#ff9800'}]}
                onPress={fetchAnonymousActivities}
              >
                <Feather name="refresh-cw" size={16} color="#fff" />
                <Text style={styles.refreshButtonText}>Refresh</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.namesListHeader}>
                <Text style={[styles.namesListTitle, {color: '#ff9800'}]}>
                  {anonymousActivities.length} Unknown {anonymousActivities.length > 1 ? 'Activities' : 'Activity'}
                </Text>
                <TouchableOpacity 
                  style={[styles.refreshButton, {backgroundColor: '#ff9800'}]}
                  onPress={fetchAnonymousActivities}
                >
                  <Feather name="refresh-cw" size={14} color="#fff" />
                  <Text style={styles.refreshButtonText}>Refresh</Text>
                </TouchableOpacity>
              </View>
              {anonymousActivities.map((activity, idx) => (
                <View key={idx} style={styles.nameRowClassic}>
                  {activity.face_image_base64 ? (
                    <Image
                      source={{ uri: `data:image/jpeg;base64,${activity.face_image_base64}` }}
                      style={[styles.userAvatarClassic, {borderColor: '#ff9800'}]}
                    />
                  ) : (
                    <View style={[styles.userAvatarFallbackClassic, {backgroundColor: '#ff9800'}]}>
                      <Feather name="user-x" size={22} color="#fff" />
                    </View>
                  )}
                  <View style={styles.userInfoColClassic}>
                    <Text style={styles.nameTextClassic}>
                      {activity.name === 'Unknown' ? 'Unknown Person' : activity.name}
                    </Text>
                    <Text style={styles.userDateClassic}>
                      {activity.formatted_created_at || formatDate(activity.created_at)}
                    </Text>
                    {activity.source_ip && (
                      <Text style={[styles.userDateClassic, {fontSize: 11, color: '#999'}]}>
                        Source: {activity.source_ip}
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );  
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fd',
  },
  header: {
    paddingTop: 20,
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    marginBottom: 20,
    elevation: 10,
    backgroundColor: '#4a7fee',
    shadowColor: '#4a7fee',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.85)',
    marginBottom: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#fff',
  },
  avatarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoutButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: 20,
    marginTop: 20,
  },
  statusBadgeError: {
    backgroundColor: '#ff3b30',
  },
  statusBadgeChecking: {
    backgroundColor: '#ffcc00',
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ff3b30',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  overviewContainer: {
    marginHorizontal: 20,
    marginBottom: 30,
  },
  glassCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  glassCardContent: {
    padding: 20,
  },
  securityStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  securityIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: '#4a7fee',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
    shadowColor: '#4a7fee',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  securityStatusTitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  securityStatusValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  statusDivider: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    marginVertical: 20,
  },
  lastActivity: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#5b86e5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  lastAccessHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  refreshButton: {
    padding: 3,
  },
  lastActivityLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 2,
  },
  lastActivityTime: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  noAccessText: {
    color: '#999',
    fontStyle: 'italic',
  },
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  sectionTitleText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  actionCard: {
    width: width * 0.44,
    height: 220,
    borderRadius: 18,
    marginBottom: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 8,
    position: 'relative',
  },
  securityCard: {
    width: width * 0.44,
    height: 220,
    borderRadius: 18,
    marginBottom: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 8,
    position: 'relative',
  },
  cardGradient: {
    borderRadius: 18,
    padding: 18,
    height: '100%',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  faceRecognitionIconEnhanced: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContentExpanded: {
    flex: 1,
    justifyContent: 'center',
  },
  blueCard: {
    backgroundColor: '#3694FF',
  },
  orangeCard: {
    backgroundColor: '#FF8C42',
  },
  enhancedCardTitle: {
    fontSize: 19,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  enhancedCardDescription: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 18,
  },
  securityInfoContent: {
    flex: 1,
    justifyContent: 'center',
    marginBottom: 5,
  },
  enhancedMetricsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    padding: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  enhancedMetric: {
    flex: 1,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  metricLabel: {
    fontSize: 14,
    color: '#666',
  },
  metricDivider: {
    width: 1,
    height: '80%',
    alignSelf: 'center',
    backgroundColor: '#e0e0e0',
    marginHorizontal: 10,
  },
  activityContainer: {
    paddingHorizontal: 20,
  },
  activityCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  emptyActivity: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  emptyActivityText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 10,
  },
  emptyActivitySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 5,
    paddingHorizontal: 20,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 20,
    right: 20,
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#4a7fee',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4a7fee',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  doorControlContainer: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  doorControlCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 15,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.03)',
  },
  doorControlHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
  },
  doorIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#4a7fee',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    shadowColor: '#4a7fee',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  doorTitleContainer: {
    flex: 1,
  },
  doorControlTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  doorControlSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  doorVisualContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  doorFrame: {
    width: 140,
    height: 170,
    backgroundColor: '#e0e0e0',
    borderWidth: 10,
    borderColor: '#d0d0d0',
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  doorPanel: {
    width: 132,
    height: 160,
    borderWidth: 6,
    borderColor: '#3a6fde',
    backgroundColor: '#4a80f0',
    borderRadius: 6,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    backfaceVisibility: 'hidden',
    transformStyle: 'preserve-3d',
  },
  doorHandle: {
    position: 'absolute',
    right: 12,
    top: '50%',
    width: 12,
    height: 35,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  doorShadowContainer: {
    position: 'absolute',
    height: 160,
    left: 0,
    top: 15,
    width: 80,
    overflow: 'hidden',
  },
  doorShadow: {
    position: 'absolute',
    height: 160,
    left: 0,
    top: 0,
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderTopRightRadius: 100,
    borderBottomRightRadius: 100,
    transformOrigin: 'left',
  },
  lockIndicator: {
    position: 'absolute',
    top: 30,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleButton: {
    backgroundColor: '#4a7fee',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignSelf: 'center',
    marginBottom: 20,
  },
  toggleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  doorButtonContainer: {
    marginVertical: 20,
    alignItems: 'center',
  },
  doorActionButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
    marginTop: 10,
    overflow: 'hidden', // Add this to contain the background view
    position: 'relative', // Add this to position the background properly
  },
  doorActionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doorActionButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  doorStatusText: {
    marginBottom: 5,
  },
  currentStatusLabel: {
    fontSize: 15,
    color: '#666',
  },
  currentStatusValue: {
    fontWeight: 'bold',
    fontSize: 15,
  },
  quickStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f8f9fd',
    borderRadius: 16,
    padding: 16,
    marginTop: 5,
    borderWidth: 1,
    borderColor: '#eaeaea',
  },
  quickStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  quickStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 6,
  },
  quickStatLabel: {
    fontSize: 13,
    color: '#777',
  },
  quickStatDivider: {
    width: 1,
    height: '80%',
    alignSelf: 'center',
    backgroundColor: '#e0e0e0',
    marginHorizontal: 10,
  },
  activityContainer: {
    paddingHorizontal: 20,
  },
  activityCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  emptyActivity: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  emptyActivityText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 10,
  },
  emptyActivitySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 5,
    paddingHorizontal: 20,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 20,
    right: 20,
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#4a7fee',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4a7fee',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  doorControlContainer: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  doorControlCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 15,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.03)',
  },
  doorControlHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
  },
  doorIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#4a7fee',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    shadowColor: '#4a7fee',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  doorTitleContainer: {
    flex: 1,
  },
  doorControlTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  doorControlSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  doorVisualContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  doorFrame: {
    width: 140,
    height: 170,
    backgroundColor: '#e0e0e0',
    borderWidth: 10,
    borderColor: '#d0d0d0',
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  doorPanel: {
    width: 132,
    height: 160,
    borderWidth: 6,
    borderColor: '#3a6fde',
    backgroundColor: '#4a80f0',
    borderRadius: 6,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    backfaceVisibility: 'hidden',
    transformStyle: 'preserve-3d',
  },
  doorHandle: {
    position: 'absolute',
    right: 12,
    top: '50%',
    width: 12,
    height: 35,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  doorShadowContainer: {
    position: 'absolute',
    height: 160,
    left: 0,
    top: 15,
    width: 80,
    overflow: 'hidden',
  },
  doorShadow: {
    position: 'absolute',
    height: 160,
    left: 0,
    top: 0,
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderTopRightRadius: 100,
    borderBottomRightRadius: 100,
    transformOrigin: 'left',
  },
  lockIndicator: {
    position: 'absolute',
    top: 30,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleButton: {
    backgroundColor: '#4a7fee',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignSelf: 'center',
    marginBottom: 20,
  },
  toggleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  doorButtonContainer: {
    marginVertical: 20,
    alignItems: 'center',
  },
  doorActionButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
    marginTop: 10,
    overflow: 'hidden', // Add this to contain the background view
    position: 'relative', // Add this to position the background properly
  },
  doorActionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doorActionButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  doorStatusText: {
    marginBottom: 5,
  },
  currentStatusLabel: {
    fontSize: 15,
    color: '#666',
  },
  currentStatusValue: {
    fontWeight: 'bold',
    fontSize: 15,
  },
  quickStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f8f9fd',
    borderRadius: 16,
    padding: 16,
    marginTop: 5,
    borderWidth: 1,
    borderColor: '#eaeaea',
  },
  quickStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  quickStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 6,
  },
  quickStatLabel: {
    fontSize: 13,
    color: '#777',
  },
  quickStatDivider: {
    width: 1,
    height: '80%',
    alignSelf: 'center',
    backgroundColor: '#e0e0e0',
    marginHorizontal: 10,
  },
  activityContainer: {
    paddingHorizontal: 20,
  },
  activityCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  emptyActivity: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  emptyActivityText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 10,
  },
  emptyActivitySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 5,
    paddingHorizontal: 20,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 20,
    right: 20,
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#4a7fee',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4a7fee',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  doorControlContainer: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  doorControlCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 15,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.03)',
  },
  doorControlHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
  },
  doorIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#4a7fee',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    shadowColor: '#4a7fee',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  doorTitleContainer: {
    flex: 1,
  },
  doorControlTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  doorControlSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  doorVisualContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  doorFrame: {
    width: 140,
    height: 170,
    backgroundColor: '#e0e0e0',
    borderWidth: 10,
    borderColor: '#d0d0d0',
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  doorPanel: {
    width: 132,
    height: 160,
    borderWidth: 6,
    borderColor: '#3a6fde',
    backgroundColor: '#4a80f0',
    borderRadius: 6,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    backfaceVisibility: 'hidden',
    transformStyle: 'preserve-3d',
  },
  doorHandle: {
    position: 'absolute',
    right: 12,
    top: '50%',
    width: 12,
    height: 35,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  doorShadowContainer: {
    position: 'absolute',
    height: 160,
    left: 0,
    top: 15,
    width: 80,
    overflow: 'hidden',
  },
  doorShadow: {
    position: 'absolute',
    height: 160,
    left: 0,
    top: 0,
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderTopRightRadius: 100,
    borderBottomRightRadius: 100,
    transformOrigin: 'left',
  },
  lockIndicator: {
    position: 'absolute',
    top: 30,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleButton: {
    backgroundColor: '#4a7fee',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignSelf: 'center',
    marginBottom: 20,
  },
  toggleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  doorButtonContainer: {
    marginVertical: 20,
    alignItems: 'center',
  },
  doorActionButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
    marginTop: 10,
    overflow: 'hidden', // Add this to contain the background view
    position: 'relative', // Add this to position the background properly
  },
  doorActionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doorActionButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  doorStatusText: {
    marginBottom: 5,
  },
  currentStatusLabel: {
    fontSize: 15,
    color: '#666',
  },
  currentStatusValue: {
    fontWeight: 'bold',
    fontSize: 15,
  },
  quickStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f8f9fd',
    borderRadius: 16,
    padding: 16,
    marginTop: 5,
    borderWidth: 1,
    borderColor: '#eaeaea',
  },
  quickStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  quickStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 6,
  },
  quickStatLabel: {
    fontSize: 13,
    color: '#777',
  },
  quickStatDivider: {
    width: 1,
    height: '80%',
    alignSelf: 'center',
    backgroundColor: '#e0e0e0',
    marginHorizontal: 10,
  },
  activityContainer: {
    paddingHorizontal: 20,
  },
  activityCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  emptyActivity: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  emptyActivityText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 10,
  },
  emptyActivitySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 5,
    paddingHorizontal: 20,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 20,
    right: 20,
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#4a7fee',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4a7fee',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  doorControlContainer: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  doorControlCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 15,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.03)',
  },
  doorControlHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
  },
  doorIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#4a7fee',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    shadowColor: '#4a7fee',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  doorTitleContainer: {
    flex: 1,
  },
  doorControlTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  doorControlSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  doorVisualContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  doorFrame: {
    width: 140,
    height: 170,
    backgroundColor: '#e0e0e0',
    borderWidth: 10,
    borderColor: '#d0d0d0',
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  doorPanel: {
    width: 132,
    height: 160,
    borderWidth: 6,
    borderColor: '#3a6fde',
    backgroundColor: '#4a80f0',
    borderRadius: 6,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    backfaceVisibility: 'hidden',
    transformStyle: 'preserve-3d',
  },
  doorHandle: {
    position: 'absolute',
    right: 12,
    top: '50%',
    width: 12,
    height: 35,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  doorShadowContainer: {
    position: 'absolute',
    height: 160,
    left: 0,
    top: 15,
    width: 80,
    overflow: 'hidden',
  },
  doorShadow: {
    position: 'absolute',
    height: 160,
    left: 0,
    top: 0,
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderTopRightRadius: 100,
    borderBottomRightRadius: 100,
    transformOrigin: 'left',
  },
  lockIndicator: {
    position: 'absolute',
    top: 30,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleButton: {
    backgroundColor: '#4a7fee',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignSelf: 'center',
    marginBottom: 20,
  },
  toggleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  doorButtonContainer: {
    marginVertical: 20,
    alignItems: 'center',
  },
  doorActionButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
    marginTop: 10,
    overflow: 'hidden', // Add this to contain the background view
    position: 'relative', // Add this to position the background properly
  },
  doorActionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doorActionButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  doorStatusText: {
    marginBottom: 5,
  },
  currentStatusLabel: {
    fontSize: 15,
    color: '#666',
  },
  currentStatusValue: {
    fontWeight: 'bold',
    fontSize: 15,
  },
  quickStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f8f9fd',
    borderRadius: 16,
    padding: 16,
    marginTop: 5,
    borderWidth: 1,
    borderColor: '#eaeaea',
  },
  quickStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  quickStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 6,
  },
  quickStatLabel: {
    fontSize: 13,
    color: '#777',
  },
  quickStatDivider: {
    width: 1,
    height: '80%',
    alignSelf: 'center',
    backgroundColor: '#e0e0e0',
    marginHorizontal: 10,
  },
  activityContainer: {
    paddingHorizontal: 20,
  },
  activityCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  emptyActivity: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  emptyActivityText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 10,
  },
  emptyActivitySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 5,
    paddingHorizontal: 20,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 20,
    right: 20,
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#4a7fee',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4a7fee',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  doorControlContainer: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  doorControlCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 15,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.03)',
  },
  doorControlHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
  },
  doorIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#4a7fee',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    shadowColor: '#4a7fee',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  doorTitleContainer: {
    flex: 1,
  },
  doorControlTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  doorControlSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  doorVisualContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  doorFrame: {
    width: 140,
    height: 170,
    backgroundColor: '#e0e0e0',
    borderWidth: 10,
    borderColor: '#d0d0d0',
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  doorPanel: {
    width: 132,
    height: 160,
    borderWidth: 6,
    borderColor: '#3a6fde',
    backgroundColor: '#4a80f0',
    borderRadius: 6,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    backfaceVisibility: 'hidden',
    transformStyle: 'preserve-3d',
  },
  doorHandle: {
    position: 'absolute',
    right: 12,
    top: '50%',
    width: 12,
    height: 35,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  doorShadowContainer: {
    position: 'absolute',
    height: 160,
    left: 0,
    top: 15,
    width: 80,
    overflow: 'hidden',
  },
  doorShadow: {
    position: 'absolute',
    height: 160,
    left: 0,
    top: 0,
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderTopRightRadius: 100,
    borderBottomRightRadius: 100,
    transformOrigin: 'left',
  },
  lockIndicator: {
    position: 'absolute',
    top: 30,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleButton: {
    backgroundColor: '#4a7fee',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignSelf: 'center',
    marginBottom: 20,
  },
  toggleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  doorButtonContainer: {
    marginVertical: 20,
    alignItems: 'center',
  },
  doorActionButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
    marginTop: 10,
    overflow: 'hidden', // Add this to contain the background view
    position: 'relative', // Add this to position the background properly
  },
  doorActionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doorActionButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  doorStatusText: {
    marginBottom: 5,
  },
  currentStatusLabel: {
    fontSize: 15,
    color: '#666',
  },
  currentStatusValue: {
    fontWeight: 'bold',
    fontSize: 15,
  },
  quickStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f8f9fd',
    borderRadius: 16,
    padding: 16,
    marginTop: 5,
    borderWidth: 1,
    borderColor: '#eaeaea',
  },
  quickStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  quickStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 6,
  },
  quickStatLabel: {
    fontSize: 13,
    color: '#777',
  },
  quickStatDivider: {
    width: 1,
    height: '80%',
    alignSelf: 'center',
    backgroundColor: '#e0e0e0',
    marginHorizontal: 10,
  },
  activityContainer: {
    paddingHorizontal: 20,
  },
  activityCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  emptyActivity: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  emptyActivityText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 10,
  },
  emptyActivitySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 5,
    paddingHorizontal: 20,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 20,
    right: 20,
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#4a7fee',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4a7fee',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  doorControlContainer: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  doorControlCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 15,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.03)',
  },
  doorControlHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
  },
  doorIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#4a7fee',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    shadowColor: '#4a7fee',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  doorTitleContainer: {
    flex: 1,
  },
  doorControlTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  doorControlSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  doorVisualContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  doorFrame: {
    width: 140,
    height: 170,
    backgroundColor: '#e0e0e0',
    borderWidth: 10,
    borderColor: '#d0d0d0',
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  doorPanel: {
    width: 132,
    height: 160,
    borderWidth: 6,
    borderColor: '#3a6fde',
    backgroundColor: '#4a80f0',
    borderRadius: 6,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    backfaceVisibility: 'hidden',
    transformStyle: 'preserve-3d',
  },
  doorHandle: {
    position: 'absolute',
    right: 12,
    top: '50%',
    width: 12,
    height: 35,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  doorShadowContainer: {
    position: 'absolute',
    height: 160,
    left: 0,
    top: 15,
    width: 80,
    overflow: 'hidden',
  },
  doorShadow: {
    position: 'absolute',
    height: 160,
    left: 0,
    top: 0,
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderTopRightRadius: 100,
    borderBottomRightRadius: 100,
    transformOrigin: 'left',
  },
  lockIndicator: {
    position: 'absolute',
    top: 30,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleButton: {
    backgroundColor: '#4a7fee',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignSelf: 'center',
    marginBottom: 20,
  },
  toggleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  doorButtonContainer: {
    marginVertical: 20,
    alignItems: 'center',
  },
  doorActionButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
    marginTop: 10,
    overflow: 'hidden', // Add this to contain the background view
    position: 'relative', // Add this to position the background properly
  },
  doorActionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doorActionButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  doorStatusText: {
    marginBottom: 5,
  },
  currentStatusLabel: {
    fontSize: 15,
    color: '#666',
  },
  currentStatusValue: {
    fontWeight: 'bold',
    fontSize: 15,
  },
  quickStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f8f9fd',
    borderRadius: 16,
    padding: 16,
    marginTop: 5,
    borderWidth: 1,
    borderColor: '#eaeaea',
  },
  quickStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  quickStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 6,
  },
  quickStatLabel: {
    fontSize: 13,
    color: '#777',
  },
  quickStatDivider: {
    width: 1,
    height: '80%',
    alignSelf: 'center',
    backgroundColor: '#e0e0e0',
    marginHorizontal: 10,
  },
  activityContainer: {
    paddingHorizontal: 20,
  },
  activityCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  emptyActivity: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  emptyActivityText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 10,
  },
  emptyActivitySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 5,
    paddingHorizontal: 20,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 20,
    right: 20,
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#4a7fee',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4a7fee',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  doorControlContainer: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  doorControlCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 15,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.03)',
  },
  doorControlHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
  },
  doorIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#4a7fee',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    shadowColor: '#4a7fee',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  doorTitleContainer: {
    flex: 1,
  },
  doorControlTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  doorControlSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  doorVisualContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  doorFrame: {
    width: 140,
    height: 170,
    backgroundColor: '#e0e0e0',
    borderWidth: 10,
    borderColor: '#d0d0d0',
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  doorPanel: {
    width: 132,
    height: 160,
    borderWidth: 6,
    borderColor: '#3a6fde',
    backgroundColor: '#4a80f0',
    borderRadius: 6,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    backfaceVisibility: 'hidden',
    transformStyle: 'preserve-3d',
  },
  doorHandle: {
    position: 'absolute',
    right: 12,
    top: '50%',
    width: 12,
    height: 35,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  doorShadowContainer: {
    position: 'absolute',
    height: 160,
    left: 0,
    top: 15,
    width: 80,
    overflow: 'hidden',
  },
  doorShadow: {
    position: 'absolute',
    height: 160,
    left: 0,
    top: 0,
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderTopRightRadius: 100,
    borderBottomRightRadius: 100,
    transformOrigin: 'left',
  },
  lockIndicator: {
    position: 'absolute',
    top: 30,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleButton: {
    backgroundColor: '#4a7fee',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignSelf: 'center',
    marginBottom: 20,
  },
  toggleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  doorButtonContainer: {
    marginVertical: 20,
    alignItems: 'center',
  },
  doorActionButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
    marginTop: 10,
    overflow: 'hidden', // Add this to contain the background view
    position: 'relative', // Add this to position the background properly
  },
  doorActionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doorActionButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  doorStatusText: {
    marginBottom: 5,
  },
  currentStatusLabel: {
    fontSize: 15,
    color: '#666',
  },
  currentStatusValue: {
    fontWeight: 'bold',
    fontSize: 15,
  },
  quickStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f8f9fd',
    borderRadius: 16,
    padding: 16,
    marginTop: 5,
    borderWidth: 1,
    borderColor: '#eaeaea',
  },
  quickStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  quickStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 6,
  },
  quickStatLabel: {
    fontSize: 13,
    color: '#777',
  },
  quickStatDivider: {
    width: 1,
    height: '80%',
    alignSelf: 'center',
    backgroundColor: '#e0e0e0',
    marginHorizontal: 10,
  },
  activityContainer: {
    paddingHorizontal: 20,
  },
  activityCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  emptyActivity: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  emptyActivityText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 10,
  },
  emptyActivitySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 5,
    paddingHorizontal: 20,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 20,
    right: 20,
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#4a7fee',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4a7fee',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  doorControlContainer: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  doorControlCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 15,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.03)',
  },
  doorControlHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
  },
  doorIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#4a7fee',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    shadowColor: '#4a7fee',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  doorTitleContainer: {
    flex: 1,
  },
  doorControlTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  doorControlSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  doorVisualContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  doorFrame: {
    width: 140,
    height: 170,
    backgroundColor: '#e0e0e0',
    borderWidth: 10,
    borderColor: '#d0d0d0',
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  doorPanel: {
    width: 132,
    height: 160,
    borderWidth: 6,
    borderColor: '#3a6fde',
    backgroundColor: '#4a80f0',
    borderRadius: 6,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    backfaceVisibility: 'hidden',
    transformStyle: 'preserve-3d',
  },
  doorHandle: {
    position: 'absolute',
    right: 12,
    top: '50%',
    width: 12,
    height: 35,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  doorShadowContainer: {
    position: 'absolute',
    height: 160,
    left: 0,
    top: 15,
    width: 80,
    overflow: 'hidden',
  },
  doorShadow: {
    position: 'absolute',
    height: 160,
    left: 0,
    top: 0,
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderTopRightRadius: 100,
    borderBottomRightRadius: 100,
    transformOrigin: 'left',
  },
  lockIndicator: {
    position: 'absolute',
    top: 30,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleButton: {
    backgroundColor: '#4a7fee',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignSelf: 'center',
    marginBottom: 20,
  },
  toggleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  doorButtonContainer: {
    marginVertical: 20,
    alignItems: 'center',
  },
  doorActionButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
    marginTop: 10,
    overflow: 'hidden', // Add this to contain the background view
    position: 'relative', // Add this to position the background properly
  },
  doorActionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doorActionButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  doorStatusText: {
    marginBottom: 5,
  },
  currentStatusLabel: {
    fontSize: 15,
    color: '#666',
  },
  currentStatusValue: {
    fontWeight: 'bold',
    fontSize: 15,
  },
  quickStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f8f9fd',
    borderRadius: 16,
    padding: 16,
    marginTop: 5,
    borderWidth: 1,
    borderColor: '#eaeaea',
  },
  quickStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  quickStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 6,
  },
  quickStatLabel: {
    fontSize: 13,
    color: '#777',
  },
  quickStatDivider: {
    width: 1,
    height: '80%',
    alignSelf: 'center',
    backgroundColor: '#e0e0e0',
    marginHorizontal: 10,
  },
  activityContainer: {
    paddingHorizontal: 20,
  },
  activityCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  emptyActivity: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  emptyActivityText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 10,
  },
  emptyActivitySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 5,
    paddingHorizontal: 20,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 20,
    right: 20,
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#4a7fee',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4a7fee',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  doorControlContainer: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  doorControlCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 15,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.03)',
  },
  doorControlHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
  },
  doorIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#4a7fee',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    shadowColor: '#4a7fee',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  doorTitleContainer: {
    flex: 1,
  },
  doorControlTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  doorControlSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  doorVisualContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  doorFrame: {
    width: 140,
    height: 170,
    backgroundColor: '#e0e0e0',
    borderWidth: 10,
    borderColor: '#d0d0d0',
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  doorPanel: {
    width: 132,
    height: 160,
    borderWidth: 6,
    borderColor: '#3a6fde',
    backgroundColor: '#4a80f0',
    borderRadius: 6,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    backfaceVisibility: 'hidden',
    transformStyle: 'preserve-3d',
  },
  doorHandle: {
    position: 'absolute',
    right: 12,
    top: '50%',
    width: 12,
    height: 35,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  doorShadowContainer: {
    position: 'absolute',
    height: 160,
    left: 0,
    top: 15,
    width: 80,
    overflow: 'hidden',
  },
  doorShadow: {
    position: 'absolute',
    height: 160,
    left: 0,
    top: 0,
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderTopRightRadius: 100,
    borderBottomRightRadius: 100,
    transformOrigin: 'left',
  },
  lockIndicator: {
    position: 'absolute',
    top: 30,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleButton: {
    backgroundColor: '#4a7fee',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignSelf: 'center',
    marginBottom: 20,
  },
  toggleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  doorButtonContainer: {
    marginVertical: 20,
    alignItems: 'center',
  },
  doorActionButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
    marginTop: 10,
    overflow: 'hidden', // Add this to contain the background view
    position: 'relative', // Add this to position the background properly
  },
  doorActionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doorActionButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  doorStatusText: {
    marginBottom: 5,
  },
  currentStatusLabel: {
    fontSize: 15,
    color: '#666',
  },
  currentStatusValue: {
    fontWeight: 'bold',
    fontSize: 15,
  },
  quickStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f8f9fd',
    borderRadius: 16,
    padding: 16,
    marginTop: 5,
    borderWidth: 1,
    borderColor: '#eaeaea',
  },
  quickStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  quickStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 6,
  },
  quickStatLabel: {
    fontSize: 13,
    color: '#777',
  },
  quickStatDivider: {
    width: 1,
    height: '80%',
    alignSelf: 'center',
    backgroundColor: '#e0e0e0',
    marginHorizontal: 10,
  },
  activityContainer: {
    paddingHorizontal: 20,
  },
  activityCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  emptyActivity: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  emptyActivityText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 10,
  },
  emptyActivitySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 5,
    paddingHorizontal: 20,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 20,
    right: 20,
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#4a7fee',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4a7fee',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  doorControlContainer: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  doorControlCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 15,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.03)',
  },
  doorControlHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
  },
  doorIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#4a7fee',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    shadowColor: '#4a7fee',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  doorTitleContainer: {
    flex: 1,
  },
  doorControlTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  doorControlSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  doorVisualContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  doorFrame: {
    width: 140,
    height: 170,
    backgroundColor: '#e0e0e0',
    borderWidth: 10,
    borderColor: '#d0d0d0',
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  doorPanel: {
    width: 132,
    height: 160,
    borderWidth: 6,
    borderColor: '#3a6fde',
    backgroundColor: '#4a80f0',
    borderRadius: 6,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    backfaceVisibility: 'hidden',
    transformStyle: 'preserve-3d',
  },
  doorHandle: {
    position: 'absolute',
    right: 12,
    top: '50%',
    width: 12,
    height: 35,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  doorShadowContainer: {
    position: 'absolute',
    height: 160,
    left: 0,
    top: 15,
    width: 80,
    overflow: 'hidden',
  },
  doorShadow: {
    position: 'absolute',
    height: 160,
    left: 0,
    top: 0,
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderTopRightRadius: 100,
    borderBottomRightRadius: 100,
    transformOrigin: 'left',
  },
  lockIndicator: {
    position: 'absolute',
    top: 30,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleButton: {
    backgroundColor: '#4a7fee',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignSelf: 'center',
    marginBottom: 20,
  },
  toggleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  doorButtonContainer: {
    marginVertical: 20,
    alignItems: 'center',
  },
  doorActionButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
    marginTop: 10,
    overflow: 'hidden', // Add this to contain the background view
    position: 'relative', // Add this to position the background properly
  },
  doorActionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doorActionButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  doorStatusText: {
    marginBottom: 5,
  },
  currentStatusLabel: {
    fontSize: 15,
    color: '#666',
  },
  currentStatusValue: {
    fontWeight: 'bold',
    fontSize: 15,
  },
  quickStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f8f9fd',
    borderRadius: 16,
    padding: 16,
    marginTop: 5,
    borderWidth: 1,
    borderColor: '#eaeaea',
  },
  quickStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  quickStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 6,
  },
  quickStatLabel: {
    fontSize: 13,
    color: '#777',
  },
  quickStatDivider: {
    width: 1,
    height: '80%',
    alignSelf: 'center',
    backgroundColor: '#e0e0e0',
    marginHorizontal: 10,
  },
  activityContainer: {
    paddingHorizontal: 20,
  },
  activityCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  emptyActivity: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  emptyActivityText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 10,
  },
  emptyActivitySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 5,
    paddingHorizontal: 20,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 20,
    right: 20,
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#4a7fee',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4a7fee',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  doorControlContainer: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  doorControlCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 15,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.03)',
  },
  doorControlHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
  },
  doorIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#4a7fee',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    shadowColor: '#4a7fee',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  doorTitleContainer: {
    flex: 1,
  },
  doorControlTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  doorControlSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  doorVisualContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  doorFrame: {
    width: 140,
    height: 170,
    backgroundColor: '#e0e0e0',
    borderWidth: 10,
    borderColor: '#d0d0d0',
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  doorPanel: {
    width: 132,
    height: 160,
    borderWidth: 6,
    borderColor: '#3a6fde',
    backgroundColor: '#4a80f0',
    borderRadius: 6,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    backfaceVisibility: 'hidden',
    transformStyle: 'preserve-3d',
  },
  doorHandle: {
    position: 'absolute',
    right: 12,
    top: '50%',
    width: 12,
    height: 35,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  doorShadowContainer: {
    position: 'absolute',
    height: 160,
    left: 0,
    top: 15,
    width: 80,
    overflow: 'hidden',
  },
  doorShadow: {
    position: 'absolute',
    height: 160,
    left: 0,
    top: 0,
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderTopRightRadius: 100,
    borderBottomRightRadius: 100,
    transformOrigin: 'left',
  },
  lockIndicator: {
    position: 'absolute',
    top: 30,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleButton: {
    backgroundColor: '#4a7fee',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignSelf: 'center',
    marginBottom: 20,
  },
  toggleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  doorButtonContainer: {
    marginVertical: 20,
    alignItems: 'center',
  },
  doorActionButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
    marginTop: 10,
    overflow: 'hidden', // Add this to contain the background view
    position: 'relative', // Add this to position the background properly
  },
  doorActionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doorActionButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  doorStatusText: {
    marginBottom: 5,
  },
  currentStatusLabel: {
    fontSize: 15,
    color: '#666',
  },
  currentStatusValue: {
    fontWeight: 'bold',
    fontSize: 15,
  },
  quickStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f8f9fd',
    borderRadius: 16,
    padding: 16,
    marginTop: 5,
    borderWidth: 1,
    borderColor: '#eaeaea',
  },
  quickStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  quickStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 6,
  },
  quickStatLabel: {
    fontSize: 13,
    color: '#777',
  },
  quickStatDivider: {
    width: 1,
    height: '80%',
    alignSelf: 'center',
    backgroundColor: '#e0e0e0',
    marginHorizontal: 10,
  },
  activityContainer: {
    paddingHorizontal: 20,
  },
  activityCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  emptyActivity: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  emptyActivityText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 10,
  },
  emptyActivitySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 5,
    paddingHorizontal: 20,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 20,
    right: 20,
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#4a7fee',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4a7fee',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  doorControlContainer: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  doorControlCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 15,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.03)',
  },
  doorControlHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
  },
  doorIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#4a7fee',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    shadowColor: '#4a7fee',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  doorTitleContainer: {
    flex: 1,
  },
  doorControlTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  doorControlSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  doorVisualContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  doorFrame: {
    width: 140,
    height: 170,
    backgroundColor: '#e0e0e0',
    borderWidth: 10,
    borderColor: '#d0d0d0',
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  doorPanel: {
    width: 132,
    height: 160,
    borderWidth: 6,
    borderColor: '#3a6fde',
    backgroundColor: '#4a80f0',
    borderRadius: 6,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    backfaceVisibility: 'hidden',
    transformStyle: 'preserve-3d',
  },
  doorHandle: {
    position: 'absolute',
    right: 12,
    top: '50%',
    width: 12,
    height: 35,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  doorShadowContainer: {
    position: 'absolute',
    height: 160,
    left: 0,
    top: 15,
    width: 80,
    overflow: 'hidden',
  },
  doorShadow: {
    position: 'absolute',
    height: 160,
    left: 0,
    top: 0,
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderTopRightRadius: 100,
    borderBottomRightRadius: 100,
    transformOrigin: 'left',
  },
  lockIndicator: {
    position: 'absolute',
    top: 30,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleButton: {
    backgroundColor: '#4a7fee',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignSelf: 'center',
    marginBottom: 20,
  },
  toggleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  doorButtonContainer: {
    marginVertical: 20,
    alignItems: 'center',
  },
  doorActionButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
    marginTop: 10,
    overflow: 'hidden', // Add this to contain the background view
    position: 'relative', // Add this to position the background properly
  },
  doorActionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doorActionButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  doorStatusText: {
    marginBottom: 5,
  },
  currentStatusLabel: {
    fontSize: 15,
    color: '#666',
  },
  currentStatusValue: {
    fontWeight: 'bold',
    fontSize: 15,
  },
  quickStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f8f9fd',
    borderRadius: 16,
    padding: 16,
    marginTop: 5,
    borderWidth: 1,
    borderColor: '#eaeaea',
  },
  quickStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  quickStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 6,
  },
  quickStatLabel: {
    fontSize: 13,
    color: '#777',
  },
  quickStatDivider: {
    width: 1,
    height: '80%',
    alignSelf: 'center',
    backgroundColor: '#e0e0e0',
    marginHorizontal: 10,
  },
  activityContainer: {
    paddingHorizontal: 20,
  },
  activityCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  emptyActivity: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  emptyActivityText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 10,
  },
  emptyActivitySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 5,
    paddingHorizontal: 20,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 20,
    right: 20,
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#4a7fee',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4a7fee',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation:  5,
  },
  doorControlContainer: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  doorControlCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 15,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.03)',
  },
  doorControlHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
  },
  doorIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#4a7fee',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    shadowColor: '#4a7fee',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  doorTitleContainer: {
    flex: 1,
  },
  doorControlTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  doorControlSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  doorVisualContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  doorFrame: {
    width: 140,
    height: 170,
    backgroundColor: '#e0e0e0',
    borderWidth: 10,
    borderColor: '#d0d0d0',
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  doorPanel: {
    width: 132,
    height: 160,
    borderWidth: 6,
    borderColor: '#3a6fde',
    backgroundColor: '#4a80f0',
    borderRadius: 6,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    backfaceVisibility: 'hidden',
    transformStyle: 'preserve-3d',
  },
  doorHandle: {
    position: 'absolute',
    right: 12,
    top: '50%',
    width: 12,
    height: 35,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  doorShadowContainer: {
    position: 'absolute',
    height: 160,
    left: 0,
    top: 15,
    width: 80,
    overflow: 'hidden',
  },
  doorShadow: {
    position: 'absolute',
    height: 160,
    left: 0,
    top: 0,
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderTopRightRadius: 100,
    borderBottomRightRadius: 100,
    transformOrigin: 'left',
  },
  lockIndicator: {
    position: 'absolute',
    top: 30,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleButton: {
    backgroundColor: '#4a7fee',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignSelf: 'center',
    marginBottom: 20,
  },
  toggleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  doorButtonContainer: {
    marginVertical: 20,
    alignItems: 'center',
  },
  doorActionButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
    marginTop: 10,
    overflow: 'hidden', // Add this to contain the background view
    position: 'relative', // Add this to position the background properly
  },
  doorActionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doorActionButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  doorStatusText: {
    marginBottom: 5,
  },
  currentStatusLabel: {
    fontSize: 15,
    color: '#666',
  },
  currentStatusValue: {
    fontWeight: 'bold',
    fontSize: 15,
  },
  quickStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f8f9fd',
    borderRadius: 16,
    padding: 16,
    marginTop: 5,
    borderWidth: 1,
    borderColor: '#eaeaea',
  },
  quickStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  quickStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 6,
  },
  quickStatLabel: {
    fontSize: 13,
    color: '#777',
  },
  quickStatDivider: {
    width: 1,
    height: '80%',
    alignSelf: 'center',
    backgroundColor: '#e0e0e0',
    marginHorizontal: 10,
  },
  activityContainer: {
    paddingHorizontal: 20,
  },
  activityCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  emptyActivity: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  emptyActivityText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 10,
  },
  emptyActivitySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 5,
    paddingHorizontal: 20,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 20,
    right: 20,
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#4a7fee',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4a7fee',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  doorControlContainer: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  doorControlCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 15,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.03)',
  },
  doorControlHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
  },
  doorIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#4a7fee',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    shadowColor: '#4a7fee',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  doorTitleContainer: {
    flex: 1,
  },
  doorControlTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  doorControlSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  doorVisualContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  doorFrame: {
    width: 140,
    height: 170,
    backgroundColor: '#e0e0e0',
    borderWidth: 10,
    borderColor: '#d0d0d0',
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  doorPanel: {
    width: 132,
    height: 160,
    borderWidth: 6,
    borderColor: '#3a6fde',
    backgroundColor: '#4a80f0',
    borderRadius: 6,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    backfaceVisibility: 'hidden',
    transformStyle: 'preserve-3d',
  },
  doorHandle: {
    position: 'absolute',
    right: 12,
    top: '50%',
    width: 12,
    height: 35,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  doorShadowContainer: {
    position: 'absolute',
    height: 160,
    left: 0,
    top: 15,
    width: 80,
    overflow: 'hidden',
  },
  doorShadow: {
    position: 'absolute',
    height: 160,
    left: 0,
    top: 0,
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderTopRightRadius: 100,
    borderBottomRightRadius: 100,
    transformOrigin: 'left',
  },
  lockIndicator: {
    position: 'absolute',
    top: 30,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleButton: {
    backgroundColor: '#4a7fee',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignSelf: 'center',
    marginBottom: 20,
  },
  toggleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  doorButtonContainer: {
    marginVertical: 20,
    alignItems: 'center',
  },
  doorActionButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
    marginTop: 10,
    overflow: 'hidden', // Add this to contain the background view
    position: 'relative', // Add this to position the background properly
  },
  doorActionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doorActionButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  doorStatusText: {
    marginBottom: 5,
  },
  currentStatusLabel: {
    fontSize: 15,
    color: '#666',
  },
  currentStatusValue: {
    fontWeight: 'bold',
    fontSize: 15,
  },
  quickStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f8f9fd',
    borderRadius: 16,
    padding: 16,
    marginTop: 5,
    borderWidth: 1,
    borderColor: '#eaeaea',
  },
  quickStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  quickStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 6,
  },
  quickStatLabel: {
    fontSize: 13,
    color: '#777',
  },
  quickStatDivider: {
    width: 1,
    height: '80%',
    alignSelf: 'center',
    backgroundColor: '#e0e0e0',
    marginHorizontal: 10,
  },
  activityContainer: {
    paddingHorizontal: 20,
  },
  activityCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  emptyActivity: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  emptyActivityText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 10,
  },
  emptyActivitySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 5,
    paddingHorizontal: 20,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 20,
    right: 20,
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#4a7fee',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4a7fee',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  doorControlContainer: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  doorControlCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 15,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.03)',
  },
  doorControlHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
  },
  doorIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#4a7fee',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    shadowColor: '#4a7fee',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  doorTitleContainer: {
    flex: 1,
  },
  doorControlTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  doorControlSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  doorVisualContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  doorFrame: {
    width: 140,
    height: 170,
    backgroundColor: '#e0e0e0',
    borderWidth: 10,
    borderColor: '#d0d0d0',
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  doorPanel: {
    width: 132,
    height: 160,
    borderWidth: 6,
    borderColor: '#3a6fde',
    backgroundColor: '#4a80f0',
    borderRadius: 6,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    backfaceVisibility: 'hidden',
    transformStyle: 'preserve-3d',
  },
  doorHandle: {
    position: 'absolute',
    right: 12,
    top: '50%',
    width: 12,
    height: 35,
    borderRadius: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  doorShadowContainer: {
    position: 'absolute',
    height: 160,
    left: 0,
    top: 15,
    width: 80,
    overflow: 'hidden',
  },
  doorShadow: {
    position: 'absolute',
    height: 160,
    left: 0,
    top: 0,
    width: '100%',
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderTopRightRadius: 100,
    borderBottomRightRadius: 100,
    transformOrigin: 'left',
  },
  lockIndicator: {
    position: 'absolute',
    top: 30,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleButton: {
    backgroundColor: '#4a7fee',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignSelf: 'center',
    marginBottom: 20,
  },
  toggleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  doorButtonContainer: {
    marginVertical: 20,
    alignItems: 'center',
  },
  doorActionButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
    marginTop: 10,
    overflow: 'hidden', // Add this to contain the background view
    position: 'relative', // Add this to position the background properly
  },
  doorActionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doorActionButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  doorStatusText: {
    marginBottom: 5,
  },
  currentStatusLabel: {
    fontSize: 15,
    color: '#666',
  },
  currentStatusValue: {
    fontWeight: 'bold',
    fontSize: 15,
  },
  quickStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f8f9fd',
    borderRadius: 16,
    padding: 16,
    marginTop: 5,
    borderWidth: 1,
    borderColor: '#eaeaea',
  },
  quickStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  quickStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 6,
  },
  quickStatLabel: {
    fontSize: 13,
    color: '#777',
  },
  quickStatDivider: {
    width: 1,
    height: '80%',
    alignSelf: 'center',
    backgroundColor: '#e0e0e0',
    marginHorizontal: 10,
  },
  activityContainer: {
    paddingHorizontal: 20,
  },
  activityCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  emptyActivity: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  emptyActivityText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 10,
  },
  emptyActivitySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    marginTop: 5,
    paddingHorizontal: 20,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 20,
    right: 20,
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#4a7fee',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4a7fee',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  eliteCardWrapper: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 8,
  },
  eliteActionCard: {
    width: '90%',
    maxWidth: 370,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#4a7fee',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
    backgroundColor: 'transparent',
  },
  eliteCardGradient: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 38,
    paddingHorizontal: 24,
    borderRadius: 28,
    backgroundColor: 'rgba(58, 148, 255, 0.18)',
    borderWidth: 1.5,
    borderColor: 'rgba(58, 148, 255, 0.18)',
    // Optional: add a glass effect if supported
    // ...(Platform.OS === 'ios' ? { backdropFilter: 'blur(12px)' } : {}),
  },
  eliteIconCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(58,148,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    shadowColor: '#4a7fee',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  eliteCardTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2260b9',
    marginBottom: 8,
    letterSpacing: 0.3,
    textAlign: 'center',
    textShadowColor: 'rgba(58,148,255,0.12)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  eliteCardDescription: {
    fontSize: 15,
    color: '#2d3e50',
    opacity: 0.85,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 260,
  },
  
  // Add styles for section heading with button
  sectionAction: {
    padding: 8,
    marginLeft: 'auto',
  },
  
  // Styles for registered faces modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  registeredFacesContainer: {
    backgroundColor: '#222',
    borderRadius: 12,
    width: '90%',
    height: '80%',
    maxWidth: 500,
    padding: 20,
  },
  registeredFacesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  registeredFacesTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  closeButton: {
    padding: 5,
  },
  refreshContainer: {
    alignItems: 'flex-end',
    marginBottom: 15,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4a90e2',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  refreshButtonText: {
    color: '#fff',
    fontSize: 14,
    marginLeft: 6,
  },
  registeredFacesList: {
    flex: 1,
  },
  registeredFacesContent: {
    paddingBottom: 20,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginTop: 15,
  },
  faceItem: {
    flexDirection: 'row',
    backgroundColor: '#333',
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    alignItems: 'center',
  },
  faceInitialsContainer: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: '#4a90e2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  faceInitials: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  faceInfo: {
    flex: 1,
  },
  faceName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  faceDate: {
    color: '#aaa',
    fontSize: 13,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#293042',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
    marginRight: 12,
    minWidth: 0,
    flex: 1,
    maxWidth: '48%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 6,
    elevation: 2,
  },
  userAvatarWrapper: {
    position: 'relative',
    marginRight: 14,
  },
  userAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2,
    borderColor: '#4a90e2',
    backgroundColor: '#222',
  },
  userAvatarFallback: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#4a90e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarInitials: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  userIndexBadge: {
    position: 'absolute',
    bottom: -6,
    right: -6,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: '#4a90e2',
    minWidth: 20,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  userIndexText: {
    color: '#4a90e2',
    fontWeight: 'bold',
    fontSize: 13,
  },
  userInfoCol: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  userNameText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 2,
    letterSpacing: 0.2,
    maxWidth: '100%',
  },
  userDate: {
    color: '#aaa',
    fontSize: 13,
    marginTop: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  registeredUsersCard: {
    backgroundColor: '#232a36',
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 14,
    marginHorizontal: 16,
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.13,
    shadowRadius: 16,
    elevation: 6,
    justifyContent: 'flex-end',
  },
  usersCountText: {
    color: '#4a90e2',
    fontWeight: 'bold',
    fontSize: 15,
    letterSpacing: 0.2,
  },
  usersListGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: 12,
  },
  namesListContainer: {
    marginTop: 10,
    marginBottom: 30,
    paddingHorizontal: 16,
  },
  namesListTitle: {
    color: '#4a90e2',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'left',
    letterSpacing: 0.2,
  },
  nameRowClassic: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  userAvatarClassic: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 14,
    borderWidth: 1.5,
    borderColor: '#4a90e2',
    backgroundColor: '#e9f1fa',
  },
  userAvatarFallbackClassic: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 14,
    backgroundColor: '#4a90e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarInitialsClassic: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  userInfoColClassic: {
    flex: 1,
    justifyContent: 'center',
  },
  nameTextClassic: {
    color: '#222',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
    letterSpacing: 0.1,
  },
  userDateClassic: {
    color: '#888',
    fontSize: 13,
  },
  deleteUserButton: {
    marginLeft: 10,
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,59,48,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});