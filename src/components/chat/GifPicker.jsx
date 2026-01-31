import { useState, useRef, useEffect, useCallback } from 'react';
import { GiphyFetch } from '@giphy/js-fetch-api';
import { Grid } from '@giphy/react-components';
import { MdSearch } from 'react-icons/md';
import { Input } from '../shared/Input';

// Initialize Giphy API
// NOTE: Using a public beta key for demo purpose (sXpGF12GhPgOVoqqWhiteefDs04) if env is missing
// In production, user should provide their own key in VITE_GIPHY_API_KEY
const GIPHY_API_KEY = import.meta.env.VITE_GIPHY_API_KEY || 'sXpGF12GhPgOVoqqWhiteefDs04';
const gf = new GiphyFetch(GIPHY_API_KEY);

export const GifPicker = ({ onSelect }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [width, setWidth] = useState(400);
  const containerRef = useRef(null);

  // Responsive width
  useEffect(() => {
    if (containerRef.current) {
      setWidth(containerRef.current.offsetWidth);
    }
  }, []);

  // Fetch logic
  const fetchGifs = (offset) => {
    if (searchTerm) {
      return gf.search(searchTerm, { offset, limit: 10 });
    }
    return gf.trending({ offset, limit: 10 });
  };

  return (
    <div className="w-full h-full flex flex-col bg-dark-sidebar rounded-lg overflow-hidden border border-dark-hover">
      {/* Search Header */}
      <div className="p-3 border-b border-dark-hover">
        <div className="relative">
          <input
            type="text"
            placeholder="Search GIFs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-dark-input text-dark-text px-4 py-2 pl-10 rounded outline-none border border-transparent focus:border-brand-primary transition-all"
            autoFocus
          />
          <MdSearch 
            className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-muted" 
            size={20} 
          />
        </div>
      </div>

      {/* GIF Grid */}
      <div ref={containerRef} className="flex-1 overflow-y-auto overflow-x-hidden p-2 custom-scrollbar">
        {width > 0 && (
          <Grid
            key={searchTerm} // Reset grid on search change
            width={width - 20} // Adjust for padding
            columns={3}
            fetchGifs={fetchGifs}
            onGifClick={(gif, e) => {
              e.preventDefault();
              // Prefer original format or fixed_height
              onSelect(gif.images.original.url);
            }}
            noLink
            hideAttribution
            gutter={6}
          />
        )}
      </div>
    </div>
  );
};
