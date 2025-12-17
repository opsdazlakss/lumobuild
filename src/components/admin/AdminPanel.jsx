import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { Modal } from '../shared/Modal';
import { Button } from '../shared/Button';
import { Input } from '../shared/Input';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { AdminLogsTab } from './AdminLogsTab';
import { doc, updateDoc, deleteDoc, addDoc, collection, serverTimestamp, onSnapshot, query, getDocs, where, writeBatch } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { MdClose, MdEdit, MdDelete, MdAdd, MdPeople, MdTag, MdHistory, MdInfo, MdSettings, MdCleaningServices, MdDragHandle } from 'react-icons/md';
import { FaHashtag } from 'react-icons/fa';
import { cn } from '../../utils/helpers';
import { useToast } from '../../context/ToastContext';

const ADMIN_TABS = [
  { id: 'users', label: 'Users', icon: MdPeople, category: 'Moderation' },
  { id: 'roles', label: 'Roles', icon: MdTag, category: 'Moderation' },
  { id: 'channels', label: 'Channels', icon: FaHashtag, category: 'Server Settings' },
  { id: 'server', label: 'Overview', icon: MdInfo, category: 'Server Settings' },
  { id: 'logs', label: 'Audit Log', icon: MdHistory, category: 'Server Settings' },
  { id: 'cleanup', label: 'Cleanup', icon: MdCleaningServices, category: 'Maintenance' },
];

export const AdminPanel = ({ isOpen, onClose }) => {
  const { userProfile } = useAuth();
  const { users, channels, server, currentServer } = useData();
  const [activeTab, setActiveTab] = useState('users');
  const [editingUser, setEditingUser] = useState(null);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDesc, setNewChannelDesc] = useState('');
  const [newChannelType, setNewChannelType] = useState('text');
  const [editingChannel, setEditingChannel] = useState(null);
  const [customRoles, setCustomRoles] = useState([]);
  const [editingRole, setEditingRole] = useState(null);
  const [newRole, setNewRole] = useState({ name: '', color: '#5865f2' });
  const [draggedRoleId, setDraggedRoleId] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const { success, error: showError } = useToast();
  
  // Cleanup state
  const [expiredInvitesCount, setExpiredInvitesCount] = useState(0);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [cleanupConfirm, setCleanupConfirm] = useState(null);

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
    if (!currentServer || currentServer === 'home') return;
    const q = query(collection(db, 'servers', currentServer, 'roles'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rolesData = [];
      snapshot.forEach((doc) => {
        rolesData.push({ id: doc.id, ...doc.data() });
      });
      setCustomRoles(rolesData);
    });
    return unsubscribe;
  }, [currentServer]);

  // Fetch cleanup stats when cleanup tab is active
  useEffect(() => {
    if (activeTab !== 'cleanup') return;
    
    const fetchCleanupStats = async () => {
      try {
        // Get expired/used invite codes
        const invitesSnapshot = await getDocs(collection(db, 'inviteCodes'));
        const now = new Date();
        let expiredCount = 0;
        
        invitesSnapshot.forEach((doc) => {
          const data = doc.data();
          const isExpired = data.expiresAt?.toDate() < now;
          const isUsed = !data.isActive || data.uses >= data.maxUses;
          if (isExpired || isUsed) {
            expiredCount++;
          }
        });
        setExpiredInvitesCount(expiredCount);
        
      } catch (err) {
        console.error('Error fetching cleanup stats:', err);
      }
    };
    
    fetchCleanupStats();
  }, [activeTab]);

  // Cleanup expired invite codes
  const cleanupInviteCodes = async () => {
    setCleanupLoading(true);
    try {
      const invitesSnapshot = await getDocs(collection(db, 'inviteCodes'));
      const now = new Date();
      const batch = writeBatch(db);
      let deleteCount = 0;
      
      invitesSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const isExpired = data.expiresAt?.toDate() < now;
        const isUsed = !data.isActive || data.uses >= data.maxUses;
        
        if (isExpired || isUsed) {
          batch.delete(doc(db, 'inviteCodes', docSnap.id));
          deleteCount++;
        }
      });
      
      if (deleteCount > 0) {
        await batch.commit();
        success(`${deleteCount} expired invite code(s) deleted`);
        setExpiredInvitesCount(0);
      } else {
        success('No expired invite codes to delete');
      }
    } catch (err) {
      console.error('Error cleaning invite codes:', err);
      showError('Failed to clean invite codes');
    } finally {
      setCleanupLoading(false);
      setCleanupConfirm(null);
    }
  };

  if (!isOpen) return null;
  if (userProfile?.role !== 'admin') return null;

  const handleUpdateUserRole = async (userId, newRole) => {
    try {
      // Update user's global role
      await updateDoc(doc(db, 'users', userId), { role: newRole });
      
      // Also update the server member's role for this server
      if (currentServer) {
        await updateDoc(doc(db, 'servers', currentServer, 'members', userId), { role: newRole });
      }
      
      success(`Role updated to ${newRole}`);
      setEditingUser(null);
    } catch (error) {
      console.error('Error updating user role:', error);
      showError(`Failed to update role: ${error.message}`);
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
        type: newChannelType,
        description: newChannelDesc.trim(),
        position: channels.length,
        createdAt: serverTimestamp(),
      });
      setNewChannelName('');
      setNewChannelDesc('');
      setNewChannelType('text');
    } catch (error) {
      console.error('Error creating channel:', error);
    }
  };

  const handleUpdateChannel = async (channelId, updates) => {
    try {
      await updateDoc(doc(db, 'servers', currentServer, 'channels', channelId), updates);
      setEditingChannel(null);
    } catch (error) {
      console.error('Error updating channel:', error);
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
      // Get current max position
      const maxPosition = customRoles.reduce((max, r) => Math.max(max, r.position || 0), 0);
      
      if (currentServer) {
        await addDoc(collection(db, 'servers', currentServer, 'roles'), {
        name: newRole.name.trim(),
        color: newRole.color,
        position: maxPosition + 1,
        createdAt: serverTimestamp(),
        });
    }
      setNewRole({ name: '', color: '#5865f2' });
    } catch (error) {
      console.error('Error creating role:', error);
    }
  };

  const handleUpdateRole = async (roleId, updates) => {
    if (!currentServer) return;
    try {
      await updateDoc(doc(db, 'servers', currentServer, 'roles', roleId), updates);
      setEditingRole(null);
    } catch (error) {
      console.error('Error updating role:', error);
    }
  };

    const handleDeleteRole = async () => {
    if (!confirmDialog?.data) return;
    const roleId = confirmDialog.data;
    
    try {
      // Find role name to look up users
      const roleToDelete = customRoles.find(r => r.id === roleId);
      if (!roleToDelete) return;

      const roleName = roleToDelete.name;
      const batch = writeBatch(db);

      // 1. Find users in current server who have this role
      // We use the users state which contains current server members
      const affectedUsers = users.filter(u => (u.serverRole || u.role) === roleName);

      affectedUsers.forEach(user => {
        // Update global user profile if their primary role matches
        if (user.role === roleName) {
           const userRef = doc(db, 'users', user.id);
           batch.update(userRef, { role: 'member' });
        }

        // Update server member record
        if (currentServer) {
          const memberRef = doc(db, 'servers', currentServer, 'members', user.id);
          batch.update(memberRef, { role: 'member' });
        }
      });

      // 2. Delete the role document
      if (currentServer) {
        const roleRef = doc(db, 'servers', currentServer, 'roles', roleId);
        batch.delete(roleRef);

        await batch.commit();
        success(`Role '${roleName}' deleted and ${affectedUsers.length} users reassigned to Member`);
      }
    } catch (error) {
      console.error('Error deleting role:', error);
      showError(`Failed to delete role: ${error.message}`);
    }
  };

  const allRoles = [
    { id: 'admin', name: 'admin', color: '#f23f42', isDefault: true, position: -3 },
    { id: 'moderator', name: 'moderator', color: '#faa81a', isDefault: true, position: -2 },
    { id: 'member', name: 'member', color: '#80848e', isDefault: true, position: -1 },
    ...customRoles,
  ].sort((a, b) => (a.position ?? 999) - (b.position ?? 999));

  // Drag and drop handlers for roles
  const handleRoleDragStart = (e, roleId) => {
    setDraggedRoleId(roleId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleRoleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleRoleDrop = async (e, targetRoleId) => {
    e.preventDefault();
    if (!draggedRoleId || draggedRoleId === targetRoleId) {
      setDraggedRoleId(null);
      return;
    }

    // Only allow reordering custom roles
    const draggedRole = allRoles.find(r => r.id === draggedRoleId);
    const targetRole = allRoles.find(r => r.id === targetRoleId);
    
    if (draggedRole?.isDefault || targetRole?.isDefault) {
      setDraggedRoleId(null);
      return;
    }

    // Swap positions
    try {
      const draggedPos = draggedRole.position ?? 0;
      const targetPos = targetRole.position ?? 0;
      
      if (currentServer) {
        await updateDoc(doc(db, 'servers', currentServer, 'roles', draggedRoleId), { position: targetPos });
        await updateDoc(doc(db, 'servers', currentServer, 'roles', targetRoleId), { position: draggedPos });
    }
  } catch (error) {
      console.error('Error reordering roles:', error);
    }
    
    setDraggedRoleId(null);
  };

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
                              backgroundColor: `${allRoles.find(r => r.name === (user.serverRole || user.role))?.color}20`,
                              color: allRoles.find(r => r.name === (user.serverRole || user.role))?.color,
                            }}
                          >
                            {user.serverRole || user.role}
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
            <div>
              <h1 className="text-2xl font-bold text-dark-text">Roles</h1>
              <p className="text-dark-muted mt-1">Use roles to organize your members and customize permissions.</p>
            </div>
            
            {/* Create Role Card */}
            <div className="bg-dark-bg rounded-xl p-6 border border-dark-hover">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-brand-primary/20 flex items-center justify-center">
                  <MdAdd className="text-brand-primary" size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-dark-text">Create New Role</h3>
                  <p className="text-sm text-dark-muted">Add a custom role with a unique color</p>
                </div>
              </div>
              
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-dark-muted uppercase tracking-wide mb-2">Role Name</label>
                  <Input
                    placeholder="e.g. VIP, Helper, Supporter..."
                    value={newRole.name}
                    onChange={(e) => setNewRole({ ...newRole, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-dark-muted uppercase tracking-wide mb-2">Color</label>
                  <div className="relative">
                    <input
                      type="color"
                      value={newRole.color}
                      onChange={(e) => setNewRole({ ...newRole, color: e.target.value })}
                      className="w-14 h-10 rounded-lg cursor-pointer border-2 border-dark-hover hover:border-brand-primary transition-colors"
                      style={{ backgroundColor: newRole.color }}
                    />
                  </div>
                </div>
                <Button 
                  onClick={handleCreateRole}
                  disabled={!newRole.name.trim()}
                  className="px-6"
                >
                  <MdAdd size={18} className="mr-1" />
                  Create Role
                </Button>
              </div>
            </div>

            {/* Roles List */}
            <div className="bg-dark-bg rounded-xl border border-dark-hover overflow-hidden">
              <div className="px-6 py-4 border-b border-dark-hover flex items-center justify-between">
                <h3 className="text-sm font-semibold text-dark-muted uppercase tracking-wide">
                  Roles — {allRoles.length}
                </h3>
                <span className="text-xs text-dark-muted">Drag custom roles to reorder hierarchy</span>
              </div>
              
              <div className="divide-y divide-dark-hover">
                {allRoles.map((role, index) => (
                  <div
                    key={role.id}
                    draggable={!role.isDefault}
                    onDragStart={(e) => handleRoleDragStart(e, role.id)}
                    onDragOver={handleRoleDragOver}
                    onDrop={(e) => handleRoleDrop(e, role.id)}
                    className={cn(
                      "group flex items-center justify-between px-6 py-4 transition-colors",
                      !role.isDefault && "cursor-grab active:cursor-grabbing hover:bg-dark-sidebar/50",
                      role.isDefault && "opacity-70",
                      draggedRoleId === role.id && "opacity-50 bg-brand-primary/10"
                    )}
                  >
                    <div className="flex items-center gap-4">
                      {/* Drag Handle (only for custom roles) */}
                      {!role.isDefault && (
                        <div className="text-dark-muted opacity-0 group-hover:opacity-100 transition-opacity">
                          <MdDragHandle size={20} />
                        </div>
                      )}
                      
                      {/* Role Color Indicator */}
                      <div 
                        className="w-5 h-5 rounded-full ring-2 ring-offset-2 ring-offset-dark-bg"
                        style={{ backgroundColor: role.color, ringColor: role.color }}
                      />
                      
                      {/* Role Info */}
                      <div>
                        <div className="flex items-center gap-2">
                          <span 
                            className="font-semibold text-dark-text"
                            style={{ color: role.color }}
                          >
                            {role.name}
                          </span>
                          {role.isDefault && (
                            <span className="text-[10px] px-2 py-0.5 bg-dark-hover text-dark-muted rounded-full uppercase font-medium">
                              System
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-dark-muted mt-0.5">
                          {role.isDefault ? 'Default system role' : `Position: ${role.position ?? 0}`}
                        </p>
                      </div>
                    </div>
                    
                    {/* Actions */}
                    {!role.isDefault && (
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => setEditingRole(role)}
                          className="p-2 rounded-lg hover:bg-dark-hover text-dark-muted hover:text-brand-primary transition-colors"
                          title="Edit Role"
                        >
                          <MdEdit size={18} />
                        </button>
                        <button 
                          onClick={() => setConfirmDialog({ type: 'role', data: role.id, name: role.name })}
                          className="p-2 rounded-lg hover:bg-red-500/20 text-dark-muted hover:text-red-500 transition-colors"
                          title="Delete Role"
                        >
                          <MdDelete size={18} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                
                {allRoles.length === 0 && (
                  <div className="px-6 py-12 text-center">
                    <MdTag className="mx-auto text-dark-muted mb-3" size={40} />
                    <p className="text-dark-muted">No roles created yet</p>
                    <p className="text-xs text-dark-muted mt-1">Create your first role above!</p>
                  </div>
                )}
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
                <div className="flex-1 space-y-2">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Channel name"
                      value={newChannelName}
                      onChange={(e) => setNewChannelName(e.target.value)}
                      className="flex-1"
                    />
                    <select
                      value={newChannelType} // 'text' or 'voice'
                      onChange={(e) => setNewChannelType(e.target.value)}
                      className="bg-dark-input text-dark-text border border-dark-hover rounded-lg px-3 outline-none focus:border-brand-primary"
                    >
                      <option value="text">Text Channel</option>
                      <option value="voice">Voice Channel</option>
                    </select>
                  </div>
                  <Input
                    placeholder="Channel topic/description (Optional)"
                    value={newChannelDesc}
                    onChange={(e) => setNewChannelDesc(e.target.value)}
                  />
                </div>
                <Button onClick={handleCreateChannel} className="h-fit mt-auto">
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
                          {channel.description && (
                            <span className="text-xs text-dark-muted ml-2 truncate max-w-[200px]">
                              {channel.description}
                            </span>
                          )}
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
                      <Button size="sm" variant="ghost" onClick={() => setEditingChannel(channel)}>
                        <MdEdit size={16} />
                      </Button>
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

      case 'cleanup':
        return (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold text-dark-text">Database Cleanup</h1>
            <p className="text-dark-muted">Remove unused data to keep your database clean and reduce storage costs.</p>
            
            <div className="grid gap-4">
              {/* Expired Invite Codes Card */}
              <div className="bg-dark-bg rounded-lg p-6 border border-dark-hover">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-dark-text">Expired Invite Codes</h3>
                    <p className="text-sm text-dark-muted mt-1">
                      Expired, used, or deactivated invite codes that are no longer valid.
                    </p>
                  </div>
                  <div className="text-3xl font-bold text-yellow-500">
                    {expiredInvitesCount}
                  </div>
                </div>
                <Button
                  variant="warning"
                  onClick={() => setCleanupConfirm('invites')}
                  disabled={expiredInvitesCount === 0 || cleanupLoading}
                  className="w-full"
                >
                  <MdDelete size={20} />
                  {cleanupLoading ? 'Cleaning...' : 'Clean Invite Codes'}
                </Button>
              </div>
            </div>

            <div className="text-xs text-dark-muted bg-dark-sidebar p-4 rounded-lg">
              <strong>Note:</strong> These actions are irreversible. Deleted data cannot be recovered.
              Running cleanup periodically helps keep your Firestore quota usage low.
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex flex-col md:flex-row">
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
                    className={cn(
                      'whitespace-nowrap flex items-center gap-2 md:gap-3 px-3 py-2 rounded-md text-left transition-colors',
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
      <div className="flex-1 flex flex-col bg-dark-bg overflow-hidden min-w-0">
        {/* Header with close */}
        <div className="flex justify-end p-4 shrink-0">
          <button
            onClick={onClose}
            className="p-2 hover:bg-dark-hover rounded-full transition-colors group"
            title="Close (ESC)"
          >
            <MdClose size={24} className="text-dark-muted group-hover:text-dark-text" />
          </button>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 md:px-10 pb-10">
          <div className="max-w-3xl mx-auto md:mx-0">
            {renderTabContent()}
          </div>
        </div>
      </div>

      {/* Edit User Modal */}
      {editingUser && (() => {
        // Get the current user from the live users array for real-time updates
        const currentUserData = users.find(u => u.id === editingUser.id) || editingUser;
        return (
          <Modal
            isOpen={!!editingUser}
            onClose={() => setEditingUser(null)}
            title="Edit User Role"
            size="sm"
          >
            <div className="space-y-4">
              <div>
                <div className="text-sm text-dark-muted mb-1">User</div>
                <div className="font-medium text-dark-text">{currentUserData.displayName}</div>
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
                        (currentUserData.serverRole || currentUserData.role) === role.name
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
        );
      })()}

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

      {/* Edit Channel Modal */}
      {editingChannel && (
        <Modal
          isOpen={!!editingChannel}
          onClose={() => setEditingChannel(null)}
          title="Edit Channel"
          size="sm"
        >
          <div className="space-y-4">
            <Input
              label="Channel Name"
              value={editingChannel.name}
              onChange={(e) => setEditingChannel({ ...editingChannel, name: e.target.value })}
            />
            <Input
              label="Channel Topic / Description"
              value={editingChannel.description || ''}
              onChange={(e) => setEditingChannel({ ...editingChannel, description: e.target.value })}
            />
            <Button
              variant="primary"
              className="w-full"
              onClick={() => handleUpdateChannel(editingChannel.id, {
                name: editingChannel.name,
                description: editingChannel.description,
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

      {/* Cleanup Confirm Dialog */}
      <ConfirmDialog
        isOpen={!!cleanupConfirm}
        onClose={() => setCleanupConfirm(null)}
        onConfirm={cleanupInviteCodes}
        title="Clean Invite Codes"
        message={`Are you sure you want to delete ${expiredInvitesCount} expired/used invite code(s)? This action cannot be undone.`}
        confirmText="Clean"
        variant="danger"
      />
    </div>
  );
};
