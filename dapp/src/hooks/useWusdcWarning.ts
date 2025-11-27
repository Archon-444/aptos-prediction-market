import { useEffect, useMemo, useState } from 'react';
import { useChain } from '../contexts/ChainContext';
import { useSuiWallet } from '../contexts/SuiWalletContext';
import { env, BRIDGED_WUSDC_COIN_TYPE } from '../config/env';

const MIGRATION_GUIDE_URL = 'https://www.circle.com/blog/sui-migration-guide';
const SIX_DECIMALS = 1_000_000n;

interface WusdcWarningState {
  shouldShow: boolean;
  balanceFormatted: string;
  migrationUrl: string;
  loading: boolean;
  error: string | null;
}

const defaultState: WusdcWarningState = {
  shouldShow: false,
  balanceFormatted: '0',
  migrationUrl: MIGRATION_GUIDE_URL,
  loading: false,
  error: null,
};

export const useWusdcWarning = (): WusdcWarningState => {
  const { activeChain } = useChain();
  const { account, connected, getSuiClient } = useSuiWallet();
  const [state, setState] = useState<WusdcWarningState>(defaultState);

  useEffect(() => {
    let cancelled = false;

    const checkBalance = async () => {
      if (activeChain !== 'sui' || !connected || !account) {
        setState(defaultState);
        return;
      }

      // If env accidentally points at bridged coin, warn immediately.
      if (env.suiUsdcCoinType === BRIDGED_WUSDC_COIN_TYPE) {
        setState({
          shouldShow: true,
          balanceFormatted: '0',
          migrationUrl: MIGRATION_GUIDE_URL,
          loading: false,
          error: 'App misconfigured with bridged wUSDC coin type',
        });
        return;
      }

      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const client = getSuiClient();
        const response = await client.getBalance({
          owner: account.address,
          coinType: BRIDGED_WUSDC_COIN_TYPE,
        });

        const rawBalance = BigInt(response.totalBalance ?? '0');
        const hasBalance = rawBalance > 0n;
        const balanceFormatted = hasBalance
          ? (Number(rawBalance) / Number(SIX_DECIMALS)).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })
          : '0';

        if (!cancelled) {
          setState({
            shouldShow: hasBalance,
            balanceFormatted,
            migrationUrl: MIGRATION_GUIDE_URL,
            loading: false,
            error: null,
          });
        }
      } catch (error: any) {
        console.error('[useWusdcWarning] Failed to fetch bridged wUSDC balance', error);
        if (!cancelled) {
          setState({
            shouldShow: false,
            balanceFormatted: '0',
            migrationUrl: MIGRATION_GUIDE_URL,
            loading: false,
            error: error?.message ?? 'Unable to check wUSDC balance',
          });
        }
      }
    };

    checkBalance();

    return () => {
      cancelled = true;
    };
  }, [activeChain, connected, account, getSuiClient]);

  return useMemo(() => state, [state]);
};

export default useWusdcWarning;
