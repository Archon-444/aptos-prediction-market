import type { Chain } from '@prisma/client';

import { env } from './env.js';

export interface ChainConfig {
  chain: Chain;
  feeStructure: {
    tradingFee: number;
    withdrawalFee: number;
    creatorFee: number;
    protocolFee: number;
  };
  lmsrParams: {
    b: number;
    initialLiquidity: bigint;
  };
  limits: {
    minBet: bigint;
    maxBet: bigint;
    maxMarketDurationHours: number;
  };
  contractAddress: string;
  rpcEndpoint: string;
  usdcCoinType?: string;
}

const MICRO_USDC = 1_000_000n;

const chainConfigs: Record<Chain, ChainConfig> = {
  aptos: {
    chain: 'aptos',
    feeStructure: {
      tradingFee: 1.5,
      withdrawalFee: 0,
      creatorFee: 0.5,
      protocolFee: 1.0,
    },
    lmsrParams: {
      b: 100,
      initialLiquidity: 100n * MICRO_USDC,
    },
    limits: {
      minBet: 1n * MICRO_USDC,
      maxBet: 10_000n * MICRO_USDC,
      maxMarketDurationHours: 24 * 365,
    },
    contractAddress: env.APTOS_MODULE_ADDRESS,
    rpcEndpoint: env.APTOS_NETWORK,
  },
  sui: {
    chain: 'sui',
    feeStructure: {
      tradingFee: 2.0,
      withdrawalFee: 0.1,
      creatorFee: 0.5,
      protocolFee: 1.4,
    },
    lmsrParams: {
      b: 150,
      initialLiquidity: 200n * MICRO_USDC,
    },
    limits: {
      minBet: 500_000n,
      maxBet: 5_000_000_000n,
      maxMarketDurationHours: 24 * 182,
    },
    contractAddress: env.SUI_PACKAGE_ID ?? '',
    rpcEndpoint: env.SUI_RPC_URL ?? '',
    usdcCoinType: env.SUI_USDC_COIN_TYPE,
  },
  movement: {
    chain: 'movement',
    feeStructure: {
      tradingFee: 1.0,
      withdrawalFee: 0,
      creatorFee: 0.25,
      protocolFee: 0.75,
    },
    lmsrParams: {
      b: 100,
      initialLiquidity: 100n * MICRO_USDC,
    },
    limits: {
      minBet: 1n * MICRO_USDC,
      maxBet: 10_000n * MICRO_USDC,
      maxMarketDurationHours: 24 * 365,
    },
    contractAddress: process.env.MOVEMENT_MODULE_ADDRESS ?? '',
    rpcEndpoint: process.env.MOVEMENT_RPC_ENDPOINT ?? '',
  },
};

export function getChainConfig(chain: Chain): ChainConfig {
  const config = chainConfigs[chain];

  if (!config) {
    throw new Error(`Unsupported chain configuration requested: ${chain}`);
  }

  return config;
}
