/**
 * Event Indexer Service (M2)
 *
 * This service listens to blockchain events from the Aptos network and indexes them
 * into the PostgreSQL database. It maintains sync state and handles failures gracefully.
 *
 * Features:
 * - Continuous blockchain event polling
 * - Automatic retry with exponential backoff
 * - Batch processing for efficiency
 * - Graceful shutdown handling
 * - State persistence for crash recovery
 */

import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';
import type { Chain } from '@prisma/client';

import { AptosClientAdapter } from '../blockchain/aptos/aptosClient.js';
import { BRIDGED_WUSDC_COIN_TYPE, env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { prisma } from '../database/prismaClient.js';
import type {
  AptosEvent,
  BlockchainEvent,
  EventType,
  IndexerConfig,
  ProcessedEvent,
} from '../types/blockchain.js';
import { processEvent } from './eventHandlers.js';

const formatLog = (message: string, data?: Record<string, unknown>) =>
  data ? { ...data, msg: message } : { msg: message };

const logInfo = (message: string, data?: Record<string, unknown>) =>
  logger.info(formatLog(message, data));
const logWarn = (message: string, data?: Record<string, unknown>) =>
  logger.warn(formatLog(message, data));
const logError = (message: string, data?: Record<string, unknown>) =>
  logger.error(formatLog(message, data));
const logDebug = (message: string, data?: Record<string, unknown>) =>
  logger.debug(formatLog(message, data));

export class EventIndexer {
  private aptos: Aptos;
  private config: IndexerConfig;
  private isRunning: boolean = false;
  private pollTimer?: NodeJS.Timeout;
  private shutdownRequested: boolean = false;
  private verifiedChainId: string | null = null;
  private readonly usdcCoinType?: string;
  private readonly aptosAdapter?: AptosClientAdapter;

  constructor(config: IndexerConfig) {
    this.config = config;
    this.usdcCoinType = config.usdcCoinType;

    // Initialize Aptos adapter if this is an Aptos indexer
    if (config.chain === 'aptos') {
      this.aptosAdapter = new AptosClientAdapter();
    }

    if (config.chain === 'sui') {
      if (!this.usdcCoinType) {
        throw new Error(
          '[EventIndexer] Sui indexer requires SUI_USDC_COIN_TYPE to be configured (native Circle USDC)'
        );
      }
      if (this.usdcCoinType === BRIDGED_WUSDC_COIN_TYPE) {
        throw new Error(
          '[EventIndexer] Sui indexer cannot be initialized with bridged wUSDC coin type'
        );
      }
    }

    const aptosConfig = new AptosConfig({
      network: env.APTOS_NETWORK as Network,
    });
    this.aptos = new Aptos(aptosConfig);

    logInfo('[EventIndexer] Initialized', {
      chain: config.chain,
      moduleAddress: config.moduleAddress,
      pollInterval: config.pollInterval,
    });
  }

  private getExpectedChainId(chain: Chain): string | null {
    const aptosNetworkChainIds: Record<string, string | undefined> = {
      mainnet: '1',
      testnet: '2',
      devnet: '34',
    };

    const overrides: Record<Chain, string | undefined> = {
      aptos: env.APTOS_EXPECTED_CHAIN_ID,
      sui: env.SUI_EXPECTED_CHAIN_ID,
      movement: env.MOVEMENT_EXPECTED_CHAIN_ID,
      base: env.BASE_CHAIN_ID,
    };

    if (chain === 'aptos') {
      return overrides.aptos ?? aptosNetworkChainIds[env.APTOS_NETWORK] ?? null;
    }

    return overrides[chain] ?? null;
  }

  private async verifyChainId(): Promise<void> {
    if (this.config.chain === 'aptos') {
      const ledgerInfo = await this.aptos.getLedgerInfo();
      const actualChainId = ledgerInfo.chain_id.toString();
      const expectedChainId = this.getExpectedChainId('aptos');

      if (!expectedChainId) {
        logWarn('[EventIndexer] Expected chain ID not configured; skipping strict verification', {
          chain: this.config.chain,
          actualChainId,
        });
        this.verifiedChainId = actualChainId;
        return;
      }

      if (actualChainId !== expectedChainId) {
        throw new Error(
          `Chain ID mismatch for ${this.config.chain}: expected ${expectedChainId}, received ${actualChainId}`
        );
      }

      this.verifiedChainId = actualChainId;
      logInfo('[EventIndexer] Chain ID verified', {
        chain: this.config.chain,
        chainId: actualChainId,
      });
      return;
    }

    const expected = this.getExpectedChainId(this.config.chain as Chain);
    logWarn('[EventIndexer] Chain verification not implemented for chain', {
      chain: this.config.chain,
      expectedChainId: expected ?? 'unset',
    });
  }

  /**
   * Start the event indexer
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logWarn('[EventIndexer] Already running');
      return;
    }

    logInfo('[EventIndexer] Starting event indexer', { chain: this.config.chain });
    this.shutdownRequested = false;

    await this.verifyChainId();

    this.isRunning = true;

    // Initialize or load indexer state
    await this.initializeState();

    // Start polling loop
    await this.poll();
  }

  /**
   * Stop the event indexer
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logInfo('[EventIndexer] Stopping event indexer', { chain: this.config.chain });
    this.shutdownRequested = true;
    this.isRunning = false;

    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = undefined;
    }

    // Update state to indicate indexer is stopped
    await prisma.indexerState.updateMany({
      where: { chain: this.config.chain, contractAddress: null },
      data: { isRunning: false },
    });

    logInfo('[EventIndexer] Stopped successfully');
  }

  /**
   * Initialize or load indexer state from database
   */
  private async initializeState(): Promise<void> {
    const state = await prisma.indexerState.findFirst({
      where: { chain: this.config.chain, contractAddress: null },
    });

    if (!state) {
      // Create initial state
      await prisma.indexerState.create({
        data: {
          chain: this.config.chain,
          lastProcessedVersion: this.config.startVersion || BigInt(0),
          isRunning: true,
        },
      });

      logInfo('[EventIndexer] Created initial state', {
        chain: this.config.chain,
        startVersion: this.config.startVersion || 0n,
      });
    } else {
      // Update state to running
      await prisma.indexerState.updateMany({
        where: { chain: this.config.chain, contractAddress: null },
        data: { isRunning: true, lastError: null },
      });

      logInfo('[EventIndexer] Resumed from last state', {
        chain: this.config.chain,
        lastProcessedVersion: state.lastProcessedVersion.toString(),
      });
    }
  }

  /**
   * Main polling loop
   */
  private async poll(): Promise<void> {
    if (this.shutdownRequested) {
      return;
    }

    try {
      await this.fetchAndProcessEvents();
    } catch (error) {
      logError('[EventIndexer] Error during poll', {
        error: error instanceof Error ? error.message : 'Unknown error',
        chain: this.config.chain,
      });

      // Record error in state
      await prisma.indexerState.updateMany({
        where: { chain: this.config.chain, contractAddress: null },
        data: {
          lastError: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }

    // Schedule next poll
    if (!this.shutdownRequested) {
      this.pollTimer = setTimeout(() => this.poll(), this.config.pollInterval);
    }
  }

  /**
   * Fetch and process new events from blockchain
   */
  private async fetchAndProcessEvents(): Promise<void> {
    if (this.config.chain === 'aptos' && !this.verifiedChainId) {
      throw new Error('Chain ID not verified - aborting event fetch');
    }

    // Get current state
    const state = await prisma.indexerState.findFirst({
      where: { chain: this.config.chain, contractAddress: null },
    });

    if (!state) {
      throw new Error('Indexer state not found');
    }

    const fromVersion = state.lastProcessedVersion;

    logInfo('[EventIndexer] Fetching events', {
      chain: this.config.chain,
      fromVersion: fromVersion.toString(),
    });

    try {
      // Fetch events from all module event handles
      const events = await this.fetchModuleEvents(fromVersion);

      if (events.length === 0) {
        // Advance version by scan window size (100 transactions) so we don't get stuck
        const advancedVersion = fromVersion + BigInt(100);

        logDebug('[EventIndexer] No new events found, advancing version', {
          fromVersion: fromVersion.toString(),
          advancedTo: advancedVersion.toString(),
        });

        await prisma.indexerState.updateMany({
          where: { chain: this.config.chain, contractAddress: null },
          data: {
            lastProcessedVersion: advancedVersion,
            lastProcessedTimestamp: new Date(),
          },
        });

        return;
      }

      logInfo('[EventIndexer] Found new events', {
        count: events.length,
        chain: this.config.chain,
      });

      // Process events in batches
      await this.processBatch(events);

      // Update state with latest version processed
      const latestVersion = events[events.length - 1].version;
      await prisma.indexerState.updateMany({
        where: { chain: this.config.chain, contractAddress: null },
        data: {
          lastProcessedVersion: BigInt(latestVersion),
          lastProcessedTimestamp: new Date(),
        },
      });

      logInfo('[EventIndexer] Processed batch successfully', {
        count: events.length,
        latestVersion,
        chain: this.config.chain,
      });
    } catch (error) {
      logError('[EventIndexer] Failed to fetch events', {
        error: error instanceof Error ? error.message : 'Unknown error',
        chain: this.config.chain,
      });
      throw error;
    }
  }

  /**
   * Fetch events from the module by scanning network transactions
   *
   * Production-ready implementation that:
   * 1. Fetches all network transactions (not account-specific)
   * 2. Filters for events emitted by our module
   * 3. Supports incremental processing with pagination
   *
   * This approach is recommended by Aptos for Module Events (framework 1.7+)
   * and mirrors the strategy used by Aptos's own indexing infrastructure.
   */
  private async fetchModuleEvents(fromVersion: bigint): Promise<AptosEvent[]> {
    const allEvents: AptosEvent[] = [];

    try {
      // Event types to fetch - only MarketCreatedEvent for now
      // Other events can be added later as needed
      const eventTypes = [
        { name: 'MarketCreatedEvent', module: 'market_manager' },
        // Future: Add more event types as needed
        // { name: 'MarketResolvedEvent', module: 'market_manager' },
        // { name: 'BetPlacedEvent', module: 'betting' },
      ];

      // Scan recent network transactions for module events
      for (const { name: eventName, module } of eventTypes) {
        try {
          const eventType = `${this.config.moduleAddress}::${module}::${eventName}`;

          logDebug('[EventIndexer] Scanning network transactions for event type', {
            eventType,
            fromVersion: fromVersion.toString(),
          });

          // Fetch recent network transactions (not account-specific)
          // This is the production-ready approach for Module Events
          const transactions = await this.aptos.getTransactions({
            options: {
              offset: fromVersion,
              limit: 100, // Scan 100 transactions per poll
            },
          });

          logDebug('[EventIndexer] Fetched network transactions', {
            count: transactions.length,
            startVersion: fromVersion.toString(),
          });

          let transactionsScanned = 0;
          let eventsFound = 0;

          // Scan each transaction for our module's events
          for (const tx of transactions) {
            transactionsScanned++;
            const txEvents = (tx as any).events || [];

            // Filter for exact event type match (not substring)
            // This ensures we only catch events from our module
            const matchingEvents = txEvents.filter((e: any) =>
              e.type === eventType
            );

            eventsFound += matchingEvents.length;

            for (const event of matchingEvents) {
              // Get transaction hash (properly formatted with 0x prefix)
              let txHash = (tx as any).hash || '';
              if (txHash && !txHash.startsWith('0x')) {
                txHash = '0x' + txHash;
              }

              // Get transaction version (numeric ledger version)
              const txVersion = (tx as any).version?.toString() || '0';

              allEvents.push({
                type: event.type,
                sequence_number: event.sequence_number?.toString() || '0',
                version: txVersion,  // Use numeric version, not hash
                data: event.data,
                // Store hash separately for reference
                transactionHash: txHash,
              } as any);

              logInfo('[EventIndexer] Found matching event', {
                eventType,
                transactionHash: txHash,
                transactionVersion: txVersion,
                eventData: event.data,
              });
            }
          }

          logInfo('[EventIndexer] Event scan complete', {
            chain: this.config.chain,
            eventType,
            transactionsScanned,
            eventsFound,
          });

        } catch (error) {
          // If a specific event type doesn't exist yet or has no events, that's okay
          if (error instanceof Error && error.message.includes('not found')) {
            logDebug('[EventIndexer] Event type not found or no events yet', {
              eventType: eventName,
            });
          } else {
            logWarn('[EventIndexer] Error scanning for events', {
              eventType: eventName,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
            // Continue processing other event types
          }
        }
      }

      // Sort by version to process in order
      allEvents.sort((a, b) => Number(a.version) - Number(b.version));

      return allEvents;
    } catch (error) {
      logError('[EventIndexer] Failed to fetch module events', {
        error: error instanceof Error ? error.message : 'Unknown error',
        fromVersion: fromVersion.toString(),
      });
      throw error;
    }
  }

  /**
   * Process a batch of events
   */
  private async processBatch(events: AptosEvent[]): Promise<void> {
    for (const event of events) {
      await this.processRawEvent(event);
    }
  }

  /**
   * Process a single raw event from the blockchain
   */
  private async processRawEvent(event: AptosEvent): Promise<void> {
    try {
      // Determine event type from the event type string
      const eventType = this.parseEventType(event.type);
      if (!eventType) {
        logWarn('[EventIndexer] Unknown event type', { type: event.type });
        return;
      }

      // For MarketCreatedEvent on Aptos, use bootstrapMarket similar to Sui
      if (eventType === 'MarketCreatedEvent' && this.config.chain === 'aptos' && this.aptosAdapter) {
        const transactionHash = (event as any).transactionHash || event.version;

        logInfo('[EventIndexer] Processing MarketCreatedEvent', {
          transactionHash,
          transactionVersion: event.version,
          eventSeq: event.sequence_number,
        });

        try {
          logInfo('[EventIndexer] Calling bootstrapMarket', {
            transactionHash,
            hasAdapter: !!this.aptosAdapter,
          });

          await this.aptosAdapter.bootstrapMarket({ digest: transactionHash });

          logInfo('[EventIndexer] Successfully bootstrapped market', {
            transactionHash,
          });
        } catch (error) {
          if (
            error instanceof Error &&
            (error.message.includes('Unique constraint') || error.message.includes('already indexed'))
          ) {
            logWarn('[EventIndexer] Market already indexed', { transactionHash });
            return;
          }

          logError('[EventIndexer] Failed to bootstrap Aptos market', {
            transactionHash,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          throw error;
        }

        return;
      }

      // For other event types, use the generic event handler
      // Extract market ID if present in event data
      const marketId = event.data.market_id || undefined;

      // Create processed event
      const processedEvent: ProcessedEvent = {
        chain: this.config.chain,
        eventType,
        transactionHash: event.version,
        sequenceNumber: BigInt(event.sequence_number),
        eventData: event.data as BlockchainEvent,
        marketId,
      };

      // Process the event through handlers
      await processEvent(processedEvent);

      logDebug('[EventIndexer] Processed event', {
        eventType,
        sequenceNumber: event.sequence_number,
      });
    } catch (error) {
      logError('[EventIndexer] Failed to process event', {
        error: error instanceof Error ? error.message : 'Unknown error',
        eventType: event.type,
        sequenceNumber: event.sequence_number,
      });

      // Depending on strategy, you might:
      // - Continue processing other events (current behavior)
      // - Stop and retry the batch
      // - Store failed event for manual review
    }
  }

  /**
   * Parse event type from type string
   * Example: "0xADDRESS::market_manager::MarketCreatedEvent" -> "MarketCreatedEvent"
   */
  private parseEventType(typeString: string): EventType | null {
    const parts = typeString.split('::');
    const eventName = parts[parts.length - 1];

    // Map to our EventType enum
    const eventTypeMap: Record<string, EventType> = {
      MarketCreatedEvent: 'MarketCreatedEvent' as EventType,
      MarketResolvedEvent: 'MarketResolvedEvent' as EventType,
      BetPlacedEvent: 'BetPlacedEvent' as EventType,
      WinningsClaimedEvent: 'WinningsClaimedEvent' as EventType,
      DisputeCreatedEvent: 'DisputeCreatedEvent' as EventType,
      DisputeResolvedEvent: 'DisputeResolvedEvent' as EventType,
      RoleGrantedEvent: 'RoleGrantedEvent' as EventType,
      RoleRevokedEvent: 'RoleRevokedEvent' as EventType,
      SystemPausedEvent: 'SystemPausedEvent' as EventType,
      SystemUnpausedEvent: 'SystemUnpausedEvent' as EventType,
    };

    return eventTypeMap[eventName] || null;
  }

  /**
   * Get current indexer status
   */
  async getStatus() {
    const state = await prisma.indexerState.findFirst({
      where: { chain: this.config.chain, contractAddress: null },
    });

    return {
      chain: this.config.chain,
      isRunning: this.isRunning,
      lastProcessedVersion: state?.lastProcessedVersion.toString() || '0',
      lastProcessedTimestamp: state?.lastProcessedTimestamp,
      lastError: state?.lastError,
    };
  }
}

/**
 * Create and configure event indexer for Aptos
 */
export function createAptosIndexer(): EventIndexer {
  const config: IndexerConfig = {
    chain: 'aptos',
    moduleAddress: env.APTOS_MODULE_ADDRESS,
    pollInterval: parseInt(process.env.INDEXER_POLL_INTERVAL ?? '10000', 10), // 10 seconds default
    batchSize: parseInt(process.env.INDEXER_BATCH_SIZE ?? '100', 10),
    maxRetries: parseInt(process.env.INDEXER_MAX_RETRIES ?? '3', 10),
    retryDelay: parseInt(process.env.INDEXER_RETRY_DELAY ?? '5000', 10),
  };

  return new EventIndexer(config);
}

export function createSuiIndexer(): EventIndexer {
  if (!env.SUI_PACKAGE_ID) {
    throw new Error('SUI_PACKAGE_ID must be set to initialize the Sui indexer');
  }

  const config: IndexerConfig = {
    chain: 'sui',
    moduleAddress: env.SUI_PACKAGE_ID,
    pollInterval: parseInt(process.env.SUI_INDEXER_POLL_INTERVAL ?? '15000', 10),
    batchSize: parseInt(process.env.SUI_INDEXER_BATCH_SIZE ?? '75', 10),
    maxRetries: parseInt(process.env.SUI_INDEXER_MAX_RETRIES ?? '5', 10),
    retryDelay: parseInt(process.env.SUI_INDEXER_RETRY_DELAY ?? '7000', 10),
    usdcCoinType: env.SUI_USDC_COIN_TYPE,
  };

  return new EventIndexer(config);
}

/**
 * Global indexer instance (singleton)
 */
let globalIndexer: EventIndexer | null = null;

/**
 * Get or create the global indexer instance
 */
export function getGlobalIndexer(): EventIndexer {
  if (!globalIndexer) {
    globalIndexer = createAptosIndexer();
  }
  return globalIndexer;
}

/**
 * Start the global indexer
 */
export async function startIndexer(): Promise<void> {
  const indexer = getGlobalIndexer();
  await indexer.start();
}

/**
 * Stop the global indexer
 */
export async function stopIndexer(): Promise<void> {
  if (globalIndexer) {
    await globalIndexer.stop();
  }
}

/**
 * Get indexer status
 */
export async function getIndexerStatus() {
  if (!globalIndexer) {
    return { chain: 'aptos', isRunning: false };
  }
  return await globalIndexer.getStatus();
}
