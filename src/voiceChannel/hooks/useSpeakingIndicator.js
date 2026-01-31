import { useEffect, useRef, useState } from 'react';

/**
 * Hook to detect if an audio stream is currently "speaking" (audio level above threshold)
 * Uses Web Audio API to analyze audio levels in real-time
 * 
 * @param {MediaStream} stream - The audio/video stream to analyze
 * @param {Object} options - Configuration options
 * @param {number} options.threshold - Volume threshold (0-255) to consider as speaking, default 30
 * @param {number} options.interval - How often to check audio level in ms, default 100
 * @returns {boolean} - Whether the stream is currently speaking
 */
export const useSpeakingIndicator = (stream, options = {}) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const intervalRef = useRef(null);
  
  const threshold = options.threshold ?? 30;
  const interval = options.interval ?? 100;

  useEffect(() => {
    // Cleanup previous resources
    const cleanup = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (audioContextRef.current) {
        const ctx = audioContextRef.current;
        if (ctx.state !== 'closed') {
          ctx.close().catch(e => console.warn('Error closing AudioContext:', e));
        }
        audioContextRef.current = null;
      }
      analyserRef.current = null;
      setIsSpeaking(false);
    };

    // Need a valid stream with audio tracks
    if (!stream) {
      cleanup();
      return;
    }

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      cleanup();
      return;
    }

    // Check if track is enabled and not muted
    const track = audioTracks[0];
    if (!track.enabled || track.muted) {
      cleanup();
      return;
    }

    try {
      // Create AudioContext and Analyser
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioContextClass();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;
      
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      // FIX: Check for suspended state and resume
      if (audioContext.state === 'suspended') {
        audioContext.resume().then(() => {
          console.log('[useSpeakingIndicator] AudioContext resumed');
        }).catch(e => console.error('[useSpeakingIndicator] Failed to resume AudioContext:', e));
      }

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      // Start monitoring audio levels
      intervalRef.current = setInterval(() => {
        if (!analyserRef.current) return;
        
        analyserRef.current.getByteFrequencyData(dataArray);
        
        // Calculate average volume
        let sum = 0;
        for(let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
        }
        const average = sum / dataArray.length;

        // Update speaking state
        const speaking = average > threshold;
        setIsSpeaking(speaking);
      }, interval);

    } catch (err) {
      console.error('[useSpeakingIndicator] Error initializing audio analysis:', err);
      cleanup();
    }

    return cleanup;
  }, [stream, threshold, interval]);

  return isSpeaking;
};

export default useSpeakingIndicator;
