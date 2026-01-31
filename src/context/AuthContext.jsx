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
    await updatePresence(userCredential.user.uid, true);
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
        // Native mobile: use Capacitor GoogleAuth plugin
        console.log('[GoogleAuth] Starting native sign-in...');
        const googleUser = await GoogleAuth.signIn();
        console.log('[GoogleAuth] Got Google user:', JSON.stringify(googleUser, null, 2));
        const credential = GoogleAuthProvider.credential(googleUser.authentication.idToken);
        console.log('[GoogleAuth] Created Firebase credential, signing in...');
        userCredential = await signInWithCredential(auth, credential);
        console.log('[GoogleAuth] Firebase sign-in successful!');
      } else {
        // Web: use Firebase popup
        const provider = new GoogleAuthProvider();
        userCredential = await signInWithPopup(auth, provider);
      }
      
      // Check if user profile exists, if not create it
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      if (!userDoc.exists()) {
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          displayName: userCredential.user.displayName,
          email: userCredential.user.email,
          photoURL: userCredential.user.photoURL,
          role: 'member',
          createdAt: serverTimestamp(),
          isOnline: true,
          lastSeen: serverTimestamp(),
          isUsernameSet: false
        });
      } else {
        // Update presence for existing user
        await updatePresence(userCredential.user.uid, true);
      }
      
      return userCredential;
    } catch (error) {
      console.error('[GoogleAuth] ERROR:', error);
      console.error('[GoogleAuth] Error code:', error.code);
      console.error('[GoogleAuth] Error message:', error.message);
      console.error('[GoogleAuth] Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
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
