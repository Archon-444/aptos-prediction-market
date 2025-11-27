import { Aptos, AptosConfig, Network } from '@aptos-labs/ts-sdk';
import type { Chain } from '@prisma/client';

import { getChainConfig } from '../config/chainConfig.js';
import { BRIDGED_WUSDC_COIN_TYPE, env } from '../config/env.js';
import { prisma } from '../database/prismaClient.js';

const MICRO_USDC = 1_000_000;
const MICRO_USDC_BIGINT = BigInt(MICRO_USDC);
const FPMM_TRADING_FEE_BPS = 30n;
const BPS_DENOMINATOR = 10_000n;

let aptosClient: Aptos | null = null;

function getAptosClient(): Aptos {
  if (!aptosClient) {
    const aptosConfig = new AptosConfig({ network: env.APTOS_NETWORK as Network });
    aptosClient = new Aptos(aptosConfig);
  }
  return aptosClient;
}

type CalculatePayoutParams = {
  marketId?: string;
  chain?: Chain;
  onChainId?: string;
  outcomeIndex: number;
  amount: number;
};

type ShareInfo = {
  micro: string;
  decimal: number;
  isFPMM: boolean;
  calculationMethod: 'FPMM' | 'Parimutuel';
};

async function fetchOnChainMarket(params: {
  chain: Chain;
  onChainId: string;
}): Promise<{ chain: Chain; outcomePools: bigint[] } | null> {
  if (params.chain === 'aptos') {
    const marketIndex = Number(params.onChainId);

    if (!Number.isInteger(marketIndex) || marketIndex < 0) {
      return null;
    }

    try {
      const aptos = getAptosClient();
      const moduleAddress = getChainConfig('aptos').contractAddress;

      const result = await aptos.view({
        payload: {
          function: `${moduleAddress}::market_manager::get_market_full`,
          functionArguments: [marketIndex],
        },
      });

      const poolsRaw = Array.isArray(result[2]) ? (result[2] as Array<string | number | bigint>) : [];

      const outcomePools = poolsRaw.map((value) => {
        if (typeof value === 'bigint') return value;
        if (typeof value === 'number') return BigInt(Math.trunc(value));
        if (typeof value === 'string') return BigInt(value);
        return 0n;
      });

      return {
        chain: 'aptos',
        outcomePools,
      };
    } catch (error) {
      console.error('[payoutService] Failed to fetch Aptos market from chain:', error);
      return null;
    }
  }

  return null;
}

async function fetchOutcomeOdds(params: {
  chain: Chain;
  onChainId: string;
  outcomeIndex: number;
}): Promise<number | null> {
  if (params.chain !== 'aptos') {
    return null;
  }

  const marketIndex = Number(params.onChainId);
  if (!Number.isInteger(marketIndex) || marketIndex < 0) {
    return null;
  }

  try {
    const aptos = getAptosClient();
    const moduleAddress = getChainConfig('aptos').contractAddress;

    const oddsResult = await aptos.view({
      payload: {
        function: `${moduleAddress}::betting::get_odds_for_outcome`,
        functionArguments: [marketIndex, params.outcomeIndex],
      },
    });

    if (Array.isArray(oddsResult) && oddsResult.length > 0) {
      return Number(oddsResult[0]);
    }
  } catch (error) {
    console.warn('[payoutService] Failed to fetch on-chain odds', error);
  }

  return null;
}

function coerceBigInt(value: unknown): bigint | null {
  if (typeof value === 'bigint') {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return BigInt(Math.trunc(value));
  }
  if (typeof value === 'string' && value.length > 0) {
    try {
      return BigInt(value);
    } catch {
      return null;
    }
  }
  return null;
}

export const payoutService = {
  async calculatePayout(params: CalculatePayoutParams): Promise<{
    estimatedPayout: number;
    potentialProfit: number;
    currentOdds: number;
    fees: {
      trading: number;
      creator: number;
      protocol: number;
      total: number;
    };
    chain: Chain;
    shares: ShareInfo;
    priceImpact: number;
  } | null> {
    const { marketId, chain, onChainId, outcomeIndex, amount } = params;
    let market = null;

    if (marketId) {
      market = await prisma.market.findUnique({
        where: { id: marketId },
      });

      if (!market && chain && onChainId) {
        market = await prisma.market.findFirst({
          where: {
            chain,
            onChainId,
          },
        });
      }
    } else if (chain && onChainId) {
      market = await prisma.market.findFirst({
        where: {
          chain,
          onChainId,
        },
      });
    }

    let effectiveChain: Chain | null = market?.chain ?? null;
    let outcomePools: bigint[] = market?.outcomePools ?? [];

    if (!market && chain && onChainId) {
      const fallback = await fetchOnChainMarket({ chain, onChainId });
      if (!fallback) {
        return null;
      }
      effectiveChain = fallback.chain;
      outcomePools = fallback.outcomePools;
    }

    if (!effectiveChain) {
      return null;
    }

    const config = getChainConfig(effectiveChain);

    if (effectiveChain === 'sui') {
      if (!config.usdcCoinType) {
        throw new Error('SUI_USDC_COIN_TYPE must be configured for Sui payout calculations');
      }
      if (config.usdcCoinType === BRIDGED_WUSDC_COIN_TYPE) {
        throw new Error('Sui payouts cannot be calculated with bridged wUSDC coin type');
      }
    }

    const pools = outcomePools ?? [];

    if (outcomeIndex < 0 || outcomeIndex >= pools.length) {
      return null;
    }

    const totalPool = pools.reduce<bigint>((acc, value) => acc + BigInt(value), 0n);
    const outcomePool = pools[outcomeIndex] ? BigInt(pools[outcomeIndex]) : 0n;

    const betAmountMicro = BigInt(Math.floor(amount * MICRO_USDC));
    const totalPoolAfter = totalPool + betAmountMicro;
    const outcomePoolAfter = outcomePool + betAmountMicro;

    let fpmmPreviewMicro: bigint | null = null;

    if (effectiveChain === 'aptos') {
      const resolvedOnChainId = onChainId ?? market?.onChainId ?? null;
      const marketIndex = resolvedOnChainId !== null ? Number(resolvedOnChainId) : Number.NaN;
      if (Number.isInteger(marketIndex) && marketIndex >= 0) {
        try {
          const aptos = getAptosClient();
          const moduleAddress = config.contractAddress;
          const result = await aptos.view({
            payload: {
              function: `${moduleAddress}::betting::calculate_payout`,
              functionArguments: [marketIndex, Number(betAmountMicro), outcomeIndex],
            },
          });

          if (Array.isArray(result) && result.length > 0) {
            fpmmPreviewMicro = coerceBigInt(result[0]);
          } else {
            fpmmPreviewMicro = coerceBigInt(result);
          }
        } catch (error) {
          console.warn('[payoutService] Failed to fetch fpmm preview via view function', error);
        }
      }
    }

    // Use FPMM preview if available, otherwise fall back to parimutuel
    // FPMM uses constant product formula: x × y = k
    const parimutuelPreviewMicro =
      outcomePoolAfter > 0n ? (betAmountMicro * totalPoolAfter) / outcomePoolAfter : betAmountMicro;

    const estimatedPayoutMicro =
      fpmmPreviewMicro !== null && fpmmPreviewMicro > 0n ? fpmmPreviewMicro : parimutuelPreviewMicro;

    const tradingFeeMicro = (betAmountMicro * FPMM_TRADING_FEE_BPS) / BPS_DENOMINATOR;
    const creatorFee = amount * (config.feeStructure.creatorFee / 100);
    const protocolFee = amount * (config.feeStructure.protocolFee / 100);
    const tradingFee = Number(tradingFeeMicro) / MICRO_USDC;
    const totalFee = tradingFee + creatorFee + protocolFee;
    const priceImpactMicro =
      betAmountMicro > tradingFeeMicro + estimatedPayoutMicro
        ? betAmountMicro - tradingFeeMicro - estimatedPayoutMicro
        : 0n;

    const estimatedPayout = Number(estimatedPayoutMicro) / MICRO_USDC;
    const potentialProfit = estimatedPayout - amount;
    const priceImpact = Number(priceImpactMicro) / MICRO_USDC;

    let currentOddsBasisPoints = 5000;
    if (effectiveChain === 'aptos') {
      const resolvedOnChainId = onChainId ?? market?.onChainId ?? null;
      if (resolvedOnChainId) {
        const onChainOdds = await fetchOutcomeOdds({
          chain: effectiveChain,
          onChainId: resolvedOnChainId,
          outcomeIndex,
        });
        if (typeof onChainOdds === 'number' && Number.isFinite(onChainOdds)) {
          currentOddsBasisPoints = onChainOdds;
        }
      }
    }

    if (currentOddsBasisPoints === 5000 && totalPoolAfter > 0n) {
      currentOddsBasisPoints = Number((outcomePoolAfter * 10000n) / totalPoolAfter);
    }

    return {
      estimatedPayout,
      potentialProfit,
      currentOdds: currentOddsBasisPoints,
      fees: {
        trading: tradingFee,
        creator: creatorFee,
        protocol: protocolFee,
        total: totalFee,
      },
      chain: effectiveChain,
      shares: {
        micro: estimatedPayoutMicro.toString(),
        decimal: estimatedPayout,
        // FPMM-specific: shares represent the actual tokens received
        // In FPMM, shares = reserve_out - new_reserve_out (from constant product formula)
        isFPMM: fpmmPreviewMicro !== null && fpmmPreviewMicro > 0n,
        calculationMethod: fpmmPreviewMicro !== null && fpmmPreviewMicro > 0n ? 'FPMM' : 'Parimutuel',
      },
      priceImpact,
    };
  },

  validateBetAmount(
    amount: number,
    chain: Chain
  ): {
    valid: boolean;
    error?: string;
  } {
    const config = getChainConfig(chain);
    const amountMicro = BigInt(Math.floor(amount * MICRO_USDC));

    if (amountMicro < config.limits.minBet) {
      return {
        valid: false,
        error: `Minimum bet on ${chain} is ${Number(config.limits.minBet) / MICRO_USDC} USDC`,
      };
    }

    if (amountMicro > config.limits.maxBet) {
      return {
        valid: false,
        error: `Maximum bet on ${chain} is ${Number(config.limits.maxBet) / MICRO_USDC} USDC`,
      };
    }

    return { valid: true };
  },
};
