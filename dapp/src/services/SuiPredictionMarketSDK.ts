import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import type { IBlockchainAdapter, Market, TransactionResult, UserPosition } from './IBlockchainAdapter';
import env from '../config/env';

type NetworkName = 'devnet' | 'testnet' | 'mainnet';

/**
 * Sui implementation of the multi-chain adapter. Many operations still require
 * on-chain indexing support, so transactional calls delegate to higher-level
 * hooks that have access to wallet signing context.
 */
export class SuiPredictionMarketSDK implements IBlockchainAdapter {
  private readonly client: SuiClient;
  private readonly packageId: string;
  private readonly network: NetworkName;
  private readonly usdcCoinType: string;
  private readonly apiBase: string;
  private readonly roleRegistryId: string;
  private readonly oracleRegistryId: string;
  private readonly marketObjectCache = new Map<
    number,
    { marketObjectId: string; shardObjectIds: string[]; queueObjectId: string | null }
  >();
  private marketCacheLoaded = false;
  private marketCacheLastRefreshed = 0;

  // Native USDC uses 6 decimals.
  private static readonly DECIMALS = 6;
  private static readonly DECIMAL_MULTIPLIER = Math.pow(10, SuiPredictionMarketSDK.DECIMALS);

  constructor(
    network: NetworkName,
    packageId: string
  ) {
    this.network = network;
    this.packageId = packageId;
    this.usdcCoinType = env.suiUsdcCoinType;
    this.roleRegistryId = env.suiRoleRegistryId;
    this.oracleRegistryId = env.suiOracleRegistryId;
    this.apiBase = this.normalizeApiBase(env.apiUrl);

    const rpcUrl = getFullnodeUrl(network);
    this.client = new SuiClient({ url: rpcUrl });

    console.log('[SuiSDK] Initialized adapter', { network, packageId, rpcUrl });
  }

  async getMarketCount(): Promise<number> {
    await this.ensureMarketCache();
    return this.marketObjectCache.size;
  }

  async getMarket(marketId: number): Promise<Market> {
    try {
      const marketObjectId = await this.getMarketObjectId(marketId);
      const object = await this.client.getObject({
        id: marketObjectId,
        options: { showContent: true },
      });

      if (!object.data || object.data.content?.dataType !== 'moveObject') {
        throw new Error(`Market ${marketId} not found`);
      }

      const fields = object.data.content.fields as Record<string, any>;
      const outcomeStakes = (fields.outcome_stakes as string[] | undefined)?.map((stake) => Number(stake)) ?? [];
      const totalStakes = outcomeStakes.reduce((acc, value) => acc + value, 0);

      return {
        id: marketId,
        question: fields.question ?? '',
        outcomes: (fields.outcomes as string[]) ?? [],
        outcomeStakes,
        endTime: Number(fields.end_time ?? 0),
        resolved: Boolean(fields.resolved),
        winningOutcome: typeof fields.winning_outcome === 'number' ? fields.winning_outcome : -1,
        totalStakes,
        creator: fields.creator ?? '',
        createdAt: Number(fields.created_at ?? 0),
        resolutionTime: Number(fields.resolution_time ?? 0),
      };
    } catch (error) {
      console.error(`[SuiSDK] Failed to get market ${marketId}`, error);
      throw error;
    }
  }

  async getOdds(marketId: number): Promise<number[]> {
    const market = await this.getMarket(marketId);
    const total = market.totalStakes;

    if (!total) {
      return market.outcomes.map(() => 50);
    }

    return market.outcomeStakes.map((stake) => (stake / total) * 100);
  }

  async getBalance(address: string): Promise<number> {
    try {
      if (!this.usdcCoinType) {
        throw new Error('Missing Sui USDC coin type configuration');
      }

      const balance = await this.client.getBalance({
        owner: address,
        coinType: this.usdcCoinType,
      });

      return Number(balance.totalBalance);
    } catch (error) {
      console.error('[SuiSDK] Failed to fetch USDC balance', error);
      return 0;
    }
  }

  async getCoins(address: string, coinType?: string): Promise<any[]> {
    try {
      const coins = await this.client.getCoins({
        owner: address,
        coinType: coinType || this.usdcCoinType,
      });

      return coins.data;
    } catch (error) {
      console.error('[SuiSDK] Failed to get coins:', error);
      return [];
    }
  }

  getUsdcCoinType(): string {
    return this.usdcCoinType;
  }

  async getUserPosition(marketId: number, address: string): Promise<UserPosition | null> {
    try {
      const { data } = await this.client.getOwnedObjects({
        owner: address,
        filter: { StructType: `${this.packageId}::market_manager::Position` },
        options: { showContent: true },
      });

      for (const obj of data) {
        if (!obj.data || obj.data.content?.dataType !== 'moveObject') continue;

        const fields = obj.data.content.fields as Record<string, any>;
        if (Number(fields.market_id ?? -1) === marketId) {
          return {
            outcome: Number(fields.outcome ?? 0),
            stake: Number(fields.stake ?? 0),
            shares: Number(fields.shares ?? fields.stake ?? 0),
            claimed: Boolean(fields.claimed),
          };
        }
      }

      return null;
    } catch (error) {
      console.error('[SuiSDK] Failed to get user position', error);
      return null;
    }
  }

  async placeBet(): Promise<TransactionResult> {
    throw new Error('placeBet requires wallet signer – use Sui transaction hooks');
  }

  async claimWinnings(): Promise<TransactionResult> {
    throw new Error('claimWinnings requires wallet signer – use Sui transaction hooks');
  }

  fromMicroUSDC(amount: number): number {
    return amount / SuiPredictionMarketSDK.DECIMAL_MULTIPLIER;
  }

  toMicroUSDC(amount: number): number {
    return Math.floor(amount * SuiPredictionMarketSDK.DECIMAL_MULTIPLIER);
  }

  formatUSDC(amount: number): string {
    const usdc = this.fromMicroUSDC(amount);
    return `${usdc.toFixed(2)} USDC`;
  }

  getNetwork(): string {
    return this.network;
  }

  getModuleAddress(): string {
    return this.packageId;
  }

  getRoleRegistryId(): string {
    if (!this.roleRegistryId) {
      throw new Error('Missing Sui role registry configuration');
    }
    return this.roleRegistryId;
  }

  getOracleRegistryId(): string {
    if (!this.oracleRegistryId) {
      throw new Error('Missing Sui oracle registry configuration');
    }
    return this.oracleRegistryId;
  }

  getClient(): SuiClient {
    return this.client;
  }

  /**
    * Sui markets are stored as objects; mapping a numeric ID to an object ID
    * requires an indexing strategy (events, dynamic fields, etc.).
    * This needs to be implemented once contracts expose the mapping.
    */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async getMarketObjectId(marketId: number): Promise<string> {
    const cached = this.marketObjectCache.get(marketId);
    if (cached) {
      return cached.marketObjectId;
    }

    const objects = await this.getMarketObjects(marketId);
    return objects.marketObjectId;
  }

  createTransaction(): Transaction {
    return new Transaction();
  }

  private async getMarketObjects(marketId: number): Promise<{
    marketObjectId: string;
    shardObjectIds: string[];
    queueObjectId: string | null;
  }> {
    if (this.marketObjectCache.has(marketId)) {
      return this.marketObjectCache.get(marketId)!;
    }

    const response = await fetch(`${this.apiBase}/markets/sui/objects/${marketId}`);
    if (!response.ok) {
      throw new Error(`Failed to resolve Sui market objects (${response.status} ${response.statusText})`);
    }

    const data = await response.json();

    if (!data?.marketObjectId) {
      throw new Error('Backend did not provide a Sui market object identifier');
    }

    const payload = {
      marketObjectId: String(data.marketObjectId),
      shardObjectIds: Array.isArray(data.shardObjectIds)
        ? data.shardObjectIds.map((id: unknown) => String(id))
        : [],
      queueObjectId: data.queueObjectId ? String(data.queueObjectId) : null,
    };

    this.marketObjectCache.set(marketId, payload);
    this.marketCacheLoaded = true;
    return payload;
  }

  private normalizeApiBase(rawUrl: string): string {
    const trimmed = rawUrl.replace(/\/$/, '');
    if (trimmed.endsWith('/api')) {
      return trimmed;
    }
    return `${trimmed}/api`;
  }

  private async ensureMarketCache(): Promise<void> {
    const now = Date.now();
    if (this.marketCacheLoaded && now - this.marketCacheLastRefreshed < 30_000) {
      return;
    }

    const response = await fetch(
      `${this.apiBase}/markets?chain=sui&limit=2000`
    );

    if (!response.ok) {
      throw new Error(`Failed to load Sui market metadata (${response.status} ${response.statusText})`);
    }

    const markets: Array<Record<string, any>> = await response.json();
    this.marketObjectCache.clear();

    for (const market of markets) {
      const index = Number(market.onChainId);
      if (Number.isNaN(index)) {
        continue;
      }

      if (market.suiMarketObjectId) {
        this.marketObjectCache.set(index, {
          marketObjectId: String(market.suiMarketObjectId),
          shardObjectIds: Array.isArray(market.suiShardObjectIds)
            ? market.suiShardObjectIds.map((id: any) => String(id))
            : [],
          queueObjectId: market.suiQueueObjectId ? String(market.suiQueueObjectId) : null,
        });
      }
    }

    this.marketCacheLoaded = true;
    this.marketCacheLastRefreshed = now;
  }

  invalidateCache(): void {
    this.marketObjectCache.clear();
    this.marketCacheLoaded = false;
    this.marketCacheLastRefreshed = 0;
  }
}
