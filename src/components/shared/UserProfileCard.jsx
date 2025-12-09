import { Modal } from './Modal';
import { cn } from '../../utils/helpers';
import { useCall } from '../../context/CallContext';
import { useAuth } from '../../context/AuthContext';
import { MdPhone, MdVideocam } from 'react-icons/md';

export const UserProfileCard = ({ user, isOpen, onClose }) => {
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
