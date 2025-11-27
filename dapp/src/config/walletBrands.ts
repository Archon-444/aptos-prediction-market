export interface WalletBrandInfo {
  icon?: string;
  brandColor: string;
  website?: string;
  initials: string;
}

interface WalletBrandSpec {
  ids: string[];
  info: WalletBrandInfo;
}

const walletBrandSpecs: WalletBrandSpec[] = [
  {
    ids: ['petra', 'petra wallet'],
    info: {
      icon: '/assets/wallets/petra.svg',
      brandColor: '#36ADEF',
      website: 'https://petra.app',
      initials: 'P',
    },
  },
  {
    ids: ['martian', 'martian wallet', 'martian aptos wallet'],
    info: {
      icon: '/assets/wallets/martian.svg',
      brandColor: '#171A1F',
      website: 'https://martianwallet.xyz',
      initials: 'M',
    },
  },
  {
    ids: ['fewcha', 'fewcha wallet'],
    info: {
      icon: '/assets/wallets/fewcha.svg',
      brandColor: '#96B8FE',
      website: 'https://fewcha.app',
      initials: 'F',
    },
  },
  {
    ids: ['pontem', 'pontem wallet'],
    info: {
      icon: '/assets/wallets/pontem.svg',
      brandColor: '#FD7211',
      website: 'https://pontem.network',
      initials: 'P',
    },
  },
  {
    ids: ['sui wallet', 'sui'],
    info: {
      icon: '/assets/wallets/sui.svg',
      brandColor: '#0F9CDF',
      website: 'https://sui.io',
      initials: 'S',
    },
  },
  {
    ids: ['ethos', 'ethos wallet'],
    info: {
      icon: '/assets/wallets/ethos.svg',
      brandColor: '#253B36',
      website: 'https://ethoswallet.xyz',
      initials: 'E',
    },
  },
  {
    ids: ['suiet', 'suiet wallet'],
    info: {
      icon: '/assets/wallets/suiet.svg',
      brandColor: '#000000',
      website: 'https://suiet.app',
      initials: 'S',
    },
  },
  {
    ids: ['nightly', 'nightly wallet'],
    info: {
      brandColor: '#1F1A5F',
      website: 'https://nightly.app',
      initials: 'N',
    },
  },
  {
    ids: ['okx wallet', 'okx', 'okx aptos wallet'],
    info: {
      icon: '/assets/wallets/okx.svg',
      brandColor: '#000000',
      website: 'https://okx.com/web3',
      initials: 'O',
    },
  },
];

const walletBrandMap = walletBrandSpecs.reduce<Record<string, WalletBrandInfo>>((acc, spec) => {
  spec.ids.forEach((id) => {
    acc[id.toLowerCase()] = spec.info;
  });
  return acc;
}, {});

const DEFAULT_BRAND_COLOR = '#00D4FF';
const DEFAULT_INITIAL = 'W';

export const WALLET_BRAND_FALLBACK: WalletBrandInfo = {
  brandColor: DEFAULT_BRAND_COLOR,
  initials: DEFAULT_INITIAL,
};

export function resolveWalletBrand(walletName?: string | null): WalletBrandInfo {
  if (!walletName) {
    return { ...WALLET_BRAND_FALLBACK };
  }

  const brand = walletBrandMap[walletName.trim().toLowerCase()];
  if (brand) {
    return brand;
  }

  const firstLetter = walletName.trim().charAt(0).toUpperCase() || WALLET_BRAND_FALLBACK.initials;
  return {
    brandColor: DEFAULT_BRAND_COLOR,
    initials: firstLetter,
  };
}

export function getWalletWebsite(walletName: string): string | undefined {
  const brand = resolveWalletBrand(walletName);
  return brand.website;
}

export const walletBrandRegistry = walletBrandMap;
