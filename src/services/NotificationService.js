import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { doc, setDoc, arrayUnion } from 'firebase/firestore';
import { db } from './firebase';

const NotificationService = {
  initialize: async (userId) => {
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

    // Listeners
    PushNotifications.addListener('registration', async (token) => {
      console.log('Push Registration Token:', token.value);
      
      // Save token to Firestore if userId is provided
      if (userId) {
        try {
          console.log(`Attempting to save token for user: ${userId}`);
          const userRef = doc(db, 'users', userId);
          // Use setDoc with merge: true to ensure document exists
          await setDoc(userRef, {
            fcmTokens: arrayUnion(token.value)
          }, { merge: true });
          console.log('✅ FCM token saved to Firestore successfully');
        } catch (error) {
          console.error('❌ Error saving FCM token to Firestore:', error);
        }
      } else {
        console.warn('⚠️ No userId provided during registration. Token not saved to Firestore.');
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

  // Helper to remove listener (optional)
  cleanup: async () => {
    if (!Capacitor.isNativePlatform()) return;
    await PushNotifications.removeAllListeners();
  }
};

export default NotificationService;
