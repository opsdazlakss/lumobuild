import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Button } from '../components/shared/Button';

import { Input } from '../components/shared/Input';
import { StatusSelector } from '../components/shared/StatusSelector';
import { doc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../services/firebase';
import { uploadToImgBB } from '../services/imgbb';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { MdPerson, MdSecurity, MdCircle, MdClose, MdInfo, MdUpload, MdImage, MdRocketLaunch, MdPalette } from 'react-icons/md';
import { PremiumSettings } from '../components/settings/PremiumSettings';
import { isPremiumUser } from '../utils/permissions';
import { useHotkeys } from '../context/HotkeyContext';
import { KeybindRecorder } from '../components/settings/KeybindRecorder';

import { MdKeyboard } from 'react-icons/md';
import { SSODebugTool } from '../components/settings/SSODebugTool';

// Settings categories
const SETTINGS_TABS = [
  { id: 'premium', label: 'Premium', icon: MdRocketLaunch, category: 'User Settings' },
  { id: 'account', label: 'My Account', icon: MdPerson, category: 'User Settings' },
  { id: 'keybinds', label: 'Keybinds', icon: MdKeyboard, category: 'App Settings' },
  { id: 'security', label: 'Privacy & Security', icon: MdSecurity, category: 'User Settings' },
  { id: 'about', label: 'About', icon: MdInfo, category: 'App Settings' },
  { id: 'debug', label: '🧪 Debug', icon: MdInfo, category: 'Developer' },
];

export const SettingsModal = ({ isOpen, onClose }) => {
  const { currentUser, userProfile } = useAuth();
  const { success, error, info } = useToast();
  const [activeTab, setActiveTab] = useState('account');
  const [photoUrl, setPhotoUrl] = useState(userProfile?.photoUrl || '');
  const [bannerUrl, setBannerUrl] = useState(userProfile?.bannerUrl || '');
  const [themeColor, setThemeColor] = useState(userProfile?.themeColor || '#6366f1'); // Default indigo
  const [bio, setBio] = useState(userProfile?.bio || '');
  const [updating, setUpdating] = useState(false);
  
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoProgress, setPhotoProgress] = useState({ progress: 0, speed: '' });
  
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [bannerProgress, setBannerProgress] = useState({ progress: 0, speed: '' });

  const profilePhotoInputRef = useRef(null);
  const bannerInputRef = useRef(null);
  const [showStatusSelector, setShowStatusSelector] = useState(false);
  
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [changingPassword, setChangingPassword] = useState(false);

  const { hotkeys, updateHotkey, resetToDefaults } = useHotkeys();

  // Use centralized premium check
  const isPremium = isPremiumUser(userProfile);

  // Reset form when profile changes
  useEffect(() => {
    setPhotoUrl(userProfile?.photoUrl || '');
    setBannerUrl(userProfile?.bannerUrl || '');
    setThemeColor(userProfile?.themeColor || '#6366f1');
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

  // --- Display Name Logic ---
  const [displayName, setDisplayName] = useState(userProfile?.displayName || '');
  const [isEditingName, setIsEditingName] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const [checkingName, setCheckingName] = useState(false);

  // Initialize display name from profile
  useEffect(() => {
    if (userProfile?.displayName) {
      setDisplayName(userProfile.displayName);
    }
  }, [userProfile]);

  // Validate and Check Uniqueness
  useEffect(() => {
    // Only check if we are editing and value changed from current
    if (!isEditingName || displayName === userProfile?.displayName) {
      setUsernameError('');
      return;
    }

    const checkUsername = async () => {
      if (!displayName) {
        setUsernameError('');
        return;
      }

      if (displayName.length < 3) {
        setUsernameError('Username must be at least 3 characters');
        return;
      }

      if (!/^[a-zA-Z0-9-_]+$/.test(displayName)) {
        setUsernameError('Only letters, numbers, hyphens (-) and underscores (_) allowed');
        return;
      }

      setCheckingName(true);
      try {
        // Fetch all users to check for duplicates (same logic as RegisterPage)
        // Note: For production with many users, this should be a backend function or simpler query if possible.
        // But we are sticking to existing patterns.
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('displayName', '==', displayName)); 
        // Note: Firestore is case-sensitive by default for queries unless we handle it.
        // RegisterPage loads ALL and checks locally lowercase. Let's do a more direct query AND local check if needed?
        // Actually, let's stick to the RegisterPage pattern of checking against all for lowercase match to ensure true uniqueness.
        // BUT fetching all users every keystroke is bad.
        // Let's rely on a direct query for exact match first, or just fetch all once like RegisterPage?
        // Fetching all once on Edit start is safer for client-side uniqueness like RegisterPage does.
        
        const usersSnapshot = await getDocs(usersRef);
        let taken = false;
        const targetName = displayName.toLowerCase();
        
        usersSnapshot.forEach((doc) => {
          // Don't check against self
          if (doc.id === currentUser.uid) return;
          
          const name = doc.data().displayName;
          if (name && name.toLowerCase() === targetName) {
            taken = true;
          }
        });

        if (taken) {
          setUsernameError('This username is already taken');
        } else {
          setUsernameError('');
        }
      } catch (err) {
        console.error('Error checking username:', err);
      } finally {
        setCheckingName(false);
      }
    };

    const timer = setTimeout(checkUsername, 500); // Debounce
    return () => clearTimeout(timer);
  }, [displayName, isEditingName, userProfile, currentUser]);

  const handleUpdateDisplayName = async () => {
    if (!currentUser || usernameError || checkingName) return;
    if (displayName === userProfile?.displayName) {
      setIsEditingName(false);
      return;
    }

    setUpdating(true);
    try {
        import('firebase/auth').then(async ({ updateProfile }) => {
            await updateProfile(currentUser, {
                displayName: displayName
            });
        });

        await updateDoc(doc(db, 'users', currentUser.uid), {
            displayName: displayName
        });
        
        success('Username updated successfully');
        setIsEditingName(false);
    } catch (err) {
        console.error('Error updating username:', err);
        error('Failed to update username');
    } finally {
        setUpdating(false);
    }
  };
  // -------------------------

  const handlePhotoFileUpload = async (file) => {
    if (!file || !currentUser) return;

    if (!file.type.startsWith('image/')) {
      error('Please select an image file');
      return;
    }

    // GIF Avatar Restriction
    if (file.type === 'image/gif' && !isPremium) {
      error('Animated GIF avatars are for Premium members only!');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      error('Image size must be less than 10MB');
      return;
    }

    setUploadingPhoto(true);
    try {
      const imageUrl = await uploadToImgBB(file, (progress, speed) => {
        setPhotoProgress({ progress, speed });
      });

      await updateDoc(doc(db, 'users', currentUser.uid), {
        photoUrl: imageUrl,
      });

      setPhotoUrl(imageUrl);
      success('Profile photo updated successfully!');
    } catch (err) {
      console.error('Error uploading photo:', err);
      error('Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
      setPhotoProgress({ progress: 0, speed: '' });
      if (profilePhotoInputRef.current) profilePhotoInputRef.current.value = '';
    }
  };

  const handleBannerFileUpload = async (file) => {
    if (!file || !currentUser) return;

    if (!isPremium) {
      info('Custom banners are a Premium feature. Upgrade to unlock!');
      return;
    }

    if (!file.type.startsWith('image/')) {
      error('Please select an image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      error('Image size must be less than 10MB');
      return;
    }

    setUploadingBanner(true);
    try {
      const imageUrl = await uploadToImgBB(file, (progress, speed) => {
        setBannerProgress({ progress, speed });
      });

      await updateDoc(doc(db, 'users', currentUser.uid), {
        bannerUrl: imageUrl,
      });

      setBannerUrl(imageUrl);
      success('Banner updated successfully!');
    } catch (err) {
      console.error('Error uploading banner:', err);
      error('Failed to upload banner');
    } finally {
      setUploadingBanner(false);
      setBannerProgress({ progress: 0, speed: '' });
      if (bannerInputRef.current) bannerInputRef.current.value = '';
    }
  };

  const handleThemeColorChange = async (e) => {
    const newColor = e.target.value;
    setThemeColor(newColor);
    
    // We don't save immediately to avoid too many writes, 
    // user should click a "Save" button or we debounce.
    // For simplicity in this modal UI, let's add a "Save Appearance" button or save on blur.
    // Actually, let's just save it.
  };

  const saveAppearance = async () => {
    if (!currentUser) return;
    if (!isPremium) {
      info('Custom themes are a Premium feature!');
      setThemeColor(userProfile?.themeColor || '#6366f1'); // Revert
      return;
    }

    setUpdating(true);
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        themeColor: themeColor,
      });
      success('Appearance updated!');
    } catch (err) {
      console.error('Error updating appearance:', err);
      error('Failed to update appearance');
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

  // Group tabs by category (filter Debug for non-admins)
  const isAdmin = userProfile?.role === 'admin';
  const availableTabs = SETTINGS_TABS.filter(tab => {
    if (tab.id === 'debug') return isAdmin;
    return true;
  });
  
  const groupedTabs = availableTabs.reduce((acc, tab) => {
    if (!acc[tab.category]) acc[tab.category] = [];
    acc[tab.category].push(tab);
    return acc;
  }, {});

  const renderTabContent = () => {
    switch (activeTab) {
      case 'premium':
        return <PremiumSettings />;
      case 'account':
        return (
          <div className="space-y-8">
            <h1 className="text-2xl font-bold text-dark-text">My Account</h1>
            
            {/* Profile Card Preview */}
            <div className="rounded-lg overflow-hidden border border-dark-hover relative min-h-[300px]" style={{ borderColor: themeColor }}>
              {/* Full Background Image/Color */}
              <div 
                className="absolute inset-0 bg-cover bg-center transition-colors"
                style={{ 
                  backgroundColor: themeColor,
                  backgroundImage: bannerUrl ? `url(${bannerUrl})` : `linear-gradient(to bottom right, ${themeColor}, #000)` 
                }}
              />
              
              {/* Dark Gradient Overlay for Readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

              {/* Premium GIF Badge */}
              {bannerUrl?.endsWith('.gif') && (
                  <div className="absolute top-2 right-2 px-2 py-1 bg-black/50 text-white text-[10px] rounded backdrop-blur-sm font-bold z-10">
                    GIF
                  </div>
              )}
              
              {/* Profile Info Content */}
              <div className="relative z-10 p-6 flex flex-col items-center justify-end h-full min-h-[300px] text-center mt-auto">
                  {/* Avatar centered */}
                  <div className="relative group mb-4">
                    {photoUrl ? (
                      <img 
                        key={photoUrl}
                        src={photoUrl} 
                        alt="Profile"
                        className="w-28 h-28 rounded-full object-cover border-4"
                        style={{ borderColor: themeColor }}
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div 
                      className="w-28 h-28 rounded-full flex items-center justify-center text-white font-bold text-4xl border-4"
                      style={{ 
                        display: photoUrl ? 'none' : 'flex', 
                        backgroundColor: themeColor, 
                        borderColor: themeColor 
                      }}
                    >
                      {userProfile?.displayName?.[0]?.toUpperCase() || 'U'}
                    </div>
                    
                    {/* Edit Overlay */}
                    <div 
                      className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer border-4 border-transparent"
                      onClick={() => profilePhotoInputRef.current?.click()}
                    >
                      <MdImage className="text-white" size={32} />
                    </div>
                  </div>
                  
                  {/* User Details */}
                  <div className="space-y-1">
                    <h2 className="text-2xl font-bold text-white flex items-center justify-center gap-2 shadow-black drop-shadow-md">
                      {userProfile?.displayName}
                      {isPremium && <MdRocketLaunch className="text-brand-primary" title="Premium Member" />}
                    </h2>
                    <p className="text-gray-200 text-sm font-medium shadow-black drop-shadow-md">{currentUser?.email}</p>
                    <div className="flex justify-center gap-2 mt-3">
                       <span className="text-xs px-3 py-1 rounded-full bg-black/40 backdrop-blur-md border border-white/20 text-white capitalize font-medium">
                         {userProfile?.role || 'member'}
                       </span>
                    </div>
                  </div>
              </div>
            </div>

            {/* Profile Photo Upload */}
            <div className="bg-dark-bg rounded-lg p-4">
              <h3 className="text-sm font-semibold text-dark-muted uppercase tracking-wide mb-4">Profile Photo</h3>
              
              <input
                type="file"
                ref={profilePhotoInputRef}
                onChange={(e) => handlePhotoFileUpload(e.target.files?.[0])}
                accept="image/*"
                className="hidden"
              />
              
              <div className="flex gap-3 mb-4">
                <button
                  onClick={() => profilePhotoInputRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-dark-sidebar hover:bg-dark-hover border border-dark-hover text-dark-text rounded-lg transition-colors disabled:opacity-50"
                  disabled={uploadingPhoto}
                >
                  {uploadingPhoto ? (
                     <span className="text-sm">Uploading {Math.round(photoProgress.progress)}%...</span>
                  ) : (
                    <>
                      <MdUpload size={20} />
                      Upload New Photo
                    </>
                  )}
                </button>
              </div>
              

            </div>

            {/* Profile Appearance (Premium) */}
            <div className={`rounded-lg p-4 relative ${isPremium ? 'bg-dark-bg' : 'bg-dark-bg/50'}`}>
               {!isPremium && (
                 <div className="absolute inset-0 z-10 bg-black/60 backdrop-blur-[1px] rounded-lg flex flex-col items-center justify-center text-center p-4">
                   <MdRocketLaunch size={32} className="text-brand-primary mb-2 animate-bounce" />
                   <h3 className="text-lg font-bold text-white mb-1">Unlock Profile Appearance</h3>
                   <p className="text-sm text-dark-muted mb-4 max-w-xs">Customize your banner, theme colors, and use animated GIFs with Premium.</p>
                   <Button variant="primary" onClick={() => setActiveTab('premium')}>View Premium Plans</Button>
                 </div>
               )}

               <h3 className="text-sm font-semibold text-dark-muted uppercase tracking-wide mb-6 flex items-center gap-2">
                 <MdPalette /> Profile Appearance <span className="text-xs normal-case px-2 py-0.5 bg-brand-primary/20 text-brand-primary rounded">Premium</span>
               </h3>

               {/* Banner Upload */}
               <div className="mb-6">
                 <label className="block text-sm font-medium text-dark-text mb-2">Profile Banner</label>
                 <div className="flex gap-3">
                   <input
                    type="file"
                    ref={bannerInputRef}
                    onChange={(e) => handleBannerFileUpload(e.target.files?.[0])}
                    accept="image/*"
                    className="hidden"
                   />
                   <button
                    onClick={() => bannerInputRef.current?.click()}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-8 border-2 border-dashed border-dark-hover hover:border-brand-primary rounded-lg text-dark-muted hover:text-brand-primary transition-colors disabled:opacity-50"
                    disabled={uploadingBanner}
                   >
                     {uploadingBanner ? (
                        <span>Uploading {Math.round(bannerProgress.progress)}%...</span>
                     ) : (
                       <div className="text-center">
                         <MdImage size={24} className="mx-auto mb-1" />
                         <div>Upload Banner Image</div>
                         <div className="text-xs opacity-70">JPG, PNG, GIF</div>
                       </div>
                     )}
                   </button>
                   
                   {bannerUrl && (
                     <div className="w-32 h-24 rounded-lg overflow-hidden relative group shrink-0">
                       <img src={bannerUrl} className="w-full h-full object-cover" />
                       <button 
                         onClick={() => {
                           setBannerUrl('');
                           updateDoc(doc(db, 'users', currentUser.uid), { bannerUrl: '' });
                         }}
                         className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-red-500 font-bold"
                       >
                         Remove
                       </button>
                     </div>
                   )}
                 </div>
               </div>

               {/* Theme Color Picker */}
               <div className="mb-6">
                 <label className="block text-sm font-medium text-dark-text mb-2">Theme Color</label>
                 <div className="flex gap-4 items-center">
                    <input 
                      type="color" 
                      value={themeColor}
                      onChange={handleThemeColorChange}
                      className="w-16 h-16 rounded-lg cursor-pointer bg-transparent border-0 p-0"
                    />
                    <div>
                      <div className="text-dark-text font-mono bg-dark-input px-3 py-1 rounded border border-dark-hover">
                        {themeColor}
                      </div>
                      <div className="text-xs text-dark-muted mt-1">
                        Select a color to accent your profile.
                      </div>
                    </div>
                    <div className="flex-1 text-right">
                       <Button onClick={saveAppearance} disabled={themeColor === userProfile?.themeColor}>
                         Save Color
                       </Button>
                    </div>
                 </div>
               </div>
            </div>

            {/* Status Settings (Moved from separate tab) */}
            <div className="bg-dark-bg rounded-lg p-4">
              <h3 className="text-sm font-semibold text-dark-muted uppercase tracking-wide mb-4">Online Status</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {[
                  { key: 'online', label: 'Online', color: 'bg-green-500', desc: 'Visible' },
                  { key: 'idle', label: 'Idle', color: 'bg-yellow-500', desc: 'Away' },
                  { key: 'dnd', label: 'Do Not Disturb', color: 'bg-red-500', desc: 'No notifications' },
                  { key: 'invisible', label: 'Invisible', color: 'bg-gray-500', desc: 'Hidden' },
                ].map((status) => (
                  <button
                    key={status.key}
                    onClick={() => handlePresenceChange(status.key)}
                    className={`p-3 rounded-lg border transition-all text-left flex items-center gap-3 ${
                      userProfile?.presence === status.key || (!userProfile?.presence && status.key === 'online')
                        ? 'border-brand-primary bg-brand-primary/10'
                        : 'border-dark-hover hover:border-dark-muted bg-dark-sidebar'
                    }`}
                  >
                    <span className={`w-3 h-3 rounded-full ${status.color}`} />
                    <div>
                      <div className="text-sm font-medium text-dark-text">{status.label}</div>
                      <div className="text-[10px] text-dark-muted">{status.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Status */}
            <div className={`bg-dark-bg rounded-lg p-4`}>
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
                 <div className="text-center py-4 border border-dashed border-dark-hover rounded-lg">
                   <p className="text-dark-muted text-sm mb-3">No custom status set</p>
                   <Button variant="primary" size="sm" onClick={() => setShowStatusSelector(true)}>
                     Set a Status
                   </Button>
                 </div>
               )}
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
                  <div className="w-full">
                    <div className="text-xs text-dark-muted uppercase mb-1">Display Name</div>
                    
                    {isEditingName ? (
                        <div className="flex items-start gap-2">
                             <div className="flex-1">
                                <Input
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    placeholder="Enter new username"
                                    className={usernameError ? '!border-red-500' : checkingName ? '!border-yellow-500' : '!border-green-500'}
                                />
                                {usernameError && (
                                    <p className="text-xs text-red-500 mt-1">{usernameError}</p>
                                )}
                                {!usernameError && displayName && displayName !== userProfile?.displayName && !checkingName && (
                                    <p className="text-xs text-green-500 mt-1">✓ Username available</p>
                                )}
                                {checkingName && (
                                    <p className="text-xs text-yellow-500 mt-1">Checking availability...</p>
                                )}
                             </div>
                             <div className="flex gap-1 mt-1">
                                 <Button 
                                    size="sm" 
                                    variant="primary" 
                                    onClick={handleUpdateDisplayName}
                                    disabled={!!usernameError || checkingName || !displayName || updating}
                                 >
                                    Save
                                 </Button>
                                 <Button 
                                    size="sm" 
                                    variant="secondary" 
                                    onClick={() => {
                                        setIsEditingName(false);
                                        setDisplayName(userProfile?.displayName || '');
                                        setUsernameError('');
                                    }}
                                 >
                                    Cancel
                                 </Button>
                             </div>
                        </div>
                    ) : (
                        <div className="flex justify-between items-center group">
                            <div className="text-dark-text font-medium text-lg">
                                {userProfile?.displayName}
                            </div>
                            <Button
                                size="sm" 
                                variant="secondary" 
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => setIsEditingName(true)}
                            >
                                Edit
                            </Button>
                        </div>
                    )}
                  </div>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-dark-hover">
                  <div>
                    <div className="text-xs text-dark-muted uppercase">Email</div>
                    <div className="text-dark-text font-medium">{currentUser?.email}</div>
                  </div>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-dark-hover">
                   <div>
                     <div className="text-dark-text font-medium">Desktop Notifications</div>
                     <div className="text-xs text-dark-muted">Show popup notifications on desktop</div>
                   </div>
                   <label className="relative inline-flex items-center cursor-pointer">
                     <input 
                       type="checkbox" 
                       className="sr-only peer"
                       checked={userProfile?.settings?.notificationsEnabled !== false}
                       onChange={async (e) => {
                          const enabled = e.target.checked;
                          try {
                             // Using a 'settings' map to keep root clean
                             await updateDoc(doc(db, 'users', currentUser.uid), {
                                "settings.notificationsEnabled": enabled
                             });
                          } catch (err) {
                             console.error("Failed to update notification settings", err);
                          }
                       }}
                     />
                     <div className="w-11 h-6 bg-dark-input peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-primary"></div>
                   </label>
                </div>

                <div className="flex justify-between items-center py-2 border-b border-dark-hover">
                  <div>
                    <div className="text-xs text-dark-muted uppercase">Role</div>
                    <div className="text-dark-text font-medium capitalize">{userProfile?.role}</div>
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

      case 'keybinds':
        return (
          <div className="space-y-8">
             <div className="flex items-center justify-between">
                 <h1 className="text-2xl font-bold text-dark-text">Keybinds</h1>
                 <Button variant="secondary" size="sm" onClick={resetToDefaults}>
                     Reset Defaults
                 </Button>
             </div>
             
             <div className="bg-dark-bg rounded-lg p-4 space-y-4">
                 <h3 className="text-sm font-semibold text-dark-muted uppercase tracking-wide mb-2">Voice & Video</h3>
                 
                 <KeybindRecorder 
                    label="Toggle Mute" 
                    currentValue={hotkeys.toggleMute}
                    onChange={(val) => updateHotkey('toggleMute', val)}
                 />
                 
                 <KeybindRecorder 
                    label="Toggle Deafen" 
                    currentValue={hotkeys.toggleDeafen}
                    onChange={(val) => updateHotkey('toggleDeafen', val)}
                 />

                 <p className="text-xs text-dark-muted mt-4">
                     Keybinds are active while the application window is focused.
                 </p>
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

      case 'about':
        return (
          <div className="space-y-8">
            <h1 className="text-2xl font-bold text-dark-text">About</h1>
            
            {/* App Info */}
            <div className="bg-dark-bg rounded-lg p-6">
              <h2 className="text-xl font-bold text-dark-text mb-2">Lumo Chat</h2>
              <div className="space-y-4 text-dark-muted text-sm">
                <p>
                  A modern real-time chat application built for seamless communication.
                </p>
                
                <div>
                  <div className="font-semibold text-dark-text">Version</div>
                  <div>{import.meta.env.PACKAGE_VERSION || '1.0.0'}</div>
                </div>

                <div>
                  <div className="font-semibold text-dark-text">Developer</div>
                  <div>Dazlakss</div>
                </div>

                <div>
                  <div className="font-semibold text-dark-text">Tech Stack</div>
                  <div>React, Firebase, TailwindCSS, Electron</div>
                </div>
              </div>
            </div>

            {/* Acknowledgments */}
            <div className="bg-dark-bg rounded-lg p-4">
              <h3 className="text-sm font-semibold text-dark-muted uppercase tracking-wide mb-4">Acknowledgments</h3>
              
              <div className="space-y-4">
                  <div className="flex items-center gap-4 p-3 bg-dark-sidebar rounded-lg border border-dark-hover">
                     <div className="flex-1">
                       <div className="text-dark-text font-medium">GIPHY</div>
                       <div className="text-xs text-dark-muted">We use GIPHY for finding and sharing GIFs.</div>
                       <a 
                         href="https://giphy.com"
                         target="_blank"
                         rel="noopener noreferrer"
                         className="mt-2 text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 block w-fit hover:opacity-80 transition-opacity"
                       >
                         Powered by GIPHY
                       </a>
                     </div>
                  </div>

                  <div className="flex items-center gap-4 p-3 bg-dark-sidebar rounded-lg border border-dark-hover">
                     <div className="flex-1">
                       <div className="text-dark-text font-medium">Cloudinary</div>
                       <div className="text-xs text-dark-muted">Robust cloud storage and delivery for images and files.</div>
                       <a 
                         href="https://cloudinary.com"
                         target="_blank"
                         rel="noopener noreferrer"
                         className="mt-2 text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-sky-400 block w-fit hover:opacity-80 transition-opacity"
                       >
                         Powered by Cloudinary
                       </a>
                     </div>
                  </div>

                  <div className="flex items-center gap-4 p-3 bg-dark-sidebar rounded-lg border border-dark-hover">
                     <div className="flex-1">
                       <div className="text-dark-text font-medium">ImgBB</div>
                       <div className="text-xs text-dark-muted">Simple and fast image hosting service.</div>
                       <a 
                         href="https://imgbb.com"
                         target="_blank"
                         rel="noopener noreferrer"
                         className="mt-2 text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-gray-200 to-gray-400 block w-fit hover:opacity-80 transition-opacity"
                       >
                         Powered by ImgBB
                       </a>
                     </div>
                  </div>
              </div>
            </div>
          </div>
        );

      case 'debug':
        return (
            <div className="space-y-6">
              <div className="bg-dark-bg rounded-lg p-6">
                 <h3 className="text-lg font-semibold text-dark-text mb-4">App Info</h3>
                 <pre className="text-xs text-dark-muted bg-dark-sidebar p-4 rounded">
                    Version: {'2.0.32'}<br/>
                    Build: {import.meta.env.MODE}<br/>
                    UA: {navigator.userAgent}
                 </pre>
              </div>

              {/* SSO Debug Tool */}
              <SSODebugTool />
            </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex flex-col md:flex-row pt-safe-top md:pt-0" role="dialog" aria-modal="true">
      {/* Sidebar - Horizontal on Mobile, Vertical on Desktop */}
      <div className="w-full md:w-56 bg-dark-sidebar flex flex-col shrink-0 border-b md:border-b-0 md:border-r border-dark-hover">
        <div className="flex md:flex-col overflow-x-auto md:overflow-y-auto py-2 md:py-4 px-2 gap-2 md:gap-0 no-scrollbar">
          {Object.entries(groupedTabs).map(([category, tabs]) => (
            <div key={category} className="mb-0 md:mb-4 flex md:block gap-2 md:gap-0 shrink-0">
              <div className="hidden md:block px-3 py-2 text-xs font-semibold text-dark-muted uppercase tracking-wide">
                {category}
              </div>
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`whitespace-nowrap flex items-center gap-2 md:gap-3 px-3 py-2 rounded-md text-left transition-colors ${
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
      <div className="flex-1 flex flex-col bg-dark-bg overflow-hidden min-w-0">
        {/* Header with close */}
        <div className="flex justify-end p-4 shrink-0">
          <button
            onClick={onClose}
            className="p-2 hover:bg-dark-hover rounded-full transition-colors group"
            title="Close"
          >
            <MdClose size={24} className="text-dark-muted group-hover:text-dark-text" />
          </button>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 md:px-10 pb-10">
          <div className={activeTab === 'premium' ? "w-full" : "max-w-2xl mx-auto md:mx-0"}>
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

export default SettingsModal;
