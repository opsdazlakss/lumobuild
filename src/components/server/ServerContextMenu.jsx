import { useState, useRef } from 'react';
import { MdEdit, MdDelete, MdExitToApp, MdUpload } from 'react-icons/md';
import { doc, updateDoc, deleteDoc, collection, getDocs, arrayRemove, increment } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { uploadToImgBB } from '../../services/imgbb';
import { useToast } from '../../context/ToastContext';
import { Input } from '../shared/Input';
import { Button } from '../shared/Button';
import { ConfirmDialog } from '../shared/ConfirmDialog';

export const ServerContextMenu = ({ server, onClose, onDelete, position, userRole, userId }) => {
  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState(server.name);
  const [updating, setUpdating] = useState(false);
  const [editingIcon, setEditingIcon] = useState(false);
  const [iconPreview, setIconPreview] = useState(server.icon || null);
  const [iconFile, setIconFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState({ progress: 0, speed: '' });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const iconInputRef = useRef(null);
  const { success, error } = useToast();

  const handleUpdate = async () => {
    if (!newName.trim()) {
      error('Server name is required');
      return;
    }

    setUpdating(true);
    try {
      await updateDoc(doc(db, 'servers', server.id), {
        name: newName.trim()
      });
      success('Server updated!');
      setEditing(false);
      onClose();
    } catch (err) {
      console.error('Error updating server:', err);
      error('Failed to update server');
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    try {
      // Get all members of this server
      const membersRef = collection(db, 'servers', server.id, 'members');
      const membersSnap = await getDocs(membersRef);
      
      // Remove server from all users' servers array
      const updatePromises = [];
      membersSnap.forEach((memberDoc) => {
        const memberId = memberDoc.data().userId;
        updatePromises.push(
          updateDoc(doc(db, 'users', memberId), {
            servers: arrayRemove(server.id),
            // If this was their current server, clear it
            ...(memberDoc.data().currentServer === server.id ? { currentServer: null } : {})
          })
        );
      });

      // Wait for all user updates
      await Promise.all(updatePromises);

      // Delete the server (this will trigger real-time updates)
      await deleteDoc(doc(db, 'servers', server.id));
      
      success('Server deleted');
      setShowDeleteConfirm(false);
      onDelete();
      onClose();
    } catch (err) {
      console.error('Error deleting server:', err);
      error('Failed to delete server');
      setShowDeleteConfirm(false);
    }
  };

  const handleLeave = async () => {
    try {
      // Remove from user's servers array
      await updateDoc(doc(db, 'users', userId), {
        servers: arrayRemove(server.id),
        currentServer: null
      });

      // Remove from server members
      await deleteDoc(doc(db, 'servers', server.id, 'members', userId));

      // Update member count
      await updateDoc(doc(db, 'servers', server.id), {
        memberCount: increment(-1)
      });

      success('Left server');
      setShowLeaveConfirm(false);
      onClose();
    } catch (err) {
      console.error('Error leaving server:', err);
      // Don't show error toast - just close
      setShowLeaveConfirm(false);
      onClose();
    }
  };

  const handleIconSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      error('Please select an image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      error('Image size must be less than 10MB');
      return;
    }

    setIconFile(file);
    setIconPreview(URL.createObjectURL(file));
  };

  const handleIconUpload = async () => {
    if (!iconFile) {
      error('Please select an image first');
      return;
    }

    setUpdating(true);
    try {
      const iconUrl = await uploadToImgBB(iconFile, (progress, speed) => {
        setUploadProgress({ progress, speed });
      });

      await updateDoc(doc(db, 'servers', server.id), {
        icon: iconUrl
      });

      success('Server icon updated!');
      setEditingIcon(false);
      onClose();
    } catch (err) {
      console.error('Error updating icon:', err);
      error('Failed to update icon');
    } finally {
      setUpdating(false);
      setUploadProgress({ progress: 0, speed: '' });
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed bg-dark-sidebar border border-dark-hover rounded-lg shadow-xl py-2 z-50 w-64"
        style={{ top: position.y, left: position.x }}
      >
        {editing ? (
          <div className="px-3 py-2 space-y-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Server name"
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => setEditing(false)}
                className="flex-1 text-xs py-1"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleUpdate}
                disabled={updating}
                className="flex-1 text-xs py-1"
              >
                {updating ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        ) : editingIcon ? (
          <div className="px-3 py-2 space-y-3">
            {/* Hidden file input */}
            <input
              type="file"
              ref={iconInputRef}
              onChange={handleIconSelect}
              accept="image/*"
              className="hidden"
            />
            
            {/* Preview and select button */}
            <div className="flex flex-col items-center">
              <button
                onClick={() => iconInputRef.current?.click()}
                className="w-16 h-16 rounded-full bg-dark-hover border-2 border-dashed border-dark-muted hover:border-brand-primary flex items-center justify-center transition-colors overflow-hidden"
              >
                {iconPreview ? (
                  <img src={iconPreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <MdUpload size={24} className="text-dark-muted" />
                )}
              </button>
              <span className="text-xs text-dark-muted mt-2">Click to select image</span>
            </div>

            {/* Upload Progress */}
            {updating && uploadProgress.progress > 0 && (
              <div className="text-xs text-center text-dark-muted">
                {Math.round(uploadProgress.progress)}% ({uploadProgress.speed})
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setEditingIcon(false);
                  setIconFile(null);
                  setIconPreview(server.icon || null);
                }}
                className="flex-1 text-xs py-1"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleIconUpload}
                disabled={updating || !iconFile}
                className="flex-1 text-xs py-1"
              >
                {updating ? 'Uploading...' : 'Save'}
              </Button>
            </div>
          </div>
        ) : (
          <>
            {userRole === 'admin' ? (
              <>
                <button
                  onClick={() => setEditing(true)}
                  className="w-full px-4 py-2 text-left text-sm text-dark-text hover:bg-dark-hover transition-colors flex items-center gap-2"
                >
                  <MdEdit size={16} />
                  Edit Server Name
                </button>
                <button
                  onClick={() => setEditingIcon(true)}
                  className="w-full px-4 py-2 text-left text-sm text-dark-text hover:bg-dark-hover transition-colors flex items-center gap-2"
                >
                  <MdUpload size={16} />
                  Change Icon
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full px-4 py-2 text-left text-sm text-admin hover:bg-dark-hover transition-colors flex items-center gap-2"
                >
                  <MdDelete size={16} />
                  Delete Server
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowLeaveConfirm(true)}
                className="w-full px-4 py-2 text-left text-sm text-orange-500 hover:bg-dark-hover transition-colors flex items-center gap-2"
              >
                <MdExitToApp size={16} />
                Leave Server
              </button>
            )}
          </>
        )}
      </div>

      {/* Confirm Dialogs */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Server"
        message={`Are you sure you want to delete "${server.name}"? This action cannot be undone!`}
        confirmText="Delete"
        confirmVariant="danger"
      />

      <ConfirmDialog
        isOpen={showLeaveConfirm}
        onClose={() => setShowLeaveConfirm(false)}
        onConfirm={handleLeave}
        title="Leave Server"
        message={`Are you sure you want to leave "${server.name}"?`}
        confirmText="Leave"
        confirmVariant="warning"
      />
    </>
  );
};
