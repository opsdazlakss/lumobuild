import { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../services/firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail,
  onAuthStateChanged,
  sendEmailVerification,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCredential
} from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { doc, setDoc, getDoc, onSnapshot, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';

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
    let unsubscribeProfile = null;
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      // Clean up previous profile listener if any
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      setCurrentUser(user);

      if (user) {
        // Listen to user profile
        unsubscribeProfile = onSnapshot(
          doc(db, 'users', user.uid),
          (doc) => {
            if (doc.exists()) {
              setUserProfile({ id: doc.id, ...doc.data() });
            }
          },
          (err) => console.error('[AuthContext] Profile listener error:', err)
        );

        // Update presence immediately
        updatePresence(user.uid).catch(() => {});
        
        setLoading(false);
      } else {
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const register = async (email, password, displayName) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    
    // Send verification email
    try {
        await sendEmailVerification(userCredential.user);
    } catch (e) {
        console.error("Error sending verification email:", e);
    }

    await setDoc(doc(db, 'users', userCredential.user.uid), {
      displayName: displayName,
      email: email,
      role: 'member',
      createdAt: serverTimestamp(),
      isOnline: true,
      lastSeen: serverTimestamp(),
      isUsernameSet: true
    });

    return userCredential;
  };

  const login = async (email, password) => {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    
    // Migration check for email users
    const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
    const updates = {
      isOnline: true,
      lastSeen: serverTimestamp()
    };

    if (userDoc.exists() && userDoc.data()?.isUsernameSet === undefined && userDoc.data()?.displayName) {
      updates.isUsernameSet = true;
    }

    await setDoc(doc(db, 'users', userCredential.user.uid), updates, { merge: true });
    return userCredential;
  };

  const logout = async () => {
    if (currentUser) {
      // Set offline before logout
      try {
        await updatePresence(currentUser.uid, false);
      } catch (err) {
        // This fails often on logout because the token is invalidated, which is fine
        console.log('[AuthContext] Final presence update skipped or failed during logout');
      }
    }
    return signOut(auth);
  };

  const signInWithGoogle = async () => {
    let userCredential;
    
    try {
      if (Capacitor.isNativePlatform()) {
        // Native mobile logic...
        console.log('[GoogleAuth] Starting native sign-in...');
        const googleUser = await GoogleAuth.signIn();
        const credential = GoogleAuthProvider.credential(googleUser.authentication.idToken);
        userCredential = await signInWithCredential(auth, credential);
      } else {
        // Web logic...
        const provider = new GoogleAuthProvider();
        userCredential = await signInWithPopup(auth, provider);
      }
      
      const user = userCredential.user;
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);

      // Self-Healing Logic:
      // Treat as NEW if doc doesn't exist OR if it's missing critical fields (like email).
      // This repairs "broken" accounts that only have { isOnline: true }
      const isIncomplete = !userDoc.exists() || !userDoc.data()?.email || !userDoc.data()?.role;

      if (isIncomplete) {
        console.log('[Auth] Profile incomplete or new. Creating/Repairing...');
        
        let uniqueDisplayName = userDoc.data()?.displayName || user.displayName;
        
        // Ensure uniqueness only if we don't already have a valid name in DB
        // If the DB has a name, we assume it was already uniqueness-checked (or we keep it)
        // But if it's a repair, we might want to check again. 
        // Let's stick to: If we are generating a name from Google Auth, check uniqueness.
        
        if (!uniqueDisplayName || uniqueDisplayName === user.displayName) {
             if (uniqueDisplayName) {
                // Check if taken
                const usersRef = collection(db, 'users');
                const q = query(usersRef, where('displayName', '==', uniqueDisplayName));
                const snapshot = await getDocs(q);
                
                let taken = false;
                snapshot.forEach(doc => {
                    if (doc.id !== user.uid) taken = true;
                });

                if (taken) {
                    const randomSuffix = Math.floor(1000 + Math.random() * 9000); 
                    uniqueDisplayName = `${uniqueDisplayName}#${randomSuffix}`;
                }
            } else {
                 uniqueDisplayName = `User#${Math.floor(1000 + Math.random() * 9000)}`;
            }
        }

        // Create/Repair Full Profile
        await setDoc(userDocRef, {
          displayName: uniqueDisplayName,
          email: user.email,
          photoUrl: user.photoURL,
          role: 'member',
          createdAt: userDoc.data()?.createdAt || serverTimestamp(), // Keep original createdAt if exists
          isOnline: true,
          lastSeen: serverTimestamp(),
          isUsernameSet: true,
          servers: userDoc.data()?.servers || [] // Keep existing servers or init empty
        }, { merge: true });
        
        console.log('User profile created/repaired:', uniqueDisplayName);

      } else {
        // Healthy User Update
        const updates = {
           isOnline: true,
           lastSeen: serverTimestamp()
        };
        
        // Auto-fix missing isUsernameSet flag for legacy users
        if (userDoc.data()?.isUsernameSet === undefined && userDoc.data()?.displayName) {
          updates.isUsernameSet = true;
        }

        await setDoc(userDocRef, updates, { merge: true });
      }
      
      return userCredential;
    } catch (error) {
      console.error('[GoogleAuth] ERROR:', error);
      throw error;
    }
  };

  const resetPassword = (email) => {
    return sendPasswordResetEmail(auth, email);
  };

  const resendVerification = async () => {
      let user = auth.currentUser || currentUser;
      
      if (!user) {
          throw new Error('No user currently signed in.');
      }

      // If missing email, try to reload to get latest state
      if (!user.email) {
          await user.reload();
          user = auth.currentUser;
      }

      if (!user.email) {
          throw new Error('No email associated with this account. Please sign in again.');
      }

      return sendEmailVerification(user);
  };

  const value = {
    currentUser,
    userProfile,
    register,
    login,
    logout,
    signInWithGoogle,
    resetPassword,
    resendVerification,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
