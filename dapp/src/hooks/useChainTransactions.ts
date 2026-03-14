import { useCallback } from 'react';
import { useWallet as useAptosWallet } from '@aptos-labs/wallet-adapter-react';
import { Transaction as SuiTransaction } from '@mysten/sui/transactions';
import { useWallet as useSuietWallet } from '@suiet/wallet-kit';
import { useChain } from '../contexts/ChainContext';
import { useSDKContext } from '../contexts/SDKContext';
import env from '../config/env';

interface ChainTransactionResult {
  hash: string;
  success: boolean;
}

export const useChainPlaceBet = () => {
  const { activeChain } = useChain();
  const { sdk } = useSDKContext();
  const aptosWallet = useAptosWallet();
  const suietWallet = useSuietWallet();

  return useCallback(async (marketId: number, outcome: number, amount: number): Promise<ChainTransactionResult> => {
    if (activeChain === 'aptos') {
      if (!aptosWallet.account || !aptosWallet.signAndSubmitTransaction) {
        throw new Error('Aptos wallet not connected');
      }

      const moduleAddress = sdk.getModuleAddress();
      const response = await aptosWallet.signAndSubmitTransaction({
        sender: aptosWallet.account.address,
        data: {
          function: `${moduleAddress}::betting::place_bet`,
          typeArguments: [],
          functionArguments: [marketId, outcome, sdk.toMicroUSDC(amount)],
        },
      });
      return { hash: response.hash, success: true };
    }

    if (!suietWallet.account || !suietWallet.connected) {
      throw new Error('Sui wallet not connected');
    }

    const packageId = sdk.getModuleAddress();
    const roleRegistryId =
      typeof (sdk as any).getRoleRegistryId === 'function'
        ? (sdk as any).getRoleRegistryId()
        : env.suiRoleRegistryId;
    const oracleRegistryId =
      typeof (sdk as any).getOracleRegistryId === 'function'
        ? (sdk as any).getOracleRegistryId()
        : env.suiOracleRegistryId;

    if (!roleRegistryId) {
      throw new Error('Sui role registry ID is not configured');
    }
    if (!oracleRegistryId) {
      throw new Error('Sui oracle registry ID is not configured');
    }
    const amountBaseUnits = sdk.toMicroUSDC(amount);

    // Fetch market objects from backend
    console.log('[useChainPlaceBet] Fetching Sui market objects for market:', marketId);
    const objects = await getSuiMarketObjects(marketId);
    
    // Calculate which shard this user should use for parallel execution
    const shardId = calculateShardId(
      suietWallet.account.address,
      objects.shardObjectIds.length
    );
    const shardObjectId = objects.shardObjectIds[shardId];

    console.log('[useChainPlaceBet] Sui transaction details:', {
      marketObjectId: objects.marketObjectId,
      shardObjectId,
      shardId,
      outcome,
      amountBaseUnits
    });

    // Build transaction
    const tx = new SuiTransaction();

    // Get user's USDC coins for payment
    const usdcCoinType = (sdk as any).getUsdcCoinType();
    const userCoins = await (sdk as any).getCoins(suietWallet.account.address, usdcCoinType);
    
    if (userCoins.length === 0) {
      throw new Error('No USDC coins found in wallet. Please acquire USDC first.');
    }

    // Use the first USDC coin for payment
    const [paymentCoin] = tx.splitCoins(tx.object(userCoins[0].coinObjectId), [amountBaseUnits]);

    // Call place_bet on market_manager_v2 with sharding support
    tx.moveCall({
      target: `${packageId}::market_manager_v2::place_bet`,
      arguments: [
        tx.object(objects.marketObjectId),    // Market metadata (shared object)
        tx.object(shardObjectId),              // Market pool shard (reduces contention)
        paymentCoin,                           // Payment coin
        tx.pure.u8(outcome),                   // Outcome (0 or 1)
        tx.object('0x6'),                      // Clock object
      ],
    });

    // Sign and execute
    const result = await suietWallet.signAndExecuteTransaction({
      transaction: tx as any, // Type compatibility issue between Sui packages
    });

    const success = (result as any).effects?.status?.status === 'success';
    
    if (!success) {
      const error = (result as any).effects?.status?.error || 'Unknown error';
      throw new Error(`Sui transaction failed: ${error}`);
    }

    console.log('[useChainPlaceBet] Sui transaction successful:', result.digest);

    return {
      hash: result.digest,
      success,
    };
  }, [activeChain, aptosWallet, sdk, suietWallet]);
};

export const useChainClaimWinnings = () => {
  const { activeChain } = useChain();
  const { sdk } = useSDKContext();
  const aptosWallet = useAptosWallet();
  const suietWallet = useSuietWallet();

  return useCallback(async (marketId: number, positionObjectId?: string): Promise<ChainTransactionResult> => {
    if (activeChain === 'aptos') {
      if (!aptosWallet.account || !aptosWallet.signAndSubmitTransaction) {
        throw new Error('Aptos wallet not connected');
      }

      const moduleAddress = sdk.getModuleAddress();
      const response = await aptosWallet.signAndSubmitTransaction({
        sender: aptosWallet.account.address,
        data: {
          function: `${moduleAddress}::betting::claim_winnings`,
          typeArguments: [],
          functionArguments: [marketId],
        },
      });
      return { hash: response.hash, success: true };
    }

    if (!suietWallet.account || !suietWallet.connected) {
      throw new Error('Sui wallet not connected');
    }

    if (!positionObjectId) {
      throw new Error('Position object ID required for Sui claims. Please provide your position object ID.');
    }

    const packageId = sdk.getModuleAddress();
    
    // Fetch market objects
    console.log('[useChainClaimWinnings] Fetching Sui market objects for market:', marketId);
    const objects = await getSuiMarketObjects(marketId);

    if (!objects.queueObjectId) {
      throw new Error('Settlement queue not initialized for this market');
    }

    console.log('[useChainClaimWinnings] Sui claim details:', {
      marketObjectId: objects.marketObjectId,
      queueObjectId: objects.queueObjectId,
      positionObjectId
    });

    // Build transaction to request settlement
    const tx = new SuiTransaction();

    tx.moveCall({
      target: `${packageId}::market_manager_v2::request_settlement`,
      arguments: [
        tx.object(objects.marketObjectId),     // Market
        tx.object(objects.queueObjectId),      // Settlement queue
        tx.object(positionObjectId),           // User's position
        tx.object('0x6')                       // Clock
      ]
    });

    // Sign and execute
    const result = await suietWallet.signAndExecuteTransaction({
      transaction: tx as any, // Type compatibility issue between Sui packages
    });

    const success = (result as any).effects?.status?.status === 'success';
    
    if (!success) {
      const error = (result as any).effects?.status?.error || 'Unknown error';
      throw new Error(`Settlement request failed: ${error}`);
    }

    console.log('[useChainClaimWinnings] Settlement requested:', result.digest);

    return {
      hash: result.digest,
      success
    };
  }, [activeChain, aptosWallet, sdk, suietWallet]);
};

interface ChainCreateMarketParams {
  question: string;
  outcomes: string[];
  durationHours: number;
}

export const useChainCreateMarket = () => {
  const { activeChain } = useChain();
  const { sdk } = useSDKContext();
  const aptosWallet = useAptosWallet();
  const suietWallet = useSuietWallet();

  return useCallback(async ({ question, outcomes, durationHours }: ChainCreateMarketParams): Promise<ChainTransactionResult> => {
    if (activeChain === 'aptos') {
      if (!aptosWallet.account || !aptosWallet.signAndSubmitTransaction) {
        throw new Error('Aptos wallet not connected');
      }

      const moduleAddress = sdk.getModuleAddress();
      const encoder = new TextEncoder();
      const response = await aptosWallet.signAndSubmitTransaction({
        sender: aptosWallet.account.address,
        data: {
          function: `${moduleAddress}::market_manager::create_market`,
          typeArguments: [],
          functionArguments: [
            Array.from(encoder.encode(question)),
            outcomes.map((outcome) => Array.from(encoder.encode(outcome))),
            durationHours,
          ],
        },
      });
      return { hash: response.hash, success: true };
    }

    if (!suietWallet.account || !suietWallet.connected) {
      throw new Error('Sui wallet not connected');
    }

    const packageId = sdk.getModuleAddress();
    const numShards = 16; // Default number of shards for parallel execution

    console.log('[useChainCreateMarket] Creating Sui market:', {
      question,
      outcomes,
      durationHours,
      numShards
    });

    // Helper to convert string to bytes
    const stringToBytes = (str: string): number[] => {
      return Array.from(new TextEncoder().encode(str));
    };

    // Build transaction
    const tx = new SuiTransaction();

    // Convert strings to byte arrays for Move
    const questionBytes = stringToBytes(question);
    const resolutionBytes = stringToBytes('User created'); // Default resolution source
    const outcomesBytes = outcomes.map(o => stringToBytes(o));

    tx.moveCall({
      target: `${packageId}::market_manager_v2::create_market`,
      arguments: [
        tx.pure.vector('u8', questionBytes),
        tx.pure.vector('vector<u8>', outcomesBytes as unknown as number[][]),
        tx.pure.u64(durationHours),
        tx.pure.vector('u8', resolutionBytes),
        tx.pure.u8(numShards),
        tx.object(env.suiRoleRegistryId || '0x1'), // roleRegistryId
        tx.object(env.suiOracleRegistryId || '0x2'), // oracleRegistryId
        tx.object('0x6')  // Clock object
      ]
    });

    // Sign and execute
    const result = await suietWallet.signAndExecuteTransaction({
      transaction: tx as any, // Type compatibility issue between Sui packages
    });

    const success = (result as any).effects?.status?.status === 'success';

    if (!success) {
      const error = (result as any).effects?.status?.error || 'Unknown error';
      throw new Error(`Market creation failed: ${error}`);
    }

    await registerSuiMarket(result.digest);
    (sdk as unknown as { invalidateCache?: () => void }).invalidateCache?.();

    // Extract created object IDs from transaction result for debugging
    const createdObjects = (result as any).objectChanges?.filter(
      (change: any) => change.type === 'created'
    ) || [];

    console.log('[useChainCreateMarket] Market created successfully:', {
      digest: result.digest,
      createdObjects: createdObjects.map((obj: any) => ({
        objectId: obj.objectId,
        objectType: obj.objectType
      }))
    });

    return {
      hash: result.digest,
      success
    };
  }, [activeChain, aptosWallet, sdk, suietWallet]);
};

/**
 * Fetch Sui market objects from backend API
 * This resolves the market ID to actual Sui object IDs
 */
async function getSuiMarketObjects(marketId: number): Promise<{
  marketObjectId: string;
  shardObjectIds: string[];
  queueObjectId: string | null;
}> {
  const apiBaseRaw = env.apiUrl || 'http://localhost:4000/api';
  const normalized = apiBaseRaw.replace(/\/$/, '');
  const apiBase = normalized.endsWith('/api') ? normalized : `${normalized}/api`;

  const response = await fetch(`${apiBase}/markets/sui/objects/${marketId}`);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to fetch Sui market objects: ${response.statusText}. ${errorText}`
    );
  }
  
  return response.json();
}

async function registerSuiMarket(digest: string): Promise<void> {
  const apiBaseRaw = env.apiUrl || 'http://localhost:4000/api';
  const normalized = apiBaseRaw.replace(/\/$/, '');
  const apiBase = normalized.endsWith('/api') ? normalized : `${normalized}/api`;

  const response = await fetch(`${apiBase}/markets/sui/bootstrap`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ digest }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Failed to register Sui market: ${response.statusText}. ${errorText}`);
  }
}

/**
 * Calculate which shard to use based on user address
 * This matches the on-chain sharding logic for load distribution
 */
function calculateShardId(address: string, numShards: number): number {
  // Simple hash-based sharding - convert address to number and mod by num shards
  const hash = address.split('').reduce((acc, char) => 
    acc + char.charCodeAt(0), 0
  );
  return hash % numShards;
}

/**
 * Legacy function for backwards compatibility
 * @deprecated Use getSuiMarketObjects instead
 */
async function getMarketObjectId(marketId: number): Promise<string> {
  const objects = await getSuiMarketObjects(marketId);
  return objects.marketObjectId;
}
