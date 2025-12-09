import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../services/firebase';

export const useMentionNotifications = (userId) => {
  const [unreadMentions, setUnreadMentions] = useState(0);

  useEffect(() => {
    if (!userId) return;

    // Listen to all messages that mention this user
    const q = query(
      collection(db, 'channels'),
    );

    // We'll track mentions across all channels
    const channelUnsubscribes = [];
    
    const setupChannelListeners = async () => {
      const channelsSnapshot = await getDocs(collection(db, 'channels'));
      
      channelsSnapshot.forEach((channelDoc) => {
        const messagesRef = collection(db, 'channels', channelDoc.id, 'messages');
        const q = query(messagesRef, where('mentions', 'array-contains', userId));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
          let count = 0;
          snapshot.forEach((doc) => {
            const data = doc.data();
            if (!data.readBy || !data.readBy.includes(userId)) {
              count++;
            }
          });
          setUnreadMentions(count);
        });
        
        channelUnsubscribes.push(unsubscribe);
      });
    };

    setupChannelListeners();

    return () => {
      channelUnsubscribes.forEach(unsub => unsub());
    };
  }, [userId]);

  const markMentionAsRead = async (channelId, messageId) => {
    const messageRef = doc(db, 'channels', channelId, 'messages', messageId);
    await updateDoc(messageRef, {
      readBy: arrayUnion(userId),
    });
  };

  return { unreadMentions, markMentionAsRead };
};
