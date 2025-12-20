import { useVoiceChannel } from '../context/VoiceChannelContext';
import { FaVolumeUp } from 'react-icons/fa';

export const VoiceParticipantContextMenu = ({ participant, position, onClose }) => {
  const { userVolumes, setUserVolume } = useVoiceChannel();
  
  // Local volume state (0 to 100 for the slider)
  const currentVolume = Math.round((userVolumes.get(participant.odaId) ?? 1.0) * 100);

  const handleVolumeChange = (e) => {
    const newVolume = parseInt(e.target.value) / 100;
    setUserVolume(participant.odaId, newVolume);
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
      </div>
    </>
  );
};
