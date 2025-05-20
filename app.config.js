module.exports = {
  name: "MobileCom",
  slug: "mobilecom",
  version: "1.0.0",
  extra: {
    // Set any additional app configuration here
    eas: {
      projectId: "8202525d-146f-4361-b700-21c8d41557c9"
    }
  },
  plugins: [
    "expo-camera"
  ],
  // Add a scheme for linking
  scheme: "mobilecom",
  // Update the router root path configuration
  // Using the actual path relative to project root
  experiments: {
    tsconfigPaths: true,
  },
  // Set as a string without using an environment variable
  root: "./Mobilecom",
  android: {
    package: "com.yourcompany.mobilecom" // <-- Change this to your unique package name
  }
};
