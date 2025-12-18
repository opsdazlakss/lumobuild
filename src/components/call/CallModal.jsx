import { useRef, useEffect, useState } from 'react';
import { useCall } from '../../context/CallContext';
import { useAuth } from '../../context/AuthContext';
import { ScreenShareModal } from './ScreenShareModal';
import { DeviceSettingsModal } from './DeviceSettingsModal';
import { hasCapability, CAPABILITIES } from '../../utils/permissions';

import { MdCallEnd, MdMic, MdMicOff, MdVideocam, MdVideocamOff, MdScreenShare, MdStopScreenShare, MdVolumeUp, MdVolumeOff, MdVolumeMute, MdSettings, MdFullscreen, MdFullscreenExit, MdGraphicEq, MdDelete, MdAdd } from 'react-icons/md';
import { FaPhone } from 'react-icons/fa';
import { cn } from '../../utils/helpers';
import Draggable from 'react-draggable';
import { Capacitor } from '@capacitor/core';

export const CallModal = () => {
  const { 
    callStatus, 
    incomingCall, 
    outgoingCallUser, 
    answerCall, 
    endCall, 
    localStream, 
    remoteStream, 
    toggleAudio, 
    toggleVideo, 
    isMuted, 
    isVideoOff,
    activeCall,
    isScreenSharing,
    toggleScreenShare,
    // Device selection
    availableDevices,
    selectedMicId,
    selectedCameraId,
    setSelectedMicId,
    setSelectedCameraId,
    playSound,
    customSounds,
    addSound,
    removeSound
  } = useCall();

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const draggableRef = useRef(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [remoteVolume, setRemoteVolume] = useState(100);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [showDeviceSettings, setShowDeviceSettings] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [showScreenShareModal, setShowScreenShareModal] = useState(false);
  const [showSoundboard, setShowSoundboard] = useState(false);
  
  const { userProfile } = useAuth(); // used for capabilities
  const { role } = useAuth(); // Assuming useAuth exposes role for easier check, or derived from profile
  
  // Robust Premium Check: Roles, Plan, OR Badge
  const isPremium = 
    userProfile?.roles?.includes('premium') || 
    userProfile?.roles?.includes('admin') || 
    userProfile?.plan === 'premium' ||
    userProfile?.badges?.includes('premium');
  
  const canScreenShare = hasCapability(userProfile, CAPABILITIES.SCREEN_SHARE);
  
  const fileInputRef = useRef(null);

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const name = file.name.split('.')[0].slice(0, 10); // Auto name
    await addSound(name, file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const [isRemoteVideoActive, setIsRemoteVideoActive] = useState(false);

  // Sync streams to video elements
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, callStatus]);

  // 1. Assign Remote Stream to Video Element (Always assign for Audio)
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, callStatus]);

  // 2. Monitor Remote Track State (Visual Only)
  useEffect(() => {
    if (remoteStream) {
        const videoTrack = remoteStream.getVideoTracks()[0];
        if (videoTrack) {
            // Initial check
            const isActive = !videoTrack.muted && videoTrack.readyState === 'live';
            setIsRemoteVideoActive(isActive);

            const handleMute = () => setIsRemoteVideoActive(false);
            const handleUnmute = () => setIsRemoteVideoActive(true);
            const handleEnded = () => setIsRemoteVideoActive(false);
            
            videoTrack.addEventListener('mute', handleMute);
            videoTrack.addEventListener('unmute', handleUnmute);
            videoTrack.addEventListener('ended', handleEnded);

            return () => {
                videoTrack.removeEventListener('mute', handleMute);
                videoTrack.removeEventListener('unmute', handleUnmute);
                videoTrack.removeEventListener('ended', handleEnded);
            };
        } else {
            setIsRemoteVideoActive(false);
        }
    } else {
        setIsRemoteVideoActive(false);
    }
  }, [remoteStream]);

  // Apply volume to remote stream
  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.volume = remoteVolume / 100;
    }
  }, [remoteVolume, remoteStream]);

  // Reset UI state when call ends
  useEffect(() => {
    if (callStatus === 'idle') {
      setIsMinimized(false);
      setShowSoundboard(false);
      setShowDeviceSettings(false);
      setShowScreenShareModal(false);
      setShowVolumeSlider(false);
      setShowTooltip(false);
    }
  }, [callStatus]);

  if (callStatus === 'idle') return null;

  // 1. Incoming Call UI
  if (callStatus === 'incoming') {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in" role="dialog" aria-modal="true">
        <div className="bg-dark-sidebar p-6 rounded-2xl shadow-2xl w-80 text-center border border-dark-hover">
          <div className="w-24 h-24 mx-auto mb-4 relative">
             {incomingCall?.callerPhotoUrl ? (
                <img src={incomingCall.callerPhotoUrl} alt="Caller" className="w-full h-full rounded-full object-cover border-4 border-dark-bg" />
             ) : (
                <div className="w-full h-full rounded-full bg-brand-primary flex items-center justify-center text-3xl font-bold text-white border-4 border-dark-bg">
                    {incomingCall?.callerName?.[0]?.toUpperCase()}
                </div>
             )}
             <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-2 animate-bounce">
                <FaPhone size={16} className="text-white" />
             </div>
          </div>
          
          <h3 className="text-xl font-bold text-white mb-1">{incomingCall?.callerName}</h3>
          <p className="text-dark-muted mb-6">Incoming {incomingCall?.type} call...</p>
          
          <div className="flex gap-4 justify-center">
            <button 
              onClick={() => endCall(true)}
              className="w-12 h-12 rounded-full bg-red-500 flex items-center justify-center text-white hover:bg-red-600 transition-colors"
            >
              <MdCallEnd size={24} />
            </button>
            <button 
              onClick={answerCall}
              className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center text-white hover:bg-green-600 transition-colors"
            >
              <FaPhone size={20} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Active Call / Outgoing UI
  return (
    <Draggable 
      nodeRef={draggableRef} 
      disabled={!isMinimized} 
      bounds="body"
      onStart={() => setIsDragging(true)}
      onStop={() => setIsDragging(false)}
    >
    <div 
      role="dialog"
      aria-modal="true"
      ref={draggableRef}
      style={!isMinimized ? { transform: 'none !important' } : undefined}
      className={cn(
        "fixed z-[100] bg-gray-900 shadow-2xl overflow-hidden border border-gray-700 group",
        !isDragging && "transition-all duration-300", // Disable transition during drag to prevent lag
        isMinimized 
            ? "bottom-4 right-4 w-64 h-48 rounded-lg cursor-move" 
            : "inset-0 flex flex-col !transform-none"
    )}>
      
      {/* Header (Window Controls) */}
      <div className={cn(
          "absolute top-0 left-0 right-0 p-4 z-50 flex justify-between items-start bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-200 opacity-100"
      )}>
        <div className="flex gap-2">
            {/* Connection Status / Timer could go here */}
            <div className="bg-black/40 backdrop-blur px-3 py-1 rounded-full flex items-center gap-2">
                <span className={cn("w-2 h-2 rounded-full", activeCall ? "bg-green-500" : "bg-yellow-500 animate-pulse")} />
                <span className="text-xs text-white font-medium">{activeCall ? "Connected" : "Calling..."}</span>
            </div>
        </div>

        <button 
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-2 rounded-full bg-black/40 hover:bg-white/10 text-white backdrop-blur transition-colors"
            title={isMinimized ? "Maximize" : "Minimize"}
        >
            {isMinimized ? <MdFullscreen size={20} /> : <MdFullscreenExit size={20} />}
        </button>
      </div>

      {/* Main Video Area (Remote or Outgoing Placeholder) */}
      <div className="relative flex-1 bg-black flex items-center justify-center w-full h-full">
        {/* Helper Video Element (Handles Audio Playback + Video Display) */}
        {/* We keep this mounted ALWAYS so audio plays even if video is hidden */}
        <video 
             ref={remoteVideoRef} 
             autoPlay 
             playsInline 
             className={cn(
                 "w-full h-full object-contain",
                 (!remoteStream || !isRemoteVideoActive) && "hidden" // Hide visually if no video
             )}
        />

        {/* Placeholder (Overlay when no video) */}
        {(!remoteStream || !isRemoteVideoActive) && (
           <div className="text-center absolute inset-0 flex flex-col items-center justify-center z-10">
             <div className="w-32 h-32 mx-auto mb-4 rounded-full bg-gray-800 flex items-center justify-center text-6xl font-bold text-gray-500 animate-pulse">
                {outgoingCallUser?.displayName?.[0] || activeCall?.metadata?.name?.[0] || '?'}
             </div>
             <p className="text-xl text-white font-medium">
                {callStatus === 'outgoing' ? 'Calling...' : 
                 callStatus === 'connected' ? 'No Video / Audio Only' : 'Connecting...'}
             </p>
             <p className="text-gray-400 text-sm mt-1">{outgoingCallUser?.displayName}</p>
           </div>
        )}

        {/* Local Video (PiP) - Only show if not minimized or if it's the only thing */}
        {!isMinimized && localStream && (
             <DraggableDragger />
        )}
      </div>

      {/* Controls Bar - Floating Overlay */}
      <div className={cn(
          "absolute bottom-4 md:bottom-8 left-1/2 -translate-x-1/2 z-50 flex flex-wrap justify-center items-center gap-2 md:gap-4 p-2 md:p-3 bg-gray-900/80 backdrop-blur-md rounded-xl md:rounded-2xl border border-gray-700 shadow-xl transition-opacity duration-300 hover:opacity-100 w-[95%] md:w-auto max-w-screen-sm",
          isMinimized && "hidden",
      )}>
         <button 
           onClick={toggleAudio}
           className={cn(
               "p-3 rounded-xl transition-all hover:scale-110 active:scale-95",
               isMuted ? "bg-red-500/20 text-red-500" : "bg-gray-700/50 text-white hover:bg-gray-600"
           )}
           title={isMuted ? "Unmute" : "Mute"}
         >
           {isMuted ? <MdMicOff size={22} /> : <MdMic size={22} />}
         </button>

         <button 
           onClick={toggleVideo}
           className={cn(
               "p-3 rounded-xl transition-all hover:scale-110 active:scale-95",
               isVideoOff ? "bg-red-500/20 text-red-500" : "bg-gray-700/50 text-white hover:bg-gray-600"
           )}
           title={isVideoOff ? "Turn Video On" : "Turn Video Off"}
         >
           {isVideoOff ? <MdVideocamOff size={22} /> : <MdVideocam size={22} />}
         </button>

          {!Capacitor.isNativePlatform() && (
             <div 
               className="relative"
               onMouseEnter={() => setShowTooltip(true)}
               onMouseLeave={() => setShowTooltip(false)}
             >
               <button 
                 onClick={() => {
                    if (isScreenSharing) {
                      toggleScreenShare(); // Stop sharing directly
                    } else {
                      setShowScreenShareModal(true); // Open modal to start
                    }
                  }}
                 disabled={!activeCall || !canScreenShare}
                 className={cn(
                     "p-3 rounded-xl transition-all hover:scale-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed",
                     isScreenSharing ? "bg-green-500 text-white" : 
                     !canScreenShare ? "bg-gray-800 text-gray-500 cursor-not-allowed" : 
                     "bg-gray-700/50 text-white hover:bg-gray-600"
                 )}
                 title={canScreenShare ? (isScreenSharing ? "Stop Sharing" : "Share Screen") : undefined}
               >
                 {isScreenSharing ? <MdStopScreenShare size={22} /> : <MdScreenShare size={22} />}
               </button>
               
               {!canScreenShare && (
                 <div 
                   className={cn(
                     "absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-black text-rose-500 text-xs font-bold rounded shadow-lg whitespace-nowrap transition-opacity pointer-events-none z-50",
                     showTooltip ? "opacity-100" : "opacity-0"
                   )}
                 >
                    Requires Premium 🚀
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-black"></div>
                 </div>
               )}
             </div>
          )}

         <div className="w-px h-8 bg-gray-700 mx-2" />

         {/* Volume Control */}
         <div className="relative">
           <button 
             onClick={() => setShowVolumeSlider(!showVolumeSlider)}
             onDoubleClick={() => setRemoteVolume(remoteVolume > 0 ? 0 : 100)}
             className={cn(
                 "p-3 rounded-xl transition-all hover:scale-110 active:scale-95",
                 remoteVolume === 0 ? "bg-red-500/20 text-red-500" : "bg-gray-700/50 text-white hover:bg-gray-600"
             )}
             title={`Volume: ${remoteVolume}% (click to show slider, double-click to mute)`}
           >
             {remoteVolume === 0 ? <MdVolumeOff size={22} /> : remoteVolume < 50 ? <MdVolumeMute size={22} /> : <MdVolumeUp size={22} />}
           </button>
           
           {/* Volume Slider Popup */}
           {showVolumeSlider && (
             <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 p-3 bg-gray-900/95 backdrop-blur-md rounded-xl border border-gray-700 shadow-xl">
               <div className="flex flex-col items-center gap-2">
                 <span className="text-xs text-gray-400 font-medium">{remoteVolume}%</span>
                 <input
                   type="range"
                   min="0"
                   max="100"
                   value={remoteVolume}
                   onChange={(e) => setRemoteVolume(Number(e.target.value))}
                   className="w-24 h-2 appearance-none bg-gray-700 rounded-full cursor-pointer accent-brand-primary
                     [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 
                     [&::-webkit-slider-thumb]:bg-brand-primary [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer
                     [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:transition-transform"
                   style={{
                     background: `linear-gradient(to right, rgb(88, 101, 242) ${remoteVolume}%, rgb(55, 65, 81) ${remoteVolume}%)`
                   }}
                 />
                 <span className="text-[10px] text-gray-500">Remote Volume</span>
               </div>
             </div>
           )}
         </div>

          {/* Soundboard Button */}
          <div className="relative">
            <button
              onClick={() => setShowSoundboard(!showSoundboard)}
              className={cn(
                  "p-3 rounded-xl transition-all hover:scale-110 active:scale-95",
                  showSoundboard ? "bg-brand-primary/20 text-brand-primary" : "bg-gray-700/50 text-white hover:bg-gray-600"
              )}
              title="Soundboard"
            >
              <MdGraphicEq size={22} />
            </button>
            
            {/* Soundboard Popup */}
            {showSoundboard && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-64 bg-gray-900/95 backdrop-blur-md border border-gray-700 rounded-xl shadow-2xl p-4 animate-fade-in-up z-50">
                  <h4 className="text-white text-sm font-semibold mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MdGraphicEq className="text-brand-primary" />
                        Soundboard
                      </div>
                      <span className="text-[10px] text-gray-400">{customSounds.length}/10</span>
                  </h4>
                  
                  <div className="flex flex-col gap-1 mb-3 max-h-48 overflow-y-auto custom-scrollbar">
                      {customSounds.length === 0 && (
                          <div className="text-center text-gray-500 text-xs py-4 italic">
                              No sounds added yet.
                          </div>
                      )}
                      
                      {customSounds.map(sound => (
                          <div key={sound.id} className="relative group flex items-center gap-2">
                            <button
                                onClick={() => {
                                    if (!isPremium) return; 
                                    playSound(sound.id);
                                }}
                                className="flex-1 bg-gray-800 hover:bg-gray-700 text-white text-xs py-2 px-3 rounded-lg transition-colors border border-gray-700 hover:border-brand-primary flex items-center gap-3 active:scale-95"
                            >
                                <span className="text-sm">🔊</span>
                                <span className="text-xs font-medium truncate flex-1 text-left">{sound.name}</span>
                            </button>
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    removeSound(sound.id);
                                }}
                                className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-lg p-2 transition-colors opacity-0 group-hover:opacity-100"
                                title="Remove sound"
                            >
                                <MdDelete size={14} />
                            </button>
                          </div>
                      ))}
                  </div>

                  {/* Add Sound Button */}
                  {customSounds.length < 10 && (
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full py-2 border border-dashed border-gray-600 text-gray-400 rounded-lg hover:border-brand-primary hover:text-brand-primary transition-colors flex items-center justify-center gap-2 text-xs"
                      >
                        <MdAdd size={14} /> Add Sound (MP3/WAV)
                      </button>
                  )}
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="audio/mp3,audio/wav,audio/mpeg" 
                    onChange={handleFileSelect}
                  />
                  
                  {!isPremium && (
                     <div className="absolute inset-0 bg-black/80 flex items-center justify-center rounded-xl p-4 text-center">
                        <div>
                            <p className="text-brand-primary font-bold mb-1">Premium Only</p>
                            <p className="text-white text-xs">Unlock Soundboard with Premium!</p>
                        </div>
                     </div>
                  )}
              </div>
            )}
          </div>

         {/* Device Settings */}
         <div className="relative">
           <button 
             onClick={() => setShowDeviceSettings(!showDeviceSettings)}
             className={cn(
                 "p-3 rounded-xl transition-all hover:scale-110 active:scale-95",
                 showDeviceSettings ? "bg-brand-primary/20 text-brand-primary" : "bg-gray-700/50 text-white hover:bg-gray-600"
             )}
             title="Audio/Video Settings"
           >
             <MdSettings size={22} />
           </button>
           
           {/* Device Settings Popup */}
           {showDeviceSettings && (
             <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 p-4 bg-gray-900/95 backdrop-blur-md rounded-xl border border-gray-700 shadow-xl w-64">
               <div className="space-y-4">
                 <h4 className="text-sm font-semibold text-white mb-3">Device Settings</h4>
                 
                 {/* Microphone Selection */}
                 <div>
                   <label className="text-xs text-gray-400 block mb-1">Microphone</label>
                   <select
                     value={selectedMicId}
                     onChange={(e) => setSelectedMicId(e.target.value)}
                     className="w-full bg-gray-800 text-white text-sm rounded-lg px-3 py-2 border border-gray-700 focus:border-brand-primary outline-none cursor-pointer"
                   >
                     {availableDevices.audioInputs.map((device) => (
                       <option key={device.deviceId} value={device.deviceId}>
                         {device.label || `Microphone ${device.deviceId.slice(0, 8)}...`}
                       </option>
                     ))}
                   </select>
                 </div>
                 
                 {/* Camera Selection */}
                 <div>
                   <label className="text-xs text-gray-400 block mb-1">Camera</label>
                   <select
                     value={selectedCameraId}
                     onChange={(e) => setSelectedCameraId(e.target.value)}
                     className="w-full bg-gray-800 text-white text-sm rounded-lg px-3 py-2 border border-gray-700 focus:border-brand-primary outline-none cursor-pointer"
                   >
                     {availableDevices.videoInputs.map((device) => (
                       <option key={device.deviceId} value={device.deviceId}>
                         {device.label || `Camera ${device.deviceId.slice(0, 8)}...`}
                       </option>
                     ))}
                   </select>
                 </div>
                 
                 <p className="text-[10px] text-gray-500 mt-2">
                   Changes apply on next call
                 </p>
               </div>
             </div>
           )}
         </div>

         <div className="w-px h-8 bg-gray-700 mx-2" />

         <button 
           onClick={() => endCall(true)}
           className="p-3 rounded-xl bg-red-600 text-white hover:bg-red-700 transition-all hover:scale-110 active:scale-95 shadow-lg shadow-red-900/20"
           title="End Call"
         >
           <MdCallEnd size={24} />
         </button>
      </div>

      {/* Mini Controls (only when minimized) */}
      {isMinimized && (
          <div className="absolute bottom-0 left-0 right-0 p-2 flex justify-center gap-2 bg-gradient-to-t from-black/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity z-50">
             <button 
               onMouseDown={(e) => e.stopPropagation()}
               onClick={toggleAudio}
               className={cn("p-1.5 rounded-full text-white hover:bg-white/20", isMuted && "bg-red-500/50 text-red-100")}
               title="Mute"
             >
                {isMuted ? <MdMicOff size={16} /> : <MdMic size={16} />}
             </button>
             <button 
               onMouseDown={(e) => e.stopPropagation()}
               onClick={toggleVideo}
               className={cn("p-1.5 rounded-full text-white hover:bg-white/20", isVideoOff && "bg-red-500/50 text-red-100")}
               title="Camera"
             >
                {isVideoOff ? <MdVideocamOff size={16} /> : <MdVideocam size={16} />}
             </button>
             <button 
               onMouseDown={(e) => e.stopPropagation()}
               onClick={() => setRemoteVolume(remoteVolume === 0 ? 100 : 0)}
               className={cn("p-1.5 rounded-full text-white hover:bg-white/20", remoteVolume === 0 && "bg-red-500/50 text-red-100")}
               title="Volume Toggle"
             >
                {remoteVolume === 0 ? <MdVolumeOff size={16} /> : <MdVolumeUp size={16} />}
             </button>
             <button 
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => endCall(true)}
                className="p-1.5 rounded-full bg-red-600/80 text-white hover:bg-red-600"
                title="End Call"
             >
                <MdCallEnd size={16} />
             </button>
          </div>
      )}

      {/* Modals */}
      {showDeviceSettings && (
         <DeviceSettingsModal 
            isOpen={showDeviceSettings} 
            onClose={() => setShowDeviceSettings(false)} 
         />
      )}

      <ScreenShareModal 
        isOpen={showScreenShareModal}
        onClose={() => setShowScreenShareModal(false)}
        onConfirm={(options) => toggleScreenShare(options)}
      />
    </div>
    </Draggable>
  );
};

// Internal component to handle Draggable ref logic cleanly
const DraggableDragger = () => {
    const nodeRef = useRef(null);
    const { localStream, isMuted, isVideoOff } = useCall();
    const videoRef = useRef(null);

    useEffect(() => {
        if (videoRef.current && localStream) {
            videoRef.current.srcObject = localStream;
        }
    }, [localStream]);

    return (
        <Draggable bounds="parent" nodeRef={nodeRef}>
            <div ref={nodeRef} className="absolute bottom-24 right-4 w-48 h-36 bg-gray-800 rounded-lg overflow-hidden shadow-lg border border-gray-700 cursor-move hover:scale-105 transition-transform z-50">
                <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    className="w-full h-full object-cover"
                />
                {/* Local Mute Indicator */}
                <div className="absolute bottom-2 left-2 flex gap-1">
                    {isMuted && <div className="bg-red-500/80 p-1 rounded"><MdMicOff size={12} className="text-white"/></div>}
                    {isVideoOff && <div className="bg-red-500/80 p-1 rounded"><MdVideocamOff size={12} className="text-white"/></div>}
                </div>
            </div>
        </Draggable>
    );
};
