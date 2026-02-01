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
  signInWithCredential,
  updateProfile // ← EKLENDI (SSO için)
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

  // ===== YENI: SSO USER PROFILE SYNC =====
  // When a user signs in via SSO (signInWithCustomToken),
  // we need to sync their profile to Firestore
  const syncSSOUserProfile = async (user) => {
    if (!user) return;

    try {
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);

      // Get name and photo from Firebase Auth profile
      // (These were set by exchange.js after custom token sign-in)
      const displayName = user.displayName || user.email?.split('@')[0] || 'User';
      const photoUrl = user.photoURL || null;
      const email = user.email;

      console.log('[SSO Sync] User data:', { email, displayName, photoUrl });

      // Check if profile is incomplete or new
      const isIncomplete = !userDoc.exists() || !userDoc.data()?.email || !userDoc.data()?.role;

      if (isIncomplete) {
        console.log('[SSO Sync] Creating/repairing Firestore profile...');
        
        // Ensure unique displayName
        let uniqueDisplayName = displayName;
        
        if (displayName) {
          const usersRef = collection(db, 'users');
          const q = query(usersRef, where('displayName', '==', displayName));
          const snapshot = await getDocs(q);
          
          let taken = false;
          snapshot.forEach(doc => {
            if (doc.id !== user.uid) taken = true;
          });

          if (taken) {
            const randomSuffix = Math.floor(1000 + Math.random() * 9000);
            uniqueDisplayName = `${displayName}#${randomSuffix}`;
          }
        }

        // Create complete profile
        await setDoc(userDocRef, {
          displayName: uniqueDisplayName,
          email: email,
          photoUrl: photoUrl,
          role: 'member',
          createdAt: userDoc.data()?.createdAt || serverTimestamp(),
          isOnline: true,
          lastSeen: serverTimestamp(),
          isUsernameSet: true,
          servers: userDoc.data()?.servers || []
        }, { merge: true });

        console.log('[SSO Sync] ✅ Firestore profile created:', uniqueDisplayName);

      } else {
        // Existing user - just update presence and photo if changed
        console.log('[SSO Sync] Updating existing user...');
        
        const updates = {
          isOnline: true,
          lastSeen: serverTimestamp()
        };

        // Update photo/name if they changed (from mobile app sync)
        if (photoUrl && photoUrl !== userDoc.data()?.photoUrl) {
          updates.photoUrl = photoUrl;
        }
        
        if (displayName && displayName !== userDoc.data()?.displayName) {
          // Only update if not taken
          const usersRef = collection(db, 'users');
          const q = query(usersRef, where('displayName', '==', displayName));
          const snapshot = await getDocs(q);
          let taken = false;
          snapshot.forEach(doc => {
            if (doc.id !== user.uid) taken = true;
          });
          if (!taken) {
            updates.displayName = displayName;
          }
        }

        // Auto-fix missing isUsernameSet flag
        if (userDoc.data()?.isUsernameSet === undefined && userDoc.data()?.displayName) {
          updates.isUsernameSet = true;
        }

        await setDoc(userDocRef, updates, { merge: true });
        console.log('[SSO Sync] ✅ Profile updated');
      }

    } catch (error) {
      console.error('[SSO Sync] Error:', error);
    }
  };
  // ===== END SSO SYNC =====

  // useEffect içindeki SSO sync kısmını değiştir:

useEffect(() => {
  let unsubscribeProfile = null;
  const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
    if (unsubscribeProfile) {
      unsubscribeProfile();
      unsubscribeProfile = null;
    }

    setCurrentUser(user);

    if (user) {
      // Check if user came from SSO
      const tokenResult = await user.getIdTokenResult();
      const isSSO = tokenResult.claims?.sso === true;
      const isNewUser = tokenResult.claims?.isNewUser === true;

      // ⚠️ SADECE YENİ SSO KULLANICILARI İÇİN FIRESTORE SYNC YAP
      if (isSSO && isNewUser) {
        console.log('[AuthContext] New SSO user detected, syncing Firestore...');
        await syncSSOUserProfile(user);
      } else if (isSSO) {
        console.log('[AuthContext] Existing SSO user, skipping profile sync');
      }

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
        console.log('[AuthContext] Final presence update skipped or failed during logout');
      }
    }
    return signOut(auth);
  };

  const signInWithGoogle = async () => {
    let userCredential;
    
    try {
      if (Capacitor.isNativePlatform()) {
        console.log('[GoogleAuth] Starting native sign-in...');
        const googleUser = await GoogleAuth.signIn();
        const credential = GoogleAuthProvider.credential(googleUser.authentication.idToken);
        userCredential = await signInWithCredential(auth, credential);
      } else {
        const provider = new GoogleAuthProvider();
        userCredential = await signInWithPopup(auth, provider);
      }
      
      const user = userCredential.user;
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);

      const isIncomplete = !userDoc.exists() || !userDoc.data()?.email || !userDoc.data()?.role;

      if (isIncomplete) {
        console.log('[Auth] Profile incomplete or new. Creating/Repairing...');
        
        let uniqueDisplayName = userDoc.data()?.displayName || user.displayName;
        
        if (!uniqueDisplayName || uniqueDisplayName === user.displayName) {
             if (uniqueDisplayName) {
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

        await setDoc(userDocRef, {
          displayName: uniqueDisplayName,
          email: user.email,
          photoUrl: user.photoURL,
          role: 'member',
          createdAt: userDoc.data()?.createdAt || serverTimestamp(),
          isOnline: true,
          lastSeen: serverTimestamp(),
          isUsernameSet: true,
          servers: userDoc.data()?.servers || []
        }, { merge: true });
        
        console.log('User profile created/repaired:', uniqueDisplayName);

      } else {
        const updates = {
           isOnline: true,
           lastSeen: serverTimestamp()
        };
        
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