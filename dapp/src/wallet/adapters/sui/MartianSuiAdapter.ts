interface MartianSuiWindow {
  martian?: {
    sui?: {
      connect(): Promise<{ address: string; publicKey: string }>;
      disconnect(): Promise<void>;
      isConnected(): boolean;
      getAccounts(): Promise<string[]>;
      signAndExecuteTransaction(transaction: any): Promise<{ digest: string }>;
      signMessage(message: { message: string }): Promise<{ signature: string }>;
      onAccountChange(callback: (accounts: string[]) => void): void;
      onDisconnect(callback: () => void): void;
    };
  };
}

declare const window: MartianSuiWindow & Window;

export class MartianSuiAdapter {
  private _connecting = false;
  private _connected = false;
  private _account: { address: string; publicKey: string } | null = null;

  get name() {
    return 'Martian';
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

  async isInstalled(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    return !!(window.martian?.sui);
  }

  async connect(): Promise<{ address: string; publicKey: string }> {
    try {
      this._connecting = true;

      const installed = await this.isInstalled();
      if (!installed) {
        throw new Error('Martian wallet is not installed');
      }

      const result = await window.martian!.sui!.connect();

      this._account = result;
      this._connected = true;
      this._connecting = false;

      this.setupListeners();

      console.log('[Martian Sui] Connected:', result.address);
      return result;
    } catch (error: any) {
      this._connecting = false;
      this._connected = false;
      console.error('[Martian Sui] Connection failed:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (window.martian?.sui) {
        await window.martian.sui.disconnect();
      }
      this._account = null;
      this._connected = false;
      console.log('[Martian Sui] Disconnected');
    } catch (error) {
      console.error('[Martian Sui] Disconnect failed:', error);
      this._account = null;
      this._connected = false;
    }
  }

  async signAndExecuteTransaction(transaction: any): Promise<string> {
    if (!this._connected || !window.martian?.sui) {
      throw new Error('Martian wallet not connected');
    }

    try {
      const result = await window.martian.sui.signAndExecuteTransaction(transaction);
      console.log('[Martian Sui] Transaction executed:', result.digest);
      return result.digest;
    } catch (error: any) {
      console.error('[Martian Sui] Execute transaction failed:', error);
      throw error;
    }
  }

  async signMessage(message: string): Promise<string> {
    if (!this._connected || !window.martian?.sui) {
      throw new Error('Martian wallet not connected');
    }

    try {
      const result = await window.martian.sui.signMessage({ message });
      console.log('[Martian Sui] Message signed');
      return result.signature;
    } catch (error: any) {
      console.error('[Martian Sui] Sign message failed:', error);
      throw error;
    }
  }

  private setupListeners(): void {
    if (!window.martian?.sui) return;

    window.martian.sui.onAccountChange((accounts: string[]) => {
      console.log('[Martian Sui] Account changed:', accounts);
      if (accounts.length > 0 && this._account) {
        this._account.address = accounts[0];
      }
    });

    window.martian.sui.onDisconnect(() => {
      console.log('[Martian Sui] Disconnected via event');
      this._account = null;
      this._connected = false;
    });
  }
}

export const martianSuiAdapter = new MartianSuiAdapter();
