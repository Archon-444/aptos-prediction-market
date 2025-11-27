import React, { useEffect, useState } from 'react';
import { useWalletFacade } from './WalletFacade';

/**
 * DeferredWalletButton - Triggers wallet SDK loading on first connect
 *
 * When user clicks "Connect Wallet":
 * 1. Loads real wallet provider (triggers SDK download)
 * 2. Shows loading state during SDK load
 * 3. Once loaded, renders actual wallet connection UI
 */
const DeferredWalletButton: React.FC = () => {
  const { isWalletLoaded, loadWallet } = useWalletFacade();
  const [isLoading, setIsLoading] = useState(false);

  // Dynamic import of real wallet button after wallet is loaded
  const [RealWalletButton, setRealWalletButton] = useState<React.ComponentType | null>(null);

  useEffect(() => {
    if (isWalletLoaded && !RealWalletButton) {
      import('./WalletButton').then(module => {
        setRealWalletButton(() => module.default);
        setIsLoading(false);
      });
    }
  }, [isWalletLoaded, RealWalletButton]);

  const handleConnectClick = () => {
    setIsLoading(true);
    loadWallet();
  };

  // Show real wallet button once loaded
  if (RealWalletButton) {
    return <RealWalletButton />;
  }

  // Show loading state while SDK loads
  if (isLoading) {
    return (
      <button
        disabled
        aria-label="Loading wallet"
        style={{
          padding: '0.75rem 1.5rem',
          backgroundColor: '#6c757d',
          color: 'white',
          border: 'none',
          borderRadius: '0.375rem',
          cursor: 'not-allowed',
          fontSize: '1rem',
          fontWeight: '500',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}
      >
        <div
          style={{
            width: '1rem',
            height: '1rem',
            border: '2px solid white',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}
        />
        Loading...
      </button>
    );
  }

  // Initial state - trigger wallet load on click
  return (
    <button
      onClick={handleConnectClick}
      aria-label="Connect to Aptos wallet"
      style={{
        padding: '0.75rem 1.5rem',
        backgroundColor: '#007bff',
        color: 'white',
        border: 'none',
        borderRadius: '0.375rem',
        cursor: 'pointer',
        fontSize: '1rem',
        fontWeight: '500'
      }}
    >
      Connect Wallet
    </button>
  );
};

export default DeferredWalletButton;
