import { useMemo } from 'react';
import { useSDKContext } from '../contexts/SDKContext';

export interface ChainCurrencyMetadata {
  chain: 'aptos' | 'sui';
  ticker: 'USDC' | 'SUI';
  symbolPrefix: string;
  unitLabel: string;
  icon: 'usd' | 'sui';
  presetAmounts: number[];
  formatDisplay: (amount: number) => string;
}

/**
 * Returns presentation metadata for the active chain's staking currency so UI
 * components can adapt copy/icons without duplicating switch logic.
 */
export const useChainCurrency = (): ChainCurrencyMetadata => {
  const { chain } = useSDKContext();

  return useMemo((): ChainCurrencyMetadata => {
    if (chain === 'sui') {
      return {
        chain: 'sui',
        ticker: 'SUI',
        symbolPrefix: '',
        unitLabel: 'SUI',
        icon: 'sui',
        presetAmounts: [1, 2, 5, 10],
        formatDisplay: (amount: number) => `${amount.toFixed(2)} SUI`,
      };
    }

    return {
      chain: 'aptos',
      ticker: 'USDC',
      symbolPrefix: '$',
      unitLabel: 'USDC',
      icon: 'usd',
      presetAmounts: [10, 25, 50, 100],
      formatDisplay: (amount: number) => `$${amount.toFixed(2)}`,
    };
  }, [chain]);
};
