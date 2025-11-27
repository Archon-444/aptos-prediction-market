import React from 'react';
import { useChain } from '../../contexts/ChainContext';
import { AptosWalletModal } from './AptosWalletModal';
import { ConnectModal } from '@suiet/wallet-kit';

interface ChainAwareWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Chain-aware wallet modal that displays the appropriate wallet selection UI
 * based on the currently active blockchain network.
 *
 * - When activeChain is 'aptos', shows AptosWalletModal (Petra, Martian, etc.)
 * - When activeChain is 'sui', shows official Sui ConnectModal from @suiet/wallet-kit
 */
export const ChainAwareWalletModal: React.FC<ChainAwareWalletModalProps> = ({ isOpen, onClose }) => {
  const { activeChain } = useChain();

  if (activeChain === 'aptos') {
    return <AptosWalletModal isOpen={isOpen} onClose={onClose} />;
  } else if (activeChain === 'sui') {
    // Use official Sui ConnectModal - handles all wallet detection automatically
    return <ConnectModal open={isOpen} onOpenChange={(open) => !open && onClose()} />;
  }

  // Fallback: if no chain is active or chain is unknown
  return null;
};
