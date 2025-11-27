import React, { useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { FiClock, FiTrendingUp, FiUsers } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { sanitizeMarketQuestion, sanitizeText } from '../../utils/sanitize';

interface Market {
  id: number;
  question: string;
  outcomes: string[];
  outcomeStakes: number[];
  endTime: number;
  totalStakes: number;
  resolved: boolean;
}

interface MobileMarketCardProps {
  market: Market;
}

export const MobileMarketCard: React.FC<MobileMarketCardProps> = React.memo(({ market }) => {
  const navigate = useNavigate();

  // Memoize computed values
  const odds = useMemo(() => {
    const totalStake = market.totalStakes || 1;
    return market.outcomeStakes.map((stake) =>
      Math.round((stake / totalStake) * 100)
    );
  }, [market.totalStakes, market.outcomeStakes]);

  const timeRemaining = useMemo(() => {
    const now = Date.now();
    const remaining = market.endTime - now;

    if (remaining <= 0) return 'Ended';

    const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
    const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h`;
    return `<1h`;
  }, [market.endTime]);

  const formattedVolume = useMemo(() => {
    const amount = market.totalStakes / 1000000;
    if (amount >= 1) return `$${amount.toFixed(1)}M`;
    if (amount * 1000 >= 1) return `$${(amount * 1000).toFixed(1)}K`;
    return `$${(amount * 1000000).toFixed(0)}`;
  }, [market.totalStakes]);

  const handleClick = useCallback(() => {
    navigate(`/market/${market.id}`);
  }, [navigate, market.id]);

  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`View market: ${market.question}`}
      className="bg-white dark:bg-gray-800 rounded-2xl shadow-card border border-gray-200 dark:border-gray-700 overflow-hidden touch-manipulation active:shadow-lg transition-shadow focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
    >
      {/* Header */}
      <div className="p-4 pb-3">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white line-clamp-2 leading-tight">
          {sanitizeMarketQuestion(market.question)}
        </h3>
      </div>

      {/* Outcomes - Touch-Optimized */}
      <div className="px-4 pb-3 space-y-2">
        {market.outcomes.slice(0, 2).map((outcome, index) => (
          <div
            key={index}
            className="relative overflow-hidden rounded-xl bg-gray-50 dark:bg-gray-700/50 p-3"
          >
            {/* Background Bar */}
            <div
              className="absolute top-0 left-0 bottom-0 bg-gradient-to-r from-primary-500/20 to-primary-500/10 transition-all"
              style={{ width: `${odds[index] || 0}%` }}
            />

            {/* Content */}
            <div className="relative flex items-center justify-between">
              <span className="font-medium text-gray-900 dark:text-white text-sm">
                {sanitizeText(outcome)}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-primary-600 dark:text-primary-400">
                  {odds[index] || 0}%
                </span>
                <FiTrendingUp className="w-4 h-4 text-primary-500" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer Stats */}
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-1">
            <FiClock className="w-4 h-4" />
            <span>{timeRemaining}</span>
          </div>

          <div className="flex items-center gap-1">
            <FiUsers className="w-4 h-4" />
            <span>{formattedVolume} volume</span>
          </div>

          {market.resolved && (
            <div className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-medium">
              Resolved
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
});

MobileMarketCard.displayName = 'MobileMarketCard';

export default MobileMarketCard;
