import { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../services/firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail,
  onAuthStateChanged 
} from 'firebase/auth';
import { doc, setDoc, getDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Update presence with isOnline flag
  const updatePresence = async (userId, isOnline = true) => {
    if (!userId) return;
    try {
      await setDoc(doc(db, 'users', userId), {
        isOnline: isOnline,
        lastSeen: serverTimestamp()
      }, { merge: true });
    } catch (err) {
      console.error('Presence update failed:', err);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);

      if (user) {
        // Listen to user profile
        const unsubscribeProfile = onSnapshot(
          doc(db, 'users', user.uid),
          (doc) => {
            if (doc.exists()) {
              setUserProfile({ id: doc.id, ...doc.data() });
            }
          }
        );

        // Update presence immediately
        await updatePresence(user.uid);

        // Update presence every 2 minutes while user is active
        const presenceInterval = setInterval(() => {
          updatePresence(user.uid);
        }, 2 * 60 * 1000); // 2 minutes

        // Update presence before page close
        const handleBeforeUnload = () => {
          // Use sendBeacon for reliable delivery on page close
          const userRef = doc(db, 'users', user.uid);
          navigator.sendBeacon(
            `https://firestore.googleapis.com/v1/projects/${import.meta.env.VITE_FIREBASE_PROJECT_ID}/databases/(default)/documents/users/${user.uid}`,
            JSON.stringify({
              fields: {
                lastSeen: { timestampValue: new Date().toISOString() }
              }
            })
          );
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        
        setLoading(false);

        return () => {
          unsubscribeProfile();
          clearInterval(presenceInterval);
          window.removeEventListener('beforeunload', handleBeforeUnload);
        };
      } else {
        setUserProfile(null);
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const register = async (email, password, displayName) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    
    await setDoc(doc(db, 'users', userCredential.user.uid), {
      displayName: displayName,
      email: email,
      role: 'member',
      createdAt: serverTimestamp(),
      isOnline: true,
      lastSeen: serverTimestamp(),
    });

    return userCredential;
  };

  const login = async (email, password) => {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    await updatePresence(userCredential.user.uid, true);
    return userCredential;
  };

  const logout = async () => {
    if (currentUser) {
      // Set offline before logout
      try {
        await updatePresence(currentUser.uid, false);
      } catch (err) {
        console.log('Final presence update failed (expected):', err.code);
      }
    }
    return signOut(auth);
  };

  const resetPassword = (email) => {
    return sendPasswordResetEmail(auth, email);
  };

  const value = {
    currentUser,
    userProfile,
    register,
    login,
    logout,
    resetPassword,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
