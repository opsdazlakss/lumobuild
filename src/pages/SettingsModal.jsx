import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Button } from '../components/shared/Button';
import { Input } from '../components/shared/Input';
import { StatusSelector } from '../components/shared/StatusSelector';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { MdPerson, MdSecurity, MdCircle, MdClose } from 'react-icons/md';

// Settings categories
const SETTINGS_TABS = [
  { id: 'account', label: 'My Account', icon: MdPerson, category: 'User Settings' },
  { id: 'status', label: 'Status', icon: MdCircle, category: 'User Settings' },
  { id: 'security', label: 'Privacy & Security', icon: MdSecurity, category: 'User Settings' },
];

export const SettingsModal = ({ isOpen, onClose }) => {
  const { currentUser, userProfile } = useAuth();
  const { success, error } = useToast();
  const [activeTab, setActiveTab] = useState('account');
  const [photoUrl, setPhotoUrl] = useState(userProfile?.photoUrl || '');
  const [bio, setBio] = useState(userProfile?.bio || '');
  const [updating, setUpdating] = useState(false);
  const [showStatusSelector, setShowStatusSelector] = useState(false);
  
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [changingPassword, setChangingPassword] = useState(false);

  // Reset form when profile changes
  useEffect(() => {
    setPhotoUrl(userProfile?.photoUrl || '');
    setBio(userProfile?.bio || '');
  }, [userProfile]);

  // Handle ESC key to close
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const handleUpdatePhoto = async () => {
    if (!currentUser) return;
    
    setUpdating(true);
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        photoUrl: photoUrl.trim(),
      });
      success('Profile photo updated successfully');
    } catch (err) {
      console.error('Error updating photo:', err);
      error('Failed to update profile photo');
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdateBio = async () => {
    if (!currentUser) return;
    
    setUpdating(true);
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        bio: bio.trim(),
      });
      success('Bio updated successfully');
    } catch (err) {
      console.error('Error updating bio:', err);
      error('Failed to update bio');
    } finally {
      setUpdating(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentUser || !currentUser.email) return;

    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      error('Please fill in all password fields');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      error('New password must be at least 6 characters');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      error('New passwords do not match');
      return;
    }

    setChangingPassword(true);
    try {
      const credential = EmailAuthProvider.credential(
        currentUser.email,
        passwordData.currentPassword
      );
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, passwordData.newPassword);
      
      success('Password changed successfully');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      console.error('Error changing password:', err);
      if (err.code === 'auth/wrong-password') {
        error('Current password is incorrect');
      } else if (err.code === 'auth/weak-password') {
        error('New password is too weak');
      } else {
        error('Failed to change password');
      }
    } finally {
      setChangingPassword(false);
    }
  };

  const handleStatusChange = async (status) => {
    if (!currentUser) return;

    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        status: status
      });
      success(status ? 'Status updated' : 'Status cleared');
    } catch (err) {
      console.error('Error updating status:', err);
      error('Failed to update status');
    }
  };

  const handlePresenceChange = async (presence) => {
    if (!currentUser) return;
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), { presence });
      success(`Status set to ${presence}`);
    } catch (err) {
      error('Failed to update status');
    }
  };

  if (!isOpen) return null;

  // Group tabs by category
  const groupedTabs = SETTINGS_TABS.reduce((acc, tab) => {
    if (!acc[tab.category]) acc[tab.category] = [];
    acc[tab.category].push(tab);
    return acc;
  }, {});

  const renderTabContent = () => {
    switch (activeTab) {
      case 'account':
        return (
          <div className="space-y-8">
            <h1 className="text-2xl font-bold text-dark-text">My Account</h1>
            
            {/* Profile Card */}
            <div className="bg-dark-bg rounded-lg overflow-hidden">
              {/* Banner */}
              <div className="h-24 bg-gradient-to-r from-brand-primary to-purple-600" />
              
              {/* Profile Info */}
              <div className="p-4 relative">
                <div className="flex items-end gap-4 -mt-12">
                  {/* Avatar */}
                  <div className="relative">
                    {photoUrl ? (
                      <img 
                        src={photoUrl} 
                        alt="Profile"
                        className="w-20 h-20 rounded-full object-cover border-4 border-dark-bg"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div 
                      className="w-20 h-20 rounded-full bg-brand-primary flex items-center justify-center text-white font-bold text-2xl border-4 border-dark-bg"
                      style={{ display: photoUrl ? 'none' : 'flex' }}
                    >
                      {userProfile?.displayName?.[0]?.toUpperCase() || 'U'}
                    </div>
                  </div>
                  
                  <div className="flex-1 pb-2">
                    <h2 className="text-xl font-bold text-dark-text">{userProfile?.displayName}</h2>
                    <p className="text-dark-muted text-sm">{currentUser?.email}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Profile Photo */}
            <div className="bg-dark-bg rounded-lg p-4">
              <h3 className="text-sm font-semibold text-dark-muted uppercase tracking-wide mb-4">Profile Photo</h3>
              <Input
                placeholder="https://example.com/photo.jpg"
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
              />
              <Button
                variant="primary"
                className="mt-3"
                onClick={handleUpdatePhoto}
                disabled={updating || photoUrl === userProfile?.photoUrl}
              >
                {updating ? 'Updating...' : 'Update Photo'}
              </Button>
            </div>

            {/* Bio */}
            <div className="bg-dark-bg rounded-lg p-4">
              <h3 className="text-sm font-semibold text-dark-muted uppercase tracking-wide mb-4">About Me</h3>
              <textarea
                placeholder="Tell others about yourself..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={190}
                rows={4}
                className="w-full bg-dark-input text-dark-text px-4 py-3 rounded-lg
                           border border-transparent focus:border-brand-primary
                           outline-none transition-colors duration-200
                           placeholder:text-dark-muted resize-none"
              />
              <div className="flex justify-between items-center mt-2">
                <span className="text-xs text-dark-muted">{bio.length}/190</span>
                <Button
                  variant="primary"
                  onClick={handleUpdateBio}
                  disabled={updating || bio === userProfile?.bio}
                >
                  {updating ? 'Updating...' : 'Save'}
                </Button>
              </div>
            </div>

            {/* Account Info */}
            <div className="bg-dark-bg rounded-lg p-4">
              <h3 className="text-sm font-semibold text-dark-muted uppercase tracking-wide mb-4">Account Info</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-dark-hover">
                  <div>
                    <div className="text-xs text-dark-muted uppercase">Display Name</div>
                    <div className="text-dark-text font-medium">{userProfile?.displayName}</div>
                  </div>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-dark-hover">
                  <div>
                    <div className="text-xs text-dark-muted uppercase">Email</div>
                    <div className="text-dark-text font-medium">{currentUser?.email}</div>
                  </div>
                </div>
                <div className="flex justify-between items-center py-2">
                  <div>
                    <div className="text-xs text-dark-muted uppercase">Role</div>
                    <div className="text-dark-text font-medium capitalize">{userProfile?.role || 'member'}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'status':
        return (
          <div className="space-y-8">
            <h1 className="text-2xl font-bold text-dark-text">Status</h1>
            
            {/* Online Status */}
            <div className="bg-dark-bg rounded-lg p-4">
              <h3 className="text-sm font-semibold text-dark-muted uppercase tracking-wide mb-4">Online Status</h3>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { key: 'online', label: 'Online', color: 'bg-green-500', desc: 'Visible to others' },
                  { key: 'idle', label: 'Idle', color: 'bg-yellow-500', desc: 'Away from keyboard' },
                  { key: 'dnd', label: 'Do Not Disturb', color: 'bg-red-500', desc: 'Mute notifications' },
                  { key: 'invisible', label: 'Invisible', color: 'bg-gray-500', desc: 'Appear offline to others' },
                ].map((status) => (
                  <button
                    key={status.key}
                    onClick={() => handlePresenceChange(status.key)}
                    className={`p-4 rounded-lg border transition-all text-left flex items-center gap-4 ${
                      userProfile?.presence === status.key || (!userProfile?.presence && status.key === 'online')
                        ? 'border-brand-primary bg-brand-primary/10'
                        : 'border-dark-hover hover:border-dark-muted bg-dark-sidebar'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded-full ${status.color}`} />
                    <div>
                      <div className="text-sm font-medium text-dark-text">{status.label}</div>
                      <div className="text-xs text-dark-muted">{status.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Status */}
            <div className="bg-dark-bg rounded-lg p-4">
              <h3 className="text-sm font-semibold text-dark-muted uppercase tracking-wide mb-4">Custom Status</h3>
              {userProfile?.status ? (
                <div className="flex items-center justify-between p-3 bg-dark-sidebar rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{userProfile.status.emoji}</span>
                    <span className="text-dark-text">{userProfile.status.text}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => setShowStatusSelector(true)}>
                      Edit
                    </Button>
                    <Button variant="danger" onClick={() => handleStatusChange(null)}>
                      Clear
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-dark-muted mb-4">No custom status set</p>
                  <Button variant="primary" onClick={() => setShowStatusSelector(true)}>
                    Set a Status
                  </Button>
                </div>
              )}
            </div>
          </div>
        );

      case 'security':
        return (
          <div className="space-y-8">
            <h1 className="text-2xl font-bold text-dark-text">Privacy & Security</h1>
            
            {/* Change Password */}
            <div className="bg-dark-bg rounded-lg p-4">
              <h3 className="text-sm font-semibold text-dark-muted uppercase tracking-wide mb-4">Change Password</h3>
              <div className="space-y-4 max-w-md">
                <Input
                  label="Current Password"
                  type="password"
                  placeholder="Enter current password"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                />
                <Input
                  label="New Password"
                  type="password"
                  placeholder="Enter new password (min 6 characters)"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                />
                <Input
                  label="Confirm New Password"
                  type="password"
                  placeholder="Confirm new password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                />
                <Button
                  variant="primary"
                  onClick={handleChangePassword}
                  disabled={changingPassword || !passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword}
                >
                  {changingPassword ? 'Changing Password...' : 'Change Password'}
                </Button>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex">
      {/* Left Sidebar */}
      <div className="w-56 bg-dark-sidebar flex flex-col">
        <div className="flex-1 overflow-y-auto py-4 px-2">
          {Object.entries(groupedTabs).map(([category, tabs]) => (
            <div key={category} className="mb-4">
              <div className="px-3 py-2 text-xs font-semibold text-dark-muted uppercase tracking-wide">
                {category}
              </div>
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors ${
                      activeTab === tab.id
                        ? 'bg-dark-hover text-dark-text'
                        : 'text-dark-muted hover:text-dark-text hover:bg-dark-hover/50'
                    }`}
                  >
                    <Icon size={18} />
                    <span className="text-sm">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col bg-dark-bg overflow-hidden">
        {/* Header with close */}
        <div className="flex justify-end p-4">
          <button
            onClick={onClose}
            className="p-2 hover:bg-dark-hover rounded-full transition-colors group"
            title="Close"
          >
            <MdClose size={24} className="text-dark-muted group-hover:text-dark-text" />
          </button>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto px-10 pb-10">
          <div className="max-w-2xl">
            {renderTabContent()}
          </div>
        </div>
      </div>

      {/* Status Selector Modal */}
      {showStatusSelector && (
        <StatusSelector
          currentStatus={userProfile?.status}
          onStatusChange={handleStatusChange}
          onClose={() => setShowStatusSelector(false)}
        />
      )}
    </div>
  );
};
