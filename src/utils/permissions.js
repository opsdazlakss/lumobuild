/**
 * Centralized Permission System
 * 
 * Defines all available capabilities and maps them to Roles and Badges.
 * This allows for easy extensibility: simply add a new capability and assign it to the desired badges/roles.
 */

// 1. Define all possible features/capabilities in the app
export const CAPABILITIES = {
  SCREEN_SHARE: 'screen_share',
  HIGH_QUALITY: 'high_quality',
  // Future examples:
  // CREATE_CHANNEL: 'create_channel',
  // UPLOAD_FILES: 'upload_files',
  // ANIMATED_AVATAR: 'animated_avatar',
};

// 2. Define which Roles get which capabilities
const ROLE_PERMISSIONS = {
  admin: [
    CAPABILITIES.SCREEN_SHARE,
    CAPABILITIES.HIGH_QUALITY,
    // CAPABILITIES.CREATE_CHANNEL
  ],
  moderator: [
    CAPABILITIES.SCREEN_SHARE
  ],
  member: [] // Members get nothing by default
};

// 3. Define which Badges get which capabilities
const BADGE_PERMISSIONS = {
  premium: [
    CAPABILITIES.SCREEN_SHARE,
    CAPABILITIES.HIGH_QUALITY
  ],
  developer: [
    CAPABILITIES.SCREEN_SHARE,
    CAPABILITIES.HIGH_QUALITY
  ],
  verified: [] // Verified badge alone doesn't give extra powers
};

/**
 * Checks if a user has a specific capability based on their role OR badges.
 * @param {Object} user - The user object (must contain role and badges)
 * @param {string} capability - The CAPABILITIES string to check
 * @returns {boolean}
 */
export const hasCapability = (user, capability) => {
  if (!user) return false;

  // 1. Check Role Permissions
  const userRole = user.role || 'member';
  const roleCaps = ROLE_PERMISSIONS[userRole] || [];
  if (roleCaps.includes(capability)) {
    return true;
  }

  // 2. Check Badge Permissions
  const userBadges = user.badges || [];
  for (const badgeId of userBadges) {
    const badgeCaps = BADGE_PERMISSIONS[badgeId] || [];
    if (badgeCaps.includes(capability)) {
      return true;
    }
  }

  return false;
};

/**
 * Checks if a user has Premium status.
 * This is the SINGLE SOURCE OF TRUTH for premium checks.
 * Use this function instead of inline checks to ensure consistency.
 * 
 * @param {Object} userProfile - The user profile object
 * @returns {boolean} - True if user has premium access
 */
export const isPremiumUser = (userProfile) => {
  if (!userProfile) return false;

  // 1. Check role (admin always has premium features)
  if (userProfile.role === 'admin') return true;
  if (userProfile.role === 'premium') return true;

  // 2. Check badges array
  if (userProfile.badges?.includes('premium')) return true;
  if (userProfile.badges?.includes('developer')) return true;

  // 3. Check plan field (for subscription-based premium)
  if (userProfile.plan === 'premium') return true;

  // 4. Check roles array (some systems use this)
  if (userProfile.roles?.includes('premium')) return true;
  if (userProfile.roles?.includes('admin')) return true;

  return false;
};
