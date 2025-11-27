import { prisma } from '../database/prismaClient.js';

export const suiMarketLookupService = {
  async getSuiMarketObjects(marketId: number): Promise<{
    marketObjectId: string;
    shardObjectIds: string[];
    queueObjectId: string | null;
  } | null> {
    const market = await prisma.market.findFirst({
      where: { onChainId: marketId.toString(), chain: 'sui' },
      select: {
        suiMarketObjectId: true,
        suiShardObjectIds: true,
        suiQueueObjectId: true,
      },
    });
    if (!market || !market.suiMarketObjectId) return null;
    return {
      marketObjectId: market.suiMarketObjectId,
      shardObjectIds: market.suiShardObjectIds,
      queueObjectId: market.suiQueueObjectId,
    };
  },
  async storeSuiMarketObjects(
    marketId: number,
    objects: {
      marketObjectId: string;
      shardObjectIds: string[];
      queueObjectId: string;
    }
  ): Promise<void> {
    await prisma.market.update({
      where: {
        onChainId_chain: { onChainId: marketId.toString(), chain: 'sui' },
      },
      data: {
        suiMarketObjectId: objects.marketObjectId,
        suiShardObjectIds: objects.shardObjectIds,
        suiQueueObjectId: objects.queueObjectId,
      },
    });
  },
};
