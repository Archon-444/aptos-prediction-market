# Move Market SDK

A comprehensive TypeScript SDK for interacting with the Move Market smart contracts.

## Installation

```bash
npm install @aptos-prediction-market/sdk
# or
yarn add @aptos-prediction-market/sdk
```

## Quick Start

```typescript
import { PredictionMarketClient, Role } from "@aptos-prediction-market/sdk";
import { Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";

// Initialize the client
const client = new PredictionMarketClient({
  network: "devnet",
  moduleAddress: "0x...", // Your deployed contract address
});

// Create an account (or use existing)
const privateKey = new Ed25519PrivateKey("0x...");
const account = Account.fromPrivateKey({ privateKey });

// Create a market
const txHash = await client.createMarket(
  account,
  "Will Bitcoin reach $100k by end of 2025?",
  ["Yes", "No"],
  720 // 30 days in hours
);

console.log(`Market created: ${txHash}`);
```

## Core Features

### Market Management

```typescript
// Get market count
const count = await client.getMarketCount();

// Get market details
const market = await client.getMarket(0);
console.log(market.question);
console.log(market.outcomes);

// Check if market is active
const isActive = await client.isMarketActive(0);

// Resolve a market (resolver role required)
await client.resolveMarket(resolverAccount, 0, 1); // Outcome 1 wins
```

### Betting

```typescript
import { toMicroUSDC, formatUSDC } from "@aptos-prediction-market/sdk";

// Place a bet
const betAmount = toMicroUSDC(100); // 100 USDC
await client.placeBet(userAccount, 0, 1, betAmount);

// Get current odds
const odds = await client.getOdds(0);
console.log(`Outcome 0: ${odds[0] / 100}%`);
console.log(`Outcome 1: ${odds[1] / 100}%`);

// Calculate potential payout
const payout = await client.calculatePayout(0, 1, betAmount);
console.log(`Potential payout: ${formatUSDC(payout)} USDC`);

// Get user position
const position = await client.getUserPosition(userAccount.accountAddress.toString(), 0);
console.log(`Staked: ${formatUSDC(position.stake)} USDC`);

// Claim winnings
await client.claimWinnings(userAccount, 0);
```

### Access Control (RBAC)

```typescript
// Check roles
const isAdmin = await client.isAdmin(userAddress);
const hasResolverRole = await client.hasRole(userAddress, Role.RESOLVER);

// Grant role (admin only)
await client.grantRole(adminAccount, userAddress, Role.MARKET_CREATOR);

// Revoke role (admin only)
await client.revokeRole(adminAccount, userAddress, Role.MARKET_CREATOR);
```

### Pause Mechanism

```typescript
// Check if system is paused
const isPaused = await client.isPaused();

// Pause system (pauser role required)
await client.pause(pauserAccount);

// Unpause system (admin role required)
await client.unpause(adminAccount);
```

### Oracle Integration

```typescript
// Set oracle for a market
await client.setOracle(
  oracleManagerAccount,
  0, // market ID
  "0x...", // oracle address
  80 // minimum confidence score (80%)
);

// Get oracle config
const oracleConfig = await client.getOracleConfig(0);
console.log(`Oracle: ${oracleConfig.oracleAddress}`);
console.log(`Min confidence: ${oracleConfig.minConfidenceScore}%`);
```

### Dispute Resolution

```typescript
// Create a dispute
await client.createDispute(
  disputerAccount,
  0, // market ID
  0, // proposed outcome
  "Incorrect resolution based on..."
);

// Vote on dispute
await client.voteOnDispute(voterAccount, 0, true); // true = support, false = oppose

// Get dispute info
const dispute = await client.getDispute(0);
console.log(`Votes for: ${dispute.votesFor}`);
console.log(`Votes against: ${dispute.votesAgainst}`);
```

## Utility Functions

```typescript
import {
  toMicroUSDC,
  fromMicroUSDC,
  formatUSDC,
  hoursUntil,
  isMarketExpired,
  formatProbability,
  calculateProfit,
  isValidQuestion,
  areValidOutcomes,
  isValidBetAmount,
  getExplorerUrl,
  retryWithBackoff,
} from "@aptos-prediction-market/sdk";

// USDC conversions
const microAmount = toMicroUSDC(100.5); // Convert 100.5 USDC to micro-USDC
const amount = fromMicroUSDC(100500000n); // Convert back to USDC
const formatted = formatUSDC(100500000n); // "100.50"

// Time utilities
const hours = hoursUntil(market.endTime);
const expired = isMarketExpired(market.endTime);

// Probability formatting
const prob = formatProbability(6500); // "65.0%"

// Profit calculation
const profit = calculateProfit(betAmount, payout);

// Validation
const validQuestion = isValidQuestion("Will X happen?");
const validOutcomes = areValidOutcomes(["Yes", "No"]);
const validBet = isValidBetAmount(toMicroUSDC(1));

// Explorer link
const txUrl = getExplorerUrl("devnet", txHash);

// Retry with backoff
const result = await retryWithBackoff(async () => {
  return await client.getMarket(0);
}, 3, 1000);
```

## Roles

The SDK supports the following roles:

- **ADMIN (0)**: Full system control
- **MARKET_CREATOR (1)**: Can create markets
- **RESOLVER (2)**: Can resolve markets
- **ORACLE_MANAGER (3)**: Can manage oracles
- **PAUSER (4)**: Can pause/unpause system

## Error Handling

```typescript
import { parseTransactionError } from "@aptos-prediction-market/sdk";

try {
  await client.placeBet(account, 0, 1, amount);
} catch (error) {
  const errorMessage = parseTransactionError(error);
  console.error(`Transaction failed: ${errorMessage}`);
}
```

## TypeScript Types

```typescript
interface Market {
  id: number;
  question: string;
  outcomes: string[];
  endTime: number;
  resolved: boolean;
  winningOutcome?: number;
  totalStake: bigint;
  outcomeStakes: bigint[];
  creator: string;
}

interface UserPosition {
  marketId: number;
  outcome: number;
  stake: bigint;
  claimed: boolean;
}

interface OracleConfig {
  oracleAddress: string;
  minConfidenceScore: number;
  enabled: boolean;
}

interface DisputeInfo {
  marketId: number;
  proposedOutcome: number;
  currentOutcome: number;
  votesFor: bigint;
  votesAgainst: bigint;
  status: DisputeStatus;
  deadline: number;
}
```

## Development

```bash
# Install dependencies
npm install

# Build the SDK
npm run build

# Run tests
npm test

# Lint
npm run lint
```

## License

MIT

## Support

For issues and questions, please visit:
- GitHub Issues: [link]
- Documentation: [link]
- Discord: [link]
