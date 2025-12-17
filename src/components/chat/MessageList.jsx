import { useEffect, useState, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, limit, deleteDoc, doc, addDoc, serverTimestamp, updateDoc, getDocs, startAfter } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { formatTimestamp, getRoleBadgeColor } from '../../utils/helpers';
import { cn } from '../../utils/helpers';
import { useToast } from '../../context/ToastContext';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { LinkConfirmDialog } from '../shared/LinkConfirmDialog';
import { UserProfileCard } from '../shared/UserProfileCard';
import { MdDelete, MdEdit, MdCheck, MdClose, MdMoreVert, MdReply, MdAddReaction, MdPushPin } from 'react-icons/md';
import { playNotificationSound, isMentioned } from '../../utils/notificationSound';
import { MarkdownText } from '../../utils/markdown.jsx';
import { ReactionPicker } from './ReactionPicker';
import { PollDisplay } from './PollDisplay';
import { StatusIndicator } from '../shared/StatusIndicator';
import { MessageLinkPreviews, detectLinkType, extractUrls } from '../shared/LinkPreview';

export const MessageList = ({ serverId, channelId, users, currentUserId, userRole, onReply, onMessagesChange }) => {
  const [messages, setMessages] = useState([]);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [linkConfirm, setLinkConfirm] = useState(null);
  const [selectedUserProfile, setSelectedUserProfile] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editText, setEditText] = useState('');
  const [openMenu, setOpenMenu] = useState(null);
  const [menuPosition, setMenuPosition] = useState('bottom'); // 'top' or 'bottom'
  const [showReactionPicker, setShowReactionPicker] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [oldestMessage, setOldestMessage] = useState(null);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const lastMessageCountRef = useRef(0);
  const isInitialLoadRef = useRef(true);
  const usersRef = useRef(users);

  // Keep usersRef updated
  useEffect(() => {
    usersRef.current = users;
  }, [users]);
  const { success, error } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Listen to messages
  useEffect(() => {
    if (!channelId) return;

    if (!channelId) return;

    // Helper to get collection ref
    const getCollectionRef = () => {
      return serverId 
        ? collection(db, 'servers', serverId, 'channels', channelId, 'messages')
        : collection(db, 'dms', channelId, 'messages');
    };

    const q = query(
      getCollectionRef(),
      orderBy('timestamp', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messagesData = [];
      snapshot.forEach((doc) => {
        messagesData.push({ id: doc.id, ...doc.data() });
      });
      
      // Reverse to chronological order
      messagesData.reverse();
      
      // Check for new mentions and replies - ONLY if not initial load
      if (!isInitialLoadRef.current && messagesData.length > lastMessageCountRef.current && currentUserId) {
        const currentUser = usersRef.current?.find(u => u.id === currentUserId);
        if (currentUser?.displayName) {
          const newMessages = messagesData.slice(lastMessageCountRef.current);
          
          const hasMention = newMessages.some(msg => 
            msg.userId !== currentUserId && isMentioned(msg.text, currentUser.displayName)
          );
          
          const hasReply = newMessages.some(msg => {
            const isReply = msg.userId !== currentUserId && msg.replyTo?.userId === currentUserId;
            if (isReply) {
              console.log('Reply notification:', msg);
            }
            return isReply;
          });
          
          if (hasMention || hasReply) {
            console.log('Playing notification sound', { hasMention, hasReply });
            playNotificationSound();
          }
        }
      }
      
      lastMessageCountRef.current = messagesData.length;
      setMessages(messagesData);
      
      // After first snapshot, mark as not initial
      if (isInitialLoadRef.current) {
        isInitialLoadRef.current = false;
      }
      
      // Track oldest message for pagination
      if (messagesData.length > 0) {
        setOldestMessage(messagesData[0]);
      }
      
      // Check if there might be more messages
      setHasMore(messagesData.length === 20);
      
      onMessagesChange && onMessagesChange(messagesData);
      setTimeout(scrollToBottom, 100);
    });

    return () => {
      unsubscribe();
      isInitialLoadRef.current = true; // Reset for next channel
    };
  }, [channelId, serverId, currentUserId, onMessagesChange]);

  const loadMore = async () => {
    if (!channelId || !oldestMessage || loadingMore || !hasMore) return;

    setLoadingMore(true);
    const container = messagesContainerRef.current;
    const previousScrollHeight = container?.scrollHeight || 0;

    try {
      const q = query(
        serverId 
          ? collection(db, 'servers', serverId, 'channels', channelId, 'messages')
          : collection(db, 'dms', channelId, 'messages'),
        orderBy('timestamp', 'desc'),
        startAfter(oldestMessage.timestamp),
        limit(20)
      );

      const snapshot = await getDocs(q);
      const olderMessages = [];
      snapshot.forEach((doc) => {
        olderMessages.push({ id: doc.id, ...doc.data() });
      });

      if (olderMessages.length > 0) {
        olderMessages.reverse();
        setMessages(prev => [...olderMessages, ...prev]);
        setOldestMessage(olderMessages[0]);
        setHasMore(olderMessages.length === 20);
        
        setTimeout(() => {
          if (container) {
            container.scrollTop = container.scrollHeight - previousScrollHeight;
          }
        }, 0);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error('Error loading more messages:', err);
      error('Failed to load more messages');
    } finally {
      setLoadingMore(false);
    }
  };

  const getUserById = (userId) => {
    return users.find(u => u.id === userId) || { displayName: 'Unknown', role: 'member' };
  };

  const canDeleteMessage = (messageUserId) => {
    return currentUserId === messageUserId || userRole === 'admin';
  };

  const canEditMessage = (message) => {
    if (message.userId !== currentUserId) return false;
    if (!message.timestamp) return true;
    const messageTime = message.timestamp.toDate();
    const now = new Date();
    const diffMinutes = (now - messageTime) / 1000 / 60;
    return diffMinutes < 15;
  };

  const handleDeleteMessage = async () => {
    if (!deleteConfirm) return;

    try {
      // Get the author name before deleting
      const originalAuthor = users.find(u => u.id === deleteConfirm.userId);
      
      const docRef = serverId 
        ? doc(db, 'servers', serverId, 'channels', channelId, 'messages', deleteConfirm.id)
        : doc(db, 'dms', channelId, 'messages', deleteConfirm.id);
        
      await deleteDoc(docRef);
      
      await addDoc(collection(db, 'adminLogs'), {
        type: 'message_delete',
        channelId: channelId,
        messageId: deleteConfirm.id,
        userId: currentUserId,
        deletedText: deleteConfirm.text || '(empty)',
        originalUserId: deleteConfirm.userId,
        originalUserName: originalAuthor?.displayName || 'Unknown User',
        timestamp: serverTimestamp(),
      });

      success('Message deleted successfully');
    } catch (err) {
      console.error('Error deleting message:', err);
      error('Failed to delete message');
    } finally {
      setDeleteConfirm(null);
    }
  };

  const handleStartEdit = (message) => {
    setEditingMessage(message.id);
    setEditText(message.text);
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
    setEditText('');
  };

  const handleSaveEdit = async () => {
    if (!editingMessage) return;
    
    if (!editText.trim()) {
      error('Message cannot be empty');
      return;
    }

    const messageId = editingMessage;
    const newText = editText.trim();
    const originalMessage = messages.find(m => m.id === messageId);
    const originalText = originalMessage?.text || '';
    
    setEditingMessage(null);
    setEditText('');

    try {
      const docRef = serverId 
        ? doc(db, 'servers', serverId, 'channels', channelId, 'messages', messageId)
        : doc(db, 'dms', channelId, 'messages', messageId);

      await updateDoc(docRef, {
        text: newText,
        edited: true,
        editedAt: serverTimestamp(),
      });
      
      await addDoc(collection(db, 'adminLogs'), {
        type: 'message_edit',
        channelId: channelId,
        messageId: messageId,
        userId: currentUserId,
        originalText: originalText,
        newText: newText,
        timestamp: serverTimestamp(),
      });
      
      success('Message updated successfully');
    } catch (err) {
      console.error('Error editing message:', err);
      if (err.code === 'resource-exhausted') {
        error('Quota exceeded. Please try again tomorrow.');
      } else {
        error('Failed to edit message');
      }
    }
  };

  const toggleReaction = async (messageId, emoji) => {
    try {
      const message = messages.find(m => m.id === messageId);
      if (!message) return;
      
      const reactions = { ...message.reactions } || {};
      const userReactions = reactions[emoji] || [];
      
      if (userReactions.includes(currentUserId)) {
        // Remove reaction
        const updatedUsers = userReactions.filter(id => id !== currentUserId);
        if (updatedUsers.length === 0) {
          delete reactions[emoji];
        } else {
          reactions[emoji] = updatedUsers;
        }
      } else {
        // Allow multiple reactions per user (standard behavior)
        // If we wanted single reaction, we would remove from others here
        
        // Add reaction to this emoji
        reactions[emoji] = [...userReactions, currentUserId];
      }
      
      const docRef = serverId 
        ? doc(db, 'servers', serverId, 'channels', channelId, 'messages', messageId)
        : doc(db, 'dms', channelId, 'messages', messageId);

      await updateDoc(docRef, {
        reactions
      });
    } catch (err) {
      console.error('Error toggling reaction:', err);
      error('Failed to update reaction');
    }
  };

  const togglePin = async (message) => {
    if (userRole !== 'admin' && userRole !== 'moderator') {
      error('Only admins and moderators can pin messages');
      return;
    }

    try {
      const newPinnedState = !message.pinned;
      
      const docRef = serverId 
        ? doc(db, 'servers', serverId, 'channels', channelId, 'messages', message.id)
        : doc(db, 'dms', channelId, 'messages', message.id);

      await updateDoc(docRef, {
        pinned: newPinnedState,
        pinnedBy: newPinnedState ? currentUserId : null,
        pinnedAt: newPinnedState ? serverTimestamp() : null,
      });

      await addDoc(collection(db, 'adminLogs'), {
        type: newPinnedState ? 'message_pin' : 'message_unpin',
        channelId: channelId,
        messageId: message.id,
        userId: currentUserId,
        messageText: message.text,
        timestamp: serverTimestamp(),
      });

      success(newPinnedState ? 'Message pinned' : 'Message unpinned');
    } catch (err) {
      console.error('Error toggling pin:', err);
      error('Failed to pin message');
    }
  };

  const handleLinkClick = (url) => {
    const dontAskAgain = localStorage.getItem('dontAskExternalLinks') === 'true';
    
    if (dontAskAgain) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      setLinkConfirm({ url });
    }
  };

  return (
    <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      {/* Load More Button */}
      {hasMore && messages.length > 0 && (
        <div className="flex justify-center mb-4">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="px-4 py-2 bg-brand-primary hover:bg-brand-primary/80 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loadingMore ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Loading...
              </>
            ) : (
              'Load More Messages'
            )}
          </button>
        </div>
      )}
      
      {messages.length === 0 ? (
        <div className="text-center text-dark-muted py-8">
          No messages yet. Start the conversation!
        </div>
      ) : (
        messages.map((message) => {
          const user = getUserById(message.userId);
          return (
            <div 
              key={message.id} 
              id={`message-${message.id}`}
              className="flex gap-3 hover:bg-dark-hover/30 px-2 py-1 rounded group transition-colors"
            >
              <div className="relative flex-shrink-0">
                {user.photoUrl ? (
                  <img 
                    src={user.photoUrl} 
                    alt={user.displayName}
                    onClick={() => setSelectedUserProfile(user)}
                    className="w-10 h-10 rounded-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div 
                  onClick={() => setSelectedUserProfile(user)}
                  className="w-10 h-10 rounded-full bg-brand-primary flex items-center justify-center text-white font-semibold cursor-pointer hover:opacity-80 transition-opacity"
                  style={{ display: user.photoUrl ? 'none' : 'flex' }}
                >
                  {user.displayName?.[0]?.toUpperCase() || 'U'}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span 
                    className="font-semibold text-dark-text hover:underline cursor-pointer"
                    onClick={() => setSelectedUserProfile(user)}
                  >
                    {user.displayName || 'Unknown'}
                  </span>
                  <span className={cn(
                    'text-xs px-1.5 py-0.5 rounded border',
                    getRoleBadgeColor(user.role)
                  )}>
                    {user.role?.charAt(0).toUpperCase() + user.role?.slice(1)}
                  </span>
                  <span className="text-xs text-dark-muted">
                    {formatTimestamp(message.timestamp)}
                  </span>
                  {message.edited && (
                    <span className="text-xs text-dark-muted italic">(edited)</span>
                  )}
                  
                  {/* 3-dot menu */}
                  {editingMessage !== message.id && (
                    <div className="ml-auto relative z-50">
                      <button
                        onClick={(e) => {
                          // Determine menu position based on click Y position
                          const clickY = e.clientY;
                          const screenHeight = window.innerHeight;
                          const isTopHalf = clickY < screenHeight / 2;
                          
                          setMenuPosition(isTopHalf ? 'bottom' : 'top');
                          setOpenMenu(openMenu === message.id ? null : message.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-dark-hover rounded transition-all"
                        title="More options"
                      >
                        <MdMoreVert size={18} className="text-dark-muted" />
                      </button>
                      
                      {openMenu === message.id && (
                        <>
                          <div 
                            className="fixed inset-0 z-10" 
                            onClick={() => setOpenMenu(null)}
                          />
                          
                          <div className={`absolute right-0 ${menuPosition === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'} bg-dark-sidebar border border-dark-hover rounded-lg shadow-lg py-1 z-50 min-w-[120px]`}>
                            <button
                              onClick={() => {
                                onReply && onReply(message);
                                setOpenMenu(null);
                              }}
                              className="w-full px-3 py-2 text-left text-sm text-dark-text hover:bg-dark-hover flex items-center gap-2"
                            >
                              <MdReply size={16} className="text-green-400" />
                              Reply
                            </button>
                            
                            {canEditMessage(message) && (
                              <button
                                onClick={() => {
                                  handleStartEdit(message);
                                  setOpenMenu(null);
                                }}
                                className="w-full px-3 py-2 text-left text-sm text-dark-text hover:bg-dark-hover flex items-center gap-2"
                              >
                                <MdEdit size={16} className="text-blue-400" />
                                Edit
                              </button>
                            )}
                            
                            {/* Pin/Unpin (admin/mod only) */}
                            {(userRole === 'admin' || userRole === 'moderator') && (
                              <button
                                onClick={() => {
                                  togglePin(message);
                                  setOpenMenu(null);
                                }}
                                className="w-full px-3 py-2 text-left text-sm text-dark-text hover:bg-dark-hover flex items-center gap-2"
                              >
                                <MdPushPin size={16} className="text-blue-400" />
                                {message.pinned ? 'Unpin' : 'Pin'}
                              </button>
                            )}
                            
                            {canDeleteMessage(message.userId) && (
                              <button
                                onClick={() => {
                                  setDeleteConfirm({ id: message.id, text: message.text, userId: message.userId });
                                  setOpenMenu(null);
                                }}
                                className="w-full px-3 py-2 text-left text-sm text-admin hover:bg-dark-hover flex items-center gap-2"
                              >
                                <MdDelete size={16} />
                                Delete
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
                
                {editingMessage === message.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit();
                        if (e.key === 'Escape') handleCancelEdit();
                      }}
                      className="flex-1 bg-dark-input text-dark-text px-3 py-1.5 rounded
                                 border border-brand-primary outline-none"
                      autoFocus
                    />
                    <button
                      onClick={handleSaveEdit}
                      className="text-green-500 hover:text-green-400 transition-colors"
                      title="Save (Enter)"
                    >
                      <MdCheck size={20} />
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="text-admin hover:text-admin/80 transition-colors"
                      title="Cancel (Esc)"
                    >
                      <MdClose size={20} />
                    </button>
                  </div>
                ) : (
                  <>
                    {message.replyTo && (
                      <div className="mb-2 ml-2 pl-3 border-l-2 border-green-400 text-sm bg-dark-sidebar/30 rounded py-1">
                        <div className="text-xs text-green-400 font-semibold">
                          Replying to {getUserById(message.replyTo.userId).displayName}
                        </div>
                        <div className="text-dark-muted italic truncate">
                          {message.replyTo.text}
                        </div>
                      </div>
                    )}
                    {message.pinned && (
                      <div className="flex items-center gap-1 text-xs text-blue-400 mb-1">
                        <MdPushPin size={14} />
                        <span>Pinned</span>
                      </div>
                    )}
                    
                    {/* Hide text if it is just a rich media URL (YouTube, Spotify, Twitter, Image) to prevent duplication with preview. Keep text for generic links or mixed content. */}
                    {(() => {
                      const urls = extractUrls(message.text);
                      let displayText = message.text;
                      
                      // Identify rich media URLs that are shown in previews
                      const richUrls = urls.filter(url => {
                        const type = detectLinkType(url);
                        // Hide text if it triggers ANY specialized preview card (video, audio, image, file, youtube, etc)
                        // Keep text only if it's 'generic' (standard link card) or 'twitter' (optional, but twitter embed sometimes fails so text is safeguard? actually twitter has embed)
                        return ['youtube', 'spotify', 'twitter', 'image', 'video', 'audio', 'file'].includes(type);
                      });

                      // Remove those URLs from the display text
                      richUrls.forEach(url => {
                        displayText = displayText.replace(url, '');
                      });

                      displayText = displayText.trim();
                      
                      return displayText.length > 0 && (
                        <div className="text-dark-text whitespace-pre-wrap break-words">
                          <MarkdownText
                            onMentionClick={(username) => {
                              const user = users.find(u => 
                                u.displayName?.toLowerCase() === username.toLowerCase()
                              );
                              if (user) {
                                setSelectedUserProfile(user);
                              }
                            }}
                          >
                            {displayText}
                          </MarkdownText>
                        </div>
                      );
                    })()}
                    
                    {/* Link Previews (YouTube, Spotify, Twitter, etc.) */}
                    <MessageLinkPreviews text={message.text} />
                    
                    {/* Poll Display */}
                    {message.type === 'poll' && (
                      <PollDisplay
                        message={message}
                        currentUserId={currentUserId}
                        serverId={serverId}
                        channelId={channelId}
                        users={users}
                      />
                    )}
                    
                    {/* Reactions Display */}
                    {message.reactions && Object.keys(message.reactions).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {Object.entries(message.reactions).map(([emoji, userIds]) => (
                          <button
                            key={emoji}
                            onClick={() => toggleReaction(message.id, emoji)}
                            className={cn(
                              'px-2 py-1 rounded-full text-sm flex items-center gap-1 transition-colors',
                              userIds.includes(currentUserId)
                                ? 'bg-brand-primary/20 border border-brand-primary text-brand-primary'
                                : 'bg-dark-hover border border-dark-hover text-dark-text hover:border-dark-muted'
                            )}
                            title={`${userIds.map(id => getUserById(id).displayName).join(', ')}`}
                          >
                            <span>{emoji}</span>
                            <span className="text-xs">{userIds.length}</span>
                          </button>
                        ))}
                        
                        {/* Add Reaction Button */}
                        <div className="relative">
                          <button
                            onClick={() => setShowReactionPicker(showReactionPicker === message.id ? null : message.id)}
                            className="px-2 py-1 rounded-full text-sm bg-dark-hover border border-dark-hover hover:border-dark-muted transition-colors"
                            title="Add reaction"
                          >
                            <MdAddReaction size={16} className="text-dark-muted" />
                          </button>
                          
                          {showReactionPicker === message.id && (
                            <ReactionPicker
                              onSelect={(emoji) => {
                                toggleReaction(message.id, emoji);
                                setShowReactionPicker(null);
                              }}
                              onClose={() => setShowReactionPicker(null)}
                            />
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Add Reaction Button (when no reactions) */}
                    {(!message.reactions || Object.keys(message.reactions).length === 0) && (
                      <div className="relative mt-2">
                        <button
                          onClick={() => setShowReactionPicker(showReactionPicker === message.id ? null : message.id)}
                          className="opacity-0 group-hover:opacity-100 px-2 py-1 rounded text-xs bg-dark-hover hover:bg-dark-input transition-all flex items-center gap-1"
                          title="Add reaction"
                        >
                          <MdAddReaction size={14} />
                          <span className="text-dark-muted">Add reaction</span>
                        </button>
                        
                        {showReactionPicker === message.id && (
                          <ReactionPicker
                            onSelect={(emoji) => {
                              toggleReaction(message.id, emoji);
                              setShowReactionPicker(null);
                            }}
                            onClose={() => setShowReactionPicker(null)}
                          />
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })
      )}
      
      <div ref={messagesEndRef} />

      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDeleteMessage}
        title="Delete Message"
        message="Are you sure you want to delete this message? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
      />

      <LinkConfirmDialog
        isOpen={!!linkConfirm}
        onClose={() => setLinkConfirm(null)}
        onConfirm={() => window.open(linkConfirm?.url, '_blank', 'noopener,noreferrer')}
        url={linkConfirm?.url}
      />

      <UserProfileCard
        user={selectedUserProfile}
        isOpen={!!selectedUserProfile}
        onClose={() => setSelectedUserProfile(null)}
      />
    </div>
  );
};
