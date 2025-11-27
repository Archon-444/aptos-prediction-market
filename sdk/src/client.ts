/**
 * Main SDK Client for Move Market
 */

import { Aptos, AptosConfig, Network, Account, Serializer } from "@aptos-labs/ts-sdk";
import {
  SDKConfig,
  Market,
  UserPosition,
  DisputeInfo,
  Role,
  DisputeStatus,
  ResolutionInfo,
  ResolutionSource,
  ResolutionStrategy,
  PythPrice,
  OracleResolution,
  OracleReputation,
  OracleVoteOptions,
  OracleVoteResult,
} from "./types";

interface CreateDisputeOptions {
  adminAddress?: string;
  marketId: number;
  disputedOutcome: number;
  proposedOutcome: number;
  reason: number;
  evidence: string;
  evidenceHash?: Uint8Array;
  stakeAmount: bigint | number;
}

interface VoteOnDisputeOptions {
  adminAddress?: string;
  disputeId: number;
  voteOutcome: number;
  reasoning: string;
}

const HEX_PREFIX = "0x";

function normalizeAddress(address: string): string {
  if (!address) {
    throw new Error("Address must be a non-empty string");
  }
  const trimmed = address.startsWith(HEX_PREFIX) ? address : `${HEX_PREFIX}${address}`;
  return trimmed.toLowerCase();
}

function toByteArray(input: Uint8Array | number[]): number[] {
  return Array.isArray(input) ? input : Array.from(input);
}

export class PredictionMarketClient {
  private aptos: Aptos;
  private moduleAddress: string;

  constructor(config: SDKConfig) {
    const aptosConfig = new AptosConfig({
      network: config.network as Network,
      fullnode: config.nodeUrl,
    });
    this.aptos = new Aptos(aptosConfig);
    this.moduleAddress = normalizeAddress(config.moduleAddress);
  }

  private getOracleRegistryType(): `${string}::${string}::${string}` {
    return `${this.moduleAddress}::oracle::OracleRegistry`;
  }

  private async getOracleRegistry(): Promise<any | null> {
    try {
      const resource = await this.aptos.getAccountResource<any>({
        accountAddress: this.moduleAddress,
        resourceType: this.getOracleRegistryType(),
      });
      if (!resource) {
        return null;
      }
      return (resource as { data?: unknown }).data ?? resource;
    } catch {
      return null;
    }
  }

  private async getTableItem<T>(handle: string, data: { key_type: string; value_type: string; key: unknown }): Promise<T | null> {
    try {
      return await this.aptos.getTableItem<T>({ handle, data });
    } catch {
      return null;
    }
  }

  private async fetchOracleReputationEntry(oracleAddress: string): Promise<any | null> {
    const registry = await this.getOracleRegistry();
    if (!registry) {
      return null;
    }

    const reputationsTable =
      registry.oracle_reputations?.handle ??
      registry.oracle_reputations?.inner?.handle ??
      registry.oracle_reputations?.outer?.handle;

    if (!reputationsTable) {
      return null;
    }

    return this.getTableItem<any>(reputationsTable, {
      key_type: "address",
      value_type: `${this.moduleAddress}::oracle::OracleReputation`,
      key: normalizeAddress(oracleAddress),
    });
  }

  private async getOracleNonceForAddress(oracleAddress: string): Promise<bigint> {
    const reputation = await this.getOracleReputation(oracleAddress);
    return reputation?.nonce ?? 0n;
  }

  private buildOracleVoteMessage(marketId: number, outcome: number, nonce: bigint): Uint8Array {
    const serializer = new Serializer();
    serializer.serializeU64(BigInt(marketId));
    serializer.serializeU8(outcome);
    serializer.serializeU64(nonce);
    return serializer.toUint8Array();
  }

  private toBigInt(value: bigint | number | string): bigint {
    if (typeof value === "bigint") {
      return value;
    }
    if (typeof value === "number") {
      if (!Number.isFinite(value) || !Number.isInteger(value)) {
        throw new Error("Expected integer number when converting to bigint");
      }
      return BigInt(value);
    }
    if (typeof value === "string" && value.trim() !== "") {
      return BigInt(value);
    }
    throw new Error("Unsupported value for bigint conversion");
  }

  // ============= Market Functions =============

  /**
   * Get total number of markets
   */
  async getMarketCount(): Promise<number> {
    const result = await this.aptos.view({
      payload: {
        function: `${this.moduleAddress}::market_manager::get_market_count`,
        typeArguments: [],
        functionArguments: [],
      },
    });
    return Number(result[0]);
  }

  /**
   * Get market details
   */
  async getMarket(marketId: number): Promise<Market> {
    const result = await this.aptos.view({
      payload: {
        function: `${this.moduleAddress}::market_manager::get_market_full`,
        typeArguments: [],
        functionArguments: [marketId],
      },
    });

    const [question, outcomes, endTime, resolved, winningOutcome, totalStake, outcomeStakes, creator] = result;

    return {
      id: marketId,
      question: question as string,
      outcomes: outcomes as string[],
      endTime: Number(endTime),
      resolved: resolved as boolean,
      winningOutcome: winningOutcome !== null ? Number(winningOutcome) : undefined,
      totalStake: BigInt(totalStake as string),
      outcomeStakes: (outcomeStakes as string[]).map(s => BigInt(s)),
      creator: creator as string,
    };
  }

  /**
   * Check if market is active
   */
  async isMarketActive(marketId: number): Promise<boolean> {
    const result = await this.aptos.view({
      payload: {
        function: `${this.moduleAddress}::market_manager::is_market_active`,
        typeArguments: [],
        functionArguments: [marketId],
      },
    });
    return result[0] as boolean;
  }

  /**
   * Create a new prediction market
   */
  async createMarket(
    creator: Account,
    question: string,
    outcomes: string[],
    durationHours: number
  ): Promise<string> {
    const transaction = await this.aptos.transaction.build.simple({
      sender: creator.accountAddress,
      data: {
        function: `${this.moduleAddress}::market_manager::create_market`,
        typeArguments: [],
        functionArguments: [question, outcomes, durationHours],
      },
    });

    const pendingTxn = await this.aptos.signAndSubmitTransaction({
      signer: creator,
      transaction,
    });

    await this.aptos.waitForTransaction({ transactionHash: pendingTxn.hash });
    return pendingTxn.hash;
  }

  /**
   * Resolve a market
   */
  async resolveMarket(
    resolver: Account,
    marketId: number,
    winningOutcome: number
  ): Promise<string> {
    const transaction = await this.aptos.transaction.build.simple({
      sender: resolver.accountAddress,
      data: {
        function: `${this.moduleAddress}::market_manager::resolve_market`,
        typeArguments: [],
        functionArguments: [marketId, winningOutcome],
      },
    });

    const pendingTxn = await this.aptos.signAndSubmitTransaction({
      signer: resolver,
      transaction,
    });

    await this.aptos.waitForTransaction({ transactionHash: pendingTxn.hash });
    return pendingTxn.hash;
  }

  // ============= Betting Functions =============

  /**
   * Place a bet on a market outcome
   */
  async placeBet(
    bettor: Account,
    marketId: number,
    outcome: number,
    amount: bigint
  ): Promise<string> {
    const transaction = await this.aptos.transaction.build.simple({
      sender: bettor.accountAddress,
      data: {
        function: `${this.moduleAddress}::betting::place_bet`,
        typeArguments: [],
        functionArguments: [marketId, outcome, amount.toString()],
      },
    });

    const pendingTxn = await this.aptos.signAndSubmitTransaction({
      signer: bettor,
      transaction,
    });

    await this.aptos.waitForTransaction({ transactionHash: pendingTxn.hash });
    return pendingTxn.hash;
  }

  /**
   * Claim winnings from a resolved market
   */
  async claimWinnings(user: Account, marketId: number): Promise<string> {
    const transaction = await this.aptos.transaction.build.simple({
      sender: user.accountAddress,
      data: {
        function: `${this.moduleAddress}::betting::claim_winnings`,
        typeArguments: [],
        functionArguments: [marketId],
      },
    });

    const pendingTxn = await this.aptos.signAndSubmitTransaction({
      signer: user,
      transaction,
    });

    await this.aptos.waitForTransaction({ transactionHash: pendingTxn.hash });
    return pendingTxn.hash;
  }

  /**
   * Get current odds for all outcomes
   */
  async getOdds(marketId: number): Promise<number[]> {
    const result = await this.aptos.view({
      payload: {
        function: `${this.moduleAddress}::betting::get_odds`,
        typeArguments: [],
        functionArguments: [marketId],
      },
    });
    return (result[0] as number[]).map(Number);
  }

  /**
   * Calculate potential payout for a bet
   */
  async calculatePayout(
    marketId: number,
    outcome: number,
    betAmount: bigint
  ): Promise<bigint> {
    const result = await this.aptos.view({
      payload: {
        function: `${this.moduleAddress}::betting::calculate_payout`,
        typeArguments: [],
        functionArguments: [marketId, outcome, betAmount.toString()],
      },
    });
    return BigInt(result[0] as string);
  }

  async getResolutionInfo(marketId: number): Promise<ResolutionInfo> {
    const resolution = await this.getOracleResolution(marketId);

    const source = await this.aptos.view({
      payload: {
        function: `${this.moduleAddress}::oracle::get_resolution_source`,
        typeArguments: [],
        functionArguments: [marketId],
      },
    });

    const strategy = await this.aptos.view({
      payload: {
        function: `${this.moduleAddress}::oracle::get_resolution_strategy`,
        typeArguments: [],
        functionArguments: [marketId],
      },
    });

    return {
      resolved: resolution.resolved,
      winningOutcome: resolution.outcome ?? 0,
      source: Number(source[0]) as ResolutionSource,
      strategy: Number(strategy[0]) as ResolutionStrategy,
    };
  }

  async getPythPrice(marketId: number): Promise<PythPrice> {
    const result = await this.aptos.view({
      payload: {
        function: `${this.moduleAddress}::oracle::get_pyth_price`,
        typeArguments: [],
        functionArguments: [marketId],
      },
    });

    const hasSnapshot = Boolean(result[0]);

    if (!hasSnapshot) {
      return {
        hasSnapshot: false,
        price: 0n,
        priceNegative: false,
        confidence: 0n,
        expo: 0,
        expoNegative: false,
        publishTime: 0,
        receivedAt: 0,
      };
    }

    const price = BigInt(result[1] as string);
    const priceNegative = Boolean(result[2]);
    const confidence = BigInt(result[3] as string);
    const expo = Number(result[4] as string);
    const expoNegative = Boolean(result[5]);
    const publishTime = Number(result[6] as string);
    const receivedAt = Number(result[7] as string);

    return {
      hasSnapshot: true,
      price,
      priceNegative,
      confidence,
      expo,
      expoNegative,
      publishTime,
      receivedAt,
    };
  }

  /**
   * Get user's position in a market
   */
  async getUserPosition(userAddress: string, marketId: number): Promise<UserPosition> {
    const result = await this.aptos.view({
      payload: {
        function: `${this.moduleAddress}::collateral_vault::get_user_position`,
        typeArguments: [],
        functionArguments: [userAddress, marketId],
      },
    });

    const [outcome, stake, shares, claimed] = result;
    return {
      marketId,
      outcome: Number(outcome),
      stake: BigInt(stake as string),
      shares: BigInt(shares as string),
      claimed: claimed as boolean,
    };
  }

  // ============= Oracle Functions =============

  /**
   * Check if a market already has an oracle resolution
   */
  async hasOracleResolution(marketId: number): Promise<boolean> {
    const result = await this.aptos.view({
      payload: {
        function: `${this.moduleAddress}::oracle::is_market_resolved`,
        typeArguments: [],
        functionArguments: [marketId],
      },
    });
    return Boolean(result[0]);
  }

  /**
   * Get oracle resolution information (lightweight)
   */
  async getOracleResolution(marketId: number): Promise<OracleResolution> {
    const result = await this.aptos.view({
      payload: {
        function: `${this.moduleAddress}::oracle::get_oracle_resolution`,
        typeArguments: [],
        functionArguments: [marketId],
      },
    });

    const resolved = Boolean(result[0]);
    const outcomeValue = Number(result[1]);

    return {
      resolved,
      outcome: resolved ? outcomeValue : undefined,
    };
  }

  /**
   * Register an oracle with stake and public key
   */
  async registerOracle(
    oracle: Account,
    stakeAmount: bigint | number | string,
    publicKeyBytes?: Uint8Array
  ): Promise<string> {
    const stake = this.toBigInt(stakeAmount).toString();
    const publicKey = publicKeyBytes ?? oracle.publicKey.toUint8Array();

    if (publicKey.length !== 32) {
      throw new Error("Oracle public key must be 32 bytes");
    }

    const transaction = await this.aptos.transaction.build.simple({
      sender: oracle.accountAddress,
      data: {
        function: `${this.moduleAddress}::oracle::register_oracle`,
        typeArguments: [],
        functionArguments: [stake, toByteArray(publicKey)],
      },
    });

    const pendingTxn = await this.aptos.signAndSubmitTransaction({
      signer: oracle,
      transaction,
    });

    await this.aptos.waitForTransaction({ transactionHash: pendingTxn.hash });
    return pendingTxn.hash;
  }

  /**
   * Submit oracle vote with automatic nonce tracking and signature generation
   */
  async submitOracleVote(
    oracle: Account,
    marketId: number,
    outcome: number,
    options?: OracleVoteOptions
  ): Promise<OracleVoteResult> {
    const oracleAddress = normalizeAddress(oracle.accountAddress.toString());
    const nonce = options?.nonce !== undefined ? this.toBigInt(options.nonce) : await this.getOracleNonceForAddress(oracleAddress);
    const message = this.buildOracleVoteMessage(marketId, outcome, nonce);

    const signatureBytes =
      options?.signature ??
      oracle.sign(message).toUint8Array();

    const transaction = await this.aptos.transaction.build.simple({
      sender: oracle.accountAddress,
      data: {
        function: `${this.moduleAddress}::oracle::submit_oracle_vote`,
        typeArguments: [],
        functionArguments: [
          marketId,
          outcome,
          nonce.toString(),
          toByteArray(signatureBytes),
        ],
      },
    });

    const pendingTxn = await this.aptos.signAndSubmitTransaction({
      signer: oracle,
      transaction,
    });

    await this.aptos.waitForTransaction({ transactionHash: pendingTxn.hash });

    return {
      hash: pendingTxn.hash,
      nonce,
      signature: signatureBytes,
    };
  }

  /**
   * Get oracle reputation details including nonce
   */
  async getOracleReputation(oracleAddress: string): Promise<OracleReputation | null> {
    const entry = await this.fetchOracleReputationEntry(oracleAddress);
    if (!entry) {
      return null;
    }

    const dataRecord = entry as Record<string, unknown>;
    const stakedAmountRaw = (entry.staked_amount ?? dataRecord.stakedAmount ?? "0") as string | number | bigint;
    const nonceRaw = (entry.nonce ?? dataRecord.nonce ?? "0") as string | number | bigint;

    return {
      address: normalizeAddress(oracleAddress),
      reputationScore: Number(entry.reputation_score ?? dataRecord.reputationScore ?? 0),
      totalVotes: Number(entry.total_votes ?? dataRecord.totalVotes ?? 0),
      correctVotes: Number(entry.correct_votes ?? dataRecord.correctVotes ?? 0),
      stakedAmount: this.toBigInt(stakedAmountRaw),
      isActive: Boolean(entry.is_active ?? dataRecord.isActive ?? false),
      nonce: this.toBigInt(nonceRaw),
    };
  }

  // ============= Access Control Functions =============

  /**
   * Check if user has a specific role
   */
  async hasRole(userAddress: string, role: Role): Promise<boolean> {
    const result = await this.aptos.view({
      payload: {
        function: `${this.moduleAddress}::access_control::has_role`,
        typeArguments: [],
        functionArguments: [userAddress, role],
      },
    });
    return result[0] as boolean;
  }

  /**
   * Check if user is admin
   */
  async isAdmin(userAddress: string): Promise<boolean> {
    const result = await this.aptos.view({
      payload: {
        function: `${this.moduleAddress}::access_control::is_admin`,
        typeArguments: [],
        functionArguments: [userAddress],
      },
    });
    return result[0] as boolean;
  }

  /**
   * Grant role to user (admin only)
   */
  async grantRole(
    admin: Account,
    userAddress: string,
    role: Role
  ): Promise<string> {
    const transaction = await this.aptos.transaction.build.simple({
      sender: admin.accountAddress,
      data: {
        function: `${this.moduleAddress}::access_control::grant_role`,
        typeArguments: [],
        functionArguments: [userAddress, role],
      },
    });

    const pendingTxn = await this.aptos.signAndSubmitTransaction({
      signer: admin,
      transaction,
    });

    await this.aptos.waitForTransaction({ transactionHash: pendingTxn.hash });
    return pendingTxn.hash;
  }

  /**
   * Revoke role from user (admin only)
   */
  async revokeRole(
    admin: Account,
    userAddress: string,
    role: Role
  ): Promise<string> {
    const transaction = await this.aptos.transaction.build.simple({
      sender: admin.accountAddress,
      data: {
        function: `${this.moduleAddress}::access_control::revoke_role`,
        typeArguments: [],
        functionArguments: [userAddress, role],
      },
    });

    const pendingTxn = await this.aptos.signAndSubmitTransaction({
      signer: admin,
      transaction,
    });

    await this.aptos.waitForTransaction({ transactionHash: pendingTxn.hash });
    return pendingTxn.hash;
  }

  // ============= Pause Functions =============

  /**
   * Check if system is paused
   */
  async isPaused(): Promise<boolean> {
    const result = await this.aptos.view({
      payload: {
        function: `${this.moduleAddress}::access_control::is_paused`,
        typeArguments: [],
        functionArguments: [],
      },
    });
    return result[0] as boolean;
  }

  /**
   * Pause the system (pauser role required)
   */
  async pause(pauser: Account): Promise<string> {
    const transaction = await this.aptos.transaction.build.simple({
      sender: pauser.accountAddress,
      data: {
        function: `${this.moduleAddress}::access_control::pause`,
        typeArguments: [],
        functionArguments: [],
      },
    });

    const pendingTxn = await this.aptos.signAndSubmitTransaction({
      signer: pauser,
      transaction,
    });

    await this.aptos.waitForTransaction({ transactionHash: pendingTxn.hash });
    return pendingTxn.hash;
  }

  /**
   * Unpause the system (admin role required)
   */
  async unpause(admin: Account): Promise<string> {
    const transaction = await this.aptos.transaction.build.simple({
      sender: admin.accountAddress,
      data: {
        function: `${this.moduleAddress}::access_control::unpause`,
        typeArguments: [],
        functionArguments: [],
      },
    });

    const pendingTxn = await this.aptos.signAndSubmitTransaction({
      signer: admin,
      transaction,
    });

    await this.aptos.waitForTransaction({ transactionHash: pendingTxn.hash });
    return pendingTxn.hash;
  }

  /**
   * Alias for compatibility with strategic plan naming
   */
  async isSystemPaused(): Promise<boolean> {
    return this.isPaused();
  }

  /**
   * Alias for compatibility with strategic plan naming
   */
  async pauseSystem(pauser: Account): Promise<string> {
    return this.pause(pauser);
  }

  /**
   * Alias for compatibility with strategic plan naming
   */
  async unpauseSystem(admin: Account): Promise<string> {
    return this.unpause(admin);
  }

  // ============= Dispute Functions =============

  /**
   * Create a dispute for a market resolution
   */
  async createDispute(
    disputer: Account,
    options: CreateDisputeOptions
  ): Promise<string> {
    const adminAddress = options.adminAddress ?? this.moduleAddress;
    const evidenceBytes = Array.from(new TextEncoder().encode(options.evidence));
    const hashBytes = options.evidenceHash ? Array.from(options.evidenceHash) : [];
    const stake = BigInt(options.stakeAmount).toString();

    const transaction = await this.aptos.transaction.build.simple({
      sender: disputer.accountAddress,
      data: {
        function: `${this.moduleAddress}::dispute_resolution::create_dispute`,
        typeArguments: [],
        functionArguments: [
          adminAddress,
          options.marketId,
          options.disputedOutcome,
          options.proposedOutcome,
          options.reason,
          evidenceBytes,
          hashBytes,
          stake,
        ],
      },
    });

    const pendingTxn = await this.aptos.signAndSubmitTransaction({
      signer: disputer,
      transaction,
    });

    await this.aptos.waitForTransaction({ transactionHash: pendingTxn.hash });
    return pendingTxn.hash;
  }

  /**
   * Vote on a dispute
   */
  async voteOnDispute(
    voter: Account,
    options: VoteOnDisputeOptions
  ): Promise<string> {
    const adminAddress = options.adminAddress ?? this.moduleAddress;
    const reasoningBytes = Array.from(new TextEncoder().encode(options.reasoning));

    const transaction = await this.aptos.transaction.build.simple({
      sender: voter.accountAddress,
      data: {
        function: `${this.moduleAddress}::dispute_resolution::submit_vote`,
        typeArguments: [],
        functionArguments: [
          adminAddress,
          options.disputeId,
          options.voteOutcome,
          reasoningBytes,
        ],
      },
    });

    const pendingTxn = await this.aptos.signAndSubmitTransaction({
      signer: voter,
      transaction,
    });

    await this.aptos.waitForTransaction({ transactionHash: pendingTxn.hash });
    return pendingTxn.hash;
  }

  /**
   * Get dispute information
   */
  async getDispute(disputeId: number, adminAddress?: string): Promise<DisputeInfo> {
    const storeAddress = adminAddress ?? this.moduleAddress;
    const result = await this.aptos.view({
      payload: {
        function: `${this.moduleAddress}::dispute_resolution::get_dispute_info`,
        typeArguments: [],
        functionArguments: [storeAddress, disputeId],
      },
    });

    const [
      marketId,
      disputer,
      disputedOutcome,
      proposedOutcome,
      reason,
      votingDeadline,
      status,
    ] = result;

    return {
      marketId: Number(marketId),
      disputer: disputer as string,
      disputedOutcome: Number(disputedOutcome),
      proposedOutcome: Number(proposedOutcome),
      reason: Number(reason),
      votingDeadline: Number(votingDeadline),
      status: Number(status) as DisputeStatus,
    };
  }

  /**
   * Alias matching documentation naming
   */
  async getDisputeStatus(disputeId: number, adminAddress?: string): Promise<DisputeInfo> {
    return this.getDispute(disputeId, adminAddress);
  }

  // ============= Utility Functions =============

  /**
   * Get Aptos client instance
   */
  getAptosClient(): Aptos {
    return this.aptos;
  }

  /**
   * Get module address
   */
  getModuleAddress(): string {
    return this.moduleAddress;
  }

  static readonly RESOLUTION_SOURCE = ResolutionSource;
}
