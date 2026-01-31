import { useState } from 'react';
import { MdClose } from 'react-icons/md';
import { PREDEFINED_STATUSES } from '../../utils/statusData';

export const StatusSelector = ({ currentStatus, onStatusChange, onClose }) => {
  const [customMode, setCustomMode] = useState(false);
  const [customEmoji, setCustomEmoji] = useState('✨');
  const [customText, setCustomText] = useState('');

  const handleSelectStatus = (status) => {
    onStatusChange(status);
    onClose();
  };

  const handleSetCustom = () => {
    if (!customText.trim()) return;
    
    onStatusChange({
      emoji: customEmoji,
      text: customText.trim(),
      type: 'custom'
    });
    onClose();
  };

  const handleClearStatus = () => {
    onStatusChange(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-dark-sidebar rounded-lg p-6 w-96 max-w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-dark-text">Set Status</h3>
          <button
            onClick={onClose}
            className="text-dark-muted hover:text-dark-text transition-colors"
          >
            <MdClose size={24} />
          </button>
        </div>

        {!customMode ? (
          <>
            {/* Predefined Statuses */}
            <div className="space-y-2 mb-4">
              {PREDEFINED_STATUSES.map((status) => (
                <button
                  key={status.type}
                  onClick={() => handleSelectStatus(status)}
                  className="w-full px-4 py-3 rounded-lg bg-dark-bg hover:bg-dark-hover transition-colors text-left flex items-center gap-3"
                >
                  <span className="text-2xl">{status.emoji}</span>
                  <span className="text-dark-text">{status.text}</span>
                </button>
              ))}
            </div>

            {/* Custom Status Button */}
            <button
              onClick={() => setCustomMode(true)}
              className="w-full px-4 py-3 rounded-lg bg-brand-primary hover:bg-brand-primary/80 transition-colors text-white font-medium"
            >
              ✨ Custom Status
            </button>

            {/* Clear Status */}
            {currentStatus && (
              <button
                onClick={handleClearStatus}
                className="w-full mt-2 px-4 py-2 rounded-lg bg-dark-bg hover:bg-dark-hover transition-colors text-admin text-sm"
              >
                Clear Status
              </button>
            )}
          </>
        ) : (
          <>
            {/* Custom Status Input */}
            <div className="space-y-4">
              <div>
                <label className="text-sm text-dark-muted mb-2 block">Emoji</label>
                <input
                  type="text"
                  value={customEmoji}
                  onChange={(e) => setCustomEmoji(e.target.value.slice(0, 2))}
                  className="w-full bg-dark-input text-dark-text px-4 py-2 rounded-lg text-2xl text-center"
                  placeholder="✨"
                  maxLength={2}
                />
              </div>

              <div>
                <label className="text-sm text-dark-muted mb-2 block">Status Text</label>
                <input
                  type="text"
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  className="w-full bg-dark-input text-dark-text px-4 py-2 rounded-lg"
                  placeholder="What's on your mind?"
                  maxLength={50}
                  autoFocus
                />
                <div className="text-xs text-dark-muted mt-1 text-right">
                  {customText.length}/50
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setCustomMode(false)}
                  className="flex-1 px-4 py-2 rounded-lg bg-dark-bg hover:bg-dark-hover transition-colors text-dark-text"
                >
                  Back
                </button>
                <button
                  onClick={handleSetCustom}
                  disabled={!customText.trim()}
                  className="flex-1 px-4 py-2 rounded-lg bg-brand-primary hover:bg-brand-primary/80 transition-colors text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Set Status
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
