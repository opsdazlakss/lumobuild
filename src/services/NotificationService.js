import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { doc, setDoc, arrayUnion } from 'firebase/firestore';
import { db } from './firebase';

const NotificationService = {
  // State to track token and user
  _token: null,
  _userId: null,

  initialize: async (userId) => {
    NotificationService._userId = userId;

    // Only run on native platforms
    if (!Capacitor.isNativePlatform()) {
      console.log('Push notifications not supported on web/PWA');
      return;
    }

    // Check permissions
    let permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      console.error('User denied permissions!');
      return;
    }

    // Register with Apple / Google to get token 'registration'
    await PushNotifications.register();

    // If we already have a token and user, try to save again (idempotent)
    if (NotificationService._token && NotificationService._userId) {
      NotificationService.saveToken(NotificationService._token, NotificationService._userId);
    }

    // Listeners
    // Check if listener already added to prevent duplicates logic if initialize called multiple times
    // (Though App.jsx handles cleanup, safety check doesn't hurt, but for now we rely on cleanup)
    
    PushNotifications.removeAllListeners(); // Ensure clean slate before adding
    
    PushNotifications.addListener('registration', async (token) => {
      console.log('Push Registration Token:', token.value);
      NotificationService._token = token.value;
      
      if (NotificationService._userId) {
        NotificationService.saveToken(token.value, NotificationService._userId);
      } else {
        console.log('Token received but no user logged in yet. Will save when user logs in.');
      }
    });

    PushNotifications.addListener('registrationError', (error) => {
      console.error('Error on registration:', error);
    });

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('Push notification received: ', notification);
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      console.log('Push notification action performed', notification.actionId, notification.inputValue);
    });
  },

  saveToken: async (token, userId) => {
    try {
      console.log(`Attempting to save token for user: ${userId}`);
      const userRef = doc(db, 'users', userId);
      await setDoc(userRef, {
        fcmTokens: arrayUnion(token)
      }, { merge: true });
      console.log('✅ FCM token saved to Firestore successfully');
    } catch (error) {
      console.error('❌ Error saving FCM token to Firestore:', error);
    }
  },

  // Helper to remove listener (optional)
  cleanup: async () => {
    if (!Capacitor.isNativePlatform()) return;
    await PushNotifications.removeAllListeners();
  }
};

export default NotificationService;
