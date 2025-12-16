import { MdClose, MdMic, MdVideocam, MdSpeaker } from 'react-icons/md';
import { useCall } from '../../context/CallContext';
import { Button } from '../shared/Button';

export const DeviceSettingsModal = ({ isOpen, onClose }) => {
  const { 
    availableDevices, 
    selectedMicId, 
    setSelectedMicId, 
    selectedCameraId, 
    setSelectedCameraId 
  } = useCall();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center animate-fade-in">
      <div className="bg-dark-elem w-full max-w-md rounded-2xl shadow-2xl border border-dark-hover overflow-hidden p-6 relative">
        
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <MdSettings size={28} className="text-brand-primary" />
            Device Settings
          </h2>
          <button 
            onClick={onClose}
            className="p-1 hover:bg-dark-hover rounded-full transition-colors text-dark-muted hover:text-white"
          >
            <MdClose size={24} />
          </button>
        </div>

        <div className="space-y-6">
          {/* Microphone Selection */}
          <div>
            <label className="block text-xs font-bold text-dark-muted uppercase tracking-wider mb-2 flex items-center gap-2">
              <MdMic size={16} /> Microphone
            </label>
            <select 
              className="w-full bg-dark-input border border-dark-hover rounded-lg p-3 text-white focus:ring-2 focus:ring-brand-primary outline-none transition-all"
              value={selectedMicId}
              onChange={(e) => setSelectedMicId(e.target.value)}
            >
              {availableDevices.audioInputs.map(device => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Microphone ${device.deviceId.slice(0,5)}...`}
                </option>
              ))}
              {availableDevices.audioInputs.length === 0 && (
                <option value="">No microphone found</option>
              )}
            </select>
          </div>

          {/* Camera Selection */}
          <div>
            <label className="block text-xs font-bold text-dark-muted uppercase tracking-wider mb-2 flex items-center gap-2">
              <MdVideocam size={16} /> Camera
            </label>
            <select 
              className="w-full bg-dark-input border border-dark-hover rounded-lg p-3 text-white focus:ring-2 focus:ring-brand-primary outline-none transition-all"
              value={selectedCameraId}
              onChange={(e) => setSelectedCameraId(e.target.value)}
            >
              {availableDevices.videoInputs.map(device => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Camera ${device.deviceId.slice(0,5)}...`}
                </option>
              ))}
              {availableDevices.videoInputs.length === 0 && (
                <option value="">No camera found</option>
              )}
            </select>
          </div>

          {/* Speaker Selection (Purely visual/state if browser allows, mostly for logic) */}
          {/* Note: Output selection support varies by browser, usually requires setSinkId which isn't standard in React events easily without refs. Keeping simple for now. */}
          
          <div className="pt-4 border-t border-dark-hover flex justify-end">
            <Button variant="primary" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
};

import { MdSettings } from 'react-icons/md';
