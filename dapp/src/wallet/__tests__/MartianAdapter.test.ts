import { describe, it, expect, beforeEach, vi } from 'vitest';
import { martianAptosAdapter } from '../adapters/aptos/MartianAdapter';

describe('MartianAptosAdapter', () => {
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Mock successful responses
    (window.martian.aptos.connect as any).mockResolvedValue({
      address: '0x1234567890abcdef',
      publicKey: 'mock-public-key',
    });
    
    (window.martian.aptos.disconnect as any).mockResolvedValue(undefined);
    (window.martian.aptos.isConnected as any).mockReturnValue(true);
    (window.martian.aptos.network as any).mockResolvedValue('testnet');
    (window.martian.aptos.signTransaction as any).mockResolvedValue({
      signature: 'mock-signature',
    });
    (window.martian.aptos.signAndSubmitTransaction as any).mockResolvedValue({
      hash: 'mock-tx-hash',
    });
  });

  it('should detect Martian installation', async () => {
    const installed = await martianAptosAdapter.isInstalled();
    expect(installed).toBe(true);
  });

  it('should connect to Martian', async () => {
    const account = await martianAptosAdapter.connect();

    expect(account).toBeDefined();
    expect(account.address).toBe('0x1234567890abcdef');
    expect(martianAptosAdapter.connected).toBe(true);
    expect(window.martian.aptos.connect).toHaveBeenCalled();
  });

  it('should handle connection failure', async () => {
    (window.martian.aptos.connect as any).mockRejectedValue(new Error('Connection failed'));

    await expect(martianAptosAdapter.connect()).rejects.toThrow('Connection failed');
    expect(martianAptosAdapter.connected).toBe(false);
  });

  it('should sign transaction', async () => {
    await martianAptosAdapter.connect();

    const transaction = { type: 'entry_function_payload' };
    const signed = await martianAptosAdapter.signTransaction(transaction);

    expect(signed.signature).toBe('mock-signature');
    expect(window.martian.aptos.signTransaction).toHaveBeenCalledWith(transaction);
  });

  it('should sign message', async () => {
    await martianAptosAdapter.connect();

    const message = 'test message';
    const result = await martianAptosAdapter.signMessage(message);

    expect(result).toBeDefined();
    expect(window.martian.aptos.signMessage).toHaveBeenCalledWith({
      message,
      nonce: expect.any(String),
    });
  });

  it('should sign and submit transaction', async () => {
    await martianAptosAdapter.connect();

    const transaction = { type: 'entry_function_payload' };
    const hash = await martianAptosAdapter.signAndSubmitTransaction(transaction);

    expect(hash).toBe('mock-tx-hash');
    expect(window.martian.aptos.signAndSubmitTransaction).toHaveBeenCalledWith(transaction);
  });

  it('should disconnect', async () => {
    await martianAptosAdapter.connect();
    await martianAptosAdapter.disconnect();

    expect(martianAptosAdapter.connected).toBe(false);
    expect(martianAptosAdapter.account).toBeNull();
    expect(window.martian.aptos.disconnect).toHaveBeenCalled();
  });

  it('should get network', async () => {
    const network = await martianAptosAdapter.getNetwork();
    expect(network).toBe('testnet');
    expect(window.martian.aptos.network).toHaveBeenCalled();
  });

  it('should throw error when not connected for operations', async () => {
    await expect(martianAptosAdapter.signTransaction({})).rejects.toThrow('Martian wallet not connected');
    await expect(martianAptosAdapter.signMessage('test')).rejects.toThrow('Martian wallet not connected');
    await expect(martianAptosAdapter.signAndSubmitTransaction({})).rejects.toThrow('Martian wallet not connected');
  });
});
