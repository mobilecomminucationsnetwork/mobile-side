import React, { useEffect, useState } from 'react';
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
  PanResponder
} from 'react-native';
import { router } from 'expo-router';
import { MaterialIcons, Ionicons, Feather } from '@expo/vector-icons';
import { useAuth } from './context/AuthContext';

const { width } = Dimensions.get('window');

export default function Dashboard() {
  const { userData, logout } = useAuth();
  const userName = userData?.name || "User"; // Get name from auth context
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const translateY = React.useRef(new Animated.Value(30)).current;
  
  // Last access state
  const [lastAccess, setLastAccess] = useState(null);
  const [loadingAccess, setLoadingAccess] = useState(true);
  
  // Door control state
  const [doorOpen, setDoorOpen] = useState(false);
  const [doorActionLoading, setDoorActionLoading] = useState(false);
  const slideAnim = React.useRef(new Animated.Value(0)).current;
  const doorAnim = React.useRef(new Animated.Value(0)).current;
  
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
  
  // Control the door opening/closing animation
  useEffect(() => {
    if (doorActionLoading) return;
    
    Animated.timing(doorAnim, {
      toValue: doorOpen ? 1 : 0,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [doorOpen, doorActionLoading]);
  
  // Pan responder for the slider
  const panResponder = React.useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !doorActionLoading,
      onMoveShouldSetPanResponder: () => !doorActionLoading,
      onPanResponderGrant: () => {},
      onPanResponderMove: (_, gestureState) => {
        const newValue = doorOpen ? 
          Math.max(0, Math.min(1, 1 - (gestureState.dx / 200))) :
          Math.max(0, Math.min(1, gestureState.dx / 200));
        slideAnim.setValue(newValue);
      },
      onPanResponderRelease: (_, gestureState) => {
        if ((doorOpen && gestureState.dx > 100) || (!doorOpen && gestureState.dx > 100)) {
          toggleDoor();
        } else {
          // Reset position
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: false,
          }).start();
        }
      },
    })
  ).current;
  
  // Toggle door state (open/close)
  const toggleDoor = () => {
    if (doorActionLoading) return;
    
    setDoorActionLoading(true);
    
    // Animate the slider during the "loading" state
    Animated.timing(slideAnim, {
      toValue: doorOpen ? 0 : 1,
      duration: 300,
      useNativeDriver: false,
    }).start();
    
    // Simulate API call to control the door
    setTimeout(() => {
      setDoorOpen(prevState => !prevState);
      setDoorActionLoading(false);
      
      // Reset slider position
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }, 1500);
  };

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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#4a7fee" />
      
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
        
        <View style={styles.statusBadge}>
          <View style={styles.statusIndicator} />
          <Text style={styles.statusText}>Door System Active</Text>
        </View>
      </View>
      
      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
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
                      transform: [{
                        translateX: doorAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, -80]
                        })
                      }]
                    }
                  ]}
                >
                  <View style={styles.doorHandle} />
                </Animated.View>
              </View>
              
              <View style={styles.doorStatusBadge}>
                <View style={[styles.statusDot, doorOpen ? styles.statusDotOpen : styles.statusDotClosed]} />
                <Text style={styles.doorStatusLabel}>
                  {doorActionLoading ? 'Processing...' : (doorOpen ? 'Door Open' : 'Door Closed')}
                </Text>
              </View>
            </View>
            
            {/* Enhanced slider control */}
            <View style={styles.sliderContainer}>
              <Text style={styles.sliderInstructions}>
                {doorOpen ? 'Slide to close door' : 'Slide to open door'}
              </Text>
              
              <View style={styles.sliderTrack}>
                <Animated.View 
                  style={[
                    styles.sliderFill,
                    {
                      width: slideAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%']
                      }),
                      backgroundColor: doorOpen ? '#ff5e5e' : '#4ced69'
                    }
                  ]}
                />
                
                <Animated.View 
                  {...panResponder.panHandlers}
                  style={[
                    styles.sliderThumb,
                    {
                      transform: [{
                        translateX: slideAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, 220]
                        })
                      }]
                    }
                  ]}
                >
                  {doorActionLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Feather
                      name={doorOpen ? "arrow-left" : "arrow-right"}
                      size={20}
                      color="#fff"
                    />
                  )}
                </Animated.View>
              </View>
            </View>
            
            {/* Door access quick stats */}
            <View style={styles.quickStatsContainer}>
              <View style={styles.quickStatItem}>
                <Text style={styles.quickStatValue}>Today</Text>
                <Text style={styles.quickStatLabel}>Last Opened</Text>
              </View>
              
              <View style={styles.quickStatDivider} />
              
              <View style={styles.quickStatItem}>
                <Text style={styles.quickStatValue}>3</Text>
                <Text style={styles.quickStatLabel}>Access Count</Text>
              </View>
              
              <View style={styles.quickStatDivider} />
              
              <View style={styles.quickStatItem}>
                <Text style={styles.quickStatValue}>2 min</Text>
                <Text style={styles.quickStatLabel}>Open Duration</Text>
              </View>
            </View>
          </View>
        </Animated.View>
        
        <Animated.View 
          style={[
            styles.overviewContainer, 
            {
              opacity: fadeAnim,
              transform: [{ translateY: translateY }]
            }
          ]}
        >
          <View style={styles.glassCard}>
            <View style={styles.glassCardContent}>
              <View style={styles.securityStatus}>
                <View style={styles.securityIconContainer}>
                  <Ionicons name="shield-checkmark" size={30} color="#fff" />
                </View>
                <View>
                  <Text style={styles.securityStatusTitle}>System Status</Text>
                  <Text style={styles.securityStatusValue}>Protected</Text>
                </View>
              </View>
              
              <View style={styles.statusDivider} />
              
              <View style={styles.lastActivity}>
                <TouchableOpacity 
                  style={styles.activityIconContainer}
                  onPress={fetchLastAccess}
                  disabled={loadingAccess}
                >
                  {loadingAccess ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="time-outline" size={20} color="#fff" />
                  )}
                </TouchableOpacity>
                <View style={{flex: 1}}>
                  <View style={styles.lastAccessHeader}>
                    <Text style={styles.lastActivityLabel}>Last Access</Text>
                    {!loadingAccess && (
                      <TouchableOpacity onPress={fetchLastAccess} style={styles.refreshButton}>
                        <Feather name="refresh-cw" size={14} color="#666" />
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={[
                    styles.lastActivityTime, 
                    !lastAccess && styles.noAccessText
                  ]}>
                    {loadingAccess ? 'Loading...' : formatAccessTime(lastAccess)}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </Animated.View>
        
        <View style={styles.sectionTitle}>
          <Feather name="grid" size={20} color="#555" />
          <Text style={styles.sectionTitleText}>Quick Access</Text>
        </View>
        
        <View style={styles.cardGrid}>
          <Animated.View 
            style={[
              { opacity: fadeAnim, transform: [{ translateY: translateY }] }
            ]}
          >
            <TouchableOpacity 
              style={styles.actionCard}
              activeOpacity={0.8}
              onPress={() => router.push('/photo-registration')}
            >
              <View style={[styles.cardGradient, styles.blueCard]}>
                <View style={styles.faceRecognitionIconEnhanced}>
                  <Feather name="camera" size={30} color="#fff" />
                </View>
                <View style={styles.cardContentExpanded}>
                  <Text style={styles.enhancedCardTitle}>Register Face</Text>
                  <Text 
                    style={styles.enhancedCardDescription}
                    numberOfLines={3}
                    ellipsizeMode="tail"
                  >
                    Add your facial biometrics to the door security system
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          </Animated.View>
          
          <Animated.View 
            style={[
              { opacity: fadeAnim, transform: [{ translateY: translateY }] }
            ]}
          >
            <TouchableOpacity
              style={styles.securityCard}
              activeOpacity={0.8}
            >
              <View style={[styles.cardGradient, styles.orangeCard]}>
                <View style={styles.cardIconContainer}>
                  <Feather name="shield" size={26} color="#fff" />
                </View>
                <View style={styles.securityInfoContent}>
                  <Text style={styles.enhancedCardTitle}>Security Info</Text>
                  <Text 
                    style={styles.enhancedCardDescription} 
                    numberOfLines={2}
                    ellipsizeMode="tail"
                  >
                    View your security details and access settings
                  </Text>
                </View>
                <View style={styles.enhancedMetricsRow}>
                  <View style={styles.enhancedMetric}>
                    <Text style={styles.metricValue}>24/7</Text>
                    <Text style={styles.metricLabel}>Monitoring</Text>
                  </View>
                  <View style={styles.metricDivider} />
                  <View style={styles.enhancedMetric}>
                    <Text style={styles.metricValue}>100%</Text>
                    <Text style={styles.metricLabel}>Uptime</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          </Animated.View>
        </View>
        
        <View style={styles.sectionTitle}>
          <Feather name="clock" size={20} color="#555" />
          <Text style={styles.sectionTitleText}>Recent Activity</Text>
        </View>
        
        <Animated.View 
          style={[
            styles.activityContainer,
            { opacity: fadeAnim, transform: [{ translateY: translateY }] }
          ]}
        >
          <View style={styles.activityCard}>
            <View style={styles.emptyActivity}>
              <Ionicons name="document-text-outline" size={50} color="#ccc" />
              <Text style={styles.emptyActivityText}>No recent activities</Text>
              <Text style={styles.emptyActivitySubtext}>
                Activity logs will appear here when you start using the door system
              </Text>
            </View>
          </View>
        </Animated.View>
      </ScrollView>
      
      <View style={styles.fabContainer}>
        <TouchableOpacity style={styles.fab}>
          <MaterialIcons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
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
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginTop: 20,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ced69',
    marginRight: 6,
  },
  statusText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  content: {
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
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    shadowColor: 'rgba(0, 0, 0, 0.2)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
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
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.03)',
  },
  doorControlHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  doorIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#4a7fee',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    shadowColor: '#4a7fee',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  doorTitleContainer: {
    flex: 1,
  },
  doorControlTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  doorControlSubtitle: {
    fontSize: 13,
    color: '#666',
  },
  // Door visualization
  doorVisualContainer: {
    alignItems: 'center',
    marginBottom: 25,
  },
  doorFrame: {
    width: 120,
    height: 140,
    backgroundColor: '#e0e0e0',
    borderWidth: 8,
    borderColor: '#d0d0d0',
    borderRadius: 8,
    overflow: 'hidden',
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginBottom: 15,
  },
  doorPanel: {
    width: 115, // Slightly less than frame to show gap
    height: 134,
    backgroundColor: '#4a7fee',
    borderWidth: 4,
    borderColor: '#3a6fde',
    borderRadius: 4,
    position: 'relative',
  },
  doorHandle: {
    position: 'absolute',
    right: 10,
    top: '50%',
    width: 10,
    height: 30,
    backgroundColor: '#ffcc00',
    borderRadius: 5,
    transform: [{ translateY: -15 }],
  },
  doorStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusDotOpen: {
    backgroundColor: '#4ced69',
  },
  statusDotClosed: {
    backgroundColor: '#ff5e5e',
  },
  doorStatusLabel: {
    fontWeight: '600',
    fontSize: 14,
    color: '#444',
  },
  // Slider styles
  sliderContainer: {
    marginBottom: 20,
  },
  sliderInstructions: {
    textAlign: 'center',
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  sliderTrack: {
    height: 60,
    backgroundColor: '#f0f0f0',
    borderRadius: 30,
    overflow: 'hidden',
    position: 'relative',
  },
  sliderFill: {
    position: 'absolute',
    height: '100%',
    borderRadius: 30,
    opacity: 0.3,
  },
  sliderThumb: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#4a7fee',
    margin: 5,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  // Quick stats
  quickStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#f8f9fd',
    borderRadius: 12,
    padding: 15,
    marginTop: 5,
  },
  quickStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  quickStatValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  quickStatLabel: {
    fontSize: 12,
    color: '#777',
  },
  quickStatDivider: {
    width: 1,
    height: '80%',
    alignSelf: 'center',
    backgroundColor: '#e0e0e0',
    marginHorizontal: 10,
  },
});