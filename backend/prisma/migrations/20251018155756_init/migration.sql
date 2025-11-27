-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('pending', 'approved', 'rejected', 'published');

-- CreateEnum
CREATE TYPE "SuggestionEventType" AS ENUM ('submitted', 'approved', 'rejected', 'published', 'vote');

-- CreateEnum
CREATE TYPE "Chain" AS ENUM ('aptos', 'sui', 'movement');

-- CreateEnum
CREATE TYPE "RoleAction" AS ENUM ('grant', 'revoke');

-- CreateTable
CREATE TABLE "Suggestion" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "category" TEXT,
    "outcomes" TEXT[],
    "durationHours" INTEGER NOT NULL,
    "resolutionSource" TEXT,
    "proposer" TEXT NOT NULL,
    "reviewer" TEXT,
    "reviewReason" TEXT,
    "status" "SuggestionStatus" NOT NULL DEFAULT 'pending',
    "chain" "Chain" NOT NULL DEFAULT 'aptos',
    "upvotes" INTEGER NOT NULL DEFAULT 0,
    "publishedMarketId" TEXT,
    "publishedBy" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "Suggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuggestionEvent" (
    "id" TEXT NOT NULL,
    "suggestionId" TEXT NOT NULL,
    "eventType" "SuggestionEventType" NOT NULL,
    "actorWallet" TEXT NOT NULL,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuggestionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "walletAddress" TEXT NOT NULL,
    "roles" TEXT[],
    "onChainRolesSynced" BOOLEAN NOT NULL DEFAULT false,
    "lastRoleSync" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("walletAddress")
);

-- CreateTable
CREATE TABLE "RoleChange" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "action" "RoleAction" NOT NULL,
    "grantedBy" TEXT NOT NULL,
    "transactionHash" TEXT,
    "chain" "Chain",
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoleChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Market" (
    "id" TEXT NOT NULL,
    "onChainId" TEXT NOT NULL,
    "chain" "Chain" NOT NULL,
    "question" TEXT NOT NULL,
    "category" TEXT,
    "creatorWallet" TEXT,
    "endDate" TIMESTAMP(3),
    "status" TEXT,
    "totalVolume" BIGINT NOT NULL DEFAULT 0,
    "yesPool" BIGINT NOT NULL DEFAULT 0,
    "noPool" BIGINT NOT NULL DEFAULT 0,
    "resolvedOutcome" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Market_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SuggestionEvent_suggestionId_idx" ON "SuggestionEvent"("suggestionId");

-- CreateIndex
CREATE INDEX "SuggestionEvent_timestamp_idx" ON "SuggestionEvent"("timestamp");

-- CreateIndex
CREATE INDEX "RoleChange_walletAddress_idx" ON "RoleChange"("walletAddress");

-- CreateIndex
CREATE INDEX "RoleChange_timestamp_idx" ON "RoleChange"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "Market_onChainId_chain_key" ON "Market"("onChainId", "chain");

-- AddForeignKey
ALTER TABLE "SuggestionEvent" ADD CONSTRAINT "SuggestionEvent_suggestionId_fkey" FOREIGN KEY ("suggestionId") REFERENCES "Suggestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoleChange" ADD CONSTRAINT "RoleChange_walletAddress_fkey" FOREIGN KEY ("walletAddress") REFERENCES "User"("walletAddress") ON DELETE RESTRICT ON UPDATE CASCADE;
