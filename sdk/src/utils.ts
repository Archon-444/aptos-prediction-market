/**
 * Utility functions for the Prediction Market SDK
 */

import { Role } from "./types";

/**
 * Convert USDC amount to micro-USDC (6 decimals)
 */
export function toMicroUSDC(amount: number): bigint {
  return BigInt(Math.floor(amount * 1_000_000));
}

/**
 * Convert micro-USDC to USDC
 */
export function fromMicroUSDC(microAmount: bigint): number {
  return Number(microAmount) / 1_000_000;
}

/**
 * Format USDC amount for display
 */
export function formatUSDC(microAmount: bigint, decimals: number = 2): string {
  const amount = fromMicroUSDC(microAmount);
  return amount.toFixed(decimals);
}

/**
 * Calculate hours until timestamp
 */
export function hoursUntil(timestamp: number): number {
  const now = Date.now() / 1000;
  const diff = timestamp - now;
  return Math.max(0, diff / 3600);
}

/**
 * Check if market has expired
 */
export function isMarketExpired(endTime: number): boolean {
  return Date.now() / 1000 > endTime;
}

/**
 * Get role name from enum
 */
export function getRoleName(role: Role): string {
  const roleNames: Record<Role, string> = {
    [Role.ADMIN]: "Admin",
    [Role.MARKET_CREATOR]: "Market Creator",
    [Role.RESOLVER]: "Resolver",
    [Role.ORACLE_MANAGER]: "Oracle Manager",
    [Role.PAUSER]: "Pauser",
  };
  return roleNames[role];
}

/**
 * Calculate implied probability from odds (basis points)
 */
export function oddsToProbability(odds: number): number {
  // Odds are in basis points (0-10000 = 0-100%)
  return odds / 100; // Convert to percentage
}

/**
 * Format probability for display
 */
export function formatProbability(odds: number): string {
  return `${oddsToProbability(odds).toFixed(1)}%`;
}

/**
 * Calculate potential profit from a bet
 */
export function calculateProfit(betAmount: bigint, payout: bigint): bigint {
  return payout - betAmount;
}

/**
 * Format profit/loss with +/- sign
 */
export function formatProfitLoss(profit: bigint): string {
  const sign = profit >= 0n ? "+" : "";
  return `${sign}${formatUSDC(profit)} USDC`;
}

/**
 * Validate market question length
 */
export function isValidQuestion(question: string): boolean {
  return question.length >= 10 && question.length <= 500;
}

/**
 * Validate outcome names
 */
export function areValidOutcomes(outcomes: string[]): boolean {
  if (outcomes.length < 2 || outcomes.length > 10) return false;
  return outcomes.every((o) => o.length >= 1 && o.length <= 100);
}

/**
 * Validate bet amount (minimum 1 USDC)
 */
export function isValidBetAmount(amount: bigint): boolean {
  const MIN_BET = toMicroUSDC(1); // 1 USDC
  return amount >= MIN_BET;
}

/**
 * Get network explorer URL
 */
export function getExplorerUrl(
  network: "mainnet" | "testnet" | "devnet",
  txHash: string
): string {
  const baseUrls = {
    mainnet: "https://explorer.aptoslabs.com",
    testnet: "https://explorer.aptoslabs.com/?network=testnet",
    devnet: "https://explorer.aptoslabs.com/?network=devnet",
  };
  return `${baseUrls[network]}/txn/${txHash}`;
}

/**
 * Parse error message from transaction
 */
export function parseTransactionError(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const err = error as { message?: string; vm_status?: string };
    if (err.vm_status) {
      // Parse Move abort codes
      const match = err.vm_status.match(/ABORTED.*code (\d+)/);
      if (match) {
        const code = parseInt(match[1], 10);
        return getErrorMessage(code);
      }
    }
    if (err.message) {
      return err.message;
    }
  }
  return "Unknown error occurred";
}

/**
 * Get user-friendly error message from error code
 */
function getErrorMessage(code: number): string {
  const errorMessages: Record<number, string> = {
    1: "Not authorized to perform this action",
    2: "Market not found",
    3: "Market has not expired yet",
    4: "Market already resolved",
    5: "Invalid outcome",
    6: "Already initialized",
    7: "System is paused",
    8: "Bet amount below minimum",
    9: "Market already expired",
    10: "Insufficient balance",
    // Add more error codes as needed
  };
  return errorMessages[code] || `Error code: ${code}`;
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, i);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}
