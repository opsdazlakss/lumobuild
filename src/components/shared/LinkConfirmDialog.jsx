import { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';

export const LinkConfirmDialog = ({ isOpen, onClose, onConfirm, url }) => {
  const [dontAskAgain, setDontAskAgain] = useState(false);

  const handleConfirm = () => {
    if (dontAskAgain) {
      localStorage.setItem('dontAskExternalLinks', 'true');
    }
    onConfirm();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="External Link Warning" size="sm">
      <div className="space-y-4">
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
          <p className="text-dark-text text-sm">
            <span className="font-semibold text-yellow-500">⚠️ Security Warning</span>
            <br />
            <br />
            You are about to open an external link. External links may lead to harmful or malicious websites. 
            Please ensure you trust the source before proceeding.
          </p>
        </div>

        <div className="bg-dark-bg p-3 rounded-lg">
          <p className="text-xs text-dark-muted mb-1">Link:</p>
          <p className="text-dark-text text-sm break-all font-mono">{url}</p>
        </div>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={dontAskAgain}
            onChange={(e) => setDontAskAgain(e.target.checked)}
            className="w-4 h-4 rounded border-dark-hover bg-dark-input text-brand-primary 
                       focus:ring-2 focus:ring-brand-primary cursor-pointer"
          />
          <span className="text-sm text-dark-text">Don't ask me again</span>
        </label>

        <div className="flex gap-3 justify-end pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleConfirm}>
            Open Link
          </Button>
        </div>
      </div>
    </Modal>
  );
};
