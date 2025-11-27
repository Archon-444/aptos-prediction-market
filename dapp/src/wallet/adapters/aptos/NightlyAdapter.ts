import { NightlyConnectAdapter } from '@nightlylabs/aptos-wallet-adapter-plugin';

export class NightlyAptosAdapter {
  private adapter: NightlyConnectAdapter | null = null;
  private _connecting = false;
  private _connected = false;

  constructor() {
    this.initializeAdapter();
  }

  private initializeAdapter(): void {
    try {
      this.adapter = new NightlyConnectAdapter({
        appMetadata: {
          name: 'Move Market',
          description: 'Decentralized prediction market on Aptos',
          icon: 'https://yourapp.com/logo.png',
        },
        network: 'Testnet', // or 'Mainnet'
      });
    } catch (error) {
      console.error('[Nightly] Failed to initialize adapter:', error);
    }
  }

  get name() {
    return 'Nightly';
  }

  get connecting(): boolean {
    return this._connecting;
  }

  get connected(): boolean {
    return this._connected;
  }

  get account() {
    return this.adapter?.publicAccount ?? null;
  }

  async isInstalled(): Promise<boolean> {
    // Nightly Connect works even without extension (uses QR code)
    return true;
  }

  async connect(): Promise<any> {
    if (!this.adapter) {
      throw new Error('Nightly adapter not initialized');
    }

    try {
      this._connecting = true;

      await this.adapter.connect();

      this._connected = this.adapter.connected;
      this._connecting = false;

      console.log('[Nightly] Connected:', this.account?.address);
      return this.account;
    } catch (error: any) {
      this._connecting = false;
      this._connected = false;
      console.error('[Nightly] Connection failed:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.adapter) return;

    try {
      await this.adapter.disconnect();
      this._connected = false;
      console.log('[Nightly] Disconnected');
    } catch (error) {
      console.error('[Nightly] Disconnect failed:', error);
      this._connected = false;
    }
  }

  async signTransaction(transaction: any): Promise<any> {
    if (!this.adapter || !this._connected) {
      throw new Error('Nightly wallet not connected');
    }

    try {
      const signed = await this.adapter.signTransaction(transaction);
      console.log('[Nightly] Transaction signed');
      return signed;
    } catch (error: any) {
      console.error('[Nightly] Sign transaction failed:', error);
      throw error;
    }
  }

  async signMessage(message: { message: string; nonce: string }): Promise<any> {
    if (!this.adapter || !this._connected) {
      throw new Error('Nightly wallet not connected');
    }

    try {
      const signed = await this.adapter.signMessage(message);
      console.log('[Nightly] Message signed');
      return signed;
    } catch (error: any) {
      console.error('[Nightly] Sign message failed:', error);
      throw error;
    }
  }

  async signAndSubmitTransaction(transaction: any): Promise<string> {
    if (!this.adapter || !this._connected) {
      throw new Error('Nightly wallet not connected');
    }

    try {
      const result = await this.adapter.signAndSubmitTransaction(transaction);
      console.log('[Nightly] Transaction submitted:', result.hash);
      return result.hash;
    } catch (error: any) {
      console.error('[Nightly] Submit transaction failed:', error);
      throw error;
    }
  }
}

export const nightlyAptosAdapter = new NightlyAptosAdapter();
