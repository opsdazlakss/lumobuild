import { Modal } from './Modal';
import { MdClose, MdDownload, MdOpenInNew } from 'react-icons/md';

export const MediaViewerModal = ({ isOpen, onClose, mediaUrl, mediaType = 'image' }) => {
  if (!mediaUrl) return null;

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = mediaUrl;
    link.download = mediaUrl.split('/').pop() || 'download';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenExternal = () => {
    // Check if running in Electron
    if (window.electron && window.electron.shell) {
      window.electron.shell.openExternal(mediaUrl);
    } else {
      // Fallback for web
      window.open(mediaUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="" size="full" showCloseButton={false}>
      <div className="fixed inset-0 bg-black/95 flex flex-col z-50">
        {/* Header with controls */}
        <div className="flex items-center justify-between p-4 bg-black/50 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white"
              title="Download"
            >
              <MdDownload size={24} />
            </button>
            <button
              onClick={handleOpenExternal}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white"
              title="Open in new window"
            >
              <MdOpenInNew size={24} />
            </button>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white"
            title="Close (Esc)"
          >
            <MdClose size={24} />
          </button>
        </div>

        {/* Media content */}
        <div 
          className="flex-1 flex items-center justify-center p-4 overflow-auto"
          onClick={onClose}
        >
          {mediaType === 'image' ? (
            <img
              src={mediaUrl}
              alt="Full size"
              className="max-w-full max-h-full object-contain cursor-zoom-out"
              onClick={(e) => e.stopPropagation()}
            />
          ) : mediaType === 'video' ? (
            <video
              src={mediaUrl}
              controls
              autoPlay
              className="max-w-full max-h-full"
              onClick={(e) => e.stopPropagation()}
            />
          ) : null}
        </div>
      </div>
    </Modal>
  );
};
