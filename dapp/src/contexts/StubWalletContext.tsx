import React, { createContext, useContext, useMemo, useCallback } from 'react';
import { env } from '../config/env';

type AptosClient = import('@aptos-labs/ts-sdk').Aptos;

// Stub wallet context - provides minimal interface before real wallet loads
interface StubWalletContextType {
  getClient: () => Promise<AptosClient>;
  network: string;
}

const StubWalletContext = createContext<StubWalletContextType | null>(null);

export const useAptosStub = () => {
  const context = useContext(StubWalletContext);
  if (!context) {
    throw new Error('useAptos must be used within a WalletProvider');
  }
  return context;
};

// Stub provider - minimal overhead for non-wallet routes
// This wraps the SessionProvider's children with a minimal wallet context
export const StubWalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const network = env.aptosNetwork;

  const getClient = useCallback(async () => {
    const { Aptos, AptosConfig } = await import('@aptos-labs/ts-sdk');
    const config = new AptosConfig({ network: network as any });
    return new Aptos(config);
  }, [network]);

  const contextValue = useMemo(
    () => ({
      getClient,
      network,
    }),
    [getClient, network]
  );

  return (
    <StubWalletContext.Provider value={contextValue}>
      {children}
    </StubWalletContext.Provider>
  );
};
