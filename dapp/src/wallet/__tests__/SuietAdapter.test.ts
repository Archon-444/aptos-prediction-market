import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SuietAdapter } from '../adapters/sui/SuietAdapter';

describe('SuietAdapter', () => {
  let adapter: SuietAdapter;
  let mockWallet: any;

  beforeEach(() => {
    adapter = new SuietAdapter();
    mockWallet = {
      connected: false,
      account: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      signAndExecuteTransactionBlock: vi.fn(),
      signMessage: vi.fn(),
    };
    vi.clearAllMocks();
  });

  it('should initialize with correct name', () => {
    expect(adapter.name).toBe('Suiet');
    expect(adapter.connected).toBe(false);
    expect(adapter.account).toBeNull();
  });

  it('should detect Suiet installation', async () => {
    const installed = await adapter.isInstalled();
    expect(installed).toBe(true);
  });

  it('should initialize wallet instance', () => {
    adapter.initialize(mockWallet);
    expect((adapter as any).wallet).toBe(mockWallet);
  });

  it('should connect successfully', async () => {
    adapter.initialize(mockWallet);
    mockWallet.connect.mockResolvedValue(undefined);
    mockWallet.connected = true;
    mockWallet.account = { address: '0x1234567890abcdef' };

    const result = await adapter.connect();

    expect(result).toEqual(mockWallet.account);
    expect(mockWallet.connect).toHaveBeenCalled();
  });

  it('should handle connection failure', async () => {
    adapter.initialize(mockWallet);
    mockWallet.connect.mockRejectedValue(new Error('Connection failed'));

    await expect(adapter.connect()).rejects.toThrow('Connection failed');
  });

  it('should throw error when not initialized', async () => {
    await expect(adapter.connect()).rejects.toThrow('Suiet wallet not initialized');
  });

  it('should disconnect successfully', async () => {
    adapter.initialize(mockWallet);
    mockWallet.disconnect.mockResolvedValue(undefined);

    await adapter.disconnect();

    expect(mockWallet.disconnect).toHaveBeenCalled();
  });

  it('should sign and execute transaction block', async () => {
    adapter.initialize(mockWallet);
    mockWallet.connected = true;
    mockWallet.signAndExecuteTransactionBlock.mockResolvedValue({ digest: 'mock-digest' });

    const transactionBlock = { type: 'transaction_block' };
    const result = await adapter.signAndExecuteTransactionBlock(transactionBlock);

    expect(result).toBe('mock-digest');
    expect(mockWallet.signAndExecuteTransactionBlock).toHaveBeenCalledWith({
      transactionBlock,
    });
  });

  it('should sign message', async () => {
    adapter.initialize(mockWallet);
    mockWallet.connected = true;
    mockWallet.signMessage.mockResolvedValue({ signature: 'mock-signature' });

    const message = new Uint8Array([1, 2, 3]);
    const result = await adapter.signMessage(message);

    expect(result.signature).toBe('mock-signature');
    expect(mockWallet.signMessage).toHaveBeenCalledWith({ message });
  });

  it('should throw error when not connected for operations', async () => {
    adapter.initialize(mockWallet);
    mockWallet.connected = false;

    await expect(adapter.signAndExecuteTransactionBlock({})).rejects.toThrow('Suiet wallet not connected');
    await expect(adapter.signMessage(new Uint8Array())).rejects.toThrow('Suiet wallet not connected');
  });

  it('should throw error when not initialized for operations', async () => {
    await expect(adapter.signAndExecuteTransactionBlock({})).rejects.toThrow('Suiet wallet not connected');
    await expect(adapter.signMessage(new Uint8Array())).rejects.toThrow('Suiet wallet not connected');
  });
});
