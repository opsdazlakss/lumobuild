// Voice channel notification sounds using Web Audio API
// No external files needed - generates sounds programmatically

let audioContext = null;

const getAudioContext = () => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
};

// Play a simple tone
const playTone = async (frequency, duration, type = 'sine', volume = 0.3) => {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    oscillator.frequency.value = frequency;
    oscillator.type = type;
    gainNode.gain.setValueAtTime(volume, ctx.currentTime);
    
    // Fade out
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
    
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);
  } catch (err) {
    console.warn('[VoiceSound] Failed to play tone:', err);
  }
};

// Discord-like join sound (ascending tone)
export const playJoinSound = () => {
  const ctx = getAudioContext();
  
  // Two ascending tones
  setTimeout(() => playTone(440, 0.1, 'sine', 0.2), 0);    // A4
  setTimeout(() => playTone(554, 0.15, 'sine', 0.25), 80); // C#5
};

// Discord-like leave sound (descending tone)
export const playLeaveSound = () => {
  const ctx = getAudioContext();
  
  // Two descending tones  
  setTimeout(() => playTone(554, 0.1, 'sine', 0.2), 0);    // C#5
  setTimeout(() => playTone(440, 0.15, 'sine', 0.15), 80); // A4
};

// Screen share start sound (higher pitched)
export const playScreenShareSound = () => {
  const ctx = getAudioContext();
  
  // Quick notification blip
  setTimeout(() => playTone(880, 0.08, 'sine', 0.2), 0);   // A5
  setTimeout(() => playTone(1100, 0.12, 'sine', 0.25), 60); // C#6
};

// Mute/unmute click sound
export const playClickSound = () => {
  playTone(600, 0.05, 'sine', 0.1);
};
