import { useState, useEffect } from 'react';
import { doc, updateDoc, deleteField, addDoc, collection, serverTimestamp, getDoc, query, where, getDocs } from 'firebase/firestore';
import { useSwipe } from '../hooks/useSwipe';
import { useAndroidPermissions } from '../hooks/useAndroidPermissions';
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
import { CallProvider, useCall } from '../context/CallContext';
import { SoundboardProvider } from '../context/SoundboardContext';
import { HotkeyProvider, useHotkeys } from '../context/HotkeyContext';
import { CallModal } from '../components/call/CallModal';
import { FaHashtag } from 'react-icons/fa';
import { MdPushPin, MdMenu, MdPeople, MdClose, MdAndroid } from 'react-icons/md';
import { VerifyEmailScreen } from '../components/auth/VerifyEmailScreen';
import { usePresence } from '../hooks/usePresence';
import { DMView } from '../components/dm/DMView';
import { Capacitor } from '@capacitor/core';
import pkg from '../../package.json';
import { UpdateModal } from '../components/shared/UpdateModal';
import { VoiceChannelProvider, useVoiceChannel } from '../voiceChannel/context/VoiceChannelContext';
import '../voiceChannel/voiceChannel.css';

// Global Hotkey Listener Component
const GlobalHotkeys = () => {
    const { hotkeys } = useHotkeys();
    
    // Call Context (DMs / Direct Calls)
    const { 
        toggleAudio: toggleCallAudio, 
        toggleDeafen: toggleCallDeafen, 
        callStatus 
    } = useCall();

    // Voice Channel Context (Server Voice Channels)
    const { 
        toggleMute: toggleVoiceMute, 
        toggleDeafen: toggleVoiceDeafen,
        currentVoiceChannel
    } = useVoiceChannel();
    
    useEffect(() => {
        const handleDown = (e) => {
            // Ignore if input is focused AND no "strong" modifiers (Ctrl/Alt/Meta) are active.
            // We allow Shift because it's used for typing (e.g. "+"), so we still block if ONLY Shift is present or no modifiers.
            const isInputFocused = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) || document.activeElement?.contentEditable === 'true';
            const hasStrongModifier = e.ctrlKey || e.altKey || e.metaKey;

            if (isInputFocused && !hasStrongModifier) {
                // Debug log to help user understand why it's not working
                // We limit this to only when a key matches a potential hotkey to avoid spam, 
                // but since we haven't checked the combo yet, we'll just log if it LOOKS like a hotkey logic pass.
                // Actually, let's just log it if they press the keys we're interested in? NO, we don't know the combo yet.
                // We'll calculate combo first, THEN check focus?
                // Let's restructure slightly to calculate combo first, then decide to abort.
            }
            // Move block check later

            // Build combo string
            const modifiers = [];
            if (e.ctrlKey) modifiers.push('Control');
            if (e.shiftKey) modifiers.push('Shift');
            if (e.altKey) modifiers.push('Alt');
            if (e.metaKey) modifiers.push('Meta');
            
            let char = e.key;
            if (char.length === 1) char = char.toUpperCase();
            
            // Avoid duplicates
            if (['Control', 'Shift', 'Alt', 'Meta'].includes(char)) {
                // Just modifier
            } else {
                modifiers.push(char);
            }
            
            const combo = [...new Set(modifiers)].join('+');
            
            // Check for match FIRST
            const isMuteMatch = combo === hotkeys.toggleMute;
            const isDeafenMatch = combo === hotkeys.toggleDeafen;

            if (isMuteMatch || isDeafenMatch) {
                // Check logic for input fields:
                // User wants hotkeys to work even in inputs, BUT also wants to be able to type the character.
                // So, we only preventDefault (block typing) if:
                // 1. We are NOT in an input field.
                // 2. OR we are using a modifier (Ctrl/Alt) which shouldn't type text anyway.
                const isInputFocused = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) || document.activeElement?.contentEditable === 'true';
                const hasStrongModifier = e.ctrlKey || e.altKey || e.metaKey;

                if (!isInputFocused || hasStrongModifier) {
                    e.preventDefault();
                }
                
                
                if (isMuteMatch) {
                    if (currentVoiceChannel) toggleVoiceMute();
                    else toggleCallAudio();
                } else {
                    if (currentVoiceChannel) toggleVoiceDeafen();
                    else toggleCallDeafen();
                }
            } else {
                // console.log("[GlobalHotkeys] No match:", combo);
            }
        };

        window.addEventListener('keydown', handleDown);
        return () => window.removeEventListener('keydown', handleDown);
    }, [hotkeys, toggleCallAudio, toggleCallDeafen, toggleVoiceMute, toggleVoiceDeafen, currentVoiceChannel]);

    return null;
};

export const MainApp = () => {
  const { currentUser, userProfile, logout } = useAuth();
  const { users, channels, server, servers, currentServer, setCurrentServer, unreadMentions, unreadDms, dms } = useData();
  
  // Request Android permissions on startup (camera, microphone, storage, notifications)
  useAndroidPermissions();
  
  // Send presence heartbeat every 5 minutes
  usePresence(currentUser?.uid);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [selectedDm, setSelectedDm] = useState(null);
  
  const [showSettings, setShowSettings] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showPinned, setShowPinned] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [showMobileUserList, setShowMobileUserList] = useState(false);

  // Swipe Handlers
  const swipeHandlers = useSwipe({
    onSwipeLeft: () => {
      if (showMobileSidebar) {
        setShowMobileSidebar(false);
        return; 
      }
      if (currentServer !== 'home') {
          setShowMobileUserList(true);
      }
    },
    onSwipeRight: () => {
      if (showMobileUserList) {
        setShowMobileUserList(false);
        return;
      }
      setShowMobileSidebar(true);
    }
  });
  const [showCreateServer, setShowCreateServer] = useState(false);
  const [showJoinServer, setShowJoinServer] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateData, setUpdateData] = useState(null);
  const [updateStatus, setUpdateStatus] = useState('idle');

  // Check for updates on mount (mobile only)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const checkUpdate = async () => {
      setUpdateStatus('checking');
      const startTime = Date.now();
      try {
        const docRef = doc(db, 'system', 'app_version');
        const docSnap = await getDoc(docRef);
        let hasUpdate = false;
        let updateInfo = null;
        if (docSnap.exists()) {
          const data = docSnap.data();
          const currentVersion = pkg.version;
          const remoteVersion = data.android;
          if (remoteVersion && remoteVersion !== currentVersion) {
            const v1 = currentVersion.split('.').map(Number);
            const v2 = remoteVersion.split('.').map(Number);
            for (let i = 0; i < Math.max(v1.length, v2.length); i++) {
              const num1 = v1[i] || 0;
              const num2 = v2[i] || 0;
              if (num2 > num1) {
                hasUpdate = true;
                break;
              } else if (num2 < num1) {
                break;
              }
            }
            if (hasUpdate) {
              updateInfo = {
                version: remoteVersion,
                downloadUrl: data.downloadUrl,
                forceUpdate: data.forceUpdate || false
              };
            }
          }
        }
        const elapsed = Date.now() - startTime;
        if (elapsed < 1500) {
          await new Promise(resolve => setTimeout(resolve, 1500 - elapsed));
        }
        if (hasUpdate) {
          setUpdateData(updateInfo);
          setUpdateStatus('available');
          setShowUpdateModal(true);
        } else {
          setUpdateStatus('uptodate');
          setTimeout(() => {
            setUpdateStatus('idle');
          }, 1500);
        }
      } catch (err) {
        console.error('Failed to check for updates:', err);
        setUpdateStatus('idle');
      }
    };
    checkUpdate();
  }, []);

  useEffect(() => {
    if (!currentUser || !currentServer || !unreadMentions) return;
    if (unreadMentions[currentServer]?.count > 0) {
      updateDoc(doc(db, 'users', currentUser.uid), {
        [`unreadMentions.${currentServer}`]: deleteField()
      }).catch(err => {
        console.error('Error clearing unread mentions:', err);
      });
    }
  }, [currentServer, currentUser, unreadMentions]);
  
  useEffect(() => {
    if (!currentUser || !selectedDm || !unreadDms) return;
    if (unreadDms[selectedDm.id]?.count > 0) {
      updateDoc(doc(db, 'users', currentUser.uid), {
        [`unreadDms.${selectedDm.id}`]: deleteField()
      }).catch(err => {
        console.error('Error clearing unread DM count:', err);
      });
    }
  }, [selectedDm, currentUser, unreadDms]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768 && !selectedChannel && !selectedDm) {
        setShowMobileSidebar(true);
      }
    };
    if (window.innerWidth < 768) {
        setShowMobileSidebar(true);
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [selectedChannel, selectedDm]);

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
    
    try {
      // 1. Check local state first (fastest)
      let targetDm = dms.find(dm => 
        dm.participants.includes(targetUser.id) && 
        dm.participants.includes(currentUser.uid)
      );

      // 2. If not found in local (might be hidden), check Firestore
      if (!targetDm) {
        const q = query(
          collection(db, 'dms'),
          where('participants', 'array-contains', currentUser.uid)
        );
        const snapshot = await getDocs(q);
        const existingDoc = snapshot.docs.find(doc => {
          const data = doc.data();
          return data.participants.includes(targetUser.id);
        });

        if (existingDoc) {
          targetDm = { id: existingDoc.id, ...existingDoc.data() };
        }
      }

      if (targetDm) {
        // 3. If DM exists, unhide it if necessary
        if (targetDm.hiddenFor?.includes(currentUser.uid)) {
          await updateDoc(doc(db, 'dms', targetDm.id), {
            hiddenFor: targetDm.hiddenFor.filter(id => id !== currentUser.uid)
          });
        }
        setSelectedDm(targetDm);
      } else {
        // 4. Create new DM if none exists
        const newDmData = {
          participants: [currentUser.uid, targetUser.id],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastMessage: null,
          hiddenFor: []
        };
        const docRef = await addDoc(collection(db, 'dms'), newDmData);
        // Important: Set selectedDm with the new ID so it opens immediately
        setSelectedDm({ id: docRef.id, ...newDmData });
      }

      // Always switch to Home view to show the DM
      handleServerChange('home');
      
    } catch (err) {
      console.error('Error starting DM:', err);
    }
  };

  if (currentUser && !currentUser.emailVerified) {
      return <VerifyEmailScreen />;
  }

  return (
    <SoundboardProvider>
      <VoiceChannelProvider>
          <HotkeyProvider>
          <CallProvider>
            <GlobalHotkeys />
            <div 
              className="flex h-screen bg-dark-bg overflow-hidden"
              {...swipeHandlers}
            >
          {/* ... Desktop Sidebar ... */}
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
              unreadDms={unreadDms}
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
              unreadDms={unreadDms}
              selectedDm={selectedDm}
              onSelectDm={setSelectedDm}
            />
          </div>

          {showMobileSidebar && (
            <div className="fixed inset-0 z-50 flex md:hidden">
              <div 
                className="absolute inset-0 bg-black/50"
                onClick={() => setShowMobileSidebar(false)}
              />
              <div className="relative flex h-full animate-slide-in-left bg-dark-bg">
                <ServerSwitcher
                  servers={servers}
                  currentServerId={currentServer}
                  onServerChange={(id) => handleServerChange(id)}
                  onCreateServer={() => setShowCreateServer(true)}
                  onJoinServer={() => setShowJoinServer(true)}
                  userRole={userProfile?.role}
                  userId={currentUser?.uid}
                  unreadMentions={unreadMentions}
                  unreadDms={unreadDms}
                />
                <Sidebar
                  server={server}
                  channels={channels}
                  selectedChannel={selectedChannel}
                  onSelectChannel={(channel) => {
                    setSelectedChannel(channel);
                    setShowMobileSidebar(false);
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
                  unreadDms={unreadDms}
                  selectedDm={selectedDm}
                  onSelectDm={(dm) => {
                    setSelectedDm(dm);
                    setShowMobileSidebar(false);
                  }}
                />
                <button 
                  onClick={() => setShowMobileSidebar(false)}
                  className="absolute top-2 right-2 p-2 bg-dark-bg/50 rounded-full text-white md:hidden"
                  style={{ right: '-3rem' }}
                >
                  <MdClose size={24} />
                </button>
              </div>
            </div>
          )}

          <div className="flex-1 flex flex-col">
            {currentServer === 'home' ? (
              selectedDm ? (
                <DMView dmId={selectedDm.id} dms={dms} />
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-dark-muted relative">
                  <button
                    onClick={() => setShowMobileSidebar(true)}
                    className="absolute top-4 left-4 md:hidden p-2 text-dark-muted hover:text-dark-text"
                  >
                    <MdMenu size={32} />
                  </button>
                  <div className="text-center">
                    <p className="mb-2 text-lg">👋 Welcome!</p>
                    <p>Select a conversation to start chatting</p>
                  </div>
                </div>
              )
            ) : (
              <>
                <div className="h-12 md:h-12 pt-safe-top md:pt-0 px-4 flex items-center justify-between border-b border-dark-hover shadow-sm bg-dark-bg box-content">
                  <div className="flex items-center gap-2 overflow-hidden">
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

          <div className="hidden lg:block h-full">
              {currentServer !== 'home' && (
                <UserList 
                  users={users} 
                  currentUserId={currentUser?.uid} 
                  onStartDm={handleStartDm}
                />
              )}
          </div>

          {showMobileUserList && currentServer !== 'home' && (
             <div className="fixed inset-0 z-50 flex justify-end lg:hidden">
              <div 
                className="absolute inset-0 bg-black/50"
                onClick={() => setShowMobileUserList(false)}
              />
              <div className="relative h-full bg-dark-sidebar shadow-xl w-64 animate-slide-in-right pt-safe-top">
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
          
          {showPinned && selectedChannel && (
            <PinnedMessages
              messages={messages}
              users={users}
              onClose={() => setShowPinned(false)}
              onJumpToMessage={(messageId) => {
                const messageElement = document.getElementById(`message-${messageId}`);
                if (messageElement) {
                  messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  messageElement.classList.add('bg-brand-primary/10');
                  setTimeout(() => {
                    messageElement.classList.remove('bg-brand-primary/10');
                  }, 2000);
                }
                setShowPinned(false);
              }}
            />
          )}

          <CallModal />
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
          {showUpdateModal && (
            <UpdateModal
              isOpen={showUpdateModal}
              onClose={() => !updateData?.forceUpdate && setShowUpdateModal(false)}
              version={updateData?.version}
              downloadUrl={updateData?.downloadUrl}
              forceUpdate={updateData?.forceUpdate}
            />
          )}
          {['checking', 'uptodate'].includes(updateStatus) && (
            <div className="fixed inset-0 z-[60] bg-dark-bg flex flex-col items-center justify-center text-white transition-opacity duration-300">
               {updateStatus === 'checking' && (
                 <>
                   <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-primary mb-6"></div>
                   <h2 className="text-xl font-semibold mb-2">Checking for updates...</h2>
                   <p className="text-dark-muted font-mono text-sm">v{pkg.version}</p>
                 </>
               )}
               {updateStatus === 'uptodate' && (
                 <>
                   <div className="rounded-full bg-green-500/20 p-4 mb-6">
                      <MdAndroid size={48} className="text-green-500" />
                   </div>
                   <h2 className="text-xl font-semibold mb-2 text-green-400">You are up to date!</h2>
                   <p className="text-dark-muted font-mono text-sm">v{pkg.version}</p>
                 </>
               )}
            </div>
          )}
          </div>
          </CallProvider>
          </HotkeyProvider>
        </VoiceChannelProvider>
      </SoundboardProvider>
    );
};
