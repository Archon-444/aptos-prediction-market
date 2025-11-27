import React, { createContext, useContext, useState, useCallback, Suspense, lazy, useEffect } from 'react';
import { StubWalletProvider } from '../contexts/StubWalletContext';

// Lazy load the real wallet provider
const RealWalletProvider = lazy(() =>
  import('../contexts/WalletContext').then(module => ({
    default: module.AptosWalletProvider
  }))
);

interface WalletFacadeContextType {
  isWalletLoaded: boolean;
  loadWallet: () => void;
}

const WalletFacadeContext = createContext<WalletFacadeContextType>({
  isWalletLoaded: false,
  loadWallet: () => {},
});

export const useWalletFacade = () => useContext(WalletFacadeContext);

interface WalletFacadeProps {
  children: React.ReactNode;
  /** Routes that should trigger wallet loading immediately */
  walletRoutes?: string[];
}

/**
 * WalletFacade - Dynamically loads wallet provider on demand
 *
 * Strategy:
 * 1. Initially uses StubWalletProvider (no SDK load - minimal overhead)
 * 2. Auto-loads wallet on specific routes (e.g., /markets, /dashboard)
 * 3. Can also be triggered manually via loadWallet()
 * 4. Real provider includes all wallet adapters and 5MB SDK
 * 5. Users who never visit wallet routes never download the SDK
 *
 * Performance impact:
 * - Before: 5.8MB initial bundle (includes Aptos SDK always)
 * - After: ~50KB initial bundle, 5.1MB loaded only when needed
 */
export const WalletFacade: React.FC<WalletFacadeProps> = ({
  children,
  walletRoutes = []
}) => {
  const [isWalletLoaded, setIsWalletLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const loadWallet = useCallback(() => {
    if (!isWalletLoaded && !isLoading) {
      console.log('[WalletFacade] Loading real wallet provider and SDK...');
      setIsLoading(true);
      setIsWalletLoaded(true);
    }
  }, [isWalletLoaded, isLoading]);

  // Auto-load wallet on specific routes (disabled by default - load on wallet connect instead)
  useEffect(() => {
    if (walletRoutes.length === 0) return;

    const currentPath = window.location.pathname;
    const shouldLoadWallet = walletRoutes.some(route => currentPath.startsWith(route));

    if (shouldLoadWallet) {
      loadWallet();
    }
  }, [walletRoutes, loadWallet]);

  const contextValue = {
    isWalletLoaded,
    loadWallet,
  };

  return (
    <WalletFacadeContext.Provider value={contextValue}>
      {isWalletLoaded ? (
        <Suspense fallback={
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-xl">
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 border-3 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-gray-900 dark:text-white font-medium">Loading wallet SDK...</span>
              </div>
            </div>
          </div>
        }>
          <RealWalletProvider>
            {children}
          </RealWalletProvider>
        </Suspense>
      ) : (
        <StubWalletProvider>
          {children}
        </StubWalletProvider>
      )}
    </WalletFacadeContext.Provider>
  );
};
