import AsyncStorage from '@react-native-async-storage/async-storage';

// WebSocket Event Types
export const WebSocketEvents = {
  CONNECTION_STATUS: 'connection_status',
  DOOR_STATUS_CHANGED: 'door_status_changed',
  ACCESS_GRANTED: 'access_granted',
  ACCESS_DENIED: 'access_denied',
  NOTIFICATION: 'notification',
};

class WebSocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectTimeout = null;
    this.listeners = {};
    
    // The server expects a client_type parameter in the query string
    this.baseUrl = 'ws://161.35.195.142:8000/ws/doors/e43b48ac-6cce-430e-a119-5c5ff5d62967/';
    this.apiUrl = `${this.baseUrl}?client_type=mobile`;
    this.fallbackAttempted = false;
    
    // Debug settings
    this.logMessages = true;
  }

  // Connect to the WebSocket server
  async connect() {
    if (this.isConnected || this.isConnecting) return;
    
    this.isConnecting = true;
    
    try {
      // Use the URL with client_type parameter
      console.log('Connecting to WebSocket at:', this.apiUrl);
      
      // Create WebSocket connection
      this.socket = new WebSocket(this.apiUrl);
      
      // Remove connection timeout logic entirely
      // (No setTimeout for closing the socket)

      // Set up event handlers
      this.socket.onopen = () => {
        console.log('WebSocket connection established successfully');
        
        // No connection timeout to clear
        
        this.isConnected = true;
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        
        // Removed heartbeat call
        this.notifyConnectionStatus(true);
      };
      this.socket.onmessage = this.handleMessage.bind(this);
      this.socket.onerror = this.handleError.bind(this);
      this.socket.onclose = this.handleClose.bind(this);
      
      console.log('WebSocket connection initiated');
    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
      this.isConnecting = false;
      this.notifyConnectionStatus(false, error);
      this.tryToReconnect();
    }
  }

  // Handle WebSocket open event
  handleOpen() {
    console.log('WebSocket connection established successfully');
    
    // Clear connection timeout
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
    
    this.isConnected = true;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.notifyConnectionStatus(true);
  }

  // Handle incoming WebSocket messages
  handleMessage(event) {
    try {
      const data = JSON.parse(event.data);
      
      // Skip logging any door status messages to avoid confusion
      if (data.type !== 'door_status') {
        console.log('WebSocket message received:', data);
      }
      
      // Handle heartbeat response from server
      if (data.type === 'heartbeat_response') {
        console.log('Heartbeat response received');
        return;
      }

      // Handle connection confirmation
      if (data.type === 'connection_established') {
        console.log('Connection established with server:', data.message);
        console.log('Client ID assigned:', data.client_id);
        return;
      }
      
      // Handle door status updates
      if (data.type === 'door_status') {
        // Convert status to our normalized format
        let normalizedStatus = data.status;
        if (data.status === 'OPEN') {
          normalizedStatus = 'OPEN';
        }
        
        // Create a standardized message with all the fields our dashboard expects
        const doorStatusEvent = {
          type: 'door_status_changed', // This matches what our dashboard listens for
          status: normalizedStatus,
          door_id: "e43b48ac-6cce-430e-a119-5c5ff5d62967",
          timestamp: data.timestamp || new Date().toISOString(),
          physical_state: normalizedStatus === 'OPEN' ? 'OPEN' : 'CLOSED'
        };
        
        // Notify all listeners of the door status change
        this.notifyListeners(WebSocketEvents.DOOR_STATUS_CHANGED, doorStatusEvent);
        return;
      }
      
      // NEW: Handle door command messages from hardware
      if (data.type === 'door_command' && data.command === 'set_status') {
        console.log('Door command received from hardware:', data);
        
        // Extract the status from the command
        let normalizedStatus = data.status;
        if (data.status === 'OPEN') {
          normalizedStatus = 'OPEN';
        }
        
        // Create a standardized message with all the fields our dashboard expects
        const doorStatusEvent = {
          type: 'door_status_changed',
          status: normalizedStatus,
          door_id: data.door_id || "e43b48ac-6cce-430e-a119-5c5ff5d62967",
          timestamp: data.timestamp || new Date().toISOString(),
          physical_state: normalizedStatus === 'OPEN' ? 'OPEN' : 'CLOSED',
          command_id: data.command_id, // Include the command ID for reference
          source: 'hardware_command' // Flag that this came from hardware command
        };
        
        // Notify all listeners of the door status change
        this.notifyListeners(WebSocketEvents.DOOR_STATUS_CHANGED, doorStatusEvent);
        
        // Send an acknowledgment back to the hardware
        return;
      }
      
      // Handle other message types
      switch (data.type) {
        case 'access_granted':
          this.notifyListeners(WebSocketEvents.ACCESS_GRANTED, data);
          break;
        case 'access_denied':
          this.notifyListeners(WebSocketEvents.ACCESS_DENIED, data);
          break;
        case 'notification':
          this.notifyListeners(WebSocketEvents.NOTIFICATION, data);
          break;
        default:
          console.log('Unhandled WebSocket message type:', data.type);
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }

  // Handle WebSocket error - silently handle errors
  handleError(error) {
    console.log('WebSocket encountered an issue - will auto-reconnect');
    // Don't notify as an error - don't want to see errors in the UI
  }

  // Handle WebSocket close event - force immediate reconnect, never allow closure
  handleClose(event) {
    // Always reconnect immediately, never allow the socket to stay closed
    console.log(`WebSocket closed (code: ${event.code}, reason: ${event.reason || 'none'}). Forcing immediate reconnect.`);
    this.isConnected = false;
    this.isConnecting = false;

    // Prevent any UI notification about closure
    // (do not call notifyConnectionStatus)

    // Force immediate reconnect, even if server closes intentionally
    setTimeout(() => {
      this.reconnectAttempts = 0;
      this.connect();
    }, 10); // as fast as possible
  }

  // Try to reconnect to the WebSocket server
  tryToReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnect attempts reached, giving up');
      return;
    }
    
    this.reconnectAttempts++;
    
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  // Notify all listeners of the connection status
  notifyConnectionStatus(connected, error = null) {
    // Suppress code 1000 errors from being reported anywhere
    if (error && error.code === 1000) {
      return;
    }
    this.notifyListeners(WebSocketEvents.CONNECTION_STATUS, {
      connected,
      error
    });
  }

  // Notify all listeners of a specific event
  notifyListeners(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in listener for ${event}:`, error);
        }
      });
    }
  }

  // Add an event listener
  addEventListener(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    
    this.listeners[event].push(callback);
    
    // Return an unsubscribe function
    return () => {
      if (this.listeners[event]) {
        this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
      }
    };
  }

  // Send a WebSocket message
  sendMessage(message) {
    if (!this.isConnected || !this.socket) {
      console.warn('Cannot send message, WebSocket is not connected');
      this.connect(); // Auto-reconnect when trying to send a message
      return false;
    }
    
    try {
      this.socket.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('Error sending WebSocket message:', error);
      return false;
    }
  }

  // Generate a UUID v4 for command_id
  generateUUID() {
    // Simple UUID v4 implementation
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  
  // Format timestamp in the exact format expected by hardware
  formatTimestamp() {
    const now = new Date();
    // Format: YYYY-MM-DD HH:MM:SS.mmmmmm+00:00
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const day = String(now.getUTCDate()).padStart(2, '0');
    const hours = String(now.getUTCHours()).padStart(2, '0');
    const minutes = String(now.getUTCMinutes()).padStart(2, '0');
    const seconds = String(now.getUTCSeconds()).padStart(2, '0');
    const milliseconds = String(now.getUTCMilliseconds()).padStart(3, '0') + '000';
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}+00:00`;
  }

  // Disconnect WebSocket
  disconnect() {
    // Clear any reconnect timeouts
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    // Close the socket if it exists
    if (this.socket) {
      try {
        this.socket.close(1000, 'User disconnected');
      } catch (err) {
        console.error('Error closing WebSocket:', err);
      }
      this.socket = null;
    }
    
    this.isConnected = false;
    this.isConnecting = false;
    console.log('WebSocket disconnected by user');
  }
  
  // The door control command - this is the ONLY outgoing message we'll send
  openDoor() {
    console.log('Sending command to open door');
    return this.sendMessage({ 
      type: "status_update", 
      status: "OPEN",
      door_id: "e43b48ac-6cce-430e-a119-5c5ff5d62967", 
      command_id: this.generateUUID(), 
      timestamp: new Date().toISOString()
    });
  }
  
  // Send face recognition request with 640x640 base64 image - updated to include name
  sendFaceRecognition(base64Data, name = '') {
    if (!base64Data) {
      console.error('Cannot send face recognition: No image data provided');
      return false;
    }
    
    // Ensure name is provided - make it a hard requirement
    if (!name || name.trim() === '') {
      console.error('Cannot send face recognition: Name is required');
      return false; // Don't proceed if name is missing
    }
    
    console.log(`Sending face recognition request via WebSocket for user: ${name}`);
    
    // Remove data URI prefix if present
    const cleanBase64 = base64Data.includes('base64,') 
      ? base64Data.split('base64,')[1] 
      : base64Data;
    
    // Format exactly matching what the backend consumer expects
    const message = {
      "type": "face_recognition_request",
      "face_image_base64": cleanBase64,
      "request_id": this.generateUUID(),
      "timestamp": new Date().toISOString(),
      "name": name  // This is correct - using the name parameter as user_id
    };
    
    const success = this.sendMessage(message);
    if (success) {
      console.log('Face recognition request sent successfully');
    } else {
      console.error('Failed to send face recognition request');
    }
    
    return success;
  }
  
  // Fetch face data from the server - returns names with registered faces
  async getFaceData() {
    try {
      const SERVER_URL = "http://161.35.195.142:8000";
      const FACE_DATA_URL = `${SERVER_URL}/api/face-vectors/`;
      
      console.log('Fetching face data from:', FACE_DATA_URL);
      
      const response = await fetch(FACE_DATA_URL);
      
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Retrieved face data:', data);
      return data;
    } catch (error) {
      console.error('Error fetching face data:', error);
      throw error;
    }
  }
}

// Create a singleton instance
const websocketService = new WebSocketService();

export default websocketService;