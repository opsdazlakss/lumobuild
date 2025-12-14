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
  const [isUnlimited, setIsUnlimited] = useState(false);
  const { success, error } = useToast();

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const code = generateCode();
      
      // Create invite code
      await setDoc(doc(db, 'inviteCodes', code), {
        serverId,
        createdAt: serverTimestamp(),
        expiresAt: new Date(Date.now() + (isUnlimited ? 365 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000)), // 24 hours or 1 year
        maxUses: isUnlimited ? -1 : 1,
        uses: 0,
        isActive: true,
        isUnlimited
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
            <div className="space-y-2">
              <p className="text-dark-text text-sm">
                Generate an invite code for this server.
              </p>
              
              <label className="flex items-center gap-2 p-3 rounded bg-dark-bg cursor-pointer hover:bg-opacity-80 transition-colors">
                <input
                  type="checkbox"
                  checked={isUnlimited}
                  onChange={(e) => setIsUnlimited(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-600 bg-dark-bg text-brand-primary focus:ring-brand-primary"
                />
                <div className="flex flex-col">
                  <span className="text-white text-sm font-medium">Unlimited Uses</span>
                  <span className="text-dark-muted text-xs">Code will not expire after one use</span>
                </div>
              </label>
            </div>

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
                    setIsUnlimited(false);
                  }}
                  className="flex items-center justify-center gap-2 px-4"
                  title="Generate new code"
                >
                  <MdRefresh size={20} />
                </Button>
              </div>
            </div>

            <div className="text-xs text-dark-muted space-y-1">
              <div>• {isUnlimited ? 'Expires in 1 year' : 'Expires in 24 hours'}</div>
              <div>• {isUnlimited ? 'Unlimited uses' : 'One-time use only'}</div>
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
