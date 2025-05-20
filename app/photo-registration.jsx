import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Alert,
  Platform,
  Dimensions,
  TextInput,
  Modal
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import websocketService from './services/websocketService';
import { useAuth } from './context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function PhotoRegistration() {
  const { userId, userData } = useAuth();
  const [facing, setFacing] = useState('front');
  const [permission, requestPermission] = useCameraPermissions();
  const [photo, setPhoto] = useState(null);
  const [photoBase64, setPhotoBase64] = useState(null);
  const [isTakingPhoto, setIsTakingPhoto] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userName, setUserName] = useState('');
  const [nameEntered, setNameEntered] = useState(false);
  const [showNamePrompt, setShowNamePrompt] = useState(true);
  const cameraRef = useRef(null);
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;

  useEffect(() => {
    // Connect to WebSocket
    try {
      websocketService.connect();
    } catch (error) {
      console.error('WebSocket connection error:', error);
    }
    
    return () => {
      // Cleanup
      try {
        websocketService.disconnect();
      } catch (error) {
        console.error('WebSocket disconnect error:', error);
      }
    };
  }, []);

  // Toggle camera facing
  const toggleCameraFacing = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  // Process photo to exact 640x640 format for hardware compatibility
  const processPhotoForHardware = async (uri) => {
    try {
      console.log('Processing photo for hardware...');
      
      // Resize the image to exactly 640x640 without compression
      const processedImage = await ImageManipulator.manipulateAsync(
        uri,
        [
          { resize: { width: 640, height: 640 } }  // Exact 640x640 square format
        ],
        { 
          compress: 1.0,  // No compression (1.0 = 100% quality)
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true
        }
      );
      
      // Make sure we're only returning the base64 string, not a data URI
      const base64Data = processedImage.base64;
      
      // Log the dimensions and size to verify
      console.log(`Photo processed: 640x640px, base64 length: ${base64Data.length}`);
      
      return base64Data;
    } catch (error) {
      console.error('Error processing photo for hardware:', error);
      throw error;
    }
  };

  // Take a picture with the camera
  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        setIsTakingPhoto(true);
        console.log('Taking photo...');
        
        // Capture photo from camera
        const { uri } = await cameraRef.current.takePictureAsync({
          quality: 1.0,  // Capture at full quality
          skipProcessing: Platform.OS === 'android',
        });
        
        console.log('Photo captured, preparing for preview');
        setPhoto(uri);
        
        // Process the photo for hardware immediately
        const hardwareReady = await processPhotoForHardware(uri);
        setPhotoBase64(hardwareReady);
        
        console.log('Photo ready for hardware use (640x640)');
      } catch (error) {
        console.error('Error taking picture:', error);
        Alert.alert('Error', 'Failed to take picture. Please try again.');
      } finally {
        setIsTakingPhoto(false);
      }
    }
  };

  // Function to send photo directly to hardware via WebSocket with updated format
  const sendPhotoToHardware = async () => {
    if (!photoBase64) {
      Alert.alert('Error', 'Please take a photo first.');
      return false;
    }
    
    try {
      console.log('Sending 640x640 face image via WebSocket...');
      
      // This is already correct - userName from the input is being passed
      const success = websocketService.sendFaceRecognition(photoBase64, userName);
      
      if (success) {
        console.log('Face recognition request sent successfully');
        return true;
      } else {
        console.error('Failed to send face recognition request');
        return false;
      }
    } catch (error) {
      console.error('Error sending face recognition request:', error);
      return false;
    }
  };

  // Handle name submission
  const handleNameSubmit = () => {
    if (!userName || userName.trim() === '') {
      Alert.alert('Error', 'Please enter your name.');
      return;
    }
    
    setNameEntered(true);
    setShowNamePrompt(false);
  };

  // Submit photo using only WebSocket
  const submitPhoto = async () => {
    if (!photo || !photoBase64) {
      Alert.alert('Error', 'Please take a photo first.');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Show processing indicator
      Alert.alert(
        'Processing',
        'Uploading your photo. Please wait...',
        [],
        { cancelable: false }
      );
      
      // Send to hardware via WebSocket
      console.log('Sending photo via WebSocket...');
      const sent = await sendPhotoToHardware();
      
      if (sent) {
        console.log('Photo sent via WebSocket successfully');
        
        // Set a flag to refresh registered users list when returning to dashboard
        await AsyncStorage.setItem('REFRESH_REGISTERED_USERS', 'true');
      } else {
        console.error('Failed to send photo via WebSocket');
        throw new Error('Failed to send photo to door system');
      }
      
      // Save backup of photo locally
      const timestamp = new Date().getTime();
      const backupDir = FileSystem.documentDirectory + 'face_backups/';
      const backupPath = backupDir + `face_${timestamp}.jpg`;
      
      try {
        // Create backup directory if it doesn't exist
        const dirInfo = await FileSystem.getInfoAsync(backupDir);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(backupDir, { intermediates: true });
        }
        
        // Save original photo as backup
        await FileSystem.copyAsync({
          from: photo,
          to: backupPath
        });
        console.log('Backup saved to:', backupPath);
      } catch (backupError) {
        console.error('Error saving backup:', backupError);
        // Continue even if backup fails
      }
      

      
      // Show success message
      Alert.alert(
        'Success',
        'Your face has been registered with the door system. A backup has been saved on your device.',
        [{ text: 'OK', onPress: () => router.replace('/dashboard') }]
      );
    } catch (error) {
      console.error('Error submitting photo:', error);
      
      // Show error message
      Alert.alert(
        'Registration Failed',
        'We were unable to register your face with the door system. Please try again later.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const retakePicture = () => {
    setPhoto(null);
    setPhotoBase64(null);
  };

  // If permissions are still loading or name not entered
  if (!permission) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4a90e2" />
          <Text style={styles.loadingText}>Requesting camera permission...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // If permission is denied
  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionContainer}>
          <MaterialIcons name="no-photography" size={60} color="#ccc" />
          <Text style={styles.permissionText}>
            No access to camera
          </Text>
          <Text style={styles.permissionSubtext}>
            Please enable camera access in your device settings to use this feature.
          </Text>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={requestPermission}
          >
            <Text style={styles.settingsButtonText}>Request Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.settingsButton, {marginTop: 10, backgroundColor: '#666'}]}
            onPress={() => router.back()}
          >
            <Text style={styles.settingsButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBackButton}
          onPress={() => router.back()}
          disabled={isSubmitting || isTakingPhoto}
        >
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Face Registration</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Name Input Modal */}
      <Modal
        visible={showNamePrompt}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowNamePrompt(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Enter Your Name</Text>
            <Text style={styles.modalDescription}>
              Please enter your name to register your face with the door system.
            </Text>
            
            <TextInput
              style={styles.nameInput}
              placeholder="Your Name"
              placeholderTextColor="#999"
              value={userName}
              onChangeText={setUserName}
              autoCapitalize="words"
              autoFocus
            />
            
            <TouchableOpacity
              style={styles.nameSubmitButton}
              onPress={handleNameSubmit}
            >
              <Text style={styles.nameSubmitButtonText}>Continue</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => router.back()}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={styles.content}>
        {/* Photo Preview section */}
        {photo ? (
          <View style={styles.previewContainer}>
            <View style={styles.previewImageContainer}>
              <Image source={{ uri: photo }} style={styles.previewImage} />
            </View>

            <View style={styles.previewInfo}>
              <Text style={styles.previewText}>
                Ready to register your face?
              </Text>
            </View>

            <View style={styles.previewActions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.retakeButton]}
                onPress={retakePicture}
                disabled={isSubmitting}
              >
                <Feather name="refresh-ccw" size={20} color="#fff" />
                <Text style={styles.actionButtonText}>Retake</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.submitButton]}
                onPress={submitPhoto}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Feather name="check" size={20} color="#fff" />
                    <Text style={styles.actionButtonText}>Register & Send</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          // Camera View
          <View style={styles.cameraContainer}>
            <CameraView
              ref={cameraRef}
              style={styles.cameraPreview}
              facing={facing}
              onCameraReady={() => console.log("Camera is ready")}
              onMountError={(error) => console.error("Camera mount error:", error)}
            />
            
            {/* Controls positioned with absolute positioning */}
            <View style={styles.cameraControlsTop}>
              <TouchableOpacity
                style={styles.flipButton}
                onPress={toggleCameraFacing}
                disabled={isTakingPhoto}
              >
                <Feather name="refresh-cw" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Name display on camera screen */}
            <View style={styles.nameDisplayContainer}>
              <Text style={styles.nameDisplayText}>
                Registering for: {userName}
              </Text>
            </View>

            {/* Face guidance overlay */}
            <View style={styles.faceOverlay}>
              <View style={styles.faceOutline} />
            </View>

            <View style={styles.instructionsContainer}>
              <Text style={styles.instructionsText}>
                Position your face within the circle and ensure good lighting
              </Text>
            </View>

            <View style={styles.captureButtonContainer}>
              <TouchableOpacity
                style={styles.captureButton}
                onPress={takePicture}
                disabled={isTakingPhoto}
              >
                {isTakingPhoto ? (
                  <ActivityIndicator size="large" color="#fff" />
                ) : (
                  <View style={styles.captureButtonInner} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  permissionText: {
    marginTop: 20,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  permissionSubtext: {
    marginTop: 15,
    fontSize: 16,
    color: '#aaa',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 30,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 15,
    backgroundColor: '#000',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 10 : 15,
  },
  headerBackButton: {
    padding: 10,
  },
  settingsButton: {
    marginTop: 20,
    backgroundColor: '#4a90e2',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
  },
  settingsButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 44,
  },
  content: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  cameraPreview: {
    flex: 1,
  },
  cameraControlsTop: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 10,
  },
  flipButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  faceOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  faceOutline: {
    width: 250,
    height: 250,
    borderRadius: 125,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.7)',
    borderStyle: 'dashed',
  },
  instructionsContainer: {
    position: 'absolute',
    bottom: 120,
    left: 20,
    right: 20,
    zIndex: 10,
  },
  instructionsText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 15,
    borderRadius: 8,
  },
  captureButtonContainer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
  },
  previewContainer: {
    flex: 1,
    padding: 20,
  },
  previewImageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  previewInfo: {
    marginBottom: 30,
    alignItems: 'center',
  },
  previewText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  previewActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 10,
    marginHorizontal: 10,
  },
  retakeButton: {
    backgroundColor: '#555',
  },
  submitButton: {
    backgroundColor: '#4caf50',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  
  // Add styles for the name input modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#222',
    borderRadius: 12,
    padding: 25,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
    textAlign: 'center',
  },
  modalDescription: {
    fontSize: 16,
    color: '#ccc',
    marginBottom: 25,
    textAlign: 'center',
    lineHeight: 22,
  },
  nameInput: {
    width: '100%',
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    color: '#fff',
    marginBottom: 20,
  },
  nameSubmitButton: {
    backgroundColor: '#4a90e2',
    width: '100%',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  nameSubmitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButton: {
    padding: 12,
  },
  cancelButtonText: {
    color: '#999',
    fontSize: 16,
  },
  nameDisplayContainer: {
    position: 'absolute',
    top: 80,
    left: 0,
    right: 0,
    zIndex: 10,
    alignItems: 'center',
  },
  nameDisplayText: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
  },
});