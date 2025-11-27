import { logger } from '../config/logger.js';
import { AptosClientAdapter } from './aptos/aptosClient.js';
import type { IBlockchainClient } from './IBlockchainClient.js';
import { SuiClientAdapter } from './sui/suiClient.js';

export class ChainRouter {
  private readonly clients = new Map<string, IBlockchainClient>();
  private readonly initializedChains = new Set<string>();

  constructor() {
    // Lazy initialization - clients created on first access
    // This allows the backend to start even if some chain configs are missing
  }

  /**
   * Initialize a blockchain client for the specified chain
   * @param chain - Chain identifier ('aptos' or 'sui')
   * @throws Error if chain is unsupported or initialization fails
   */
  private initializeClient(chain: string): void {
    if (this.initializedChains.has(chain)) {
      return; // Already initialized
    }

    try {
      let client: IBlockchainClient;

      switch (chain) {
        case 'aptos':
          client = new AptosClientAdapter();
          logger.info('Aptos blockchain client initialized');
          break;

        case 'sui':
          client = new SuiClientAdapter();
          logger.info('Sui blockchain client initialized');
          break;

        default:
          throw new Error(`Unsupported chain: ${chain}`);
      }

      this.clients.set(chain, client);
      this.initializedChains.add(chain);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ chain, error: errorMessage }, `Failed to initialize ${chain} client`);
      throw new Error(`Failed to initialize ${chain} blockchain client: ${errorMessage}`);
    }
  }

  /**
   * Get blockchain client for the specified chain
   * Initializes the client on first access (lazy initialization)
   * @param chain - Chain identifier ('aptos' or 'sui')
   * @returns Blockchain client instance
   * @throws Error if chain is unsupported or client initialization fails
   */
  getClient(chain: string): IBlockchainClient {
    // Initialize client if not already initialized
    if (!this.clients.has(chain)) {
      this.initializeClient(chain);
    }

    const client = this.clients.get(chain);
    if (!client) {
      throw new Error(`Failed to get client for chain: ${chain}`);
    }

    return client;
  }

  /**
   * Check if a chain client is available without initializing it
   * @param chain - Chain identifier
   * @returns true if client is initialized and available
   */
  isChainAvailable(chain: string): boolean {
    return this.initializedChains.has(chain);
  }

  /**
   * Get list of all initialized chains
   * @returns Array of chain identifiers
   */
  getInitializedChains(): string[] {
    return Array.from(this.initializedChains);
  }
}

const globalChainRouter = new ChainRouter();

export const getBlockchainClient = (chain: string) => globalChainRouter.getClient(chain);

export { globalChainRouter };
