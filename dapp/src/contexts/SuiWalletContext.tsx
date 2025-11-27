import React, { createContext, useContext, useMemo } from 'react';
import {
  WalletProvider as SuietWalletProvider,
  ConnectButton,
  useWallet,
  useSuiClient,
  SuiDevnetChain,
  SuiTestnetChain,
  SuiMainnetChain,
} from '@suiet/wallet-kit';
import type { SuiClient } from '@mysten/sui/client';
import { env } from '../config/env';

interface SuiWalletContextType {
  account: { address: string } | null;
  connected: boolean;
  connect: () => void;
  disconnect: () => Promise<void>;
  getSuiClient: () => SuiClient;
}

const SuiWalletContext = createContext<SuiWalletContextType | null>(null);

export const useSuiWallet = (): SuiWalletContextType => {
  const context = useContext(SuiWalletContext);
  if (!context) {
    throw new Error('useSuiWallet must be used within a SuiWalletProvider');
  }
  return context;
};

const chainMap = {
  devnet: SuiDevnetChain,
  testnet: SuiTestnetChain,
  mainnet: SuiMainnetChain,
} as const;

const SuiWalletManager: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const wallet = useWallet();
  const suiClient = useSuiClient();
  const { account, connected, disconnect } = wallet;

  const value = useMemo<SuiWalletContextType>(() => ({
    account: account ? { address: account.address } : null,
    connected,
    connect: () => {
      console.warn('[SuiWallet] Use the provided ConnectButton or ConnectModal to initiate a connection.');
    },
    disconnect,
    getSuiClient: () => suiClient,
  }), [account, connected, disconnect, suiClient]);

  return (
    <SuiWalletContext.Provider value={value}>
      {children}
    </SuiWalletContext.Provider>
  );
};

export const SuiWalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const networkKey = env.suiNetwork?.toLowerCase() as keyof typeof chainMap | undefined;
  const activeChain = chainMap[networkKey ?? 'devnet'] ?? SuiDevnetChain;

  console.log('[SuiWalletProvider] Active Sui network:', {
    configuredNetwork: env.suiNetwork,
    resolvedChain: activeChain,
  });

  return (
    <SuietWalletProvider chains={[activeChain]} autoConnect>
          <SuiWalletManager>
            {children}
          </SuiWalletManager>
    </SuietWalletProvider>
  );
};

export { ConnectButton as SuiConnectButton };
