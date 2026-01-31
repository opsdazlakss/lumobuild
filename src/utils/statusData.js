export const PREDEFINED_STATUSES = [
  { emoji: '🎮', text: 'Gaming', type: 'gaming' },
  { emoji: '💼', text: 'Working', type: 'working' },
  { emoji: '🎵', text: 'Listening to music', type: 'music' },
  { emoji: '📺', text: 'Watching', type: 'watching' },
  { emoji: '🍕', text: 'Eating', type: 'eating' },
  { emoji: '💤', text: 'AFK', type: 'afk' },
  { emoji: '🎯', text: 'Focusing', type: 'focusing' },
  { emoji: '📚', text: 'Studying', type: 'studying' },
];

// Discord-style presence status
export const PRESENCE_STATUSES = {
  online: { color: 'bg-green-500', label: 'Online', borderColor: 'border-green-500' },
  idle: { color: 'bg-yellow-500', label: 'Idle', borderColor: 'border-yellow-500' },
  dnd: { color: 'bg-red-500', label: 'Do Not Disturb', borderColor: 'border-red-500' },
  invisible: { color: 'bg-gray-500', label: 'Invisible', borderColor: 'border-gray-500' },
  offline: { color: 'bg-gray-500', label: 'Offline', borderColor: 'border-gray-500' },
};

export const getPresenceConfig = (presence) => PRESENCE_STATUSES[presence] || PRESENCE_STATUSES.offline;
