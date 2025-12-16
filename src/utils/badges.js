import { MdAdminPanelSettings, MdVerified, MdCode, MdRocketLaunch } from 'react-icons/md';

export const BADGES = {
  premium: {
    id: 'premium',
    label: 'Premium Member',
    description: 'Premium Member',
    icon: MdRocketLaunch,
    color: '#F47FFF'
  },
  admin: {
    id: 'admin',
    label: 'Admin',
    description: 'Server Administrator',
    icon: MdAdminPanelSettings,
    color: '#f23f42'
  },
  verified: {
    id: 'verified',
    label: 'Verified',
    description: 'Verified Member',
    icon: MdVerified,
    color: '#3ba55c'
  },
  developer: {
    id: 'developer', 
    label: 'Developer',
    description: 'App Developer',
    icon: MdCode,
    color: '#5865F2'
  },
};

export const getBadge = (id) => BADGES[id];
