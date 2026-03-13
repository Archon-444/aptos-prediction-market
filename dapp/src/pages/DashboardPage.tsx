import React from 'react';
import { motion } from 'framer-motion';
import { useUnifiedWallet } from '../hooks/useUnifiedWallet';
import { useChain } from '../contexts/ChainContext';
import { Button } from '../components/ui/Button';
import { PremiumContainer } from '../components/layout/PremiumContainer';

const DashboardPage: React.FC = () => {
  const { connected } = useUnifiedWallet();
  const { activeChain } = useChain();

  return (
    <div className="min-h-screen bg-[#050713] text-white selection:bg-primary-500/30">
      <PremiumContainer size="md">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="text-center"
        >
          <div className="space-y-6">
            <h1 className="text-3xl md:text-4xl font-display font-bold text-white">
              My Bets
            </h1>
            <p className="text-gray-400">
              {connected
                ? `You haven't placed any bets on ${activeChain === 'aptos' ? 'Aptos' : 'Sui'} yet.`
                : 'Connect your wallet to view your betting activity.'}
            </p>

            {connected ? (
              <Button
                variant="primary"
                to="/markets"
                as="a"
                {...({} as any)}
              >
                Explore Markets
              </Button>
            ) : (
              <div className="inline-flex items-center justify-center px-4 py-2 bg-warning-900/20 border border-warning-500/30 rounded-lg text-warning-200">
                Connect your wallet to start betting
              </div>
            )}
          </div>
        </motion.div>
      </PremiumContainer>
    </div>
  );
};

export default DashboardPage;
