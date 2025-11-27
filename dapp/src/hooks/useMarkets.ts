import { useCallback, useEffect, useState } from 'react';
import { useSDK } from '../contexts/SDKContext';
import type { Market } from '../services/IBlockchainAdapter';

export const useMarkets = () => {
  const sdk = useSDK();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchMarkets = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const count = await sdk.getMarketCount();
      const marketPromises = [];

      for (let i = 0; i < count; i++) {
        marketPromises.push(sdk.getMarket(i));
      }

      const fetchedMarkets = await Promise.all(marketPromises);
      setMarkets(fetchedMarkets);
    } catch (err: any) {
      setError(err);
      console.error('Error fetching markets:', err);
    } finally {
      setIsLoading(false);
    }
  }, [sdk]);

  useEffect(() => {
    fetchMarkets();
  }, [fetchMarkets]);

  return { markets, isLoading, error, refetch: fetchMarkets };
};

export const useMarket = (marketId: number | null) => {
  const sdk = useSDK();
  const [market, setMarket] = useState<Market | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchMarket = useCallback(async () => {
    if (marketId === null || marketId < 0) {
      setMarket(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const fetchedMarket = await sdk.getMarket(marketId);
      setMarket(fetchedMarket);
    } catch (err: any) {
      setError(err);
      console.error(`Error fetching market ${marketId}:`, err);
    } finally {
      setIsLoading(false);
    }
  }, [sdk, marketId]);

  useEffect(() => {
    fetchMarket();
  }, [fetchMarket]);

  return { market, isLoading, error, refetch: fetchMarket };
};

export const useMarketOdds = (marketId: number | null) => {
  const sdk = useSDK();
  const [odds, setOdds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchOdds = useCallback(async () => {
    if (marketId === null || marketId < 0) {
      setOdds([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const fetchedOdds = await sdk.getOdds(marketId);
      setOdds(fetchedOdds);
    } catch (err: any) {
      setError(err);
      console.error(`Error fetching odds for market ${marketId}:`, err);
    } finally {
      setIsLoading(false);
    }
  }, [sdk, marketId]);

  useEffect(() => {
    fetchOdds();
  }, [fetchOdds]);

  return { odds, isLoading, error, refetch: fetchOdds };
};
