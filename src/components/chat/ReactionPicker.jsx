import { useState } from 'react';

const COMMON_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '😡', '🎉', '🔥', '💯', '👀'];

export const ReactionPicker = ({ onSelect, onClose }) => {
  return (
    <>
      <div 
        className="fixed inset-0 z-40" 
        onClick={onClose}
      />
      <div className="absolute left-0 bottom-full mb-2 bg-dark-sidebar border border-dark-hover rounded-lg shadow-lg p-2 z-50">
        <div className="flex gap-1">
          {COMMON_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => onSelect(emoji)}
              className="w-8 h-8 flex items-center justify-center text-lg hover:bg-dark-hover rounded transition-colors"
              title={emoji}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </>
  );
};
