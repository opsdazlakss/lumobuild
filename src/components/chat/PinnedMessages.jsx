import { MdClose, MdPushPin } from 'react-icons/md';
import { formatTimestamp } from '../../utils/helpers';
import { MarkdownText } from '../../utils/markdown.jsx';

export const PinnedMessages = ({ messages, users, onClose, onJumpToMessage }) => {
  const pinnedMessages = messages.filter(m => m.pinned);

  const getUserById = (userId) => {
    return users.find(u => u.id === userId) || { displayName: 'Unknown' };
  };

  if (pinnedMessages.length === 0) {
    return (
      <div className="w-80 bg-dark-sidebar border-l border-dark-hover h-full flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-dark-hover">
          <div className="flex items-center gap-2">
            <MdPushPin className="text-blue-400" size={20} />
            <h3 className="font-semibold text-dark-text">Pinned Messages</h3>
          </div>
          <button
            onClick={onClose}
            className="text-dark-muted hover:text-dark-text transition-colors"
          >
            <MdClose size={20} />
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center text-dark-muted text-sm">
          No pinned messages
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 bg-dark-sidebar border-l border-dark-hover h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-dark-hover">
        <div className="flex items-center gap-2">
          <MdPushPin className="text-blue-400" size={20} />
          <h3 className="font-semibold text-dark-text">Pinned Messages</h3>
          <span className="text-xs text-dark-muted">({pinnedMessages.length})</span>
        </div>
        <button
          onClick={onClose}
          className="text-dark-muted hover:text-dark-text transition-colors"
        >
          <MdClose size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {pinnedMessages.map((message) => {
          const user = getUserById(message.userId);
          return (
            <div
              key={message.id}
              onClick={() => onJumpToMessage(message.id)}
              className="bg-dark-bg p-3 rounded-lg cursor-pointer hover:bg-dark-hover transition-colors border border-transparent hover:border-brand-primary"
            >
              <div className="flex items-start gap-2 mb-2">
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
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-dark-text text-sm">
                      {user.displayName}
                    </span>
                    <span className="text-xs text-dark-muted">
                      {formatTimestamp(message.timestamp)}
                    </span>
                  </div>
                  <div className="text-dark-text text-sm mt-1 line-clamp-3">
                    <MarkdownText>{message.text}</MarkdownText>
                  </div>
                  {message.pinnedBy && (
                    <div className="text-xs text-blue-400 mt-2 flex items-center gap-1">
                      <MdPushPin size={12} />
                      <span>Pinned by {getUserById(message.pinnedBy).displayName}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
