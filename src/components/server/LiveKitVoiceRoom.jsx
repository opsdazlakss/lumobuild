import { useEffect, useState, useRef } from 'react';
import {
  LiveKitRoom,
  GridLayout,
  ParticipantTile,
  RoomAudioRenderer,
  useTracks,
  useLocalParticipant,
  useLiveKitRoom,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import '@livekit/components-styles';
import { useCall } from '../../context/CallContext';
import { 
    MdMic, MdMicOff, 
    MdVideocam, MdVideocamOff, 
    MdScreenShare, MdStopScreenShare, 
    MdCallEnd, MdKeyboardArrowDown
} from 'react-icons/md';

import { useMediaDeviceSelect } from '@livekit/components-react';

export const LiveKitVoiceRoom = ({ channel, serverId, user, onDisconnect }) => {
  const { isMuted, isDeafened, availableDevices, selectedMicId, setSelectedMicId } = useCall(); // Get state
  const [token, setToken] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const [error, setError] = useState(null);
  
  // Room Name = serverId:channelId for uniqueness
  const roomName = `${serverId}:${channel.id}`;

  useEffect(() => {
    const getToken = async () => {
      try {
        let tokenData;
        
        // Use user.uid as the Participant Identity for consistency with Firestore/Volume Controls
        if (window.electron && window.electron.generateLiveKitToken) {
            tokenData = await window.electron.generateLiveKitToken(roomName, user.uid);
        } else {
            // ... Error handling
            throw new Error("Electron environment required");
        }
        
        if (tokenData.error) throw new Error(tokenData.error);
        
        setToken(tokenData.token);
        setServerUrl(tokenData.wsUrl);
      } catch (e) {
        console.error("Failed to get LiveKit token:", e);
        setError(e.message);
      }
    };

    getToken();
  }, [roomName, user]);

  if (error) return <div className="p-4 text-red-500">Error: {error}</div>;
  if (!token || !serverUrl) return <div className="p-4 text-gray-400">Connecting to Voice Server...</div>;

  return (
    <LiveKitRoom
      video={false} 
      audio={!isMuted} // Sync initial state
      token={token}
      serverUrl={serverUrl}
      data-lk-theme="default"
      style={{ height: 'calc(100vh - 100px)', width: '100%' }}
      onDisconnected={onDisconnect}
    >
      {/* 
        Custom Audio Renderer for Individual Volume Control
      */}
      {!isDeafened && <CustomAudioRenderer />}
      
      <MyVideoConference />
      
      {/* Custom Controls to sync with Sidebar & Screen Picker */}
      <CustomControlBar onLeave={onDisconnect} />
    </LiveKitRoom>
  );
};

// Hook-based Custom Audio Renderer
const CustomAudioRenderer = () => {
    const { peerVolumes } = useCall();
    // Get all remote audio tracks. Explicitly filter out local just in case.
    const tracks = useTracks([Track.Source.Microphone], { onlySubscribed: true })
        .filter(track => !track.participant.isLocal);
    
    return (
        <>
            {tracks.map(trackRef => {
                 // Determine identity (userId)
                 // LiveKit logic: trackRef.participant.identity SHOULD match the `user.uid` we passed in generator
                 const identity = trackRef.participant?.identity;
                 // Get volume from context (default 1)
                 const volume = (identity && typeof peerVolumes[identity] !== 'undefined') ? peerVolumes[identity] : 1;
                 
                 return (
                     <AudioTrackComponent 
                        key={trackRef.publication.trackSid} 
                        trackRef={trackRef} 
                        volume={volume} 
                     />
                 );
            })}
        </>
    );
};

// Wrapper for single audio track to apply volume ref
const AudioTrackComponent = ({ trackRef, volume }) => {
    const audioRef = useRef(null);

    // LiveKit's useMediaTrack attaches track to element automatically if we use their component?
    // Usually AudioTrack component does it.
    // But standard <audio> tag needs manual attach.
    // Let's use Livekit's `AudioTrack` component if available, but it might not accept volume.
    // Accessing the DOM element is safer.
    
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = volume;
        }
    }, [volume]);

    // Use LiveKit's utility hook to attach
    // Or simpler: use <AudioTrack> and try to ref it? 
    // <AudioTrack> from `components-react` doesn't forward ref to audio element easily.
    // We will use native logic with `trackRef.publication.track`
    
    const track = trackRef.publication.track;
    
    useEffect(() => {
        if (track && audioRef.current) {
            track.attach(audioRef.current);
            return () => track.detach(audioRef.current);
        }
    }, [track]);

    return <audio ref={audioRef} autoPlay playsInline />;
};

// Custom Video Grid
const MyVideoConference = () => {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );
  
  return (
    <GridLayout tracks={tracks} style={{ height: 'calc(100% - 80px)' }}> 
      <ParticipantTile />
    </GridLayout>
  );
};

// Custom Control Bar to replace default one
const CustomControlBar = ({ onLeave }) => {
    const { isMuted, toggleAudio } = useCall();
    const { localParticipant } = useLocalParticipant();
    const { devices, activeDeviceId, setActiveMediaDevice } = useMediaDeviceSelect({ kind: 'audioinput' });
    
    // Screen Share State
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [showSourcePicker, setShowSourcePicker] = useState(false);
    const [showMicPicker, setShowMicPicker] = useState(false);
    const [sources, setSources] = useState([]);

    // Sync Mute State from Sidebar (CallContext) -> LiveKit
    useEffect(() => {
        if (!localParticipant) return;
        localParticipant.setMicrophoneEnabled(!isMuted);
    }, [isMuted, localParticipant]);

    // Handle Mic Selection
    const handleMicSelect = async (deviceId) => {
        await setActiveMediaDevice(deviceId);
        setShowMicPicker(false);
    };

    // LiveKit Active Speaker Bridge
    const { room } = useLiveKitRoom();
    const { setTalkingPeers } = useCall();
    
    useEffect(() => {
        if (!room) return;
        
        const onActiveSpeakersChanged = (speakers) => {
             const talkingMap = {};
             speakers.forEach(speaker => {
                 // speaker.identity is the user.uid we set in token
                 if (speaker.identity) {
                     talkingMap[speaker.identity] = true;
                     // Also set 'me' if local
                     if (speaker.isLocal) talkingMap['me'] = true;
                 }
             });
             setTalkingPeers(prev => talkingMap);
        };
        
        room.on('activeSpeakersChanged', onActiveSpeakersChanged);
        return () => {
            room.off('activeSpeakersChanged', onActiveSpeakersChanged);
        };
    }, [room, setTalkingPeers]);

    // Handle Screen Share Click
    const handleScreenShareClick = async () => {
        if (isScreenSharing) {
            // Stop sharing
            await localParticipant.setScreenShareEnabled(false);
            setIsScreenSharing(false);
        } else {
            // Start sharing -> Show Picker
            try {
                if (window.electron?.desktopCapturer) {
                    const availableSources = await window.electron.desktopCapturer.getSources({ types: ['window', 'screen'] });
                    setSources(availableSources);
                    setShowSourcePicker(true);
                } else {
                    console.warn("Desktop Capturer not found");
                }
            } catch (e) {
                console.error("Error getting sources:", e);
            }
        }
    };

    // Confirm Source Selection
    const handleSourceSelect = async (sourceId) => {
        try {
            setShowSourcePicker(false);
            
            await localParticipant.setScreenShareEnabled(true, { 
                audio: true, // System audio if available
                video: { 
                    deviceId: sourceId, // IMPORTANT: electron maps this to chromeMediaSourceId logic usually
                } 
            });
            setIsScreenSharing(true);
        } catch (e) {
            console.error("Failed to start screen share:", e);
        }
    };

    return (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-4 bg-black/80 p-3 rounded-full border border-gray-700 z-50 backdrop-blur-md">
            
            {/* Mic Control Group */}
            <div className="flex items-center bg-gray-700/50 rounded-full p-1 relative">
                {/* Mute Toggle */}
                <button 
                    onClick={toggleAudio}
                    className={`p-2 rounded-full transition-colors mx-1 ${!isMuted ? 'bg-gray-600 hover:bg-gray-500' : 'bg-red-500 hover:bg-red-600'}`}
                    title={!isMuted ? "Mute" : "Unmute"}
                >
                    {!isMuted ? <MdMic className="text-white" size={20} /> : <MdMicOff className="text-white" size={20} />}
                </button>
                
                {/* Dropdown Arrow */}
                <button
                    onClick={() => setShowMicPicker(!showMicPicker)}
                    className="p-1 pr-2 rounded-r-full hover:bg-gray-600/50 text-gray-300"
                >
                     <MdKeyboardArrowDown size={16} />
                </button>

                {/* Dropdown Menu */}
                {showMicPicker && (
                    <div className="absolute bottom-full left-0 mb-3 w-64 bg-gray-900 border border-gray-700 rounded-lg shadow-xl overflow-hidden z-[60]">
                        <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase bg-gray-800/50">
                            Select Microphone
                        </div>
                        {devices.map(device => (
                            <button
                                key={device.deviceId}
                                onClick={() => handleMicSelect(device.deviceId)}
                                className={`w-full text-left px-4 py-2 text-sm truncate flex items-center justify-between ${activeDeviceId === device.deviceId ? 'text-brand-primary bg-brand-primary/10' : 'text-gray-200 hover:bg-gray-800'}`}
                            >
                                <span className="truncate flex-1">{device.label || `Mic ${device.deviceId.slice(0,5)}...`}</span>
                                {activeDeviceId === device.deviceId && <div className="w-2 h-2 rounded-full bg-brand-primary"></div>}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Screen Share */}
            <button 
                onClick={handleScreenShareClick}
                className={`p-3 rounded-full transition-colors ${isScreenSharing ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-700 hover:bg-gray-600'}`}
                title="Share Screen"
            >
                {isScreenSharing ? <MdStopScreenShare className="text-white" size={24} /> : <MdScreenShare className="text-white" size={24} />}
            </button>

            {/* Leave */}
            <button 
                onClick={onLeave}
                className="p-3 rounded-full bg-red-600 hover:bg-red-700 transition-colors"
                title="Disconnect"
            >
                <MdCallEnd className="text-white" size={24} />
            </button>


            {/* Source Picker Modal (Simple Overlay) */}
            {showSourcePicker && (
                <div className="fixed inset-0 bg-black/90 z-[100] flex flex-col items-center justify-center p-10">
                    <h3 className="text-white text-xl mb-4 font-bold">Select Screen to Share</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 overflow-y-auto max-h-[70vh] w-full max-w-4xl p-4">
                        {sources.map(src => (
                            <div 
                                key={src.id}
                                onClick={() => handleSourceSelect(src.id)}
                                className="cursor-pointer border border-gray-700 rounded-lg p-2 hover:bg-gray-800 hover:border-brand-primary transition-all flex flex-col gap-2"
                            >
                                <img src={src.thumbnail.toDataURL()} alt={src.name} className="w-full rounded bg-black object-contain aspect-video" />
                                <span className="text-gray-300 text-sm truncate text-center">{src.name}</span>
                            </div>
                        ))}
                    </div>
                    <button 
                        onClick={() => setShowSourcePicker(false)}
                        className="mt-6 px-6 py-2 bg-gray-600 rounded hover:bg-gray-500 text-white"
                    >
                        Cancel
                    </button>
                </div>
            )}
        </div>
    );
};
