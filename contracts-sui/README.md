# Sui Prediction Market Smart Contracts

This directory contains the Sui Move smart contracts for the multi-chain prediction market platform.

## Overview

The contracts implement a decentralized prediction market on Sui blockchain with the following features:

- Binary outcome markets (Yes/No)
- SUI token betting
- Automated market maker (AMM) ready structure
- Role-based access control
- Market resolution and payout system
- Admin and resolver capabilities

## Contract Structure

### market_manager.move

Core market logic including:

- **Market Creation**: Create new prediction markets with custom questions and outcomes
- **Betting**: Place bets using SUI tokens
- **Resolution**: Resolve markets with winning outcome
- **Payout**: Claim winnings proportionally based on shares
- **Administration**: Pause/unpause markets

**Key Objects:**

- `Market` (shared) - Stores market state, pools, and metadata
- `Position` (owned) - Represents a user's bet position
- `AdminCap` - Administrative capability
- `ResolverCap` - Market resolution capability

### access_control.move

Role-based permission system:

- **Roles**: Admin, Market Creator, Resolver, Oracle Manager, Pauser
- **Grant/Revoke**: Manage user permissions
- **Permission Checks**: Verify user capabilities

**Key Objects:**

- `AdminCap` - Admin capability for role management
- `RoleRegistry` (shared) - Tracks all user roles

## Building

```bash
# Build contracts
sui move build

# Run tests
sui move test
```

## Deployment

### Quick Deploy (Testnet)

```bash
# From project root
./scripts/deploy-sui.sh testnet
```

### Manual Deploy

```bash
# Build
sui move build

# Publish to testnet
sui client publish --gas-budget 100000000

# Publish to mainnet
sui client publish --gas-budget 100000000
```

## Usage Examples

### Create a Market

```typescript
import { Transaction } from '@mysten/sui/transactions';

const tx = new Transaction();

tx.moveCall({
  target: `${PACKAGE_ID}::market_manager::create_market`,
  arguments: [
    tx.pure.string("Will ETH reach $5000 by end of 2025?"),
    tx.pure.vector('string', ["Yes", "No"]),
    tx.pure.u64(720), // 30 days
    tx.pure.string("CoinGecko API"),
    tx.object(CLOCK_ID),
  ],
});

const result = await client.signAndExecuteTransaction({
  signer: keypair,
  transaction: tx,
});
```

### Place a Bet

```typescript
const tx = new Transaction();

// Split coin for payment
const [coin] = tx.splitCoins(tx.gas, [1000000000]); // 1 SUI

tx.moveCall({
  target: `${PACKAGE_ID}::market_manager::place_bet`,
  arguments: [
    tx.object(MARKET_ID),
    coin,
    tx.pure.u8(1), // Bet on "Yes"
    tx.object(CLOCK_ID),
  ],
});

const result = await client.signAndExecuteTransaction({
  signer: keypair,
  transaction: tx,
});
```

### Resolve Market

```typescript
const tx = new Transaction();

tx.moveCall({
  target: `${PACKAGE_ID}::market_manager::resolve_market`,
  arguments: [
    tx.object(RESOLVER_CAP_ID),
    tx.object(MARKET_ID),
    tx.pure.u8(1), // Winning outcome: "Yes"
    tx.object(CLOCK_ID),
  ],
});

const result = await client.signAndExecuteTransaction({
  signer: keypair,
  transaction: tx,
});
```

### Claim Winnings

```typescript
const tx = new Transaction();

tx.moveCall({
  target: `${PACKAGE_ID}::market_manager::claim_winnings`,
  arguments: [
    tx.object(MARKET_ID),
    tx.object(POSITION_ID),
  ],
});

const result = await client.signAndExecuteTransaction({
  signer: keypair,
  transaction: tx,
});
```

## Object Model

### Market Object

```move
public struct Market has key, store {
    id: UID,
    question: String,
    outcomes: vector<String>,
    end_timestamp: u64,
    yes_pool: Balance<SUI>,
    no_pool: Balance<SUI>,
    total_yes_shares: u64,
    total_no_shares: u64,
    status: u8,              // 0=active, 1=resolved, 2=disputed, 3=cancelled
    resolved_outcome: u8,    // 0=no, 1=yes, 255=unresolved
    creator: address,
    resolution_source: String,
    liquidity_param: u64,
    paused: bool,
}
```

### Position Object

```move
public struct Position has key, store {
    id: UID,
    market_id: ID,
    outcome: u8,           // 0=no, 1=yes
    shares: u64,
    amount_invested: u64,
    owner: address,
}
```

## Events

### MarketCreated

```move
public struct MarketCreated has copy, drop {
    market_id: ID,
    creator: address,
    question: String,
    end_timestamp: u64,
}
```

### BetPlaced

```move
public struct BetPlaced has copy, drop {
    market_id: ID,
    bettor: address,
    outcome: u8,
    amount: u64,
    shares_received: u64,
}
```

### MarketResolved

```move
public struct MarketResolved has copy, drop {
    market_id: ID,
    resolver: address,
    winning_outcome: u8,
    total_volume: u64,
}
```

### WinningsClaimed

```move
public struct WinningsClaimed has copy, drop {
    market_id: ID,
    user: address,
    amount: u64,
}
```

## Error Codes

| Code | Constant | Description |
|------|----------|-------------|
| 1 | `E_MARKET_EXPIRED` | Market has ended, no more bets |
| 2 | `E_MARKET_NOT_EXPIRED` | Market not yet ended, cannot resolve |
| 3 | `E_MARKET_ALREADY_RESOLVED` | Market already resolved |
| 4 | `E_INVALID_OUTCOME` | Invalid outcome value |
| 5 | `E_INSUFFICIENT_BALANCE` | Insufficient bet amount |
| 6 | `E_NO_POSITION` | Position not found |
| 7 | `E_MARKET_PAUSED` | Market is paused |
| 8 | `E_UNAUTHORIZED` | Unauthorized action |
| 9 | `E_INVALID_DURATION` | Invalid market duration |

## Security Considerations

### Capability Pattern

The contracts use Sui's capability pattern for access control:

- `AdminCap` - Required for pausing markets
- `ResolverCap` - Required for resolving markets
- Capabilities cannot be forged or duplicated

### Object Ownership

- `Market` objects are **shared** - multiple users can interact
- `Position` objects are **owned** - only the owner can use them
- This prevents unauthorized access and enables parallel execution

### Validations

All entry functions include comprehensive validation:

- Time checks (market expiry)
- Status checks (not already resolved)
- Amount checks (positive bets)
- Outcome checks (valid values)

### Reentrancy Protection

Sui's object model prevents reentrancy by design:
- No external calls during state modification
- All state changes are atomic

## Gas Costs

Approximate gas costs on testnet:

| Operation | Gas (MIST) | USD (approx) |
|-----------|-----------|--------------|
| Create Market | ~10,000,000 | $0.02 |
| Place Bet | ~5,000,000 | $0.01 |
| Resolve Market | ~10,000,000 | $0.02 |
| Claim Winnings | ~5,000,000 | $0.01 |

## Future Improvements

### LMSR Implementation

The current `calculate_shares()` function uses a simple 1:1 ratio. Implement LMSR (Logarithmic Market Scoring Rule) for:

- Dynamic pricing based on pool ratios
- Liquidity provision
- Market maker functionality

Example LMSR formula:

```move
fun calculate_shares_lmsr(
    yes_pool: u64,
    no_pool: u64,
    liquidity_param: u64,
    amount: u64,
    outcome: u8
): u64 {
    // C(q) = b * ln(e^(q_yes/b) + e^(q_no/b))
    // where b = liquidity_param
    // Implement using fixed-point math
}
```

### Multi-Outcome Markets

Extend beyond binary markets:

```move
public struct Market has key, store {
    outcomes: vector<String>,     // Variable length
    outcome_pools: vector<Balance<SUI>>,
    outcome_shares: vector<u64>,
    // ...
}
```

### Oracle Integration

Add oracle data source integration:

```move
module prediction_market::oracle {
    public fun verify_outcome(
        source: String,
        market_id: ID,
        outcome: u8
    ): bool {
        // Verify outcome from external oracle
    }
}
```

## Testing

Run the test suite:

```bash
sui move test
```

Add custom tests in `tests/` directory.

## Resources

- [Sui Documentation](https://docs.sui.io/)
- [Move Book](https://move-book.com/)
- [Sui TypeScript SDK](https://sdk.mystenlabs.com/typescript)
- [Sui Explorer](https://suiexplorer.com/)

## Support

For issues or questions:
- Check [SUI_INTEGRATION_COMPLETE.md](../SUI_INTEGRATION_COMPLETE.md)
- Review [Troubleshooting Guide](../SUI_INTEGRATION_COMPLETE.md#troubleshooting)
- Contact development team

## License

See [LICENSE](../LICENSE)
