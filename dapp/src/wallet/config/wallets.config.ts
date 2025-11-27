export const WALLET_CONFIG = {
  // Martian
  martian: {
    name: 'Martian',
    chains: ['aptos', 'sui'],
    platforms: ['extension', 'mobile'],
    icon: '/assets/wallets/martian.svg',
    brandColor: '#171A1F',
    downloadUrls: {
      chrome: 'https://chrome.google.com/webstore/detail/martian-aptos-wallet/efbglgofoippbgcjepnhiblaibcnclgk',
      ios: 'https://apps.apple.com/app/martian-wallet/id6443824542',
      android: 'https://play.google.com/store/apps/details?id=com.martianwallet',
    },
    deepLink: 'martian://',
    universalLink: 'https://martianwallet.xyz/app',
  },

  // Nightly
  nightly: {
    name: 'Nightly',
    chains: ['aptos', 'sui', 'solana', 'ethereum'],
    platforms: ['extension', 'mobile'],
    icon: '/assets/wallets/nightly.svg',
    brandColor: '#1F1A5F',
    downloadUrls: {
      chrome: 'https://chrome.google.com/webstore/detail/nightly/fiikommddbeccaoicoejoniammnalkfa',
      ios: 'https://apps.apple.com/app/nightly/id1592588017',
      android: 'https://play.google.com/store/apps/details?id=com.nightly.app',
    },
    deepLink: 'nightly://',
    universalLink: 'https://nightly.app/connect',
  },

  // Suiet
  suiet: {
    name: 'Suiet',
    chains: ['sui'],
    platforms: ['extension'],
    icon: '/assets/wallets/suiet.svg',
    brandColor: '#000000',
    downloadUrls: {
      chrome: 'https://chrome.google.com/webstore/detail/suiet/khpkpbbcccdmmclmpigdgddabeilkdpd',
    },
  },
} as const;

export type WalletName = keyof typeof WALLET_CONFIG;

export interface WalletConfig {
  name: string;
  chains: string[];
  platforms: string[];
  icon: string;
  brandColor: string;
  downloadUrls: {
    chrome?: string;
    ios?: string;
    android?: string;
  };
  deepLink?: string;
  universalLink?: string;
}
