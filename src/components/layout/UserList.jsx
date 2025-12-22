import { useState, useEffect } from 'react';
import { getRoleBadgeColor } from '../../utils/helpers';
import { cn } from '../../utils/helpers';
import { UserProfileCard } from '../shared/UserProfileCard';
import { StatusIndicator, getStatusConfig } from '../shared/StatusIndicator';
import { isUserOnline as checkUserOnline } from '../../hooks/usePresence';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useData } from '../../context/DataContext';
import { getBadge, BADGES } from '../../utils/badges';

export const UserList = ({ users, currentUserId, onStartDm }) => {
  const { currentServer } = useData();
  const [selectedUser, setSelectedUser] = useState(null);
  const [customRolesData, setCustomRolesData] = useState([]);
  
  // Fetch custom roles with positions
  useEffect(() => {
    if (!currentServer || currentServer === 'home') {
      setCustomRolesData([]);
      return;
    }

    const q = query(collection(db, 'servers', currentServer, 'roles'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rolesData = [];
      snapshot.forEach((doc) => {
        rolesData.push({ id: doc.id, ...doc.data() });
      });
      setCustomRolesData(rolesData);
    });
    return unsubscribe;
  }, [currentServer]);
  
  // Online check: use lastSeen timestamp, treat invisible as offline
  const isUserOnline = (user) => {
    // Invisible users appear offline
    if (user.presence === 'invisible') return false;
    
    // Calculate online status from lastSeen timestamp (safest source)
    const activeByTime = checkUserOnline(user.lastSeen);
    
    // Optimization: If isOnline is true AND time check is within buffer, they are definitely online.
    // If isOnline is false, we still trust the time check for a few minutes to handle potential 
    // race conditions where isOnline was set to false but user is still actually here.
    return activeByTime;
  };
  
  // Separate online and offline users
  const onlineUsers = users.filter(u => isUserOnline(u));
  const offlineUsers = users.filter(u => !isUserOnline(u));

  // Group online users by role
  const groupedOnlineUsers = onlineUsers.reduce((acc, user) => {
    const role = user.serverRole || user.role || 'member';
    if (!acc[role]) acc[role] = [];
    acc[role].push(user);
    return acc;
  }, {});

  // Default roles with fixed positions (negative to always be on top)
  const defaultRoles = [
    { name: 'admin', position: -3 },
    { name: 'moderator', position: -2 },
    { name: 'member', position: -1 }
  ];
  
  // Combine default roles with custom roles and sort by position
  const allRolesWithPositions = [
    ...defaultRoles,
    ...customRolesData.map(r => ({ name: r.name, position: r.position ?? 999 }))
  ];
  
  // Sort by position (lower = higher priority), filter to only roles with users
  const roleOrder = allRolesWithPositions
    .sort((a, b) => a.position - b.position)
    .map(r => r.name)
    .filter(roleName => groupedOnlineUsers[roleName]?.length > 0);

  const renderUser = (user) => {
    const online = isUserOnline(user);
    
    return (
      <div
        key={user.id}
        onClick={() => setSelectedUser(user)}
        className={cn(
          'flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer',
          'hover:bg-dark-hover transition-colors',
          user.id === currentUserId && 'bg-dark-hover/50',
          !online && 'opacity-50' // Grayed out for offline users
        )}
      >
        <div className="relative flex-shrink-0">
          {user.photoUrl ? (
            <img 
              src={user.photoUrl} 
              alt={user.displayName}
              className="w-8 h-8 rounded-full object-cover"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
          ) : null}
          <div 
            className="w-8 h-8 rounded-full bg-brand-primary flex items-center justify-center text-white font-semibold text-sm"
            style={{ display: user.photoUrl ? 'none' : 'flex' }}
          >
            {user.displayName?.[0]?.toUpperCase() || 'U'}
          </div>
          {/* Presence indicator - show offline if user is not active */}
          <div className="absolute bottom-0 right-0">
            <StatusIndicator status={online ? (user.presence || 'online') : 'offline'} size="sm" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm text-dark-text truncate">
              {user.displayName || 'Unknown'}
            </span>
            {/* Badge Icons */}
            {user.badges && user.badges.length > 0 && (
              <div className="flex items-center gap-0.5">
                {user.badges.slice(0, 3).map((badgeId) => {
                  const badge = getBadge(badgeId);
                  if (!badge) return null;
                  const BadgeIcon = badge.icon;
                  return (
                    <BadgeIcon 
                      key={badgeId}
                      size={14}
                      style={{ color: badge.color }}
                      title={badge.label}
                      className="flex-shrink-0"
                    />
                  );
                })}
              </div>
            )}

          </div>
          {user.status && (
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-xs">{user.status.emoji}</span>
              <span className="text-xs text-dark-muted truncate">{user.status.text}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="w-60 bg-dark-sidebar h-full overflow-y-auto py-3">
      <div className="px-2">
        {/* Online Users - Grouped by Role */}
        {roleOrder.map((role) => {
          const roleUsers = groupedOnlineUsers[role] || [];
          if (roleUsers.length === 0) return null;

          return (
            <div key={role} className="mb-4">
              <div className="text-xs font-semibold text-dark-muted uppercase px-2 mb-2">
                {role.charAt(0).toUpperCase() + role.slice(1)}s — {roleUsers.length}
              </div>
              {roleUsers.map(renderUser)}
            </div>
          );
        })}

        {/* Offline Users - No Role Grouping */}
        {offlineUsers.length > 0 && (
          <div className="mt-4">
            <div className="text-xs font-semibold text-gray-500 uppercase px-2 mb-2">
              Offline — {offlineUsers.length}
            </div>
            {offlineUsers.map(renderUser)}
          </div>
        )}
      </div>

      <UserProfileCard
        user={selectedUser}
        isOpen={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        onMessage={(user) => {
          onStartDm && onStartDm(user);
          setSelectedUser(null);
        }}
      />
    </div>
  );
};
