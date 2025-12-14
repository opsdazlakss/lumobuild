import { useState, useEffect } from 'react';
import { doc, updateDoc, deleteField, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { Sidebar } from '../components/layout/Sidebar';
import { ServerSwitcher } from '../components/layout/ServerSwitcher';
import { UserList } from '../components/layout/UserList';
import { MessageList } from '../components/chat/MessageList';
import { MessageInput } from '../components/chat/MessageInput';
import { MessageSearch } from '../components/chat/MessageSearch';
import { PinnedMessages } from '../components/chat/PinnedMessages';
import { SettingsModal } from './SettingsModal';
import { AdminPanel } from '../components/admin/AdminPanel';
import { CreateServerModal } from '../components/server/CreateServerModal';
import { JoinServerModal } from '../components/server/JoinServerModal';
import { CallProvider } from '../context/CallContext';
import { CallModal } from '../components/call/CallModal';
import { FaHashtag } from 'react-icons/fa';
import { MdPushPin, MdMenu, MdPeople, MdClose } from 'react-icons/md';
import { VerifyEmailScreen } from '../components/auth/VerifyEmailScreen';
import { usePresence } from '../hooks/usePresence';
import { DMView } from '../components/dm/DMView';

export const MainApp = () => {
  const { currentUser, userProfile, logout } = useAuth();
  const { users, channels, server, servers, currentServer, setCurrentServer, unreadMentions, dms } = useData();
  
  // Send presence heartbeat every 5 minutes
  usePresence(currentUser?.uid);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [selectedDm, setSelectedDm] = useState(null);
  // ... existing state ...
  const [showSettings, setShowSettings] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showPinned, setShowPinned] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [showMobileUserList, setShowMobileUserList] = useState(false);
  const [showCreateServer, setShowCreateServer] = useState(false);
  const [showJoinServer, setShowJoinServer] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [messages, setMessages] = useState([]);

  // Auto-clear unread mentions...
  useEffect(() => {
    if (!currentUser || !currentServer || !unreadMentions) return;
    
    // If current server has unread mentions, clear them immediately
    if (unreadMentions[currentServer]?.count > 0) {
      updateDoc(doc(db, 'users', currentUser.uid), {
        [`unreadMentions.${currentServer}`]: deleteField()
      }).catch(err => {
        console.error('Error clearing unread mentions:', err);
      });
    }
  }, [currentServer, currentUser, unreadMentions]);



  // Open mobile sidebar on initial load if on mobile
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768 && !selectedChannel && !selectedDm) {
        setShowMobileSidebar(true);
      }
    };

    // Check on mount
    if (window.innerWidth < 768) {
        setShowMobileSidebar(true);
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []); // Run once on mount

  // Auto-select first channel...
  useEffect(() => {
    if (channels.length > 0) {
      setSelectedChannel(channels[0]);
    } else {
      setSelectedChannel(null);
    }
  }, [currentServer, channels]);
  const handleServerChange = async (serverId) => {
    setCurrentServer(serverId);
    if (currentUser) {
      try {
        await updateDoc(doc(db, 'users', currentUser.uid), {
          currentServer: serverId
        });
      } catch (err) {
        console.error('Failed to persist server selection:', err);
      }
    }
  };

  const handleStartDm = async (targetUser) => {
    if (!currentUser || !targetUser) return;
    
    // Check if DM already exists
    const existingDm = dms.find(dm => 
      dm.participants.includes(targetUser.id) && 
      dm.participants.includes(currentUser.uid)
    );
    
    if (existingDm) {
      setSelectedDm(existingDm);
      handleServerChange('home');
    } else {
      // Create new DM
      try {
        const dmRef = await addDoc(collection(db, 'dms'), {
          participants: [currentUser.uid, targetUser.id],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastMessage: null
        });
        
        // Optimistically set selected DM (or wait for real-time listener)
        // We'll wait for listener to update 'dms' prop, but we can set view to home
        // Optimistically set selected DM (or wait for real-time listener)
        // We'll wait for listener to update 'dms' prop, but we can set view to home
        handleServerChange('home');
        // We might want to select it once it appears, but for now user will see it in list
      } catch (err) {
        console.error('Error creating DM:', err);
      }
    }
  };

  // Enforce Email Verification
  if (currentUser && !currentUser.emailVerified) {
      return <VerifyEmailScreen />;
  }

  return (
    <CallProvider>
      <div className="flex h-screen bg-dark-bg overflow-hidden">
        {/* Desktop Sidebar (Hidden on Mobile) */}
        <div className="hidden md:flex h-full">
          <ServerSwitcher
            servers={servers}
            currentServerId={currentServer}
            onServerChange={handleServerChange}
            onCreateServer={() => setShowCreateServer(true)}
            onJoinServer={() => setShowJoinServer(true)}
            userRole={userProfile?.role}
            userId={currentUser?.uid}
            unreadMentions={unreadMentions}
          />
          <Sidebar
            server={server}
            channels={channels}
            selectedChannel={selectedChannel}
            onSelectChannel={setSelectedChannel}
            onOpenSettings={() => setShowSettings(true)}
            onOpenAdmin={() => setShowAdmin(true)}
            onLogout={logout}
            userProfile={userProfile}
            serverId={currentServer}
            userRole={userProfile?.role}
            userId={currentUser?.uid}
            dms={dms}
            selectedDm={selectedDm}
            onSelectDm={setSelectedDm}
          />
        </div>

        {/* Mobile Sidebar Drawer */}
        {showMobileSidebar && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            {/* Backdrop */}
            <div 
              className="absolute inset-0 bg-black/50"
              onClick={() => setShowMobileSidebar(false)}
            />
            
            {/* Drawer Content */}
            <div className="relative flex h-full animate-slide-in-left">
              <ServerSwitcher
                servers={servers}
                currentServerId={currentServer}
                onServerChange={(id) => {
                  handleServerChange(id);
                  // Don't close immediately if switching servers, maybe? 
                  // Actually safer to close or keep open? 
                  // Let's keep open for now or user can close. 
                  // Typically you switch server -> then pick channel. 
                }}
                onCreateServer={() => setShowCreateServer(true)}
                onJoinServer={() => setShowJoinServer(true)}
                userRole={userProfile?.role}
                userId={currentUser?.uid}
                unreadMentions={unreadMentions}
              />
              <Sidebar
                server={server}
                channels={channels}
                selectedChannel={selectedChannel}
                onSelectChannel={(channel) => {
                  setSelectedChannel(channel);
                  setShowMobileSidebar(false); // Close on selection
                }}
                onOpenSettings={() => {
                  setShowSettings(true);
                  setShowMobileSidebar(false);
                }}
                onOpenAdmin={() => {
                  setShowAdmin(true);
                  setShowMobileSidebar(false);
                }}
                onLogout={logout}
                userProfile={userProfile}
                serverId={currentServer}
                userRole={userProfile?.role}
                userId={currentUser?.uid}
                dms={dms}
                selectedDm={selectedDm}
                onSelectDm={(dm) => {
                  setSelectedDm(dm);
                  setShowMobileSidebar(false);
                }}
              />
              {/* Close Button */}
              <button 
                onClick={() => setShowMobileSidebar(false)}
                className="absolute top-2 right-2 p-2 bg-dark-bg/50 rounded-full text-white md:hidden"
                style={{ right: '-3rem' }} // Position outside
              >
                <MdClose size={24} />
              </button>
            </div>
          </div>
        )}

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col">
          {currentServer === 'home' ? (
            selectedDm ? (
              <DMView dmId={selectedDm.id} dms={dms} />
            ) : (
              <div className="flex-1 flex items-center justify-center text-dark-muted">
                Select a conversation to start chatting
              </div>
            )
          ) : (
            <>
              {/* Channel Header */}
              <div className="h-12 px-4 flex items-center justify-between border-b border-dark-hover shadow-sm bg-dark-bg">
                <div className="flex items-center gap-2 overflow-hidden">
                  {/* Mobile Menu Button */}
                  <button
                    onClick={() => setShowMobileSidebar(true)}
                    className="md:hidden p-1 mr-1 text-dark-muted hover:text-dark-text"
                  >
                    <MdMenu size={24} />
                  </button>

                  <FaHashtag className="text-dark-muted flex-shrink-0" />
                  <h2 className="font-semibold text-dark-text flex items-center min-w-0">
                    <span className="truncate">{selectedChannel?.name || 'Select a channel'}</span>
                    {selectedChannel?.description && (
                      <span className="hidden md:block ml-4 text-sm text-dark-muted font-normal border-l border-dark-muted/30 pl-4 truncate max-w-md">
                        {selectedChannel.description}
                      </span>
                    )}
                  </h2>
                </div>
                <div className="flex items-center gap-3">
                  {selectedChannel && (
                    <>
                      {/* Pinned Messages Toggle */}
                      {messages.filter(m => m.pinned).length > 0 && (
                        <button
                          onClick={() => setShowPinned(!showPinned)}
                          className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded transition-colors ${
                            showPinned 
                              ? 'bg-brand-primary text-white' 
                              : 'bg-dark-hover text-dark-text hover:bg-dark-input'
                          }`}
                        >
                          <MdPushPin size={16} />
                          <span className="text-sm font-medium">
                            {messages.filter(m => m.pinned).length} Pinned
                          </span>
                        </button>
                      )}
                      
                      <div className="hidden sm:block">
                        <MessageSearch
                          messages={messages}
                          users={users}
                          onResultClick={(msg) => console.log('Scroll to:', msg)}
                        />
                      </div>

                      {/* Mobile User List Toggle */}
                      {currentServer !== 'home' && (
                        <button
                          onClick={() => setShowMobileUserList(true)}
                          className="lg:hidden p-2 text-dark-muted hover:text-dark-text"
                        >
                          <MdPeople size={24} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Messages */}
              {selectedChannel ? (
                <>
                  <MessageList 
                    serverId={currentServer}
                    channelId={selectedChannel.id} 
                    users={users}
                    currentUserId={currentUser?.uid}
                    userRole={userProfile?.role}
                    onReply={setReplyingTo}
                    onMessagesChange={setMessages}
                  />
                  <MessageInput
                    serverId={currentServer}
                    channelId={selectedChannel.id}
                    channel={selectedChannel}
                    userId={currentUser?.uid}
                    userProfile={userProfile}
                    userRole={userProfile?.role}
                    users={users}
                    replyingTo={replyingTo}
                    onCancelReply={() => setReplyingTo(null)}
                  />
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-dark-muted">
                  Select a channel to start chatting
                </div>
              )}
            </>
          )}
        </div>

        {/* User List - Desktop */}
        <div className="hidden lg:block h-full">
            {currentServer !== 'home' && (
              <UserList 
                users={users} 
                currentUserId={currentUser?.uid} 
                onStartDm={handleStartDm}
              />
            )}
        </div>

        {/* User List - Mobile Drawer */}
        {showMobileUserList && currentServer !== 'home' && (
           <div className="fixed inset-0 z-50 flex justify-end lg:hidden">
            {/* Backdrop */}
            <div 
              className="absolute inset-0 bg-black/50"
              onClick={() => setShowMobileUserList(false)}
            />
            
            <div className="relative h-full bg-dark-sidebar shadow-xl w-64 animate-slide-in-right">
               <div className="flex items-center justify-between p-4 border-b border-dark-hover">
                 <h3 className="font-semibold text-dark-text">Members</h3>
                 <button onClick={() => setShowMobileUserList(false)}>
                   <MdClose size={24} className="text-dark-muted" />
                 </button>
               </div>
               <div className="h-[calc(100%-60px)]">
                  <UserList 
                    users={users} 
                    currentUserId={currentUser?.uid} 
                    onStartDm={(user) => {
                      handleStartDm(user);
                      setShowMobileUserList(false);
                    }}
                  />
               </div>
            </div>
           </div>
        )}
        
        {/* Pinned Messages Panel */}
        {showPinned && selectedChannel && (
          <PinnedMessages
            messages={messages}
            users={users}
            onClose={() => setShowPinned(false)}
            onJumpToMessage={(messageId) => {
              // Scroll to message
              const messageElement = document.getElementById(`message-${messageId}`);
              if (messageElement) {
                messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Highlight message briefly
                messageElement.classList.add('bg-brand-primary/10');
                setTimeout(() => {
                  messageElement.classList.remove('bg-brand-primary/10');
                }, 2000);
              }
              setShowPinned(false);
            }}
          />
        )}

        {/* Global Call UI */}
        <CallModal />

        {/* Modals */}
        <SettingsModal
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
          onOpenAdmin={() => setShowAdmin(true)}
        />
        <AdminPanel
          isOpen={showAdmin}
          onClose={() => setShowAdmin(false)}
        />

        <CreateServerModal
          isOpen={showCreateServer}
          onClose={() => setShowCreateServer(false)}
          userId={currentUser?.uid}
          onSuccess={(serverId) => setCurrentServer(serverId)}
        />

        <JoinServerModal
          isOpen={showJoinServer}
          onClose={() => setShowJoinServer(false)}
          userId={currentUser?.uid}
          onSuccess={(serverId) => setCurrentServer(serverId)}
        />
      </div>
    </CallProvider>
  );
};
