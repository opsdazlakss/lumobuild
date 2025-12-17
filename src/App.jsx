import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import { ToastProvider } from './context/ToastContext';
import { LoginPage } from './components/auth/LoginPage';
import { RegisterPage } from './components/auth/RegisterPage';
import { ResetPasswordPage } from './components/auth/ResetPasswordPage';
import { MainApp } from './pages/MainApp';

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
          <CallProvider>
            <VoiceRoomWrapper>
               <MainApp />
            </VoiceRoomWrapper>
          </CallProvider>
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

import { useEffect } from 'react';
import NotificationService from './services/NotificationService';
import { ErrorBoundary } from './components/shared/ErrorBoundary';

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

// Inner component to use CallContext for Voice Room Overlay/Mount
import { useCall, CallProvider } from './context/CallContext';
import { LiveKitVoiceRoom } from './components/server/LiveKitVoiceRoom';
import { db } from './services/firebase'; 
import { cn } from './utils/helpers';
import { MdHorizontalRule } from 'react-icons/md';
import { doc, getDoc } from 'firebase/firestore'; // Import firestore functions

// Wrapper to persist Voice Room across navigation
const VoiceRoomWrapper = ({ children }) => {
  const { activeRoom, leaveVoiceChannel } = useCall();
  const { currentUser } = useAuth(); 
  const [channelInfo, setChannelInfo] = useState(null);
  const [isMinimized, setIsMinimized] = useState(true); // Default logic: Start minimized (background).

  useEffect(() => {
    const handleOpen = () => setIsMinimized(false);
    window.addEventListener('OPEN_VOICE_ROOM', handleOpen);
    return () => window.removeEventListener('OPEN_VOICE_ROOM', handleOpen);
  }, []);

  // Minimize automatically when joining a different channel? 
  // Maybe better to keep open until user minimizes.
  
  useEffect(() => {
      const fetchChannel = async () => {
          if (!activeRoom) {
              setChannelInfo(null);
              // Do not reset isMinimized here, or reset to TRUE if you want it always minimized on next join.
              // Actually, if we want it to start minimized every time we join:
              setIsMinimized(true);
              return;
          }
          // We just joined (or updated)
          // Ensure it starts minimized?
          // If we want to persist user preference during session, removing the above setIsMinimized(true) is better.
          // BUT user asked "automatically minimized on join".
          // So setting it to true on mount is good, but if component persists, we need to set it here.
          
          try {
             setChannelInfo({ id: activeRoom.channelId }); 
             
             // Force Minimize on Join
             setIsMinimized(true);
          } catch(e) { console.error(e) }
      };
      
      fetchChannel();
  }, [activeRoom]);

  // If minimized, we still render to keep audio alive, but hidden.
  // Or we could render a mini-player (PiP).
  // For now, let's just HIDE IT and rely on Sidebar controls, 
  // effectively "running in background".

  return (
    <>
      {children}
      {activeRoom && currentUser && (
         <div 
            className={cn(
                "fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center transition-all duration-300",
                isMinimized ? "pointer-events-none opacity-0" : "pointer-events-auto opacity-100"
            )}
         >
             <div className="w-full h-full relative">
                 {/* Header Controls for Overlay */}
                 <div className="absolute top-4 right-4 z-[60] flex items-center gap-2">
                     <button 
                        onClick={() => setIsMinimized(true)}
                        className="bg-gray-700/50 hover:bg-gray-600 text-white px-3 py-2 rounded flex items-center gap-2 backdrop-blur-sm"
                     >
                        <MdHorizontalRule size={20} />
                        <span className="text-sm">Minimize</span>
                     </button>
                     <button 
                        onClick={leaveVoiceChannel} 
                        className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 backdrop-blur-sm shadow-lg"
                     >
                        Disconnect
                     </button>
                 </div>

                 <LiveKitVoiceRoom 
                    channel={channelInfo || { id: activeRoom.channelId }} 
                    serverId={activeRoom.serverId}
                    user={currentUser}
                    onDisconnect={leaveVoiceChannel}
                 />
             </div>
         </div>
      )}
    </>
  );
};

export default App;
