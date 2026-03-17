/**
 * Portfolio Service — Aggregate user positions across all Base markets.
 */

import { prisma } from '../database/prismaClient.js';

export interface PortfolioPosition {
  marketId: string;
  question: string;
  outcomes: string[];
  status: string;
  holdings: Array<{
    outcomeIndex: number;
    tokens: string;
    invested: string;
  }>;
}

export interface PortfolioResult {
  address: string;
  positions: PortfolioPosition[];
  totalInvested: string;
}

export async function getPortfolio(address: string): Promise<PortfolioResult> {
  const traderAddress = address.toLowerCase();

  // Get all trades for this address across Base markets
  const trades = await prisma.trade.findMany({
    where: { trader: traderAddress },
    include: {
      market: {
        select: {
          onChainId: true,
          question: true,
          outcomes: true,
          status: true,
          chain: true,
        },
      },
    },
    orderBy: { timestamp: 'asc' },
  });

  // Only Base chain trades
  const baseTrades = trades.filter((t) => t.market.chain === 'base');

  // Group by market, then by outcome
  const marketMap = new Map<
    string,
    {
      question: string;
      outcomes: string[];
      status: string;
      holdings: Map<number, { tokens: bigint; invested: bigint }>;
    }
  >();

  let totalInvested = 0n;

  for (const trade of baseTrades) {
    const marketId = trade.market.onChainId;

    if (!marketMap.has(marketId)) {
      marketMap.set(marketId, {
        question: trade.market.question,
        outcomes: trade.market.outcomes,
        status: trade.market.status,
        holdings: new Map(),
      });
    }

    const market = marketMap.get(marketId)!;
    const holding = market.holdings.get(trade.outcomeIndex) ?? { tokens: 0n, invested: 0n };

    if (trade.tradeType === 'BUY') {
      holding.tokens += trade.outcomeTokens;
      holding.invested += trade.amount;
      totalInvested += trade.amount;
    } else {
      holding.tokens -= trade.outcomeTokens;
      holding.invested -= trade.amount;
    }

    market.holdings.set(trade.outcomeIndex, holding);
  }

  // Convert to output format, filtering out zero positions
  const positions: PortfolioPosition[] = [];
  for (const [marketId, market] of marketMap) {
    const holdings: PortfolioPosition['holdings'] = [];
    for (const [outcomeIndex, holding] of market.holdings) {
      if (holding.tokens > 0n) {
        holdings.push({
          outcomeIndex,
          tokens: holding.tokens.toString(),
          invested: holding.invested.toString(),
        });
      }
    }
    if (holdings.length > 0) {
      positions.push({
        marketId,
        question: market.question,
        outcomes: market.outcomes,
        status: market.status,
        holdings,
      });
    }
  }

  return {
    address: traderAddress,
    positions,
    totalInvested: totalInvested.toString(),
  };
}
