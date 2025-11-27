import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { logWalletEvent, errorLogger } from '../utils/logger';

// Session configuration
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds
const SESSION_CHECK_INTERVAL = 60 * 1000; // Check every minute
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

interface SessionData {
  sessionId: string;
  userId: string;
  createdAt: number;
  lastActivity: number;
  expiresAt: number;
  deviceId: string;
}

interface SessionContextType {
  session: SessionData | null;
  isSessionValid: boolean;
  timeUntilExpiry: number;
  createSession: (userId: string) => void;
  extendSession: () => void;
  invalidateSession: () => void;
  checkSession: () => boolean;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

// Generate secure session ID
function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 15);
  const extraRandom = Math.random().toString(36).substring(2, 15);
  return `${timestamp}-${randomPart}-${extraRandom}`;
}

// Generate device fingerprint (simple version - can be enhanced)
function generateDeviceId(): string {
  const navigator = window.navigator;
  const screen = window.screen;

  const fingerprint = [
    navigator.userAgent,
    navigator.language,
    screen.colorDepth,
    screen.width,
    screen.height,
    new Date().getTimezoneOffset(),
  ].join('|');

  // Simple hash function
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return Math.abs(hash).toString(36);
}

// Storage keys
const SESSION_STORAGE_KEY = 'prediction_market_session';
const DEVICE_ID_KEY = 'prediction_market_device_id';

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<SessionData | null>(null);
  const [timeUntilExpiry, setTimeUntilExpiry] = useState<number>(0);
  const activityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load session from localStorage on mount
  useEffect(() => {
    const storedSession = localStorage.getItem(SESSION_STORAGE_KEY);
    if (storedSession) {
      try {
        const parsedSession: SessionData = JSON.parse(storedSession);

        // Validate session hasn't expired
        if (parsedSession.expiresAt > Date.now()) {
          // Validate device ID matches
          const storedDeviceId = localStorage.getItem(DEVICE_ID_KEY);
          const currentDeviceId = generateDeviceId();

          if (storedDeviceId === currentDeviceId) {
            setSession(parsedSession);
            logWalletEvent('session_restored', {
              sessionId: parsedSession.sessionId,
              userId: parsedSession.userId,
            });
          } else {
            // Device mismatch - possible session hijacking attempt
            errorLogger.warn('Device ID mismatch - invalidating session', {
              storedDevice: storedDeviceId,
              currentDevice: currentDeviceId,
            });
            localStorage.removeItem(SESSION_STORAGE_KEY);
          }
        } else {
          // Session expired
          logWalletEvent('session_expired', {
            sessionId: parsedSession.sessionId,
          });
          localStorage.removeItem(SESSION_STORAGE_KEY);
        }
      } catch (error) {
        errorLogger.error('Failed to parse stored session', error);
        localStorage.removeItem(SESSION_STORAGE_KEY);
      }
    }
  }, []);

  // Create new session
  const createSession = useCallback((userId: string) => {
    const now = Date.now();
    const deviceId = generateDeviceId();

    const newSession: SessionData = {
      sessionId: generateSessionId(),
      userId,
      createdAt: now,
      lastActivity: now,
      expiresAt: now + SESSION_TIMEOUT,
      deviceId,
    };

    setSession(newSession);
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(newSession));
    localStorage.setItem(DEVICE_ID_KEY, deviceId);

    logWalletEvent('session_created', {
      sessionId: newSession.sessionId,
      userId: newSession.userId,
      expiresAt: new Date(newSession.expiresAt).toISOString(),
    });
  }, []);

  // Extend session (update last activity and expiry)
  const extendSession = useCallback(() => {
    if (!session) return;

    const now = Date.now();
    const updatedSession: SessionData = {
      ...session,
      lastActivity: now,
      expiresAt: now + SESSION_TIMEOUT,
    };

    setSession(updatedSession);
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(updatedSession));

    // Don't log every extension to avoid spam - could add throttling if needed
  }, [session]);

  // Invalidate session (logout)
  const invalidateSession = useCallback(() => {
    if (session) {
      logWalletEvent('session_invalidated', {
        sessionId: session.sessionId,
        userId: session.userId,
        duration: Date.now() - session.createdAt,
      });
    }

    setSession(null);
    localStorage.removeItem(SESSION_STORAGE_KEY);
    localStorage.removeItem(DEVICE_ID_KEY);
  }, [session]);

  // Check if session is still valid
  const checkSession = useCallback((): boolean => {
    if (!session) return false;

    const now = Date.now();
    const isExpired = session.expiresAt < now;
    const timeSinceActivity = now - session.lastActivity;

    if (isExpired || timeSinceActivity > SESSION_TIMEOUT) {
      logWalletEvent('session_timeout', {
        sessionId: session.sessionId,
        userId: session.userId,
        lastActivity: new Date(session.lastActivity).toISOString(),
      });
      invalidateSession();
      return false;
    }

    return true;
  }, [session, invalidateSession]);

  // Handle user activity
  const handleActivity = useCallback(() => {
    if (session) {
      // Clear existing timeout
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
      }

      // Debounce session extension (only extend every 60 seconds)
      activityTimeoutRef.current = setTimeout(() => {
        extendSession();
      }, 60 * 1000);
    }
  }, [session, extendSession]);

  // Set up activity listeners
  useEffect(() => {
    if (!session) return;

    ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [session, handleActivity]);

  // Periodic session check
  useEffect(() => {
    if (!session) {
      setTimeUntilExpiry(0);
      return;
    }

    checkIntervalRef.current = setInterval(() => {
      const isValid = checkSession();
      if (isValid && session) {
        const remaining = session.expiresAt - Date.now();
        setTimeUntilExpiry(Math.max(0, remaining));
      }
    }, SESSION_CHECK_INTERVAL);

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [session, checkSession]);

  // Update time until expiry immediately
  useEffect(() => {
    if (session) {
      const remaining = session.expiresAt - Date.now();
      setTimeUntilExpiry(Math.max(0, remaining));
    }
  }, [session]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
      }
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, []);

  // Compute session validity WITHOUT side effects (don't call checkSession during render)
  const isSessionValid = useMemo(() => {
    if (!session) return false;

    const now = Date.now();
    const isExpired = session.expiresAt < now;
    const timeSinceActivity = now - session.lastActivity;

    return !isExpired && timeSinceActivity <= SESSION_TIMEOUT;
  }, [session]);

  return (
    <SessionContext.Provider
      value={{
        session,
        isSessionValid,
        timeUntilExpiry,
        createSession,
        extendSession,
        invalidateSession,
        checkSession,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = (): SessionContextType => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};

export default SessionContext;
