import { useState, useEffect, useRef } from 'react';
import { collection, addDoc, serverTimestamp, doc, setDoc, deleteDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useToast } from '../../context/ToastContext';
import { MdSend, MdClose, MdEmojiEmotions } from 'react-icons/md';
import { EmojiPicker } from '../shared/EmojiPicker';

export const MessageInput = ({ serverId, channelId, channel, userId, userProfile, userRole, users, replyingTo, onCancelReply }) => {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionPosition, setMentionPosition] = useState(0);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const inputRef = useRef(null);
  const { warning, error } = useToast();

  // Check if user can send messages in this channel
  const canSendMessage = !channel?.locked || userRole === 'admin';
  const lockMessage = "This channel is locked. Only admins can send messages.";

  const handleEmojiSelect = (emoji) => {
    const cursorPos = inputRef.current?.selectionStart || message.length;
    const newMessage = message.slice(0, cursorPos) + emoji + message.slice(cursorPos);
    setMessage(newMessage);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  // Detect @ mentions
  useEffect(() => {
    const cursorPos = message.length;
    const textBeforeCursor = message.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
      
      // Check if there's a space after @
      if (!textAfterAt.includes(' ')) {
        setMentionSearch(textAfterAt.toLowerCase());
        setMentionPosition(lastAtIndex);
        setShowMentions(true);
        return;
      }
    }
    
    setShowMentions(false);
  }, [message]);

  const getMentionSuggestions = () => {
    const suggestions = [];
    
    // Add @everyone if it matches the search
    if ('everyone'.startsWith(mentionSearch.toLowerCase())) {
      suggestions.push({ id: 'everyone', displayName: 'everyone', type: 'special' });
    }
    
    // Add roles that match the search
    const roles = ['admin', 'moderator', 'member'];
    roles.forEach(role => {
      if (role.startsWith(mentionSearch.toLowerCase())) {
        suggestions.push({ id: `role-${role}`, displayName: role, type: 'role' });
      }
    });
    
    // Add users that match the search
    if (users) {
      const filteredUsers = users.filter(u => 
        u.displayName.toLowerCase().startsWith(mentionSearch.toLowerCase())
      );
      filteredUsers.forEach(u => {
        suggestions.push({ ...u, type: 'user' });
      });
    }
    
    return suggestions.slice(0, 8); // Increased to show more suggestions
  };

  const insertMention = (user) => {
    const beforeMention = message.slice(0, mentionPosition);
    const afterMention = message.slice(mentionPosition + mentionSearch.length + 1);
    const newMessage = `${beforeMention}@${user.displayName} ${afterMention}`;
    setMessage(newMessage);
    setShowMentions(false);
  };

  // Auto-focus on keypress (Discord-style)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (document.activeElement === inputRef.current) return;
      if (document.activeElement?.tagName === 'INPUT' || 
          document.activeElement?.tagName === 'TEXTAREA') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (['Escape', 'Tab', 'Enter', 'Backspace', 'Delete'].includes(e.key)) return;
      if (document.querySelector('[role="dialog"]')) return;
      
      if (e.key.length === 1) {
        inputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!message.trim()) return;
    if (!channelId || !userId) return;
    if (userProfile?.isMuted) {
      warning('You are muted and cannot send messages');
    }

    setSending(true);

    try {
      // Detect mentions in the message
      const mentionRegex = /@(\w+)/g;
      const mentions = [];
      let match;
      
      while ((match = mentionRegex.exec(message)) !== null) {
        const mentionedName = match[1].toLowerCase();
        
        if (mentionedName === 'everyone') {
          // Add all users except sender
          users.forEach(u => {
            if (u.id !== userId) {
              mentions.push(u.id);
            }
          });
        } else if (['admin', 'moderator', 'member'].includes(mentionedName)) {
          // Role mention - add all users with this role
          users.forEach(u => {
            if (u.role === mentionedName && u.id !== userId) {
              mentions.push(u.id);
            }
          });
        } else {
          // Find specific user
          const mentionedUser = users.find(u => 
            u.displayName.toLowerCase() === mentionedName
          );
          if (mentionedUser && mentionedUser.id !== userId) {
            mentions.push(mentionedUser.id);
          }
        }
      }

      await addDoc(collection(db, 'servers', serverId, 'channels', channelId, 'messages'), {
        text: message.trim(),
        userId: userId,
        timestamp: serverTimestamp(),
        mentions: [...new Set(mentions)], // Remove duplicates
        replyTo: replyingTo ? {
          messageId: replyingTo.id,
          userId: replyingTo.userId,
          text: replyingTo.text.substring(0, 100),
        } : null,
      });
      
      // Update unread mentions for mentioned users (global notifications)
      if (mentions.length > 0) {
        const mentionUpdates = mentions.map(mentionedUserId =>
          updateDoc(doc(db, 'users', mentionedUserId), {
            [`unreadMentions.${serverId}.count`]: increment(1),
            [`unreadMentions.${serverId}.lastMentionAt`]: serverTimestamp(),
            [`unreadMentions.${serverId}.lastMentionText`]: message.trim().substring(0, 50)
          }).catch(err => {
            console.error('Error updating mention for user:', mentionedUserId, err);
          })
        );
        
        await Promise.all(mentionUpdates);
      }
      
      setMessage('');
      onCancelReply && onCancelReply();
    } catch (err) {
      console.error('Error sending message:', err);
      error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="px-4 pb-6 relative">
      {/* Reply Preview */}
      {replyingTo && (
        <div className="mb-2 bg-dark-sidebar border-l-4 border-green-400 p-3 rounded flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="text-xs text-green-400 font-semibold mb-1">Replying to {users.find(u => u.id === replyingTo.userId)?.displayName || 'Unknown'}</div>
            <div className="text-sm text-dark-muted truncate">{replyingTo.text}</div>
          </div>
          <button
            onClick={onCancelReply}
            className="ml-2 text-dark-muted hover:text-dark-text transition-colors"
            title="Cancel reply"
          >
            <MdClose size={18} />
          </button>
        </div>
      )}
      {/* Mention Suggestions */}
      {showMentions && (
        <div className="absolute bottom-full left-4 right-4 mb-2 bg-dark-sidebar rounded-lg shadow-lg border border-dark-hover max-h-48 overflow-y-auto">
          {getMentionSuggestions().map((user) => (
            <button
              key={user.id}
              onClick={() => insertMention(user)}
              className="w-full px-4 py-2 text-left hover:bg-dark-hover transition-colors flex items-center gap-2"
            >
              {user.type === 'special' || user.type === 'role' ? (
                // @everyone and roles - no profile photo, just text
                <span className="text-dark-text font-medium">
                  @{user.displayName}
                  {user.type === 'role' && (
                    <span className="ml-2 text-xs text-dark-muted">(role)</span>
                  )}
                </span>
              ) : (
                // Regular users - show profile photo
                <>
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
                    {user.displayName[0].toUpperCase()}
                  </div>
                  <span className="text-dark-text">@{user.displayName}</span>
                </>
              )}
            </button>
          ))}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="relative">
        {/* Emoji Picker */}
        {showEmojiPicker && (
          <EmojiPicker
            onSelect={handleEmojiSelect}
            onClose={() => setShowEmojiPicker(false)}
          />
        )}
        
        <input
          ref={inputRef}
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            // Tab key autocomplete
            if (e.key === 'Tab' && showMentions) {
              e.preventDefault();
              const suggestions = getMentionSuggestions();
              if (suggestions.length > 0) {
                insertMention(suggestions[0]);
              }
            }
          }}
          placeholder={!canSendMessage ? lockMessage : (userProfile?.isMuted ? 'You are muted' : 'Type a message...')}
          disabled={sending || userProfile?.isMuted || !canSendMessage}
          className="w-full bg-dark-input text-dark-text px-4 py-3 pr-20 rounded-lg
                     border border-transparent focus:border-brand-primary
                     outline-none transition-colors duration-200
                     placeholder:text-dark-muted
                     disabled:opacity-50 disabled:cursor-not-allowed"
        />
        
        {/* Emoji Button */}
        <button
          type="button"
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          className="absolute right-12 top-1/2 -translate-y-1/2
                     text-dark-muted hover:text-brand-primary
                     transition-colors"
          title="Add emoji"
        >
          <MdEmojiEmotions size={24} />
        </button>
        
        <button
          type="submit"
          disabled={!message.trim() || sending || userProfile?.isMuted || !canSendMessage}
          className="absolute right-3 top-1/2 -translate-y-1/2
                     text-dark-muted hover:text-brand-primary
                     transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <MdSend size={24} />
        </button>
      </form>
    </div>
  );
};
