import { useVoiceChannel } from '../context/VoiceChannelContext';
import { FaVolumeUp, FaUserSlash } from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { db } from '../../services/firebase';
import { doc, deleteDoc } from 'firebase/firestore';

export const VoiceParticipantContextMenu = ({ participant, position, onClose, channelId, serverId }) => {
  const { userVolumes, setUserVolume } = useVoiceChannel();
  const { userProfile } = useAuth();
  
  const isAdmin = userProfile?.role === 'admin';
  
  // Local volume state (0 to 100 for the slider)
  const currentVolume = Math.round((userVolumes.get(participant.odaId) ?? 1.0) * 100);

  const handleVolumeChange = (e) => {
    const newVolume = parseInt(e.target.value) / 100;
    setUserVolume(participant.odaId, newVolume);
  };

  const handleKickFromVoice = async () => {
    console.log('[Admin] Kick attempt:', {
      isAdmin,
      channelId,
      serverId,
      participantId: participant.odaId,
      participantName: participant.displayName
    });

    if (!isAdmin) {
      console.error('[Admin] Not an admin, cannot kick');
      return;
    }

    if (!channelId || !serverId) {
      console.error('[Admin] Missing channel or server ID');
      return;
    }
    
    try {
      const participantRef = doc(
        db, 'servers', serverId, 'channels', channelId, 'voiceParticipants', participant.odaId
      );
      console.log('[Admin] Deleting participant:', participantRef.path);
      await deleteDoc(participantRef);
      console.log('[Admin] Successfully kicked user from voice:', participant.displayName);
      onClose();
    } catch (err) {
      console.error('[Admin] Failed to kick user:', err);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
      <div 
        className="fixed bg-[#111214] border border-[#1e1f22] rounded-lg shadow-xl py-3 z-50 w-64 px-3"
        style={{ top: position.y, left: position.x }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-xs font-bold text-[#949ba4] uppercase mb-3 px-1">
          {participant.displayName} SETTINGS
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm text-[#dbdee1] font-medium mb-1 px-1">
            <div className="flex items-center gap-2">
              <FaVolumeUp size={14} className="text-[#949ba4]" />
              <span>User Volume</span>
            </div>
            <span className="text-xs font-bold text-brand-primary">{currentVolume}%</span>
          </div>
          
          <input 
            type="range" 
            min="0" 
            max="100" 
            value={currentVolume} 
            onChange={handleVolumeChange}
            className="volume-slider"
            style={{
              background: `linear-gradient(to right, #ef9f64 0%, #ef9f64 ${currentVolume}%, #1e1f22 ${currentVolume}%, #1e1f22 100%)`
            }}
          />
        </div>

        <div className="mt-4 border-t border-[#1e1f22] pt-2">
          <div className="text-[11px] text-[#949ba4] px-1 italic">
            This setting only affects the audio heard by you.
          </div>
        </div>

        {/* Admin Actions */}
        {isAdmin && (
          <div className="mt-3 border-t border-[#1e1f22] pt-3">
            <button
              onClick={handleKickFromVoice}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded transition-colors"
            >
              <FaUserSlash size={14} />
              <span>Kick from Voice Channel</span>
            </button>
          </div>
        )}
      </div>
    </>
  );
};
