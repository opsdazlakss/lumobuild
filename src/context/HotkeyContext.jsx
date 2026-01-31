import { createContext, useContext, useState, useEffect } from 'react';

const HotkeyContext = createContext();

export const useHotkeys = () => {
  const context = useContext(HotkeyContext);
  if (!context) {
    throw new Error('useHotkeys must be used within HotkeyProvider');
  }
  return context;
};

export const HotkeyProvider = ({ children }) => {
  // Config format: { actionId: "KeyCombo" }
  // Example: { toggleMute: "Control+m", toggleDeafen: "Control+d" }
  const [hotkeys, setHotkeys] = useState(() => {
    const saved = localStorage.getItem('user_hotkeys');
    return saved ? JSON.parse(saved) : {
        toggleMute: '',
        toggleDeafen: ''
    };
  });

  useEffect(() => {
    localStorage.setItem('user_hotkeys', JSON.stringify(hotkeys));
  }, [hotkeys]);

  const updateHotkey = (actionId, combo) => {
    setHotkeys(prev => ({
      ...prev,
      [actionId]: combo
    }));
  };

  const resetToDefaults = () => {
      setHotkeys({
          toggleMute: '',
          toggleDeafen: ''
      });
  };

  const value = {
    hotkeys,
    updateHotkey,
    resetToDefaults
  };

  return <HotkeyContext.Provider value={value}>{children}</HotkeyContext.Provider>;
};
