import { WALLET_CONFIG } from '../config/wallets.config';

/**
 * Detect available wallets based on platform and installed extensions
 */
export async function detectAvailableWallets(): Promise<{
  aptos: string[];
  sui: string[];
  mobile: string[];
}> {
  const aptos: string[] = [];
  const sui: string[] = [];
  const mobile: string[] = [];

  // Check for Aptos wallets
  if (typeof window !== 'undefined') {
    // Check Petra
    if (window.aptos) {
      aptos.push('Petra');
    }

    // Check Martian
    if (window.martian?.aptos) {
      aptos.push('Martian');
    }

    // Check Nightly (always available via QR)
    aptos.push('Nightly');
  }

  // Check for Sui wallets
  if (typeof window !== 'undefined') {
    // Check Suiet
    if (window.suiWallet) {
      sui.push('Suiet');
    }

    // Check Martian Sui
    if (window.martian?.sui) {
      sui.push('Martian');
    }

    // Check Nightly Sui (always available via QR)
    sui.push('Nightly');
  }

  // Mobile wallets (always available via deep links)
  mobile.push('Martian', 'Nightly');

  return { aptos, sui, mobile };
}

/**
 * Get wallet configuration by name
 */
export function getWalletConfig(walletName: string) {
  return WALLET_CONFIG[walletName as keyof typeof WALLET_CONFIG];
}

/**
 * Check if wallet supports specific chain
 */
export function walletSupportsChain(walletName: string, chain: string): boolean {
  const config = getWalletConfig(walletName);
  return ((config?.chains as unknown as string[])?.includes(chain) ?? false);
}

/**
 * Get download URL for wallet based on platform
 */
export function getWalletDownloadUrl(walletName: string): string | null {
  const config = getWalletConfig(walletName);
  if (!config) return null;

  const platform = getPlatform();
  
  switch (platform) {
    case 'ios':
      return 'ios' in config.downloadUrls ? config.downloadUrls.ios || null : null;
    case 'android':
      return 'android' in config.downloadUrls ? config.downloadUrls.android || null : null;
    case 'desktop':
      return 'chrome' in config.downloadUrls ? config.downloadUrls.chrome || null : null;
    default:
      return null;
  }
}

/**
 * Get platform (iOS or Android)
 */
function getPlatform(): 'ios' | 'android' | 'desktop' {
  if (typeof window === 'undefined') return 'desktop';

  const ua = navigator.userAgent;

  if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}
