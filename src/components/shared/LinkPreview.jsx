import { useState, useEffect, useRef } from 'react';
import { MdOpenInNew, MdPlayCircle, MdMusicNote } from 'react-icons/md';
import { FaTwitter, FaSpotify, FaYoutube } from 'react-icons/fa';

// URL Detection Patterns
const YOUTUBE_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
const SPOTIFY_REGEX = /(?:https?:\/\/)?(?:open\.)?spotify\.com\/(track|album|playlist|artist|episode|show)\/([a-zA-Z0-9]+)/;
const TWITTER_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/(\w+)\/status\/(\d+)/;

// Extract video ID from YouTube URL
const getYouTubeId = (url) => {
  const match = url.match(YOUTUBE_REGEX);
  return match ? match[1] : null;
};

// Extract Spotify type and ID
const getSpotifyInfo = (url) => {
  const match = url.match(SPOTIFY_REGEX);
  return match ? { type: match[1], id: match[2] } : null;
};

// Extract Twitter status ID
const getTwitterInfo = (url) => {
  const match = url.match(TWITTER_REGEX);
  return match ? { user: match[1], id: match[2] } : null;
};

// Detect link type
export const detectLinkType = (url) => {
  if (YOUTUBE_REGEX.test(url)) return 'youtube';
  if (SPOTIFY_REGEX.test(url)) return 'spotify';
  if (TWITTER_REGEX.test(url)) return 'twitter';
  return 'generic';
};

// Extract all URLs from text
export const extractUrls = (text) => {
  const urlRegex = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g;
  return text.match(urlRegex) || [];
};

// YouTube Embed Component
const YouTubeEmbed = ({ url }) => {
  const videoId = getYouTubeId(url);
  const [showPlayer, setShowPlayer] = useState(false);
  
  if (!videoId) return null;
  
  const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
  
  return (
    <div className="mt-2 max-w-md rounded-lg overflow-hidden border border-dark-hover bg-dark-sidebar">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-dark-hover">
        <FaYoutube className="text-red-500" size={18} />
        <span className="text-xs text-dark-muted font-medium">YouTube</span>
      </div>
      
      {showPlayer ? (
        <div className="relative pt-[56.25%]">
          <iframe
            className="absolute inset-0 w-full h-full"
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
            title="YouTube video"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        <div 
          className="relative cursor-pointer group"
          onClick={() => setShowPlayer(true)}
        >
          <img 
            src={thumbnailUrl} 
            alt="YouTube thumbnail"
            className="w-full h-auto"
            onError={(e) => {
              e.target.src = `https://img.youtube.com/vi/${videoId}/default.jpg`;
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/50 transition-colors">
            <MdPlayCircle className="text-white/90 group-hover:text-white group-hover:scale-110 transition-all" size={64} />
          </div>
        </div>
      )}
      
      {/* Footer */}
      <div className="px-3 py-2 flex items-center justify-between">
        <span className="text-xs text-dark-muted truncate">{url}</span>
        <a 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-dark-muted hover:text-brand-primary transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          <MdOpenInNew size={16} />
        </a>
      </div>
    </div>
  );
};

// Spotify Embed Component
const SpotifyEmbed = ({ url }) => {
  const info = getSpotifyInfo(url);
  
  if (!info) return null;
  
  // Spotify embed height varies by content type
  const heights = {
    track: 152,
    album: 352,
    playlist: 352,
    artist: 352,
    episode: 232,
    show: 232,
  };
  
  const height = heights[info.type] || 152;
  
  return (
    <div className="mt-2 max-w-md rounded-lg overflow-hidden border border-dark-hover bg-dark-sidebar">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-dark-hover">
        <FaSpotify className="text-green-500" size={18} />
        <span className="text-xs text-dark-muted font-medium">Spotify {info.type}</span>
      </div>
      
      <iframe
        src={`https://open.spotify.com/embed/${info.type}/${info.id}?utm_source=generator&theme=0`}
        width="100%"
        height={height}
        frameBorder="0"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
        className="bg-transparent"
      />
      
      {/* Footer */}
      <div className="px-3 py-2 flex items-center justify-between border-t border-dark-hover">
        <span className="text-xs text-dark-muted truncate">{url}</span>
        <a 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-dark-muted hover:text-green-500 transition-colors"
        >
          <MdOpenInNew size={16} />
        </a>
      </div>
    </div>
  );
};

// Twitter/X Embed Component
const TwitterEmbed = ({ url }) => {
  const containerRef = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  
  useEffect(() => {
    // Load Twitter widget script if not already loaded
    if (!window.twttr) {
      const script = document.createElement('script');
      script.src = 'https://platform.twitter.com/widgets.js';
      script.async = true;
      script.onload = () => {
        if (window.twttr && containerRef.current) {
          renderTweet();
        }
      };
      script.onerror = () => setError(true);
      document.body.appendChild(script);
    } else {
      renderTweet();
    }
  }, [url]);
  
  const renderTweet = () => {
    if (window.twttr && containerRef.current) {
      // Clear previous content
      containerRef.current.innerHTML = '';
      
      window.twttr.widgets.createTweet(
        getTwitterInfo(url)?.id,
        containerRef.current,
        { theme: 'dark', conversation: 'none' }
      ).then((el) => {
        setLoaded(!!el);
        if (!el) setError(true);
      }).catch(() => setError(true));
    }
  };
  
  if (error) {
    return (
      <div className="mt-2 max-w-md rounded-lg overflow-hidden border border-dark-hover bg-dark-sidebar p-3">
        <div className="flex items-center gap-2 text-dark-muted">
          <FaTwitter className="text-sky-400" size={18} />
          <span className="text-sm">Tweet could not be loaded</span>
          <a 
            href={url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="ml-auto text-brand-primary hover:underline text-sm"
          >
            View on X
          </a>
        </div>
      </div>
    );
  }
  
  return (
    <div className="mt-2 max-w-md">
      {!loaded && (
        <div className="rounded-lg border border-dark-hover bg-dark-sidebar p-4 animate-pulse">
          <div className="flex items-center gap-2">
            <FaTwitter className="text-sky-400" size={18} />
            <span className="text-sm text-dark-muted">Loading tweet...</span>
          </div>
        </div>
      )}
      <div ref={containerRef} className={loaded ? '' : 'hidden'} />
    </div>
  );
};

// Generic Link Card (fallback)
const GenericLinkCard = ({ url }) => {
  // Try to extract domain for display
  let domain = '';
  try {
    domain = new URL(url).hostname.replace('www.', '');
  } catch {
    domain = url;
  }
  
  return (
    <a 
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 flex items-center gap-3 max-w-md rounded-lg border border-dark-hover bg-dark-sidebar p-3 hover:bg-dark-hover transition-colors group"
    >
      <div className="w-10 h-10 rounded-lg bg-brand-primary/20 flex items-center justify-center">
        <MdOpenInNew className="text-brand-primary" size={20} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-dark-text truncate group-hover:text-brand-primary transition-colors">
          {domain}
        </div>
        <div className="text-xs text-dark-muted truncate">
          {url}
        </div>
      </div>
    </a>
  );
};

// Main LinkPreview Component
export const LinkPreview = ({ url }) => {
  const type = detectLinkType(url);
  
  switch (type) {
    case 'youtube':
      return <YouTubeEmbed url={url} />;
    case 'spotify':
      return <SpotifyEmbed url={url} />;
    case 'twitter':
      return <TwitterEmbed url={url} />;
    default:
      return <GenericLinkCard url={url} />;
  }
};

// Component to render all link previews from a message
export const MessageLinkPreviews = ({ text }) => {
  const urls = extractUrls(text);
  
  // Only show first 3 embeds to prevent spam
  const previewUrls = urls.slice(0, 3);
  
  if (previewUrls.length === 0) return null;
  
  return (
    <div className="space-y-2">
      {previewUrls.map((url, index) => (
        <LinkPreview key={`${url}-${index}`} url={url} />
      ))}
    </div>
  );
};
