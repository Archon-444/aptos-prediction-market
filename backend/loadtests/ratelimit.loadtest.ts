import autocannon from 'autocannon';
import ora from 'ora';
import chalk from 'chalk';

import { loadTestConfig } from './loadtest.config.js';

const spinner = ora('Starting rate limit verification').start();

const targetUrl = `${loadTestConfig.baseUrl}/api/suggestions`;

const main = async () => {
  spinner.text = 'Firing requests to trigger rate limiting';

  const result = await autocannon({
    url: targetUrl,
    method: 'POST',
    connections: loadTestConfig.connections,
    duration: loadTestConfig.durationSeconds,
    warmup: { duration: loadTestConfig.warmupSeconds },
    headers: {
      ...loadTestConfig.headers,
      'content-type': 'application/json',
    },
    setupClient: (client) => {
      let counter = 0;
      client.on('request', () => {
        const payload = JSON.stringify({
          question: `Rate limit probe ${counter} - ${Date.now()}`,
          outcomes: ['Yes', 'No'],
          category: 'rate-limit-test',
          durationHours: 24,
        });
        counter += 1;
        client.setBody(payload);
      });
    },
  });

  spinner.stop();

  const totalRequests = result.requests.total;
  const throttled = result['429'] ?? 0;
  const failure = result['5xx'] ?? 0;

  console.log(chalk.blueBright('\nRate Limit Stress Test Summary'));
  console.log(chalk.blue('────────────────────────────────────'));
  console.log(`Total Requests: ${totalRequests}`);
  console.log(`HTTP 200: ${result['2xx'] ?? 0}`);
  console.log(`HTTP 400: ${result['4xx'] ?? 0}`);
  console.log(`HTTP 429: ${throttled}`);
  console.log(`HTTP 500: ${failure}`);
  console.log(`Avg Latency: ${result.latency.average} ms`);
  console.log(`P99 Latency: ${result.latency.p99} ms\n`);

  if (throttled === 0) {
    console.log(
      chalk.yellow(
        '⚠️  No 429 responses detected. Verify that rate-limiting thresholds are configured as expected.',
      ),
    );
  } else if (failure > 0) {
    console.log(
      chalk.red(
        '❌  Server returned 5xx responses under load. Investigate backend capacity or error handling.',
      ),
    );
  } else {
    console.log(
      chalk.green(
        '✅  Rate limiting responded with 429 intercepts without producing server errors.',
      ),
    );
  }
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    spinner.fail('Rate limit load test failed');
    console.error(error);
    process.exit(1);
  });
