import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from './firebase';

let currentCachedToken = null;
let currentUserId = null;
let isInitialized = false;
let lastError = null;

const NotificationService = {
  initialize: async (userId) => {
    currentUserId = userId;

    if (!Capacitor.isNativePlatform()) {
      console.log('Push notifications not supported on web/PWA');
      return;
    }

    // If already initialized and we just got a user ID, sync the cached token
    if (isInitialized) {
      console.log('[FCM] Service already initialized. Current Token:', currentCachedToken ? 'HIDDEN' : 'NONE');
      if (currentUserId && currentCachedToken) {
        syncTokenWithFirestore(currentCachedToken);
      }
      return;
    }

    console.log('[FCM] Initializing service...');

    // Check permissions
    let permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      const msg = 'User denied push notification permissions!';
      console.error('[FCM]', msg);
      lastError = msg;
      return;
    }

    // Register with Apple / Google to get token 'registration'
    try {
      await PushNotifications.register();
      console.log('[FCM] Registration request sent');
    } catch (e) {
      console.error('[FCM] Registration call failed:', e);
      lastError = `Registration failed: ${e.message}`;
    }

    // Listeners
    PushNotifications.addListener('registration', (token) => {
      console.log('[FCM] Registration successful. Token length:', token.value.length);
      currentCachedToken = token.value;
      lastError = null;
      
      if (currentUserId) {
        syncTokenWithFirestore(token.value);
      }
    });

    PushNotifications.addListener('registrationError', (error) => {
      console.error('[FCM] Registration error event:', error);
      lastError = `FCM Error: ${error.error}`;
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
  },

  getRegistrationError: () => {
    return lastError;
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
