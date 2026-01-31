import { useVoiceChannel } from '../context/VoiceChannelContext';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { 
  FaMicrophone, FaMicrophoneSlash, FaHeadphones, FaHeadphonesAlt,
  FaVideo, FaVideoSlash, FaDesktop, FaPhoneSlash, FaExpand, FaCog, FaChevronDown 
} from 'react-icons/fa';
import { MdGraphicEq, MdDelete, MdAdd, MdHeadsetOff } from 'react-icons/md';
import { useState, useEffect, useRef } from 'react';
import { useSoundboard } from '../../context/SoundboardContext';
import { VoiceChannelGrid } from './VoiceChannelGrid';
import { ScreenShareModal } from '../../components/call/ScreenShareModal';
import { isPremiumUser } from '../../utils/permissions';
import { useToast } from '../../context/ToastContext';

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
    videoDevices,
    selectedVideoDeviceId,
    changeVideoDevice,
    refreshDevices,
    playSound,
    currentPing
  } = useVoiceChannel();
  
  const { customSounds, addSound, removeSound } = useSoundboard();
  const { userProfile } = useAuth();
  const { info } = useToast();
  
  // Use centralized premium check
  const isPremium = isPremiumUser(userProfile);

  const { channels } = useData();
  const [showGrid, setShowGrid] = useState(false);
  const [showScreenShareModal, setShowScreenShareModal] = useState(false);
  const [showDeviceMenu, setShowDeviceMenu] = useState(false);
  const [showVideoDeviceMenu, setShowVideoDeviceMenu] = useState(false);
  const [showSoundboard, setShowSoundboard] = useState(false);
  const menuRef = useRef(null);
  const videoMenuRef = useRef(null);
  const soundboardRef = useRef(null);
  const fileInputRef = useRef(null);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowDeviceMenu(false);
      }
      if (videoMenuRef.current && !videoMenuRef.current.contains(event.target)) {
        setShowVideoDeviceMenu(false);
      }
    };

    if (showDeviceMenu || showVideoDeviceMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDeviceMenu, showVideoDeviceMenu]);

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

  const [showPingDetail, setShowPingDetail] = useState(false);

  // Helper to determine ping color and icon class
  const getPingStatus = (ping) => {
    if (!ping && ping !== 0) return 'unknown';
    if (ping < 100) return 'good';
    if (ping < 250) return 'fair';
    return 'poor';
  };

  const handleScreenShareClick = () => {
    if (isScreenSharing) {
      toggleScreenShare(null);
    } else {
      if (!isPremium) {
        info('Screen sharing is a Premium feature!');
        return;
      }
      setShowScreenShareModal(true);
    }
  };

  const handleScreenShareConfirm = (options) => {
    setShowScreenShareModal(false);
    toggleScreenShare(options);
  };

  if (!currentVoiceChannel) return null;

  const channel = channels?.find(ch => ch.id === currentVoiceChannel);

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
        {/* Row 1: Info (Channel Name & Ping) */}
        <div className="voice-bar-header">
          <div className="voice-bar-info">
            <div className="voice-bar-status relative">
              <div 
                className={`voice-connection-status ${getPingStatus(currentPing)}`}
                onMouseEnter={() => setShowPingDetail(true)}
                onMouseLeave={() => setShowPingDetail(false)}
              >
                <div className="signal-bar bar-1"></div>
                <div className="signal-bar bar-2"></div>
                <div className="signal-bar bar-3"></div>
              </div>
              
              {/* Custom Ping Panel */}
              {showPingDetail && (
                <div className="ping-stats-panel">
                  <div className="ping-value">{currentPing || '--'} ms</div>
                  <div className="ping-label">Latency</div>
                </div>
              )}

              <span className="voice-bar-channel">{channel?.name || 'Voice Channel'}</span>
            </div>
          </div>
          {/* Disconnect button moved to bottom row */}
        </div>

        {/* Row 2: Controls */}
        <div className="voice-bar-controls">
          {/* Audio Group: Mic + Arrow + Headphone */}
          <div className="control-group">
            <button 
              className={`voice-control-btn ${isMuted ? 'active' : ''}`}
              onClick={toggleMute}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <FaMicrophoneSlash /> : <FaMicrophone />}
            </button>

            {/* Mic Settings Dropdown */}
            <div className="voice-settings-wrapper" ref={menuRef}>
               <button 
                 className={`voice-control-btn arrow-btn ${showDeviceMenu ? 'active' : ''}`}
                 onClick={(e) => {
                   e.stopPropagation();
                   if (!showDeviceMenu) refreshDevices();
                   setShowDeviceMenu(!showDeviceMenu);
                 }}
                 title="Input Devices"
               >
                 <FaChevronDown size={10} />
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

            <button 
              className={`voice-control-btn ${isDeafened ? 'active' : ''}`}
              onClick={toggleDeafen}
              title={isDeafened ? 'Undeafen' : 'Deafen'}
            >
              {isDeafened ? <MdHeadsetOff /> : <FaHeadphones />}
            </button>
          </div>

          {/* Video Group: Camera + Arrow (Placeholder) + Screen */}
          <div className="control-group">
            <button 
              className={`voice-control-btn ${isVideoOn ? 'active' : ''}`}
              onClick={toggleVideo}
              title={isVideoOn ? 'Turn Off Camera' : 'Turn On Camera'}
            >
              {isVideoOn ? <FaVideo /> : <FaVideoSlash />}
            </button>

             {/* Camera Settings Dropdown */}
             <div className="voice-settings-wrapper" ref={videoMenuRef}>
               <button 
                   className={`voice-control-btn arrow-btn ${showVideoDeviceMenu ? 'active' : ''}`} 
                   onClick={(e) => {
                     e.stopPropagation();
                     if (!showVideoDeviceMenu) refreshDevices();
                     setShowVideoDeviceMenu(!showVideoDeviceMenu);
                   }}
                   title="Video Settings"
               >
                   <FaChevronDown size={10} />
               </button>

               {showVideoDeviceMenu && (
                 <div className="voice-device-menu">
                   <div className="menu-header">Camera Device</div>
                   <div className="menu-list">
                     {videoDevices.length > 0 ? (
                       videoDevices.map(device => (
                         <div 
                           key={device.deviceId}
                           className={`menu-item ${selectedVideoDeviceId === device.deviceId ? 'active' : ''}`}
                           onClick={() => {
                               changeVideoDevice(device.deviceId);
                               setShowVideoDeviceMenu(false);
                           }}
                         >
                           <span className="truncate">{device.label || `Camera ${device.deviceId.slice(0, 5)}`}</span>
                           {selectedVideoDeviceId === device.deviceId && <div className="active-dot" />}
                         </div>
                       ))
                     ) : (
                       <div className="menu-item disabled">No camera found</div>
                     )}
                   </div>
                 </div>
               )}
             </div>

            <button 
              className={`voice-control-btn ${isScreenSharing ? 'active' : ''}`}
              onClick={handleScreenShareClick}
              title={isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
            >
              <FaDesktop />
            </button>
          </div>

          {/* Tools Group: Soundboard + Grid */}
          <div className="control-group">
            <div className="voice-settings-wrapper" ref={soundboardRef}>
              <button
                className={`voice-control-btn ${showSoundboard ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSoundboard(!showSoundboard);
                }}
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
                               if (!isPremium) return;
                               playSound(sound.id);
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
                       <input type="file" ref={fileInputRef} className="hidden" accept="audio/mp3,audio/wav" onChange={handleFileSelect} />
                     </div>
                   )}
                   {!isPremium && (
                      <div className="absolute inset-0 bg-black/80 flex items-center justify-center rounded-lg p-4 text-center z-[60]">
                        <div><p className="text-orange-400 font-bold mb-1">Premium Only</p></div>
                      </div>
                   )}
                </div>
              )}
            </div>

            {participants.length > 0 && (
              <button 
                className="voice-control-btn"
                onClick={() => setShowGrid(true)}
                title="Expand Grid"
              >
                 <FaExpand />
              </button>
            )}
          </div>

          {/* Disconnect Group (Replaces Settings) */}
          <div className="control-group no-bg">
             <button 
              className="voice-control-btn disconnect"
              onClick={leaveVoiceChannel}
              title="Disconnect"
            >
              <FaPhoneSlash />
            </button>
          </div>
        </div>
      </div>

      {/* Grid Modal */}
      {showGrid && <VoiceChannelGrid onClose={() => setShowGrid(false)} />}

      {/* Screen Share Picker Modal */}
      <ScreenShareModal
        isOpen={showScreenShareModal}
        onClose={() => setShowScreenShareModal(false)}
        onConfirm={handleScreenShareConfirm}
      />
    </>
  );
};
