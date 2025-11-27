/**
 * Service Worker Registration
 *
 * Registers the service worker for PWA offline support,
 * caching, and push notifications.
 */

export interface ServiceWorkerConfig {
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
  onOffline?: () => void;
  onOnline?: () => void;
}

export const registerServiceWorker = async (config?: ServiceWorkerConfig) => {
  // Check if service workers are supported
  if (!('serviceWorker' in navigator)) {
    console.log('Service workers are not supported');
    return;
  }

  // Only register in production or if explicitly enabled
  if (!import.meta.env.PROD && import.meta.env.VITE_ENABLE_SERVICE_WORKER !== 'true') {
    console.log('Service worker registration skipped in development');
    return;
  }

  try {
    // Register the service worker
    const registration = await navigator.serviceWorker.register('/service-worker.js', {
      scope: '/',
    });

    console.log('Service worker registered:', registration.scope);

    // Handle updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;

      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New service worker available
          console.log('New service worker available');
          config?.onUpdate?.(registration);
        }
      });
    });

    // Check for updates periodically (every hour)
    setInterval(() => {
      registration.update();
    }, 60 * 60 * 1000);

    // Listen for messages from service worker
    navigator.serviceWorker.addEventListener('message', (event) => {
      console.log('Message from service worker:', event.data);
    });

    // Success callback
    if (registration.active) {
      config?.onSuccess?.(registration);
    }

    return registration;
  } catch (error) {
    console.error('Service worker registration failed:', error);
  }
};

export const unregisterServiceWorker = async () => {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.unregister();
    console.log('Service worker unregistered');
  } catch (error) {
    console.error('Service worker unregistration failed:', error);
  }
};

export const updateServiceWorker = async () => {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.update();
    console.log('Service worker updated');
  } catch (error) {
    console.error('Service worker update failed:', error);
  }
};

export const skipWaiting = () => {
  if (!navigator.serviceWorker.controller) {
    return;
  }

  navigator.serviceWorker.controller.postMessage({
    type: 'SKIP_WAITING',
  });
};

export const clearCache = () => {
  if (!navigator.serviceWorker.controller) {
    return;
  }

  navigator.serviceWorker.controller.postMessage({
    type: 'CLEAR_CACHE',
  });
};

/**
 * Check if app is running in standalone mode (PWA installed)
 */
export const isStandalone = (): boolean => {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true
  );
};

/**
 * Check if app is online
 */
export const isOnline = (): boolean => {
  return navigator.onLine;
};

/**
 * Listen for online/offline events
 */
export const setupConnectivityListeners = (config?: ServiceWorkerConfig) => {
  window.addEventListener('online', () => {
    console.log('App is online');
    config?.onOnline?.();
  });

  window.addEventListener('offline', () => {
    console.log('App is offline');
    config?.onOffline?.();
  });
};
