import { useEffect, useRef } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';

const HEARTBEAT_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * usePresence hook - Sends periodic heartbeat updates to Firestore
 * to indicate the user is still active. Other clients calculate
 * online status by checking if lastSeen is within the last 5 minutes.
 */
export const usePresence = (userId) => {
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!userId) return;

    const updatePresence = async () => {
      try {
        await setDoc(doc(db, 'users', userId), {
          lastSeen: serverTimestamp(),
          isOnline: true // Still set this for backwards compatibility
        }, { merge: true });
      } catch (err) {
        console.error('Error updating presence:', err);
      }
    };

    // Send initial heartbeat immediately
    updatePresence();

    // Set up interval for periodic heartbeats
    intervalRef.current = setInterval(updatePresence, HEARTBEAT_INTERVAL);

    // Cleanup on unmount or logout
    const handleBeforeUnload = () => {
      // Best effort - try to mark as offline before leaving
      // Note: This may not always work due to browser limitations
      navigator.sendBeacon && updatePresence(); // Just update timestamp, client-side will calculate offline
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [userId]);
};

/**
 * Utility function to check if a user is online based on lastSeen timestamp.
 * Used by UserList and other components to determine online status.
 * @param {Timestamp} lastSeen - Firestore timestamp
 * @param {number} thresholdMinutes - Minutes of inactivity before considered offline (default: 6)
 * @returns {boolean} - True if user is considered online
 */
export const isUserOnline = (lastSeen, thresholdMinutes = 6) => {
  if (!lastSeen) return false;
  
  // Handle both Firestore Timestamp and JS Date
  const lastSeenMs = lastSeen.toMillis ? lastSeen.toMillis() : new Date(lastSeen).getTime();
  const now = Date.now();
  const thresholdMs = thresholdMinutes * 60 * 1000;
  
  return (now - lastSeenMs) < thresholdMs;
};
