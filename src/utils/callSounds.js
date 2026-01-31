// Call sound utilities using Web Audio API
let audioContext = null;
let activeOscillators = [];
let activeGainNodes = [];

const getAudioContext = () => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
};

const stopAllSounds = () => {
  activeOscillators.forEach(osc => {
    try {
      osc.stop();
      osc.disconnect();
    } catch (e) { /* ignore */ }
  });
  activeOscillators = [];
  
  activeGainNodes.forEach(gain => {
    try {
        gain.disconnect();
    } catch (e) { /* ignore */ }
  });
  activeGainNodes = [];
};

// Outgoing Call Ring (Classic Phone Ringing sound for caller)
// Long tone, long pause
export const playOutgoingRing = () => {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();

    stopAllSounds(); // Clear previous

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.value = 440; // A4 standard tone
    
    // Connect
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    const now = ctx.currentTime;
    
    // Create a rhythmic pattern: 2s ON, 4s OFF
    // Not strictly loopable with simple oscillator.start/stop unless we use a custom loop logic or AudioBuffer.
    // Easiest "pure code" way is to use setInterval or recursive calls, but safer is AudioBuffer.
    // However, for simplicity without assets, let's use a "pulse" via Gain Node LFO or just a simple interval wrapper.

    // Let's use a simple interval wrapper logic outside this function? 
    // No, better to manage inside.
    
    // We'll return a cleanup function.
    let isPlaying = true;
    
    const playTone = () => {
        if (!isPlaying) return;
        
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.frequency.value = 425; // Standard ringback tone frequency
        osc.type = 'sine';
        
        const startTime = ctx.currentTime;
        
        // modulation
        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 20; // 20Hz rumble
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 500;
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);
        lfo.start(startTime);
        lfo.stop(startTime + 2);

        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.1, startTime + 0.1);
        gain.gain.setValueAtTime(0.1, startTime + 1.8);
        gain.gain.linearRampToValueAtTime(0, startTime + 2.0);
        
        osc.start(startTime);
        osc.stop(startTime + 2.0);
        
        activeOscillators.push(osc); 
        activeOscillators.push(lfo);
        activeGainNodes.push(gain);
    };

    // Initial play
    playTone();
    // Loop every 4 seconds
    const intervalId = setInterval(playTone, 4000);

    return () => {
        isPlaying = false;
        clearInterval(intervalId);
        stopAllSounds();
    };

  } catch (err) {
    console.error("Error playing outgoing ring:", err);
    return () => {};
  }
};

// Incoming Call Ring (For Callee)
// More urgent, repeated pattern
export const playIncomingRing = () => {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    
    stopAllSounds();

    let isPlaying = true;

    const playTone = () => {
         if (!isPlaying) return;
         const now = ctx.currentTime;

         // Digital phone ring style
         // Three quick pulses
         const createPulse = (startTime, freq) => {
             const osc = ctx.createOscillator();
             const gain = ctx.createGain();
             osc.connect(gain);
             gain.connect(ctx.destination);
             
             osc.frequency.value = freq;
             osc.type = 'square'; // Digital sound
             
             gain.gain.setValueAtTime(0, startTime);
             gain.gain.linearRampToValueAtTime(0.1, startTime + 0.05);
             gain.gain.setValueAtTime(0.1, startTime + 0.2);
             gain.gain.linearRampToValueAtTime(0, startTime + 0.25);
             
             osc.start(startTime);
             osc.stop(startTime + 0.3);
             
             activeOscillators.push(osc);
             activeGainNodes.push(gain);
         };

         createPulse(now, 880);
         createPulse(now + 0.4, 880);
         createPulse(now + 0.8, 880);
    };

    playTone();
    const intervalId = setInterval(playTone, 3000); // Repeat every 3s

    return () => {
        isPlaying = false;
        clearInterval(intervalId);
        stopAllSounds();
    };

  } catch (err) {
      console.error("Error playing incoming ring:", err);
      return () => {};
  }
};

export const stopRing = () => {
    stopAllSounds();
};
