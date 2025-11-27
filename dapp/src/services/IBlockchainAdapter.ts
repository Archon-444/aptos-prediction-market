export interface Market {
  id: number;
  question: string;
  outcomes: string[];
  outcomeStakes: number[];
  endTime: number;
  resolved: boolean;
  winningOutcome: number;
  totalStakes: number;
  creator: string;
  createdAt: number;
  resolutionTime: number;
}

export interface UserPosition {
  outcome: number;
  stake: number;
  shares: number;
  claimed: boolean;
}

export interface TransactionResult {
  hash: string;
  success: boolean;
}

/**
 * Chain-agnostic blockchain adapter interface.
 * All blockchain SDKs must implement this contract so hooks can stay portable.
 */
export interface IBlockchainAdapter {
  // Market operations
  getMarketCount(): Promise<number>;
  getMarket(marketId: number): Promise<Market>;
  getOdds(marketId: number): Promise<number[]>;

  // User-centric queries
  getBalance(address: string): Promise<number>;
  getUserPosition(marketId: number, address: string): Promise<UserPosition | null>;

  // Transactions (wallet-signed via higher level hooks)
  placeBet(marketId: number, outcome: number, amount: number): Promise<TransactionResult>;
  claimWinnings(marketId: number): Promise<TransactionResult>;

  // Utility helpers
  fromMicroUSDC(amount: number): number;
  toMicroUSDC(amount: number): number;
  formatUSDC(amount: number): string;

  // Network metadata
  getNetwork(): string;
  getModuleAddress(): string;
}
