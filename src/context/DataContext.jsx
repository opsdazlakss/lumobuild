import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { collection, getDocs, onSnapshot, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { playNotificationSound } from '../utils/notificationSound';
import { useAuth } from './AuthContext';

const DataContext = createContext();

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within DataProvider');
  }
  return context;
};

export const DataProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [servers, setServers] = useState([]);
  const [currentServer, setCurrentServer] = useState(null);
  const [channels, setChannels] = useState([]);
  const [server, setServer] = useState(null);
  const [unreadMentions, setUnreadMentions] = useState({});
  const [dms, setDms] = useState([]);
  const lastMentionCountRef = useRef({});
  const isDmInitialLoad = useRef(true);

  // Load server members with batched fetching (optimized for quota)
  useEffect(() => {
    // Reset users immediately when switching servers to prevent duplication
    setUsers([]);

    if (!currentServer) {
      return;
    }

    let intervalId;
    let presenceUnsubscribes = [];

    // Real-time listener for server members
    // This allows us to detect new members immediately without re-fetching everyone
    const membersUnsub = onSnapshot(
      collection(db, 'servers', currentServer, 'members'),
      async (snapshot) => {
        // Handle changes efficiently
        const newMemberIds = [];
        const removedMemberIds = [];
        const updatedRoles = new Map();

        snapshot.docChanges().forEach((change) => {
          const memberData = change.doc.data();
          if (change.type === 'added') {
            newMemberIds.push(memberData.userId);
            updatedRoles.set(memberData.userId, memberData.role);
          }
          if (change.type === 'removed') {
            removedMemberIds.push(memberData.userId);
          }
          if (change.type === 'modified') {
             // For role updates, we just update the local state without fetching user doc
             updatedRoles.set(memberData.userId, memberData.role);
          }
        });

        // If this is the initial load (from scratch)
        if (users.length === 0 && newMemberIds.length > 0) {
           // Fetch all initial users in batches
           const initialMemberRoles = new Map();
           snapshot.docs.forEach(doc => {
             initialMemberRoles.set(doc.data().userId, doc.data().role || 'member');
           });
           
           const allMemberIds = Array.from(initialMemberRoles.keys());
           const newUsersData = [];
           
           for (let i = 0; i < allMemberIds.length; i += 10) {
            const batch = allMemberIds.slice(i, i + 10);
            const usersQuery = query(
              collection(db, 'users'),
              where('__name__', 'in', batch)
            );
            const usersSnapshot = await getDocs(usersQuery);
            usersSnapshot.forEach((userDoc) => {
              newUsersData.push({
                id: userDoc.id,
                ...userDoc.data(),
                serverRole: initialMemberRoles.get(userDoc.id)
              });
            });
          }
          setUsers(newUsersData);
          return;
        }

        // Handle incremental updates (New member joined)
        if (newMemberIds.length > 0 && users.length > 0) {
           // Only fetch the NEW users
           const newUsersData = [];
           for (let i = 0; i < newMemberIds.length; i += 10) {
            const batch = newMemberIds.slice(i, i + 10);
            const usersQuery = query(
              collection(db, 'users'),
              where('__name__', 'in', batch)
            );
            const usersSnapshot = await getDocs(usersQuery);
            usersSnapshot.forEach((userDoc) => {
              newUsersData.push({
                id: userDoc.id,
                ...userDoc.data(),
                serverRole: updatedRoles.get(userDoc.id)
              });
            });
          }
          setUsers(prev => [...prev, ...newUsersData]);
        }
        
        // Handle removed members
        if (removedMemberIds.length > 0) {
          setUsers(prev => prev.filter(u => !removedMemberIds.includes(u.id)));
        }

        // Handle role updates
        if (snapshot.docChanges().some(c => c.type === 'modified')) {
           setUsers(prev => prev.map(u => {
             if (updatedRoles.has(u.id)) {
               return { ...u, serverRole: updatedRoles.get(u.id) };
             }
             return u;
           }));
        }
      }
    );

    // Setup lightweight presence-only listeners for real-time status updates OFFLINE/ONLINE
    // Listen for Online users (Single query)
    const onlineUsersQuery = query(
      collection(db, 'users'),
      where('servers', 'array-contains', currentServer),
      where('isOnline', '==', true)
    );

    const presenceUnsub = onSnapshot(onlineUsersQuery, (snapshot) => {
      setUsers(prevUsers => {
        const onlineDataMap = new Map();
        snapshot.forEach(doc => {
          const data = doc.data();
          onlineDataMap.set(doc.id, {
            presence: data.presence,
            isOnline: data.isOnline,
            status: data.status,
            lastSeen: data.lastSeen,
            // Also update profile data in real-time for online users
            displayName: data.displayName,
            photoUrl: data.photoUrl || data.photoURL,
            bio: data.bio
          });
        });

        // Map over existing users in state and update their presence info
        return prevUsers.map(user => {
          const onlineData = onlineDataMap.get(user.id);
          if (onlineData) {
             return { ...user, ...onlineData };
          } else {
             // If not in the online query snapshot, set them as offline
             // But keep their profile data!
             return { 
               ...user, 
               isOnline: false, 
               presence: 'offline',
               status: null 
             };
          }
        });
      });
    });

    return () => {
      if (intervalId) clearInterval(intervalId);
      membersUnsub();
      presenceUnsub();
    };
  }, [currentServer]);

  // State to track user's server IDs for the subscription effect
  const [myServerIds, setMyServerIds] = useState([]);

  // Load user's servers with real-time updates
  useEffect(() => {
    if (!currentUser) {
      setServers([]);
      setCurrentServer(null);
      setMyServerIds([]);
      return;
    }

    // Listen to user document for server list changes and unread mentions
    const userUnsub = onSnapshot(doc(db, 'users', currentUser.uid), (userDoc) => {
      if (!userDoc.exists()) return;

      const userData = userDoc.data();
      const serverIds = userData?.servers || [];
      const mentions = userData?.unreadMentions || {};

      // Update unread mentions...
      Object.keys(mentions).forEach(serverId => {
        const oldCount = lastMentionCountRef.current[serverId] || 0;
        const newCount = mentions[serverId]?.count || 0;
        
        if (newCount > oldCount && serverId !== currentServer) {
          playNotificationSound();
        }
      });
      
      lastMentionCountRef.current = Object.fromEntries(
        Object.entries(mentions).map(([id, data]) => [id, data.count])
      );
      
      setUnreadMentions(mentions);

      // Update the server IDs state to trigger the subscription effect
      // Only update if IDs actually changed to avoid re-subscribing
      setMyServerIds(prev => {
          if (JSON.stringify(prev) !== JSON.stringify(serverIds)) {
              return serverIds;
          }
          return prev;
      });

      // Maintain current server logic
      setCurrentServer(prev => {
        const firestoreCurrentServer = userData?.currentServer;
        
        // Initial load
        if (!prev) {
          if (firestoreCurrentServer && (firestoreCurrentServer === 'home' || serverIds.includes(firestoreCurrentServer))) {
            return firestoreCurrentServer;
          }
          return serverIds.length > 0 ? serverIds[0] : 'home';
        }
        
        // Validate current selection
        if (prev === 'home' || serverIds.includes(prev)) {
          return prev;
        }
        
        // Fallback if current server invalid (e.g. kicked)
        return serverIds.length > 0 ? serverIds[0] : 'home';
      });
    });

    return userUnsub;
  }, [currentUser]);

  // Dedicated effect for subscribing to server documents
  useEffect(() => {
    // 1. Clean up stale servers immediately
    setServers(prev => prev.filter(s => myServerIds.includes(s.id)));

    if (myServerIds.length === 0) {
        setServers([]);
        return;
    }

    const unsubscribers = [];

    // Batch listen to servers
    for (let i = 0; i < myServerIds.length; i += 10) {
        const batch = myServerIds.slice(i, i + 10);
        const serversQuery = query(
        collection(db, 'servers'),
        where('__name__', 'in', batch)
        );
        
        const unsub = onSnapshot(serversQuery, (snapshot) => {
            const batchData = [];
            snapshot.forEach((serverDoc) => {
                batchData.push({ id: serverDoc.id, ...serverDoc.data() });
            });
            
            setServers(prev => {
                const otherServers = prev.filter(s => !batch.includes(s.id));
                const newServers = [...otherServers, ...batchData];
                // Sort by original ID order
                return newServers.sort((a,b) => {
                    return myServerIds.indexOf(a.id) - myServerIds.indexOf(b.id);
                });
            });
        });
        unsubscribers.push(unsub);
    }

    return () => {
        unsubscribers.forEach(unsub => unsub());
    };
  }, [myServerIds]);

  // Subscribe to user's DMs
  useEffect(() => {
    if (!currentUser) {
      setDms([]);
      return;
    }
    
    isDmInitialLoad.current = true;

    const q = query(
      collection(db, 'dms'),
      where('participants', 'array-contains', currentUser.uid)
      // Note: Ordering requires a composite index, doing client-side sort for now
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dmsData = [];
      snapshot.forEach((doc) => {
        dmsData.push({ id: doc.id, ...doc.data() });
      });
      // Sort by updatedAt desc
      dmsData.sort((a, b) => {
        const timeA = a.updatedAt?.toMillis() || 0;
        const timeB = b.updatedAt?.toMillis() || 0;
        return timeB - timeA;
      });
      setDms(dmsData);

      // Notification Sound Logic
      if (!isDmInitialLoad.current) {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'modified' || change.type === 'added') {
            const data = change.doc.data();
            // If last message update is recent and from someone else
            if (data.lastMessage && data.lastMessage.userId !== currentUser.uid) {
              const now = Date.now();
              const msgTime = data.lastMessage.timestamp?.toMillis() || 0;
              // Only notify if message is less than 30 seconds old (prevents old stale updates)
              if (now - msgTime < 30000) {
                 playNotificationSound();
              }
            }
          }
        });
      }
      isDmInitialLoad.current = false;
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Update current server object and listen to channels
  useEffect(() => {
    if (!currentServer) {
      setChannels([]);
      setServer(null);
      return;
    }

    // Get server from servers array (already fetched in previous effect)
    const currentServerData = servers.find(s => s.id === currentServer);
    setServer(currentServerData || null);

    // Listen to channels (keep real-time for channel changes)
    const channelsUnsub = onSnapshot(
      collection(db, 'servers', currentServer, 'channels'),
      (snapshot) => {
        const channelsData = [];
        snapshot.forEach((doc) => {
          channelsData.push({ id: doc.id, ...doc.data() });
        });
        setChannels(channelsData.sort((a, b) => a.position - b.position));
      }
    );

    return () => {
      channelsUnsub();
    };
  }, [currentServer, servers]);

  const value = {
    users,
    servers,
    currentServer,
    setCurrentServer,
    channels,
    server,
    dms,
    unreadMentions,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};
