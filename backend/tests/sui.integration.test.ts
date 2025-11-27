import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const SUI_NATIVE_USDC_TEST_COIN =
  '0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC';

describe('Sui payout integration', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.SUI_USDC_COIN_TYPE = SUI_NATIVE_USDC_TEST_COIN;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('calculates payout quotes for Sui markets using backend service', async () => {
    const mockMarket = {
      id: 'mock-sui-market',
      onChainId: '123',
      chain: 'sui' as const,
      question: 'Will the integration test pass?',
      outcomes: ['Yes', 'No'],
      status: 'active' as const,
      outcomePools: [1_500_000n, 2_500_000n],
      totalVolume: 4_000_000n,
      endDate: new Date(Date.now() + 3600_000),
      liquidityParam: 1_000_000n,
      createdAt: new Date(),
      lastSyncedAt: new Date(),
      suiMarketObjectId: '0xmock_market_object',
      suiShardObjectIds: ['0xmock_shard_0', '0xmock_shard_1'],
      suiQueueObjectId: '0xmock_queue',
    };

    const findFirst = vi.fn().mockResolvedValue(mockMarket);
    const findUnique = vi.fn().mockResolvedValue(null);

    vi.doMock('../src/database/prismaClient.js', () => ({
      prisma: {
        market: {
          findFirst,
          findUnique,
        },
      },
    }));

    const { payoutService } = await import('../src/services/payout.service.js');

    const quote = await payoutService.calculatePayout({
      chain: 'sui',
      onChainId: mockMarket.onChainId,
      outcomeIndex: 0,
      amount: 10,
    });

    expect(findFirst).toHaveBeenCalledOnce();
    expect(quote).not.toBeNull();
    expect(quote?.chain).toBe('sui');
    expect(quote?.estimatedPayout).toBeGreaterThan(0);
  });
});
