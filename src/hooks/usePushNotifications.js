import { useEffect } from 'react';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { db } from '../services/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';

export const usePushNotifications = () => {
  const { currentUser } = useAuth();

  useEffect(() => {
    let registrationListener;
    let errorListener;
    let receivedListener;
    let actionListener;

    if (Capacitor.getPlatform() !== 'web' && currentUser) {
      const startRegistration = async () => {
        console.log('PushNotifications hook: Initializing for user', currentUser.uid);
        
        let permStatus = await PushNotifications.checkPermissions();

        if (permStatus.receive === 'prompt') {
          permStatus = await PushNotifications.requestPermissions();
        }

        if (permStatus.receive !== 'granted') {
          console.warn('PushNotifications hook: User denied permissions!');
          return;
        }

        // Add listeners BEFORE registering
        registrationListener = await PushNotifications.addListener('registration', async (token) => {
          console.log('Push registration success, token: ' + token.value);
          try {
            const userRef = doc(db, 'users', currentUser.uid);
            await setDoc(userRef, {
              fcmTokens: token.value
            }, { merge: true });
            console.log('FCM Token saved to Firestore for user:', currentUser.uid);
          } catch (err) {
            console.error('Error saving FCM token to Firestore:', err);
          }
        });

        errorListener = await PushNotifications.addListener('registrationError', (error) => {
          console.error('Error on registration: ' + JSON.stringify(error));
        });

        receivedListener = await PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('Push received: ' + JSON.stringify(notification));
        });

        actionListener = await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
          console.log('Push action performed: ' + JSON.stringify(notification));
        });

        console.log('PushNotifications hook: Requesting registration...');
        await PushNotifications.register();
      };

      startRegistration();
    }

    return () => {
      if (registrationListener) registrationListener.remove();
      if (errorListener) errorListener.remove();
      if (receivedListener) receivedListener.remove();
      if (actionListener) actionListener.remove();
    };
  }, [currentUser]);
};
