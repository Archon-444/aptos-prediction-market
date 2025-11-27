import {
  Account,
  Aptos,
  AptosConfig,
  Ed25519PrivateKey,
  type InputEntryFunctionData,
  Network,
} from '@aptos-labs/ts-sdk';

import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { prisma } from '../../database/prismaClient.js';
import type {
  BootstrapMarketParams,
  BootstrapMarketResult,
  CreateMarketParams,
  IBlockchainClient,
  ResolveMarketOptions,
} from '../IBlockchainClient.js';

const ROLE_MAP: Record<string, number> = {
  ROLE_ADMIN: 0,
  ROLE_MARKET_CREATOR: 1,
  ROLE_RESOLVER: 2,
  ROLE_ORACLE_MANAGER: 3,
  ROLE_PAUSER: 4,
};

const textEncoder = new TextEncoder();

export class AptosClientAdapter implements IBlockchainClient {
  readonly chain = 'aptos' as const;
  private aptos?: Aptos;
  private readonly moduleAddress: string;
  private adminAccount?: Account;
  private initialized = false;

  constructor() {
    this.moduleAddress = env.APTOS_MODULE_ADDRESS;
  }

  private initialize() {
    if (this.initialized) return;

    const network = env.APTOS_NETWORK as Network;
    const config = new AptosConfig({ network });
    this.aptos = new Aptos(config);

    // Initialize admin account only if private key is set
    // Note: Skip this for read-only operations like bootstrapMarket
    if (env.APTOS_ADMIN_PRIVATE_KEY) {
      try {
        const privateKey = new Ed25519PrivateKey(env.APTOS_ADMIN_PRIVATE_KEY);
        this.adminAccount = Account.fromPrivateKey({ privateKey });
      } catch (error) {
        // If private key initialization fails, log warning but continue
        // This allows read-only operations to work
        logger.warn(
          { error: error instanceof Error ? error.message : 'Unknown error' },
          '[AptosClient] Failed to initialize admin account - write operations will not work'
        );
      }
    }

    this.initialized = true;
  }

  async createMarket(params: CreateMarketParams): Promise<string> {
    this.initialize();
    const admin = this.assertAdminAccount();

    const payload: InputEntryFunctionData = {
      function: `${this.moduleAddress}::market_manager::create_market`,
      typeArguments: [],
      functionArguments: [
        Array.from(textEncoder.encode(params.question)),
        params.outcomes.map((outcome) => Array.from(textEncoder.encode(outcome))),
        params.durationHours,
      ],
    };

    try {
      const transaction = await this.aptos!.transaction.build.simple({
        sender: admin.accountAddress,
        data: payload,
      });

      const committedTxn = await this.aptos!.signAndSubmitTransaction({
        signer: admin,
        transaction,
      });

      // Wait for transaction confirmation
      const executedTxn = await this.aptos!.waitForTransaction({
        transactionHash: committedTxn.hash,
      });

      if (!executedTxn.success) {
        throw new Error(`Transaction failed: ${JSON.stringify(executedTxn)}`);
      }

      // Parse events to get market_id (type-safe)
      const events = (executedTxn as any).events || [];
      const marketCreatedEvent = events.find(
        (e: any) => e.type && e.type.includes('MarketCreatedEvent')
      );

      if (marketCreatedEvent && marketCreatedEvent.data) {
        const marketId = marketCreatedEvent.data.market_id;
        console.log(`Market created on-chain: ID=${marketId}, TxHash=${committedTxn.hash}`);
      }

      return committedTxn.hash;
    } catch (error: any) {
      console.error('Failed to create market on-chain:', error);
      throw new Error(`On-chain market creation failed: ${error.message}`);
    }
  }

  async grantRole(walletAddress: string, role: string): Promise<string> {
    this.initialize();
    const admin = this.assertAdminAccount();
    const roleId = this.mapRole(role);

    const payload: InputEntryFunctionData = {
      function: `${this.moduleAddress}::access_control::grant_role`,
      typeArguments: [],
      functionArguments: [walletAddress, roleId],
    };

    const transaction = await this.aptos!.transaction.build.simple({
      sender: admin.accountAddress,
      data: payload,
    });

    const committed = await this.aptos!.signAndSubmitTransaction({ signer: admin, transaction });
    await this.aptos!.waitForTransaction({ transactionHash: committed.hash });
    return committed.hash;
  }

  async revokeRole(walletAddress: string, role: string): Promise<string> {
    this.initialize();
    const admin = this.assertAdminAccount();
    const roleId = this.mapRole(role);

    const payload: InputEntryFunctionData = {
      function: `${this.moduleAddress}::access_control::revoke_role`,
      typeArguments: [],
      functionArguments: [walletAddress, roleId],
    };

    const transaction = await this.aptos!.transaction.build.simple({
      sender: admin.accountAddress,
      data: payload,
    });

    const committed = await this.aptos!.signAndSubmitTransaction({ signer: admin, transaction });
    await this.aptos!.waitForTransaction({ transactionHash: committed.hash });
    return committed.hash;
  }

  async resolveMarket(
    marketId: string,
    winningOutcome: number,
    _options?: ResolveMarketOptions
  ): Promise<string> {
    this.initialize();
    const admin = this.assertAdminAccount();

    const payload: InputEntryFunctionData = {
      function: `${this.moduleAddress}::market_manager::resolve_market`,
      typeArguments: [],
      functionArguments: [marketId, winningOutcome],
    };

    try {
      const transaction = await this.aptos!.transaction.build.simple({
        sender: admin.accountAddress,
        data: payload,
      });

      const committedTxn = await this.aptos!.signAndSubmitTransaction({
        signer: admin,
        transaction,
      });

      // Wait for transaction confirmation
      const executedTxn = await this.aptos!.waitForTransaction({
        transactionHash: committedTxn.hash,
      });

      if (!executedTxn.success) {
        throw new Error(`Transaction failed: ${executedTxn.vm_status}`);
      }

      console.log(`Market resolved on-chain: ID=${marketId}, TxHash=${committedTxn.hash}`);
      return committedTxn.hash;
    } catch (error: any) {
      console.error('Failed to resolve market on-chain:', error);
      throw new Error(`On-chain market resolution failed: ${error.message}`);
    }
  }

  async bootstrapMarket(params: BootstrapMarketParams): Promise<BootstrapMarketResult> {
    logger.info({ digest: params.digest }, '[AptosClient] bootstrapMarket START');

    this.initialize();

    logger.info({ digest: params.digest }, '[AptosClient] After initialize');

    // Fetch transaction by hash
    // Note: Aptos SDK has a bug parsing GUIDs with odd-length hex (e.g., '0x0')
    // Workaround: fetch directly via REST API and parse JSON manually
    let transaction: any;
    try {
      logger.info({ digest: params.digest }, '[AptosClient] About to fetch via REST API');

      // Construct REST API URL based on network
      const network = env.APTOS_NETWORK as Network;
      const networkUrls: Record<string, string> = {
        mainnet: 'https://fullnode.mainnet.aptoslabs.com/v1',
        testnet: 'https://fullnode.testnet.aptoslabs.com/v1',
        devnet: 'https://fullnode.devnet.aptoslabs.com/v1',
      };
      const networkUrl = networkUrls[network] || networkUrls.testnet;

      const response = await fetch(`${networkUrl}/transactions/by_hash/${params.digest}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch transaction: ${response.statusText}`);
      }

      // Get raw text and parse manually to avoid SDK interference
      const text = await response.text();
      transaction = JSON.parse(text);

      logger.info(
        { transactionHash: params.digest, version: transaction.version },
        '[AptosClient] Fetched transaction via REST API'
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(
        { transactionHash: params.digest, error: errorMsg, stack: error instanceof Error ? error.stack : undefined },
        '[AptosClient] Failed to fetch transaction'
      );
      throw error;
    }

    // Extract MarketCreatedEvent from transaction events
    const events = (transaction as any).events || [];
    const marketCreatedEvent = events.find(
      (e: any) => e.type && e.type.includes('MarketCreatedEvent')
    );

    if (!marketCreatedEvent || !marketCreatedEvent.data) {
      throw new Error('MarketCreatedEvent not found in transaction');
    }

    const eventData = marketCreatedEvent.data;

    // Extract event fields from MarketCreatedEvent:
    // struct MarketCreatedEvent {
    //   market_id: u64,
    //   creator: address,
    //   question: String,
    //   outcomes: vector<String>,
    //   end_time: u64,
    //   created_at: u64,
    // }
    const marketId = String(eventData.market_id);
    const creator = String(eventData.creator);
    const question = String(eventData.question);
    const outcomes = Array.isArray(eventData.outcomes)
      ? eventData.outcomes.map((o: unknown) => String(o))
      : [];
    const endTimeMs = Number(eventData.end_time) * 1000; // Convert seconds to ms
    const createdAtMs = Number(eventData.created_at) * 1000;

    // Check if market already exists
    const existingMarket = await prisma.market.findFirst({
      where: {
        chain: 'aptos',
        onChainId: marketId,
      },
    });

    if (existingMarket) {
      logger.info(
        { marketId, transactionHash: params.digest },
        '[AptosClient] Market already indexed'
      );
      return { marketId: existingMarket.onChainId };
    }

    // Create market in database
    const market = await prisma.market.create({
      data: {
        onChainId: marketId,
        chain: 'aptos',
        question,
        outcomes,
        creatorWallet: creator,
        endDate: new Date(endTimeMs),
        status: 'active',
        totalVolume: BigInt(0),
        liquidityParam: BigInt(100), // Default LMSR liquidity parameter
        outcomePools: outcomes.map(() => '0'),
        transactionHash: params.digest,
        createdAt: new Date(createdAtMs),
        lastSyncedAt: new Date(),
      },
    });

    logger.info(
      {
        marketId,
        transactionHash: params.digest,
        question,
      },
      '[AptosClient] Bootstrapped Aptos market from transaction'
    );

    return { marketId: market.onChainId };
  }

  private assertAdminAccount(): Account {
    if (!this.adminAccount) {
      throw new Error(
        'APTOS_ADMIN_PRIVATE_KEY and APTOS_ADMIN_ACCOUNT must be set for on-chain operations'
      );
    }
    return this.adminAccount;
  }

  private mapRole(role: string): number {
    const mapped = ROLE_MAP[role];
    if (mapped === undefined) {
      throw new Error(`Unsupported role: ${role}`);
    }
    return mapped;
  }
}
