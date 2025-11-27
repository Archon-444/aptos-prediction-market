/**
 * Move Market SDK
 *
 * A comprehensive TypeScript SDK for interacting with the Move Market smart contracts.
 *
 * @module @aptos-prediction-market/sdk
 */

export { PredictionMarketClient } from "./client";
export * from "./types";
export * from "./utils";

// Re-export commonly used Aptos SDK types
export type { Account, Aptos } from "@aptos-labs/ts-sdk";
