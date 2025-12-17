import { Modal } from './Modal';
import { cn } from '../../utils/helpers';
import { BADGES } from '../../utils/badges';
import { useCall } from '../../context/CallContext';
import { useAuth } from '../../context/AuthContext';
import { MdPhone, MdVideocam, MdMessage } from 'react-icons/md';

export const UserProfileCard = ({ user, isOpen, onClose, onMessage }) => {
  if (!user) return null;

  const getRoleColor = (role) => {
    const colors = {
      admin: '#f23f42',
      moderator: '#faa81a',
      member: '#80848e',
    };
    return colors[role] || '#80848e';
  };

  const { startCall } = useCall();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="" size="sm">
      <div className="space-y-4 -mt-6">
        {/* Profile Picture - No Banner */}
        <div className="flex justify-center pt-4">
          {user.photoUrl ? (
            <img 
              src={user.photoUrl} 
              alt={user.displayName}
              className="w-24 h-24 rounded-full border-4 border-dark-bg object-cover"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
          ) : null}
          <div 
            className="w-24 h-24 rounded-full border-4 border-dark-bg bg-brand-primary flex items-center justify-center text-white font-bold text-3xl"
            style={{ display: user.photoUrl ? 'none' : 'flex' }}
          >
            {user.displayName?.[0]?.toUpperCase() || 'U'}
          </div>
        </div>

        {/* User Info */}
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-dark-text">{user.displayName || 'Unknown'}</h2>
          
          {/* Role Badge */}
          <div className="flex justify-center">
            <span 
              className="px-3 py-1 rounded-full text-sm font-medium"
              style={{ 
                backgroundColor: `${getRoleColor(user.role)}20`,
                color: getRoleColor(user.role),
                border: `1px solid ${getRoleColor(user.role)}50`
              }}
            >
              {user.role?.charAt(0).toUpperCase() + user.role?.slice(1)}
            </span>
          </div>

          {/* Online Status - Using presence */}
          <div className="flex items-center justify-center gap-2">
            {(() => {
              // Get status based on presence
              const presence = user.presence || (user.isOnline ? 'online' : 'offline');
              const statusConfig = {
                online: { color: 'bg-green-500', label: 'Online' },
                idle: { color: 'bg-yellow-500', label: 'Idle' },
                dnd: { color: 'bg-red-500', label: 'Do Not Disturb' },
                invisible: { color: 'bg-gray-500', label: 'Offline' },
                offline: { color: 'bg-gray-500', label: 'Offline' },
              };
              const config = statusConfig[presence] || statusConfig.offline;
              
              return (
                <>
                  <div className={cn('w-3 h-3 rounded-full', config.color)} />
                  <span className="text-sm text-dark-muted">{config.label}</span>
                </>
              );
            })()}
          </div>

          {/* User Badges */}
          <div className="flex justify-center gap-2 mt-3 flex-wrap px-4">
            {/* Combine manual badges (user.badges) and automatic role-based badges */}
            {(() => {
              const uniqueBadgeIds = new Set(user.badges || []);
              
              // Auto-assign admin badge if role is admin
              if (user.role === 'admin') {
                uniqueBadgeIds.add('admin');
              }

              const badgesToRender = Array.from(uniqueBadgeIds)
                .map(id => BADGES[id])
                .filter(Boolean); // Filter out invalid badge IDs

              if (badgesToRender.length === 0) return null;

              return (
                <div className="p-1 rounded-lg bg-dark-sidebar/50 backdrop-blur-sm border border-dark-border/50 flex gap-2">
                  {badgesToRender.map((badge) => {
                    const BadgeIcon = badge.icon;
                    return (
                      <div key={badge.id} className="relative group cursor-help">
                        {/* Badge Icon */}
                        <div className="p-1 rounded hover:bg-dark-hover transition-colors">
                          <BadgeIcon size={20} color={badge.color} />
                        </div>
                        
                        {/* Custom Tooltip */}
                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-black text-white text-xs rounded shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                          <div className="font-bold">{badge.label}</div>
                          {badge.description && (
                            <div className="text-gray-300 font-normal text-[10px]">{badge.description}</div>
                          )}
                          {/* Triangle arrow */}
                          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-black"></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
          
          {/* Custom Status */}
          {user.status && (
            <div className="flex items-center justify-center gap-2 mt-2">
              <span className="text-lg">{user.status.emoji}</span>
              <span className="text-sm text-dark-text">{user.status.text}</span>
            </div>
          )}

          {/* Call Actions */}
          {user.id !== useAuth().currentUser?.uid && (
              <div className="flex gap-2 justify-center mt-4">
                 <button 
                   onClick={() => onMessage && onMessage(user)}
                   className="p-2 rounded-full bg-dark-hover hover:bg-dark-sidebar transition-colors text-dark-text"
                   title="Send Message"
                 >
                    <MdMessage size={20} />
                 </button>
                 <button 
                   onClick={() => startCall(user, 'voice')}
                   className="p-2 rounded-full bg-dark-hover hover:bg-dark-sidebar transition-colors text-dark-text"
                   title="Voice Call"
                 >
                    <MdPhone size={20} />
                 </button>
                 <button 
                   onClick={() => startCall(user, 'video')}
                   className="p-2 rounded-full bg-dark-hover hover:bg-dark-sidebar transition-colors text-dark-text"
                   title="Video Call"
                 >
                    <MdVideocam size={20} />
                 </button>
              </div>
          )}
        </div>

        {/* Bio Section */}
        {user.bio && (
          <div className="bg-dark-bg p-4 rounded-lg">
            <h3 className="text-xs font-semibold text-dark-muted uppercase mb-2">About Me</h3>
            <p className="text-dark-text text-sm whitespace-pre-wrap">{user.bio}</p>
          </div>
        )}

        {/* Member Since */}
        <div className="bg-dark-bg p-4 rounded-lg">
          <h3 className="text-xs font-semibold text-dark-muted uppercase mb-2">Member Since</h3>
          <p className="text-dark-text text-sm">
            {user.createdAt ? new Date(user.createdAt.seconds * 1000).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric'
            }) : 'Unknown'}
          </p>
        </div>
      </div>
    </Modal>
  );
};
