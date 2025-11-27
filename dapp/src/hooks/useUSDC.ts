import { useCallback, useEffect, useState } from 'react';
import { useSDKContext } from '../contexts/SDKContext';
import { useUnifiedWallet } from './useUnifiedWallet';

export const useUSDCBalance = () => {
  const { sdk, chain } = useSDKContext();
  const wallet = useUnifiedWallet();
  const [balance, setBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchBalance = useCallback(async () => {
    if (!wallet.address || !wallet.connected) {
      setBalance(0);
      setError(null);
      return 0;
    }

    setIsLoading(true);
    setError(null);

    try {
      const balanceMicro = await sdk.getBalance(wallet.address);
      setBalance(balanceMicro);
      return balanceMicro;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch balance');
      setError(error);
      console.error('[useUSDCBalance] Failed to fetch balance:', error);
      return 0;
    } finally {
      setIsLoading(false);
    }
  }, [sdk, wallet.address, wallet.connected]);

  // Fetch balance when wallet connects or chain changes
  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  const formatted = sdk.formatUSDC(balance);
  const balanceUSDC = sdk.fromMicroUSDC(balance);

  return {
    balance,
    balanceUSDC,
    formatted,
    isLoading,
    error,
    refetch: fetchBalance,
    chain,
  };
};
