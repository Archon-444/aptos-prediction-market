// Move Market SDK for Frontend
import type { Account, Network } from "@aptos-labs/ts-sdk";
import {
  isValidAptosAddress,
  validateMarketId,
  validateOutcomeId,
  toMicroUSDC as safeToMicroUSDC,
  fromMicroUSDC as safeFromMicroUSDC,
  VALIDATION_CONSTANTS
} from "../utils/validation";

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

export interface ResolutionMetadata {
  resolved: boolean;
  winningOutcome: number;
  source: number;
  strategy: number;
}

export interface PythPriceSnapshot {
  hasSnapshot: boolean;
  price: bigint;
  priceNegative: boolean;
  confidence: bigint;
  expo: number;
  expoNegative: boolean;
  publishTime: number;
  receivedAt: number;
}

type NetworkName = Network | 'local' | string;

type AptosModule = typeof import('@aptos-labs/ts-sdk');
type AptosClient = import('@aptos-labs/ts-sdk').Aptos;
type AptosConfigCtor = import('@aptos-labs/ts-sdk').AptosConfig;

let aptosModulePromise: Promise<AptosModule> | null = null;

const loadAptosModule = async (): Promise<AptosModule> => {
  if (!aptosModulePromise) {
    aptosModulePromise = import('@aptos-labs/ts-sdk');
  }
  return aptosModulePromise;
};

export class MoveMarketSDK {
  private aptos: AptosClient | null = null;
  private aptosLoadPromise: Promise<AptosClient> | null = null;
  private moduleAddress: string;
  private usdcModuleAddress: string;
  private network: NetworkName;

  constructor(
    network: NetworkName = 'devnet',
    moduleAddress: string,
    usdcModuleAddress?: string
  ) {
    this.network = network;
    this.moduleAddress = moduleAddress;
    this.usdcModuleAddress = usdcModuleAddress ?? moduleAddress;
  }

  public getModuleAddress(): string {
    return this.moduleAddress;
  }

  public getUsdcModuleAddress(): string {
    return this.usdcModuleAddress;
  }

  // ============ USDC Functions ============

  private async getAptosClient(): Promise<AptosClient> {
    if (this.aptos) {
      return this.aptos;
    }

    if (!this.aptosLoadPromise) {
      this.aptosLoadPromise = loadAptosModule().then(({ Aptos, AptosConfig }) => {
        const config = new AptosConfig({ network: this.network as Network });
        return new Aptos(config);
      });
    }

    this.aptos = await this.aptosLoadPromise;
    return this.aptos;
  }

  /**
   * Get USDC balance for an address
   */
  async getUSDCBalance(address: string): Promise<number> {
    if (!isValidAptosAddress(address)) {
      throw new Error("Invalid Aptos address format");
    }
    try {
      // Skip USDC balance fetching if USDC address is not configured
      if (!this.usdcModuleAddress || this.usdcModuleAddress === '0x1') {
        console.warn('[MoveMarketSDK] USDC address not configured, returning 0 balance');
        return 0;
      }

      const aptos = await this.getAptosClient();
      // USDC on Aptos uses Fungible Asset standard, not legacy Coin
      // The metadata object address IS the USDC address
      const metadataAddress = this.usdcModuleAddress;
      const balance = await aptos.view({
        payload: {
          function: '0x1::primary_fungible_store::balance',
          typeArguments: [`0x1::fungible_asset::Metadata`],
          functionArguments: [address, metadataAddress],
        },
      });
      return Number(balance[0]);
    } catch (error: any) {
      console.error("Error fetching USDC balance:", error);
      // Return 0 instead of throwing error to prevent UI crashes
      console.warn(`[MoveMarketSDK] Failed to get USDC balance for ${address}, returning 0: ${error.message}`);
      return 0;
    }
  }

  /**
   * Register account to receive USDC
   */
  async registerForUSDC(account: Account): Promise<string> {
    const aptos = await this.getAptosClient();
    // USDC uses Fungible Asset - primary fungible store is created automatically
    // when first receiving tokens, so this function may not be needed
    const metadataAddress = this.usdcModuleAddress;
    const transaction = await aptos.transaction.build.simple({
      sender: account.accountAddress,
      data: {
        function: '0x1::primary_fungible_store::create_primary_store_enabled_fungible_asset',
        typeArguments: [`0x1::fungible_asset::Metadata`],
        functionArguments: [metadataAddress],
      },
    });

    const committedTxn = await aptos.signAndSubmitTransaction({
      signer: account,
      transaction,
    });

    const result = await aptos.waitForTransaction({
      transactionHash: committedTxn.hash,
    });

    return result.hash;
  }

  /**
   * Claim test USDC from faucet (1000 USDC)
   */
  async claimUSDCFromFaucet(account: Account): Promise<string> {
    if (!this.usdcModuleAddress) {
      throw new Error('USDC module address is not configured');
    }
    // Circle's USDC doesn't have an on-chain faucet
    // Users must get testnet USDC from https://faucet.circle.com
    throw new Error('USDC faucet is not available on-chain. Get testnet USDC from https://faucet.circle.com');
  }

  // ============ Market Functions ============

  /**
   * Get total number of markets
   */
  async getMarketCount(): Promise<number> {
    const aptos = await this.getAptosClient();
    const result = await aptos.view({
      payload: {
        function: `${this.moduleAddress}::market_manager::get_market_count`,
        functionArguments: [],
      },
    });
    return Number(result[0]);
  }

  /**
   * Get market details by ID
   */
  async getMarket(marketId: number): Promise<Market> {
    validateMarketId(marketId);

    try {
      const aptos = await this.getAptosClient();
      const result = await aptos.view({
        payload: {
          function: `${this.moduleAddress}::market_manager::get_market_full`,
          functionArguments: [marketId],
        },
      });

      if (!result || result.length < 10) {
        throw new Error("Invalid market data returned");
      }

      return {
        id: marketId,
        question: this.bytesToString(result[0]),
        outcomes: Array.isArray(result[1]) ? (result[1] as unknown[]).map(o => this.bytesToString(o)) : [],
        outcomeStakes: Array.isArray(result[2]) ? (result[2] as unknown[]).map(s => Number(s)) : [],
        endTime: Number(result[3]),
        resolved: Boolean(result[4]),
        winningOutcome: Number(result[5]),
        totalStakes: Number(result[6]),
        creator: String(result[7]),
        createdAt: Number(result[8]),
        resolutionTime: Number(result[9]),
      };
    } catch (error: any) {
      console.error(`Error getting market ${marketId}:`, error);
      throw new Error(`Failed to get market ${marketId}: ${error.message}`);
    }
  }

  /**
   * Check if market is active
   */
  async isMarketActive(marketId: number): Promise<boolean> {
    const aptos = await this.getAptosClient();
    const result = await aptos.view({
      payload: {
        function: `${this.moduleAddress}::market_manager::is_market_active`,
        functionArguments: [marketId],
      },
    });
    return Boolean(result[0]);
  }

  /**
   * Get market odds (in basis points, 10000 = 100%)
   */
  async getOdds(marketId: number): Promise<number[]> {
    const aptos = await this.getAptosClient();
    const result = await aptos.view({
      payload: {
        function: `${this.moduleAddress}::betting::get_odds`,
        functionArguments: [marketId],
      },
    });

    return (result[0] as any[]).map(o => Number(o));
  }

  /**
   * Calculate potential payout
   */
  async calculatePayout(
    marketId: number,
    stake: number,
    outcome: number
  ): Promise<number> {
    const aptos = await this.getAptosClient();
    const result = await aptos.view({
      payload: {
        function: `${this.moduleAddress}::betting::calculate_payout`,
        functionArguments: [marketId, stake, outcome],
      },
    });

    return Number(result[0]);
  }

  /**
   * Create a new market
   */
  async createMarket(
    account: Account,
    question: string,
    outcomes: string[],
    durationHours: number
  ): Promise<string> {
    const aptos = await this.getAptosClient();
    const transaction = await aptos.transaction.build.simple({
      sender: account.accountAddress,
      data: {
        function: `${this.moduleAddress}::market_manager::create_market`,
        functionArguments: [
          Array.from(new TextEncoder().encode(question)),
          outcomes.map(o => Array.from(new TextEncoder().encode(o))),
          durationHours,
        ],
      },
    });

    const committedTxn = await aptos.signAndSubmitTransaction({
      signer: account,
      transaction,
    });

    const result = await aptos.waitForTransaction({
      transactionHash: committedTxn.hash,
    });

    return result.hash;
  }

  /**
   * Place a bet on a market with retry logic and validation
   */
  async placeBet(
    account: Account,
    marketId: number,
    outcome: number,
    amountUSDC: number // In micro-USDC (1 USDC = 1_000_000)
  ): Promise<string> {
    // Input validation using centralized validation functions
    validateMarketId(marketId);
    validateOutcomeId(outcome);

    // Validate amountUSDC is in micro-USDC and within bounds
    if (!Number.isInteger(amountUSDC) || amountUSDC <= 0) {
      throw new Error("Invalid amount: must be a positive integer in micro-USDC");
    }
    if (amountUSDC < VALIDATION_CONSTANTS.MIN_BET_MICRO_USDC) {
      throw new Error(`Minimum bet is ${VALIDATION_CONSTANTS.MIN_BET_USDC} USDC`);
    }
    if (amountUSDC > VALIDATION_CONSTANTS.MAX_BET_MICRO_USDC) {
      throw new Error(`Maximum bet is ${VALIDATION_CONSTANTS.MAX_BET_USDC} USDC`);
    }

    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 2000;
    let lastError: Error | null = null;
    const aptos = await this.getAptosClient();

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const transaction = await aptos.transaction.build.simple({
          sender: account.accountAddress,
          data: {
            function: `${this.moduleAddress}::betting::place_bet`,
            functionArguments: [marketId, outcome, amountUSDC],
          },
        });

        const committedTxn = await aptos.signAndSubmitTransaction({
          signer: account,
          transaction,
        });

        const result = await aptos.waitForTransaction({
          transactionHash: committedTxn.hash,
        });

        // Check if transaction was successful
        if (result.success !== false) {
          console.log(`Bet placed successfully on attempt ${attempt + 1}`);
          return result.hash;
        } else {
          throw new Error(`Transaction failed on-chain: ${result.vm_status || 'Unknown error'}`);
        }
      } catch (error: any) {
        lastError = error;
        console.error(`Attempt ${attempt + 1} failed:`, error.message);

        // Check if error is retryable
        const isRetryable =
          error.message?.includes("timeout") ||
          error.message?.includes("Sequence number") ||
          error.message?.includes("network") ||
          error.message?.includes("connection");

        if (!isRetryable || attempt === MAX_RETRIES - 1) {
          // Don't retry for non-retryable errors or if this was the last attempt
          break;
        }

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }

    // If we got here, all retries failed
    throw new Error(
      `Failed to place bet after ${MAX_RETRIES} attempts. Last error: ${lastError?.message || 'Unknown error'}`
    );
  }

  /**
   * Resolve a market (admin only)
   */
  async resolveMarket(
    account: Account,
    marketId: number,
    winningOutcome: number
  ): Promise<string> {
    const aptos = await this.getAptosClient();
    const resolveTransaction = await aptos.transaction.build.simple({
      sender: account.accountAddress,
      data: {
        function: `${this.moduleAddress}::market_manager::resolve_market`,
        functionArguments: [marketId, winningOutcome],
      },
    });

    const resolveCommittedTxn = await aptos.signAndSubmitTransaction({
      signer: account,
      transaction: resolveTransaction,
    });

    await aptos.waitForTransaction({
      transactionHash: resolveCommittedTxn.hash,
    });

    // Also unlock the collateral
    const unlockTransaction = await aptos.transaction.build.simple({
      sender: account.accountAddress,
      data: {
        function: `${this.moduleAddress}::betting::unlock_market_collateral`,
        functionArguments: [marketId],
      },
    });

    const unlockCommittedTxn = await aptos.signAndSubmitTransaction({
      signer: account,
      transaction: unlockTransaction,
    });

    const result = await aptos.waitForTransaction({
      transactionHash: unlockCommittedTxn.hash,
    });

    return result.hash;
  }

  /**
   * Claim winnings from a resolved market
   */
  async claimWinnings(
    account: Account,
    marketId: number
  ): Promise<string> {
    validateMarketId(marketId);

    try {
      // First check if market is resolved
      const market = await this.getMarket(marketId);
      if (!market.resolved) {
        throw new Error(`Market ${marketId} is not yet resolved. Cannot claim winnings.`);
      }

      const aptos = await this.getAptosClient();
      const transaction = await aptos.transaction.build.simple({
        sender: account.accountAddress,
        data: {
          function: `${this.moduleAddress}::betting::claim_winnings`,
          functionArguments: [marketId],
        },
      });

      const committedTxn = await aptos.signAndSubmitTransaction({
        signer: account,
        transaction,
      });

      const result = await aptos.waitForTransaction({
        transactionHash: committedTxn.hash,
      });

      if (result.success !== false) {
        console.log(`Winnings claimed successfully for market ${marketId}`);
        return result.hash;
      } else {
        throw new Error(`Transaction failed: ${result.vm_status || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error(`Error claiming winnings for market ${marketId}:`, error);
      throw new Error(`Failed to claim winnings: ${error.message}`);
    }
  }

  // ============ Vault Functions ============

  /**
   * Get vault balance
   */
  async getVaultBalance(): Promise<number> {
    const aptos = await this.getAptosClient();
    const result = await aptos.view({
      payload: {
        function: `${this.moduleAddress}::collateral_vault::get_vault_balance`,
        functionArguments: [this.moduleAddress],
      },
    });

    return Number(result[0]);
  }

  /**
   * Get user position for a market
   */
  async getUserPosition(userAddress: string, marketId: number): Promise<UserPosition | null> {
    if (!isValidAptosAddress(userAddress)) {
      throw new Error("Invalid Aptos address format");
    }
    validateMarketId(marketId);

    try {
      const aptos = await this.getAptosClient();
      const result = await aptos.view({
        payload: {
          function: `${this.moduleAddress}::collateral_vault::get_user_position`,
          functionArguments: [userAddress, marketId],
        },
      });

      if (!result || result.length < 4) {
        return null;
      }

      const outcome = Number(result[0]);
      const stake = Number(result[1]);
      const shares = Number(result[2]);
      const claimed = Boolean(result[3]);

      if (stake === 0 && shares === 0) {
        return null;
      }

      return {
        outcome,
        stake,
        shares,
        claimed,
      };
    } catch (error: any) {
      console.error("Error fetching user position:", error);
      // Return null for user positions that don't exist rather than throwing
      if (error.message?.includes("not found") || error.message?.includes("does not exist")) {
        return null;
      }
      throw new Error(`Failed to get user position: ${error.message}`);
    }
  }

  /**
   * Check if user has a position in a market
   */
  async hasPosition(userAddress: string, marketId: number): Promise<boolean> {
    try {
      const aptos = await this.getAptosClient();
      const result = await aptos.view({
        payload: {
          function: `${this.moduleAddress}::collateral_vault::has_position`,
          functionArguments: [userAddress, marketId],
        },
      });
      return Boolean(result[0]);
    } catch (error) {
      return false;
    }
  }

  // ============ Utility Functions ============

  /**
   * Convert USDC amount to micro-USDC with overflow protection
   */
  toMicroUSDC(usdc: number): number {
    return safeToMicroUSDC(usdc);
  }

  /**
   * Convert micro-USDC to USDC
   */
  fromMicroUSDC(microUsdc: number): number {
    return safeFromMicroUSDC(microUsdc);
  }

  /**
   * Format USDC amount for display
   */
  formatUSDC(microUsdc: number): string {
    return `$${this.fromMicroUSDC(microUsdc).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    })}`;
  }

  /**
   * Convert odds from basis points to percentage
   */
  oddsToPercentage(odds: number): number {
    return odds / 100; // 10000 basis points = 100%
  }

  /**
   * Format odds for display
   */
  formatOdds(odds: number): string {
    return `${this.oddsToPercentage(odds).toFixed(2)}%`;
  }

  private bytesToString(bytes: any): string {
    if (typeof bytes === 'string') {
      return bytes;
    }
    if (Array.isArray(bytes)) {
      return new TextDecoder().decode(new Uint8Array(bytes));
    }
    return String(bytes);
  }

  // ============ RBAC Functions ============

  /**
   * Check if a user has a specific role
   * @param userAddress User address to check
   * @param role Role ID (0=Admin, 1=MarketCreator, 2=Resolver, 3=OracleManager, 4=Pauser)
   */
  async hasRole(userAddress: string, role: number): Promise<boolean> {
    if (!isValidAptosAddress(userAddress)) {
      throw new Error("Invalid Aptos address format");
    }
    if (role < 0 || role > 4) {
      throw new Error("Invalid role ID. Must be 0-4");
    }

    try {
      const aptos = await this.getAptosClient();
      const result = await aptos.view({
        payload: {
          function: `${this.moduleAddress}::access_control::has_role`,
          functionArguments: [userAddress, role],
        },
      });
      return Boolean(result[0]);
    } catch (error: any) {
      console.error(`Error checking role for ${userAddress}:`, error);
      return false;
    }
  }

  /**
   * Check if a user is admin (has ROLE_ADMIN)
   */
  async isAdmin(userAddress: string): Promise<boolean> {
    return this.hasRole(userAddress, 0); // ROLE_ADMIN = 0
  }

  /**
   * Grant a role to a user (admin only)
   * @param admin Admin account (must have ROLE_ADMIN)
   * @param userAddress Address to grant role to
   * @param role Role ID to grant
   */
  async grantRole(
    admin: Account,
    userAddress: string,
    role: number
  ): Promise<string> {
    if (!isValidAptosAddress(userAddress)) {
      throw new Error("Invalid user address format");
    }
    if (role < 0 || role > 4) {
      throw new Error("Invalid role ID. Must be 0-4 (0=Admin, 1=MarketCreator, 2=Resolver, 3=OracleManager, 4=Pauser)");
    }

    try {
      const aptos = await this.getAptosClient();
      const transaction = await aptos.transaction.build.simple({
        sender: admin.accountAddress,
        data: {
          function: `${this.moduleAddress}::access_control::grant_role`,
          functionArguments: [userAddress, role],
        },
      });

      const committedTxn = await aptos.signAndSubmitTransaction({
        signer: admin,
        transaction,
      });

      const result = await aptos.waitForTransaction({
        transactionHash: committedTxn.hash,
      });

      return result.hash;
    } catch (error: any) {
      console.error(`Error granting role ${role} to ${userAddress}:`, error);
      throw new Error(`Failed to grant role: ${error.message}`);
    }
  }

  /**
   * Revoke a role from a user (admin only)
   * @param admin Admin account (must have ROLE_ADMIN)
   * @param userAddress Address to revoke role from
   * @param role Role ID to revoke
   */
  async revokeRole(
    admin: Account,
    userAddress: string,
    role: number
  ): Promise<string> {
    if (!isValidAptosAddress(userAddress)) {
      throw new Error("Invalid user address format");
    }
    if (role < 0 || role > 4) {
      throw new Error("Invalid role ID. Must be 0-4");
    }

    try {
      const aptos = await this.getAptosClient();
      const transaction = await aptos.transaction.build.simple({
        sender: admin.accountAddress,
        data: {
          function: `${this.moduleAddress}::access_control::revoke_role`,
          functionArguments: [userAddress, role],
        },
      });

      const committedTxn = await aptos.signAndSubmitTransaction({
        signer: admin,
        transaction,
      });

      const result = await aptos.waitForTransaction({
        transactionHash: committedTxn.hash,
      });

      return result.hash;
    } catch (error: any) {
      console.error(`Error revoking role ${role} from ${userAddress}:`, error);
      throw new Error(`Failed to revoke role: ${error.message}`);
    }
  }

  /**
   * Get all roles for a user
   * Returns array of role names
   */
  async getUserRoles(userAddress: string): Promise<string[]> {
    if (!isValidAptosAddress(userAddress)) {
      throw new Error("Invalid Aptos address format");
    }

    const roleNames = ['Admin', 'MarketCreator', 'Resolver', 'OracleManager', 'Pauser'];
    const roles: string[] = [];

    for (let i = 0; i < 5; i++) {
      const hasRole = await this.hasRole(userAddress, i);
      if (hasRole) {
        roles.push(roleNames[i]);
      }
    }

    return roles;
  }

  // ============ Pause Mechanism Functions ============

  /**
   * Check if the system is currently paused
   */
  async isSystemPaused(): Promise<boolean> {
    try {
      const aptos = await this.getAptosClient();
      const result = await aptos.view({
        payload: {
          function: `${this.moduleAddress}::access_control::is_paused`,
          functionArguments: [],
        },
      });
      return Boolean(result[0]);
    } catch (error: any) {
      console.error("Error checking pause status:", error);
      // Return false on error to avoid blocking operations
      return false;
    }
  }

  /**
   * Pause the system (admin or pauser only)
   * Prevents market creation, betting, and resolution
   * Users can still claim winnings during pause
   */
  async pauseSystem(admin: Account): Promise<string> {
    try {
      const aptos = await this.getAptosClient();
      const transaction = await aptos.transaction.build.simple({
        sender: admin.accountAddress,
        data: {
          function: `${this.moduleAddress}::access_control::pause`,
          functionArguments: [],
        },
      });

      const committedTxn = await aptos.signAndSubmitTransaction({
        signer: admin,
        transaction,
      });

      const result = await aptos.waitForTransaction({
        transactionHash: committedTxn.hash,
      });

      console.log("System paused successfully");
      return result.hash;
    } catch (error: any) {
      console.error("Error pausing system:", error);
      throw new Error(`Failed to pause system: ${error.message}`);
    }
  }

  /**
   * Unpause the system (admin only)
   * Resumes normal operations
   */
  async unpauseSystem(admin: Account): Promise<string> {
    try {
      const aptos = await this.getAptosClient();
      const transaction = await aptos.transaction.build.simple({
        sender: admin.accountAddress,
        data: {
          function: `${this.moduleAddress}::access_control::unpause`,
          functionArguments: [],
        },
      });

      const committedTxn = await aptos.signAndSubmitTransaction({
        signer: admin,
        transaction,
      });

      const result = await aptos.waitForTransaction({
        transactionHash: committedTxn.hash,
      });

      console.log("System unpaused successfully");
      return result.hash;
    } catch (error: any) {
      console.error("Error unpausing system:", error);
      throw new Error(`Failed to unpause system: ${error.message}`);
    }
  }

  // ============ Oracle Functions ============

  /**
   * Check if a market has oracle resolution
   */
  async hasOracleResolution(marketId: number): Promise<boolean> {
    validateMarketId(marketId);

    try {
      const aptos = await this.getAptosClient();
      const result = await aptos.view({
        payload: {
          function: `${this.moduleAddress}::oracle::is_market_resolved`,
          functionArguments: [marketId],
        },
      });
      return Boolean(result[0]);
    } catch (error: any) {
      console.error(`Error checking oracle resolution for market ${marketId}:`, error);
      return false;
    }
  }

  /**
   * Get oracle resolution data for a market
   * Returns { resolved: boolean, outcome: number }
   */
  async getOracleResolution(marketId: number): Promise<{ resolved: boolean; outcome: number }> {
    validateMarketId(marketId);

    try {
      const aptos = await this.getAptosClient();
      const result = await aptos.view({
        payload: {
          function: `${this.moduleAddress}::oracle::get_oracle_resolution`,
          functionArguments: [marketId],
        },
      });

      return {
        resolved: Boolean(result[0]),
        outcome: Number(result[1]),
      };
    } catch (error: any) {
      console.error(`Error getting oracle resolution for market ${marketId}:`, error);
      throw new Error(`Failed to get oracle resolution: ${error.message}`);
    }
  }

  /**
   * Get enriched resolution metadata (source + strategy)
   */
  async getResolutionMetadata(marketId: number): Promise<ResolutionMetadata> {
    validateMarketId(marketId);

    try {
      const aptos = await this.getAptosClient();
      const resolution = await aptos.view({
        payload: {
          function: `${this.moduleAddress}::oracle::get_oracle_resolution`,
          functionArguments: [marketId],
        },
      });

      const source = await aptos.view({
        payload: {
          function: `${this.moduleAddress}::oracle::get_resolution_source`,
          functionArguments: [marketId],
        },
      });

      const strategy = await aptos.view({
        payload: {
          function: `${this.moduleAddress}::oracle::get_resolution_strategy`,
          functionArguments: [marketId],
        },
      });

      return {
        resolved: Boolean(resolution[0]),
        winningOutcome: Number(resolution[1]),
        source: Number(source[0]),
        strategy: Number(strategy[0]),
      };
    } catch (error: any) {
      console.error(`Error getting resolution metadata for market ${marketId}:`, error);
      throw new Error(`Failed to get resolution metadata: ${error.message}`);
    }
  }

  /**
   * Fetch latest cached Pyth price snapshot (if any) for a market.
   */
  async getPythPriceSnapshot(marketId: number): Promise<PythPriceSnapshot> {
    validateMarketId(marketId);

    try {
      const aptos = await this.getAptosClient();
      const result = await aptos.view({
        payload: {
          function: `${this.moduleAddress}::oracle::get_pyth_price`,
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

      return {
        hasSnapshot: true,
        price: BigInt(result[1] as string),
        priceNegative: Boolean(result[2]),
        confidence: BigInt(result[3] as string),
        expo: Number(result[4]),
        expoNegative: Boolean(result[5]),
        publishTime: Number(result[6]),
        receivedAt: Number(result[7]),
      };
    } catch (error: any) {
      console.error(`Error getting Pyth price snapshot for market ${marketId}:`, error);
      throw new Error(`Failed to get Pyth price snapshot: ${error.message}`);
    }
  }

  /**
   * Register as an oracle
   * @param oracle Oracle account
   * @param adminAddress Admin address where oracle registry is stored
   * @param name Oracle name
   * @param stakeAmount Stake amount in Octas (1 APT = 100000000 Octas)
   */
  async registerOracle(
    oracle: Account,
    adminAddress: string,
    name: string,
    stakeAmount: number
  ): Promise<string> {
    if (!isValidAptosAddress(adminAddress)) {
      throw new Error("Invalid admin address format");
    }
    if (!name || name.trim().length === 0) {
      throw new Error("Oracle name cannot be empty");
    }
    if (stakeAmount < 100000000) { // Min 1 APT
      throw new Error("Minimum stake is 1 APT (100000000 Octas)");
    }

    try {
      const aptos = await this.getAptosClient();
      const transaction = await aptos.transaction.build.simple({
        sender: oracle.accountAddress,
        data: {
          function: `${this.moduleAddress}::multi_oracle::register_oracle`,
          functionArguments: [
            adminAddress,
            name,
            stakeAmount,
          ],
        },
      });

      const committedTxn = await aptos.signAndSubmitTransaction({
        signer: oracle,
        transaction,
      });

      const result = await aptos.waitForTransaction({
        transactionHash: committedTxn.hash,
      });

      console.log(`Oracle "${name}" registered successfully with stake ${stakeAmount} Octas`);
      return result.hash;
    } catch (error: any) {
      console.error("Error registering oracle:", error);
      throw new Error(`Failed to register oracle: ${error.message}`);
    }
  }

  /**
   * Submit oracle vote for market resolution
   * @param oracle Oracle account (must be registered)
   * @param adminAddress Admin address where resolution is stored
   * @param marketId Market ID to resolve
   * @param outcome Outcome to vote for
   * @param confidence Confidence level (0-100)
   * @param evidenceHash Hash of evidence supporting the vote
   */
  async submitOracleVote(
    oracle: Account,
    adminAddress: string,
    marketId: number,
    outcome: number,
    confidence: number,
    evidenceHash: Uint8Array = new Uint8Array(32)
  ): Promise<string> {
    if (!isValidAptosAddress(adminAddress)) {
      throw new Error("Invalid admin address format");
    }
    validateMarketId(marketId);
    validateOutcomeId(outcome);
    if (confidence < 0 || confidence > 100) {
      throw new Error("Confidence must be between 0 and 100");
    }

    try {
      const aptos = await this.getAptosClient();
      const transaction = await aptos.transaction.build.simple({
        sender: oracle.accountAddress,
        data: {
          function: `${this.moduleAddress}::multi_oracle::submit_resolution`,
          functionArguments: [
            adminAddress,
            marketId,
            outcome,
            confidence,
            Array.from(evidenceHash),
          ],
        },
      });

      const committedTxn = await aptos.signAndSubmitTransaction({
        signer: oracle,
        transaction,
      });

      const result = await aptos.waitForTransaction({
        transactionHash: committedTxn.hash,
      });

      console.log(`Oracle vote submitted for market ${marketId}: outcome ${outcome}, confidence ${confidence}%`);
      return result.hash;
    } catch (error: any) {
      console.error("Error submitting oracle vote:", error);
      throw new Error(`Failed to submit oracle vote: ${error.message}`);
    }
  }

  // ============ Helper Constants ============

  /**
   * Role constants for reference
   */
  static readonly ROLES = {
    ADMIN: 0,
    MARKET_CREATOR: 1,
    RESOLVER: 2,
    ORACLE_MANAGER: 3,
    PAUSER: 4,
  } as const;

  /**
   * Role names for display
   */
  static readonly ROLE_NAMES = {
    0: 'Admin',
    1: 'Market Creator',
    2: 'Resolver',
    3: 'Oracle Manager',
    4: 'Pauser',
  } as const;
}
