import { useState } from 'react';
import { Modal } from '../shared/Modal';
import { Button } from '../shared/Button';
import { useToast } from '../../context/ToastContext';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { MdContentCopy, MdCheck, MdRefresh } from 'react-icons/md';

const generateCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export const InviteCodeModal = ({ isOpen, onClose, serverId }) => {
  const [inviteCode, setInviteCode] = useState('');
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const { success, error } = useToast();

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const code = generateCode();
      
      // Create invite code
      await setDoc(doc(db, 'inviteCodes', code), {
        serverId,
        createdAt: serverTimestamp(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        maxUses: 1,
        uses: 0,
        isActive: true
      });

      setInviteCode(code);
      success('Invite code generated!');
    } catch (err) {
      console.error('Error generating invite:', err);
      error('Failed to generate invite code');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteCode);
    setCopied(true);
    success('Copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Invite Code" size="sm">
      <div className="space-y-4">
        {!inviteCode ? (
          <>
            <p className="text-dark-text text-sm">
              Generate a one-time invite code for this server.
            </p>
            <Button 
              variant="primary" 
              onClick={handleGenerate} 
              disabled={generating}
              className="w-full"
            >
              {generating ? 'Generating...' : 'Generate Invite Code'}
            </Button>
          </>
        ) : (
          <>
            <div className="bg-dark-bg p-4 rounded-lg text-center">
              <div className="text-3xl font-mono font-bold text-brand-primary mb-2">
                {inviteCode}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={handleCopy}
                  className="flex-1 flex items-center justify-center gap-2"
                >
                  {copied ? (
                    <>
                      <MdCheck size={20} />
                      Copied!
                    </>
                  ) : (
                    <>
                      <MdContentCopy size={20} />
                      Copy Code
                    </>
                  )}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setInviteCode('');
                    setCopied(false);
                  }}
                  className="flex items-center justify-center gap-2 px-4"
                  title="Generate new code"
                >
                  <MdRefresh size={20} />
                </Button>
              </div>
            </div>

            <div className="text-xs text-dark-muted space-y-1">
              <div>• Expires in 24 hours</div>
              <div>• One-time use only</div>
              <div>• Share with trusted users</div>
            </div>

            <Button variant="secondary" onClick={onClose} className="w-full">
              Close
            </Button>
          </>
        )}
      </div>
    </Modal>
  );
};
