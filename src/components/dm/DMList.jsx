import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { cn, formatTimestamp } from '../../utils/helpers';
import { MdClose, MdDelete } from 'react-icons/md';

const DMListItem = ({ dm, currentUserId, isSelected, onClick, onContextMenu }) => {
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
      onContextMenu={onContextMenu}
      className={cn(
        'w-full flex items-center gap-3 px-2 py-2 rounded mb-1 group relative',
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
  const [contextMenu, setContextMenu] = useState(null);
  const [optimisticallyHidden, setOptimisticallyHidden] = useState([]);

  const handleContextMenu = (e, dm) => {
    e.preventDefault();
    setContextMenu({
      x: e.pageX,
      y: e.pageY,
      dmId: dm.id
    });
  };

  const handleDeleteDm = async (dmId) => {
      // Optimistic Update: Hide immediately
      setOptimisticallyHidden(prev => [...prev, dmId]);
      setContextMenu(null);

      if (!currentUser) return;
      try {
          const dmRef = doc(db, 'dms', dmId);
          await updateDoc(dmRef, {
              hiddenFor: arrayUnion(currentUser.uid)
          });
          // Also set selection to null if the deleted DM was selected
          if (selectedDmId === dmId) {
             onSelectDm(null);
          }
      } catch (err) {
          console.error("Error deleting DM:", err);
          // Rollback optimistic update if failed (optional, but good practice)
          setOptimisticallyHidden(prev => prev.filter(id => id !== dmId));
      }
  };

  // Close context menu on click elsewhere
  useEffect(() => {
      const handleClick = () => setContextMenu(null);
      window.addEventListener('click', handleClick);
      return () => window.removeEventListener('click', handleClick);
  }, []);
  
  // Filter DMs based on props AND optimistic state
  const visibleDms = dms?.filter(dm => !optimisticallyHidden.includes(dm.id)) || [];
  
  if (visibleDms.length === 0) {
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
          {visibleDms.map((dm) => (
            <DMListItem
              key={dm.id}
              dm={dm}
              currentUserId={currentUser.uid}
              isSelected={selectedDmId === dm.id}
              onClick={() => onSelectDm(dm)}
              onContextMenu={(e) => handleContextMenu(e, dm)}
            />
          ))}
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
          <div 
              className="fixed bg-dark-sidebar border border-dark-hover shadow-xl rounded-md z-50 py-1 min-w-[160px]"
              style={{ top: contextMenu.y, left: contextMenu.x }}
          >
              <button 
                  onClick={() => handleDeleteDm(contextMenu.dmId)}
                  className="w-full text-left px-4 py-2 hover:bg-red-500/10 text-red-400 hover:text-red-500 text-sm flex items-center gap-2 transition-colors"
              >
                  <MdDelete size={16} />
                  Delete Conversation
              </button>
          </div>
      )}
    </div>
  );
};
