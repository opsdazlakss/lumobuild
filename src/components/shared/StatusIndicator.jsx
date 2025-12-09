import { cn } from '../../utils/helpers';

const STATUS_CONFIG = {
  online: { color: 'bg-green-500', label: 'Online', icon: '🟢' },
  idle: { color: 'bg-yellow-500', label: 'Idle', icon: '🌙' },
  dnd: { color: 'bg-red-500', label: 'Do Not Disturb', icon: '🔴' },
  invisible: { color: 'bg-gray-500', label: 'Invisible', icon: '⚫' },
  offline: { color: 'bg-gray-500', label: 'Offline', icon: '⚫' },
};

export const getStatusConfig = (status) => STATUS_CONFIG[status] || STATUS_CONFIG.offline;

export const StatusIndicator = ({ status, size = 'md', className }) => {
  const config = getStatusConfig(status);
  
  const sizeClasses = {
    sm: 'w-2.5 h-2.5',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  };

  // Don't show indicator for invisible users
  if (status === 'invisible') {
    return null;
  }

  return (
    <div 
      className={cn(
        'rounded-full border-2 border-dark-bg',
        config.color,
        sizeClasses[size] || sizeClasses.md,
        className
      )}
      title={config.label}
    />
  );
};

export const StatusDot = ({ status, className }) => {
  const config = getStatusConfig(status);
  
  return (
    <span 
      className={cn(
        'inline-block w-2 h-2 rounded-full',
        config.color,
        className
      )}
    />
  );
};
