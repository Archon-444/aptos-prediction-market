import type { SuiEvent } from '@mysten/sui/client';
import { SuiClient } from '@mysten/sui/client';

import { SuiClientAdapter } from '../blockchain/sui/suiClient.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { prisma } from '../database/prismaClient.js';
import { recordSuiEventsProcessed, recordSuiIndexerPoll } from '../monitoring/metrics.js';

const formatLog = (message: string, data?: Record<string, unknown>) =>
  data ? { ...data, msg: message } : { msg: message };

const logInfo = (message: string, data?: Record<string, unknown>) =>
  logger.info(formatLog(message, data));
const logWarn = (message: string, data?: Record<string, unknown>) =>
  logger.warn(formatLog(message, data));
const logError = (message: string, data?: Record<string, unknown>) =>
  logger.error(formatLog(message, data));

type Cursor = { txDigest: string; eventSeq: string };

interface SuiEventIndexerConfig {
  pollInterval: number;
  batchSize: number;
}

export class SuiEventIndexer {
  private readonly client: SuiClient;
  private readonly adapter: SuiClientAdapter;
  private readonly config: SuiEventIndexerConfig;
  private pollTimer?: NodeJS.Timeout;
  private running = false;
  private cursor?: Cursor;
  private consecutiveFailures = 0;

  constructor(config?: Partial<SuiEventIndexerConfig>) {
    const rpcUrl = env.SUI_RPC_URL || 'https://fullnode.testnet.sui.io:443';
    this.client = new SuiClient({ url: rpcUrl });
    this.adapter = new SuiClientAdapter();
    this.config = {
      pollInterval: config?.pollInterval ?? 15_000,
      batchSize: config?.batchSize ?? 25,
    };
  }

  async start(): Promise<void> {
    if (this.running) {
      return;
    }

    if (!env.SUI_PACKAGE_ID) {
      logWarn('[SuiEventIndexer] Skipping start – SUI_PACKAGE_ID not configured');
      return;
    }

    if (env.DISABLE_SUI_INDEXER === 'true') {
      logWarn('[SuiEventIndexer] Disabled via DISABLE_SUI_INDEXER flag');
      return;
    }

    await this.loadCursor();

    this.running = true;
    logInfo('[SuiEventIndexer] Started', {
      pollInterval: this.config.pollInterval,
      batchSize: this.config.batchSize,
      cursor: this.cursor,
    });

    await this.poll();
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = undefined;
    }
    logInfo('[SuiEventIndexer] Stopped');
  }

  private async loadCursor(): Promise<void> {
    const state = await prisma.indexerState.findUnique({
      where: { chain: 'sui' },
    });

    if (!state) {
      await prisma.indexerState.create({
        data: {
          chain: 'sui',
          lastProcessedVersion: BigInt(0),
          isRunning: true,
        },
      });
      return;
    }

    if (state.lastError) {
      try {
        const parsed = JSON.parse(state.lastError) as { cursor?: Cursor };
        if (parsed?.cursor) {
          this.cursor = parsed.cursor;
        }
      } catch (error) {
        logWarn('[SuiEventIndexer] Failed to parse stored cursor', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  private async saveCursor(timestamps: number): Promise<void> {
    await prisma.indexerState.update({
      where: { chain: 'sui' },
      data: {
        lastProcessedVersion: BigInt(timestamps),
        lastProcessedTimestamp: new Date(timestamps),
        isRunning: this.running,
        lastError: JSON.stringify({ cursor: this.cursor }),
      },
    });
  }

  private scheduleNextPoll(options?: { useBackoff?: boolean }): void {
    if (!this.running) return;
    const baseDelay = this.config.pollInterval;
    const maxDelay = 5 * 60 * 1000; // 5 minutes
    const delay = options?.useBackoff
      ? Math.min(baseDelay * Math.pow(2, this.consecutiveFailures), maxDelay)
      : baseDelay;

    this.pollTimer = setTimeout(() => {
      this.poll().catch((error) =>
        logError('[SuiEventIndexer] Poll loop error', {
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      );
    }, delay);
  }

  private async poll(): Promise<void> {
    if (!this.running) return;

    try {
      const response = await this.client.queryEvents({
        query: {
          MoveEventType: `${env.SUI_PACKAGE_ID}::market_manager_v2::MarketCreated`,
        },
        order: 'ascending',
        cursor: this.cursor,
        limit: this.config.batchSize,
      });

      recordSuiIndexerPoll('success');
      this.consecutiveFailures = 0;

      if (response.data.length === 0) {
        this.scheduleNextPoll();
        return;
      }

      recordSuiEventsProcessed('MarketCreated', response.data.length);

      for (const event of response.data) {
        await this.processEvent(event);
        this.cursor = event.id as Cursor;
        const timestamp = Number(event.timestampMs ?? Date.now());
        await this.saveCursor(timestamp);
      }
    } catch (error) {
      recordSuiIndexerPoll('failure');
      logError('[SuiEventIndexer] Failed to fetch Sui events', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      this.consecutiveFailures += 1;

      const message = error instanceof Error ? error.message : '';
      const isRateLimited = message.includes('429') || message.includes('rate limit');
      const isFetchFailed = message.includes('fetch failed');

      if (isRateLimited || isFetchFailed) {
        const delayMs = Math.min(
          this.config.pollInterval * Math.pow(2, this.consecutiveFailures),
          5 * 60 * 1000
        );
        logWarn('[SuiEventIndexer] Applying backoff due to RPC failure', {
          consecutiveFailures: this.consecutiveFailures,
          delayMs,
        });
      }
    } finally {
      this.scheduleNextPoll({ useBackoff: this.consecutiveFailures > 0 });
    }
  }

  private async processEvent(event: SuiEvent): Promise<void> {
    const digest = event.id.txDigest;
    logInfo('[SuiEventIndexer] Processing MarketCreated event', {
      txDigest: digest,
      eventSeq: event.id.eventSeq,
    });

    try {
      await this.adapter.bootstrapMarket({ digest });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes('Unique constraint') // prisma unique violation
      ) {
        logWarn('[SuiEventIndexer] Market already indexed', { txDigest: digest });
        return;
      }

      logError('[SuiEventIndexer] Failed to bootstrap Sui market', {
        txDigest: digest,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

let suiIndexerInstance: SuiEventIndexer | null = null;

export async function startSuiEventIndexer(): Promise<void> {
  if (!suiIndexerInstance) {
    suiIndexerInstance = new SuiEventIndexer();
  }
  await suiIndexerInstance.start();
}

export async function stopSuiEventIndexer(): Promise<void> {
  if (suiIndexerInstance) {
    await suiIndexerInstance.stop();
    suiIndexerInstance = null;
  }
}
