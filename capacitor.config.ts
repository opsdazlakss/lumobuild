import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.hasan.lumoapp',
  appName: 'Lumo',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#2F2C35",
      showSpinner: false,
      androidScaleType: "CENTER_INSIDE",
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      overlaysWebView: true,
      backgroundColor: "#00000000",
      style: "DARK",
    },
    GoogleAuth: {
      scopes: ["profile", "email"],
      serverClientId: "267697346186-ortie4deqdkbqvrj4q6an18gv8idtnbj.apps.googleusercontent.com",
      forceCodeForRefreshToken: true,
    },
  },
};

export default config;
