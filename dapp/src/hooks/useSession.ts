import { useContext, useEffect, useCallback } from 'react';
import SessionContext from '../contexts/SessionContext';

/**
 * Hook to access session management
 * Re-exported from SessionContext for convenience
 */
export const useSession = () => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};

/**
 * Hook to require an active session
 * Throws error if session is invalid
 */
export const useRequireSession = () => {
  const { isSessionValid, session, checkSession } = useSession();

  useEffect(() => {
    if (!checkSession()) {
      throw new Error('Valid session required');
    }
  }, [checkSession]);

  return { session, isSessionValid };
};

/**
 * Hook to get session expiry warning
 * Returns true if session expires in less than 5 minutes
 */
export const useSessionExpiryWarning = (warningThresholdMs = 5 * 60 * 1000) => {
  const { timeUntilExpiry, isSessionValid } = useSession();

  const shouldWarn = isSessionValid && timeUntilExpiry > 0 && timeUntilExpiry < warningThresholdMs;

  return {
    shouldWarn,
    timeRemaining: timeUntilExpiry,
    minutesRemaining: Math.floor(timeUntilExpiry / 60000),
  };
};

/**
 * Hook to format time remaining in session
 */
export const useFormattedSessionTime = () => {
  const { timeUntilExpiry } = useSession();

  const formatTime = useCallback((ms: number) => {
    if (ms <= 0) return '0m';

    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);

    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  }, []);

  return formatTime(timeUntilExpiry);
};

export default useSession;
