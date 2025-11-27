#!/usr/bin/env ts-node
/**
 * Seed script to populate leaderboard entries with sample data.
 * Run: npx ts-node scripts/seedLeaderboard.ts
 */
import { PrismaClient, LeaderboardMetric, LeaderboardPeriod, Chain } from '@prisma/client';

const prisma = new PrismaClient();

const sampleWallets = [
  { address: '0xleader1', displayName: 'AlphaOracle' },
  { address: '0xleader2', displayName: 'ChainWhale' },
  { address: '0xleader3', displayName: 'SuiSeer' },
  { address: '0xleader4', displayName: 'AptosAce' },
  { address: '0xleader5', displayName: 'PredictionPro' },
];

const metrics: LeaderboardMetric[] = ['profit', 'volume'];
const periods: LeaderboardPeriod[] = ['daily', 'weekly', 'monthly', 'all_time'];
const chains: (Chain | 'both')[] = ['aptos', 'sui', 'movement'];

async function main() {
  console.log('Clearing existing leaderboard entries...');
  await prisma.leaderboardEntry.deleteMany();

  const entries = [];

  for (const metric of metrics) {
    for (const period of periods) {
      sampleWallets.forEach((wallet, index) => {
        const rank = index + 1;
        const totalProfit = metric === 'profit' ? BigInt((5000 - rank * 500) * 100) : BigInt(0);
        const totalVolume = metric === 'volume' ? BigInt((100000 - rank * 10000) * 100) : BigInt(0);
        const value = metric === 'profit' ? totalProfit : totalVolume;
        const chain = chains[index % chains.length];

        entries.push({
          walletAddress: wallet.address,
          displayName: wallet.displayName,
          metric,
          period,
          chain: chain === 'both' ? 'aptos' : chain,
          rank,
          value: Number(value) / 100,
          totalProfit: Number(totalProfit) / 100,
          totalVolume: Number(totalVolume) / 100,
          totalBets: 10 + rank * 5,
          winRate: 55 + rank * 3,
          badges: rank === 1 ? ['top-performer'] : [],
        });
      });
    }
  }

  console.log(`Seeding ${entries.length} leaderboard records...`);

  for (const entry of entries) {
    await prisma.leaderboardEntry.create({
      data: {
        walletAddress: entry.walletAddress,
        displayName: entry.displayName,
        metric: entry.metric as LeaderboardMetric,
        period: entry.period as LeaderboardPeriod,
        chain: entry.chain as Chain,
        rank: entry.rank,
        value: entry.value,
        totalProfit: entry.totalProfit,
        totalVolume: entry.totalVolume,
        totalBets: entry.totalBets,
        winRate: entry.winRate,
        badges: entry.badges,
      },
    });
  }

  console.log('Leaderboard seed complete.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
