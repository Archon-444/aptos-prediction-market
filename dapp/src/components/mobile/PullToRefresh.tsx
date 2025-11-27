import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiRefreshCw } from 'react-icons/fi';

interface PullToRefreshProps {
  isRefreshing: boolean;
  pullDistance: number;
  threshold?: number;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  isRefreshing,
  pullDistance,
  threshold = 80,
}) => {
  const progress = Math.min(pullDistance / threshold, 1);
  const rotation = progress * 360;

  return (
    <AnimatePresence>
      {(pullDistance > 0 || isRefreshing) && (
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center pt-4 safe-top"
          style={{
            transform: `translateY(${Math.min(pullDistance, threshold)}px)`,
          }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-full p-3 shadow-lg border border-gray-200 dark:border-gray-700">
            <motion.div
              animate={{
                rotate: isRefreshing ? 360 : rotation,
              }}
              transition={
                isRefreshing
                  ? {
                      duration: 1,
                      repeat: Infinity,
                      ease: 'linear',
                    }
                  : {
                      duration: 0.2,
                    }
              }
            >
              <FiRefreshCw
                className={`w-6 h-6 ${
                  isRefreshing
                    ? 'text-primary-500'
                    : progress >= 1
                    ? 'text-success-500'
                    : 'text-gray-400'
                }`}
              />
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
