import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.hasan.lumo',
  appName: 'Lumo',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#111111",
      showSpinner: false,
      androidScaleType: "FIT_CENTER",
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;
