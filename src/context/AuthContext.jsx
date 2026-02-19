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

  // useEffect: Auth state listener

  useEffect(() => {
    let unsubscribeProfile = null;
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      setCurrentUser(user);

      if (user) {
        // ⚠️ SSO SYNC TAMAMEN KALDIRILDI - Backend halledecek
        
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
    }, { merge: true });

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

  const isSSO = sessionStorage.getItem('loginMethod') === 'sso';

  const logout = async () => {
    sessionStorage.removeItem('loginMethod');
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

      // Profil eksikse oluştur/onar (updatePresence minimal doc oluşturmuş olabilir)
      const existingData = userDoc.exists() ? userDoc.data() : {};
      const isProfileIncomplete = !userDoc.exists() || !existingData.email || !existingData.displayName;

      if (isProfileIncomplete) {
        console.log('[Auth] Profile missing or incomplete. Creating/repairing...');
        
        // Benzersiz displayName (sadece yeni atanacaksa kontrol et)
        let uniqueDisplayName = existingData.displayName || user.displayName || `User#${Math.floor(1000 + Math.random() * 9000)}`;
        
        if (!existingData.displayName) {
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
        }

        // ✅ Profil oluştur/onar — mevcut role ve servers KORUNUR
        await setDoc(userDocRef, {
          displayName: uniqueDisplayName,
          email: user.email,
          photoUrl: user.photoURL,
          role: existingData.role || 'member',
          createdAt: existingData.createdAt || serverTimestamp(),
          isOnline: true,
          lastSeen: serverTimestamp(),
          isUsernameSet: existingData.isUsernameSet !== undefined ? existingData.isUsernameSet : true,
          servers: existingData.servers || []
        }, { merge: true });
        
        console.log('[Auth] ✅ Profile created/repaired:', uniqueDisplayName);

      } else {
        // ✅ Tam profili olan mevcut kullanıcı — sadece presence güncelle
        console.log('[Auth] Existing user login, updating presence only...');
        const updates = {
           isOnline: true,
           lastSeen: serverTimestamp()
        };
        
        if (existingData.isUsernameSet === undefined && existingData.displayName) {
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
    isSSO,
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