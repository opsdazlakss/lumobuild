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
  const lastMentionCountRef = useRef({});

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
            lastSeen: data.lastSeen
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

  // Load user's servers with real-time updates
  useEffect(() => {
    if (!currentUser) {
      setServers([]);
      setCurrentServer(null);
      return;
    }

    // Listen to user document for server list changes and unread mentions
    const userUnsub = onSnapshot(doc(db, 'users', currentUser.uid), (userDoc) => {
      if (!userDoc.exists()) return;

      const userData = userDoc.data();
      const serverIds = userData?.servers || [];
      const mentions = userData?.unreadMentions || {};

      // Update unread mentions and check for new ones
      Object.keys(mentions).forEach(serverId => {
        const oldCount = lastMentionCountRef.current[serverId] || 0;
        const newCount = mentions[serverId]?.count || 0;
        
        // Play sound for new mentions in OTHER servers (not current)
        if (newCount > oldCount && serverId !== currentServer) {
          playNotificationSound();
        }
      });
      
      // Update last counts
      lastMentionCountRef.current = Object.fromEntries(
        Object.entries(mentions).map(([id, data]) => [id, data.count])
      );
      
      setUnreadMentions(mentions);

      if (serverIds.length === 0) {
        setServers([]);
        setCurrentServer(null);
        return;
      }

      // Batch fetch servers (no continuous listeners - fetch only when server list changes)
      const fetchServers = async () => {
        const serversData = [];
        for (let i = 0; i < serverIds.length; i += 10) {
          const batch = serverIds.slice(i, i + 10);
          const serversQuery = query(
            collection(db, 'servers'),
            where('__name__', 'in', batch)
          );
          const serversSnapshot = await getDocs(serversQuery);
          
          serversSnapshot.forEach((serverDoc) => {
            serversData.push({ id: serverDoc.id, ...serverDoc.data() });
          });
        }
        setServers(serversData);
      };

      fetchServers();

      // ONLY set current server if it's not already set or if current server is not in the list
      setCurrentServer(prev => {
        const firestoreCurrentServer = userData?.currentServer;
        
        // If Firestore has a different currentServer (e.g., user just joined a new server), use it
        if (firestoreCurrentServer && serverIds.includes(firestoreCurrentServer) && firestoreCurrentServer !== prev) {
          return firestoreCurrentServer;
        }
        
        // If no previous server, use lastServer or first server
        if (!prev) {
          if (firestoreCurrentServer && serverIds.includes(firestoreCurrentServer)) {
            return firestoreCurrentServer;
          }
          return serverIds[0];
        }
        
        // If previous server is still in the list, keep it
        if (serverIds.includes(prev)) {
          return prev;
        }
        
        // Previous server was removed, switch to first available
        return serverIds[0];
      });
    });

    return userUnsub;
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
    unreadMentions,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};
