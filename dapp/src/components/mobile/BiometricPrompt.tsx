import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiShield, FiX } from 'react-icons/fi';
import {
  isBiometricSupported,
  isBiometricRegistered,
  registerBiometric,
  getBiometricType,
} from '../../utils/biometricAuth';
import { hapticFeedback } from '../../utils/hapticFeedback';

interface BiometricPromptProps {
  userAddress?: string;
  onSetupComplete?: () => void;
}

export const BiometricPrompt: React.FC<BiometricPromptProps> = ({
  userAddress,
  onSetupComplete,
}) => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [biometricType, setBiometricType] = useState('Biometric');

  useEffect(() => {
    const checkAndShow = async () => {
      // Don't show if not supported
      const supported = await isBiometricSupported();
      if (!supported) {
        return;
      }

      // Don't show if already registered
      if (isBiometricRegistered()) {
        return;
      }

      // Don't show if no user address
      if (!userAddress) {
        return;
      }

      // Don't show if user dismissed before
      const dismissed = localStorage.getItem('biometric-setup-dismissed');
      if (dismissed) {
        return;
      }

      // Get biometric type
      setBiometricType(getBiometricType());

      // Show prompt after 45 seconds
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 45000);

      return () => clearTimeout(timer);
    };

    checkAndShow();
  }, [userAddress]);

  const handleSetup = async () => {
    if (!userAddress) return;

    hapticFeedback.buttonPress();
    setIsSettingUp(true);

    try {
      const result = await registerBiometric(userAddress);

      if (result.success) {
        hapticFeedback.success();
        setShowPrompt(false);
        onSetupComplete?.();
      } else {
        hapticFeedback.error();
        alert(result.error || 'Failed to setup biometric authentication');
      }
    } catch (error) {
      console.error('Error setting up biometric:', error);
      hapticFeedback.error();
    } finally {
      setIsSettingUp(false);
    }
  };

  const handleDismiss = () => {
    hapticFeedback.buttonTap();
    setShowPrompt(false);
    localStorage.setItem('biometric-setup-dismissed', 'true');
  };

  const handleRemindLater = () => {
    hapticFeedback.buttonTap();
    setShowPrompt(false);
  };

  return (
    <AnimatePresence>
      {showPrompt && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50"
            onClick={handleRemindLater}
          />

          {/* Prompt Card */}
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 p-4 safe-bottom"
          >
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              {/* Header */}
              <div className="relative bg-gradient-to-br from-indigo-500 to-purple-600 p-6 pb-8">
                <button
                  onClick={handleDismiss}
                  className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-lg transition-colors touch-manipulation"
                >
                  <FiX className="w-5 h-5 text-white" />
                </button>

                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-lg">
                    <FiShield className="w-8 h-8 text-indigo-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-1">
                      Enable {biometricType}
                    </h3>
                    <p className="text-sm text-indigo-100">
                      Secure & convenient authentication
                    </p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        Quick login
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Sign in with {biometricType} in seconds
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        Secure bets
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Confirm transactions with {biometricType}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        Bank-level security
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Your data stays on your device
                      </p>
                    </div>
                  </div>
                </div>

                {/* Info Box */}
                <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4">
                  <p className="text-sm text-indigo-900 dark:text-indigo-100">
                    <strong>Privacy First:</strong> Your biometric data never leaves your device.
                    We only verify that you authorized the action.
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleSetup}
                    disabled={isSettingUp}
                    className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold py-4 px-6 rounded-xl flex items-center justify-center gap-2 transition-all touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FiShield className="w-5 h-5" />
                    {isSettingUp ? 'Setting Up...' : `Enable ${biometricType}`}
                  </motion.button>

                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleRemindLater}
                    className="px-6 py-4 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-xl transition-colors touch-manipulation"
                  >
                    Later
                  </motion.button>
                </div>

                <p className="text-xs text-center text-gray-500 dark:text-gray-500">
                  You can enable this anytime in settings
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default BiometricPrompt;
