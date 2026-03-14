import { Web3Wallet } from '@walletconnect/web3wallet';
import { WalletConnectModal } from '@walletconnect/modal';

interface WalletConnectConfig {
  projectId: string; // Get from https://cloud.walletconnect.com
  chains: string[];
  metadata: {
    name: string;
    description: string;
    url: string;
    icons: string[];
  };
}

export class WalletConnectAdapter {
  private web3wallet: InstanceType<typeof Web3Wallet> | null = null;
  private modal: WalletConnectModal | null = null;
  private config: WalletConnectConfig;
  private _connected = false;
  private _session: any = null;

  constructor(config: WalletConnectConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    try {
      // Initialize Web3Wallet
      // @ts-ignore - Web3Wallet.init options changed; projectId is now passed via core
      this.web3wallet = await Web3Wallet.init({
        core: { projectId: this.config.projectId } as any,
        metadata: this.config.metadata,
      });

      // Initialize modal
      this.modal = new WalletConnectModal({
        projectId: this.config.projectId,
        chains: this.config.chains,
      });

      console.log('[WalletConnect] Initialized');
    } catch (error) {
      console.error('[WalletConnect] Initialization failed:', error);
      throw error;
    }
  }

  async connect(): Promise<{ address: string }> {
    if (!this.web3wallet || !this.modal) {
      throw new Error('WalletConnect not initialized');
    }

    try {
      // Open modal for QR code
      const { uri, approval } = await (this.web3wallet as any).connect({
        requiredNamespaces: {
          aptos: {
            methods: ['aptos_signTransaction', 'aptos_signMessage'],
            chains: this.config.chains,
            events: [],
          },
        },
      });

      if (uri) {
        await this.modal.openModal({ uri });
      }

      // Wait for approval
      this._session = await approval();
      this._connected = true;

      this.modal.closeModal();

      const address = this._session.namespaces.aptos.accounts[0].split(':')[2];

      console.log('[WalletConnect] Connected:', address);
      return { address };
    } catch (error: any) {
      console.error('[WalletConnect] Connection failed:', error);
      this.modal?.closeModal();
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.web3wallet || !this._session) return;

    try {
      await this.web3wallet.disconnectSession({
        topic: this._session.topic,
        reason: {
          code: 6000,
          message: 'User disconnected',
        },
      });

      this._connected = false;
      this._session = null;

      console.log('[WalletConnect] Disconnected');
    } catch (error) {
      console.error('[WalletConnect] Disconnect failed:', error);
      this._connected = false;
      this._session = null;
    }
  }

  get connected(): boolean {
    return this._connected;
  }

  get session() {
    return this._session;
  }

  async signTransaction(transaction: any): Promise<any> {
    if (!this.web3wallet || !this._session) {
      throw new Error('WalletConnect not connected');
    }

    try {
      const result = await (this.web3wallet as any).request({
        topic: this._session.topic,
        chainId: this.config.chains[0],
        request: {
          method: 'aptos_signTransaction',
          params: { transaction },
        },
      });

      console.log('[WalletConnect] Transaction signed');
      return result;
    } catch (error: any) {
      console.error('[WalletConnect] Sign transaction failed:', error);
      throw error;
    }
  }
}

// Configuration
export const walletConnectConfig: WalletConnectConfig = {
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '',
  chains: ['aptos:1'], // Aptos mainnet
  metadata: {
    name: 'Move Market',
    description: 'Decentralized prediction market',
    url: 'https://yourapp.com',
    icons: ['https://yourapp.com/logo.png'],
  },
};
