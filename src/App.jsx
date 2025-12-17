import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { ToastProvider } from './context/ToastContext';
import { LoginPage } from './components/auth/LoginPage';
import { RegisterPage } from './components/auth/RegisterPage';
import { ResetPasswordPage } from './components/auth/ResetPasswordPage';
import { MainApp } from './pages/MainApp';
import NotificationService from './services/NotificationService';
import { ErrorBoundary } from './components/shared/ErrorBoundary';

function AuthRouter() {
  const { currentUser, userProfile, loading } = useAuth();
  const [authView, setAuthView] = useState('login');

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
  // AuthContext is provided below, so we cannot use it here.
  // NotificationWrapper inside AuthProvider will handle the logic.
  return (
    <ToastProvider>
      <ErrorBoundary>
        <AuthProvider>
          <NotificationWrapper>
             <AuthRouter />
          </NotificationWrapper>
        </AuthProvider>
      </ErrorBoundary>
    </ToastProvider>
  );
}

// Inner component to use existing AuthContext
const NotificationWrapper = ({ children }) => {
  const { currentUser } = useAuth();

  useEffect(() => {
    // Initialize notifications when the app mounts
    // We pass currentUser?.uid so it can save the token if logged in.
    // If not logged in, it might just register without saving to a user doc yet.
    NotificationService.initialize(currentUser?.uid);
  }, [currentUser]);

  return children;
};

export default App;
