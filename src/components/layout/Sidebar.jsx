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
import { VoiceChannelSection } from '../../voiceChannel/components/VoiceChannelSection';
import { VoiceChannelBar } from '../../voiceChannel/components/VoiceChannelBar';

export const Sidebar = ({ server, channels, selectedChannel, onSelectChannel, onOpenSettings, onOpenAdmin, onLogout, userProfile, serverId, userRole, userId, dms, selectedDm, onSelectDm }) => {
  const [showProfileCard, setShowProfileCard] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  const handleLogout = () => {
    setShowLogoutConfirm(false);
    onLogout();
  };

  return (
    <div className="w-60 bg-dark-sidebar flex flex-col h-full">
      {/* Server Header */}
      <div className="h-12 md:h-12 pt-safe-top md:pt-0 px-4 flex items-center justify-between border-b border-dark-hover shadow-md box-content">
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
          <div className="px-2">
            <div className="text-xs font-semibold text-dark-muted uppercase px-2 mb-1">
              Text Channels
            </div>
            {channels.filter(ch => ch.type !== 'voice').map((channel) => (
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
            
            {/* Voice Channels */}
            <VoiceChannelSection />
          </div>
        )}
      </div>

      {/* Voice Channel Bar - Discord style, above user panel */}
      <VoiceChannelBar />

      {/* User Panel */}
      <div className="h-20 bg-dark-bg px-2 flex items-center justify-between gap-2 border-t border-dark-hover -ml-[72px] w-[calc(100%+72px)] relative z-10">
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
