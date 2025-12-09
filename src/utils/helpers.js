import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatTimestamp(timestamp) {
  if (!timestamp) return '';
  
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  
  // Less than 1 minute
  if (diff < 60000) {
    return 'Just now';
  }
  
  // Less than 1 hour
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `${minutes}m ago`;
  }
  
  // Less than 24 hours
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours}h ago`;
  }
  
  // Less than 7 days
  if (diff < 604800000) {
    const days = Math.floor(diff / 86400000);
    return `${days}d ago`;
  }
  
  // Format as date
  return date.toLocaleDateString();
}

export function getRoleColor(role) {
  switch (role) {
    case 'admin':
      return 'text-admin';
    case 'moderator':
      return 'text-moderator';
    default:
      return 'text-member';
  }
}

export function getRoleBadgeColor(role) {
  switch (role) {
    case 'admin':
      return 'bg-admin/20 text-admin border-admin/30';
    case 'moderator':
      return 'bg-moderator/20 text-moderator border-moderator/30';
    default:
      return 'bg-member/20 text-member border-member/30';
  }
}
