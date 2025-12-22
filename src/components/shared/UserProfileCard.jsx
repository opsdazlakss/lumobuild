import { Modal } from './Modal';
import { cn } from '../../utils/helpers';
import { BADGES } from '../../utils/badges';
import { useCall } from '../../context/CallContext';
import { useAuth } from '../../context/AuthContext';
import { MdPhone, MdVideocam, MdMessage, MdRocketLaunch } from 'react-icons/md';
import { isUserOnline } from '../../hooks/usePresence';

export const UserProfileCard = ({ user, isOpen, onClose, onMessage }) => {
  if (!user) return null;

  // Check if user is actually online based on lastSeen timestamp
  const userIsOnline = user.presence !== 'invisible' && isUserOnline(user.lastSeen);

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
    <Modal isOpen={isOpen} onClose={onClose} title="" size="sm" showCloseButton={false}>
      <div className="relative overflow-hidden rounded-lg -m-6 min-h-[400px] flex flex-col">
        {/* Full Background Image/Color */}
        <div 
          className="absolute inset-0 bg-cover bg-center transition-colors"
          style={{ 
            backgroundColor: user.themeColor || '#6366f1',
            backgroundImage: user.bannerUrl ? `url(${user.bannerUrl})` : `linear-gradient(to bottom right, ${user.themeColor || '#6366f1'}, #000)`
          }}
        />
        
        {/* Dark Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent" />

        {/* Close Button (Manual implementation since we removed Modal header usually) */}
        <button 
           onClick={onClose}
           className="absolute top-4 right-4 p-2 bg-black/40 hover:bg-black/60 rounded-full text-white/80 hover:text-white transition-colors z-20 backdrop-blur-sm"
        >
          <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" height="24" width="24" xmlns="http://www.w3.org/2000/svg"><path fill="none" d="M0 0h24v24H0z"></path><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"></path></svg>
        </button>

        {/* Content Container - Pushed to bottom */}
        <div className="relative z-10 p-6 mt-auto flex flex-col items-center text-center">
            {/* Avatar */}
            <div className="relative group mb-4">
              {user.photoUrl ? (
                <img 
                  key={user.photoUrl}
                  src={user.photoUrl} 
                  alt={user.displayName}
                  className="w-32 h-32 rounded-full border-4 object-cover shadow-2xl"
                  style={{ borderColor: user.themeColor || '#1e1f22' }} 
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
              ) : null}
              <div 
                className="w-32 h-32 rounded-full border-4 flex items-center justify-center text-white font-bold text-5xl shadow-2xl"
                style={{ 
                    display: user.photoUrl ? 'none' : 'flex',
                    borderColor: user.themeColor || '#1e1f22',
                    backgroundColor: user.themeColor || '#6366f1'
                }}
              >
                {user.displayName?.[0]?.toUpperCase() || 'U'}
              </div>
            </div>

            {/* Name & Role */}
            <div className="space-y-1 w-full">
              <h2 className="text-3xl font-bold text-white flex items-center justify-center gap-2 drop-shadow-md">
                 {user.displayName || 'Unknown'}
                 {(user.role === 'admin' || user.role === 'premium') && (
                   <div className="text-brand-primary drop-shadow-none" title="Premium Member">
                     <MdRocketLaunch size={24} color={user.themeColor || '#6366f1'}/>
                   </div>
                 )}
              </h2>
              
              {/* Role Badge */}
              <div className="flex justify-center mt-2">
                 <span 
                  className="px-4 py-1.5 rounded-full text-sm font-semibold border backdrop-blur-md shadow-lg"
                  style={{ 
                    backgroundColor: `${getRoleColor(user.role)}30`,
                    color: '#fff', // White text for contrast on dark bg
                    borderColor: `${getRoleColor(user.role)}80`
                  }}
                >
                  {user.role?.charAt(0).toUpperCase() + user.role?.slice(1)}
                </span>
              </div>
            </div>

            {/* Badges */}
            <div className="flex justify-center gap-2 mt-4 flex-wrap">
                {(() => {
                  const uniqueBadgeIds = new Set(user.badges || []);
                  if (user.role === 'admin') uniqueBadgeIds.add('admin');
                  const badgesToRender = Array.from(uniqueBadgeIds)
                    // .filter(id => id !== 'premium') // Removed filter so premium badge shows
                    .map(id => BADGES[id])
                    .filter(Boolean);
                  if (badgesToRender.length === 0) return null;

                  return (
                    <div className="p-1.5 rounded-xl bg-black/40 backdrop-blur-md border border-white/10 flex gap-2">
                      {badgesToRender.map((badge) => {
                        const BadgeIcon = badge.icon;
                        return (
                          <div key={badge.id} className="relative group cursor-help p-1 hover:bg-white/10 rounded transition-colors">
                            <BadgeIcon size={20} color={badge.color} />
                            
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
            
            {/* Status & Presence */}
            <div className="flex items-center gap-3 mt-4 bg-black/30 px-4 py-2 rounded-full backdrop-blur-sm border border-white/5">
                {/* Presence Dot */}
                <div className={cn('w-3 h-3 rounded-full shadow-lg shadow-white/20', 
                    userIsOnline && (user.presence === 'online' || !user.presence) ? 'bg-green-500' : 
                    userIsOnline && user.presence === 'idle' ? 'bg-yellow-500' : 
                    userIsOnline && user.presence === 'dnd' ? 'bg-red-500' : 'bg-gray-500'
                )} />
                
                {/* Custom Status Text */}
                {user.status ? (
                   <span className="text-sm text-gray-200 flex gap-2">
                      <span>{user.status.emoji}</span>
                      <span>{user.status.text}</span>
                   </span>
                ) : (
                   <span className="text-sm text-gray-300">
                      {userIsOnline ? (user.presence === 'idle' ? 'Idle' : user.presence === 'dnd' ? 'Do Not Disturb' : 'Online') : 'Offline'}
                   </span>
                )}
            </div>

            {/* Action Buttons */}
            {user.id !== useAuth().currentUser?.uid && (
                <div className="flex gap-4 justify-center mt-6 w-full max-w-xs">
                   <button 
                     onClick={() => onMessage && onMessage(user)}
                     className="flex-1 py-3 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-colors shadow-lg flex items-center justify-center gap-2"
                   >
                      <MdMessage size={20} /> Message
                   </button>
                   <button 
                     onClick={() => startCall(user, 'voice')}
                     className="p-3 bg-black/50 text-white rounded-xl hover:bg-black/70 border border-white/10 transition-colors backdrop-blur-sm"
                     title="Voice Call"
                   >
                      <MdPhone size={22} />
                   </button>
                   <button 
                     onClick={() => startCall(user, 'video')}
                     className="p-3 bg-black/50 text-white rounded-xl hover:bg-black/70 border border-white/10 transition-colors backdrop-blur-sm"
                     title="Video Call"
                   >
                      <MdVideocam size={22} />
                   </button>
                </div>
            )}
            
            {/* Bio */}
            {user.bio && (
              <div className="mt-6 w-full text-left bg-black/20 p-4 rounded-xl backdrop-blur-sm border border-white/5">
                <h3 className="text-xs font-bold text-gray-400 uppercase mb-2 tracking-wider">About Me</h3>
                <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">{user.bio}</p>
              </div>
            )}
            
            {/* Member Since (Footer) */}
            <div className="mt-4 text-xs text-gray-500 font-medium uppercase tracking-widest">
                Member since {user.createdAt ? new Date(user.createdAt.seconds * 1000).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Unknown'}
            </div>

        </div>
      </div>
    </Modal>
  );
};
