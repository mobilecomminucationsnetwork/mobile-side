import React, { useState, useRef, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  SafeAreaView, 
  StatusBar, 
  Alert,
  ActivityIndicator,
  Animated
} from 'react-native';
import { Camera } from 'expo-camera';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';

export default function FaceLogin() {
  const [hasPermission, setHasPermission] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const cameraRef = useRef(null);
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  useEffect(() => {
    if (scanning) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanLineAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(scanLineAnim, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      scanLineAnim.setValue(0);
    }
  }, [scanning]);

  const startScan = () => {
    setScanning(true);
    setTimeout(() => {
      setScanning(false);
      performFaceRecognition();
    }, 3000);
  };

  const performFaceRecognition = async () => {
    try {
      setRecognizing(true);
      
      // Simulate API call for face recognition
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // For demo purposes, randomly decide authentication result
      const isSuccessful = Math.random() > 0.3; // 70% success rate
      
      if (isSuccessful) {
        setAuthenticated(true);
        setTimeout(() => {
          Alert.alert(
            'Welcome Back!',
            'Face ID authentication successful.',
            [{ text: 'Continue', onPress: () => router.replace('/dashboard') }]
          );
        }, 1000);
      } else {
        Alert.alert(
          'Authentication Failed',
          'Face not recognized. Please try again or use password login.',
          [{ text: 'Try Again', onPress: () => setRecognizing(false) }]
        );
      }
    } catch (error) {
      console.error('Face recognition error:', error);
      Alert.alert('Error', 'Failed to process face recognition. Please try again.');
      setRecognizing(false);
    }
  };

  if (hasPermission === null) {
    return (
      <View style={styles.permissionContainer}>
        <ActivityIndicator size="large" color="#4a90e2" />
        <Text style={styles.permissionText}>Requesting camera permission...</Text>
      </View>
    );
  }
  
  if (hasPermission === false) {
    return (
      <View style={styles.permissionContainer}>
        <MaterialIcons name="no-photography" size={60} color="#ff3b30" />
        <Text style={styles.permissionText}>Camera access is required for Face ID login.</Text>
        <TouchableOpacity 
          style={styles.permissionButton}
          onPress={() => router.push('/login')}
        >
          <Text style={styles.permissionButtonText}>Use Password Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Face ID Login</Text>
        <View style={styles.placeholder} />
      </View>
      
      <View style={styles.content}>
        <View style={styles.cameraContainer}>
          <Camera 
            style={styles.camera} 
            type={Camera.Constants.Type.front}
            ref={cameraRef}
          >
            <View style={styles.cameraOverlay}>
              <View style={styles.faceBoundary}>
                {scanning && (
                  <Animated.View 
                    style={[
                      styles.scanLine,
                      {
                        transform: [
                          {
                            translateY: scanLineAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [-125, 125]
                            })
                          }
                        ]
                      }
                    ]}
                  />
                )}
              </View>
              
              {authenticated && (
                <View style={styles.successOverlay}>
                  <MaterialIcons name="check-circle" size={80} color="#34c759" />
                </View>
              )}
            </View>
          </Camera>
        </View>
        
        <View style={styles.statusContainer}>
          {scanning ? (
            <>
              <ActivityIndicator size="small" color="#4a90e2" />
              <Text style={styles.statusText}>Scanning face...</Text>
            </>
          ) : recognizing ? (
            <>
              <ActivityIndicator size="small" color="#4a90e2" />
              <Text style={styles.statusText}>Authenticating...</Text>
            </>
          ) : authenticated ? (
            <Text style={styles.statusText}>Authentication successful!</Text>
          ) : (
            <Text style={styles.statusText}>
              Position your face in the frame and tap "Scan Face"
            </Text>
          )}
        </View>
        
        {!scanning && !recognizing && !authenticated && (
          <TouchableOpacity 
            style={styles.scanButton}
            onPress={startScan}
          >
            <MaterialIcons name="face" size={24} color="#fff" />
            <Text style={styles.buttonText}>Scan Face</Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity 
          style={styles.passwordButton}
          onPress={() => router.push('/login')}
          disabled={scanning || recognizing}
        >
          <Text style={styles.passwordButtonText}>
            Use Password Login Instead
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  permissionText: {
    color: '#ffffff',
    textAlign: 'center',
    fontSize: 16,
    marginTop: 20,
    marginBottom: 30,
  },
  permissionButton: {
    backgroundColor: '#4a90e2',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  backButton: {
    padding: 8,
  },
  placeholder: {
    width: 40,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  content: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
  },
  cameraContainer: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  faceBoundary: {
    width: 250,
    height: 250,
    borderRadius: 125,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.7)',
    overflow: 'hidden',
  },
  scanLine: {
    width: 250,
    height: 2,
    backgroundColor: '#4a90e2',
  },
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
  },
  statusText: {
    color: '#ffffff',
    fontSize: 16,
    marginLeft: 8,
    textAlign: 'center',
  },
  scanButton: {
    backgroundColor: '#4a90e2',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 16,
    width: '100%',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  passwordButton: {
    paddingVertical: 12,
  },
  passwordButtonText: {
    color: '#4a90e2',
    fontSize: 16,
  },
});
