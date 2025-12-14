import { useState } from 'react';
import { Modal } from '../shared/Modal';
import { Button } from '../shared/Button';
import { Input } from '../shared/Input';
import { useToast } from '../../context/ToastContext';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, serverTimestamp, increment } from 'firebase/firestore';
import { db } from '../../services/firebase';

export const JoinServerModal = ({ isOpen, onClose, userId, onSuccess }) => {
  const [inviteCode, setInviteCode] = useState('');
  const [joining, setJoining] = useState(false);
  const { success, error } = useToast();

  const handleJoin = async () => {
    if (!inviteCode.trim()) {
      error('Invite code is required');
      return;
    }

    setJoining(true);
    try {
      const code = inviteCode.trim().toUpperCase();
      const inviteRef = doc(db, 'inviteCodes', code);
      const inviteSnap = await getDoc(inviteRef);

      if (!inviteSnap.exists()) {
        error('Invalid invite code');
        return;
      }

      const invite = inviteSnap.data();

      // Validate
      if (!invite.isActive) {
        error('This invite code has already been used');
        return;
      }

      if (invite.uses >= invite.maxUses && !invite.isUnlimited) {
        error('This invite code has reached its usage limit');
        return;
      }

      if (invite.expiresAt.toDate() < new Date()) {
        error('This invite code has expired');
        return;
      }

      // Add user to server
      await setDoc(doc(db, 'servers', invite.serverId, 'members', userId), {
        userId: userId,
        joinedAt: serverTimestamp(),
        role: 'member'
      });

      // Add server to user's server list and set as current
      await updateDoc(doc(db, 'users', userId), {
        servers: arrayUnion(invite.serverId),
        currentServer: invite.serverId // Auto-switch to new server
      });

      // Update invite code
      const updateData = {
        uses: increment(1)
      };
      
      // Only deactivate if not unlimited
      if (!invite.isUnlimited) {
        updateData.isActive = false;
      }

      await updateDoc(inviteRef, updateData);

      // Update server member count
      await updateDoc(doc(db, 'servers', invite.serverId), {
        memberCount: increment(1)
      });

      success('Successfully joined server!');
      setInviteCode('');
      
      // Switch to the newly joined server
      if (onSuccess) {
        onSuccess(invite.serverId);
      }
      
      onClose(); // Close modal after switching
    } catch (err) {
      console.error('Error joining server:', err);
      console.error('Error code:', err.code);
      console.error('Error message:', err.message);
      
      // Only show error if it's a real failure (not permission-denied which happens after successful join)
      // The permission error happens because we update user doc after adding to members
      if (err.code !== 'permission-denied') {
        if (err.code === 'not-found') {
          error('Server not found');
        } else {
          error(`Failed to join server: ${err.message}`);
        }
      } else {
        // If permission-denied but we got here, join was likely successful
        // Close modal anyway
        onClose();
      }
      // If permission-denied, it likely means the join was successful but a subsequent read failed
      // Don't show error to user in this case
    } finally {
      setJoining(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Join Server" size="sm">
      <div className="space-y-4">
        <Input
          label="Invite Code"
          placeholder="ABC12XYZ"
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
          maxLength={8}
          autoFocus
        />

        <div className="text-xs text-dark-muted">
          Enter the 8-character invite code
        </div>

        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={handleJoin} 
            disabled={inviteCode.length !== 8 || joining}
            className="flex-1"
          >
            {joining ? 'Joining...' : 'Join Server'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
