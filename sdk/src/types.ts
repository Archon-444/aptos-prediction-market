/**
 * Types for Move Market SDK
 */

export enum Role {
  ADMIN = 0,
  MARKET_CREATOR = 1,
  RESOLVER = 2,
  ORACLE_MANAGER = 3,
  PAUSER = 4,
}

export enum DisputeStatus {
  PENDING = 1,
  IN_VOTING = 2,
  RESOLVED = 3,
  REJECTED = 4,
}

export enum ResolutionSource {
  MANUAL = 0,
  PYTH = 1,
  CUSTOM = 2,
}

export enum ResolutionStrategy {
  PYTH_ONLY = 0,
  PYTH_WITH_OPTIMISTIC_FALLBACK = 1,
  OPTIMISTIC_ONLY = 2,
}

export interface Market {
  id: number;
  question: string;
  outcomes: string[];
  endTime: number;
  resolved: boolean;
  winningOutcome?: number;
  totalStake: bigint;
  outcomeStakes: bigint[];
  creator: string;
}

export interface UserPosition {
  marketId: number;
  outcome: number;
  stake: bigint;
  shares: bigint;
  claimed: boolean;
}

export interface Bet {
  marketId: number;
  outcome: number;
  amount: bigint;
  timestamp: number;
  user: string;
}

export interface DisputeInfo {
  marketId: number;
  disputer: string;
  disputedOutcome: number;
  proposedOutcome: number;
  reason: number;
  votingDeadline: number;
  status: DisputeStatus;
}

export interface ResolutionInfo {
  resolved: boolean;
  winningOutcome: number;
  source: ResolutionSource;
  strategy: ResolutionStrategy;
}

export interface PythPrice {
  hasSnapshot: boolean;
  price: bigint;
  priceNegative: boolean;
  confidence: bigint;
  expo: number;
  expoNegative: boolean;
  publishTime: number;
  receivedAt: number;
}

export interface SDKConfig {
  network: "mainnet" | "testnet" | "devnet";
  moduleAddress: string;
  nodeUrl?: string;
}

export interface PredictionMarketError extends Error {
  code: string;
  details?: unknown;
}

export interface OracleResolution {
  resolved: boolean;
  outcome?: number;
}

export interface OracleReputation {
  address: string;
  reputationScore: number;
  totalVotes: number;
  correctVotes: number;
  stakedAmount: bigint;
  isActive: boolean;
  nonce: bigint;
}

export interface OracleVoteOptions {
  nonce?: bigint | number | string;
  signature?: Uint8Array;
}

export interface OracleVoteResult {
  hash: string;
  nonce: bigint;
  signature: Uint8Array;
}
