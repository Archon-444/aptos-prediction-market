# Oracle Cache Schema

This document keeps the Move storage layout, SDK types, and frontend expectations aligned for the refreshed oracle pipeline that caches Pyth prices and falls back to optimistic consensus when needed.

## 1. On-Chain Storage

### 1.1 `pyth_reader` module

```move
public struct FeedConfig has store, drop {
    feed_id: vector<u8>,             // 32-byte identifier
    staleness_threshold_secs: u64,   // Maximum accepted age for a snapshot
}

public struct PriceSnapshot has store, drop {
    price: u128,                     // Absolute value of the last price
    price_negative: bool,            // True if original price was negative
    confidence: u64,                 // Confidence interval magnitude
    expo: u64,                       // Exponent magnitude from Pyth
    expo_negative: bool,             // True if exponent is negative
    publish_time: u64,               // Pyth publish timestamp (seconds)
    received_at: u64,                // On-chain write timestamp
    vaa_hash: vector<u8>,            // 32-byte hash to prevent replays
}

struct GlobalConfig has key {
    admin: address,
    pyth_contract: address,
    price_service: address,
    relayers: Table<address, bool>,
    feeds: Table<u64, FeedConfig>,           // market_id -> feed config
    price_snapshots: Table<u64, PriceSnapshot>,
    update_events: EventHandle<PriceUpdateEvent>,
}

struct PriceUpdateEvent has drop, store {
    market_id: u64,
    feed_id: vector<u8>,
    price: u128,
    price_negative: bool,
    confidence: u64,
    expo: u64,
    expo_negative: bool,
    publish_time: u64,
    received_at: u64,
    vaa_hash: vector<u8>,
    resolution_hint: option::Option<u8>,
}
```

### 1.2 `oracle` module additions

```move
struct MarketOracle has store, drop {
    // ...existing fields...
    resolution_strategy: u8,                 // Configuration constant
    pyth_threshold: u128,                    // Threshold magnitude
    pyth_threshold_negative: bool,           // Threshold sign
    pyth_threshold_exponent: u64,            // Exponent magnitude
    pyth_threshold_exponent_negative: bool,  // Exponent sign
    pyth_outcome_above: u8,
    pyth_outcome_below: u8,
    pyth_configured: bool,
}
```

`resolution_strategy` uses the constants:

```move
const RESOLUTION_STRATEGY_PYTH_ONLY: u8 = 0;
const RESOLUTION_STRATEGY_PYTH_WITH_OPTIMISTIC: u8 = 1;
const RESOLUTION_STRATEGY_OPTIMISTIC_ONLY: u8 = 2;
```

The helper `signed_ge` inside `oracle` performs comparisons between `(magnitude, sign)` pairs to decide whether the cached Pyth price crosses the configured threshold.

#### Invariants

- `price_snapshots` are only written by authorized relayers.
- `publish_time` must be non-decreasing per market and fresh relative to both `PYTH_MAX_AGE_SECONDS` and the feed’s `staleness_threshold_secs`.
- A Pyth resolution requires snapshot exponent/sign to match the stored threshold exponent/sign.
- After a market resolves, `(resolved, resolution_value, resolution_source)` remain immutable.

## 2. Events & Views

- `pyth_reader::PriceUpdateEvent` exposes the full snapshot payload for off-chain monitoring.
- `oracle::get_resolution_source`, `oracle::get_resolution_strategy`, and `oracle::get_oracle_resolution` provide the inputs displayed in the UI.
- `oracle::get_pyth_price` returns:

```
(has_snapshot: bool,
 price: u128,
 price_negative: bool,
 confidence: u64,
 expo: u64,
 expo_negative: bool,
 publish_time: u64,
 received_at: u64)
```

Consumers should treat these numeric values as big integers (strings/bigints) to avoid precision loss.

## 3. SDK Contract

```ts
export enum ResolutionSource {
  MANUAL = 0,
  PYTH = 1,
  CUSTOM = 2,
}

export enum ResolutionStrategy {
  PYTH_ONLY = 0,
  PYTH_WITH_OPTIMISTIC_FALLBACK = 1,
  OPTIMISTIC_ONLY = 2,
}

export interface ResolutionInfo {
  resolved: boolean;
  winningOutcome: number;
  source: ResolutionSource;
  strategy: ResolutionStrategy;
}

export interface PythPrice {
  hasSnapshot: boolean;
  price: bigint;
  priceNegative: boolean;
  confidence: bigint;
  expo: number;
  expoNegative: boolean;
  publishTime: number;
  receivedAt: number;
}
```

`getPythPrice` returns zeroed defaults when no snapshot is cached yet.

## 4. Frontend Responsibilities

- Display both the resolution source (Pyth vs. Optimistic) and the configured `resolution_strategy` so operators can confirm fallbacks.
- Convert `(price, expo, priceNegative)` into human-readable decimals; warn if `hasSnapshot` is false or the price is stale relative to the feed threshold.
- Show confidence intervals and publish timestamps for transparency.
- Handle very large numbers using `BigInt` or string arithmetic.

## 5. Relayer Expectations

- Authorized relayers fetch and verify VAAs off-chain, then call `pyth_reader::submit_price_update`.
- Inputs must:
  - Use consistent magnitude/sign pairs for price and exponent.
  - Respect per-market staleness thresholds.
  - Provide unique 32-byte hashes to prevent replay.
- Relayers should abstain from submitting data when the feed is stale; the optimistic path will cover those cases.

## 6. Implementation Notes

1. `pyth_reader` caches the latest snapshot and surfaces friend-only borrows for the oracle module to avoid redundant storage.
2. `oracle::try_pyth_resolution` now defers to `pyth_reader` for freshness checks and threshold comparisons using `signed_ge`.
3. `set_resolution_strategy`, `configure_pyth_feed`, and `clear_pyth_feed` give admins explicit control over market configuration.
4. SDK clients and UI components updated to consume the richer tuple and strategy metadata, keeping the product in sync with on-chain changes.

### Relayer Script

- A helper script lives at `scripts/pyth-relayer.js`. It fetches the latest Hermés price + VAA and calls `oracle::submit_pyth_price`.
- Required environment variables:
  - `APTOS_NETWORK` (e.g. `testnet`)
  - `APTOS_NODE_URL` (optional custom RPC)
  - `RELAYER_PRIVATE_KEY` (hex)
  - `MODULE_ADDRESS` (e.g. `0xcafe`)
  - `MARKET_ID`
  - `PYTH_FEED_ID`
  - Optional: `RESOLUTION_HINT`
- Run with `node scripts/pyth-relayer.js`; the script hashes the VAA for replay protection and normalises sign/exponent before submitting.
