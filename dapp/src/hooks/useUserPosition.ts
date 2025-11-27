import { useState, useEffect, useCallback } from 'react';
import { useSDK } from '../contexts/SDKContext';
import { UserPosition } from '../services/MoveMarketSDK';

export const useUserPosition = (
  userAddress: string | undefined,
  marketId: number | null
) => {
  const sdk = useSDK();
  const [position, setPosition] = useState<UserPosition | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchPosition = useCallback(async () => {
    if (!userAddress || marketId === null || marketId < 0) {
      setPosition(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const fetchedPosition = await sdk.getUserPosition(userAddress, marketId as any);
      setPosition(fetchedPosition);
    } catch (err: any) {
      setError(err);
      console.error('Error fetching user position:', err);
      setPosition(null);
    } finally {
      setIsLoading(false);
    }
  }, [sdk, userAddress, marketId]);

  useEffect(() => {
    fetchPosition();
  }, [fetchPosition]);

  return { position, isLoading, error, refetch: fetchPosition };
};

export const useUserPositions = (userAddress: string | undefined, marketCount: number) => {
  const sdk = useSDK();
  const [positions, setPositions] = useState<Map<number, UserPosition>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchPositions = useCallback(async () => {
    if (!userAddress || marketCount === 0) {
      setPositions(new Map());
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const positionPromises = [];
      for (let i = 0; i < marketCount; i++) {
        positionPromises.push(
          sdk.getUserPosition(userAddress, i as any).then((position) => ({ marketId: i, position }))
        );
      }

      const results = await Promise.all(positionPromises);
      const positionMap = new Map<number, UserPosition>();

      results.forEach(({ marketId, position }) => {
        if (position) {
          positionMap.set(marketId, position);
        }
      });

      setPositions(positionMap);
    } catch (err: any) {
      setError(err);
      console.error('Error fetching user positions:', err);
    } finally {
      setIsLoading(false);
    }
  }, [sdk, userAddress, marketCount]);

  useEffect(() => {
    fetchPositions();
  }, [fetchPositions]);

  return { positions, isLoading, error, refetch: fetchPositions };
};
