import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { ToastProvider } from './context/ToastContext';
import { LoginPage } from './components/auth/LoginPage';
import { RegisterPage } from './components/auth/RegisterPage';
import { ResetPasswordPage } from './components/auth/ResetPasswordPage';
import { SSOTestPage } from './pages/SSOTestPage';
import { SSOLoginPage } from './pages/SSOLoginPage';
import { MainApp } from './pages/MainApp';

function AuthRouter() {
  const { currentUser, userProfile, loading } = useAuth();
  usePushNotifications();
  const [authView, setAuthView] = useState('login');

  // Handle SSO login from URL parameter
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const ssoToken = urlParams.get('sso') || urlParams.get('sso_token');
    if (ssoToken && !currentUser) {
      setAuthView('sso-login');
    }
  }, [currentUser]);

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="text-dark-text text-xl">Loading...</div>
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
          onSwitchToSSOTest={() => setAuthView('sso-test')}
        />
      )}
      {authView === 'register' && (
        <RegisterPage onSwitchToLogin={() => setAuthView('login')} />
      )}
      {authView === 'reset' && (
        <ResetPasswordPage onSwitchToLogin={() => setAuthView('login')} />
      )}
      {authView === 'sso-test' && (
        <SSOTestPage onBack={() => setAuthView('login')} />
      )}
      {authView === 'sso-login' && (
        <SSOLoginPage onBackToLogin={() => setAuthView('login')} />
      )}
    </>
  );
}

import { useEffect } from 'react';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import { usePushNotifications } from './hooks/usePushNotifications';

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
