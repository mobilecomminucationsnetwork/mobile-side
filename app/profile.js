import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  SafeAreaView,
  StatusBar,
  ScrollView,
  Image,
  TextInput,
  Switch,
  Animated,
  Alert,
  Modal
} from 'react-native';
import { router } from 'expo-router';
import { MaterialIcons, Feather, Ionicons } from '@expo/vector-icons';

export default function Profile() {
  // Mock user data - would come from state/context in a real app
  const [userData, setUserData] = useState({
    name: 'John Doe',
    email: 'john.doe@example.com',
    phone: '+1 (555) 123-4567',
    joinDate: 'January 15, 2023',
    imageUrl: null,
    preferences: {
      notifications: true,
      biometricAuth: true,
      darkMode: false,
      autoLock: true
    }
  });
  
  // State for edit modal
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editField, setEditField] = useState('');
  const [editValue, setEditValue] = useState('');
  
  // Animation values
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const translateY = React.useRef(new Animated.Value(30)).current;
  
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
  }, []);
  
  const handleEditField = (field, currentValue) => {
    setEditField(field);
    setEditValue(currentValue);
    setEditModalVisible(true);
  };
  
  const saveEdit = () => {
    if (editValue.trim() === '') {
      Alert.alert('Error', 'Please enter a value');
      return;
    }
    
    setUserData(prev => ({
      ...prev,
      [editField]: editValue
    }));
    
    setEditModalVisible(false);
    
    // Show success message
    Alert.alert('Success', `Your ${editField} has been updated.`);
  };
  
  const togglePreference = (preference) => {
    setUserData(prev => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        [preference]: !prev.preferences[preference]
      }
    }));
  };
  
  const handleLogout = () => {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Logout", onPress: () => router.replace('/') }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#4a7fee" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Feather name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Profile</Text>
        <TouchableOpacity style={styles.settingsButton}>
          <Feather name="settings" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
      
      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Profile Header */}
        <Animated.View 
          style={[
            styles.profileHeader,
            {
              opacity: fadeAnim,
              transform: [{ translateY: translateY }]
            }
          ]}
        >
          <View style={styles.profileImageContainer}>
            {userData.imageUrl ? (
              <Image 
                source={{ uri: userData.imageUrl }} 
                style={styles.profileImage}
              />
            ) : (
              <View style={styles.profileImagePlaceholder}>
                <Text style={styles.profileInitials}>
                  {userData.name.split(' ').map(n => n[0]).join('')}
                </Text>
              </View>
            )}
            <TouchableOpacity style={styles.cameraButton}>
              <Feather name="camera" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.profileName}>{userData.name}</Text>
          <Text style={styles.profileEmail}>{userData.email}</Text>
          
          <TouchableOpacity style={styles.editProfileButton}>
            <Text style={styles.editProfileText}>Edit Profile</Text>
          </TouchableOpacity>
        </Animated.View>
        
        {/* Personal Information Section */}
        <Animated.View
          style={[
            styles.sectionContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: translateY }]
            }
          ]}
        >
          <View style={styles.sectionHeader}>
            <Feather name="user" size={20} color="#4a7fee" />
            <Text style={styles.sectionTitle}>Personal Information</Text>
          </View>
          
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <View style={styles.infoLabelContainer}>
                <Text style={styles.infoLabel}>Full Name</Text>
              </View>
              <View style={styles.infoValueContainer}>
                <Text style={styles.infoValue}>{userData.name}</Text>
                <TouchableOpacity 
                  onPress={() => handleEditField('name', userData.name)}
                  style={styles.editButton}
                >
                  <Feather name="edit-2" size={16} color="#4a7fee" />
                </TouchableOpacity>
              </View>
            </View>
            
            <View style={styles.infoRow}>
              <View style={styles.infoLabelContainer}>
                <Text style={styles.infoLabel}>Email</Text>
              </View>
              <View style={styles.infoValueContainer}>
                <Text style={styles.infoValue}>{userData.email}</Text>
                <TouchableOpacity 
                  onPress={() => handleEditField('email', userData.email)}
                  style={styles.editButton}
                >
                  <Feather name="edit-2" size={16} color="#4a7fee" />
                </TouchableOpacity>
              </View>
            </View>
            
            <View style={styles.infoRow}>
              <View style={styles.infoLabelContainer}>
                <Text style={styles.infoLabel}>Phone</Text>
              </View>
              <View style={styles.infoValueContainer}>
                <Text style={styles.infoValue}>{userData.phone}</Text>
                <TouchableOpacity 
                  onPress={() => handleEditField('phone', userData.phone)}
                  style={styles.editButton}
                >
                  <Feather name="edit-2" size={16} color="#4a7fee" />
                </TouchableOpacity>
              </View>
            </View>
            
            <View style={[styles.infoRow, styles.lastInfoRow]}>
              <View style={styles.infoLabelContainer}>
                <Text style={styles.infoLabel}>Member Since</Text>
              </View>
              <View style={styles.infoValueContainer}>
                <Text style={styles.infoValue}>{userData.joinDate}</Text>
              </View>
            </View>
          </View>
        </Animated.View>
        
        {/* Security Section */}
        <Animated.View
          style={[
            styles.sectionContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: translateY }]
            }
          ]}
        >
          <View style={styles.sectionHeader}>
            <Feather name="shield" size={20} color="#4a7fee" />
            <Text style={styles.sectionTitle}>Security & Preferences</Text>
          </View>
          
          <View style={styles.card}>
            <View style={styles.preferenceRow}>
              <View style={styles.preferenceInfo}>
                <Text style={styles.preferenceName}>Push Notifications</Text>
                <Text style={styles.preferenceDescription}>
                  Receive alerts when door is accessed
                </Text>
              </View>
              <Switch
                trackColor={{ false: "#e0e0e0", true: "#a0c4f1" }}
                thumbColor={userData.preferences.notifications ? "#4a7fee" : "#f4f3f4"}
                onValueChange={() => togglePreference('notifications')}
                value={userData.preferences.notifications}
              />
            </View>
            
            <View style={styles.divider} />
            
            <View style={styles.preferenceRow}>
              <View style={styles.preferenceInfo}>
                <Text style={styles.preferenceName}>Biometric Authentication</Text>
                <Text style={styles.preferenceDescription}>
                  Use Face ID / Touch ID for login
                </Text>
              </View>
              <Switch
                trackColor={{ false: "#e0e0e0", true: "#a0c4f1" }}
                thumbColor={userData.preferences.biometricAuth ? "#4a7fee" : "#f4f3f4"}
                onValueChange={() => togglePreference('biometricAuth')}
                value={userData.preferences.biometricAuth}
              />
            </View>
            
            <View style={styles.divider} />
            
            <View style={styles.preferenceRow}>
              <View style={styles.preferenceInfo}>
                <Text style={styles.preferenceName}>Dark Mode</Text>
                <Text style={styles.preferenceDescription}>
                  Enable dark theme appearance
                </Text>
              </View>
              <Switch
                trackColor={{ false: "#e0e0e0", true: "#a0c4f1" }}
                thumbColor={userData.preferences.darkMode ? "#4a7fee" : "#f4f3f4"}
                onValueChange={() => togglePreference('darkMode')}
                value={userData.preferences.darkMode}
              />
            </View>
            
            <View style={styles.divider} />
            
            <View style={styles.preferenceRow}>
              <View style={styles.preferenceInfo}>
                <Text style={styles.preferenceName}>Auto-Lock</Text>
                <Text style={styles.preferenceDescription}>
                  Automatically lock after session timeout
                </Text>
              </View>
              <Switch
                trackColor={{ false: "#e0e0e0", true: "#a0c4f1" }}
                thumbColor={userData.preferences.autoLock ? "#4a7fee" : "#f4f3f4"}
                onValueChange={() => togglePreference('autoLock')}
                value={userData.preferences.autoLock}
              />
            </View>
          </View>
        </Animated.View>
        
        {/* Account Actions */}
        <Animated.View
          style={[
            styles.sectionContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: translateY }]
            }
          ]}
        >
          <View style={styles.sectionHeader}>
            <Feather name="settings" size={20} color="#4a7fee" />
            <Text style={styles.sectionTitle}>Account</Text>
          </View>
          
          <View style={styles.card}>
            <TouchableOpacity style={styles.actionButton}>
              <Feather name="lock" size={20} color="#4a7fee" />
              <Text style={styles.actionButtonText}>Change Password</Text>
              <Feather name="chevron-right" size={20} color="#999" />
            </TouchableOpacity>
            
            <View style={styles.divider} />
            
            <TouchableOpacity style={styles.actionButton}>
              <Feather name="help-circle" size={20} color="#4a7fee" />
              <Text style={styles.actionButtonText}>Help & Support</Text>
              <Feather name="chevron-right" size={20} color="#999" />
            </TouchableOpacity>
            
            <View style={styles.divider} />
            
            <TouchableOpacity style={styles.actionButton}>
              <Feather name="file-text" size={20} color="#4a7fee" />
              <Text style={styles.actionButtonText}>Privacy Policy</Text>
              <Feather name="chevron-right" size={20} color="#999" />
            </TouchableOpacity>
            
            <View style={styles.divider} />
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={handleLogout}
            >
              <Feather name="log-out" size={20} color="#ff3b30" />
              <Text style={[styles.actionButtonText, styles.logoutText]}>Logout</Text>
              <Feather name="chevron-right" size={20} color="#999" />
            </TouchableOpacity>
          </View>
        </Animated.View>
      </ScrollView>
      
      {/* Edit Field Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={editModalVisible}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit {editField}</Text>
              <TouchableOpacity 
                onPress={() => setEditModalVisible(false)}
                style={styles.modalCloseButton}
              >
                <Feather name="x" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            <TextInput
              style={styles.modalInput}
              value={editValue}
              onChangeText={setEditValue}
              placeholder={`Enter your ${editField}`}
              autoCapitalize={editField === 'email' ? 'none' : 'words'}
              keyboardType={editField === 'email' ? 'email-address' : editField === 'phone' ? 'phone-pad' : 'default'}
            />
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.modalCancelButton}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.modalSaveButton}
                onPress={saveEdit}
              >
                <Text style={styles.modalSaveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fd',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#4a7fee',
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
    backgroundColor: '#4a7fee',
    marginBottom: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: '#4a7fee',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  profileImageContainer: {
    position: 'relative',
    marginBottom: 15,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#fff',
  },
  profileImagePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  profileInitials: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#4a7fee',
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  profileEmail: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 15,
  },
  editProfileButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  editProfileText: {
    color: '#fff',
    fontWeight: '500',
  },
  sectionContainer: {
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  lastInfoRow: {
    borderBottomWidth: 0,
  },
  infoLabelContainer: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 15,
    color: '#666',
  },
  infoValueContainer: {
    flex: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoValue: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  editButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  preferenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
  },
  preferenceInfo: {
    flex: 1,
    paddingRight: 10,
  },
  preferenceName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  preferenceDescription: {
    fontSize: 13,
    color: '#777',
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginHorizontal: 15,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  actionButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginLeft: 12,
  },
  logoutText: {
    color: '#ff3b30',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalCloseButton: {
    padding: 5,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modalCancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    marginRight: 10,
  },
  modalCancelButtonText: {
    color: '#666',
    fontWeight: '500',
    fontSize: 16,
  },
  modalSaveButton: {
    backgroundColor: '#4a7fee',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  modalSaveButtonText: {
    color: '#fff',
    fontWeight: '500',
    fontSize: 16,
  },
});
