/**
 * Rate Limiting & DoS Protection
 *
 * Prevents abuse by limiting the number of requests a user can make
 * within a specified time window.
 *
 * Use this to protect against:
 * - API flooding
 * - Transaction spam
 * - Resource exhaustion
 */

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  blockDurationMs?: number;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
  blockedUntil?: number;
}

class RateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = {
      blockDurationMs: 60000, // Default 1 minute block
      ...config,
    };

    // Cleanup expired entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Check if request is allowed
   * Returns true if allowed, false if rate limited
   */
  public check(key: string): boolean {
    const now = Date.now();
    const entry = this.limits.get(key);

    // Check if currently blocked
    if (entry?.blockedUntil && entry.blockedUntil > now) {
      return false;
    }

    // No entry or reset time passed - allow and create new entry
    if (!entry || entry.resetTime <= now) {
      this.limits.set(key, {
        count: 1,
        resetTime: now + this.config.windowMs,
      });
      return true;
    }

    // Increment counter
    entry.count++;

    // Check if exceeded limit
    if (entry.count > this.config.maxRequests) {
      entry.blockedUntil = now + (this.config.blockDurationMs || 60000);
      return false;
    }

    return true;
  }

  /**
   * Get remaining requests for a key
   */
  public getRemaining(key: string): number {
    const entry = this.limits.get(key);
    if (!entry || entry.resetTime <= Date.now()) {
      return this.config.maxRequests;
    }
    return Math.max(0, this.config.maxRequests - entry.count);
  }

  /**
   * Get time until reset (in milliseconds)
   */
  public getResetTime(key: string): number {
    const entry = this.limits.get(key);
    if (!entry) {
      return 0;
    }

    if (entry.blockedUntil && entry.blockedUntil > Date.now()) {
      return entry.blockedUntil - Date.now();
    }

    return Math.max(0, entry.resetTime - Date.now());
  }

  /**
   * Check if key is currently blocked
   */
  public isBlocked(key: string): boolean {
    const entry = this.limits.get(key);
    return !!(entry?.blockedUntil && entry.blockedUntil > Date.now());
  }

  /**
   * Reset limit for a key
   */
  public reset(key: string): void {
    this.limits.delete(key);
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.limits.entries()) {
      if (entry.resetTime <= now && (!entry.blockedUntil || entry.blockedUntil <= now)) {
        this.limits.delete(key);
      }
    }
  }
}

// ==================== Preconfigured Rate Limiters ====================

/**
 * Rate limiter for bet placement
 * Max 10 bets per minute per user
 */
export const betRateLimiter = new RateLimiter({
  maxRequests: 10,
  windowMs: 60 * 1000, // 1 minute
  blockDurationMs: 5 * 60 * 1000, // 5 minute block
});

/**
 * Rate limiter for market creation
 * Max 5 markets per hour per user
 */
export const marketCreationRateLimiter = new RateLimiter({
  maxRequests: 5,
  windowMs: 60 * 60 * 1000, // 1 hour
  blockDurationMs: 30 * 60 * 1000, // 30 minute block
});

/**
 * Rate limiter for API calls
 * Max 100 requests per minute per user
 */
export const apiRateLimiter = new RateLimiter({
  maxRequests: 100,
  windowMs: 60 * 1000, // 1 minute
  blockDurationMs: 60 * 1000, // 1 minute block
});

/**
 * Rate limiter for wallet connection attempts
 * Max 10 attempts per 5 minutes
 */
export const walletConnectionRateLimiter = new RateLimiter({
  maxRequests: 10,
  windowMs: 5 * 60 * 1000, // 5 minutes
  blockDurationMs: 10 * 60 * 1000, // 10 minute block
});

/**
 * Rate limiter for search queries
 * Max 30 searches per minute
 */
export const searchRateLimiter = new RateLimiter({
  maxRequests: 30,
  windowMs: 60 * 1000, // 1 minute
  blockDurationMs: 60 * 1000, // 1 minute block
});

// ==================== Helper Functions ====================

/**
 * Check if action is rate limited and throw error if exceeded
 */
export function enforceRateLimit(
  limiter: RateLimiter,
  key: string,
  errorMessage: string = 'Rate limit exceeded. Please try again later.'
): void {
  if (!limiter.check(key)) {
    const resetTime = limiter.getResetTime(key);
    const resetSeconds = Math.ceil(resetTime / 1000);
    throw new Error(`${errorMessage} Try again in ${resetSeconds} seconds.`);
  }
}

/**
 * Get user-friendly rate limit info
 */
export function getRateLimitInfo(limiter: RateLimiter, key: string) {
  return {
    remaining: limiter.getRemaining(key),
    resetTime: limiter.getResetTime(key),
    isBlocked: limiter.isBlocked(key),
  };
}

/**
 * Create custom rate limiter
 */
export function createRateLimiter(config: RateLimitConfig): RateLimiter {
  return new RateLimiter(config);
}

// ==================== React Hook for Rate Limiting ====================

/**
 * Hook for using rate limiters in React components
 */
export function useRateLimit(limiter: RateLimiter, key: string) {
  const check = (): boolean => {
    return limiter.check(key);
  };

  const info = getRateLimitInfo(limiter, key);

  return {
    check,
    ...info,
  };
}

// ==================== Local Storage Based Rate Limiting ====================

/**
 * Persistent rate limiter using localStorage
 * Survives page refreshes
 */
export class PersistentRateLimiter {
  private storageKey: string;
  private config: RateLimitConfig;

  constructor(name: string, config: RateLimitConfig) {
    this.storageKey = `rate_limit_${name}`;
    this.config = {
      blockDurationMs: 60000,
      ...config,
    };
  }

  private getEntry(): RateLimitEntry | null {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  private setEntry(entry: RateLimitEntry): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(entry));
    } catch {
      // Handle localStorage quota exceeded
      console.warn('Failed to save rate limit data to localStorage');
    }
  }

  public check(): boolean {
    const now = Date.now();
    const entry = this.getEntry();

    // Check if currently blocked
    if (entry?.blockedUntil && entry.blockedUntil > now) {
      return false;
    }

    // No entry or reset time passed
    if (!entry || entry.resetTime <= now) {
      this.setEntry({
        count: 1,
        resetTime: now + this.config.windowMs,
      });
      return true;
    }

    // Increment counter
    const newEntry: RateLimitEntry = {
      ...entry,
      count: entry.count + 1,
    };

    // Check if exceeded limit
    if (newEntry.count > this.config.maxRequests) {
      newEntry.blockedUntil = now + (this.config.blockDurationMs || 60000);
      this.setEntry(newEntry);
      return false;
    }

    this.setEntry(newEntry);
    return true;
  }

  public getRemaining(): number {
    const entry = this.getEntry();
    if (!entry || entry.resetTime <= Date.now()) {
      return this.config.maxRequests;
    }
    return Math.max(0, this.config.maxRequests - entry.count);
  }

  public getResetTime(): number {
    const entry = this.getEntry();
    if (!entry) {
      return 0;
    }

    if (entry.blockedUntil && entry.blockedUntil > Date.now()) {
      return entry.blockedUntil - Date.now();
    }

    return Math.max(0, entry.resetTime - Date.now());
  }

  public isBlocked(): boolean {
    const entry = this.getEntry();
    return !!(entry?.blockedUntil && entry.blockedUntil > Date.now());
  }

  public reset(): void {
    localStorage.removeItem(this.storageKey);
  }
}

// ==================== Exports ====================

export type { RateLimitConfig, RateLimitEntry };
export { RateLimiter };
