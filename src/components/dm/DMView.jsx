import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { MessageList } from '../chat/MessageList';
import { MessageInput } from '../chat/MessageInput';
import { MessageSearch } from '../chat/MessageSearch';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { StatusIndicator } from '../shared/StatusIndicator';
import { MdCall, MdVideocam } from 'react-icons/md';
import { useCall } from '../../context/CallContext';

export const DMView = ({ dmId, dms }) => {
  const { currentUser, userProfile } = useAuth();
  const { users } = useData(); // May be empty if in Home view
  const { startCall } = useCall();
  const [otherUser, setOtherUser] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [messages, setMessages] = useState([]);

  const dm = dms.find(d => d.id === dmId);
  const otherUserId = dm?.participants.find(id => id !== currentUser?.uid);

  useEffect(() => {
    const fetchUser = async () => {
      if (!otherUserId) return;
      try {
        const userDoc = await getDoc(doc(db, 'users', otherUserId));
        if (userDoc.exists()) {
          setOtherUser({ id: userDoc.id, ...userDoc.data() });
        }
      } catch (err) {
        console.error('Error fetching DM user:', err);
      }
    };
    fetchUser();
  }, [otherUserId]);

  const dmUsers = useMemo(() => [
    { 
      id: currentUser.uid, 
      displayName: currentUser.displayName || userProfile?.displayName || 'User', 
      photoUrl: currentUser.photoURL || userProfile?.photoUrl, 
      role: userProfile?.role 
    },
    otherUser
  ].filter(Boolean), [currentUser, userProfile, otherUser]);

  if (!dm) return <div className="flex-1 flex items-center justify-center text-dark-muted">Select a conversation</div>;

  return (
    <div className="flex-1 flex flex-col h-full bg-dark-bg">
      {/* DM Header */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-dark-hover shadow-sm bg-dark-bg">
        <div className="flex items-center gap-3">
          <div className="relative">
             {otherUser?.photoUrl ? (
               <img src={otherUser.photoUrl} alt={otherUser.displayName} className="w-8 h-8 rounded-full object-cover" />
             ) : (
               <div className="w-8 h-8 rounded-full bg-brand-primary flex items-center justify-center text-white text-sm font-bold">
                 {otherUser?.displayName?.[0]?.toUpperCase() || '?'}
               </div>
             )}
             {/* We can add status indicator if we have presence data */}
          </div>
          <span className="font-semibold text-dark-text">{otherUser?.displayName || 'Loading...'}</span>
        </div>
        
        <div className="flex items-center gap-3">
           <button 
             onClick={() => startCall(otherUser, 'voice')}
             className="text-dark-muted hover:text-dark-text transition-colors p-1 rounded hover:bg-dark-hover"
             title="Start Voice Call"
             disabled={!otherUser}
           >
             <MdCall size={22} />
           </button>
           <button 
             onClick={() => startCall(otherUser, 'video')}
             className="text-dark-muted hover:text-dark-text transition-colors p-1 rounded hover:bg-dark-hover"
             title="Start Video Call"
             disabled={!otherUser}
           >
             <MdVideocam size={22} />
           </button>
           
           <div className="w-px h-6 bg-dark-hover mx-1" />
           
           <MessageSearch
             messages={messages}
             users={dmUsers}
             onResultClick={(msg) => document.getElementById(`message-${msg.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
           />
        </div>
      </div>

      {/* Messages */}
      <MessageList 
        serverId={null} // Indicates DM
        channelId={dmId} // Treated as channelId
        users={dmUsers} // Use local DM users list
        currentUserId={currentUser?.uid}
        userRole={userProfile?.role}
        onReply={setReplyingTo}
        onMessagesChange={setMessages}
      />
      
      <MessageInput
        serverId={null}
        channelId={dmId}
        channel={{ id: dmId, name: otherUser?.displayName }}
        userId={currentUser?.uid}
        userProfile={userProfile}
        userRole={userProfile?.role}
        users={dmUsers}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
      />
    </div>
  );
};
