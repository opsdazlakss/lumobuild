import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';

/**
 * Hook to request Android permissions at app startup.
 * This triggers the browser's permission prompts which will work
 * now that MainActivity.java properly handles WebView permissions.
 * 
 * Returns permission status object for UI feedback if needed.
 */
export const useAndroidPermissions = () => {
  const [permissionStatus, setPermissionStatus] = useState({
    camera: 'unknown',
    microphone: 'unknown',
    notifications: 'unknown'
  });

  useEffect(() => {
    // Only run on Android native platform
    if (Capacitor.getPlatform() !== 'android') return;

    const requestPermissions = async () => {
      console.log('[AndroidPermissions] Requesting permissions on Android startup...');
      
      // Request camera + microphone via getUserMedia
      // This will trigger the Android permission dialog via MainActivity's WebChromeClient
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: true 
        });
        // Stop the stream immediately - we just needed to trigger the permission
        stream.getTracks().forEach(track => track.stop());
        
        setPermissionStatus(prev => ({
          ...prev,
          camera: 'granted',
          microphone: 'granted'
        }));
        console.log('[AndroidPermissions] Camera and microphone permissions granted');
      } catch (err) {
        console.log('[AndroidPermissions] Camera/microphone permission result:', err.name);
        if (err.name === 'NotAllowedError') {
          setPermissionStatus(prev => ({
            ...prev,
            camera: 'denied',
            microphone: 'denied'
          }));
        }
      }

      // Request notification permission via the Notification API
      if ('Notification' in window && Notification.permission === 'default') {
        try {
          const result = await Notification.requestPermission();
          setPermissionStatus(prev => ({
            ...prev,
            notifications: result
          }));
          console.log('[AndroidPermissions] Notification permission:', result);
        } catch (err) {
          console.log('[AndroidPermissions] Notification permission error:', err);
        }
      }
    };

    // Small delay to ensure the app is fully loaded
    const timer = setTimeout(requestPermissions, 1000);
    
    return () => clearTimeout(timer);
  }, []);

  return permissionStatus;
};

export default useAndroidPermissions;
