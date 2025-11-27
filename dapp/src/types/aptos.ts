// TypeScript interfaces for Aptos SDK responses and transactions

/**
 * Transaction payload structure for Aptos Move function calls
 */
export interface MoveTransactionPayload {
  function: string;
  functionArguments: any[];
  typeArguments?: string[];
}

/**
 * Complete transaction data including sender
 */
export interface TransactionData {
  sender: string;
  data: MoveTransactionPayload;
}

/**
 * Transaction response from wallet
 */
export interface TransactionResponse {
  hash: string;
  success?: boolean;
  vm_status?: string;
}

/**
 * View function result from blockchain
 */
export type ViewResult = readonly unknown[];

/**
 * Market view result structure
 */
export interface MarketViewResult {
  question: number[] | string;
  outcomes: (number[] | string)[];
  outcomeStakes: (number | string)[];
  endTime: number | string;
  resolved: boolean;
  winningOutcome: number | string;
  totalStakes: number | string;
  creator: string;
  createdAt: number | string;
  resolutionTime: number | string;
}

/**
 * User position view result structure
 */
export interface UserPositionViewResult {
  outcome: number | string;
  stake: number | string;
  shares: number | string;
  claimed: boolean;
}

/**
 * USDC balance view result
 */
export type USDCBalanceResult = readonly [number | string];

/**
 * Market count view result
 */
export type MarketCountResult = readonly [number | string];

/**
 * Odds view result
 */
export type OddsResult = readonly [(number | string)[]];

/**
 * Boolean view result
 */
export type BooleanResult = readonly [boolean];

/**
 * Type guard to check if transaction was successful
 */
export function isSuccessfulTransaction(response: any): response is TransactionResponse {
  return response && typeof response.hash === 'string';
}

/**
 * Type guard to check if view result is valid
 */
export function isValidViewResult(result: unknown): result is ViewResult {
  return Array.isArray(result) && result.length > 0;
}
