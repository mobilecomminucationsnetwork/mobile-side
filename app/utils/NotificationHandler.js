// filepath: /home/furkan/Downloads/mobilecomnew/app/utils/NotificationHandler.js
import { Platform, Alert } from 'react-native';
import websocketService, { WebSocketEvents } from '../services/websocketService';

// This class handles notifications triggered by WebSocket events
class NotificationHandler {
  constructor() {
    this.isInitialized = false;
    this.listeners = [];
  }

  // Initialize notification handlers
  initialize() {
    if (this.isInitialized) return;
    
    console.log('Initializing notification handler');
    this.setupWebSocketListeners();
    this.isInitialized = true;
  }

  // Set up WebSocket event listeners to trigger notifications
  setupWebSocketListeners() {
    // Listen for door status changes
    this.listeners.push(
      websocketService.addEventListener(
        WebSocketEvents.DOOR_STATUS_CHANGED,
        this.handleDoorStatusChange
      )
    );
    
    // Listen for access notifications
    this.listeners.push(
      websocketService.addEventListener(
        WebSocketEvents.ACCESS_GRANTED,
        this.handleAccessGranted
      )
    );
    
    this.listeners.push(
      websocketService.addEventListener(
        WebSocketEvents.ACCESS_DENIED,
        this.handleAccessDenied
      )
    );
    
    // Listen for general notifications
    this.listeners.push(
      websocketService.addEventListener(
        WebSocketEvents.NOTIFICATION,
        this.handleNotification
      )
    );
  }

  // Handle door status change event
  handleDoorStatusChange = (data) => {
    console.log('Door status notification:', data);
    
    // Only show notification if it's an important update
    if (data.critical) {
      this.showNotification(
        'Door Status Update',
        `The door is now ${data.status.toLowerCase()}.`,
        data
      );
    }
  };

  // Handle access granted event
  handleAccessGranted = (data) => {
    console.log('Access granted notification:', data);
    
    const userName = data.user || 'Someone';
    const message = `${userName} has accessed the door at ${this.formatTime(data.timestamp)}`;
    
    this.showNotification(
      'Access Granted',
      message,
      data
    );
  };

  // Handle access denied event
  handleAccessDenied = (data) => {
    console.log('Access denied notification:', data);
    
    this.showNotification(
      'Security Alert',
      'Unauthorized access attempt detected',
      data,
      true // This is a high-priority alert
    );
  };

  // Handle general notification event
  handleNotification = (data) => {
    console.log('General notification:', data);
    
    if (data.title && data.message) {
      this.showNotification(
        data.title,
        data.message,
        data,
        data.priority === 'high'
      );
    }
  };

  // Format timestamp for notifications
  formatTime(timestamp) {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // Show a notification to the user
  showNotification(title, message, data, isHighPriority = false) {
    // For this simple implementation, we'll just use Alert
    // In a production app, you would use a proper notification library 
    // like react-native-push-notification or expo-notifications
    
    // Only show alerts if the app is in the foreground
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Alert.alert(
        title,
        message,
        [{ text: 'OK' }],
        { cancelable: true }
      );
    }
    
    // Here you would trigger a local or push notification for background alerts
    console.log(`Notification: ${title} - ${message}`);
  }

  // Clean up all listeners
  cleanup() {
    console.log('Cleaning up notification handler');
    
    this.listeners.forEach(removeListener => {
      if (typeof removeListener === 'function') {
        removeListener();
      }
    });
    
    this.listeners = [];
    this.isInitialized = false;
  }
}

// Create and export singleton instance
const notificationHandler = new NotificationHandler();
export default notificationHandler;