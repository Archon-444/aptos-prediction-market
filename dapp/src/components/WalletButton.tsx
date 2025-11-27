import React, { useEffect } from 'react';
import { useWallet } from '@aptos-labs/wallet-adapter-react';

const WalletButton: React.FC = () => {
  const { account, connect, disconnect, connected } = useWallet();
  const address = account?.address || null;

  // Debug: Log wallet state changes
  useEffect(() => {
    console.log('Wallet state changed:', { connected, address });
  }, [connected, address]);

  const handleConnect = async () => {
    try {
      await connect('Petra' as any);
    } catch (error) {
      console.error('Failed to connect wallet:', error);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
    } catch (error) {
      console.error('Failed to disconnect wallet:', error);
    }
  };

  // Show connected state when wallet is connected AND address is available
  if (connected && address) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <span
          aria-label={`Connected wallet address: ${address}`}
          style={{
            fontSize: '0.9rem',
            color: '#666',
            fontFamily: 'monospace'
          }}
        >
          {address.slice(0, 6)}...{address.slice(-4)}
        </span>
        <button
          onClick={handleDisconnect}
          aria-label="Disconnect wallet"
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            fontSize: '0.875rem'
          }}
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleConnect}
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

export default WalletButton;

