-- AlterTable
ALTER TABLE "Market" ADD COLUMN     "suiMarketObjectId" TEXT,
ADD COLUMN     "suiQueueObjectId" TEXT,
ADD COLUMN     "suiShardObjectIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
