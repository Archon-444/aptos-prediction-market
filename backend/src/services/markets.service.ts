import { prisma } from '../database/prismaClient.js';
import { payoutService } from './payout.service.js';

const MARKET_STATUSES = ['active', 'resolved', 'disputed', 'cancelled'] as const;
type MarketStatusFilter = (typeof MARKET_STATUSES)[number];

export const marketsService = {
  listMarkets(params: {
    chain?: 'aptos' | 'sui' | 'movement' | 'base';
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    const statusFilter: MarketStatusFilter | undefined = MARKET_STATUSES.includes(
      params.status as MarketStatusFilter
    )
      ? (params.status as MarketStatusFilter)
      : undefined;

    return prisma.market.findMany({
      where: {
        chain: params.chain,
        status: statusFilter,
      },
      take: params.limit ?? 50,
      skip: params.offset ?? 0,
      orderBy: { createdAt: 'desc' },
    });
  },

  async getMarket(params: { chain: 'aptos' | 'sui' | 'movement' | 'base'; onChainId: string }) {
    // Try onChainId first, then fall back to database UUID
    const market = await prisma.market.findFirst({
      where: {
        chain: params.chain,
        onChainId: params.onChainId,
      },
    });
    if (market) return market;

    return prisma.market.findFirst({
      where: {
        chain: params.chain,
        id: params.onChainId,
      },
    });
  },

  async calculatePayout(params: {
    marketId?: string;
    chain?: 'aptos' | 'sui' | 'movement' | 'base';
    onChainId?: string;
    outcomeIndex: number;
    amount: number;
  }) {
    try {
      return await payoutService.calculatePayout(params);
    } catch (error) {
      console.error('[marketsService] calculatePayout error:', error);
      return null;
    }
  },
};
