/**
 * Enhanced Suiet adapter
 * Works with @suiet/wallet-kit integration
 */
export class SuietAdapter {
  private wallet: any = null;

  get name() {
    return 'Suiet';
  }

  get connected(): boolean {
    return this.wallet?.connected ?? false;
  }

  get account() {
    return this.wallet?.account ?? null;
  }

  /**
   * Initialize with Suiet wallet instance from hook
   */
  initialize(walletInstance: any): void {
    this.wallet = walletInstance;
  }

  async isInstalled(): Promise<boolean> {
    if (typeof window === 'undefined') return false;
    return !!(window as any).suiWallet;
  }

  async connect(): Promise<any> {
    if (!this.wallet) {
      throw new Error('Suiet wallet not initialized. Use within SuietProvider.');
    }

    try {
      await this.wallet.connect();
      console.log('[Suiet] Connected:', this.account);
      return this.account;
    } catch (error: any) {
      console.error('[Suiet] Connection failed:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.wallet) return;

    try {
      await this.wallet.disconnect();
      console.log('[Suiet] Disconnected');
    } catch (error) {
      console.error('[Suiet] Disconnect failed:', error);
    }
  }

  async signAndExecuteTransactionBlock(transactionBlock: any): Promise<string> {
    if (!this.wallet || !this.connected) {
      throw new Error('Suiet wallet not connected');
    }

    try {
      const result = await this.wallet.signAndExecuteTransactionBlock({
        transactionBlock,
      });
      console.log('[Suiet] Transaction executed:', result.digest);
      return result.digest;
    } catch (error: any) {
      console.error('[Suiet] Execute transaction failed:', error);
      throw error;
    }
  }

  async signMessage(message: Uint8Array): Promise<any> {
    if (!this.wallet || !this.connected) {
      throw new Error('Suiet wallet not connected');
    }

    try {
      const signed = await this.wallet.signMessage({ message });
      console.log('[Suiet] Message signed');
      return signed;
    } catch (error: any) {
      console.error('[Suiet] Sign message failed:', error);
      throw error;
    }
  }
}

export const suietAdapter = new SuietAdapter();
