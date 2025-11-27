import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiZap } from 'react-icons/fi';

interface QuickBetWidgetProps {
  onAmountSelect: (amount: number) => void;
  selectedAmount?: number;
  minAmount?: number;
  maxAmount?: number;
}

const PRESET_AMOUNTS = [5, 10, 25, 50, 100];

export function QuickBetWidget({
  onAmountSelect,
  selectedAmount,
  minAmount = 1,
  maxAmount = 10000,
}: QuickBetWidgetProps) {
  const [customAmount, setCustomAmount] = useState<string>('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [lastUsedAmount, setLastUsedAmount] = useState<number | null>(null);

  // Load last used amount from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('lastBetAmount');
    if (stored) {
      const amount = parseFloat(stored);
      if (!isNaN(amount) && amount >= minAmount && amount <= maxAmount) {
        setLastUsedAmount(amount);
      }
    }
  }, [minAmount, maxAmount]);

  const handlePresetSelect = (amount: number) => {
    localStorage.setItem('lastBetAmount', amount.toString());
    setLastUsedAmount(amount);
    setShowCustomInput(false);
    setCustomAmount('');
    onAmountSelect(amount);
  };

  const handleCustomAmountChange = (value: string) => {
    // Only allow numbers and decimal point
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setCustomAmount(value);
    }
  };

  const handleCustomAmountSubmit = () => {
    const amount = parseFloat(customAmount);
    if (!isNaN(amount) && amount >= minAmount && amount <= maxAmount) {
      localStorage.setItem('lastBetAmount', amount.toString());
      setLastUsedAmount(amount);
      onAmountSelect(amount);
      setShowCustomInput(false);
    }
  };

  const isPresetSelected = (amount: number) => selectedAmount === amount;
  const isLastUsedPreset = lastUsedAmount && PRESET_AMOUNTS.includes(lastUsedAmount);

  return (
    <div className="space-y-4">
      {/* Quick Bet Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FiZap className="w-5 h-5 text-primary-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Quick Bet
          </h3>
        </div>
        {lastUsedAmount && !isLastUsedPreset && (
          <button
            onClick={() => handlePresetSelect(lastUsedAmount)}
            className="text-sm text-primary-600 dark:text-primary-400 font-medium"
          >
            Last: ${lastUsedAmount}
          </button>
        )}
      </div>

      {/* Preset Amount Grid */}
      <div className="grid grid-cols-3 gap-3">
        {PRESET_AMOUNTS.map((amount) => {
          const isSelected = isPresetSelected(amount);
          const isLastUsed = lastUsedAmount === amount;

          return (
            <motion.button
              key={amount}
              whileTap={{ scale: 0.95 }}
              onClick={() => handlePresetSelect(amount)}
              className={`
                relative overflow-hidden rounded-xl p-4 font-semibold text-lg
                transition-all duration-200 touch-manipulation
                ${
                  isSelected
                    ? 'bg-gradient-to-br from-primary-500 to-secondary-500 text-white shadow-lg shadow-primary-500/30'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700'
                }
              `}
            >
              {/* Glow effect for selected */}
              {isSelected && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 bg-gradient-to-br from-primary-400/20 to-secondary-400/20"
                />
              )}

              {/* Last used indicator */}
              {isLastUsed && !isSelected && (
                <div className="absolute top-1 right-1 w-2 h-2 bg-primary-500 rounded-full" />
              )}

              <span className="relative z-10">${amount}</span>
            </motion.button>
          );
        })}

        {/* Custom Amount Button */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowCustomInput(!showCustomInput)}
          className={`
            rounded-xl p-4 font-semibold text-lg
            transition-all duration-200 touch-manipulation
            ${
              showCustomInput
                ? 'bg-gradient-to-br from-secondary-500 to-primary-500 text-white shadow-lg shadow-secondary-500/30'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700'
            }
          `}
        >
          Custom
        </motion.button>
      </div>

      {/* Custom Amount Input */}
      {showCustomInput && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="space-y-3"
        >
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 text-lg font-semibold">
              $
            </span>
            <input
              type="text"
              inputMode="decimal"
              placeholder="Enter amount"
              value={customAmount}
              onChange={(e) => handleCustomAmountChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCustomAmountSubmit();
                }
              }}
              className="w-full pl-8 pr-4 py-4 text-lg font-semibold rounded-xl
                bg-white dark:bg-gray-800
                border-2 border-gray-200 dark:border-gray-700
                focus:border-primary-500 dark:focus:border-primary-500
                text-gray-900 dark:text-white
                placeholder-gray-400 dark:placeholder-gray-500
                outline-none transition-colors"
            />
          </div>

          <div className="flex gap-2 text-xs text-gray-600 dark:text-gray-400">
            <span>Min: ${minAmount}</span>
            <span>•</span>
            <span>Max: ${maxAmount}</span>
          </div>

          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleCustomAmountSubmit}
            disabled={!customAmount || parseFloat(customAmount) < minAmount || parseFloat(customAmount) > maxAmount}
            className="w-full py-4 rounded-xl font-semibold text-lg
              bg-gradient-to-r from-primary-500 to-secondary-500
              text-white shadow-lg shadow-primary-500/30
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all duration-200 touch-manipulation"
          >
            Set Custom Amount
          </motion.button>
        </motion.div>
      )}

      {/* Quick Info */}
      <div className="flex items-center justify-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        <FiZap className="w-3 h-3" />
        <span>Tap any amount for instant betting</span>
      </div>
    </div>
  );
}

export default QuickBetWidget;
