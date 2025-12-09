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
    if (!currentServer) {
      setUsers([]);
      return;
    }

    let intervalId;
    let presenceUnsubscribes = [];

    const fetchUsers = async () => {
      try {
        // Fetch member list
        const membersRef = collection(db, 'servers', currentServer, 'members');
        const membersSnapshot = await getDocs(membersRef);
        
        const memberIds = [];
        const memberRoles = new Map();
        
        membersSnapshot.forEach((doc) => {
          const userId = doc.data().userId;
          memberIds.push(userId);
          memberRoles.set(userId, doc.data().role || 'member');
        });

        if (memberIds.length === 0) {
          setUsers([]);
          return;
        }

        // Batch fetch users (Firestore 'in' query supports max 10 items)
        const usersData = [];
        for (let i = 0; i < memberIds.length; i += 10) {
          const batch = memberIds.slice(i, i + 10);
          const usersQuery = query(
            collection(db, 'users'),
            where('__name__', 'in', batch)
          );
          const usersSnapshot = await getDocs(usersQuery);
          
          usersSnapshot.forEach((userDoc) => {
            usersData.push({
              id: userDoc.id,
              ...userDoc.data(),
              serverRole: memberRoles.get(userDoc.id) || 'member'
            });
          });
        }

        setUsers(usersData);

        // Setup lightweight presence-only listeners for real-time status updates
        // Clear old listeners first
        presenceUnsubscribes.forEach(unsub => unsub());
        presenceUnsubscribes = [];

        memberIds.forEach((userId) => {
          const unsub = onSnapshot(doc(db, 'users', userId), (userDoc) => {
            if (userDoc.exists()) {
              const userData = userDoc.data();
              // Only update presence field to minimize re-renders
              setUsers(prev => prev.map(user => 
                user.id === userId 
                  ? { ...user, presence: userData.presence }
                  : user
              ));
            }
          });
          presenceUnsubscribes.push(unsub);
        });

      } catch (error) {
        console.error('Error fetching users:', error);
      }
    };

    // Initial fetch
    fetchUsers();

    // Refresh every 60 seconds (for profile changes like displayName, photo)
    intervalId = setInterval(fetchUsers, 60000);

    return () => {
      if (intervalId) clearInterval(intervalId);
      presenceUnsubscribes.forEach(unsub => unsub());
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
