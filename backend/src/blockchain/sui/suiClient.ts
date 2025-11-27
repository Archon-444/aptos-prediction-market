import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Transaction } from '@mysten/sui/transactions';
import { fromBase64 } from '@mysten/sui/utils';
import { TextEncoder } from 'util';

import { BRIDGED_WUSDC_COIN_TYPE, env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { prisma } from '../../database/prismaClient.js';
import { recordClaimTicketBuild, recordSettlementExecution } from '../../monitoring/metrics.js';
import type {
  BootstrapMarketParams,
  BootstrapMarketResult,
  CreateMarketParams,
  ExecuteSettlementsParams,
  IBlockchainClient,
  RedeemClaimParams,
  ResolveMarketOptions,
} from '../IBlockchainClient.js';

const ROLE_MAP: Record<string, number> = {
  ROLE_ADMIN: 0,
  ROLE_MARKET_CREATOR: 1,
  ROLE_RESOLVER: 2,
  ROLE_ORACLE_MANAGER: 3,
  ROLE_PAUSER: 4,
};

const ROLE_ID_TO_NAME: Record<number, string> = {
  0: 'ROLE_ADMIN',
  1: 'ROLE_MARKET_CREATOR',
  2: 'ROLE_RESOLVER',
  3: 'ROLE_ORACLE_MANAGER',
  4: 'ROLE_PAUSER',
};

const CLOCK_OBJECT_ID = '0x6';

export class SuiClientAdapter implements IBlockchainClient {
  readonly chain = 'sui' as const;
  private client?: SuiClient;
  private packageId?: string;
  private adminKeypair?: Ed25519Keypair;
  private initialized = false;
  private readonly encoder = new TextEncoder();
  private adminCapId?: string;
  private treasuryId?: string;
  private resolverCapId?: string;
  private roleRegistryId?: string;
  private oracleRegistryId?: string;

  constructor() {
    this.packageId = env.SUI_PACKAGE_ID;
    this.adminCapId = env.SUI_ADMIN_CAP_ID;
    this.treasuryId = env.SUI_TREASURY_ID;
    this.resolverCapId = env.SUI_RESOLVER_CAP_ID;
    this.roleRegistryId = env.SUI_ROLE_REGISTRY_ID;
    this.oracleRegistryId = env.SUI_ORACLE_REGISTRY_ID;

    if (env.SUI_USDC_COIN_TYPE === BRIDGED_WUSDC_COIN_TYPE) {
      throw new Error('SUI_USDC_COIN_TYPE cannot reference bridged wUSDC');
    }
  }

  private initialize() {
    if (this.initialized) return;

    // Initialize Sui client with RPC URL
    const rpcUrl = env.SUI_RPC_URL || getFullnodeUrl('testnet');
    this.client = new SuiClient({ url: rpcUrl });

    // Initialize admin keypair if private key is provided
    if (env.SUI_ADMIN_PRIVATE_KEY) {
      try {
        // Sui private keys are typically in base64 format
        const privateKeyBytes = fromBase64(env.SUI_ADMIN_PRIVATE_KEY);
        this.adminKeypair = Ed25519Keypair.fromSecretKey(privateKeyBytes);
      } catch (error) {
        console.warn('Failed to initialize Sui admin keypair:', error);
      }
    }

    this.initialized = true;
  }

  async createMarket(params: CreateMarketParams): Promise<string> {
    this.initialize();
    const admin = this.assertAdminKeypair();
    const packageId = this.assertPackageId();

    const tx = new Transaction();

    const numShards = params.numShards ?? 16;
    const questionBytes = this.stringToBytes(params.question);
    const resolutionBytes = this.stringToBytes(params.resolutionSource || '');
    const outcomesVectors = params.outcomes.map((outcome) => this.stringToBytes(outcome));

    // Call market creation function using the security-hardened module
    tx.moveCall({
      target: `${packageId}::market_manager_v2::create_market`,
      arguments: [
        tx.pure.vector('u8', questionBytes),
        tx.pure.vector('vector<u8>', outcomesVectors as unknown as number[][]),
        tx.pure.u64(params.durationHours),
        tx.pure.vector('u8', resolutionBytes),
        tx.pure.u8(numShards),
        tx.object(this.assertRoleRegistryId()),
        tx.object(this.assertOracleRegistryId()),
        tx.object(CLOCK_OBJECT_ID),
      ],
    });

    // Sign and execute transaction
    const result = await this.client!.signAndExecuteTransaction({
      signer: admin,
      transaction: tx,
      options: {
        showEffects: true,
        showObjectChanges: true,
      },
    });

    // Wait for transaction to be confirmed
    await this.client!.waitForTransaction({
      digest: result.digest,
    });

    const { marketObjectId, queueObjectId } = this.extractMarketArtifacts(result.objectChanges);

    if (!marketObjectId || !queueObjectId) {
      throw new Error('Failed to locate Sui market artifacts in transaction output');
    }

    const shardObjectIds = await this.initializeShards({
      admin,
      marketObjectId,
      numShards,
    });

    const marketId = await this.persistSuiMarketMetadata({
      params,
      digest: result.digest,
      marketObjectId,
      queueObjectId,
      shardObjectIds,
      numShards,
    });

    logger.info(
      {
        digest: result.digest,
        marketObjectId,
        marketId,
      },
      '[SuiClient] Created Sui market'
    );

    return result.digest;
  }

  async executeSettlements(params: ExecuteSettlementsParams): Promise<string> {
    this.initialize();
    const admin = this.assertAdminKeypair();
    const packageId = this.assertPackageId();
    const adminCapId = params.adminCapId ?? this.assertAdminCapId();
    const treasuryId = params.treasuryId ?? this.assertTreasuryId();

    const tx = new Transaction();
    tx.moveCall({
      target: `${packageId}::market_manager_v2::execute_settlements`,
      arguments: [
        tx.object(adminCapId),
        tx.object(params.marketId),
        tx.object(params.queueId),
        tx.object(treasuryId),
        tx.pure.u64(params.maxToProcess),
      ],
    });

    try {
      const result = await this.client!.signAndExecuteTransaction({
        signer: admin,
        transaction: tx,
        options: {
          showEffects: true,
          showObjectChanges: true,
        },
      });

      await this.client!.waitForTransaction({
        digest: result.digest,
      });

      recordSettlementExecution(this.chain, params.maxToProcess, 'success');
      return result.digest;
    } catch (error) {
      recordSettlementExecution(this.chain, params.maxToProcess, 'failure');
      throw error;
    }
  }

  buildRedeemClaimTransaction(params: RedeemClaimParams): Transaction {
    this.initialize();
    const packageId = this.assertPackageId();
    const treasuryId = params.treasuryId ?? this.assertTreasuryId();
    const recipient = params.recipientAddress;

    if (!recipient) {
      throw new Error('recipientAddress is required to redeem Sui claim tickets');
    }

    const tx = new Transaction();
    const payoutCoin = tx.moveCall({
      target: `${packageId}::global_treasury::redeem_claim_entry`,
      arguments: [tx.object(treasuryId), tx.object(params.ticketId)],
    });
    tx.transferObjects([payoutCoin], tx.pure.address(recipient));

    recordClaimTicketBuild(this.chain);

    return tx;
  }

  async bootstrapMarket(params: BootstrapMarketParams): Promise<BootstrapMarketResult> {
    this.initialize();
    const admin = this.assertAdminKeypair();

    const transaction = await this.client!.getTransactionBlock({
      digest: params.digest,
      options: {
        showObjectChanges: true,
      },
    });

    const { marketObjectId, queueObjectId } = this.extractMarketArtifacts(
      transaction.objectChanges
    );

    if (!marketObjectId || !queueObjectId) {
      throw new Error('Unable to locate Sui market artifacts in transaction');
    }

    const existingMarket = await prisma.market.findFirst({
      where: {
        suiMarketObjectId: marketObjectId,
      },
    });

    if (existingMarket) {
      return { marketId: existingMarket.onChainId };
    }

    const marketObject = await this.client!.getObject({
      id: marketObjectId,
      options: { showContent: true },
    });

    if (!marketObject.data || marketObject.data.content?.dataType !== 'moveObject') {
      throw new Error('Sui market object not found or malformed');
    }

    const fields = marketObject.data.content.fields as Record<string, any>;
    const question = String(fields.question ?? '');
    const outcomes = Array.isArray(fields.outcomes)
      ? fields.outcomes.map((value: unknown) => String(value))
      : [];
    const resolutionSource = String(fields.resolution_source ?? '');
    const numShards = Number(fields.num_shards ?? 0);
    const creator = fields.creator ? String(fields.creator) : undefined;

    const endTimestampMs = Number(fields.end_timestamp ?? 0);
    const createdAtMs = Number(fields.created_at ?? endTimestampMs);
    const durationMs = Math.max(endTimestampMs - createdAtMs, 60 * 60 * 1000);
    const durationHours = Math.max(1, Math.round(durationMs / (60 * 60 * 1000)));

    const shardObjectIds = await this.initializeShards({
      admin,
      marketObjectId,
      numShards,
    });

    const marketId = await this.persistSuiMarketMetadata({
      params: {
        question,
        outcomes,
        durationHours,
        resolutionSource,
        proposer: creator,
        numShards,
      },
      digest: params.digest,
      marketObjectId,
      queueObjectId,
      shardObjectIds,
      numShards,
      endDateOverride: endTimestampMs ? new Date(endTimestampMs) : undefined,
    });

    logger.info(
      {
        digest: params.digest,
        marketObjectId,
        marketId,
      },
      '[SuiClient] Bootstrapped Sui market from digest'
    );

    return { marketId };
  }

  async grantRole(walletAddress: string, role: string): Promise<string> {
    this.initialize();
    const admin = this.assertAdminKeypair();
    const packageId = this.assertPackageId();
    const adminCapId = this.assertAdminCapId();
    const roleRegistryId = this.assertRoleRegistryId();
    const roleId = this.mapRole(role);

    const tx = new Transaction();

    // Call grant_role function
    // The function signature should match: grant_role(admin_cap: &AdminCap, user: address, role: u8)
    tx.moveCall({
      target: `${packageId}::access_control::grant_role`,
      arguments: [
        tx.object(adminCapId),
        tx.object(roleRegistryId),
        tx.pure.address(walletAddress),
        tx.pure.u8(roleId),
      ],
    });

    const result = await this.client!.signAndExecuteTransaction({
      signer: admin,
      transaction: tx,
      options: {
        showEffects: true,
      },
    });

    await this.client!.waitForTransaction({
      digest: result.digest,
    });

    return result.digest;
  }

  async resolveMarket(
    marketId: string,
    winningOutcome: number,
    options?: ResolveMarketOptions
  ): Promise<string> {
    this.initialize();
    const admin = this.assertAdminKeypair();
    const packageId = this.assertPackageId();
    const resolverCapId = this.assertResolverCapId();
    const snapshot = options?.oracleSnapshot;

    if (!snapshot) {
      throw new Error('Oracle snapshot is required for Sui market resolution');
    }

    if (!snapshot.verified) {
      throw new Error('Oracle snapshot must be verified before submitting resolution');
    }

    const priceValue = Math.max(0, Math.trunc(snapshot.price));
    const sourceCount = Math.max(1, Math.trunc(snapshot.numSources));
    const snapshotTimestamp = Math.max(0, Math.trunc(snapshot.timestamp));

    const tx = new Transaction();
    tx.moveCall({
      target: `${packageId}::market_manager_v2::resolve_market`,
      arguments: [
        tx.object(resolverCapId),
        tx.object(marketId),
        tx.pure.u8(winningOutcome),
        tx.object(this.assertRoleRegistryId()),
        tx.object(this.assertOracleRegistryId()),
        tx.pure.u64(BigInt(priceValue)),
        tx.pure.u64(BigInt(sourceCount)),
        tx.pure.u64(BigInt(snapshotTimestamp)),
        tx.pure.bool(Boolean(snapshot.verified)),
        tx.object(CLOCK_OBJECT_ID),
      ],
    });

    const result = await this.client!.signAndExecuteTransaction({
      signer: admin,
      transaction: tx,
      options: {
        showEffects: true,
        showObjectChanges: true,
      },
    });

    await this.client!.waitForTransaction({
      digest: result.digest,
    });

    return result.digest;
  }

  async revokeRole(walletAddress: string, role: string): Promise<string> {
    this.initialize();
    const admin = this.assertAdminKeypair();
    const packageId = this.assertPackageId();
    const adminCapId = this.assertAdminCapId();
    const roleRegistryId = this.assertRoleRegistryId();
    const roleId = this.mapRole(role);

    const tx = new Transaction();

    // Call revoke_role function
    tx.moveCall({
      target: `${packageId}::access_control::revoke_role`,
      arguments: [
        tx.object(adminCapId),
        tx.object(roleRegistryId),
        tx.pure.address(walletAddress),
        tx.pure.u8(roleId),
      ],
    });

    const result = await this.client!.signAndExecuteTransaction({
      signer: admin,
      transaction: tx,
      options: {
        showEffects: true,
      },
    });

    await this.client!.waitForTransaction({
      digest: result.digest,
    });

    return result.digest;
  }

  async fetchRoles(walletAddress: string): Promise<string[]> {
    this.initialize();

    const registryId = this.assertRoleRegistryId();

    try {
      const response = await this.client!.getDynamicFieldObject({
        parentId: registryId,
        name: {
          type: 'address',
          value: walletAddress,
        },
      });

      const moveObject = response.data?.content;
      if (!moveObject || moveObject.dataType !== 'moveObject') {
        return [];
      }

      const roleVectorField = (moveObject.fields as any)?.value;
      const roleIds = this.extractRoleIds(roleVectorField);

      return roleIds
        .map((roleId) => ROLE_ID_TO_NAME[roleId])
        .filter((roleName): roleName is string => Boolean(roleName));
    } catch (error) {
      if (error instanceof Error && /not found|does not exist/i.test(error.message)) {
        return [];
      }

      throw error;
    }
  }

  private assertAdminKeypair(): Ed25519Keypair {
    if (!this.adminKeypair) {
      throw new Error('SUI_ADMIN_PRIVATE_KEY must be set for on-chain operations');
    }
    return this.adminKeypair;
  }

  private assertPackageId(): string {
    if (!this.packageId) {
      throw new Error('SUI_PACKAGE_ID must be set for on-chain operations');
    }
    return this.packageId;
  }

  private assertAdminCapId(): string {
    if (!this.adminCapId) {
      throw new Error('SUI_ADMIN_CAP_ID must be set for settlement execution');
    }
    return this.adminCapId;
  }

  private assertTreasuryId(): string {
    if (!this.treasuryId) {
      throw new Error('SUI_TREASURY_ID must be set for settlement execution');
    }
    return this.treasuryId;
  }

  private assertResolverCapId(): string {
    if (!this.resolverCapId) {
      throw new Error('SUI_RESOLVER_CAP_ID must be set for market resolution');
    }
    return this.resolverCapId;
  }

  private assertRoleRegistryId(): string {
    if (!this.roleRegistryId) {
      throw new Error('SUI_ROLE_REGISTRY_ID must be set for role management');
    }
    return this.roleRegistryId;
  }

  private assertOracleRegistryId(): string {
    if (!this.oracleRegistryId) {
      throw new Error('SUI_ORACLE_REGISTRY_ID must be set for oracle validation');
    }
    return this.oracleRegistryId;
  }

  private extractRoleIds(valueField: unknown): number[] {
    const collect = (candidate: unknown): number[] => {
      if (candidate === null || candidate === undefined) {
        return [];
      }

      if (Array.isArray(candidate)) {
        return candidate.flatMap((entry) => collect(entry));
      }

      if (typeof candidate === 'number') {
        return Number.isFinite(candidate) ? [candidate] : [];
      }

      if (typeof candidate === 'bigint') {
        return [Number(candidate)];
      }

      if (typeof candidate === 'string') {
        const parsed = Number.parseInt(candidate, 10);
        return Number.isNaN(parsed) ? [] : [parsed];
      }

      if (typeof candidate === 'object') {
        const record = candidate as { fields?: unknown; value?: unknown };

        if (record.fields !== undefined) {
          const inner = record.fields as { value?: unknown; contents?: unknown } | undefined;
          if (inner) {
            if (inner.value !== undefined) {
              return collect(inner.value);
            }
            if (inner.contents !== undefined) {
              return collect(inner.contents);
            }
          }
        }

        if (record.value !== undefined) {
          return collect(record.value);
        }
      }

      return [];
    };

    const ids = collect(valueField).filter(
      (id): id is number => Number.isInteger(id) && id >= 0 && id <= 255
    );

    return Array.from(new Set(ids));
  }

  private mapRole(role: string): number {
    const mapped = ROLE_MAP[role];
    if (mapped === undefined) {
      throw new Error(`Unsupported role: ${role}`);
    }
    return mapped;
  }

  private stringToBytes(value: string): number[] {
    return Array.from(this.encoder.encode(value));
  }

  private extractMarketArtifacts(objectChanges: unknown): {
    marketObjectId?: string;
    queueObjectId?: string;
  } {
    const changes = Array.isArray(objectChanges) ? objectChanges : [];
    const createdObjects = changes.filter((change: any) => change?.type === 'created');

    const resolveObjectId = (change: any): string | undefined =>
      change?.objectId ?? change?.object_id ?? change?.reference?.objectId;

    const marketObject = createdObjects.find(
      (change) =>
        typeof change.objectType === 'string' &&
        change.objectType.endsWith('::market_manager_v2::Market')
    );

    const queueObject = createdObjects.find(
      (change) =>
        typeof change.objectType === 'string' &&
        change.objectType.endsWith('::market_manager_v2::SettlementQueue')
    );

    return {
      marketObjectId: resolveObjectId(marketObject),
      queueObjectId: resolveObjectId(queueObject),
    };
  }

  private async initializeShards(params: {
    admin: Ed25519Keypair;
    marketObjectId: string;
    numShards: number;
  }): Promise<string[]> {
    const shardObjectIds: string[] = [];

    if (params.numShards <= 0) {
      return shardObjectIds;
    }

    for (let shardId = 0; shardId < params.numShards; shardId += 1) {
      const tx = new Transaction();
      tx.moveCall({
        target: `${this.assertPackageId()}::market_manager_v2::create_pool_shard`,
        arguments: [tx.object(params.marketObjectId), tx.pure.u8(shardId)],
      });

      const result = await this.client!.signAndExecuteTransaction({
        signer: params.admin,
        transaction: tx,
        options: {
          showEffects: true,
          showObjectChanges: true,
        },
      });

      await this.client!.waitForTransaction({ digest: result.digest });

      const objectChanges = (
        Array.isArray(result.objectChanges) ? result.objectChanges : []
      ) as any[];
      const created =
        objectChanges.find(
          (change: any) =>
            change?.type === 'created' &&
            typeof change.objectType === 'string' &&
            change.objectType.endsWith('::market_manager_v2::MarketPoolShard')
        ) ?? null;

      const shardObjectId =
        (created as any)?.objectId ??
        (created as any)?.object_id ??
        (created as any)?.reference?.objectId;

      if (!shardObjectId) {
        logger.warn(
          {
            shardId,
            marketObjectId: params.marketObjectId,
            digest: result.digest,
          },
          '[SuiClient] Failed to capture shard object ID'
        );
        continue;
      }

      shardObjectIds.push(shardObjectId);
    }

    if (shardObjectIds.length !== params.numShards) {
      logger.error(
        {
          expected: params.numShards,
          created: shardObjectIds.length,
          marketObjectId: params.marketObjectId,
        },
        '[SuiClient] Failed to initialize all shard objects'
      );
      throw new Error('Unable to create full shard set for Sui market');
    }

    return shardObjectIds;
  }

  private async persistSuiMarketMetadata(input: {
    params: CreateMarketParams;
    digest: string;
    marketObjectId: string;
    queueObjectId: string;
    shardObjectIds: string[];
    numShards: number;
    endDateOverride?: Date;
  }): Promise<string> {
    const outcomes = input.params.outcomes;
    const endDate =
      input.endDateOverride ?? new Date(Date.now() + input.params.durationHours * 60 * 60 * 1000);
    let createdMarketId = '';

    await prisma.$transaction(async (tx) => {
      const existingMarkets = await tx.market.count({
        where: { chain: 'sui' },
      });

      const market = await tx.market.create({
        data: {
          onChainId: String(existingMarkets),
          chain: 'sui',
          question: input.params.question,
          outcomes,
          creatorWallet: input.params.proposer ?? null,
          endDate,
          status: 'active',
          totalVolume: 0n,
          liquidityParam: 100n,
          outcomePools: Array(outcomes.length).fill(0n),
          suiMarketObjectId: input.marketObjectId,
          suiShardObjectIds: input.shardObjectIds,
          suiQueueObjectId: input.queueObjectId,
          transactionHash: input.digest,
          lastSyncedAt: new Date(),
        },
      });

      createdMarketId = market.onChainId;
    });

    logger.info(
      {
        digest: input.digest,
        marketObjectId: input.marketObjectId,
        queueObjectId: input.queueObjectId,
        marketId: createdMarketId,
      },
      '[SuiClient] Stored Sui market metadata'
    );

    return createdMarketId;
  }
}
