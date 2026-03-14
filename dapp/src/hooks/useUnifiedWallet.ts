import { useMemo } from 'react';
import { useWallet as useAptosWallet } from '@aptos-labs/wallet-adapter-react';
import { useSuiWallet } from '../contexts/SuiWalletContext';
import { useChain } from '../contexts/ChainContext';

export interface UnifiedWallet {
  address: string | undefined;
  connected: boolean;
  connecting: boolean;
  connect: () => void;
  disconnect: () => void;
  chain: 'aptos' | 'sui';
  publicKey?: string;
  signMessage?: (payload: {
    message: string;
    nonce: string;
    address?: boolean;
    application?: boolean;
    chainId?: boolean;
  }) => Promise<{
    signature?: string;
    publicKey?: string;
    fullMessage?: string;
  }>;
}

/**
 * Chain-aware wallet abstraction so components do not need to branch on the
 * active chain for basic wallet state.
 */
export const useUnifiedWallet = (): UnifiedWallet => {
  const { activeChain } = useChain();
  const aptosWallet = useAptosWallet();
  const suiWallet = useSuiWallet();

  return useMemo<UnifiedWallet>(() => {
    if (activeChain === 'sui') {
      return {
        address: suiWallet.account?.address as string | undefined,
        connected: suiWallet.connected,
        connecting: false,
        connect: suiWallet.connect,
        disconnect: suiWallet.disconnect,
        chain: 'sui',
        publicKey: undefined,
        signMessage: undefined,
      } as UnifiedWallet;
    }

    return {
      address: aptosWallet.account?.address as unknown as string | undefined,
      connected: aptosWallet.connected,
      connecting: false, // aptosWallet.connecting not available
      connect: () => {
        console.log('[useUnifiedWallet] Open wallet modal to select an Aptos wallet');
      },
      disconnect: aptosWallet.disconnect,
      chain: 'aptos',
      publicKey: aptosWallet.account?.publicKey as string | undefined,
      signMessage: aptosWallet.signMessage as UnifiedWallet['signMessage'],
    } as UnifiedWallet;
  }, [activeChain, aptosWallet, suiWallet]);
};
