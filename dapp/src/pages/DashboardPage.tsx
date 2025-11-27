import React from 'react';
import { motion } from 'framer-motion';
import { useUnifiedWallet } from '../hooks/useUnifiedWallet';
import { useChain } from '../contexts/ChainContext';
import { Button } from '../components/ui/Button';

const DashboardPage: React.FC = () => {
  const { connected } = useUnifiedWallet();
  const { activeChain } = useChain();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="container mx-auto px-4 py-12 max-w-3xl"
    >
      <div className="space-y-6 text-center">
        <h1 className="text-3xl md:text-4xl font-display font-bold text-gray-900 dark:text-white">
          My Bets
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
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
          <div className="inline-flex items-center justify-center px-4 py-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-yellow-700 dark:text-yellow-200">
            Connect your wallet to start betting
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default DashboardPage;
