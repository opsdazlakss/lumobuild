import { useState, useEffect, useRef } from 'react';
import { MdKeyboard, MdClose, MdCheck } from 'react-icons/md';

export const KeybindRecorder = ({ label, currentValue, onChange }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [pressedKeys, setPressedKeys] = useState(new Set());
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!isRecording) return;

    const handleKeyDown = (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Ignore if only modifier keys are pressed, we want a combo ending in a non-modifier
      // But we need to track them.
      const key = e.key;
      
      // Map meta/control etc to consistent names if needed, but 'e.key' is usually good.
      // We will build a string like "Control+Shift+M"
      
      setPressedKeys(prev => {
          const newSet = new Set(prev);
          newSet.add(key);
          return newSet;
      });
    };

    const handleKeyUp = (e) => {
        if (!isRecording) return;
        e.preventDefault();
        e.stopPropagation();

        // When key is released, if we have a valid combo, save it.
        // Logic: If user lifts a key, we take the current set of pressed keys as the combo?
        // Or do we wait for non-modifier key?
        // Standard recorder behavior: Wait for a non-modifier key to be pressed, then as soon as it is released OR another key pressed?
        // Simpler: Just rely on the keys held down when the last key is pressed?
        
        // Let's allow users to hold "Ctrl", then "Shift", then press "M".
        // The combo is finalized when they press "M"? Or when they release?
        // Most games finalize on KeyDown of the non-modifier.
        
        // Let's restart logic. React events might be tricky.
        // Let's use a simpler approach: keydown updates the display.
        // If the key is 'Escape', cancel? Or allow Escape as a bind?
        // Let's block Escape as cancel.
    };
    
    // Global listener for recording phase
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isRecording]);

  // Actually, capturing accurate combos inside React effect with state is hard due to closures.
  // Better to use a reliable library, but we must implement manually.
  // Let's refine the listener.
  
  const handleRecordClick = () => {
      setIsRecording(true);
      setPressedKeys(new Set());
  };

  const handleStopRecording = () => {
      setIsRecording(false);
      setPressedKeys(new Set());
  };

  // Improved key handler
  useEffect(() => {
      if (!isRecording) return;

      const handleDown = (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          if (e.key === 'Escape') {
              setIsRecording(false);
              return;
          }

          const modifiers = ['Control', 'Shift', 'Alt', 'Meta'];
          if (modifiers.includes(e.key)) return; // Wait for non-modifier

          // Construct combo
          const comboParts = [];
          if (e.ctrlKey) comboParts.push('Control');
          if (e.shiftKey) comboParts.push('Shift');
          if (e.altKey) comboParts.push('Alt');
          if (e.metaKey) comboParts.push('Meta');
          
          // Capitalize key
          let char = e.key;
          if (char.length === 1) char = char.toUpperCase();
          
          comboParts.push(char);
          
          const comboString = comboParts.join('+');
          onChange(comboString);
          setIsRecording(false);
      };

      window.addEventListener('keydown', handleDown);
      return () => window.removeEventListener('keydown', handleDown);
  }, [isRecording, onChange]);

  return (
    <div className="flex items-center justify-between p-3 bg-dark-sidebar rounded-lg border border-dark-hover">
       <span className="text-dark-text font-medium">{label}</span>
       
       <div className="flex gap-2">
           <button
             ref={buttonRef}
             onClick={handleRecordClick}
             className={`
               min-w-[120px] px-4 py-2 rounded-lg font-mono text-sm border transition-colors
               ${isRecording 
                  ? 'bg-brand-primary text-white border-brand-primary animate-pulse' 
                  : 'bg-dark-input text-dark-text border-dark-hover hover:border-dark-muted'
               }
             `}
           >
             {isRecording ? 'Press Keys...' : (currentValue || 'No Keybind')}
           </button>
           
           {currentValue && (
               <button 
                 onClick={() => onChange('')}
                 className="p-2 text-dark-muted hover:text-red-400 transition-colors"
                 title="Clear Keybind"
               >
                   <MdClose size={20} />
               </button>
           )}
       </div>
    </div>
  );
};
