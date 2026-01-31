import { useState } from 'react';
import { emojiCategories, popularEmojis } from '../../utils/emojiData';
import { MdClose } from 'react-icons/md';

export const EmojiPicker = ({ onSelect, onClose }) => {
  const [activeCategory, setActiveCategory] = useState('smileys');

  return (
    <div className="absolute bottom-full right-0 mb-2 bg-dark-sidebar border border-dark-hover rounded-lg shadow-xl w-80 z-50">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-dark-hover">
        <span className="text-sm font-semibold text-dark-text">Emoji Picker</span>
        <button
          onClick={onClose}
          className="text-dark-muted hover:text-dark-text transition-colors"
        >
          <MdClose size={18} />
        </button>
      </div>

      {/* Popular Emojis */}
      <div className="p-3 border-b border-dark-hover">
        <div className="text-xs text-dark-muted mb-2 font-semibold">POPULAR</div>
        <div className="grid grid-cols-10 gap-1">
          {popularEmojis.map((emoji, idx) => (
            <button
              key={idx}
              onClick={() => onSelect(emoji)}
              className="text-2xl hover:bg-dark-hover rounded p-1 transition-colors"
              title={emoji}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-1 p-2 border-b border-dark-hover overflow-x-auto">
        {Object.entries(emojiCategories).map(([key, category]) => (
          <button
            key={key}
            onClick={() => setActiveCategory(key)}
            className={`text-xl p-2 rounded transition-colors ${
              activeCategory === key
                ? 'bg-brand-primary/20 text-brand-primary'
                : 'hover:bg-dark-hover text-dark-muted'
            }`}
            title={category.name}
          >
            {category.icon}
          </button>
        ))}
      </div>

      {/* Emoji Grid */}
      <div className="p-3 h-64 overflow-y-auto">
        <div className="grid grid-cols-8 gap-1">
          {emojiCategories[activeCategory].emojis.map((emoji, idx) => (
            <button
              key={idx}
              onClick={() => onSelect(emoji)}
              className="text-2xl hover:bg-dark-hover rounded p-1 transition-colors"
              title={emoji}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
