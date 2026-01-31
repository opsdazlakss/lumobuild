import { useState, useEffect, useRef } from 'react';
import { collection, addDoc, serverTimestamp, doc, setDoc, deleteDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useToast } from '../../context/ToastContext';
import { MdSend, MdClose, MdEmojiEmotions, MdGif, MdPoll, MdImage, MdAddCircle, MdAutoAwesome } from 'react-icons/md';
import { EmojiPicker } from '../shared/EmojiPicker';
import { GifPicker } from './GifPicker';
import { StickerPicker } from './StickerPicker';
import { PollCreator } from './PollCreator';
import { uploadToCloudinary } from '../../services/cloudinary';
import { uploadToImgBB } from '../../services/imgbb';
import { isPremiumUser } from '../../utils/permissions';

export const MessageInput = ({ serverId, channelId, channel, userId, userProfile, userRole, users, replyingTo, onCancelReply }) => {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionPosition, setMentionPosition] = useState(0);

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [uploadState, setUploadState] = useState({ uploading: false, progress: 0, speed: '' });
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [imageCaption, setImageCaption] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);
  const fileInputRef = useRef(null);
  const inputRef = useRef(null);
  const { warning, error, info } = useToast();

  // Check if user can send messages in this channel
  // Allow Owner, Admin and Moderator to bypass lock
  const canRoleBypass = ['owner', 'admin', 'moderator'].includes(userRole);
  const canSendMessage = !channel?.locked || canRoleBypass;
  const lockMessage = "This channel is locked. Only staff can send messages.";

  const handleEmojiSelect = (emoji) => {
    const cursorPos = inputRef.current?.selectionStart || message.length;
    const newMessage = message.slice(0, cursorPos) + emoji + message.slice(cursorPos);
    setMessage(newMessage);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  const handleGifSelect = async (gifUrl) => {
    setShowGifPicker(false);
    
    // Check permissions
    if (!message.trim() && !canSendMessage) return; // Basic check, though GIF is just a link
    
    // Send immediately as a standalone message
    try {
      setSending(true);
      const messageData = {
        text: gifUrl,
        userId: userId,
        timestamp: serverTimestamp(),
        mentions: [],
        replyTo: null
      };

      if (serverId) {
        await addDoc(collection(db, 'servers', serverId, 'channels', channelId, 'messages'), messageData);
      } else {
        await addDoc(collection(db, 'dms', channelId, 'messages'), messageData);
        await updateDoc(doc(db, 'dms', channelId), {
          lastMessage: {
            text: 'GIF',
            userId: userId,
            timestamp: serverTimestamp()
          },
          updatedAt: serverTimestamp(),
          hiddenFor: [] // Unhide for everyone on new message
        });

        // Update unread count for the recipient
        const recipient = users.find(u => u.id !== userId);
        if (recipient) {
          await updateDoc(doc(db, 'users', recipient.id), {
            [`unreadDms.${channelId}.count`]: increment(1),
            [`unreadDms.${channelId}.lastMessageAt`]: serverTimestamp(),
            [`unreadDms.${channelId}.text`]: 'GIF'
          }).catch(err => console.error('Error updating unread DM count:', err));
        }
      }
    } catch (err) {
      console.error('Error sending GIF:', err);
      error('Failed to send GIF');
    } finally {
      setSending(false);
    }
  };

  const handleStickerSelect = async (stickerUrl) => {
    setShowStickerPicker(false);
    
    // Check permissions using centralized helper
    if (!isPremiumUser(userProfile)) {
      error('Stickers are for Premium members only!');
      return;
    }

    try {
      setSending(true);
      const messageData = {
        type: 'sticker',
        text: stickerUrl, // URL in text field for compatibility
        userId: userId,
        timestamp: serverTimestamp(),
        mentions: [],
        replyTo: null
      };

      if (serverId) {
        await addDoc(collection(db, 'servers', serverId, 'channels', channelId, 'messages'), messageData);
      } else {
        await addDoc(collection(db, 'dms', channelId, 'messages'), messageData);
        await updateDoc(doc(db, 'dms', channelId), {
          lastMessage: {
            text: '✨ Sticker',
            userId: userId,
            timestamp: serverTimestamp()
          },
          updatedAt: serverTimestamp(),
          hiddenFor: []
        });

        // Update unread count for the recipient
        const recipient = users.find(u => u.id !== userId);
        if (recipient) {
          await updateDoc(doc(db, 'users', recipient.id), {
            [`unreadDms.${channelId}.count`]: increment(1),
            [`unreadDms.${channelId}.lastMessageAt`]: serverTimestamp(),
            [`unreadDms.${channelId}.text`]: '✨ Sticker'
          }).catch(err => console.error('Error updating unread DM count:', err));
        }
      }
    } catch (err) {
      console.error('Error sending Sticker:', err);
      error('Failed to send Sticker');
    } finally {
      setSending(false);
    }
  };

  // Handle poll submission
  const handlePollSubmit = async (pollData) => {
    if (!canSendMessage) return;
    
    try {
      setSending(true);
      const messageData = {
        type: 'poll',
        text: pollData.question,
        poll: {
          question: pollData.question,
          options: pollData.options,
          votes: {},
          multipleChoice: pollData.multipleChoice,
          anonymous: pollData.anonymous
        },
        userId: userId,
        timestamp: serverTimestamp(),
        mentions: []
      };

      if (serverId) {
        await addDoc(collection(db, 'servers', serverId, 'channels', channelId, 'messages'), messageData);
      } else {
        await addDoc(collection(db, 'dms', channelId, 'messages'), messageData);
        await updateDoc(doc(db, 'dms', channelId), {
          lastMessage: {
            text: `📊 Poll: ${pollData.question}`,
            userId: userId,
            timestamp: serverTimestamp()
          },
          updatedAt: serverTimestamp(),
          hiddenFor: [] // Unhide for everyone on new message
        });

        // Update unread count for the recipient
        const recipient = users.find(u => u.id !== userId);
        if (recipient) {
          await updateDoc(doc(db, 'users', recipient.id), {
            [`unreadDms.${channelId}.count`]: increment(1),
            [`unreadDms.${channelId}.lastMessageAt`]: serverTimestamp(),
            [`unreadDms.${channelId}.text`]: `📊 Poll: ${pollData.question}`
          }).catch(err => console.error('Error updating unread DM count:', err));
        }
      }
    } catch (err) {
      console.error('Error creating poll:', err);
      error('Failed to create poll');
    } finally {
      setSending(false);
    }
  };

  const processFileSelection = (file) => {
    if (!file) return;

    // File size limits - use centralized premium check
    const isPremium = isPremiumUser(userProfile);
    const maxSize = isPremium ? 200 * 1024 * 1024 : 10 * 1024 * 1024; // 200MB vs 10MB

    if (file.size > maxSize) {
      error(`File too large! The limit is ${isPremium ? '200MB' : '10MB'}. ${!isPremium ? 'Upgrade to Premium for larger uploads.' : ''}`);
      return;
    }

    // Create preview
    let url = null;
    if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        url = URL.createObjectURL(file);
    }
    setSelectedFile(file);
    setPreviewUrl(url);
    setImageCaption('');
    setShowPlusMenu(false);
    
    // Reset input so same file can be selected again if cancelled
    if (fileInputRef.current) fileInputRef.current.value = '';
  }
  
  const handleFileSelect = (e) => {
    processFileSelection(e.target.files?.[0]);
  };

  // Check if any modal is open (they typically have fixed/absolute overlays with high z-index)
  const isModalOpen = () => {
    // Look for common modal indicators
    return document.querySelector('[role="dialog"]') !== null ||
           document.querySelector('.modal-overlay') !== null ||
           document.body.style.overflow === 'hidden';
  };
  
  // Drag and drop handlers
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Don't activate drag overlay if a modal is open
    if (isModalOpen()) return;
    
    dragCounterRef.current++;
    
    // Only show overlay if dragging FILES (not text/images from within app)
    const isFileDrag = e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files');
    
    if (isFileDrag) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;
    
    // Don't process drop if a modal is open
    if (isModalOpen()) return;
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFileSelection(files[0]);
    }
  };

  // Add global drag listeners
  useEffect(() => {
    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, []);

  const handleCancelPreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    setImageCaption('');
  };

  const handleUploadAndSend = async () => {
    if (!selectedFile) return;

    try {
      setUploadState({ uploading: true, progress: 0, speed: '0 KB/s' });
      
      let uploadUrl, uploadMeta;

      // Determine upload service based on file type
      if (selectedFile.type.startsWith('image/')) {
        const imageUrl = await uploadToImgBB(selectedFile, (progress, speed) => {
          setUploadState({ uploading: true, progress, speed });
        });
        uploadUrl = imageUrl;
        // ImgBB only returns URL string, not metadata object like Cloudinary wrapper
      } else {
        const result = await uploadToCloudinary(selectedFile, (progress, speed) => {
          setUploadState({ uploading: true, progress, speed });
        });
        uploadUrl = result.url;
        uploadMeta = result;
      }
      
      // Send message with URL and caption
      // Format: url \n caption (if any)
      const messageText = imageCaption.trim() ? `${uploadUrl}\n${imageCaption}` : uploadUrl;
      
      const messageData = {
        text: messageText,
        userId: userId,
        timestamp: serverTimestamp(),
        mentions: [],
        replyTo: null
      };

      if (serverId) {
        await addDoc(collection(db, 'servers', serverId, 'channels', channelId, 'messages'), messageData);
      } else {
        await addDoc(collection(db, 'dms', channelId, 'messages'), messageData);
        await updateDoc(doc(db, 'dms', channelId), {
          lastMessage: {
            text: selectedFile.type.startsWith('image/') ? '📷 Image' : '📎 Attachment',
            userId: userId,
            timestamp: serverTimestamp()
          },
          updatedAt: serverTimestamp(),
          hiddenFor: [] // Unhide for everyone on new message
        });

        // Update unread count for the recipient
        const recipient = users.find(u => u.id !== userId);
        if (recipient) {
          await updateDoc(doc(db, 'users', recipient.id), {
            [`unreadDms.${channelId}.count`]: increment(1),
            [`unreadDms.${channelId}.lastMessageAt`]: serverTimestamp(),
            [`unreadDms.${channelId}.text`]: selectedFile.type.startsWith('image/') ? '📷 Image' : '📎 Attachment'
          }).catch(err => console.error('Error updating unread DM count:', err));
        }
      }
      handleCancelPreview(); // Cleanup
    } catch (err) {
      console.error('Error uploading file:', err);
      error('Failed to upload file');
    } finally {
      setUploadState({ uploading: false, progress: 0, speed: '' });
    }
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
    
    // Only allow special mentions in Servers
    if (serverId) {
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
    }
    
    // Add users that match the search
    if (users) {
      const filteredUsers = users.filter(u => 
        u.id !== userId &&
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

      const messageData = {
        text: message.trim(),
        userId: userId,
        timestamp: serverTimestamp(),
        mentions: [...new Set(mentions)], // Remove duplicates
        replyTo: replyingTo ? {
          messageId: replyingTo.id,
          userId: replyingTo.userId,
          text: replyingTo.text.substring(0, 100),
        } : null,
      };

      if (serverId) {
        // Server Channel Message
        await addDoc(collection(db, 'servers', serverId, 'channels', channelId, 'messages'), messageData);
        
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

          // NEW: Send Push Notification for Mentions
          fetch('/api/send-notification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
               targetUserIds: mentions,
               title: 'New Mention',
               body: `${userProfile?.displayName || 'Someone'} mentioned you in ${channel?.name || 'a channel'}`,
               data: { serverId, channelId }
            })
          }).catch(err => console.error('Failed to send push for mention:', err));
        }
      } else {
        // Direct Message
        await addDoc(collection(db, 'dms', channelId, 'messages'), messageData);
        
        // Update DM lastMessage metadata for sidebar sorting/preview
        await updateDoc(doc(db, 'dms', channelId), {
          lastMessage: {
            text: message.trim().substring(0, 100),
            userId: userId,
            timestamp: serverTimestamp()
          },
          updatedAt: serverTimestamp(),
          hiddenFor: [] // Unhide for everyone on new message
        });

        // Update unread count for the recipient
        const recipient = users.find(u => u.id !== userId);
        if (recipient) {
          await updateDoc(doc(db, 'users', recipient.id), {
            [`unreadDms.${channelId}.count`]: increment(1),
            [`unreadDms.${channelId}.lastMessageAt`]: serverTimestamp(),
            [`unreadDms.${channelId}.text`]: message.trim().substring(0, 50)
          }).catch(err => console.error('Error updating unread DM count:', err));

          // NEW: Send Push Notification for DM
          fetch('/api/send-notification', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                 targetUserIds: [recipient.id],
                 title: `New Message from ${userProfile?.displayName}`,
                 body: message.trim().substring(0, 100),
                 data: { dmId: channelId }
              })
          }).catch(err => console.error('Failed to send push for DM:', err));
        }
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

        {/* Upload Progress Bar */}
        {uploadState.uploading && (
          <div className="absolute -top-12 left-0 right-0 bg-dark-sidebar border border-dark-hover rounded-lg p-2 shadow-lg animate-fade-in-up z-50">
            <div className="flex items-center justify-between text-xs text-dark-text mb-1">
              <span className="font-semibold">Uploading Image...</span>
              <span className="text-dark-muted">{Math.round(uploadState.progress)}% • {uploadState.speed}</span>
            </div>
            <div className="h-1.5 bg-dark-hover rounded-full overflow-hidden">
              <div 
                className="h-full bg-brand-primary transition-all duration-200 ease-out"
                style={{ width: `${uploadState.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Image Preview Modal */}
        {selectedFile && (
          <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
            <div className="bg-dark-bg border border-dark-hover rounded-lg shadow-2xl max-w-lg w-full overflow-hidden flex flex-col p-4">
              <h3 className="text-dark-text font-semibold mb-4 flex items-center gap-2">
                <MdImage className="text-brand-primary" />
                Upload Attachment
              </h3>
              
              <div className="flex-1 w-full bg-black/50 rounded-lg overflow-hidden flex items-center justify-center mb-4 border border-dark-hover min-h-[200px] max-h-[400px]">
                {previewUrl ? (
                    <img src={previewUrl} alt="Preview" className="max-w-full max-h-full object-contain" />
                ) : (
                    <div className="flex flex-col items-center gap-2 text-dark-muted">
                        <div className="text-6xl">📄</div>
                        <div className="text-sm font-medium text-dark-text max-w-xs truncate px-4">{selectedFile.name}</div>
                        <div className="text-xs">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</div>
                    </div>
                )}
              </div>

              <input
                type="text"
                value={imageCaption}
                onChange={(e) => setImageCaption(e.target.value)}
                placeholder="Add a caption... (optional)"
                className="w-full bg-dark-input text-dark-text px-4 py-2 rounded-lg border border-dark-hover focus:border-brand-primary outline-none mb-4"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !uploadState.uploading) handleUploadAndSend();
                }}
              />

              <div className="flex justify-between items-center">
                <button
                  onClick={handleCancelPreview}
                  className="px-4 py-2 text-dark-text hover:text-dark-muted transition-colors font-medium"
                  disabled={uploadState.uploading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleUploadAndSend}
                  className="px-6 py-2 bg-brand-primary hover:bg-brand-secondary text-white rounded-md transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  disabled={uploadState.uploading}
                >
                  {uploadState.uploading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <MdSend size={18} />
                      Send
                    </>
                  )}
                </button>
              </div>
              
              {/* Progress UI in Modal */}
              {uploadState.uploading && (
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-dark-muted mb-1">
                    <span>{uploadState.speed}</span>
                    <span>{Math.round(uploadState.progress)}%</span>
                  </div>
                  <div className="h-1 bg-dark-hover rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-brand-primary transition-all duration-200"
                      style={{ width: `${uploadState.progress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sticker Picker */}
        {showStickerPicker && (
          <div className="absolute bottom-full right-0 mb-4 w-[85vw] max-w-[400px] h-[450px] shadow-2xl rounded-lg z-50 animate-fade-in-up">
             {/* Backdrop to close */}
             <div 
               className="fixed inset-0 z-[-1]" 
               onClick={() => setShowStickerPicker(false)}
             />
             <StickerPicker onSelect={handleStickerSelect} />
          </div>
        )}

        {/* GIF Picker */}
        {showGifPicker && (
          <div className="absolute bottom-full right-0 mb-4 w-[85vw] max-w-[400px] h-[450px] shadow-2xl rounded-lg z-50">
             {/* Backdrop to close */}
             <div 
               className="fixed inset-0 z-[-1]" 
               onClick={() => setShowGifPicker(false)}
             />
             <GifPicker onSelect={handleGifSelect} />
          </div>
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
          onPaste={async (e) => {
            const items = e.clipboardData.items;
            for (let i = 0; i < items.length; i++) {
            for (let i = 0; i < items.length; i++) {
              if (items[i].kind === 'file') {
                e.preventDefault();
                processFileSelection(items[i].getAsFile());
                break;
              }
            }
            }
          }}
          placeholder={!canSendMessage ? lockMessage : (userProfile?.isMuted ? 'You are muted' : 'Type a message...')}
          disabled={sending || userProfile?.isMuted || !canSendMessage || selectedFile !== null}
          className="w-full bg-dark-input text-dark-text px-12 py-3 pr-48 rounded-lg
                     border border-transparent focus:border-brand-primary
                     outline-none transition-colors duration-200
                     placeholder:text-dark-muted
                     disabled:opacity-50 disabled:cursor-not-allowed select-text"
        />

        {/* Drag Overlay */}
        {isDragging && (
          <div className="fixed inset-0 z-[200] bg-brand-primary/90 flex flex-col items-center justify-center animate-fade-in pointer-events-none">
            <div className="bg-white/10 p-8 rounded-full mb-6">
              <MdAddCircle size={64} className="text-white animate-bounce" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Drop your file here</h2>
            <p className="text-white/80">to upload instantly</p>
          </div>
        )}

        {/* Plus Button Menu */}
        <div className="absolute left-3 top-0 bottom-0 flex items-center plus-menu-container"> {/* Changed from absolute centering to flex centering */}
          <button
            type="button"
            onClick={() => setShowPlusMenu(!showPlusMenu)}
            className={`text-dark-muted hover:text-brand-primary transition-colors flex items-center justify-center ${showPlusMenu ? 'text-brand-primary' : ''}`}
            title="Add attachment"
            disabled={!canSendMessage}
          >
            <MdAddCircle size={26} />
          </button>

          {showPlusMenu && (
            <div className="absolute bottom-full left-0 mb-2 w-48 bg-dark-sidebar border border-dark-hover rounded-lg shadow-xl overflow-hidden z-50 animate-fade-in-up">
              <button
                type="button"
                onClick={() => {
                  fileInputRef.current?.click();
                  setShowPlusMenu(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-dark-hover text-left transition-colors"
              >
                <MdImage className="text-green-400" size={20} />
                <span className="text-sm text-dark-text font-medium">Upload File</span>
              </button>
              
              <button
                type="button"
                onClick={() => {
                  setShowPollCreator(true);
                  setShowPlusMenu(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-dark-hover text-left transition-colors"
                disabled={!serverId} // Polls usually in servers, but updated logic allows DMs too. Assuming DMs ok.
              >
                <MdPoll className="text-brand-primary" size={20} />
                <span className="text-sm text-dark-text font-medium">Create Poll</span>
              </button>
            </div>
          )}
        </div>
        
        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          // accept="image/*" // Allow all types
          className="hidden"
        />
        
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
           {/* GIF Button */}
           <button
             type="button"
             onClick={() => setShowGifPicker(!showGifPicker)}
             className="text-dark-muted hover:text-brand-primary
                        transition-colors border-2 border-current rounded px-1 text-[10px] font-bold h-6 flex items-center justify-center mr-1"
             title="Add GIF"
           >
             GIF
           </button>

          {/* Sticker Button - Premium Only */}
          {isPremiumUser(userProfile) && (
              <button
                type="button"
                onClick={() => setShowStickerPicker(!showStickerPicker)}
                className={`transition-colors ${showStickerPicker ? 'text-brand-primary' : 'text-dark-muted hover:text-brand-primary'}`}
                title="Premium Stickers"
              >
                <MdAutoAwesome size={24} />
              </button>
          )}

          {/* Emoji Button */}
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="text-dark-muted hover:text-brand-primary
                       transition-colors"
            title="Add emoji"
          >
            <MdEmojiEmotions size={24} />
          </button>
          
          {/* Send Button */}
          <button
            type="submit"
            disabled={!message.trim() || sending || userProfile?.isMuted || !canSendMessage}
            className="text-dark-muted hover:text-brand-primary
                       transition-colors disabled:opacity-50 disabled:cursor-not-allowed ml-1"
          >
            <MdSend size={24} />
          </button>
        </div>
      </form>

      {/* Poll Creator Modal */}
      {showPollCreator && (
        <PollCreator
          onSubmit={handlePollSubmit}
          onClose={() => setShowPollCreator(false)}
        />
      )}
    </div>
  );
};
