/**
 * Logging and Monitoring Infrastructure
 *
 * Centralized logging system with different severity levels
 * Ready for integration with external monitoring services (Sentry, LogRocket, etc.)
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  CRITICAL = 4,
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
  context?: Record<string, any>;
  error?: Error;
  userId?: string;
  sessionId?: string;
}

export interface LoggerConfig {
  minLevel: LogLevel;
  enableConsole: boolean;
  enableStorage: boolean;
  maxStoredLogs: number;
  sentryDsn?: string;
  userId?: string;
}

class Logger {
  private config: LoggerConfig;
  private sessionId: string;
  private logs: LogEntry[] = [];

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      minLevel: import.meta.env.PROD ? LogLevel.WARN : LogLevel.DEBUG,
      enableConsole: true,
      enableStorage: true,
      maxStoredLogs: 100,
      ...config,
    };

    this.sessionId = this.generateSessionId();

    // Load stored logs from localStorage
    if (this.config.enableStorage) {
      this.loadLogs();
    }

    // Initialize Sentry if DSN provided
    if (this.config.sentryDsn) {
      this.initializeSentry();
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  private initializeSentry(): void {
    // TODO: Initialize Sentry
    // Example:
    // Sentry.init({
    //   dsn: this.config.sentryDsn,
    //   environment: process.env.NODE_ENV,
    //   beforeSend: (event) => {
    //     // Filter sensitive data
    //     return event;
    //   },
    // });
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.config.minLevel;
  }

  private createLogEntry(level: LogLevel, message: string, context?: Record<string, any>, error?: Error): LogEntry {
    return {
      level,
      message,
      timestamp: Date.now(),
      context,
      error,
      userId: this.config.userId,
      sessionId: this.sessionId,
    };
  }

  private storeLog(entry: LogEntry): void {
    this.logs.push(entry);

    // Keep only recent logs
    if (this.logs.length > this.config.maxStoredLogs) {
      this.logs = this.logs.slice(-this.config.maxStoredLogs);
    }

    // Persist to localStorage
    if (this.config.enableStorage) {
      try {
        localStorage.setItem('app_logs', JSON.stringify(this.logs));
      } catch (error) {
        // Handle storage quota exceeded
        console.warn('Failed to store logs:', error);
      }
    }
  }

  private loadLogs(): void {
    try {
      const stored = localStorage.getItem('app_logs');
      if (stored) {
        this.logs = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load stored logs:', error);
    }
  }

  private formatLogMessage(entry: LogEntry): string {
    const levelName = LogLevel[entry.level];
    const timestamp = new Date(entry.timestamp).toISOString();
    return `[${timestamp}] [${levelName}] ${entry.message}`;
  }

  private logToConsole(entry: LogEntry): void {
    if (!this.config.enableConsole) return;

    const formatted = this.formatLogMessage(entry);

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(formatted, entry.context || '');
        break;
      case LogLevel.INFO:
        console.info(formatted, entry.context || '');
        break;
      case LogLevel.WARN:
        console.warn(formatted, entry.context || '');
        break;
      case LogLevel.ERROR:
      case LogLevel.CRITICAL:
        console.error(formatted, entry.error || entry.context || '');
        break;
    }
  }

  private sendToMonitoring(_entry: LogEntry): void {
    // TODO: Send to external monitoring service (Sentry, LogRocket, etc.)
    // Example:
    // if (entry.level >= LogLevel.ERROR && entry.error) {
    //   Sentry.captureException(entry.error, {
    //     contexts: {
    //       custom: entry.context,
    //     },
    //     tags: {
    //       sessionId: entry.sessionId,
    //       userId: entry.userId,
    //     },
    //   });
    // }
  }

  private log(level: LogLevel, message: string, context?: Record<string, any>, error?: Error): void {
    if (!this.shouldLog(level)) return;

    const entry = this.createLogEntry(level, message, context, error);

    this.storeLog(entry);
    this.logToConsole(entry);
    this.sendToMonitoring(entry);
  }

  // Public logging methods
  public debug(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  public info(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, context);
  }

  public warn(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, context);
  }

  public error(message: string, error?: Error, context?: Record<string, any>): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  public critical(message: string, error?: Error, context?: Record<string, any>): void {
    this.log(LogLevel.CRITICAL, message, context, error);
  }

  // Utility methods
  public setUserId(userId: string): void {
    this.config.userId = userId;
  }

  public getLogs(): LogEntry[] {
    return [...this.logs];
  }

  public clearLogs(): void {
    this.logs = [];
    if (this.config.enableStorage) {
      localStorage.removeItem('app_logs');
    }
  }

  public exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

// ==================== Domain-Specific Loggers ====================

/**
 * Logger for wallet operations
 */
export const walletLogger = new Logger({
  minLevel: LogLevel.INFO,
});

/**
 * Logger for transaction operations
 */
export const transactionLogger = new Logger({
  minLevel: LogLevel.INFO,
});

/**
 * Logger for market operations
 */
export const marketLogger = new Logger({
  minLevel: LogLevel.INFO,
});

/**
 * Logger for error tracking
 */
export const errorLogger = new Logger({
  minLevel: LogLevel.ERROR,
});

/**
 * General application logger
 */
export const appLogger = new Logger({
  minLevel: import.meta.env.PROD ? LogLevel.WARN : LogLevel.DEBUG,
});

// ==================== Convenience Functions ====================

/**
 * Log user action
 */
export function logUserAction(action: string, context?: Record<string, any>): void {
  appLogger.info(`User action: ${action}`, context);
}

/**
 * Log transaction event
 */
export function logTransaction(type: string, details: Record<string, any>): void {
  transactionLogger.info(`Transaction: ${type}`, details);
}

/**
 * Log wallet event
 */
export function logWalletEvent(event: string, details?: Record<string, any>): void {
  walletLogger.info(`Wallet: ${event}`, details);
}

/**
 * Log market event
 */
export function logMarketEvent(event: string, marketId: number, details?: Record<string, any>): void {
  marketLogger.info(`Market ${marketId}: ${event}`, details);
}

/**
 * Log error with context
 */
export function logError(message: string, error: Error, context?: Record<string, any>): void {
  errorLogger.error(message, error, context);
}

// ==================== Performance Monitoring ====================

export class PerformanceMonitor {
  private static marks: Map<string, number> = new Map();

  static start(label: string): void {
    this.marks.set(label, performance.now());
  }

  static end(label: string): number {
    const startTime = this.marks.get(label);
    if (!startTime) {
      appLogger.warn(`Performance mark not found: ${label}`);
      return 0;
    }

    const duration = performance.now() - startTime;
    this.marks.delete(label);

    appLogger.debug(`Performance: ${label}`, { duration: `${duration.toFixed(2)}ms` });

    return duration;
  }

  static measure(label: string, fn: () => any): any {
    this.start(label);
    try {
      const result = fn();
      this.end(label);
      return result;
    } catch (error) {
      this.end(label);
      throw error;
    }
  }

  static async measureAsync(label: string, fn: () => Promise<any>): Promise<any> {
    this.start(label);
    try {
      const result = await fn();
      this.end(label);
      return result;
    } catch (error) {
      this.end(label);
      throw error;
    }
  }
}

// ==================== Analytics Integration ====================

export interface AnalyticsEvent {
  category: string;
  action: string;
  label?: string;
  value?: number;
}

export function trackEvent(event: AnalyticsEvent): void {
  appLogger.debug('Analytics event', event);

  // TODO: Send to analytics service (Google Analytics, Mixpanel, etc.)
  // Example:
  // gtag('event', event.action, {
  //   event_category: event.category,
  //   event_label: event.label,
  //   value: event.value,
  // });
}

export function trackPageView(path: string): void {
  trackEvent({
    category: 'Navigation',
    action: 'page_view',
    label: path,
  });
}

// ==================== Export ====================

export { Logger };
export default appLogger;
