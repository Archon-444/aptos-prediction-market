import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiWifiOff, FiWifi } from 'react-icons/fi';

export const OfflineIndicator: React.FC = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setShowReconnected(true);
      setTimeout(() => setShowReconnected(false), 3000);
    };

    const handleOffline = () => {
      setIsOffline(true);
      setShowReconnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <AnimatePresence>
      {(isOffline || showReconnected) && (
        <motion.div
          initial={{ y: -100 }}
          animate={{ y: 0 }}
          exit={{ y: -100 }}
          className="fixed top-0 left-0 right-0 z-50 safe-top"
        >
          <div
            className={`${
              isOffline
                ? 'bg-yellow-500 dark:bg-yellow-600'
                : 'bg-green-500 dark:bg-green-600'
            } text-white py-2 px-4 text-center text-sm font-medium flex items-center justify-center gap-2`}
          >
            {isOffline ? (
              <>
                <FiWifiOff className="w-4 h-4" />
                <span>You're offline - Viewing cached data</span>
              </>
            ) : (
              <>
                <FiWifi className="w-4 h-4" />
                <span>Back online!</span>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default OfflineIndicator;
