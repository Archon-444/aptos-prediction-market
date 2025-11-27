import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NightlyAptosAdapter } from '../adapters/aptos/NightlyAdapter';

// Mock the NightlyConnectAdapter
vi.mock('@nightlylabs/aptos-wallet-adapter-plugin', () => ({
  NightlyConnectAdapter: vi.fn().mockImplementation(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    connected: false,
    publicAccount: null,
    signTransaction: vi.fn(),
    signMessage: vi.fn(),
    signAndSubmitTransaction: vi.fn(),
  })),
}));

describe('NightlyAptosAdapter', () => {
  let adapter: NightlyAptosAdapter;

  beforeEach(() => {
    adapter = new NightlyAptosAdapter();
    vi.clearAllMocks();
  });

  it('should initialize adapter', () => {
    expect(adapter.name).toBe('Nightly');
    expect(adapter.connecting).toBe(false);
    expect(adapter.connected).toBe(false);
  });

  it('should always be available (QR code support)', async () => {
    const installed = await adapter.isInstalled();
    expect(installed).toBe(true);
  });

  it('should connect successfully', async () => {
    // Mock successful connection
    const mockAccount = { address: '0x1234567890abcdef' };
    const mockAdapter = {
      connect: vi.fn().mockResolvedValue(undefined),
      connected: true,
      publicAccount: mockAccount,
    };

    // Replace the adapter instance
    (adapter as any).adapter = mockAdapter;

    const result = await adapter.connect();

    expect(result).toEqual(mockAccount);
    expect(adapter.connected).toBe(true);
    expect(mockAdapter.connect).toHaveBeenCalled();
  });

  it('should handle connection failure', async () => {
    const mockAdapter = {
      connect: vi.fn().mockRejectedValue(new Error('Connection failed')),
      connected: false,
      publicAccount: null,
    };

    (adapter as any).adapter = mockAdapter;

    await expect(adapter.connect()).rejects.toThrow('Connection failed');
    expect(adapter.connected).toBe(false);
  });

  it('should disconnect successfully', async () => {
    const mockAdapter = {
      disconnect: vi.fn().mockResolvedValue(undefined),
      connected: false,
    };

    (adapter as any).adapter = mockAdapter;

    await adapter.disconnect();

    expect(mockAdapter.disconnect).toHaveBeenCalled();
    expect(adapter.connected).toBe(false);
  });

  it('should sign transaction', async () => {
    const mockAdapter = {
      connected: true,
      signTransaction: vi.fn().mockResolvedValue({ signature: 'mock-signature' }),
    };

    (adapter as any).adapter = mockAdapter;
    (adapter as any)._connected = true;

    const transaction = { type: 'entry_function_payload' };
    const result = await adapter.signTransaction(transaction);

    expect(result.signature).toBe('mock-signature');
    expect(mockAdapter.signTransaction).toHaveBeenCalledWith(transaction);
  });

  it('should sign message', async () => {
    const mockAdapter = {
      connected: true,
      signMessage: vi.fn().mockResolvedValue({ signature: 'mock-signature' }),
    };

    (adapter as any).adapter = mockAdapter;
    (adapter as any)._connected = true;

    const message = { message: 'test', nonce: '123' };
    const result = await adapter.signMessage(message);

    expect(result.signature).toBe('mock-signature');
    expect(mockAdapter.signMessage).toHaveBeenCalledWith(message);
  });

  it('should sign and submit transaction', async () => {
    const mockAdapter = {
      connected: true,
      signAndSubmitTransaction: vi.fn().mockResolvedValue({ hash: 'mock-hash' }),
    };

    (adapter as any).adapter = mockAdapter;
    (adapter as any)._connected = true;

    const transaction = { type: 'entry_function_payload' };
    const result = await adapter.signAndSubmitTransaction(transaction);

    expect(result).toBe('mock-hash');
    expect(mockAdapter.signAndSubmitTransaction).toHaveBeenCalledWith(transaction);
  });

  it('should throw error when not connected for operations', async () => {
    (adapter as any)._connected = false;

    await expect(adapter.signTransaction({})).rejects.toThrow('Nightly wallet not connected');
    await expect(adapter.signMessage({ message: 'test', nonce: '123' })).rejects.toThrow('Nightly wallet not connected');
    await expect(adapter.signAndSubmitTransaction({})).rejects.toThrow('Nightly wallet not connected');
  });
});
