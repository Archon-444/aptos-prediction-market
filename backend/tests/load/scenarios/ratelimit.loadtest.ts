/**
 * Load Test: Rate Limiting Verification
 *
 * Specifically tests that rate limiting works correctly:
 * - Single user exceeding limits
 * - Multiple users within limits
 * - Rate limit recovery
 * - Different endpoint limits
 *
 * Run with: k6 run ratelimit.loadtest.ts
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate } from 'k6/metrics';
import { loadTestConfig } from '../loadtest.config';

// Custom metrics
const rateLimitHits = new Counter('rate_limit_hits');
const rateLimitRecoveries = new Counter('rate_limit_recoveries');
const successfulRequests = new Rate('successful_requests');

export const options = {
  scenarios: {
    // Scenario 1: Single user exceeds rate limit
    singleUserSpam: {
      executor: 'per-vu-iterations',
      vus: 1,
      iterations: 100, // Try to make 100 requests (limit is 60/min)
      maxDuration: '2m',
      startTime: '0s',
      tags: { scenario: 'single_user' },
    },

    // Scenario 2: Multiple users within limits
    multipleUsersNormal: {
      executor: 'constant-vus',
      vus: 10,
      duration: '2m',
      startTime: '2m', // Start after first scenario
      tags: { scenario: 'multiple_users' },
    },

    // Scenario 3: Recovery test
    recoveryTest: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 50 }, // Exceed limits
        { duration: '1m', target: 0 }, // Wait for recovery
        { duration: '30s', target: 10 }, // Normal load
      ],
      startTime: '4m',
      tags: { scenario: 'recovery' },
    },
  },
  thresholds: {
    'rate_limit_hits': ['count>0'], // Expect rate limits to trigger
    'successful_requests': ['rate>0.5'], // At least 50% should succeed
  },
};

const BASE_URL = __ENV.API_URL || loadTestConfig.environments.local;
const TEST_WALLET = loadTestConfig.testWallets[0];

// Test different endpoint rate limits
export default function () {
  const scenario = __ENV.SCENARIO || 'single_user';

  // Test public endpoint (60 req/min limit)
  const publicResponse = http.get(`${BASE_URL}/api/suggestions`, {
    tags: { endpoint: 'public' },
  });

  const isRateLimited = publicResponse.status === 429;
  const isSuccess = publicResponse.status === 200;

  if (isRateLimited) {
    rateLimitHits.add(1);

    // Verify rate limit response format
    check(publicResponse, {
      'rate limit has error message': (r) => {
        try {
          const body = JSON.parse(r.body);
          return !!body.error;
        } catch {
          return false;
        }
      },
      'rate limit has retry-after': (r) => {
        try {
          const body = JSON.parse(r.body);
          return typeof body.retryAfter === 'number';
        } catch {
          return false;
        }
      },
      'rate limit has RateLimit-Reset header': (r) => r.headers['RateLimit-Reset'] !== undefined,
    });

    // Log rate limit for analysis
    console.log(`Rate limited at request #${__ITER + 1}`);
  }

  if (isSuccess) {
    successfulRequests.add(1);
  }

  // Small delay between requests
  sleep(0.1);

  // Test authenticated endpoint (120 req/min limit)
  if (__ITER % 2 === 0) {
    const authResponse = http.post(
      `${BASE_URL}/api/suggestions`,
      JSON.stringify({
        question: `Test question ${__ITER}?`,
        outcomes: ['Yes', 'No'],
        category: 'general',
        durationHours: 24,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          'x-dev-wallet-address': TEST_WALLET,
        },
        tags: { endpoint: 'authenticated' },
      }
    );

    if (authResponse.status === 429) {
      rateLimitHits.add(1);
      console.log(`Auth endpoint rate limited at request #${__ITER + 1}`);
    }

    if (authResponse.status === 201) {
      successfulRequests.add(1);
    }

    sleep(0.1);
  }
}

export function setup() {
  console.log('\n=== Rate Limit Test Configuration ===');
  console.log(`API URL: ${BASE_URL}`);
  console.log('Expected limits:');
  console.log('  - Public API: 60 req/min');
  console.log('  - Authenticated API: 120 req/min');
  console.log('  - Admin API: 300 req/min');
  console.log('  - Blockchain writes: 10 req/min');
  console.log('  - Strict operations: 20 req/min');
  console.log('\n=== Starting Tests ===\n');

  return { startTime: Date.now() };
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;

  console.log('\n=== Rate Limit Test Results ===');
  console.log(`Total duration: ${duration.toFixed(2)}s`);
  console.log('\nVerify that:');
  console.log('1. Rate limits were triggered (rate_limit_hits > 0)');
  console.log('2. Rate limit responses have proper format');
  console.log('3. System recovered after rate limit window');
  console.log('4. Different endpoints have different limits');
}
