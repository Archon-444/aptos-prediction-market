import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiClock, FiAlertTriangle } from 'react-icons/fi';
import { useSession, useSessionExpiryWarning, useFormattedSessionTime } from '../hooks/useSession';

export const SessionTimeoutWarning: React.FC = () => {
  const { extendSession, invalidateSession } = useSession();
  const { shouldWarn, minutesRemaining } = useSessionExpiryWarning();
  const formattedTime = useFormattedSessionTime();
  const [dismissed, setDismissed] = useState(false);

  // Reset dismissed state when warning appears again
  useEffect(() => {
    if (shouldWarn) {
      setDismissed(false);
    }
  }, [shouldWarn]);

  const handleExtend = () => {
    extendSession();
    setDismissed(true);
  };

  const handleLogout = () => {
    invalidateSession();
  };

  const showWarning = shouldWarn && !dismissed;

  return (
    <AnimatePresence>
      {showWarning && (
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-md px-4"
        >
          <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-xl shadow-2xl p-4 border-2 border-orange-300 dark:border-orange-700">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  <FiAlertTriangle className="w-6 h-6 text-white" />
                </div>
              </div>

              <div className="flex-1">
                <h3 className="text-white font-bold text-lg mb-1 flex items-center gap-2">
                  <FiClock className="w-5 h-5" />
                  Session Expiring Soon
                </h3>
                <p className="text-white/90 text-sm mb-3">
                  Your session will expire in{' '}
                  <span className="font-bold">{minutesRemaining} minute{minutesRemaining !== 1 ? 's' : ''}</span>.
                  Extend your session to stay logged in.
                </p>

                <div className="flex gap-2">
                  <button
                    onClick={handleExtend}
                    className="flex-1 px-4 py-2 bg-white text-orange-600 rounded-lg font-medium hover:bg-orange-50 transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-orange-500"
                  >
                    Extend Session
                  </button>
                  <button
                    onClick={handleLogout}
                    className="px-4 py-2 bg-white/10 text-white rounded-lg font-medium hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-orange-500"
                  >
                    Logout
                  </button>
                </div>
              </div>

              <button
                onClick={() => setDismissed(true)}
                className="flex-shrink-0 text-white/70 hover:text-white transition-colors"
                aria-label="Dismiss warning"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Progress bar */}
            <div className="mt-3 h-1 bg-white/20 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-white"
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: minutesRemaining * 60, ease: 'linear' }}
              />
            </div>

            <p className="text-white/70 text-xs mt-2 text-center">
              Time remaining: {formattedTime}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SessionTimeoutWarning;
