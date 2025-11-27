import { describe, it, expect, beforeEach, vi } from 'vitest';
import { detectAvailableWallets, getWalletConfig, walletSupportsChain, getWalletDownloadUrl } from '../utils/walletDetection';

// Mock window object
const mockWindow = {
  aptos: {
    connect: vi.fn(),
  },
  martian: {
    aptos: {
      connect: vi.fn(),
    },
    sui: {
      connect: vi.fn(),
    },
  },
  suiWallet: {
    connect: vi.fn(),
  },
};

Object.defineProperty(global, 'window', {
  value: mockWindow,
  writable: true,
});

describe('Wallet Detection Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('detectAvailableWallets', () => {
    it('should detect available wallets', async () => {
      const result = await detectAvailableWallets();

      expect(result.aptos).toContain('Petra');
      expect(result.aptos).toContain('Martian');
      expect(result.aptos).toContain('Nightly');
      expect(result.sui).toContain('Suiet');
      expect(result.sui).toContain('Martian');
      expect(result.sui).toContain('Nightly');
      expect(result.mobile).toContain('Martian');
      expect(result.mobile).toContain('Nightly');
    });

    it('should handle missing wallets', async () => {
      // Remove some wallets
      delete (window as any).aptos;
      delete (window as any).martian;

      const result = await detectAvailableWallets();

      expect(result.aptos).not.toContain('Petra');
      expect(result.aptos).not.toContain('Martian');
      expect(result.aptos).toContain('Nightly'); // Always available
    });
  });

  describe('getWalletConfig', () => {
    it('should return wallet configuration', () => {
      const config = getWalletConfig('martian');
      expect(config).toBeDefined();
      expect(config?.name).toBe('Martian');
      expect(config?.chains).toContain('aptos');
      expect(config?.chains).toContain('sui');
    });

    it('should return undefined for unknown wallet', () => {
      const config = getWalletConfig('unknown');
      expect(config).toBeUndefined();
    });
  });

  describe('walletSupportsChain', () => {
    it('should check if wallet supports chain', () => {
      expect(walletSupportsChain('martian', 'aptos')).toBe(true);
      expect(walletSupportsChain('martian', 'sui')).toBe(true);
      expect(walletSupportsChain('martian', 'aptos')).toBe(true);
      expect(walletSupportsChain('suiet', 'sui')).toBe(true);
      expect(walletSupportsChain('suiet', 'aptos')).toBe(false);
    });

    it('should return false for unknown wallet', () => {
      expect(walletSupportsChain('unknown', 'aptos')).toBe(false);
    });
  });

  describe('getWalletDownloadUrl', () => {
    it('should return iOS download URL', () => {
      Object.defineProperty(window, 'navigator', {
        value: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)' },
        writable: true,
      });

      const url = getWalletDownloadUrl('martian');
      expect(url).toBe('https://apps.apple.com/app/martian-wallet/id6443824542');
    });

    it('should return Android download URL', () => {
      Object.defineProperty(window, 'navigator', {
        value: { userAgent: 'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36' },
        writable: true,
      });

      const url = getWalletDownloadUrl('martian');
      expect(url).toBe('https://play.google.com/store/apps/details?id=com.martianwallet');
    });

    it('should return Chrome download URL for desktop', () => {
      Object.defineProperty(window, 'navigator', {
        value: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        writable: true,
      });

      const url = getWalletDownloadUrl('martian');
      expect(url).toBe('https://chrome.google.com/webstore/detail/martian-aptos-wallet/efbglgofoippbgcjepnhiblaibcnclgk');
    });

    it('should return null for unknown wallet', () => {
      const url = getWalletDownloadUrl('unknown');
      expect(url).toBeNull();
    });
  });
});
