import { createContext, useContext, useState, useEffect } from 'react';
import { useToast } from './ToastContext';

const SoundboardContext = createContext();

const MAX_SOUNDS = 10;
const MAX_SOUND_SIZE_KB = 300;

export const useSoundboard = () => {
  const context = useContext(SoundboardContext);
  if (!context) {
    throw new Error('useSoundboard must be used within SoundboardProvider');
  }
  return context;
};

export const SoundboardProvider = ({ children }) => {
  const { error: showError } = useToast();
  
  const [customSounds, setCustomSounds] = useState(() => {
    try {
      const saved = localStorage.getItem('dss_custom_sounds');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('dss_custom_sounds', JSON.stringify(customSounds));
  }, [customSounds]);

  const addSound = async (name, file) => {
    if (customSounds.length >= MAX_SOUNDS) {
      showError(`Maximum ${MAX_SOUNDS} sounds allowed.`);
      return false;
    }
    if (file.size > MAX_SOUND_SIZE_KB * 1024) {
      showError(`File too large. Max ${MAX_SOUND_SIZE_KB}KB.`);
      return false;
    }

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const newSound = {
          id: Date.now().toString(),
          name: name.trim() || 'Sound',
          src: e.target.result // Base64
        };
        setCustomSounds(prev => [...prev, newSound]);
        resolve(true);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeSound = (id) => {
    setCustomSounds(prev => prev.filter(s => s.id !== id));
  };

  const value = {
    customSounds,
    addSound,
    removeSound,
    MAX_SOUNDS
  };

  return (
    <SoundboardContext.Provider value={value}>
      {children}
    </SoundboardContext.Provider>
  );
};
