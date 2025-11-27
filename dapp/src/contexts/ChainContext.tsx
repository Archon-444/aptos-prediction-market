import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { env } from '../config/env';

export type Chain = 'aptos' | 'sui';

interface ChainContextType {
  activeChain: Chain;
  setActiveChain: (chain: Chain) => void;
  availableChains: Chain[];
  isChainAvailable: (chain: Chain) => boolean;
}

const ChainContext = createContext<ChainContextType | null>(null);

export const useChain = () => {
  const context = useContext(ChainContext);
  if (!context) {
    throw new Error('useChain must be used within a ChainProvider');
  }
  return context;
};

interface ChainProviderProps {
  children: React.ReactNode;
}

export const ChainProvider: React.FC<ChainProviderProps> = ({ children }) => {
  // Determine available chains from environment config
  const availableChains: Chain[] = env.activeChains as Chain[];

  // Get initial chain from localStorage or default to first available
  const getInitialChain = (): Chain => {
    const stored = localStorage.getItem('selectedChain');
    if (stored && availableChains.includes(stored as Chain)) {
      return stored as Chain;
    }
    return availableChains[0] || 'aptos';
  };

  const [activeChain, setActiveChainState] = useState<Chain>(getInitialChain);

  // Persist chain selection to localStorage
  const setActiveChain = useCallback((chain: Chain) => {
    if (!availableChains.includes(chain)) {
      console.warn(`[ChainContext] Chain "${chain}" is not available. Available chains:`, availableChains);
      return;
    }

    console.log(`[ChainContext] Switching to ${chain} chain`);
    setActiveChainState(chain);
    localStorage.setItem('selectedChain', chain);

    // Emit custom event for other components to react to chain change
    window.dispatchEvent(new CustomEvent('chainChanged', { detail: { chain } }));
  }, [availableChains]);

  // Check if a specific chain is available
  const isChainAvailable = useCallback((chain: Chain): boolean => {
    return availableChains.includes(chain);
  }, [availableChains]);

  // Validate active chain on mount and when available chains change
  useEffect(() => {
    if (!availableChains.includes(activeChain)) {
      console.warn(
        `[ChainContext] Active chain "${activeChain}" is not available. Switching to ${availableChains[0]}`
      );
      setActiveChain(availableChains[0] || 'aptos');
    }
  }, [activeChain, availableChains, setActiveChain]);

  // Log chain changes
  useEffect(() => {
    console.log('[ChainContext] Active chain:', activeChain);
  }, [activeChain]);

  const value: ChainContextType = {
    activeChain,
    setActiveChain,
    availableChains,
    isChainAvailable,
  };

  return <ChainContext.Provider value={value}>{children}</ChainContext.Provider>;
};
