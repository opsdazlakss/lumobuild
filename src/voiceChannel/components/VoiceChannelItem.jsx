import { useEffect, useState } from 'react';
import { useVoiceChannel } from '../context/VoiceChannelContext';
import { db } from '../../services/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import { useData } from '../../context/DataContext';
import { FaVolumeUp, FaMicrophone, FaMicrophoneSlash, FaVideo, FaDesktop } from 'react-icons/fa';
import { VoiceParticipantContextMenu } from './VoiceParticipantContextMenu';
import { useAuth } from '../../context/AuthContext';
import { useSpeakingIndicator } from '../hooks/useSpeakingIndicator';

export const VoiceChannelItem = ({ channel }) => {
  const { currentVoiceChannel, joinVoiceChannel, participants, remoteStreams, localStream } = useVoiceChannel();
  const { currentServer } = useData();
  const { currentUser } = useAuth();
  const [channelParticipants, setChannelParticipants] = useState([]);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState(null); // { participant, x, y }

  const isActive = currentVoiceChannel === channel.id;

  // Listen to participants for this specific channel
  useEffect(() => {
    if (!currentServer || !channel.id) return;

    const participantsRef = collection(
      db, 'servers', currentServer, 'channels', channel.id, 'voiceParticipants'
    );

    const unsubscribe = onSnapshot(participantsRef, (snapshot) => {
      const data = [];
      snapshot.forEach((doc) => {
        data.push({ odaId: doc.id, ...doc.data() });
      });
      setChannelParticipants(data);
    });

    return () => unsubscribe();
  }, [currentServer, channel.id]);

  const handleClick = () => {
    if (!isActive) {
      joinVoiceChannel(channel.id);
    }
  };

  return (
    <>
      <div 
        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors duration-150 ${
          isActive 
            ? 'bg-dark-hover text-dark-text' 
            : 'text-dark-muted hover:bg-dark-hover hover:text-dark-text'
        }`}
        onClick={handleClick}
      >
      <FaVolumeUp className="flex-shrink-0" />
      <span className="truncate text-sm flex-1 text-left">{channel.name}</span>
    </div>
      
      {channelParticipants.length > 0 && (
        <div className="voice-participants">
          {channelParticipants.map((participant) => (
            <ParticipantItem
              key={participant.odaId}
              participant={participant}
              isLocal={participant.odaId === currentUser?.uid}
              remoteStreams={remoteStreams}
              localStream={localStream}
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
      )}

      {contextMenu && (
        <VoiceParticipantContextMenu 
          participant={contextMenu.participant}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onClose={() => setContextMenu(null)}
          channelId={channel.id}
          serverId={currentServer}
        />
      )}
    </>
  );
};

// Separate component for each participant to use the speaking indicator hook
const ParticipantItem = ({ participant, isLocal, remoteStreams, localStream, onContextMenu }) => {
  // Get the appropriate stream for this participant
  const stream = isLocal ? localStream : remoteStreams.get(participant.peerId);
  
  // Only check for speaking if not muted and stream exists
  const isSpeaking = useSpeakingIndicator(
    (participant.isMuted || !stream) ? null : stream, 
    { threshold: 15 }
  );

  return (
    <div 
      className={`voice-participant ${isSpeaking ? 'speaking' : ''}`}
      onContextMenu={onContextMenu}
    >
      <div className="participant-avatar">
        {participant.photoUrl ? (
          <img src={participant.photoUrl} alt="" />
        ) : (
          <div className="avatar-placeholder">
            {participant.displayName?.charAt(0)?.toUpperCase() || '?'}
          </div>
        )}
      </div>
      <span className="participant-name">{participant.displayName}</span>
      <div className="participant-status">
        {participant.isMuted && <FaMicrophoneSlash className="status-icon muted" />}
        {participant.isVideoOn && <FaVideo className="status-icon video" />}
        {participant.isScreenSharing && <FaDesktop className="status-icon screen" />}
      </div>
    </div>
  );
};
