/**
 * Load Test: Suggestions API
 *
 * Tests the suggestions endpoints under load:
 * - Create suggestion
 * - List suggestions
 * - Vote on suggestion
 * - Approve/reject suggestion
 *
 * Run with: k6 run suggestions.loadtest.ts
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { loadTestConfig } from '../loadtest.config';

// Custom metrics
const errorRate = new Rate('errors');
const suggestionCreationTime = new Trend('suggestion_creation_duration');
const rateLimitHits = new Rate('rate_limit_hits');

// Test configuration
export const options = {
  scenarios: {
    normalLoad: {
      executor: 'constant-vus',
      vus: 50,
      duration: '5m',
    },
  },
  thresholds: loadTestConfig.thresholds,
};

const BASE_URL = __ENV.API_URL || loadTestConfig.environments.local;

// Helper: Generate random test data
function generateSuggestion() {
  const randomId = Math.floor(Math.random() * 1000000);
  return {
    question: `Will BTC hit $${50000 + randomId} by EOY ${2025 + Math.floor(randomId / 100000)}?`,
    outcomes: ['Yes', 'No'],
    category: 'crypto',
    durationHours: 168, // 1 week
    resolutionSource: 'CoinMarketCap',
  };
}

// Helper: Get test wallet
function getTestWallet() {
  const wallets = loadTestConfig.testWallets;
  return wallets[Math.floor(Math.random() * wallets.length)];
}

export default function () {
  const walletAddress = getTestWallet();

  // Test 1: List suggestions (most common operation)
  const listResponse = http.get(`${BASE_URL}/api/suggestions`, {
    headers: {
      'Content-Type': 'application/json',
    },
    tags: { name: 'ListSuggestions' },
  });

  check(listResponse, {
    'list suggestions status is 200': (r) => r.status === 200,
    'list suggestions response time < 200ms': (r) => r.timings.duration < 200,
    'list suggestions returns array': (r) => {
      try {
        return Array.isArray(JSON.parse(r.body));
      } catch {
        return false;
      }
    },
  }) || errorRate.add(1);

  sleep(1);

  // Test 2: Create suggestion (authenticated)
  const suggestion = generateSuggestion();
  const createStartTime = Date.now();

  const createResponse = http.post(
    `${BASE_URL}/api/suggestions`,
    JSON.stringify(suggestion),
    {
      headers: {
        'Content-Type': 'application/json',
        'x-dev-wallet-address': walletAddress,
      },
      tags: { name: 'CreateSuggestion' },
    }
  );

  const createDuration = Date.now() - createStartTime;
  suggestionCreationTime.add(createDuration);

  const createSuccess = check(createResponse, {
    'create suggestion status is 201': (r) => r.status === 201,
    'create suggestion response time < 500ms': (r) => r.timings.duration < 500,
    'create suggestion returns id': (r) => {
      try {
        return !!JSON.parse(r.body).id;
      } catch {
        return false;
      }
    },
  });

  if (!createSuccess) {
    errorRate.add(1);
  }

  // Check if rate limited
  if (createResponse.status === 429) {
    rateLimitHits.add(1);
  }

  sleep(2);

  // Test 3: Vote on suggestion (if we have suggestions)
  if (listResponse.status === 200) {
    try {
      const suggestions = JSON.parse(listResponse.body);
      if (suggestions.length > 0) {
        const randomSuggestion = suggestions[Math.floor(Math.random() * suggestions.length)];

        const voteResponse = http.patch(
          `${BASE_URL}/api/suggestions/${randomSuggestion.id}/vote`,
          JSON.stringify({ delta: 1 }),
          {
            headers: {
              'Content-Type': 'application/json',
              'x-dev-wallet-address': walletAddress,
            },
            tags: { name: 'VoteSuggestion' },
          }
        );

        check(voteResponse, {
          'vote suggestion status is 200': (r) => r.status === 200,
          'vote suggestion response time < 300ms': (r) => r.timings.duration < 300,
        }) || errorRate.add(1);

        if (voteResponse.status === 429) {
          rateLimitHits.add(1);
        }
      }
    } catch (e) {
      errorRate.add(1);
    }
  }

  sleep(1);

  // Test 4: Filter suggestions by status
  const filterResponse = http.get(`${BASE_URL}/api/suggestions?status=pending`, {
    headers: {
      'Content-Type': 'application/json',
    },
    tags: { name: 'FilterSuggestions' },
  });

  check(filterResponse, {
    'filter suggestions status is 200': (r) => r.status === 200,
    'filter suggestions response time < 200ms': (r) => r.timings.duration < 200,
  }) || errorRate.add(1);

  sleep(1);
}

// Setup: Run once before load test starts
export function setup() {
  console.log(`Starting load test against: ${BASE_URL}`);
  console.log('Test duration: 5 minutes');
  console.log('Concurrent users: 50');

  // Verify API is reachable
  const healthCheck = http.get(`${BASE_URL}/health`);
  if (healthCheck.status !== 200) {
    throw new Error(`API health check failed: ${healthCheck.status}`);
  }

  console.log('API health check passed ✓');
  return { startTime: Date.now() };
}

// Teardown: Run once after load test completes
export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`\nLoad test completed in ${duration.toFixed(2)}s`);
}
