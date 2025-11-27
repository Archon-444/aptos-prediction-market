/**
 * Push Notifications Utilities
 *
 * Handles push notification permissions, subscription,
 * and notification display.
 */

export type NotificationType = 'win' | 'loss' | 'market_update' | 'market_closing' | 'resolution';

export interface PushNotificationPayload {
  title: string;
  body: string;
  type: NotificationType;
  url?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
}

/**
 * Check if push notifications are supported
 */
export const isPushSupported = (): boolean => {
  return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
};

/**
 * Get current notification permission status
 */
export const getPermissionStatus = (): NotificationPermission => {
  if (!isPushSupported()) {
    return 'denied';
  }
  return Notification.permission;
};

/**
 * Request notification permission from user
 */
export const requestNotificationPermission = async (): Promise<NotificationPermission> => {
  if (!isPushSupported()) {
    console.error('Push notifications not supported');
    return 'denied';
  }

  try {
    const permission = await Notification.requestPermission();
    console.log('Notification permission:', permission);
    return permission;
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return 'denied';
  }
};

/**
 * Subscribe to push notifications
 */
export const subscribeToPush = async (
  vapidPublicKey: string
): Promise<PushSubscription | null> => {
  if (!isPushSupported()) {
    console.error('Push notifications not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;

    // Check if already subscribed
    let subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      console.log('Already subscribed to push notifications');
      return subscription;
    }

    // Subscribe to push notifications
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });

    console.log('Subscribed to push notifications:', subscription);
    return subscription;
  } catch (error) {
    console.error('Error subscribing to push notifications:', error);
    return null;
  }
};

/**
 * Unsubscribe from push notifications
 */
export const unsubscribeFromPush = async (): Promise<boolean> => {
  if (!isPushSupported()) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      const successful = await subscription.unsubscribe();
      console.log('Unsubscribed from push notifications:', successful);
      return successful;
    }

    return true;
  } catch (error) {
    console.error('Error unsubscribing from push notifications:', error);
    return false;
  }
};

/**
 * Show local notification (doesn't require server)
 */
export const showLocalNotification = async (payload: PushNotificationPayload): Promise<void> => {
  if (!isPushSupported()) {
    console.error('Notifications not supported');
    return;
  }

  if (Notification.permission !== 'granted') {
    console.error('Notification permission not granted');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;

    await registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon || '/icon-192.png',
      badge: payload.badge || '/icon-96.png',
      tag: payload.tag || payload.type,
      data: payload.url || '/',
      // actions and vibrate are not in standard NotificationOptions type
      // vibrate: [200, 100, 200],
      requireInteraction: payload.type === 'win' || payload.type === 'loss',
    });

    console.log('Local notification shown');
  } catch (error) {
    console.error('Error showing local notification:', error);
  }
};

/**
 * Send subscription to server
 */
export const sendSubscriptionToServer = async (
  subscription: PushSubscription,
  userAddress: string
): Promise<boolean> => {
  try {
    const response = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subscription,
        userAddress,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to send subscription to server');
    }

    console.log('Subscription sent to server');
    return true;
  } catch (error) {
    console.error('Error sending subscription to server:', error);
    return false;
  }
};

/**
 * Notification templates for different types
 */
export const notificationTemplates = {
  win: (amount: number, marketQuestion: string): PushNotificationPayload => ({
    title: '🎉 You Won!',
    body: `Congratulations! You won $${amount.toFixed(2)} on "${marketQuestion}"`,
    type: 'win',
    tag: 'win',
    actions: [
      { action: 'view', title: 'View Details' },
      { action: 'close', title: 'Close' },
    ],
  }),

  loss: (amount: number, marketQuestion: string): PushNotificationPayload => ({
    title: 'Market Resolved',
    body: `Your bet on "${marketQuestion}" didn't win this time. Better luck next time!`,
    type: 'loss',
    tag: 'loss',
  }),

  marketUpdate: (marketQuestion: string, change: number): PushNotificationPayload => ({
    title: '📊 Market Update',
    body: `"${marketQuestion}" odds changed by ${change > 0 ? '+' : ''}${change}%`,
    type: 'market_update',
    tag: 'market_update',
    actions: [
      { action: 'view', title: 'View Market' },
      { action: 'bet', title: 'Place Bet' },
    ],
  }),

  marketClosing: (marketQuestion: string, hoursLeft: number): PushNotificationPayload => ({
    title: '⏰ Market Closing Soon',
    body: `"${marketQuestion}" closes in ${hoursLeft} hour${hoursLeft !== 1 ? 's' : ''}`,
    type: 'market_closing',
    tag: 'market_closing',
    requireInteraction: true,
    actions: [
      { action: 'view', title: 'View Market' },
      { action: 'bet', title: 'Place Bet' },
    ],
  }) as PushNotificationPayload,

  resolution: (marketQuestion: string, outcome: string): PushNotificationPayload => ({
    title: '✅ Market Resolved',
    body: `"${marketQuestion}" resolved: ${outcome}`,
    type: 'resolution',
    tag: 'resolution',
    actions: [
      { action: 'view', title: 'View Details' },
      { action: 'close', title: 'Close' },
    ],
  }),
};

/**
 * Helper function to convert VAPID key
 */
function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray.buffer;
}

/**
 * Check if user has active push subscription
 */
export const hasActivePushSubscription = async (): Promise<boolean> => {
  if (!isPushSupported()) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return subscription !== null;
  } catch (error) {
    console.error('Error checking push subscription:', error);
    return false;
  }
};
