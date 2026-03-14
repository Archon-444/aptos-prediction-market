import React from 'react';
import { useChain, type Chain } from '../contexts/ChainContext';

interface ChainSwitcherProps {
  className?: string;
}

export const ChainSwitcher: React.FC<ChainSwitcherProps> = ({ className }) => {
  const { activeChain, setActiveChain, availableChains } = useChain();

  // Don't show switcher if only one chain is available
  if (availableChains.length <= 1) {
    return null;
  }

  const handleChainChange = (chain: Chain) => {
    if (chain !== activeChain) {
      setActiveChain(chain);
    }
  };

  const getChainLabel = (chain: Chain): string => {
    switch (chain) {
      case 'aptos':
        return 'Aptos';
      case 'sui':
        return 'Sui';
      default:
        return chain;
    }
  };

  const getChainIcon = (chain: Chain): string => {
    switch (chain) {
      case 'aptos':
        return '⬢'; // Aptos logo placeholder
      case 'sui':
        return '◊'; // Sui logo placeholder
      default:
        return '•';
    }
  };

  return (
    <div className={`chain-switcher ${className || ''}`}>
      <div className="flex items-center gap-2 bg-[#0D1224] rounded-lg p-1 shadow-sm border border-white/[0.08]">
        {availableChains.map((chain) => (
          <button
            key={chain}
            onClick={() => handleChainChange(chain)}
            className={`
              flex items-center gap-2 px-3 py-2 rounded-md transition-all
              ${
                activeChain === chain
                  ? 'bg-primary-500 text-white shadow-md'
                  : 'bg-transparent text-slate-300 hover:bg-white/[0.05] '
              }
            `}
            aria-label={`Switch to ${getChainLabel(chain)} chain`}
            aria-pressed={activeChain === chain}
          >
            <span className="text-lg" aria-hidden="true">
              {getChainIcon(chain)}
            </span>
            <span className="font-medium text-sm">
              {getChainLabel(chain)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ChainSwitcher;
