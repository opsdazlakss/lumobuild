import { useEffect } from 'react';

export const TypingIndicator = ({ typingUsers, currentUserId }) => {
  if (!typingUsers || typingUsers.length === 0) return null;

  // Filter out current user
  const otherTyping = typingUsers.filter(u => u.userId !== currentUserId);
  
  if (otherTyping.length === 0) return null;

  const getTypingText = () => {
    if (otherTyping.length === 1) {
      return `${otherTyping[0].displayName} is typing...`;
    } else if (otherTyping.length === 2) {
      return `${otherTyping[0].displayName} and ${otherTyping[1].displayName} are typing...`;
    } else if (otherTyping.length === 3) {
      return `${otherTyping[0].displayName}, ${otherTyping[1].displayName}, and ${otherTyping[2].displayName} are typing...`;
    } else {
      return `Several people are typing...`;
    }
  };

  return (
    <div className="px-4 py-2 text-sm text-dark-muted flex items-center gap-2">
      <div className="flex gap-1">
        <span className="w-2 h-2 bg-dark-muted rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-2 h-2 bg-dark-muted rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-2 h-2 bg-dark-muted rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      <span>{getTypingText()}</span>
    </div>
  );
};
