import { useState } from 'react';
import { MdSearch, MdClose } from 'react-icons/md';

export const MessageSearch = ({ messages, users, onResultClick }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);

  const handleSearch = (query) => {
    setSearchQuery(query);
    
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    const results = messages.filter(msg =>
      msg.text.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 20); // Limit to 20 results

    setSearchResults(results);
  };

  const getUserById = (userId) => {
    return users.find(u => u.id === userId) || { displayName: 'Unknown' };
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="p-2 hover:bg-dark-hover rounded transition-colors"
        title="Search messages"
      >
        <MdSearch size={20} className="text-dark-muted" />
      </button>
    );
  }

  return (
    <div className="relative flex-1 max-w-md">
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="Search messages..."
        autoFocus
        className="w-full bg-dark-input text-dark-text px-4 py-2 pr-10 rounded-lg
                   border border-transparent focus:border-brand-primary
                   outline-none transition-colors placeholder:text-dark-muted"
      />
      <button
        onClick={() => {
          setIsOpen(false);
          setSearchQuery('');
          setSearchResults([]);
        }}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-dark-muted hover:text-dark-text"
      >
        <MdClose size={20} />
      </button>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-dark-sidebar border border-dark-hover rounded-lg shadow-xl max-h-96 overflow-y-auto z-50">
          {searchResults.map((msg) => (
            <button
              key={msg.id}
              onClick={() => {
                onResultClick && onResultClick(msg);
                setIsOpen(false);
                setSearchQuery('');
                setSearchResults([]);
              }}
              className="w-full px-4 py-3 text-left hover:bg-dark-hover transition-colors border-b border-dark-hover last:border-b-0"
            >
              <div className="text-xs text-brand-primary font-semibold mb-1">
                {getUserById(msg.userId).displayName}
              </div>
              <div className="text-sm text-dark-text line-clamp-2">
                {msg.text}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
