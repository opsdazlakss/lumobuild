import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { cn, formatTimestamp } from '../../utils/helpers';
import { MdClose } from 'react-icons/md';

const DMListItem = ({ dm, currentUserId, isSelected, onClick }) => {
  const otherUserId = dm.participants.find(id => id !== currentUserId);
  const [otherUser, setOtherUser] = useState(null);

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

  if (!otherUser) return null; // Loading skeleton could go here

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-2 py-2 rounded mb-1 group',
        'text-dark-muted hover:bg-dark-hover hover:text-dark-text',
        'transition-colors duration-150',
        isSelected && 'bg-dark-hover text-dark-text'
      )}
    >
      <div className="relative">
        {otherUser.photoUrl ? (
          <img 
            src={otherUser.photoUrl} 
            alt={otherUser.displayName} 
            className="w-8 h-8 rounded-full object-cover"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-brand-primary flex items-center justify-center text-white text-sm font-bold">
            {otherUser.displayName?.[0]?.toUpperCase()}
          </div>
        )}
        {/* Status indicator could be added here if we had global presence */}
      </div>
      
      <div className="flex-1 text-left overflow-hidden">
        <div className="text-sm font-medium truncate flex justify-between items-center">
             <span>{otherUser.displayName}</span>
             {dm.updatedAt && (
                <span className="text-[10px] text-gray-500 hidden group-hover:block">
                  {formatTimestamp(dm.updatedAt)}
                </span>
             )}
        </div>
        <div className="text-xs truncate opacity-70">
           {dm.lastMessage?.text || 'Start a conversation'}
        </div>
      </div>
    </button>
  );
};

export const DMList = ({ dms, selectedDmId, onSelectDm }) => {
  const { currentUser } = useAuth();
  
  if (!dms || dms.length === 0) {
      return (
          <div className="px-4 py-8 text-center text-dark-muted text-sm">
              <p>No conversations yet.</p>
              <p className="mt-2">Start a DM from the friends list!</p>
          </div>
      );
  }

  return (
    <div className="flex-1 overflow-y-auto py-3">
      <div className="px-2">
        <div className="text-xs font-semibold text-dark-muted uppercase px-2 mb-2 flex justify-between items-center">
          <span>Direct Messages</span>
        </div>
        
        <div className="space-y-0.5">
          {dms.map((dm) => (
            <DMListItem
              key={dm.id}
              dm={dm}
              currentUserId={currentUser.uid}
              isSelected={selectedDmId === dm.id}
              onClick={() => onSelectDm(dm)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
