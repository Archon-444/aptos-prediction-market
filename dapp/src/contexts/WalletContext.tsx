import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { env } from '../config/env';
import { AptosWalletAdapterProvider, useWallet } from '@aptos-labs/wallet-adapter-react';
import { useSession } from './SessionContext';
import { logWalletEvent } from '../utils/logger';
import { PetraWallet } from 'petra-plugin-wallet-adapter';
import { MartianWallet } from '@martianwallet/aptos-wallet-adapter';
import { NightlyWallet } from '@nightlylabs/aptos-wallet-adapter-plugin';
import { PontemWallet } from '@pontem/wallet-adapter-plugin';
import { OKXWallet } from '@okwallet/aptos-wallet-adapter';

type AptosClient = import('@aptos-labs/ts-sdk').Aptos;

// Wallet context
interface WalletContextType {
  getClient: () => Promise<AptosClient>;
  network: string;
}

const WalletContext = createContext<WalletContextType | null>(null);

export const useAptos = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useAptos must be used within a WalletProvider');
  }
  return context;
};

// Inner wallet manager that has access to both wallet and session
const WalletSessionManager: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { account, connected, disconnect } = useWallet();
  const { createSession, invalidateSession, isSessionValid, checkSession } = useSession();

  // Debug logging for wallet session state
  useEffect(() => {
    console.log('[WalletSessionManager] State:', {
      connected,
      hasAccount: !!account,
      address: account?.address,
      isSessionValid,
    });
  }, [connected, account, isSessionValid]);

  // Create session when wallet connects
  useEffect(() => {
    if (connected && account?.address) {
      // Check if we already have a valid session for this wallet
      if (!isSessionValid || !checkSession()) {
        console.log('[WalletSessionManager] Creating session for:', account.address);
        createSession(account.address);
        logWalletEvent('wallet_connected_with_session', {
          address: account.address,
        });
      }
    } else if (!connected) {
      // Disconnect invalidates session
      if (isSessionValid) {
        console.log('[WalletSessionManager] Invalidating session on disconnect');
        invalidateSession();
        logWalletEvent('wallet_disconnected_session_invalidated');
      }
    }
  }, [connected, account, createSession, invalidateSession, isSessionValid, checkSession]);

  // Automatically disconnect wallet if session expires
  // Only disconnect if wallet is connected AND we had a session that became invalid
  // Don't disconnect during the brief moment between wallet connect and session creation
  const previousSessionValid = useRef(isSessionValid);

  useEffect(() => {
    // Only auto-disconnect if:
    // 1. Wallet is connected
    // 2. Session WAS valid before (previousSessionValid.current === true)
    // 3. Session is now invalid (isSessionValid === false)
    if (connected && previousSessionValid.current && !isSessionValid) {
      console.log('[WalletSessionManager] Session expired, disconnecting wallet');
      logWalletEvent('session_expired_auto_disconnect', {
        address: account?.address,
      });
      disconnect();
    }

    // Update previous state
    previousSessionValid.current = isSessionValid;
  }, [isSessionValid, connected, disconnect, account]);

  return <>{children}</>;
};

// Wallet provider component
export const AptosWalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const network = env.aptosNetwork;
  const aptosRef = useRef<AptosClient | null>(null);
  const loadPromiseRef = useRef<Promise<AptosClient> | null>(null);

  const wallets = useMemo(() => {
    if (typeof window === 'undefined') {
      return [];
    }

    const adapters = [];
    try {
      adapters.push(new PetraWallet());
    } catch (error) {
      console.warn('[WalletProvider] Failed to initialize Petra wallet adapter:', error);
    }

    try {
      adapters.push(new MartianWallet());
    } catch (error) {
      console.warn('[WalletProvider] Failed to initialize Martian wallet adapter:', error);
    }

    try {
      adapters.push(new NightlyWallet());
    } catch (error) {
      console.warn('[WalletProvider] Failed to initialize Nightly wallet adapter:', error);
    }

    try {
      adapters.push(new PontemWallet());
    } catch (error) {
      console.warn('[WalletProvider] Failed to initialize Pontem wallet adapter:', error);
    }

    try {
      adapters.push(new OKXWallet());
    } catch (error) {
      console.warn('[WalletProvider] Failed to initialize OKX wallet adapter:', error);
    }

    return adapters;
  }, []);

  const getClient = useCallback(async () => {
    if (aptosRef.current) {
      return aptosRef.current;
    }
    if (!loadPromiseRef.current) {
      loadPromiseRef.current = import('@aptos-labs/ts-sdk').then(({ Aptos, AptosConfig }) => {
        const config = new AptosConfig({ network: network as any });
        const client = new Aptos(config);
        aptosRef.current = client;
        return client;
      });
    }
    return loadPromiseRef.current;
  }, [network]);

  const contextValue = useMemo(
    () => ({
      getClient,
      network,
    }),
    [getClient, network]
  );

  return (
    <AptosWalletAdapterProvider
      plugins={wallets}
      autoConnect={true}
      dappConfig={{
        network: env.aptosNetwork as any,
        aptosConnectDappId: import.meta.env.VITE_APTOS_CONNECT_DAPP_ID || undefined,
      } as any}
    >
      <WalletContext.Provider value={contextValue}>
        <WalletSessionManager>
          {children}
        </WalletSessionManager>
      </WalletContext.Provider>
    </AptosWalletAdapterProvider>
  );
};
