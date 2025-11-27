import { useState, useCallback, useRef } from 'react';
import { useSDK, useSDKContext } from '../contexts/SDKContext';
import { useWallet } from '@aptos-labs/wallet-adapter-react';
import toast from '../components/ui/Toast';
import {
  validateMarketId,
  validateOutcomeId,
  RateLimiter,
  sanitizeString
} from '../utils/validation';
import {
  useChainPlaceBet,
  useChainClaimWinnings,
  useChainCreateMarket,
} from './useChainTransactions';

export const usePlaceBet = () => {
  const { chain } = useSDKContext();
  const chainPlaceBet = useChainPlaceBet();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Rate limiter: max 5 transactions per 60 seconds
  const rateLimiterRef = useRef(new RateLimiter(5, 60000));

  const placeBet = useCallback(
    async (marketId: number, outcome: number, amount: number): Promise<string | null> => {
      if (!Number.isFinite(amount) || amount <= 0) {
        const err = new Error('Bet amount must be greater than zero');
        setError(err);
        toast.error(err.message);
        return null;
      }

      if (!rateLimiterRef.current.checkLimit()) {
        const waitTime = Math.ceil(rateLimiterRef.current.getTimeUntilNextRequest() / 1000);
        toast.error(`Rate limit exceeded. Please wait ${waitTime} seconds.`);
        return null;
      }

      setIsLoading(true);
      setError(null);

      const toastId = toast.loading(`Placing bet on ${chain.toUpperCase()}...`);

      try {
        validateMarketId(marketId);
        validateOutcomeId(outcome);

        const result = await chainPlaceBet(marketId, outcome, amount);

        toast.dismiss(toastId);
        toast.success('Bet placed successfully!');

        return result.hash;
      } catch (err) {
        toast.dismiss(toastId);
        const message = err instanceof Error ? err.message : 'Failed to place bet';
        toast.error(message);
        setError(err instanceof Error ? err : new Error(message));
        console.error('Error placing bet:', err);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [chain, chainPlaceBet]
  );

  return { placeBet, isLoading, error };
};

export const useClaimWinnings = () => {
  const { chain } = useSDKContext();
  const chainClaimWinnings = useChainClaimWinnings();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const claimWinnings = useCallback(
    async (marketId: number): Promise<string | null> => {
      if (!Number.isInteger(marketId) || marketId < 0) {
        const err = new Error('Invalid marketId: must be a non-negative integer');
        setError(err);
        toast.error(err.message);
        return null;
      }

      setIsLoading(true);
      setError(null);

      const toastId = toast.loading(`Claiming winnings on ${chain.toUpperCase()}...`);

      try {
        const result = await chainClaimWinnings(marketId);

        toast.dismiss(toastId);
        toast.success('Winnings claimed successfully!');

        return result.hash;
      } catch (err) {
        toast.dismiss(toastId);
        const message = err instanceof Error ? err.message : 'Failed to claim winnings';
        toast.error(message);
        setError(err instanceof Error ? err : new Error(message));
        console.error('Error claiming winnings:', err);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [chain, chainClaimWinnings]
  );

  return { claimWinnings, isLoading, error };
};

export const useCreateMarket = () => {
  const { chain } = useSDKContext();
  const chainCreateMarket = useChainCreateMarket();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Rate limiter: max 3 market creations per 60 seconds
  const rateLimiterRef = useRef(new RateLimiter(3, 60000));

  const createMarket = useCallback(
    async (question: string, outcomes: string[], durationHours: number): Promise<string | null> => {
      if (!rateLimiterRef.current.checkLimit()) {
        const waitTime = Math.ceil(rateLimiterRef.current.getTimeUntilNextRequest() / 1000);
        toast.error(`Rate limit exceeded. Please wait ${waitTime} seconds.`);
        return null;
      }

      setIsLoading(true);
      setError(null);

      const toastId = toast.loading(`Creating market on ${chain.toUpperCase()}...`);

      try {
        const sanitizedQuestion = sanitizeString(question, 500);
        if (!sanitizedQuestion || sanitizedQuestion.length === 0) {
          throw new Error('Question cannot be empty');
        }

        if (!Array.isArray(outcomes) || outcomes.length < 2) {
          throw new Error('At least 2 outcomes are required');
        }

        const sanitizedOutcomes = outcomes.map((o) => sanitizeString(o, 100));
        if (sanitizedOutcomes.some((o) => !o || o.length === 0)) {
          throw new Error('All outcomes must be non-empty');
        }

        if (!Number.isInteger(durationHours) || durationHours <= 0) {
          throw new Error('Duration must be a positive integer');
        }

        if (durationHours > 8760) { // Max 1 year
          throw new Error('Duration cannot exceed 1 year');
        }

        const result = await chainCreateMarket({
          question: sanitizedQuestion,
          outcomes: sanitizedOutcomes,
          durationHours,
        });

        toast.dismiss(toastId);
        toast.success('Market created successfully!');

        return result.hash;
      } catch (err) {
        toast.dismiss(toastId);
        const message = err instanceof Error ? err.message : 'Failed to create market';
        toast.error(message);
        setError(err instanceof Error ? err : new Error(message));
        console.error('Error creating market:', err);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [chain, chainCreateMarket]
  );

  return { createMarket, isLoading, error };
};

export const useUSDCFaucet = () => {
  const sdk = useSDK();
  const { chain } = useSDKContext();
  const { account, signAndSubmitTransaction } = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const usdcModuleAddress =
    typeof (sdk as any)?.getUsdcModuleAddress === 'function'
      ? (sdk as any).getUsdcModuleAddress()
      : (sdk as any)?.moduleAddress;

  const faucetAvailable = Boolean(
    chain === 'aptos' &&
      usdcModuleAddress &&
      typeof (sdk as any)?.getModuleAddress === 'function' &&
      (sdk as any).getModuleAddress() === usdcModuleAddress
  );

  const claimFromFaucet = useCallback(async (): Promise<string | null> => {
    if (chain !== 'aptos') {
      toast.error('USDC faucet is only available on Aptos');
      return null;
    }

    if (!account || !signAndSubmitTransaction) {
      const err = new Error('Wallet not connected');
      setError(err);
      toast.error('Please connect your wallet first');
      return null;
    }

    if (!faucetAvailable) {
      const err = new Error('USDC faucet is disabled in this environment');
      setError(err);
      toast.error('USDC faucet is not available on this network');
      return null;
    }

    setIsLoading(true);
    setError(null);

    const toastId = toast.loading('Claiming USDC from faucet...');

    try {
      if (!usdcModuleAddress) {
        throw new Error('USDC module address is not configured');
      }

      const payload: any = { // MoveTransactionPayload type not available
        function: `${usdcModuleAddress}::usdc::faucet`,
        functionArguments: [usdcModuleAddress],
        typeArguments: [],
      };

      const response = await signAndSubmitTransaction({
        sender: account.address,
        data: payload as any, // Wallet adapter types are complex, safe to use any here
      });

      toast.dismiss(toastId);
      toast.success('Claimed 1000 USDC successfully!');

      console.log('USDC faucet claimed:', { hash: response.hash });

      return response.hash;
    } catch (err: any) {
      toast.dismiss(toastId);
      const errorMessage = err.message || 'Failed to claim USDC';
      toast.error(errorMessage);
      setError(err);
      console.error('Error claiming USDC:', err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [account, signAndSubmitTransaction, chain, faucetAvailable, usdcModuleAddress]);

  return { claimFromFaucet, isLoading, error, faucetAvailable };
};
