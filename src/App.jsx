import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { ToastProvider } from './context/ToastContext';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import { usePushNotifications } from './hooks/usePushNotifications';
import { LoginPage } from './components/auth/LoginPage';
import { RegisterPage } from './components/auth/RegisterPage';
import { ResetPasswordPage } from './components/auth/ResetPasswordPage';

import { MainApp } from './pages/MainApp';
import { UsernameSetupScreen } from './components/auth/UsernameSetupScreen';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from './services/firebase';

function AuthRouter() {
  const { currentUser, userProfile, loading } = useAuth();
  usePushNotifications();
  
  const [isSSOProcessing, setIsSSOProcessing] = useState(() => {
    return !!new URLSearchParams(window.location.search).get('sso_code');
  });
  const [authView, setAuthView] = useState('login');

  // Handle SSO login from URL parameter
  // SSO akışı kısmını bulun ve değiştirin (yaklaşık 27-85. satırlar arası)

useEffect(() => {
  const handleSSO = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const ssoCode = urlParams.get('sso_code');

    // If processing stopped and user logged in, we're done
    if (isSSOProcessing && currentUser && !ssoCode) {
      setIsSSOProcessing(false);
      return;
    }

    if (ssoCode) {
      if (currentUser) {
        // Already logged in, clear param
        window.history.replaceState({}, document.title, window.location.pathname);
        setIsSSOProcessing(false);
        return;
      }

      console.log('🔐 SSO Code detected, exchanging...');
      setIsSSOProcessing(true);
      
      try {
        // Clear query param immediately
        window.history.replaceState({}, document.title, window.location.pathname);
        
        const API_BASE = 'https://lumobuild.vercel.app'; 
        
        const response = await fetch(`${API_BASE}/api/sso/exchange`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: ssoCode })
        });

        const data = await response.json();
        if (!data.success) throw new Error(data.error || 'Exchange failed');

        console.log('✅ SSO Exchange successful');
        console.log('Is new user?', data.isNewUser);

        // ⚠️ DEĞİŞİKLİK: Sadece signInWithCustomToken yeterli
        // Backend (exchange.js) zaten Firestore'u halletti
        await signInWithCustomToken(auth, data.customToken);
        console.log('✅ User signed in successfully');
        
      } catch (err) {
        console.error('❌ SSO Error:', err);
        alert('SSO Login Failed: ' + err.message);
        setIsSSOProcessing(false);
      }
    }
  };

  handleSSO();
}, [currentUser, isSSOProcessing]);

  if (loading || isSSOProcessing) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="text-dark-text text-xl mb-4">
            {isSSOProcessing ? 'Logging in with Lumo...' : 'Loading...'}
          </div>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
        </div>
      </div>
    );
  }

  // Check if user is banned
  if (currentUser && userProfile?.isBanned) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4">
        <div className="bg-dark-sidebar p-8 rounded-xl max-w-md w-full text-center border border-admin">
          <div className="text-6xl mb-4">🚫</div>
          <h1 className="text-2xl font-bold text-dark-text mb-2">Account Banned</h1>
          <p className="text-dark-muted mb-6">
            Your account has been banned from this server. Please contact an administrator if you believe this is a mistake.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-hover transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }

  // Force Username Setup
  if (currentUser && userProfile && userProfile.isUsernameSet === false) {
    console.log('[AuthRouter] Redirecting to UsernameSetupScreen');
    return <UsernameSetupScreen />;
  }

  if (currentUser && !userProfile) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="text-dark-text text-xl">Loading Profile...</div>
      </div>
    );
  }

  if (currentUser) {
    return (
      <DataProvider>
        <MainApp />
      </DataProvider>
    );
  }

  return (
    <>
      {authView === 'login' && (
        <LoginPage
          onSwitchToRegister={() => setAuthView('register')}
          onSwitchToReset={() => setAuthView('reset')}
        />
      )}
      {authView === 'register' && (
        <RegisterPage onSwitchToLogin={() => setAuthView('login')} />
      )}
      {authView === 'reset' && (
        <ResetPasswordPage onSwitchToLogin={() => setAuthView('login')} />
      )}
    </>
  );
}

function App() {
  return (
    <ToastProvider>
      <ErrorBoundary>
        <AuthProvider>
          <AuthRouter />
        </AuthProvider>
      </ErrorBoundary>
    </ToastProvider>
  );
}

export default App;