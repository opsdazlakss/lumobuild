import { useVoiceChannel } from '../context/VoiceChannelContext';
import { VoiceChannelItem } from './VoiceChannelItem';
import { FaVolumeUp } from 'react-icons/fa';

export const VoiceChannelSection = () => {
  const { voiceChannels } = useVoiceChannel();

  if (!voiceChannels || voiceChannels.length === 0) {
    return null;
  }

  return (
    <>
      <div className="text-xs font-semibold text-dark-muted uppercase px-2 mb-1 mt-4">
        VOICE CHANNELS
      </div>
      <div className="voice-channel-list">
        {voiceChannels.map((channel) => (
          <VoiceChannelItem key={channel.id} channel={channel} />
        ))}
      </div>
    </>
  );
};
