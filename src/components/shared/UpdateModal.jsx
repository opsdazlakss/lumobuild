import { Modal } from './Modal';
import { Button } from './Button';
import { MdSystemUpdate, MdAndroid } from 'react-icons/md';

export const UpdateModal = ({ isOpen, onClose, version, downloadUrl, forceUpdate }) => {
  return (
    <Modal 
      isOpen={isOpen} 
      onClose={forceUpdate ? () => {} : onClose} // Disable close if forced
      title="Update Available" 
      size="sm"
    >
      <div className="flex flex-col items-center text-center space-y-4">
        <div className="w-16 h-16 bg-brand-primary/20 rounded-full flex items-center justify-center animate-bounce">
          <MdSystemUpdate size={32} className="text-brand-primary" />
        </div>
        
        <div>
          <h3 className="text-lg font-semibold text-white">New Version {version} Available!</h3>
          <p className="text-dark-muted text-sm mt-2">
            A new version of Lumo is available. Please update to get the latest features and fixes.
          </p>
        </div>

        <div className="w-full space-y-2 pt-2">
          <Button 
            variant="primary" 
            className="w-full flex items-center justify-center gap-2"
            onClick={() => {
              window.open(downloadUrl, '_system');
            }}
          >
            <MdAndroid size={20} />
            Download Update
          </Button>
          
          {!forceUpdate && (
            <Button 
              variant="secondary" 
              className="w-full"
              onClick={onClose}
            >
              Update Later
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};
