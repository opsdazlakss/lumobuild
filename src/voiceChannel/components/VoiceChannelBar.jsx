import { useVoiceChannel } from '../context/VoiceChannelContext';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { 
  FaMicrophone, FaMicrophoneSlash, FaHeadphones, FaHeadphonesAlt,
  FaVideo, FaVideoSlash, FaDesktop, FaPhoneSlash, FaExpand, FaCog
} from 'react-icons/fa';
import { MdGraphicEq, MdDelete, MdAdd } from 'react-icons/md';
import { useState, useEffect, useRef } from 'react';
import { useSoundboard } from '../../context/SoundboardContext';
import { VoiceChannelGrid } from './VoiceChannelGrid';
import { ScreenShareModal } from '../../components/call/ScreenShareModal';

export const VoiceChannelBar = () => {
  const { 
    currentVoiceChannel, 
    participants,
    isMuted, 
    isDeafened, 
    isVideoOn, 
    isScreenSharing,
    toggleMute, 
    toggleDeafen, 
    toggleVideo, 
    toggleScreenShare,
    leaveVoiceChannel,
    audioDevices,
    selectedAudioDeviceId,
    changeAudioDevice,
    refreshDevices,
    playSound
  } = useVoiceChannel();
  
  const { customSounds, addSound, removeSound } = useSoundboard();
  const { userProfile } = useAuth();
  
  const isPremium = 
    userProfile?.roles?.includes('premium') || 
    userProfile?.roles?.includes('admin') || 
    userProfile?.plan === 'premium' ||
    userProfile?.badges?.includes('premium');

  const { channels } = useData();
  const [showGrid, setShowGrid] = useState(false);
  const [showScreenShareModal, setShowScreenShareModal] = useState(false);
  const [showDeviceMenu, setShowDeviceMenu] = useState(false);
  const [showSoundboard, setShowSoundboard] = useState(false);
  const menuRef = useRef(null);
  const soundboardRef = useRef(null);
  const fileInputRef = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowDeviceMenu(false);
      }
    };

    if (showDeviceMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDeviceMenu]);

  // Close soundboard when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (soundboardRef.current && !soundboardRef.current.contains(event.target)) {
        setShowSoundboard(false);
      }
    };

    if (showSoundboard) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSoundboard]);

  if (!currentVoiceChannel) return null;

  const channel = channels?.find(ch => ch.id === currentVoiceChannel);

  const handleScreenShareClick = () => {
    if (isScreenSharing) {
      // Stop sharing
      toggleScreenShare(null);
    } else {
      // Open picker modal
      setShowScreenShareModal(true);
    }
  };

  const handleScreenShareConfirm = (options) => {
    setShowScreenShareModal(false);
    toggleScreenShare(options);
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const name = file.name.split('.')[0].slice(0, 15);
    await addSound(name, file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <>
      <div className="voice-channel-bar">
        <div className="voice-bar-info">
          <div className="voice-bar-status">
            <span className="status-dot"></span>
            <span className="voice-bar-channel">{channel?.name || 'Voice Channel'}</span>
          </div>
        </div>

        <div className="voice-bar-controls">
          {/* Mute */}
          <button 
            className={`voice-control-btn ${isMuted ? 'active' : ''}`}
            onClick={toggleMute}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <FaMicrophoneSlash /> : <FaMicrophone />}
          </button>

          {/* Deafen */}
          <button 
            className={`voice-control-btn ${isDeafened ? 'active' : ''}`}
            onClick={toggleDeafen}
            title={isDeafened ? 'Undeafen' : 'Deafen'}
          >
            {isDeafened ? <FaHeadphonesAlt /> : <FaHeadphones />}
          </button>

          {/* Video */}
          <button 
            className={`voice-control-btn ${isVideoOn ? 'active' : ''}`}
            onClick={toggleVideo}
            title={isVideoOn ? 'Turn Off Camera' : 'Turn On Camera'}
          >
            {isVideoOn ? <FaVideo /> : <FaVideoSlash />}
          </button>

          {/* Screen Share */}
          <button 
            className={`voice-control-btn ${isScreenSharing ? 'active' : ''}`}
            onClick={handleScreenShareClick}
            title={isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
          >
            <FaDesktop />
          </button>

          {/* Soundboard */}
          <div className="voice-settings-wrapper" ref={soundboardRef}>
            <button
              className={`voice-control-btn ${showSoundboard ? 'active' : ''}`}
              onClick={() => setShowSoundboard(!showSoundboard)}
              title="Soundboard"
            >
              <MdGraphicEq />
            </button>

            {showSoundboard && (
              <div className="voice-device-menu soundboard-menu">
                <div className="menu-header">
                  <span>Soundboard</span>
                  <span className="text-[10px] opacity-50">{customSounds.length}/10</span>
                </div>
                <div className="menu-list soundboard-list">
                  {customSounds.length === 0 ? (
                    <div className="menu-item disabled">No sounds added yet</div>
                  ) : (
                    customSounds.map(sound => (
                      <div key={sound.id} className="soundboard-item-wrapper group">
                        <div 
                          className="menu-item soundboard-item"
                          onClick={() => {
                            playSound(sound.id);
                            // setShowSoundboard(false); // Optional: keep open for multiple sounds
                          }}
                        >
                          <span className="truncate flex-1">{sound.name}</span>
                          <span className="text-xs opacity-50">🔊</span>
                        </div>
                        <button 
                          className="sound-delete-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeSound(sound.id);
                          }}
                        >
                          <MdDelete size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
                {customSounds.length < 10 && (
                  <div className="menu-footer">
                    <button 
                      className="add-sound-btn"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <MdAdd size={14} />
                      <span>Add Sound</span>
                    </button>
                    <input 
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept="audio/mp3,audio/wav"
                      onChange={handleFileSelect}
                    />
                  </div>
                )}
                
                {!isPremium && (
                  <div className="absolute inset-0 bg-black/80 flex items-center justify-center rounded-lg p-4 text-center z-[60]">
                    <div>
                      <p className="text-orange-400 font-bold mb-1">Premium Only</p>
                      <p className="text-white text-[11px]">Unlock Soundboard with Premium!</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Expand Grid */}
          {participants.length > 0 && (
            <button 
              className="voice-control-btn"
              onClick={() => setShowGrid(true)}
              title="Expand Grid"
            >
              <FaExpand />
            </button>
          )}

          {/* Audio Settings */}
          <div className="voice-settings-wrapper" ref={menuRef}>
             <button 
               className={`voice-control-btn ${showDeviceMenu ? 'active' : ''}`}
               onClick={() => {
                 if (!showDeviceMenu) {
                   refreshDevices();
                 }
                 setShowDeviceMenu(!showDeviceMenu);
               }}
               title="Audio Settings"
             >
               <FaCog />
             </button>

             {showDeviceMenu && (
               <div className="voice-device-menu">
                 <div className="menu-header">Input Device</div>
                 <div className="menu-list">
                   {audioDevices.length > 0 ? (
                     audioDevices.map(device => (
                       <div 
                         key={device.deviceId}
                         className={`menu-item ${selectedAudioDeviceId === device.deviceId ? 'active' : ''}`}
                         onClick={() => {
                            changeAudioDevice(device.deviceId);
                            setShowDeviceMenu(false);
                         }}
                       >
                         <span className="truncate">{device.label || `Microphone ${device.deviceId.slice(0, 5)}`}</span>
                         {selectedAudioDeviceId === device.deviceId && <div className="active-dot" />}
                       </div>
                     ))
                   ) : (
                     <div className="menu-item disabled">No microphone found</div>
                   )}
                 </div>
               </div>
             )}
          </div>

          {/* Disconnect */}
          <button 
            className="voice-control-btn disconnect"
            onClick={leaveVoiceChannel}
            title="Disconnect"
          >
            <FaPhoneSlash />
          </button>
        </div>
      </div>

      {/* Grid Modal */}
      {showGrid && (
        <VoiceChannelGrid onClose={() => setShowGrid(false)} />
      )}

      {/* Screen Share Picker Modal */}
      <ScreenShareModal
        isOpen={showScreenShareModal}
        onClose={() => setShowScreenShareModal(false)}
        onConfirm={handleScreenShareConfirm}
      />
    </>
  );
};
