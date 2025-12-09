import { useState } from 'react';
import { getRoleBadgeColor } from '../../utils/helpers';
import { cn } from '../../utils/helpers';
import { UserProfileCard } from '../shared/UserProfileCard';
import { StatusIndicator, getStatusConfig } from '../shared/StatusIndicator';

export const UserList = ({ users, currentUserId }) => {
  const [selectedUser, setSelectedUser] = useState(null);
  
  
  // Online check: use isOnline flag but treat invisible as offline
  const isUserOnline = (user) => {
    // Invisible users appear offline
    if (user.presence === 'invisible') return false;
    return user.isOnline === true;
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

  const roleOrder = ['admin', 'moderator', 'member'];

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
          {/* Presence indicator */}
          <div className="absolute bottom-0 right-0">
            <StatusIndicator status={user.presence || (online ? 'online' : 'offline')} size="sm" />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm text-dark-text truncate">
              {user.displayName || 'Unknown'}
            </span>
            <span className={cn(
              'text-xs px-1.5 py-0.5 rounded border',
              getRoleBadgeColor(user.serverRole || user.role)
            )}>
              {(user.serverRole || user.role)?.charAt(0).toUpperCase() + (user.serverRole || user.role)?.slice(1)}
            </span>
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
      />
    </div>
  );
};
