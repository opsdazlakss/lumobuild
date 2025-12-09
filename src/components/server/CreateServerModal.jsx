import { useState } from 'react';
import { Modal } from '../shared/Modal';
import { Button } from '../shared/Button';
import { Input } from '../shared/Input';
import { useToast } from '../../context/ToastContext';
import { collection, addDoc, serverTimestamp, setDoc, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../../services/firebase';

export const CreateServerModal = ({ isOpen, onClose, userId, onSuccess }) => {
  const [serverName, setServerName] = useState('');
  const [creating, setCreating] = useState(false);
  const { success, error } = useToast();

  const handleCreate = async () => {
    if (!serverName.trim()) {
      error('Server name is required');
      return;
    }

    setCreating(true);
    try {
      // Create server
      const serverRef = await addDoc(collection(db, 'servers'), {
        name: serverName.trim(),
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
      setServerName('');
      
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
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Server" size="sm">
      <div className="space-y-4">
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
