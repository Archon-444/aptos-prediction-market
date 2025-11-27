/**
 * Push Notification Configuration
 *
 * IMPORTANT: Set REACT_APP_VAPID_PUBLIC_KEY in your .env file
 * See PUSH_NOTIFICATION_SETUP.md for full setup instructions
 */

export const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

// Validate in production
if (!VAPID_PUBLIC_KEY && import.meta.env.PROD) {
  console.error(
    '❌ VAPID_PUBLIC_KEY not set! Push notifications will not work.\n' +
    'Please set VITE_VAPID_PUBLIC_KEY in your .env file.\n' +
    'See PUSH_NOTIFICATION_SETUP.md for setup instructions.'
  );
}

// Validate in development (warning only)
if (!VAPID_PUBLIC_KEY && import.meta.env.DEV) {
  console.warn(
    '⚠️ VAPID_PUBLIC_KEY not set. Push notifications disabled in development.\n' +
    'To test push notifications, set VITE_VAPID_PUBLIC_KEY in .env.local\n' +
    'See PUSH_NOTIFICATION_SETUP.md for setup instructions.'
  );
}

export const isPushConfigured = (): boolean => {
  return VAPID_PUBLIC_KEY.length > 0;
};
