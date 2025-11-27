-- CreateEnum
CREATE TYPE "LeaderboardMetric" AS ENUM ('profit', 'volume');

-- CreateEnum
CREATE TYPE "LeaderboardPeriod" AS ENUM ('daily', 'weekly', 'monthly', 'all_time');

-- CreateTable
CREATE TABLE "LeaderboardEntry" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "displayName" TEXT,
    "metric" "LeaderboardMetric" NOT NULL,
    "period" "LeaderboardPeriod" NOT NULL,
    "chain" "Chain" NOT NULL DEFAULT 'aptos',
    "rank" INTEGER NOT NULL,
    "value" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalProfit" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalVolume" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalBets" INTEGER NOT NULL DEFAULT 0,
    "winRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "badges" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB,
    "snapshotAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaderboardEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeaderboardEntry_metric_period_chain_rank_idx" ON "LeaderboardEntry"("metric", "period", "chain", "rank");

-- CreateIndex
CREATE INDEX "LeaderboardEntry_walletAddress_metric_period_chain_idx" ON "LeaderboardEntry"("walletAddress", "metric", "period", "chain");
