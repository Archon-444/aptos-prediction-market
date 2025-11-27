import { useState, useEffect, useCallback } from 'react';

export type NotificationType =
  | 'market_resolved'
  | 'bet_won'
  | 'bet_lost'
  | 'market_ending_soon'
  | 'new_market'
  | 'price_alert';

export interface NotificationPayload {
  title: string;
  body: string;
  type: NotificationType;
  marketId?: string;
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

interface UseNotificationsReturn {
  isSupported: boolean;
  permission: NotificationPermission;
  isSubscribed: boolean;
  requestPermission: () => Promise<boolean>;
  subscribe: () => Promise<PushSubscription | null>;
  unsubscribe: () => Promise<boolean>;
  sendTestNotification: () => Promise<void>;
}

export function useNotifications(): UseNotificationsReturn {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    // Check if notifications are supported
    const supported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
    setIsSupported(supported);

    if (supported) {
      setPermission(Notification.permission);
      checkSubscription();
    }
  }, []);

  const checkSubscription = useCallback(async () => {
    if (!('serviceWorker' in navigator)) return;

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (error) {
      console.error('Error checking subscription:', error);
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      console.warn('Notifications not supported');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result === 'granted';
    } catch (error) {
      console.error('Error requesting permission:', error);
      return false;
    }
  }, [isSupported]);

  const subscribe = useCallback(async (): Promise<PushSubscription | null> => {
    if (!isSupported) {
      console.warn('Notifications not supported');
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.ready;

      // Get or create subscription
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        // VAPID public key - would normally come from backend
        // For now, using a placeholder - replace with real key from backend
        const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

        if (!vapidPublicKey) {
          console.warn('VAPID public key not configured');
          return null;
        }

        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });

        // Send subscription to backend
        await sendSubscriptionToBackend(subscription);
      }

      setIsSubscribed(true);
      return subscription;
    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      return null;
    }
  }, [isSupported]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!('serviceWorker' in navigator)) return false;

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();

        // Notify backend to remove subscription
        await removeSubscriptionFromBackend(subscription);

        setIsSubscribed(false);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error unsubscribing:', error);
      return false;
    }
  }, []);

  const sendTestNotification = useCallback(async () => {
    if (!isSupported || permission !== 'granted') {
      console.warn('Cannot send test notification');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;

      await registration.showNotification('🎉 Move Market Test', {
        body: 'Push notifications are working! You\'ll be notified about market updates.',
        icon: '/icon-192.png',
        badge: '/icon-96.png',
        tag: 'test-notification',
        // vibrate: [200, 100, 200], // Not supported in all browsers
        // actions: [...], // Not supported in all browsers
      });
    } catch (error) {
      console.error('Error sending test notification:', error);
    }
  }, [isSupported, permission]);

  return {
    isSupported,
    permission,
    isSubscribed,
    requestPermission,
    subscribe,
    unsubscribe,
    sendTestNotification,
  };
}

// Helper function to convert VAPID key
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

// Backend integration functions (would be real API calls)
async function sendSubscriptionToBackend(subscription: PushSubscription): Promise<void> {
  try {
    // TODO: Replace with actual backend endpoint
    const endpoint = import.meta.env.VITE_API_URL || '/api';

    await fetch(`${endpoint}/push/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(subscription),
    });

    console.log('Subscription sent to backend');
  } catch (error) {
    console.error('Error sending subscription to backend:', error);
  }
}

async function removeSubscriptionFromBackend(subscription: PushSubscription): Promise<void> {
  try {
    // TODO: Replace with actual backend endpoint
    const endpoint = import.meta.env.VITE_API_URL || '/api';

    await fetch(`${endpoint}/push/unsubscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(subscription),
    });

    console.log('Subscription removed from backend');
  } catch (error) {
    console.error('Error removing subscription from backend:', error);
  }
}
