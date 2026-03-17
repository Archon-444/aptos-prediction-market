/**
 * Chain transaction hooks for Base (EVM)
 *
 * Uses useGaslessTransaction for Coinbase Smart Wallet (paymaster-sponsored),
 * with automatic fallback to regular writeContract for other wallets.
 */

import { useCallback } from 'react';
import { useAccount } from 'wagmi';
import { parseUnits } from 'viem';
import { CONTRACTS, PredictionMarketAMMABI, ConditionalTokensABI } from '../config/contracts';
import { useGaslessTransaction } from './useGaslessTransaction';

interface ChainTransactionResult {
  hash: string;
  success: boolean;
}

// ---------- Buy Outcome ----------

export const useChainPlaceBet = () => {
  const { address } = useAccount();
  const { writeGasless } = useGaslessTransaction();

  return useCallback(async (
    marketId: string,
    outcomeIndex: number,
    usdcAmount: number,
  ): Promise<ChainTransactionResult> => {
    if (!address) throw new Error('Wallet not connected');
    if (!CONTRACTS.amm) throw new Error('AMM address not configured');

    const amount = parseUnits(usdcAmount.toString(), 6);
    const minTokensOut = 0n;

    const hash = await writeGasless({
      address: CONTRACTS.amm,
      abi: PredictionMarketAMMABI as any,
      functionName: 'buy',
      args: [marketId as `0x${string}`, BigInt(outcomeIndex), amount, minTokensOut],
    });

    return { hash, success: true };
  }, [address, writeGasless]);
};

// ---------- Sell Outcome ----------

export const useChainSellPosition = () => {
  const { address } = useAccount();
  const { writeGasless } = useGaslessTransaction();

  return useCallback(async (
    marketId: string,
    outcomeIndex: number,
    tokenAmount: bigint,
  ): Promise<ChainTransactionResult> => {
    if (!address) throw new Error('Wallet not connected');
    if (!CONTRACTS.amm) throw new Error('AMM address not configured');

    const minUsdcOut = 0n;

    const hash = await writeGasless({
      address: CONTRACTS.amm,
      abi: PredictionMarketAMMABI as any,
      functionName: 'sell',
      args: [marketId as `0x${string}`, BigInt(outcomeIndex), tokenAmount, minUsdcOut],
    });

    return { hash, success: true };
  }, [address, writeGasless]);
};

// ---------- Redeem Positions ----------

export const useChainClaimWinnings = () => {
  const { address } = useAccount();
  const { writeGasless } = useGaslessTransaction();

  return useCallback(async (
    conditionId: string,
    indexSets: bigint[],
  ): Promise<ChainTransactionResult> => {
    if (!address) throw new Error('Wallet not connected');
    if (!CONTRACTS.conditionalTokens) throw new Error('ConditionalTokens address not configured');

    const parentCollectionId = '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`;

    const hash = await writeGasless({
      address: CONTRACTS.conditionalTokens,
      abi: ConditionalTokensABI as any,
      functionName: 'redeemPositions',
      args: [CONTRACTS.usdc, parentCollectionId, conditionId as `0x${string}`, indexSets],
    });

    return { hash, success: true };
  }, [address, writeGasless]);
};

// ---------- Add Liquidity ----------

export const useChainAddLiquidity = () => {
  const { address } = useAccount();
  const { writeGasless } = useGaslessTransaction();

  return useCallback(async (
    marketId: string,
    usdcAmount: number,
  ): Promise<ChainTransactionResult> => {
    if (!address) throw new Error('Wallet not connected');
    if (!CONTRACTS.amm) throw new Error('AMM address not configured');

    const amount = parseUnits(usdcAmount.toString(), 6);

    const hash = await writeGasless({
      address: CONTRACTS.amm,
      abi: PredictionMarketAMMABI as any,
      functionName: 'addLiquidity',
      args: [marketId as `0x${string}`, amount],
    });

    return { hash, success: true };
  }, [address, writeGasless]);
};

// ---------- Remove Liquidity ----------

export const useChainRemoveLiquidity = () => {
  const { address } = useAccount();
  const { writeGasless } = useGaslessTransaction();

  return useCallback(async (
    marketId: string,
    shares: bigint,
  ): Promise<ChainTransactionResult> => {
    if (!address) throw new Error('Wallet not connected');
    if (!CONTRACTS.amm) throw new Error('AMM address not configured');

    const hash = await writeGasless({
      address: CONTRACTS.amm,
      abi: PredictionMarketAMMABI as any,
      functionName: 'removeLiquidity',
      args: [marketId as `0x${string}`, shares],
    });

    return { hash, success: true };
  }, [address, writeGasless]);
};
