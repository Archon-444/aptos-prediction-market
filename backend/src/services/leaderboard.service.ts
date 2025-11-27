import type { Chain, LeaderboardMetric, LeaderboardPeriod } from '@prisma/client';

import { prisma } from '../database/prismaClient.js';

interface LeaderboardQuery {
  metric: LeaderboardMetric;
  period: LeaderboardPeriod;
  chain?: Chain | 'all';
  limit?: number;
  offset?: number;
}

export const leaderboardService = {
  async getLeaderboard(query: LeaderboardQuery) {
    const { metric, period, chain, limit = 100, offset = 0 } = query;

    return prisma.leaderboardEntry.findMany({
      where: {
        metric,
        period,
        ...(chain && chain !== 'all' ? { chain } : {}),
      },
      orderBy: [{ rank: 'asc' }],
      take: limit,
      skip: offset,
    });
  },

  async getUserSummary(walletAddress: string) {
    const entries = await prisma.leaderboardEntry.findMany({
      where: { walletAddress },
      orderBy: [{ snapshotAt: 'desc' }],
    });

    if (entries.length === 0) {
      return null;
    }

    const grouped = entries.reduce<Record<string, typeof entries>>((acc, entry) => {
      const key = `${entry.metric}-${entry.period}-${entry.chain}`;
      acc[key] = acc[key] || [];
      acc[key].push(entry);
      return acc;
    }, {});

    return {
      walletAddress,
      stats: entries,
      latestByMetric: grouped,
    };
  },
};
