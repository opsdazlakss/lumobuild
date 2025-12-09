// Notification sound utility
// Uses Web Audio API to play a simple notification beep

let audioContext = null;

// Initialize audio context (lazy load)
const getAudioContext = () => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
};

// Play notification sound - improved with pleasant melody
export const playNotificationSound = () => {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    // First tone (higher pitch)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    
    osc1.frequency.value = 880; // A5 note
    osc1.type = 'sine';
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.2, now + 0.01);
    gain1.gain.linearRampToValueAtTime(0, now + 0.1);
    
    osc1.start(now);
    osc1.stop(now + 0.1);
    
    // Second tone (lower pitch) - slight delay for melody effect
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    
    osc2.frequency.value = 660; // E5 note
    osc2.type = 'sine';
    gain2.gain.setValueAtTime(0, now + 0.08);
    gain2.gain.linearRampToValueAtTime(0.2, now + 0.09);
    gain2.gain.linearRampToValueAtTime(0, now + 0.25);
    
    osc2.start(now + 0.08);
    osc2.stop(now + 0.25);
  } catch (err) {
    console.error('Error playing notification sound:', err);
  }
};

// Check if user is mentioned in message
export const isMentioned = (messageText, currentUserDisplayName) => {
  if (!messageText || !currentUserDisplayName) return false;
  
  // Check for @everyone
  if (/@everyone\b/i.test(messageText)) return true;
  
  // Check for @username
  const mentionPattern = new RegExp(`@${currentUserDisplayName}\\b`, 'i');
  return mentionPattern.test(messageText);
};
