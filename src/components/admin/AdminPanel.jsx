import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { Modal } from '../shared/Modal';
import { Button } from '../shared/Button';
import { Input } from '../shared/Input';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { AdminLogsTab } from './AdminLogsTab';
import { doc, updateDoc, deleteDoc, addDoc, collection, serverTimestamp, onSnapshot, query } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { MdClose, MdEdit, MdDelete, MdAdd, MdPeople, MdTag, MdHistory, MdInfo, MdSettings } from 'react-icons/md';
import { FaHashtag } from 'react-icons/fa';
import { cn } from '../../utils/helpers';

// Admin Panel Categories
const ADMIN_TABS = [
  { id: 'users', label: 'Users', icon: MdPeople, category: 'Moderation' },
  { id: 'roles', label: 'Roles', icon: MdTag, category: 'Moderation' },
  { id: 'channels', label: 'Channels', icon: FaHashtag, category: 'Server Settings' },
  { id: 'server', label: 'Overview', icon: MdInfo, category: 'Server Settings' },
  { id: 'logs', label: 'Audit Log', icon: MdHistory, category: 'Server Settings' },
];

export const AdminPanel = ({ isOpen, onClose }) => {
  const { userProfile } = useAuth();
  const { users, channels, server, currentServer } = useData();
  const [activeTab, setActiveTab] = useState('users');
  const [editingUser, setEditingUser] = useState(null);
  const [newChannelName, setNewChannelName] = useState('');
  const [customRoles, setCustomRoles] = useState([]);
  const [editingRole, setEditingRole] = useState(null);
  const [newRole, setNewRole] = useState({ name: '', color: '#5865f2' });
  const [confirmDialog, setConfirmDialog] = useState(null);

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

  // Listen to custom roles
  useEffect(() => {
    const q = query(collection(db, 'roles'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rolesData = [];
      snapshot.forEach((doc) => {
        rolesData.push({ id: doc.id, ...doc.data() });
      });
      setCustomRoles(rolesData);
    });
    return unsubscribe;
  }, []);

  if (!isOpen) return null;
  if (userProfile?.role !== 'admin') return null;

  const handleUpdateUserRole = async (userId, newRole) => {
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
      setEditingUser(null);
    } catch (error) {
      console.error('Error updating user role:', error);
    }
  };

  const handleToggleMute = async (userId, currentMuteStatus) => {
    try {
      await updateDoc(doc(db, 'users', userId), { isMuted: !currentMuteStatus });
    } catch (error) {
      console.error('Error toggling mute:', error);
    }
  };

  const handleToggleBan = async (userId, currentBanStatus) => {
    try {
      await updateDoc(doc(db, 'users', userId), { isBanned: !currentBanStatus });
    } catch (error) {
      console.error('Error toggling ban:', error);
    }
  };

  const handleCreateChannel = async () => {
    if (!newChannelName.trim() || !currentServer) return;

    try {
      await addDoc(collection(db, 'servers', currentServer, 'channels'), {
        name: newChannelName.trim(),
        type: 'text',
        description: '',
        position: channels.length,
        createdAt: serverTimestamp(),
      });
      setNewChannelName('');
    } catch (error) {
      console.error('Error creating channel:', error);
    }
  };

  const handleDeleteChannel = async () => {
    if (!confirmDialog?.data || !currentServer) return;
    try {
      await deleteDoc(doc(db, 'servers', currentServer, 'channels', confirmDialog.data));
    } catch (error) {
      console.error('Error deleting channel:', error);
    }
  };

  const handleToggleChannelLock = async (channelId, currentLocked) => {
    if (!currentServer) return;
    try {
      await updateDoc(doc(db, 'servers', currentServer, 'channels', channelId), {
        locked: !currentLocked
      });
    } catch (error) {
      console.error('Error toggling channel lock:', error);
    }
  };

  const handleCreateRole = async () => {
    if (!newRole.name.trim()) return;

    try {
      await addDoc(collection(db, 'roles'), {
        name: newRole.name.trim(),
        color: newRole.color,
        createdAt: serverTimestamp(),
      });
      setNewRole({ name: '', color: '#5865f2' });
    } catch (error) {
      console.error('Error creating role:', error);
    }
  };

  const handleUpdateRole = async (roleId, updates) => {
    try {
      await updateDoc(doc(db, 'roles', roleId), updates);
      setEditingRole(null);
    } catch (error) {
      console.error('Error updating role:', error);
    }
  };

  const handleDeleteRole = async () => {
    if (!confirmDialog?.data) return;
    try {
      await deleteDoc(doc(db, 'roles', confirmDialog.data));
    } catch (error) {
      console.error('Error deleting role:', error);
    }
  };

  const allRoles = [
    { id: 'admin', name: 'admin', color: '#f23f42', isDefault: true },
    { id: 'moderator', name: 'moderator', color: '#faa81a', isDefault: true },
    { id: 'member', name: 'member', color: '#80848e', isDefault: true },
    ...customRoles,
  ];

  // Group tabs by category
  const groupedTabs = ADMIN_TABS.reduce((acc, tab) => {
    if (!acc[tab.category]) acc[tab.category] = [];
    acc[tab.category].push(tab);
    return acc;
  }, {});

  const renderTabContent = () => {
    switch (activeTab) {
      case 'users':
        return (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold text-dark-text">User Management</h1>
            <p className="text-dark-muted">Manage server members, assign roles, and moderate users.</p>
            
            <div className="bg-dark-bg rounded-lg p-4">
              <h3 className="text-sm font-semibold text-dark-muted uppercase tracking-wide mb-4">
                Members — {users.length}
              </h3>
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-dark-hover transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-brand-primary flex items-center justify-center text-white font-semibold">
                        {user.displayName?.[0]?.toUpperCase() || 'U'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-dark-text">{user.displayName}</span>
                          <span 
                            className="text-xs px-2 py-0.5 rounded"
                            style={{
                              backgroundColor: `${allRoles.find(r => r.name === user.role)?.color}20`,
                              color: allRoles.find(r => r.name === user.role)?.color,
                            }}
                          >
                            {user.role}
                          </span>
                          {user.isMuted && <span className="text-xs text-yellow-500">MUTED</span>}
                          {user.isBanned && <span className="text-xs text-red-500">BANNED</span>}
                        </div>
                        <div className="text-sm text-dark-muted">{user.email}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant={user.isMuted ? 'warning' : 'secondary'}
                        onClick={() => handleToggleMute(user.id, user.isMuted)}
                      >
                        {user.isMuted ? 'Unmute' : 'Mute'}
                      </Button>
                      <Button
                        size="sm"
                        variant={user.isBanned ? 'danger' : 'secondary'}
                        onClick={() => handleToggleBan(user.id, user.isBanned)}
                      >
                        {user.isBanned ? 'Unban' : 'Ban'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingUser(user)}
                      >
                        <MdEdit size={16} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'roles':
        return (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold text-dark-text">Roles</h1>
            <p className="text-dark-muted">Create and manage custom roles for your server.</p>
            
            {/* Create Role */}
            <div className="bg-dark-bg rounded-lg p-4">
              <h3 className="text-sm font-semibold text-dark-muted uppercase tracking-wide mb-4">Create New Role</h3>
              <div className="flex gap-3">
                <Input
                  placeholder="Role name"
                  value={newRole.name}
                  onChange={(e) => setNewRole({ ...newRole, name: e.target.value })}
                  className="flex-1"
                />
                <input
                  type="color"
                  value={newRole.color}
                  onChange={(e) => setNewRole({ ...newRole, color: e.target.value })}
                  className="w-12 h-10 rounded cursor-pointer border-0"
                />
                <Button onClick={handleCreateRole}>
                  <MdAdd size={20} />
                  Create
                </Button>
              </div>
            </div>

            {/* Roles List */}
            <div className="bg-dark-bg rounded-lg p-4">
              <h3 className="text-sm font-semibold text-dark-muted uppercase tracking-wide mb-4">
                Roles — {allRoles.length}
              </h3>
              <div className="space-y-2">
                {allRoles.map((role) => (
                  <div
                    key={role.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-dark-hover transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: role.color }}
                      />
                      <span className="font-medium text-dark-text">{role.name}</span>
                      {role.isDefault && (
                        <span className="text-xs px-2 py-0.5 bg-dark-hover text-dark-muted rounded">
                          Default
                        </span>
                      )}
                    </div>
                    {!role.isDefault && (
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setEditingRole(role)}>
                          <MdEdit size={16} />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="danger"
                          onClick={() => setConfirmDialog({ type: 'role', data: role.id, name: role.name })}
                        >
                          <MdDelete size={16} />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'channels':
        return (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold text-dark-text">Channels</h1>
            <p className="text-dark-muted">Create and manage server channels.</p>
            
            {/* Create Channel */}
            <div className="bg-dark-bg rounded-lg p-4">
              <h3 className="text-sm font-semibold text-dark-muted uppercase tracking-wide mb-4">Create New Channel</h3>
              <div className="flex gap-3">
                <Input
                  placeholder="Channel name"
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleCreateChannel}>
                  <MdAdd size={20} />
                  Create
                </Button>
              </div>
            </div>

            {/* Channels List */}
            <div className="bg-dark-bg rounded-lg p-4">
              <h3 className="text-sm font-semibold text-dark-muted uppercase tracking-wide mb-4">
                Text Channels — {channels.length}
              </h3>
              <div className="space-y-2">
                {channels.map((channel) => (
                  <div
                    key={channel.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-dark-hover transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <FaHashtag className="text-dark-muted" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-dark-text">{channel.name}</span>
                          {channel.locked && (
                            <span className="text-xs px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-500 flex items-center gap-1">
                              <MdSettings size={12} />
                              LOCKED
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-dark-muted">
                          {channel.locked ? 'Only admins can send messages' : 'Everyone can send messages'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant={channel.locked ? 'warning' : 'secondary'}
                        onClick={() => handleToggleChannelLock(channel.id, channel.locked)}
                      >
                        {channel.locked ? 'Unlock' : 'Lock'}
                      </Button>
                      <Button 
                        size="sm" 
                        variant="danger"
                        onClick={() => setConfirmDialog({ type: 'channel', data: channel.id, name: channel.name })}
                      >
                        <MdDelete size={16} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'server':
        return (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold text-dark-text">Server Overview</h1>
            <p className="text-dark-muted">View server statistics and information.</p>
            
            <div className="bg-dark-bg rounded-lg p-6">
              <div className="mb-6">
                <div className="text-xs text-dark-muted uppercase tracking-wide mb-1">Server Name</div>
                <div className="text-2xl font-bold text-dark-text">{server?.name || 'Unknown'}</div>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-dark-sidebar p-4 rounded-lg text-center">
                  <div className="text-3xl font-bold text-brand-primary mb-1">{users.length}</div>
                  <div className="text-sm text-dark-muted">Members</div>
                </div>
                <div className="bg-dark-sidebar p-4 rounded-lg text-center">
                  <div className="text-3xl font-bold text-green-500 mb-1">{channels.length}</div>
                  <div className="text-sm text-dark-muted">Channels</div>
                </div>
                <div className="bg-dark-sidebar p-4 rounded-lg text-center">
                  <div className="text-3xl font-bold text-purple-500 mb-1">{allRoles.length}</div>
                  <div className="text-sm text-dark-muted">Roles</div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'logs':
        return (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold text-dark-text">Audit Log</h1>
            <p className="text-dark-muted">View server activity and moderation history.</p>
            <AdminLogsTab />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex">
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
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors',
                      activeTab === tab.id
                        ? 'bg-dark-hover text-dark-text'
                        : 'text-dark-muted hover:text-dark-text hover:bg-dark-hover/50'
                    )}
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
            title="Close (ESC)"
          >
            <MdClose size={24} className="text-dark-muted group-hover:text-dark-text" />
          </button>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto px-10 pb-10">
          <div className="max-w-3xl">
            {renderTabContent()}
          </div>
        </div>
      </div>

      {/* Edit User Modal */}
      {editingUser && (
        <Modal
          isOpen={!!editingUser}
          onClose={() => setEditingUser(null)}
          title="Edit User Role"
          size="sm"
        >
          <div className="space-y-4">
            <div>
              <div className="text-sm text-dark-muted mb-1">User</div>
              <div className="font-medium text-dark-text">{editingUser.displayName}</div>
            </div>
            <div>
              <div className="text-sm text-dark-muted mb-2">Select Role</div>
              <div className="space-y-2">
                {allRoles.map((role) => (
                  <button
                    key={role.id}
                    onClick={() => handleUpdateUserRole(editingUser.id, role.name)}
                    className={cn(
                      'w-full px-3 py-2 rounded-lg border text-left transition-all flex items-center gap-3',
                      editingUser.role === role.name
                        ? 'border-brand-primary bg-brand-primary/20'
                        : 'border-dark-hover hover:bg-dark-hover'
                    )}
                  >
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: role.color }}
                    />
                    <span className="text-dark-text">{role.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Role Modal */}
      {editingRole && (
        <Modal
          isOpen={!!editingRole}
          onClose={() => setEditingRole(null)}
          title="Edit Role"
          size="sm"
        >
          <div className="space-y-4">
            <Input
              label="Role Name"
              value={editingRole.name}
              onChange={(e) => setEditingRole({ ...editingRole, name: e.target.value })}
            />
            <div>
              <label className="text-sm font-medium text-dark-text mb-2 block">Role Color</label>
              <div className="flex gap-3">
                <input
                  type="color"
                  value={editingRole.color}
                  onChange={(e) => setEditingRole({ ...editingRole, color: e.target.value })}
                  className="w-14 h-10 rounded cursor-pointer"
                />
                <Input
                  value={editingRole.color}
                  onChange={(e) => setEditingRole({ ...editingRole, color: e.target.value })}
                  className="flex-1"
                />
              </div>
            </div>
            <Button
              variant="primary"
              className="w-full"
              onClick={() => handleUpdateRole(editingRole.id, {
                name: editingRole.name,
                color: editingRole.color,
              })}
            >
              Save Changes
            </Button>
          </div>
        </Modal>
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!confirmDialog}
        onClose={() => setConfirmDialog(null)}
        onConfirm={confirmDialog?.type === 'channel' ? handleDeleteChannel : handleDeleteRole}
        title={`Delete ${confirmDialog?.type === 'channel' ? 'Channel' : 'Role'}`}
        message={`Are you sure you want to delete "${confirmDialog?.name}"? This cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
};
