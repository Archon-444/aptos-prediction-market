import type { IBlockchainAdapter, Market, TransactionResult, UserPosition } from './IBlockchainAdapter';
import { MoveMarketSDK } from './MoveMarketSDK';

/**
 * Adapter wrapper around the Aptos-specific SDK so the rest of the app
 * can talk to any supported blockchain using a shared surface.
 */
export class AptosAdapter implements IBlockchainAdapter {
  private readonly sdk: MoveMarketSDK;
  private readonly network: string;

  constructor(
    network: string,
    moduleAddress: string,
    usdcAddress?: string
  ) {
    this.network = network;
    this.sdk = new MoveMarketSDK(network, moduleAddress, usdcAddress);
  }

  async getMarketCount(): Promise<number> {
    return this.sdk.getMarketCount();
  }

  async getMarket(marketId: number): Promise<Market> {
    return this.sdk.getMarket(marketId);
  }

  async getOdds(marketId: number): Promise<number[]> {
    return this.sdk.getOdds(marketId);
  }

  async getBalance(address: string): Promise<number> {
    return this.sdk.getUSDCBalance(address);
  }

  async getUserPosition(marketId: number, address: string): Promise<UserPosition | null> {
    return this.sdk.getUserPosition(address, marketId);
  }

  async placeBet(): Promise<TransactionResult> {
    throw new Error('Use Aptos transaction hooks for wallet-signed operations');
  }

  async claimWinnings(): Promise<TransactionResult> {
    throw new Error('Use Aptos transaction hooks for wallet-signed operations');
  }

  fromMicroUSDC(amount: number): number {
    return this.sdk.fromMicroUSDC(amount);
  }

  toMicroUSDC(amount: number): number {
    return this.sdk.toMicroUSDC(amount);
  }

  formatUSDC(amount: number): string {
    return this.sdk.formatUSDC(amount);
  }

  getNetwork(): string {
    return this.network;
  }

  getModuleAddress(): string {
    return this.sdk.getModuleAddress();
  }

  getUsdcModuleAddress(): string {
    return this.sdk.getUsdcModuleAddress();
  }

  getUnderlyingSDK(): MoveMarketSDK {
    return this.sdk;
  }
}
