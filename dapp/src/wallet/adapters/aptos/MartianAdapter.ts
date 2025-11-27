import { WalletName } from '@aptos-labs/wallet-adapter-react';

interface MartianWindow {
  martian?: {
    aptos?: {
      connect(): Promise<{ address: string; publicKey: string }>;
      disconnect(): Promise<void>;
      isConnected(): boolean;
      account(): Promise<{ address: string; publicKey: string } | null>;
      signTransaction(transaction: any): Promise<any>;
      signMessage(message: { message: string; nonce: string }): Promise<any>;
      signAndSubmitTransaction(transaction: any): Promise<{ hash: string }>;
      onAccountChange(callback: (account: any) => void): void;
      onDisconnect(callback: () => void): void;
      network(): Promise<string>;
    };
  };
}

declare const window: MartianWindow & Window;

export class MartianAptosAdapter {
  private _connecting = false;
  private _connected = false;
  private _account: { address: string; publicKey: string } | null = null;

  get name(): WalletName {
    return 'Martian' as WalletName;
  }

  get connecting(): boolean {
    return this._connecting;
  }

  get connected(): boolean {
    return this._connected;
  }

  get account() {
    return this._account;
  }

  /**
   * Check if Martian is installed
   */
  async isInstalled(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    return !!(window.martian?.aptos);
  }

  /**
   * Connect to Martian wallet
   */
  async connect(): Promise<{ address: string; publicKey: string }> {
    try {
      this._connecting = true;

      // Check if installed
      const installed = await this.isInstalled();
      if (!installed) {
        throw new Error('Martian wallet is not installed. Please install it from the Chrome Web Store.');
      }

      // Connect
      const result = await window.martian!.aptos!.connect();

      this._account = result;
      this._connected = true;
      this._connecting = false;

      // Setup listeners
      this.setupListeners();

      console.log('[Martian] Connected:', result.address);
      return result;
    } catch (error: any) {
      this._connecting = false;
      this._connected = false;
      console.error('[Martian] Connection failed:', error);
      throw error;
    }
  }

  /**
   * Disconnect from Martian
   */
  async disconnect(): Promise<void> {
    try {
      if (window.martian?.aptos) {
        await window.martian.aptos.disconnect();
      }
      this._account = null;
      this._connected = false;
      console.log('[Martian] Disconnected');
    } catch (error) {
      console.error('[Martian] Disconnect failed:', error);
      // Still update state even if API call fails
      this._account = null;
      this._connected = false;
    }
  }

  /**
   * Sign a transaction
   */
  async signTransaction(transaction: any): Promise<any> {
    if (!this._connected || !window.martian?.aptos) {
      throw new Error('Martian wallet not connected');
    }

    try {
      const signed = await window.martian.aptos.signTransaction(transaction);
      console.log('[Martian] Transaction signed');
      return signed;
    } catch (error: any) {
      console.error('[Martian] Sign transaction failed:', error);
      throw error;
    }
  }

  /**
   * Sign a message
   */
  async signMessage(message: string): Promise<any> {
    if (!this._connected || !window.martian?.aptos) {
      throw new Error('Martian wallet not connected');
    }

    try {
      const result = await window.martian.aptos.signMessage({
        message,
        nonce: Date.now().toString(),
      });
      console.log('[Martian] Message signed');
      return result;
    } catch (error: any) {
      console.error('[Martian] Sign message failed:', error);
      throw error;
    }
  }

  /**
   * Sign and submit a transaction
   */
  async signAndSubmitTransaction(transaction: any): Promise<string> {
    if (!this._connected || !window.martian?.aptos) {
      throw new Error('Martian wallet not connected');
    }

    try {
      const result = await window.martian.aptos.signAndSubmitTransaction(transaction);
      console.log('[Martian] Transaction submitted:', result.hash);
      return result.hash;
    } catch (error: any) {
      console.error('[Martian] Submit transaction failed:', error);
      throw error;
    }
  }

  /**
   * Get current network
   */
  async getNetwork(): Promise<string> {
    if (!window.martian?.aptos) {
      throw new Error('Martian wallet not available');
    }

    try {
      return await window.martian.aptos.network();
    } catch (error) {
      console.error('[Martian] Get network failed:', error);
      return 'mainnet';
    }
  }

  /**
   * Setup event listeners
   */
  private setupListeners(): void {
    if (!window.martian?.aptos) return;

    // Account changed
    window.martian.aptos.onAccountChange((newAccount: any) => {
      console.log('[Martian] Account changed:', newAccount);
      this._account = newAccount;
    });

    // Disconnected
    window.martian.aptos.onDisconnect(() => {
      console.log('[Martian] Disconnected via event');
      this._account = null;
      this._connected = false;
    });
  }
}

// Export singleton instance
export const martianAptosAdapter = new MartianAptosAdapter();
