import { useEffect, useRef, useState } from 'react';
import { useVoiceChannel } from '../context/VoiceChannelContext';
import { FaTimes, FaMicrophoneSlash, FaDesktop, FaExpand, FaCompress } from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import { VoiceParticipantContextMenu } from './VoiceParticipantContextMenu';
import { useSpeakingIndicator } from '../hooks/useSpeakingIndicator';

export const VoiceChannelGrid = ({ onClose }) => {
  const { participants, localStream, screenStream, remoteStreams, isMuted, isScreenSharing } = useVoiceChannel();
  const { currentUser } = useAuth();
  const [focusedParticipant, setFocusedParticipant] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);

  // Calculate grid layout
  const totalParticipants = participants.length;
  const gridClass = totalParticipants <= 1 ? 'grid-1' 
    : totalParticipants <= 2 ? 'grid-2'
    : totalParticipants <= 4 ? 'grid-4'
    : totalParticipants <= 6 ? 'grid-6'
    : totalParticipants <= 9 ? 'grid-9'
    : 'grid-many';

  // Get the appropriate stream for local user
  const getLocalStream = () => {
    if (isScreenSharing && screenStream) {
      return screenStream;
    }
    return localStream;
  };

  // Get stream for a participant
  const getStreamForParticipant = (participant) => {
    if (participant.odaId === currentUser?.uid) {
      return getLocalStream();
    }
    return remoteStreams.get(participant.peerId);
  };

  return (
    <div className="voice-grid-overlay">
      <div className="voice-grid-modal">
        <div className="voice-grid-header">
          <h3>Voice Channel</h3>
          <button className="close-btn" onClick={onClose}>
            <FaTimes />
          </button>
        </div>

        <div className={`voice-grid ${gridClass}`}>
          {participants.map((participant) => (
            <VideoTile 
              key={participant.odaId}
              participant={participant}
              stream={getStreamForParticipant(participant)}
              isLocal={participant.odaId === currentUser?.uid}
              isMuted={participant.odaId === currentUser?.uid ? isMuted : participant.isMuted}
              onExpand={() => setFocusedParticipant(participant)}
              isFocused={false}
              onContextMenu={(e) => {
                if (participant.odaId === currentUser?.uid) return;
                e.preventDefault();
                setContextMenu({
                  participant,
                  x: e.clientX,
                  y: e.clientY
                });
              }}
            />
          ))}
        </div>
      </div>

      {contextMenu && (
        <VoiceParticipantContextMenu 
          participant={contextMenu.participant}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Fullscreen View */}
      {focusedParticipant && (
        <div className="voice-fullscreen-overlay" onClick={() => setFocusedParticipant(null)}>
          <div className="voice-fullscreen-container" onClick={(e) => e.stopPropagation()}>
            <FullscreenVideo 
              stream={getStreamForParticipant(focusedParticipant)}
              participant={focusedParticipant}
              isLocal={focusedParticipant.odaId === currentUser?.uid}
              onClose={() => setFocusedParticipant(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// Fullscreen video component
const FullscreenVideo = ({ stream, participant, isLocal, onClose }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="fullscreen-video-wrapper">
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        muted={isLocal}
        className="fullscreen-video"
      />
      <div className="fullscreen-overlay">
        <span className="fullscreen-label">
          {participant.displayName}
          {isLocal && ' (You)'}
        </span>
        <button className="fullscreen-close-btn" onClick={onClose}>
          <FaCompress />
        </button>
      </div>
    </div>
  );
};

const VideoTile = ({ participant, stream, isLocal, isMuted, onExpand, isFocused, onContextMenu }) => {
  const videoRef = useRef(null);
  
  // Speaking indicator - only check if not muted
  const isSpeaking = useSpeakingIndicator(isMuted ? null : stream, { threshold: 5 });

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const hasVideo = stream?.getVideoTracks()?.length > 0 && stream.getVideoTracks()[0].enabled;

  return (
    <div 
      className={`video-tile ${isLocal ? 'local' : ''} ${isFocused ? 'focused' : ''} ${isSpeaking ? 'speaking' : ''}`}
      onClick={() => hasVideo && onExpand && onExpand()}
      onContextMenu={onContextMenu}
    >
      {hasVideo ? (
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted={isLocal}
          className="video-feed"
        />
      ) : (
        <div className="video-placeholder">
          {participant.photoUrl ? (
            <img src={participant.photoUrl} alt="" className="avatar-large" />
          ) : (
            <div className="avatar-placeholder-large">
              {participant.displayName?.charAt(0)?.toUpperCase() || '?'}
            </div>
          )}
        </div>
      )}

      <div className="tile-overlay">
        <span className="participant-label">
          {participant.displayName}
          {isLocal && ' (You)'}
        </span>
        <div className="tile-status">
          {isMuted && <FaMicrophoneSlash className="status-muted" />}
          {participant.isScreenSharing && <FaDesktop className="status-screen" />}
          {hasVideo && (
            <FaExpand 
              className="status-expand" 
              onClick={(e) => { e.stopPropagation(); onExpand && onExpand(); }}
              title="Full Screen"
            />
          )}
        </div>
      </div>
    </div>
  );
};
