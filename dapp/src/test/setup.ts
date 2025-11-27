import { vi } from 'vitest';
import '@testing-library/jest-dom';

// Mock navigator for deep-link testing
const mockNavigator = {
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
};

Object.defineProperty(global, 'navigator', {
  value: mockNavigator,
  writable: true,
});

// Mock document for deep-link testing
const mockDocument = {
  createElement: vi.fn().mockReturnValue({
    style: { display: '' },
    src: '',
  }),
  body: {
    appendChild: vi.fn(),
    removeChild: vi.fn(),
  },
  addEventListener: vi.fn(),
  hidden: false,
};

Object.defineProperty(global, 'document', {
  value: mockDocument,
  writable: true,
});

// Mock window object for wallet testing
Object.defineProperty(window, 'martian', {
  value: {
    aptos: {
      connect: vi.fn(),
      disconnect: vi.fn(),
      isConnected: vi.fn(),
      account: vi.fn(),
      signTransaction: vi.fn(),
      signMessage: vi.fn(),
      signAndSubmitTransaction: vi.fn(),
      onAccountChange: vi.fn(),
      onDisconnect: vi.fn(),
      network: vi.fn(),
    },
    sui: {
      connect: vi.fn(),
      disconnect: vi.fn(),
      isConnected: vi.fn(),
      getAccounts: vi.fn(),
      signAndExecuteTransaction: vi.fn(),
      signMessage: vi.fn(),
      onAccountChange: vi.fn(),
      onDisconnect: vi.fn(),
    },
  },
  writable: true,
});

// Mock Aptos wallet
Object.defineProperty(window, 'aptos', {
  value: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    isConnected: vi.fn(),
    account: vi.fn(),
    signTransaction: vi.fn(),
    signMessage: vi.fn(),
    signAndSubmitTransaction: vi.fn(),
    onAccountChange: vi.fn(),
    onDisconnect: vi.fn(),
    network: vi.fn(),
  },
  writable: true,
});

// Mock Sui wallet
Object.defineProperty(window, 'suiWallet', {
  value: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    isConnected: vi.fn(),
    account: vi.fn(),
    signAndExecuteTransactionBlock: vi.fn(),
    signMessage: vi.fn(),
  },
  writable: true,
});

// Mock environment variables
vi.mock('import.meta.env', () => ({
  VITE_WALLETCONNECT_PROJECT_ID: 'test-project-id',
}));
