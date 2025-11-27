/**
 * Shared Object Contention Load Test
 *
 * Tests market performance under high concurrent load
 * CRITICAL: Must achieve <2s P99 latency with 1000 concurrent users
 *
 * Success Criteria:
 * - P50 latency < 1000ms
 * - P99 latency < 2000ms
 * - 0% failed transactions
 * - No shard has >10x more contention than others
 */

import { SuiClient, SuiTransactionBlockResponse } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import chalk from 'chalk';
import cliProgress from 'cli-progress';

// Configuration
const CONFIG = {
  RPC_URL: process.env.SUI_RPC_URL || 'https://fullnode.testnet.sui.io:443',
  PACKAGE_ID: process.env.SUI_PACKAGE_ID || '',
  MARKET_ID: process.env.TEST_MARKET_ID || '',
  CONCURRENT_USERS: parseInt(process.env.CONCURRENT_USERS || '1000'),
  NUM_SHARDS: parseInt(process.env.NUM_SHARDS || '16'),
  BET_AMOUNT: 1_000_000, // 1 USDC (6 decimals)
};

// Test results
interface TestResult {
  userId: number;
  shard: number;
  success: boolean;
  latency: number;
  error?: string;
  txDigest?: string;
}

interface Stats {
  total: number;
  successful: number;
  failed: number;
  latencies: number[];
  shardDistribution: Map<number, number>;
  avgLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  totalDuration: number;
}

// Helper: Calculate user's assigned shard
function calculateUserShard(userId: number, numShards: number): number {
  // Simple hash: user_id % num_shards
  return userId % numShards;
}

// Helper: Create test keypair
function createTestKeypair(userId: number): Ed25519Keypair {
  // Deterministic keypair for testing (DO NOT use in production!)
  const seed = new Uint8Array(32);
  seed.fill(userId & 0xFF);
  return Ed25519Keypair.fromSecretKey(seed);
}

// Place a bet on the market
async function placeBet(
  client: SuiClient,
  userId: number,
  marketId: string,
  shardId: string,
  outcome: number
): Promise<TestResult> {
  const startTime = Date.now();
  const keypair = createTestKeypair(userId);
  const shard = calculateUserShard(userId, CONFIG.NUM_SHARDS);

  try {
    const tx = new Transaction();

    // Split coin for payment
    const [coin] = tx.splitCoins(tx.gas, [CONFIG.BET_AMOUNT]);

    // Call place_bet
    tx.moveCall({
      target: `${CONFIG.PACKAGE_ID}::market_manager_v2::place_bet`,
      arguments: [
        tx.object(marketId),
        tx.object(shardId),
        coin,
        tx.pure.u8(outcome),
        tx.object('0x6'), // Clock object
      ],
    });

    // Execute transaction
    const result = await client.signAndExecuteTransaction({
      signer: keypair,
      transaction: tx,
      options: {
        showEffects: true,
      },
    });

    const latency = Date.now() - startTime;

    return {
      userId,
      shard,
      success: result.effects?.status?.status === 'success',
      latency,
      txDigest: result.digest,
    };
  } catch (error) {
    const latency = Date.now() - startTime;

    return {
      userId,
      shard,
      success: false,
      latency,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Calculate statistics from results
function calculateStats(results: TestResult[]): Stats {
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  const latencies = successful.map(r => r.latency).sort((a, b) => a - b);

  const shardDistribution = new Map<number, number>();
  for (const result of results) {
    const count = shardDistribution.get(result.shard) || 0;
    shardDistribution.set(result.shard, count + 1);
  }

  const calculatePercentile = (arr: number[], percentile: number): number => {
    if (arr.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * arr.length) - 1;
    return arr[Math.max(0, index)];
  };

  return {
    total: results.length,
    successful: successful.length,
    failed: failed.length,
    latencies,
    shardDistribution,
    avgLatency: latencies.reduce((a, b) => a + b, 0) / latencies.length || 0,
    p50Latency: calculatePercentile(latencies, 50),
    p95Latency: calculatePercentile(latencies, 95),
    p99Latency: calculatePercentile(latencies, 99),
    totalDuration: Math.max(...results.map(r => r.latency)),
  };
}

// Print results
function printResults(stats: Stats, passed: boolean) {
  console.log('\n' + chalk.bold('═══════════════════════════════════════════════'));
  console.log(chalk.bold('  Shared Object Contention Test Results'));
  console.log(chalk.bold('═══════════════════════════════════════════════\n'));

  console.log(chalk.bold('Overall Results:'));
  console.log(`  Total transactions:  ${stats.total}`);
  console.log(`  Successful:          ${chalk.green(stats.successful)} (${((stats.successful / stats.total) * 100).toFixed(2)}%)`);
  console.log(`  Failed:              ${stats.failed > 0 ? chalk.red(stats.failed) : chalk.green(stats.failed)} (${((stats.failed / stats.total) * 100).toFixed(2)}%)`);
  console.log(`  Total duration:      ${stats.totalDuration}ms\n`);

  console.log(chalk.bold('Latency Statistics:'));
  console.log(`  Average:             ${stats.avgLatency.toFixed(0)}ms`);
  console.log(`  P50 (median):        ${stats.p50Latency}ms ${stats.p50Latency < 1000 ? chalk.green('✓') : chalk.red('✗')}`);
  console.log(`  P95:                 ${stats.p95Latency}ms`);
  console.log(`  P99:                 ${stats.p99Latency}ms ${stats.p99Latency < 2000 ? chalk.green('✓') : chalk.red('✗')}\n`);

  console.log(chalk.bold('Shard Distribution:'));
  const shardCounts = Array.from(stats.shardDistribution.entries()).sort((a, b) => a[0] - b[0]);
  const maxCount = Math.max(...shardCounts.map(([_, count]) => count));
  const minCount = Math.min(...shardCounts.map(([_, count]) => count));
  const imbalanceRatio = maxCount / minCount;

  for (const [shard, count] of shardCounts) {
    const bar = '█'.repeat(Math.floor((count / maxCount) * 40));
    console.log(`  Shard ${shard.toString().padStart(2)}:  ${bar} ${count}`);
  }
  console.log(`  Imbalance ratio:     ${imbalanceRatio.toFixed(2)}x ${imbalanceRatio < 10 ? chalk.green('✓') : chalk.red('✗')}\n`);

  console.log(chalk.bold('Success Criteria:'));
  const criteria = [
    { name: 'P50 latency < 1000ms', passed: stats.p50Latency < 1000 },
    { name: 'P99 latency < 2000ms', passed: stats.p99Latency < 2000 },
    { name: '0% failed transactions', passed: stats.failed === 0 },
    { name: 'Shard imbalance < 10x', passed: imbalanceRatio < 10 },
  ];

  for (const criterion of criteria) {
    const icon = criterion.passed ? chalk.green('✓') : chalk.red('✗');
    console.log(`  ${icon} ${criterion.name}`);
  }

  console.log('\n' + chalk.bold('═══════════════════════════════════════════════'));

  if (passed) {
    console.log(chalk.green.bold('\n✓ TEST PASSED - System meets performance requirements\n'));
  } else {
    console.log(chalk.red.bold('\n✗ TEST FAILED - System does not meet performance requirements\n'));
    console.log(chalk.yellow('Recommendations:'));
    if (stats.p99Latency >= 2000) {
      console.log(chalk.yellow('  • Increase number of shards (current: ' + CONFIG.NUM_SHARDS + ')'));
      console.log(chalk.yellow('  • Consider vertical scaling of RPC nodes'));
    }
    if (stats.failed > 0) {
      console.log(chalk.yellow('  • Investigate transaction failures'));
      console.log(chalk.yellow('  • Check gas budget and account balances'));
    }
    if (imbalanceRatio >= 10) {
      console.log(chalk.yellow('  • Review shard assignment algorithm'));
      console.log(chalk.yellow('  • Ensure even distribution of user addresses'));
    }
    console.log('');
  }
}

// Main test function
async function runContentionTest() {
  console.log(chalk.cyan.bold('\n╔═══════════════════════════════════════════════╗'));
  console.log(chalk.cyan.bold('║   Sui Shared Object Contention Load Test     ║'));
  console.log(chalk.cyan.bold('╚═══════════════════════════════════════════════╝\n'));

  // Validate configuration
  if (!CONFIG.PACKAGE_ID) {
    console.error(chalk.red('Error: SUI_PACKAGE_ID environment variable not set'));
    process.exit(1);
  }

  if (!CONFIG.MARKET_ID) {
    console.error(chalk.red('Error: TEST_MARKET_ID environment variable not set'));
    console.error(chalk.yellow('Hint: Create a test market first and set TEST_MARKET_ID'));
    process.exit(1);
  }

  console.log(chalk.bold('Configuration:'));
  console.log(`  RPC URL:            ${CONFIG.RPC_URL}`);
  console.log(`  Package ID:         ${CONFIG.PACKAGE_ID.slice(0, 20)}...`);
  console.log(`  Market ID:          ${CONFIG.MARKET_ID.slice(0, 20)}...`);
  console.log(`  Concurrent users:   ${CONFIG.CONCURRENT_USERS}`);
  console.log(`  Number of shards:   ${CONFIG.NUM_SHARDS}`);
  console.log(`  Bet amount:         ${CONFIG.BET_AMOUNT / 1_000_000} USDC\n`);

  const client = new SuiClient({ url: CONFIG.RPC_URL });

  console.log(chalk.bold('Starting load test...\n'));

  // Progress bar
  const progressBar = new cliProgress.SingleBar({
    format: 'Progress |' + chalk.cyan('{bar}') + '| {percentage}% || {value}/{total} Users',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
  });

  progressBar.start(CONFIG.CONCURRENT_USERS, 0);

  // Create all bet promises
  const promises: Promise<TestResult>[] = [];
  const results: TestResult[] = [];

  for (let i = 0; i < CONFIG.CONCURRENT_USERS; i++) {
    const shard = calculateUserShard(i, CONFIG.NUM_SHARDS);
    const shardId = `shard_${shard}_object_id`; // Replace with actual shard object ID

    const promise = placeBet(
      client,
      i,
      CONFIG.MARKET_ID,
      shardId,
      i % 2 // Alternate between yes/no
    ).then(result => {
      progressBar.increment();
      return result;
    });

    promises.push(promise);
  }

  // Execute all bets concurrently
  const testStartTime = Date.now();
  const settled = await Promise.allSettled(promises);
  const testDuration = Date.now() - testStartTime;

  progressBar.stop();

  // Collect results
  for (const result of settled) {
    if (result.status === 'fulfilled') {
      results.push(result.value);
    } else {
      // Treat promise rejection as failed test
      results.push({
        userId: -1,
        shard: -1,
        success: false,
        latency: testDuration,
        error: result.reason?.message || 'Promise rejected',
      });
    }
  }

  // Calculate and print statistics
  const stats = calculateStats(results);

  // Check if test passed
  const passed = (
    stats.p50Latency < 1000 &&
    stats.p99Latency < 2000 &&
    stats.failed === 0 &&
    (Math.max(...Array.from(stats.shardDistribution.values())) /
     Math.min(...Array.from(stats.shardDistribution.values()))) < 10
  );

  printResults(stats, passed);

  // Exit with appropriate code
  process.exit(passed ? 0 : 1);
}

// Run test
runContentionTest().catch(error => {
  console.error(chalk.red('\nFatal error:'), error);
  process.exit(1);
});
