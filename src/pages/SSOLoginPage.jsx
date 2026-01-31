import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { signInWithCustomToken } from 'firebase/auth';
import { db, auth } from '../services/firebase';
import { useAuth } from '../context/AuthContext';

export const SSOLoginPage = ({ onBackToLogin }) => {
  const { currentUser } = useAuth();
  // ... existing state ...

  // ... existing useEffect ...

  const handleSSOLogin = async (tokenParam) => {
    try {
      setStatus('processing');
      
      const urlParams = new URLSearchParams(window.location.search);
      const isGoogleToken = urlParams.get('sso_token'); 
      
      let customToken = tokenParam;
      
      if (isGoogleToken) {
        console.log('🔍 Exchanging Google ID token for custom token...');
        const response = await fetch('https://lumobuild.vercel.app/api/sso-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ googleIdToken: tokenParam })
        });

        const data = await response.json();
        if (!data.success) throw new Error(data.message || 'Failed to exchange token');

        customToken = data.customToken;
        console.log('✅ Custom token received from backend');
      }
      
      console.log('🔐 Logging in with custom token...');
      
      const userCredential = await signInWithCustomToken(auth, customToken);
      console.log('✅ SSO Login successful:', userCredential.user.email);

      // --- NEW: Create User Profile in Firestore if missing ---
      const userDocRef = doc(db, 'users', userCredential.user.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
          console.log('Creating new user profile for SSO user...');
          await setDoc(userDocRef, {
              displayName: userCredential.user.displayName || 'User', // Fallback
              email: userCredential.user.email || null,
              photoURL: userCredential.user.photoURL || null,
              role: 'member',
              createdAt: serverTimestamp(),
              isOnline: true,
              lastSeen: serverTimestamp(),
              isUsernameSet: false // Force username setup!
          });
      } else {
          // Update existing user presence
          await setDoc(userDocRef, {
              isOnline: true,
              lastSeen: serverTimestamp()
          }, { merge: true });
      }
      // -------------------------------------------------------
      
      setStatus('success');
      
      setTimeout(() => {
        window.location.reload();
      }, 1500);
      
    } catch (err) {
      // ... existing error handling ...
      console.error('❌ SSO Login failed:', err);
      setStatus('error');
      
      if (err.code === 'auth/invalid-custom-token') {
        setError('Invalid or expired token. Please try again.');
      } else if (err.code === 'auth/network-request-failed') {
        setError('Network error. Please check your connection.');
      } else {
        setError(err.message || 'Login failed. Please try again.');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-bg p-4">
      <div className="max-w-md w-full bg-dark-sidebar rounded-lg shadow-2xl p-8">
        <div className="text-center">
          {status === 'processing' && (
            <>
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-brand-primary mx-auto mb-4"></div>
              <h2 className="text-2xl font-bold text-dark-text mb-2">
                Logging you in...
              </h2>
              <p className="text-dark-muted">
                Please wait while we verify your credentials
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="text-6xl mb-4">✅</div>
              <h2 className="text-2xl font-bold text-green-500 mb-2">
                Welcome to Lumo!
              </h2>
              <p className="text-dark-muted">
                Redirecting to your dashboard...
              </p>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="text-6xl mb-4">❌</div>
              <h2 className="text-2xl font-bold text-red-500 mb-2">
                Login Failed
              </h2>
              <p className="text-dark-text mb-4">{error}</p>
              <button
                onClick={() => navigate('/login')}
                className="bg-brand-primary hover:bg-brand-primary/80 text-white font-medium py-2 px-6 rounded-md transition-colors"
              >
                Go to Login
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
