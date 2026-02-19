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

  // Update presence - sadece MEVCUT dokümanları günceller, yeni oluşturmaz
  const updatePresence = async (userId, isOnline = true) => {
    if (!userId) return;
    try {
      const userDocRef = doc(db, 'users', userId);
      const userDocSnap = await getDoc(userDocRef);
      
      // ✅ Sadece doküman varsa güncelle — yoksa oluşturma (profil oluşturmayı signInWithGoogle/exchange.js'e bırak)
      if (userDocSnap.exists()) {
        await setDoc(userDocRef, {
          isOnline: isOnline,
          lastSeen: serverTimestamp()
        }, { merge: true });
      } else {
        console.log('[AuthContext] Skipping presence update - user doc does not exist yet for:', userId);
      }
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

      console.log('[Auth] AUTH_CODE_VERSION: 2.0.46-fix2');
      console.log('[Auth] UID:', user.uid, 'Doc exists:', userDoc.exists(), 
        'email:', userDoc.data()?.email, 'displayName:', userDoc.data()?.displayName);

      if (!userDoc.exists()) {
        // ═══════════════════════════════════════════════════════════════
        // DURUM 1: Doküman hiç yok → Tam profil oluştur
        // ═══════════════════════════════════════════════════════════════
        console.log('[Auth] CASE 1: No doc exists. Creating full profile...');
        
        // Farklı UID'de aynı email ile profil var mı kontrol et
        let migratedData = null;
        if (user.email) {
          const usersRef = collection(db, 'users');
          const emailQuery = query(usersRef, where('email', '==', user.email));
          const emailSnapshot = await getDocs(emailQuery);
          emailSnapshot.forEach(existingDoc => {
            if (existingDoc.id !== user.uid && existingDoc.data()?.displayName) {
              console.log('[Auth] ⚠️ Found profile under different UID:', existingDoc.id);
              migratedData = existingDoc.data();
            }
          });
        }

        const source = migratedData || {};
        let uniqueDisplayName = source.displayName || user.displayName || `User#${Math.floor(1000 + Math.random() * 9000)}`;
        
        if (!source.displayName) {
          const usersRef = collection(db, 'users');
          const q = query(usersRef, where('displayName', '==', uniqueDisplayName));
          const snapshot = await getDocs(q);
          let taken = false;
          snapshot.forEach(d => { if (d.id !== user.uid) taken = true; });
          if (taken) {
            uniqueDisplayName = `${uniqueDisplayName}#${Math.floor(1000 + Math.random() * 9000)}`;
          }
        }

        await setDoc(userDocRef, {
          displayName: uniqueDisplayName,
          email: user.email,
          photoUrl: user.photoURL,
          role: source.role || 'member',
          createdAt: source.createdAt || serverTimestamp(),
          isOnline: true,
          lastSeen: serverTimestamp(),
          isUsernameSet: source.isUsernameSet !== undefined ? source.isUsernameSet : true,
          servers: source.servers || []
        });
        
        console.log('[Auth] ✅ CASE 1 done. New profile created:', uniqueDisplayName);

      } else if (!userDoc.data()?.email || !userDoc.data()?.displayName) {
        // ═══════════════════════════════════════════════════════════════
        // DURUM 2: Doküman var ama eksik (hook'ların oluşturduğu minimal doc)
        // → Sadece EKSİK alanları doldur, mevcut alanlara ASLA dokunma
        // ═══════════════════════════════════════════════════════════════
        console.log('[Auth] CASE 2: Doc exists but incomplete. Filling missing fields ONLY...');
        
        const updates = {
          isOnline: true,
          lastSeen: serverTimestamp()
        };

        // Her alan için: SADECE yoksa ekle
        if (!userDoc.data()?.displayName) {
          let displayName = user.displayName || `User#${Math.floor(1000 + Math.random() * 9000)}`;
          const usersRef = collection(db, 'users');
          const q = query(usersRef, where('displayName', '==', displayName));
          const snapshot = await getDocs(q);
          let taken = false;
          snapshot.forEach(d => { if (d.id !== user.uid) taken = true; });
          if (taken) displayName = `${displayName}#${Math.floor(1000 + Math.random() * 9000)}`;
          updates.displayName = displayName;
        }
        if (!userDoc.data()?.email && user.email) {
          updates.email = user.email;
        }
        if (!userDoc.data()?.photoUrl && user.photoURL) {
          updates.photoUrl = user.photoURL;
        }
        if (!userDoc.data()?.role) {
          updates.role = 'member';
        }
        if (!userDoc.data()?.createdAt) {
          updates.createdAt = serverTimestamp();
        }
        if (userDoc.data()?.isUsernameSet === undefined) {
          updates.isUsernameSet = true;
        }
        if (!userDoc.data()?.servers) {
          updates.servers = [];
        }

        await setDoc(userDocRef, updates, { merge: true });
        console.log('[Auth] ✅ CASE 2 done. Missing fields added:', Object.keys(updates).join(', '));

      } else {
        // ═══════════════════════════════════════════════════════════════
        // DURUM 3: Tam profil var → SADECE isOnline ve lastSeen güncelle
        // ═══════════════════════════════════════════════════════════════
        console.log('[Auth] CASE 3: Complete profile. displayName:', userDoc.data()?.displayName, 
          '| role:', userDoc.data()?.role, 
          '| servers:', userDoc.data()?.servers?.length,
          '| Writing ONLY isOnline + lastSeen.');
        
        await setDoc(userDocRef, {
          isOnline: true,
          lastSeen: serverTimestamp()
        }, { merge: true });
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