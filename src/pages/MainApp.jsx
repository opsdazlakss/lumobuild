import { useState, useEffect } from 'react';
import { doc, updateDoc, deleteField } from 'firebase/firestore';
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
import { MdPushPin } from 'react-icons/md';

export const MainApp = () => {
  const { currentUser, userProfile, logout } = useAuth();
  const { users, channels, server, servers, currentServer, setCurrentServer, unreadMentions } = useData();
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showPinned, setShowPinned] = useState(false);
  const [showCreateServer, setShowCreateServer] = useState(false);
  const [showJoinServer, setShowJoinServer] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [messages, setMessages] = useState([]);

  // Auto-clear unread mentions when viewing a server
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
  }, [currentServer, currentUser, unreadMentions]); // Run when server changes OR mentions update

  // Auto-select first channel when switching servers
  useEffect(() => {
    if (channels.length > 0) {
      setSelectedChannel(channels[0]);
    } else {
      setSelectedChannel(null);
    }
  }, [currentServer, channels]);

  return (
    <CallProvider>
      <div className="flex h-screen bg-dark-bg">
        {/* Server Switcher */}
        <ServerSwitcher
          servers={servers}
          currentServerId={currentServer}
          onServerChange={setCurrentServer}
          onCreateServer={() => setShowCreateServer(true)}
          onJoinServer={() => setShowJoinServer(true)}
          userRole={userProfile?.role}
          userId={currentUser?.uid}
          unreadMentions={unreadMentions}
        />

        {/* Sidebar */}
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
        />

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Channel Header */}
          <div className="h-12 px-4 flex items-center justify-between border-b border-dark-hover shadow-sm bg-dark-bg">
            <div className="flex items-center gap-2">
              <FaHashtag className="text-dark-muted" />
              <h2 className="font-semibold text-dark-text">
                {selectedChannel?.name || 'Select a channel'}
              </h2>
            </div>
            <div className="flex items-center gap-3">
              {selectedChannel && (
                <>
                  {/* Pinned Messages Toggle */}
                  {messages.filter(m => m.pinned).length > 0 && (
                    <button
                      onClick={() => setShowPinned(!showPinned)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded transition-colors ${
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
                  
                  <MessageSearch
                    messages={messages}
                    users={users}
                    onResultClick={(msg) => console.log('Scroll to:', msg)}
                  />
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
        </div>

        {/* User List */}
        <UserList users={users} currentUserId={currentUser?.uid} />
        
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
