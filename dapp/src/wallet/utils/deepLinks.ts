import { WALLET_CONFIG } from '../config/wallets.config';

/**
 * Check if user is on mobile device
 */
export function isMobile(): boolean {
  if (typeof window === 'undefined') return false;

  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

/**
 * Get platform (iOS or Android)
 */
export function getPlatform(): 'ios' | 'android' | 'desktop' {
  if (typeof window === 'undefined') return 'desktop';

  const ua = navigator.userAgent;

  if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

/**
 * Open wallet app via deep link
 */
export function openWalletApp(walletName: keyof typeof WALLET_CONFIG): void {
  const wallet = WALLET_CONFIG[walletName];

  if (!wallet) {
    console.warn('[DeepLink] Wallet not configured:', walletName);
    return;
  }

  // In test environment, simulate deep-link behavior
  if (typeof window === 'undefined' || process.env.NODE_ENV === 'test') {
    console.log('[DeepLink] Test mode - simulating deep-link for:', walletName);
    return;
  }

  if (!isMobile()) {
    console.warn('[DeepLink] Not on mobile device');
    // On desktop, try to open wallet website or show instructions
    if (wallet.downloadUrls?.chrome) {
      window.open(wallet.downloadUrls.chrome, '_blank');
    }
    return;
  }

  const platform = getPlatform();

  // Try deep link first
  if ('deepLink' in wallet && wallet.deepLink) {
    try {
      window.location.href = wallet.deepLink;
      console.log('[DeepLink] Opened deep link:', wallet.deepLink);

      // Fallback to app store if deep link doesn't work
      setTimeout(() => {
        if (platform === 'ios' && 'ios' in wallet.downloadUrls && wallet.downloadUrls.ios) {
          window.location.href = wallet.downloadUrls.ios;
          console.log('[DeepLink] Fallback to iOS App Store');
        } else if (platform === 'android' && 'android' in wallet.downloadUrls && wallet.downloadUrls.android) {
          window.location.href = wallet.downloadUrls.android;
          console.log('[DeepLink] Fallback to Google Play Store');
        }
      }, 1500);
    } catch (error) {
      console.error('[DeepLink] Failed to open deep link:', error);
      // Fallback immediately on error
      if (platform === 'ios' && 'ios' in wallet.downloadUrls && wallet.downloadUrls.ios) {
        window.location.href = wallet.downloadUrls.ios;
      } else if (platform === 'android' && 'android' in wallet.downloadUrls && wallet.downloadUrls.android) {
        window.location.href = wallet.downloadUrls.android;
      }
    }
  }
  // Try universal link
  else if ('universalLink' in wallet && wallet.universalLink) {
    try {
      window.location.href = wallet.universalLink;
      console.log('[DeepLink] Opened universal link:', wallet.universalLink);
    } catch (error) {
      console.error('[DeepLink] Failed to open universal link:', error);
    }
  }
}

/**
 * Check if wallet app is installed on mobile
 */
export async function isWalletAppInstalled(
  walletName: keyof typeof WALLET_CONFIG
): Promise<boolean> {
  const wallet = WALLET_CONFIG[walletName];

  if (!wallet) {
    console.warn('[DeepLink] Wallet not configured:', walletName);
    return false;
  }

  // In test environment, simulate app detection
  if (typeof window === 'undefined' || process.env.NODE_ENV === 'test') {
    console.log('[DeepLink] Test mode - simulating app detection for:', walletName);
    // Simulate different scenarios based on wallet name
    return walletName === 'martian';
  }

  if (!isMobile() || !('deepLink' in wallet) || !wallet.deepLink) {
    return false;
  }

  // Try to open deep link in hidden iframe
  return new Promise((resolve) => {
    try {
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = wallet.deepLink;

      document.body.appendChild(iframe);

      const timeout = setTimeout(() => {
        try {
          document.body.removeChild(iframe);
        } catch (e) {
          // Ignore cleanup errors
        }
        resolve(false); // Timeout = app not installed
      }, 1000);

      // If app opens, page will be hidden
      const visibilityHandler = () => {
        if (document.hidden) {
          clearTimeout(timeout);
          try {
            document.body.removeChild(iframe);
          } catch (e) {
            // Ignore cleanup errors
          }
          document.removeEventListener('visibilitychange', visibilityHandler);
          resolve(true); // App opened = installed
        }
      };

      document.addEventListener('visibilitychange', visibilityHandler);
    } catch (error) {
      console.error('[DeepLink] Error checking app installation:', error);
      resolve(false);
    }
  });
}
