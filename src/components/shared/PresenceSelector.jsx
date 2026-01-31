import { useState, useRef, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { cn } from '../../utils/helpers';
import { getPresenceConfig, PRESENCE_STATUSES } from '../../utils/statusData';

const PRESENCE_OPTIONS = [
  { key: 'online', label: 'Online', color: 'bg-green-500', description: 'You are visible' },
  { key: 'idle', label: 'Idle', color: 'bg-yellow-500', description: 'Away from keyboard' },
  { key: 'dnd', label: 'Do Not Disturb', color: 'bg-red-500', description: 'Notifications muted' },
  { key: 'invisible', label: 'Invisible', color: 'bg-gray-500', description: 'Appear offline' },
];

export const PresenceSelector = ({ currentPresence, userId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const dropdownRef = useRef(null);

  const presence = currentPresence || 'online';
  const config = getPresenceConfig(presence);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handlePresenceChange = async (newPresence) => {
    if (!userId || updating) return;
    
    setUpdating(true);
    try {
      await updateDoc(doc(db, 'users', userId), {
        presence: newPresence
      });
      setIsOpen(false);
    } catch (err) {
      console.error('Error updating presence:', err);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Current Presence Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2 py-1 rounded hover:bg-dark-hover transition-colors"
        title="Change presence"
      >
        <span className={cn('w-3 h-3 rounded-full', config.color)} />
        <span className="text-xs text-dark-muted">{config.label}</span>
        <svg 
          className={cn('w-3 h-3 text-dark-muted transition-transform', isOpen && 'rotate-180')} 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute bottom-full left-0 mb-2 w-52 bg-dark-sidebar border border-dark-hover rounded-lg shadow-lg py-1 z-50">
          <div className="px-3 py-1.5 text-xs text-dark-muted uppercase tracking-wide border-b border-dark-hover">
            Set Presence
          </div>
          
          {PRESENCE_OPTIONS.map((s) => (
            <button
              key={s.key}
              onClick={() => handlePresenceChange(s.key)}
              disabled={updating}
              className={cn(
                'w-full px-3 py-2 flex items-center gap-2 hover:bg-dark-hover transition-colors text-left',
                presence === s.key && 'bg-dark-hover'
              )}
            >
              <span className={cn('w-2.5 h-2.5 rounded-full', s.color)} />
              <div className="flex-1">
                <div className="text-sm text-dark-text">{s.label}</div>
                <div className="text-xs text-dark-muted">{s.description}</div>
              </div>
              {presence === s.key && (
                <svg className="w-4 h-4 text-brand-primary" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
