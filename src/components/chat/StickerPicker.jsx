import { useState, useRef, useEffect } from 'react';
import { GiphyFetch } from '@giphy/js-fetch-api';
import { Grid } from '@giphy/react-components';
import { MdSearch } from 'react-icons/md';

// Initialize Giphy API (Reuse key)
const GIPHY_API_KEY = import.meta.env.VITE_GIPHY_API_KEY || 'sXpGF12GhPgOVoqqWhiteefDs04';
const gf = new GiphyFetch(GIPHY_API_KEY);

export const StickerPicker = ({ onSelect }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [width, setWidth] = useState(400);
  const containerRef = useRef(null);

  // Responsive width
  useEffect(() => {
    if (containerRef.current) {
      setWidth(containerRef.current.offsetWidth);
    }
  }, []);

  // Fetch logic for STICKERS
  const fetchStickers = (offset) => {
    if (searchTerm) {
      return gf.search(searchTerm, { offset, limit: 10, type: 'stickers' });
    }
    return gf.trending({ offset, limit: 10, type: 'stickers' });
  };

  return (
    <div className="w-full h-full flex flex-col bg-dark-sidebar rounded-lg overflow-hidden border border-dark-hover">
      {/* Search Header */}
      <div className="p-3 border-b border-dark-hover bg-brand-primary/10">
        <div className="relative">
          <input
            type="text"
            placeholder="Search Premium Stickers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-dark-input text-dark-text px-4 py-2 pl-10 rounded outline-none border border-transparent focus:border-brand-primary transition-all placeholder:text-dark-muted"
            autoFocus
          />
          <MdSearch 
            className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-muted" 
            size={20} 
          />
        </div>
      </div>

      {/* Helper Text */}
      <div className="px-3 py-1 bg-brand-primary/5 text-[10px] text-brand-primary text-center font-bold tracking-wider uppercase">
        Premium Stickers
      </div>

      {/* Grid */}
      <div ref={containerRef} className="flex-1 overflow-y-auto overflow-x-hidden p-2 custom-scrollbar">
        {width > 0 && (
          <Grid
            key={searchTerm}
            width={width - 20}
            columns={3}
            fetchGifs={fetchStickers}
            onGifClick={(gif, e) => {
              e.preventDefault();
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
