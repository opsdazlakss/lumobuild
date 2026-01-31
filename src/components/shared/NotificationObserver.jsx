import { useEffect, useRef } from 'react';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';

export const NotificationObserver = () => {
  const { unreadMentions, unreadDms } = useData();
  const { userProfile } = useAuth();
  const { info } = useToast();
  
  // Refs to track previous counts to detect INCREASES
  const prevMentionsRef = useRef({});
  const prevDmsRef = useRef({});
  const hasMounted = useRef(false);

  // Request Desktop Permission on Mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const shouldNotify = () => {
    // Check user settings (default to true if setting doesn't exist)
    return userProfile?.settings?.notificationsEnabled !== false;
  };

  const sendNotification = (title, body) => {
    if (!shouldNotify()) return;

    // 1. In-App Toast
    info(`${title}: ${body}`);

    // 2. Desktop Notification (if invisible or requested)
    if ('Notification' in window && Notification.permission === 'granted') {
       if (document.hidden) { // Only show desktop if app is not focused? Or always? User asked for "like existing windows notification".
          new Notification(title, {
             body: body,
             icon: '/icon.png' // Ensure this exists or use valid path
          });
       } else {
          // Even if focused, user asked for "bottom right UI notification" (Toast covers this)
          // AND "windows notification" (Desktop Notification).
          // We can do both.
           new Notification(title, {
             body: body,
             icon: '/icon.png'
          });
       }
    }
  };

  useEffect(() => {
    if (!hasMounted.current) {
        // Initialize refs on first mount to avoid blasting notifications for existing unreads
        prevMentionsRef.current = unreadMentions || {};
        prevDmsRef.current = unreadDms || {};
        hasMounted.current = true;
        return;
    }

    // Check Mentions
    if (unreadMentions) {
        Object.keys(unreadMentions).forEach(serverId => {
            const oldCount = prevMentionsRef.current[serverId]?.count || 0;
            const newCount = unreadMentions[serverId]?.count || 0;
            
            if (newCount > oldCount) {
                // New mention!
                // We'd ideally want the sender name, but unreadMentions might only store count/lastId
                // We can just say "New Mention" for now.
                sendNotification('New Mention', 'You were mentioned in a channel.');
            }
        });
        prevMentionsRef.current = unreadMentions;
    }

    // Check DMs
    if (unreadDms) {
        Object.keys(unreadDms).forEach(dmId => {
             const oldCount = prevDmsRef.current[dmId]?.count || 0;
             const newCount = unreadDms[dmId]?.count || 0;

             if (newCount > oldCount) {
                 sendNotification('New Message', 'You received a direct message.');
             }
        });
        prevDmsRef.current = unreadDms;
    }

  }, [unreadMentions, unreadDms]);

  return null; // Headless component
};
