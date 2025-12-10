import { useRef, useEffect, useState } from 'react';
import { useCall } from '../../context/CallContext';
import { MdCallEnd, MdMic, MdMicOff, MdVideocam, MdVideocamOff, MdScreenShare, MdStopScreenShare } from 'react-icons/md';
import { FaPhone } from 'react-icons/fa';
import { cn } from '../../utils/helpers';
import Draggable from 'react-draggable';

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
    toggleScreenShare
  } = useCall();

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const [isMinimized, setIsMinimized] = useState(false);

  // Sync streams to video elements
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, callStatus]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, callStatus]);

  if (callStatus === 'idle') return null;

  // 1. Incoming Call UI
  if (callStatus === 'incoming') {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
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
    <div className={cn(
        "fixed z-[100] bg-gray-900 shadow-2xl overflow-hidden transition-all duration-300 border border-gray-700",
        isMinimized 
            ? "bottom-4 right-4 w-64 h-48 rounded-lg" 
            : "inset-0 flex flex-col"
    )}>
      
      {/* Header (Minimize/Maximize) */}
      <div className="absolute top-4 left-4 z-10">
        <button 
            onClick={() => setIsMinimized(!isMinimized)}
            className="bg-black/50 hover:bg-black/70 text-white px-3 py-1 rounded-full text-sm backdrop-blur-md"
        >
            {isMinimized ? "Expand" : "Minimize"}
        </button>
      </div>

      {/* Main Video Area (Remote or Outgoing Placeholder) */}
      <div className="relative flex-1 bg-black flex items-center justify-center w-full h-full">
        {remoteStream ? (
           <video 
             ref={remoteVideoRef} 
             autoPlay 
             playsInline 
             className="w-full h-full object-contain"
           />
        ) : (
           <div className="text-center">
             <div className="w-32 h-32 mx-auto mb-4 rounded-full bg-gray-800 flex items-center justify-center text-6xl font-bold text-gray-500 animate-pulse">
                {outgoingCallUser?.displayName?.[0] || activeCall?.metadata?.name?.[0] || '?'}
             </div>
             <p className="text-xl text-white font-medium">
                {callStatus === 'outgoing' ? 'Calling...' : 'Connecting...'}
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
          "absolute bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 p-3 bg-gray-900/80 backdrop-blur-md rounded-2xl border border-gray-700 shadow-xl transition-opacity duration-300 hover:opacity-100",
          isMinimized && "hidden",
          // Auto-hide controls after inaction (optional later), for now just keep bottom
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

         <button 
           onClick={toggleScreenShare}
           disabled={!activeCall}
           className={cn(
               "p-3 rounded-xl transition-all hover:scale-110 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed",
               isScreenSharing ? "bg-green-500 text-white" : "bg-gray-700/50 text-white hover:bg-gray-600"
           )}
           title={isScreenSharing ? "Stop Sharing" : "Share Screen"}
         >
           {isScreenSharing ? <MdStopScreenShare size={22} /> : <MdScreenShare size={22} />}
         </button>

         <div className="w-px h-8 bg-gray-700 mx-2" />

         <button 
           onClick={() => endCall(true)}
           className="p-3 rounded-xl bg-red-600 text-white hover:bg-red-700 transition-all hover:scale-110 active:scale-95 shadow-lg shadow-red-900/20"
           title="End Call"
         >
           <MdCallEnd size={24} />
         </button>
      </div>
    </div>
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
