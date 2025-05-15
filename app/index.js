import { StyleSheet, Text, View, TouchableOpacity, ImageBackground, SafeAreaView, StatusBar } from "react-native";
import { Link } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";

export default function Page() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ImageBackground
        source={{ uri: "https://images.unsplash.com/photo-1558402529-d2638a7023e9?q=80&w=1000" }}
        style={styles.backgroundImage}
        imageStyle={{ opacity: 0.6 }}
      >
        <View style={styles.overlay} />
        
        <View style={styles.main}>
          <View style={styles.headerContainer}>
            <MaterialIcons name="lock" size={50} color="#ffffff" />
            <Text style={styles.title}>Smart Door Lock System</Text>
            <Text style={styles.subtitle}>Secure access with facial recognition</Text>
          </View>
          
          <View style={styles.buttonContainer}>
            <Link href="/login" asChild>
              <TouchableOpacity style={styles.loginButton}>
                <MaterialIcons name="login" size={24} color="#ffffff" />
                <Text style={styles.buttonText}>Login</Text>
              </TouchableOpacity>
            </Link>
            
            <View style={styles.separator}>
              <View style={styles.line} />
              <Text style={styles.separatorText}>New User?</Text>
              <View style={styles.line} />
            </View>
            
            <Link href="/register" asChild>
              <TouchableOpacity style={styles.registerButton}>
                <MaterialIcons name="person-add" size={24} color="#ffffff" />
                <Text style={styles.buttonText}>Register Account</Text>
              </TouchableOpacity>
            </Link>
          </View>
          
          <View style={styles.footer}>
            <Text style={styles.footerText}>Smart Security Solutions</Text>
          </View>
        </View>
      </ImageBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundImage: {
    flex: 1,
    justifyContent: "center",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },
  main: {
    flex: 1,
    justifyContent: "space-between",
    padding: 24,
  },
  headerContainer: {
    alignItems: "center",
    marginTop: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#ffffff",
    textAlign: "center",
    marginTop: 20,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 18,
    color: "#e0e0e0",
    textAlign: "center",
    marginTop: 10,
    fontWeight: "300",
  },
  buttonContainer: {
    width: "100%",
    alignSelf: "center",
    maxWidth: 340,
  },
  loginButton: {
    backgroundColor: "#4a90e2",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: "center",
    marginVertical: 8,
    flexDirection: "row",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  registerButton: {
    backgroundColor: "#34c759",
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: "center",
    marginVertical: 8,
    flexDirection: "row",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
    borderWidth: 1,
    borderColor: "#2da44a",
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 10,
  },
  separator: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
  },
  separatorText: {
    color: "#ffffff",
    fontSize: 16,
    paddingHorizontal: 10,
    fontWeight: "500",
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
  },
  footer: {
    alignItems: "center",
    marginBottom: 20,
  },
  footerText: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 14,
  },
});
