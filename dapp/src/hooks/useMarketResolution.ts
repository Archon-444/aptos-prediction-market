import { useCallback, useEffect, useState } from 'react';
import { useSDK } from '../contexts/SDKContext';
import {
  ResolutionMetadata,
  PythPriceSnapshot,
} from '../services/MoveMarketSDK';

interface ResolutionState {
  metadata: ResolutionMetadata | null;
  price: PythPriceSnapshot | null;
  isLoading: boolean;
  error: Error | null;
}

const defaultSnapshot: PythPriceSnapshot = {
  hasSnapshot: false,
  price: 0n,
  priceNegative: false,
  confidence: 0n,
  expo: 0,
  expoNegative: false,
  publishTime: 0,
  receivedAt: 0,
};

export const useMarketResolution = (marketId: number | null) => {
  const sdk = useSDK();
  const [state, setState] = useState<ResolutionState>({
    metadata: null,
    price: null,
    isLoading: false,
    error: null,
  });

  const fetchResolution = useCallback(async () => {
    if (marketId === null || Number.isNaN(marketId) || marketId < 0) {
      setState({
        metadata: null,
        price: null,
        isLoading: false,
        error: null,
      });
      return;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const [metadata, price] = await Promise.all([
        (sdk as any).getResolutionMetadata?.(marketId),
        (sdk as any).getPythPriceSnapshot?.(marketId),
      ]);

      setState({
        metadata,
        price,
        isLoading: false,
        error: null,
      });
    } catch (error: any) {
      setState({
        metadata: null,
        price: defaultSnapshot,
        isLoading: false,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }, [sdk, marketId]);

  useEffect(() => {
    void fetchResolution();
  }, [fetchResolution]);

  return {
    metadata: state.metadata,
    price: state.price ?? defaultSnapshot,
    isLoading: state.isLoading,
    error: state.error,
    refetch: fetchResolution,
  };
};

export default useMarketResolution;
