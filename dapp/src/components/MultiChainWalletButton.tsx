import React, { useEffect, useState } from 'react';
import { WalletSelector } from '@aptos-labs/wallet-adapter-ant-design';
import { useWallet as useAptosWallet } from '@aptos-labs/wallet-adapter-react';
import { useSuiWallet, SuiConnectButton } from '../contexts/SuiWalletContext';
import { useChain } from '../contexts/ChainContext';

interface MultiChainWalletButtonProps {
  className?: string;
}

/**
 * Multi-chain wallet button that adapts based on selected chain
 * Shows Aptos wallet UI when Aptos is selected
 * Shows Sui wallet UI when Sui is selected
 */
export const MultiChainWalletButton: React.FC<MultiChainWalletButtonProps> = ({ className }) => {
  const { activeChain } = useChain();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className={className}>
        <button className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg" disabled>
          Loading...
        </button>
      </div>
    );
  }

  // Render appropriate wallet button based on active chain
  if (activeChain === 'aptos') {
    return <AptosWalletButton className={className} />;
  } else if (activeChain === 'sui') {
    return <SuiWalletButtonWrapper className={className} />;
  }

  return null;
};

/**
 * Aptos wallet button component
 */
const AptosWalletButton: React.FC<{ className?: string }> = ({ className }) => {
  const { account, connected } = useAptosWallet();

  useEffect(() => {
    console.log('[AptosWallet] State:', { connected, address: account?.address });
  }, [connected, account?.address]);

  return (
    <div className={`aptos-wallet-selector ${className || ''}`}>
      <WalletSelector />
      {connected && account?.address && (
        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
          Connected to Aptos
        </span>
      )}
    </div>
  );
};

/**
 * Sui wallet button wrapper
 * Uses the built-in SuiConnectButton from @suiet/wallet-kit
 */
const SuiWalletButtonWrapper: React.FC<{ className?: string }> = ({ className }) => {
  const { account, connected } = useSuiWallet();

  return (
    <div className={`sui-wallet-wrapper ${className || ''}`}>
      <SuiConnectButton />
      {connected && account && (
        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
          Connected to Sui
        </span>
      )}
    </div>
  );
};

export default MultiChainWalletButton;
