import { describe, it, expect, beforeEach, vi } from 'vitest';
import { isMobile, getPlatform, openWalletApp, isWalletAppInstalled } from '../utils/deepLinks';

// Mock window and navigator
const mockNavigator = {
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
};

Object.defineProperty(window, 'navigator', {
  value: mockNavigator,
  writable: true,
});

describe('Deep Links Utilities', () => {
beforeEach(() => {
  vi.clearAllMocks();

  Object.defineProperty(window, 'navigator', {
    value: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)' },
    writable: true,
  });

  Object.defineProperty(window, 'location', {
    value: { href: '' },
    writable: true,
  });
});

  describe('isMobile', () => {
    it('should detect mobile devices', () => {
      expect(isMobile()).toBe(true);
    });

    it('should detect desktop devices', () => {
      Object.defineProperty(window, 'navigator', {
        value: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        writable: true,
      });
      expect(isMobile()).toBe(false);
    });
  });

  describe('getPlatform', () => {
    it('should detect iOS', () => {
      Object.defineProperty(window, 'navigator', {
        value: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)' },
        writable: true,
      });
      expect(getPlatform()).toBe('ios');
    });

    it('should detect Android', () => {
      Object.defineProperty(window, 'navigator', {
        value: { userAgent: 'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36' },
        writable: true,
      });
      expect(getPlatform()).toBe('android');
    });

    it('should detect desktop', () => {
      Object.defineProperty(window, 'navigator', {
        value: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        writable: true,
      });
      expect(getPlatform()).toBe('desktop');
    });
  });

  describe('openWalletApp', () => {
    it('should open deep link on mobile', () => {
      const consoleSpy = vi.spyOn(console, 'log');
      openWalletApp('martian');

      expect(window.location.href).toBe('martian://');
      expect(consoleSpy).toHaveBeenCalledWith('[DeepLink] Opened deep link:', 'martian://');
    });

    it('should warn on desktop and try to open wallet website', () => {
      Object.defineProperty(window, 'navigator', {
        value: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        writable: true,
      });

      const consoleSpy = vi.spyOn(console, 'warn');
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
      
      openWalletApp('martian');

      expect(consoleSpy).toHaveBeenCalledWith('[DeepLink] Not on mobile device');
    });

    it('should handle test environment gracefully', () => {
      // Mock test environment
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';
      
      const consoleSpy = vi.spyOn(console, 'log');
      openWalletApp('martian');

      expect(consoleSpy).toHaveBeenCalledWith('[DeepLink] Test mode - simulating deep-link for:', 'martian');
      
      // Restore environment
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('isWalletAppInstalled', () => {
    it('should return false on desktop', async () => {
      Object.defineProperty(window, 'navigator', {
        value: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        writable: true,
      });

      const result = await isWalletAppInstalled('martian');
      expect(result).toBe(false);
    });

    it('should simulate app detection in test environment', async () => {
      // Mock test environment
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'test';
      
      const consoleSpy = vi.spyOn(console, 'log');
      
      const martianResult = await isWalletAppInstalled('martian');
      const suietResult = await isWalletAppInstalled('suiet');
      const unknownResult = await isWalletAppInstalled('unknown' as any);
      
      expect(martianResult).toBe(true);
      expect(suietResult).toBe(false);
      expect(unknownResult).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('[DeepLink] Test mode - simulating app detection for:', 'martian');
      
      // Restore environment
      process.env.NODE_ENV = originalEnv;
    });

    it('should test deep link on mobile', async () => {
      Object.defineProperty(window, 'navigator', {
        value: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)' },
        writable: true,
      });

      // Mock document methods
      const mockIframe = {
        style: { display: '' },
        src: '',
      };
      const mockCreateElement = vi.fn().mockReturnValue(mockIframe);
      const mockAppendChild = vi.fn();
      const mockRemoveChild = vi.fn();

      Object.defineProperty(document, 'createElement', {
        value: mockCreateElement,
        writable: true,
      });
      Object.defineProperty(document.body, 'appendChild', {
        value: mockAppendChild,
        writable: true,
      });
      Object.defineProperty(document.body, 'removeChild', {
        value: mockRemoveChild,
        writable: true,
      });

      // Mock visibility change event
      const mockAddEventListener = vi.fn();
      Object.defineProperty(document, 'addEventListener', {
        value: mockAddEventListener,
        writable: true,
      });

      const result = await isWalletAppInstalled('martian');

      expect(mockCreateElement).toHaveBeenCalledWith('iframe');
      expect(mockAppendChild).toHaveBeenCalledWith(mockIframe);
      expect(mockAddEventListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    });

    it('should handle errors gracefully', async () => {
      Object.defineProperty(window, 'navigator', {
        value: { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)' },
        writable: true,
      });

      // Mock document.createElement to throw error
      const mockCreateElement = vi.fn().mockImplementation(() => {
        throw new Error('DOM error');
      });
      Object.defineProperty(document, 'createElement', {
        value: mockCreateElement,
        writable: true,
      });

      const consoleSpy = vi.spyOn(console, 'error');
      const result = await isWalletAppInstalled('martian');

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('[DeepLink] Error checking app installation:', expect.any(Error));
    });
  });
});
