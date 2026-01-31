import { useState, useEffect } from 'react';
import { MdClose, MdScreenShare, MdCheck, MdDesktopWindows, MdWindow } from 'react-icons/md';
import { Button } from '../shared/Button';

// Safe electron require
const getDesktopCapturer = () => {
  if (window.electron && window.electron.desktopCapturer) {
      return window.electron.desktopCapturer;
  }
  
  // Fallback for older setups or direct require if somehow works
  if (window.require) {
    try {
      return window.require('electron').desktopCapturer;
    } catch (e) {
      return null;
    }
  }
  return null;
};

export const ScreenShareModal = ({ isOpen, onClose, onConfirm }) => {
  const [resolution, setResolution] = useState(720); // 720 or 1080
  const [frameRate, setFrameRate] = useState(30); // 15, 30, or 60
  
  // Source Selection State
  const [activeTab, setActiveTab] = useState('screens'); // 'screens' | 'windows'
  const [sources, setSources] = useState({ screens: [], windows: [] });
  const [selectedSourceId, setSelectedSourceId] = useState(null);
  const [loadingSources, setLoadingSources] = useState(false);

  const isElectron = !!getDesktopCapturer();

  useEffect(() => {
    if (isOpen && isElectron) {
      loadSources();
      // Setup interval to refresh thumbnails
      const interval = setInterval(loadSources, 3000); 
      return () => clearInterval(interval);
    }
  }, [isOpen, isElectron]);

  const loadSources = async () => {
    const capturer = getDesktopCapturer();
    if (!capturer) return;

    try {
      const inputSources = await capturer.getSources({ 
          types: ['window', 'screen'], 
          thumbnailSize: { width: 300, height: 200 } 
      });

      const screens = inputSources.filter(s => s.id.startsWith('screen:'));
      const windows = inputSources.filter(s => !s.id.startsWith('screen:'));
      
      setSources({ screens, windows });
      
      // Auto-select first screen if nothing selected
      if (!selectedSourceId && screens.length > 0) {
          setSelectedSourceId(screens[0].id);
      }
    } catch (e) {
      console.error("Error loading sources:", e);
    }
  };

  if (!isOpen) return null;

  const handleConfirm = () => {
    let width, height;
    if (resolution === 1080) {
      width = 1920;
      height = 1080;
    } else {
      width = 1280;
      height = 720;
    }

    onConfirm({
      width,
      height,
      frameRate,
      sourceId: selectedSourceId, // Pass the ID directly
      // Fallback hint for web
      displaySurface: activeTab === 'screens' ? 'monitor' : 'window' 
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center animate-fade-in">
      <div className="bg-dark-elem w-full max-w-2xl rounded-2xl shadow-2xl border border-dark-hover overflow-hidden transform transition-all scale-100 p-6 relative flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-6 shrink-0">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <MdScreenShare className="text-brand-primary" />
            Screen Share
          </h2>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-dark-hover rounded-full transition-colors text-dark-muted hover:text-white"
          >
            <MdClose size={24} />
          </button>
        </div>

        <div className="flex gap-6 overflow-hidden flex-1">
             {/* Left Column: Settings */}
             <div className="w-64 flex flex-col gap-6 shrink-0 border-r border-dark-hover pr-6">
                {/* Resolution Selector */}
                <div>
                  <div className="text-xs font-bold text-dark-muted uppercase tracking-wider mb-3">Resolution</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setResolution(720)} className={`p-2 rounded-lg border text-xs font-bold ${resolution === 720 ? 'border-brand-primary bg-brand-primary/10 text-white' : 'border-dark-hover bg-dark-input text-gray-400'}`}>720p</button>
                    <button onClick={() => setResolution(1080)} className={`p-2 rounded-lg border text-xs font-bold ${resolution === 1080 ? 'border-brand-primary bg-brand-primary/10 text-white' : 'border-dark-hover bg-dark-input text-gray-400'}`}>1080p</button>
                  </div>
                </div>

                {/* Frame Rate Selector */}
                <div>
                  <div className="text-xs font-bold text-dark-muted uppercase tracking-wider mb-3">Frame Rate</div>
                  <div className="grid grid-cols-3 gap-2">
                    {[15, 30, 60].map(fps => (
                        <button key={fps} onClick={() => setFrameRate(fps)} className={`p-2 rounded-lg border text-xs font-bold ${frameRate === fps ? 'border-brand-primary bg-brand-primary/10 text-white' : 'border-dark-hover bg-dark-input text-gray-400'}`}>{fps}</button>
                    ))}
                  </div>
                </div>
             </div>

             {/* Right Column: Source Selection */}
             <div className="flex-1 flex flex-col min-h-0">
                {isElectron ? (
                    <>
                        <div className="flex gap-4 border-b border-dark-hover mb-4 shrink-0">
                            <button onClick={() => setActiveTab('screens')} className={`pb-2 text-sm font-bold flex items-center gap-2 transition-colors ${activeTab === 'screens' ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-gray-400 hover:text-white'}`}>
                                <MdDesktopWindows size={18} /> Screens
                            </button>
                            <button onClick={() => setActiveTab('windows')} className={`pb-2 text-sm font-bold flex items-center gap-2 transition-colors ${activeTab === 'windows' ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-gray-400 hover:text-white'}`}>
                                <MdWindow size={18} /> Windows
                            </button>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 overflow-y-auto pr-2 custom-scrollbar content-start">
                            {(activeTab === 'screens' ? sources.screens : sources.windows).map(source => (
                                <button 
                                    key={source.id} 
                                    onClick={() => setSelectedSourceId(source.id)}
                                    className={`group relative rounded-lg overflow-hidden border-2 transition-all text-left ${selectedSourceId === source.id ? 'border-brand-primary ring-2 ring-brand-primary/20' : 'border-transparent hover:border-gray-600 bg-black/40'}`}
                                >
                                    <div className="aspect-video bg-black relative">
                                        <img src={source.thumbnail.toDataURL()} alt={source.name} className="w-full h-full object-contain" />
                                        {selectedSourceId === source.id && <div className="absolute inset-0 bg-brand-primary/10 flex items-center justify-center"><MdCheck className="text-brand-primary drop-shadow-lg" size={48}/></div>}
                                    </div>
                                    <div className="p-2 bg-dark-input truncate text-xs font-medium text-gray-300 group-hover:text-white">
                                        {source.name}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="flex items-center justify-center h-full text-center text-gray-500">
                        <div className="max-w-xs">
                           <MdScreenShare size={48} className="mx-auto mb-4 opacity-50"/>
                           <p className="text-sm">Browser limits source selection here.<br/>Click "Go Live" to pick a screen or window.</p>
                        </div>
                    </div>
                )}
             </div>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-dark-hover mt-4 shrink-0">
           <Button variant="ghost" onClick={onClose} className="text-dark-text hover:text-white">
             Cancel
           </Button>
           <Button 
             variant="primary" 
             onClick={handleConfirm}
             className="px-8 shadow-lg shadow-brand-primary/20"
             disabled={isElectron && !selectedSourceId}
           >
             Go Live
           </Button>
        </div>

      </div>
    </div>
  );
};

