import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { MdVolumeUp, MdLock } from 'react-icons/md';
import { cn } from '../../utils/helpers';
import { useCall } from '../../context/CallContext';

export const VoiceChannel = ({ channel, serverId, currentUserId, onJoin, isConnected }) => {
  const [connectedUsers, setConnectedUsers] = useState([]);
  /* Existing code ... */
  const [contextMenu, setContextMenu] = useState(null); // { x, y, user }
  const { talkingPeers, setPeerVolume, peerVolumes, currentUserId: contextCurrentUserId } = useCall();

  const handleContextMenu = (e, user) => {
      e.preventDefault();
      // Don't show menu for yourself (local user usually doesn't need to hear themselves, loopback is off)
      if (user.id === currentUserId) return;
      
      setContextMenu({
          x: e.pageX,
          y: e.pageY,
          user
      });
  };

  useEffect(() => {
    if (!channel?.id || !serverId) {
        console.warn("VoiceChannel: Missing channel.id or serverId", { channel, serverId });
        return;
    }

    // Listen to users currently in this voice channel
    // Path: servers/{serverId}/channels/{channelId}/connectedUsers
    try {
        const q = query(
          collection(db, 'servers', serverId, 'channels', channel.id, 'connectedUsers'),
          orderBy('joinedAt', 'asc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
          const users = [];
          snapshot.forEach((doc) => {
            users.push({ id: doc.id, ...doc.data() });
          });
          // console.log(`VoiceChannel ${channel.id}: fetched ${users.length} users`, users);
          setConnectedUsers(users);
        }, (error) => {
            console.error("VoiceChannel Snapshot Error:", error);
        });

        return () => unsubscribe();
    } catch (err) {
        console.error("VoiceChannel Query Setup Error:", err);
    }
  }, [channel?.id, serverId]);

  // Close menu on click elsewhere
  useEffect(() => {
      const closeMenu = () => setContextMenu(null);
      window.addEventListener('click', closeMenu);
      return () => window.removeEventListener('click', closeMenu);
  }, []);
  
  const isSpeaking = (user) => {
    if (user.id === currentUserId) {
        return !!talkingPeers['me'] || !!talkingPeers[currentUserId];
    }
    return !!talkingPeers[user.id]; // LiveKit uses UID
  };

  // Heartbeat / Presence Filter
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
      const interval = setInterval(() => setNow(Date.now()), 5000); // Refresh every 5s
      return () => clearInterval(interval);
  }, []);

  const visibleUsers = connectedUsers.filter(user => {
      // Filter out legacy ghosts (users with no heartbeat data)
      if (!user.lastSeen) return false; 
      
      const lastSeenDate = user.lastSeen?.toDate ? user.lastSeen.toDate() : new Date(user.lastSeen);
      const diff = now - lastSeenDate.getTime();
      // Tolerance: 30s (3 missed heartbeats of 10s)
      return diff < 30000; 
  });

  return (
    <div className="mb-1 relative">
      <button
        onClick={() => onJoin(channel)}
        className={cn(
          'w-full flex items-center gap-2 px-2 py-1.5 rounded group',
          'text-dark-muted hover:bg-dark-hover hover:text-dark-text',
          'transition-colors duration-150',
          isConnected && 'bg-dark-hover/50 text-brand-primary'
        )}
      >
        <MdVolumeUp className="flex-shrink-0" size={18} />
        <span className="truncate text-sm flex-1 text-left font-medium">{channel.name}</span>
        {channel.locked && (
            <MdLock className="flex-shrink-0 text-yellow-500" size={14} title="Locked channel" />
        )}
      </button>

      {/* Connected Users List */}
      {visibleUsers.length > 0 && (
        <div className="pl-8 pr-2 pb-1 space-y-1">
          {visibleUsers.map((user) => (
             <VoiceUserItem 
                key={user.id} 
                user={user} 
                isSpeaking={isSpeaking(user)} 
                currentUserId={currentUserId}
                onContextMenu={handleContextMenu}
             />
          ))}
        </div>
      )}

      {/* Context Menu for Volume */}
      {contextMenu && (
          // ... (keep existing context menu logic, but make sure it refers to visibleUsers or contextMenu.user)
          // The contextMenu state holds the 'user' object. If that object is from a previous render, it's fine, it's just data.
          // Volume slider updates peerVolumes via ID.
          <div 
            className="fixed z-50 bg-[#111214] border border-[#1e1f22] rounded-md shadow-xl p-3 min-w-[200px]"
            style={{ top: contextMenu.y, left: contextMenu.x }}
            onClick={(e) => e.stopPropagation()} 
          >
              <div className="text-xs font-bold text-gray-300 mb-2 px-1">
                  {contextMenu.user.displayName}
              </div>
              <div className="px-1">
                  <div className="flex justify-between text-[10px] uppercase font-bold text-gray-500 mb-1">
                      <span>User Volume</span>
                      <span>{Math.round((peerVolumes[contextMenu.user.id] ?? 1) * 100)}%</span>
                  </div>
                  <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      defaultValue={(peerVolumes[contextMenu.user.id] ?? 1) * 100}
                      className="w-full accent-brand-primary h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                      onChange={(e) => {
                          const val = Math.min(100, parseInt(e.target.value)) / 100;
                          if (contextMenu.user.id) {
                              setPeerVolume(contextMenu.user.id, val);
                          }
                      }}
                  />
              </div>
          </div>
      )}
    </div>
  );
};

// Extracted & Memoized User Item
// Only re-renders if distinct props change (isSpeaking, displayName, photoUrl)
// NOT when 'lastSeen' changes (since we don't pass 'user.lastSeen' deeply or we check prevProps)
import { memo } from 'react';

const VoiceUserItem = memo(({ user, isSpeaking, currentUserId, onContextMenu }) => {
    return (
        <div 
            onContextMenu={(e) => onContextMenu(e, user)}
            className="flex items-center gap-2 group/user rounded hover:bg-white/5 py-0.5 px-1 transition-colors cursor-pointer select-none"
        >
            <img 
            src={user.photoUrl || user.photoURL} 
            alt={user.displayName}
            className={cn(
                "w-6 h-6 rounded-full object-cover border-2 transition-colors duration-75",
                isSpeaking ? "border-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "border-transparent" 
            )}
            onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
            }}
            />
            <div 
            className={cn(
                "w-6 h-6 rounded-full bg-brand-primary flex items-center justify-center text-white text-[10px] font-bold border-2 transition-colors duration-75",
                isSpeaking ? "border-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "border-transparent"
            )}
            style={{ display: (user.photoUrl || user.photoURL) ? 'none' : 'flex' }}
            >
            {user.displayName?.[0]?.toUpperCase()}
            </div>
            
            <span className={cn(
            "text-xs truncate text-dark-muted group-hover/user:text-dark-text transition-colors",
            user.id === currentUserId && "font-bold text-brand-primary"
            )}>
            {user.displayName}
            </span>
        </div>
    );
}, (prevProps, nextProps) => {
    // Custom Comparison Function
    return (
        prevProps.isSpeaking === nextProps.isSpeaking &&
        prevProps.user.id === nextProps.user.id &&
        prevProps.user.displayName === nextProps.user.displayName &&
        prevProps.user.photoUrl === nextProps.user.photoUrl &&
        prevProps.currentUserId === nextProps.currentUserId
        // We purposefully IGNORE user.lastSeen or other user object changes!
    );
});
