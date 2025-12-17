import { useState } from 'react';
import { FaHashtag } from 'react-icons/fa';
import { MdLock } from 'react-icons/md';
import { MdSettings, MdAdminPanelSettings, MdLogout, MdPersonAdd } from 'react-icons/md';
import { cn } from '../../utils/helpers';
import { UserProfileCard } from '../shared/UserProfileCard';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { InviteCodeModal } from '../server/InviteCodeModal';
import { PresenceSelector } from '../shared/PresenceSelector';
import { StatusIndicator } from '../shared/StatusIndicator';
import { DMList } from '../dm/DMList';
import { VoiceChannel } from '../server/VoiceChannel';
import { useCall } from '../../context/CallContext';
import { MdSignalCellularAlt, MdCallEnd, MdMic, MdMicOff, MdHeadset, MdHeadsetOff, MdOpenInFull } from 'react-icons/md';

export const Sidebar = ({ server, channels, selectedChannel, onSelectChannel, onOpenSettings, onOpenAdmin, onLogout, userProfile, serverId, userRole, userId, dms, selectedDm, onSelectDm }) => {
  const [showProfileCard, setShowProfileCard] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  
  const { joinVoiceChannel, leaveVoiceChannel, activeRoom, isMuted, toggleAudio, isDeafened, toggleDeafen } = useCall();

  const handleLogout = () => {
    setShowLogoutConfirm(false);
    onLogout();
  };

  const handleJoinVoice = (channel) => {
    if (activeRoom?.channelId === channel.id) return; // Already in
    joinVoiceChannel(channel.id, serverId);
  };

  return (
    <div className="w-60 bg-dark-sidebar flex flex-col h-full">
      {/* Server Header */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-dark-hover shadow-md">
        <h2 className="font-semibold text-dark-text truncate">
          {server?.name || 'Lumo'}
        </h2>
        <div className="flex items-center gap-1">
          {/* Generate Invite Button - Admin Only */}
          {serverId && userRole === 'admin' && (
            <button
              onClick={() => setShowInviteModal(true)}
              className="p-1.5 hover:bg-dark-hover rounded transition-colors"
              title="Generate Invite"
            >
              <MdPersonAdd className="text-green-500" size={20} />
            </button>
          )}
          {userProfile?.role === 'admin' && (
            <button
              onClick={onOpenAdmin}
              className="p-1.5 hover:bg-dark-hover rounded transition-colors"
              title="Admin Panel"
            >
              <MdAdminPanelSettings className="text-admin" size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Channels List or DM List */}
      <div className="flex-1 overflow-y-auto py-3">
        {serverId === 'home' ? (
           <DMList 
             dms={dms} 
             selectedDmId={selectedDm?.id} 
             onSelectDm={onSelectDm} 
           />
        ) : (
          <div className="px-2 space-y-4">
            {/* Voice Channels Section */}
            {channels.some(c => c.type === 'voice') && (
               <div>
                  <div className="text-xs font-semibold text-dark-muted uppercase px-2 mb-1 flex items-center justify-between group">
                    Voice Channels
                  </div>
                  {channels.filter(c => c.type === 'voice').map((channel) => (
                    <VoiceChannel 
                      key={channel.id}
                      channel={channel}
                      serverId={serverId}
                      currentUserId={userProfile?.id || userId}
                      onJoin={handleJoinVoice} 
                      isConnected={activeRoom?.channelId === channel.id}
                    />
                  ))}
               </div>
            )}

            {/* Text Channels Section */}
            <div>
              <div className="text-xs font-semibold text-dark-muted uppercase px-2 mb-1">
                Text Channels
              </div>
              {channels.filter(c => !c.type || c.type === 'text').map((channel) => (
                <button
                  key={channel.id}
                  onClick={() => onSelectChannel(channel)}
                  className={cn(
                    'w-full flex items-center gap-2 px-2 py-1.5 rounded',
                    'text-dark-muted hover:bg-dark-hover hover:text-dark-text',
                    'transition-colors duration-150',
                    selectedChannel?.id === channel.id && 'bg-dark-hover text-dark-text'
                  )}
                >
                  <FaHashtag className="flex-shrink-0" />
                  <span className="truncate text-sm flex-1 text-left">{channel.name}</span>
                  {channel.locked && (
                    <MdLock className="flex-shrink-0 text-yellow-500" size={14} title="Locked channel" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

      </div>

       {/* Voice Connection Panel */}
       {/* Voice Connection Panel */}
       {activeRoom && (
        <div className="bg-[#1e1f22] px-2 py-2 border-t border-[#2b2d31] flex flex-col gap-1">
           {/* Connection Status & Channel Info */}
           <div className="flex items-center justify-between mb-1 pl-1">
             <div className="min-w-0 flex flex-col w-full">
                <span className="text-green-500 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1">
                    <MdSignalCellularAlt size={12}/> Voice Connected
                </span>
                <span 
                    className="text-gray-200 text-xs font-semibold truncate cursor-pointer hover:underline hover:text-white transition-colors"
                    onClick={() => window.dispatchEvent(new CustomEvent('OPEN_VOICE_ROOM'))}
                >
                    {channels.find(c => c.id === activeRoom.channelId)?.name || 'General'}
                </span>
             </div>
           </div>
           
           {/* Controls Row - Now with 5 buttons including Maximize */}
           <div className="flex items-center gap-1">
              <button 
                 onClick={() => window.dispatchEvent(new CustomEvent('OPEN_VOICE_ROOM'))}
                 className="flex-1 flex items-center justify-center p-1.5 rounded-[4px] hover:bg-gray-700/50 text-green-400 hover:text-green-300 transition-all"
                 title="Open Voice View"
              >
                  <MdOpenInFull size={18} />
              </button>

              <button 
                 onClick={toggleAudio} 
                 className={cn(
                   "flex-1 flex items-center justify-center p-1.5 rounded-[4px] transition-all",
                   isMuted ? "bg-red-500 text-white" : "hover:bg-gray-700/50 text-gray-200"
                 )}
                 title={isMuted ? "Unmute" : "Mute"}
              >
                 {isMuted ? <MdMicOff size={18} /> : <MdMic size={18} />}
              </button>
              
              <button 
                 onClick={toggleDeafen} 
                 className={cn(
                   "flex-1 flex items-center justify-center p-1.5 rounded-[4px] transition-all",
                   isDeafened ? "bg-red-500 text-white" : "hover:bg-gray-700/50 text-gray-200"
                 )}
                 title={isDeafened ? "Undeafen" : "Deafen"}
              >
                 {isDeafened ? <MdHeadsetOff size={18} /> : <MdHeadset size={18} />}
              </button>
              
              <button 
                 onClick={onOpenSettings} 
                 className="flex-1 flex items-center justify-center p-1.5 rounded-[4px] hover:bg-gray-700/50 text-gray-200 transition-all"
                 title="Voice Settings"
              >
                 <MdSettings size={18} />
              </button>

              <button 
                 onClick={leaveVoiceChannel}
                 className="flex-1 flex items-center justify-center p-1.5 rounded-[4px] hover:bg-red-500/20 text-gray-400 hover:text-red-500 transition-all"
                 title="Disconnect"
              >
                  <MdCallEnd size={18} />
              </button>
           </div>
        </div>
       )}

      {/* User Panel */}
      <div className="h-20 bg-dark-bg px-2 flex items-center justify-between gap-2 border-t border-dark-hover relative z-10 w-full">
        <div 
          className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer hover:bg-dark-hover rounded p-2 transition-colors"
          onClick={() => setShowProfileCard(true)}
        >
          <div className="relative flex-shrink-0">
            {userProfile?.photoUrl ? (
              <img 
                key={userProfile.photoUrl}
                src={userProfile.photoUrl} 
                alt={userProfile.displayName}
                className="w-12 h-12 rounded-full object-cover"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
            ) : null}
            <div 
              key={`fallback-${userProfile?.photoUrl}`}
              className="w-12 h-12 rounded-full bg-brand-primary flex items-center justify-center text-white font-bold text-lg"
              style={{ display: userProfile?.photoUrl ? 'none' : 'flex' }}
            >
              {userProfile?.displayName?.[0]?.toUpperCase() || 'U'}
            </div>
            {/* Status Indicator on Avatar */}
            <div className="absolute bottom-0 right-0">
              <StatusIndicator status={userProfile?.presence || 'online'} size="md" />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-base font-semibold text-dark-text truncate">
              {userProfile?.displayName || 'User'}
            </div>
            <div className="text-sm text-dark-muted truncate">
              {userProfile?.role || 'member'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenSettings}
            className="p-2.5 hover:bg-dark-hover rounded-lg transition-colors"
            title="Settings"
          >
            <MdSettings className="text-dark-muted hover:text-dark-text" size={24} />
          </button>
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="p-2.5 hover:bg-dark-hover rounded-lg transition-colors"
            title="Logout"
          >
            <MdLogout className="text-dark-muted hover:text-admin" size={24} />
          </button>
        </div>
      </div>

      <UserProfileCard
        user={userProfile}
        isOpen={showProfileCard}
        onClose={() => setShowProfileCard(false)}
      />

      <ConfirmDialog
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={handleLogout}
        title="Logout"
        message="Are you sure you want to logout?"
        confirmText="Logout"
        variant="danger"
      />

      <InviteCodeModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        serverId={serverId}
      />
    </div>
  );
};
