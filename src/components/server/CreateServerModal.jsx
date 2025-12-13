import { useState, useRef } from 'react';
import { Modal } from '../shared/Modal';
import { Button } from '../shared/Button';
import { Input } from '../shared/Input';
import { useToast } from '../../context/ToastContext';
import { collection, addDoc, serverTimestamp, setDoc, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { uploadToImgBB } from '../../services/imgbb';
import { MdAddPhotoAlternate } from 'react-icons/md';

export const CreateServerModal = ({ isOpen, onClose, userId, onSuccess }) => {
  const [serverName, setServerName] = useState('');
  const [serverIcon, setServerIcon] = useState(null);
  const [iconPreview, setIconPreview] = useState(null);
  const [creating, setCreating] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ progress: 0, speed: '' });
  const iconInputRef = useRef(null);
  const { success, error } = useToast();

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

    setServerIcon(file);
    setIconPreview(URL.createObjectURL(file));
  };

  const handleCreate = async () => {
    if (!serverName.trim()) {
      error('Server name is required');
      return;
    }

    setCreating(true);
    try {
      let iconUrl = null;

      // Upload icon if selected
      if (serverIcon) {
        iconUrl = await uploadToImgBB(serverIcon, (progress, speed) => {
          setUploadProgress({ progress, speed });
        });
      }

      // Create server
      const serverRef = await addDoc(collection(db, 'servers'), {
        name: serverName.trim(),
        icon: iconUrl,
        ownerId: userId,
        createdAt: serverTimestamp(),
        isDefault: false,
        memberCount: 1
      });

      // Add creator as admin member
      await setDoc(doc(db, 'servers', serverRef.id, 'members', userId), {
        userId: userId,
        joinedAt: serverTimestamp(),
        role: 'admin'
      });

      // Create default 'general' channel
      await addDoc(collection(db, 'servers', serverRef.id, 'channels'), {
        name: 'general',
        type: 'text',
        description: 'General discussion',
        position: 0,
        createdAt: serverTimestamp(),
      });

      // Add to user's servers
      await updateDoc(doc(db, 'users', userId), {
        servers: arrayUnion(serverRef.id),
        currentServer: serverRef.id
      });

      success('Server created successfully!');
      
      // Cleanup
      setServerName('');
      setServerIcon(null);
      if (iconPreview) URL.revokeObjectURL(iconPreview);
      setIconPreview(null);
      
      // Call success callback to switch to new server
      if (onSuccess) {
        onSuccess(serverRef.id);
      }
      
      onClose();
    } catch (err) {
      console.error('Error creating server:', err);
      error('Failed to create server');
    } finally {
      setCreating(false);
      setUploadProgress({ progress: 0, speed: '' });
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Server" size="sm">
      <div className="space-y-4">
        {/* Server Icon */}
        <div className="flex flex-col items-center">
          <input
            type="file"
            ref={iconInputRef}
            onChange={handleIconSelect}
            accept="image/*"
            className="hidden"
          />
          <button
            onClick={() => iconInputRef.current?.click()}
            className="w-20 h-20 rounded-full bg-dark-hover border-2 border-dashed border-dark-muted hover:border-brand-primary flex items-center justify-center transition-colors overflow-hidden"
          >
            {iconPreview ? (
              <img src={iconPreview} alt="Preview" className="w-full h-full object-cover" />
            ) : (
              <MdAddPhotoAlternate size={32} className="text-dark-muted" />
            )}
          </button>
          <span className="text-xs text-dark-muted mt-2">Server Icon (Optional)</span>
        </div>

        {/* Upload Progress */}
        {creating && serverIcon && uploadProgress.progress > 0 && (
          <div className="text-xs text-dark-muted text-center">
            Uploading icon: {Math.round(uploadProgress.progress)}% ({uploadProgress.speed})
          </div>
        )}

        <Input
          label="Server Name"
          placeholder="My Awesome Server"
          value={serverName}
          onChange={(e) => setServerName(e.target.value)}
          maxLength={50}
          autoFocus
        />
        
        <div className="text-xs text-dark-muted">
          {serverName.length}/50 characters
        </div>

        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={handleCreate} 
            disabled={!serverName.trim() || creating}
            className="flex-1"
          >
            {creating ? 'Creating...' : 'Create Server'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
