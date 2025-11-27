/*
  Warnings:

  - You are about to drop the column `noPool` on the `Market` table. All the data in the column will be lost.
  - You are about to drop the column `yesPool` on the `Market` table. All the data in the column will be lost.
  - The `status` column on the `Market` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `resolvedOutcome` column on the `Market` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "MarketStatus" AS ENUM ('active', 'resolved', 'disputed', 'cancelled');

-- AlterTable
ALTER TABLE "Market" DROP COLUMN "noPool",
DROP COLUMN "yesPool",
ADD COLUMN     "lastSyncedAt" TIMESTAMP(3),
ADD COLUMN     "liquidityParam" BIGINT,
ADD COLUMN     "outcomePools" BIGINT[],
ADD COLUMN     "outcomes" TEXT[],
ADD COLUMN     "transactionHash" TEXT,
DROP COLUMN "status",
ADD COLUMN     "status" "MarketStatus" NOT NULL DEFAULT 'active',
DROP COLUMN "resolvedOutcome",
ADD COLUMN     "resolvedOutcome" INTEGER;

-- CreateTable
CREATE TABLE "BlockchainEvent" (
    "id" TEXT NOT NULL,
    "chain" "Chain" NOT NULL,
    "eventType" TEXT NOT NULL,
    "marketId" TEXT,
    "transactionHash" TEXT NOT NULL,
    "sequenceNumber" BIGINT NOT NULL,
    "eventData" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "blockHeight" BIGINT,
    "timestamp" TIMESTAMP(3),

    CONSTRAINT "BlockchainEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndexerState" (
    "id" TEXT NOT NULL,
    "chain" "Chain" NOT NULL,
    "lastProcessedVersion" BIGINT NOT NULL DEFAULT 0,
    "lastProcessedTimestamp" TIMESTAMP(3),
    "isRunning" BOOLEAN NOT NULL DEFAULT false,
    "lastError" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndexerState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BlockchainEvent_chain_sequenceNumber_idx" ON "BlockchainEvent"("chain", "sequenceNumber");

-- CreateIndex
CREATE INDEX "BlockchainEvent_eventType_idx" ON "BlockchainEvent"("eventType");

-- CreateIndex
CREATE INDEX "BlockchainEvent_marketId_idx" ON "BlockchainEvent"("marketId");

-- CreateIndex
CREATE UNIQUE INDEX "BlockchainEvent_chain_transactionHash_sequenceNumber_key" ON "BlockchainEvent"("chain", "transactionHash", "sequenceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "IndexerState_chain_key" ON "IndexerState"("chain");

-- CreateIndex
CREATE INDEX "IndexerState_chain_idx" ON "IndexerState"("chain");

-- CreateIndex
CREATE INDEX "Market_status_idx" ON "Market"("status");

-- CreateIndex
CREATE INDEX "Market_chain_idx" ON "Market"("chain");

-- AddForeignKey
ALTER TABLE "BlockchainEvent" ADD CONSTRAINT "BlockchainEvent_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE SET NULL ON UPDATE CASCADE;
