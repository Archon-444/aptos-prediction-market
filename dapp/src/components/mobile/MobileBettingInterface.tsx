import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FiCheck, FiTrendingUp, FiX } from 'react-icons/fi';
import { usePlaceBet } from '../../hooks/useTransactions';
import { Market } from '../../services/MoveMarketSDK';
import { useSwipeGesture } from '../../hooks/useSwipeGesture';
import { hapticFeedback } from '../../utils/hapticFeedback';
import { QuickBetWidget } from './QuickBetWidget';

interface MobileBettingInterfaceProps {
  market: Market;
  onClose: () => void;
}

export const MobileBettingInterface: React.FC<MobileBettingInterfaceProps> = ({
  market,
  onClose,
}) => {
  const [selectedOutcome, setSelectedOutcome] = useState<number | null>(null);
  const [amount, setAmount] = useState<number>(0);
  const { placeBet, isLoading } = usePlaceBet();

  // Swipe down to dismiss
  const { swipeDistance } = useSwipeGesture({
    onSwipeDown: onClose,
    threshold: 100,
    enabled: true,
  });

  const handleAmountSelect = (value: number) => {
    hapticFeedback.buttonTap();
    setAmount(value);
  };

  const handleSelectOutcome = (index: number) => {
    hapticFeedback.selectOutcome();
    setSelectedOutcome(index);
  };

  const handlePlaceBet = async () => {
    if (selectedOutcome === null || !amount || amount <= 0) return;

    hapticFeedback.placeBet();
    try {
      await placeBet(market.id, selectedOutcome, amount);
      hapticFeedback.betConfirmed();
    } catch (error) {
      hapticFeedback.betFailed();
      throw error;
    }
    onClose();
  };

  const calculatePotentialWin = () => {
    if (selectedOutcome === null || !amount || amount <= 0) return 0;

    const totalStake = market.totalStakes || 1;
    const outcomeStake = market.outcomeStakes[selectedOutcome] || 0;
    const odds = (totalStake - outcomeStake) / (outcomeStake + amount * 1000000);

    return amount * (1 + odds);
  };

  const potentialWin = calculatePotentialWin();
  const potentialProfit = potentialWin - amount;

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: Math.max(0, swipeDistance.y) }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 30, stiffness: 300 }}
      className="fixed inset-0 z-50 bg-white dark:bg-gray-900 overflow-y-auto safe-top safe-bottom"
    >
      {/* Header with swipe indicator */}
      <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-4">
        {/* Swipe indicator */}
        <div className="w-12 h-1 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto mb-3" />

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            Place Bet
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors touch-manipulation"
          >
            <FiX className="w-6 h-6 text-gray-600 dark:text-gray-400" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-6 pb-32">
        {/* Market Question */}
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-2xl">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Market</p>
          <p className="text-base font-semibold text-gray-900 dark:text-white">
            {market.question}
          </p>
        </div>

        {/* Outcome Selection */}
        <div className="space-y-3">
          <label className="text-sm font-semibold text-gray-900 dark:text-white">
            Select Outcome
          </label>
          <div className="grid grid-cols-1 gap-3">
            {market.outcomes.map((outcome, index) => {
              const isSelected = selectedOutcome === index;
              const totalStake = market.totalStakes || 1;
              const probability = Math.round((market.outcomeStakes[index] / totalStake) * 100);

              return (
                <motion.button
                  key={index}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleSelectOutcome(index)}
                  className={`relative p-4 rounded-2xl border-2 transition-all touch-manipulation ${
                    isSelected
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                  }`}
                >
                  {/* Check Mark */}
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute top-3 right-3 w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center"
                    >
                      <FiCheck className="w-4 h-4 text-white" />
                    </motion.div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className={`text-base font-semibold ${
                      isSelected ? 'text-primary-700 dark:text-primary-300' : 'text-gray-900 dark:text-white'
                    }`}>
                      {outcome}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className={`text-xl font-bold ${
                        isSelected ? 'text-primary-600 dark:text-primary-400' : 'text-gray-600 dark:text-gray-400'
                      }`}>
                        {probability}%
                      </span>
                      <FiTrendingUp className={`w-5 h-5 ${
                        isSelected ? 'text-primary-500' : 'text-gray-400'
                      }`} />
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Amount Selection with QuickBetWidget */}
        <QuickBetWidget
          onAmountSelect={handleAmountSelect}
          selectedAmount={amount}
          minAmount={1}
          maxAmount={10000}
        />

        {/* Potential Win Display */}
        {selectedOutcome !== null && amount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-2xl border border-green-200 dark:border-green-800"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-green-700 dark:text-green-300">Bet Amount</span>
                <span className="text-sm font-semibold text-green-900 dark:text-green-100">
                  ${amount.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-green-700 dark:text-green-300">Potential Profit</span>
                <span className="text-sm font-semibold text-green-900 dark:text-green-100">
                  +${potentialProfit.toFixed(2)}
                </span>
              </div>
              <div className="pt-2 border-t border-green-200 dark:border-green-700">
                <div className="flex items-center justify-between">
                  <span className="text-base font-semibold text-green-700 dark:text-green-300">
                    Potential Return
                  </span>
                  <span className="text-xl font-bold text-green-600 dark:text-green-400">
                    ${potentialWin.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Fixed Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 safe-bottom">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handlePlaceBet}
          disabled={selectedOutcome === null || !amount || amount <= 0 || isLoading}
          className={`w-full py-4 rounded-2xl font-bold text-lg touch-manipulation transition-all ${
            selectedOutcome === null || !amount || amount <= 0 || isLoading
              ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-500 cursor-not-allowed'
              : 'bg-primary-500 hover:bg-primary-600 text-white shadow-lg'
          }`}
        >
          {isLoading ? 'Placing Bet...' : 'Place Bet'}
        </motion.button>
      </div>
    </motion.div>
  );
};

export default MobileBettingInterface;
