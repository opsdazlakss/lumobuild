import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from './firebase';

let currentCachedToken = null;
let currentUserId = null;
let isInitialized = false;

const NotificationService = {
  initialize: async (userId) => {
    currentUserId = userId;

    if (!Capacitor.isNativePlatform()) {
      console.log('Push notifications not supported on web/PWA');
      return;
    }

    // If already initialized and we just got a user ID, sync the cached token
    if (isInitialized) {
      if (currentUserId && currentCachedToken) {
        syncTokenWithFirestore(currentCachedToken);
      }
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
    PushNotifications.addListener('registration', (token) => {
      console.log('Push Registration Token:', token.value);
      currentCachedToken = token.value;
      
      if (currentUserId) {
        syncTokenWithFirestore(token.value);
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

    isInitialized = true;
  },

  // Helper to remove listener (optional)
  cleanup: async () => {
    if (!Capacitor.isNativePlatform()) return;
    await PushNotifications.removeAllListeners();
    isInitialized = false;
  },

  getToken: () => {
    return currentCachedToken;
  }
};

async function syncTokenWithFirestore(token) {
  if (!currentUserId) return;
  
  try {
    const userRef = doc(db, 'users', currentUserId);
    await updateDoc(userRef, {
      fcmTokens: arrayUnion(token)
    });
    console.log('FCM token automatically synced to Firestore');
  } catch (error) {
    // If document doesn't exist yet, it might fail, but that's expected during initial reg
    console.error('Error syncing FCM token to Firestore:', error);
  }
}

export default NotificationService;
